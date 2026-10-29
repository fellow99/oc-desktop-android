/**
 * oc-plugin-workspace-roots —— 「工作区选择器」的壳侧能力面（Android 版，P1-6 / 规格 203）。
 *
 * 与 ark 版（oc-desktop-ark/plugins/oc-plugin-workspace-roots）的差异（D14 导入制）：
 *   · 根清单只有 **沙箱**（Android 不申请全局存储；文档/下载根不存在）——UI 的 Tab 是动态渲染
 *     `roots.latest.roots`，单根即单 Tab；
 *   · 权限方法如实降级：Android 无目录级 ACL，`permissionCheck/Request` 对沙箱恒 granted，
 *     对其它 id 返回 not-applicable（UI 显示「不可用」并完整回退）；
 *   · 新增 Android 三动作（203 R1/R2/R3，能力清单 §5-6）：
 *       import        发起 SAF 选树 → Kotlin 拷入 `workspace/<name>/`（后台 + 可取消 + 进度文件）
 *       importStatus  查询导入进度（读 `.import-<token>.json`，Kotlin 侧写入）
 *       importCancel  取消进行中的导入
 *       remove        删除沙箱内的项目目录（围栏 + 非当前 cwd 校验）
 *       setCurrent    设定默认项目（写 `workspace/.current`，下次启动编排 [4/6] chdir 生效，203 R4）
 *   · `roots` 响应带 `capabilities: ['import','remove','setCurrent']`——补丁 0009 的 UI 按钮据此
 *     自门控（老插件/ark 部署无此字段 ⇒ 按钮不渲染）。
 *
 * 传输：`POST /api/rpc/oc-harmony-workspace-roots/<method>`（UI 硬编码 id，不可改名）。
 * 结果约定：所有方法不抛错，统一返回 `{ ok, code, message, ... }`。
 * 准入：不依赖 PTY、不 spawn、不依赖原生模块；只用 node 内建与宿主桥 host.js。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const PLUGIN_ID = 'oc-harmony-workspace-roots'
const LOG_PREFIX = '[oc-android]'

const CAPABILITIES = ['import', 'remove', 'setCurrent']
const LIST_LIMIT = 500
const NAME_MAX = 255

/** 宿主桥解析（Android：桥引导件随 AAR 首启物化到 filesDir/node-bridge/）。 */
function resolveHost() {
  const candidates = []
  if (process.env.OC_NODE_BRIDGE_HOST) candidates.push(process.env.OC_NODE_BRIDGE_HOST)
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (home) candidates.push(path.join(home, 'node-bridge', 'host.js'))
  if (process.env.NODE_BRIDGE_READONLY_ROOT) {
    candidates.push(path.join(process.env.NODE_BRIDGE_READONLY_ROOT, 'host.js'))
  }
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return nodeRequire(p)
    } catch (e) {
      console.log(`${LOG_PREFIX} workspace-roots: 加载 host.js 失败 ${p}: ${e && e.message}`)
    }
  }
  return undefined
}
const host = resolveHost()

const HOME = process.env.HOME || process.env.USERPROFILE || ''
const sandboxRoot = () => (HOME ? path.join(HOME, 'workspace') : '')
const progressFile = (token) => path.join(sandboxRoot(), `.import-${token}.json`)

function outcome(code, message) {
  return { ok: false, code, message }
}

function statDir(p) {
  try {
    const st = fs.statSync(p)
    return { exists: true, isDir: st.isDirectory(), error: '' }
  } catch (e) {
    const code = e && e.code ? e.code : 'error'
    return { exists: false, isDir: false, error: code }
  }
}

function validateSegment(name) {
  if (typeof name !== 'string') return 'invalid-name'
  const value = name.trim()
  if (!value || value.length > NAME_MAX) return 'invalid-name'
  if (value === '.' || value === '..') return 'invalid-name'
  if (value.indexOf('/') >= 0 || value.indexOf(String.fromCharCode(92)) >= 0) return 'invalid-name'
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'invalid-name'
  return ''
}

function payloadOf(payload) {
  if (!payload || typeof payload !== 'object') return {}
  const keys = Object.keys(payload)
  if (keys.length === 1 && keys[0] === 'input' && payload.input && typeof payload.input === 'object') {
    return payload.input
  }
  return payload
}

/** 沙箱内项目列表（只列直接子目录；`.import-*` 等点文件天然排除）。 */
function listProjects() {
  const root = sandboxRoot()
  const st = statDir(root)
  if (!st.exists || !st.isDir) return { projects: [], error: st.error }
  const projects = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const p = path.join(root, e.name)
      let mtime = null
      try { mtime = fs.statSync(p).mtime.toISOString() } catch { /* ignore */ }
      let imported = null
      try { imported = JSON.parse(fs.readFileSync(path.join(p, '.import.json'), 'utf8')) } catch { /* 非导入项目 */ }
      return { name: e.name, path: p, mtime, source: imported?.sourceUri ?? '' }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return { projects, error: '' }
}

// ── handlers（全部 async：上游对返回值直接 .then()，同步返回会变成 rpc.internal）──

async function handleRoots() {
  const root = sandboxRoot()
  if (root) {
    try { fs.mkdirSync(root, { recursive: true }) } catch (e) {
      console.log(`${LOG_PREFIX} workspace-roots: 创建沙箱根失败 ${root}: ${(e && e.message) || e}`)
    }
  }
  const st = statDir(root)
  let current = ''
  try { current = fs.readFileSync(path.join(root, '.current'), 'utf8').trim() } catch { /* 默认空 */ }
  console.log(`${LOG_PREFIX} workspace-root ${new Date().toISOString()} sandbox=${st.exists && st.isDir ? root : '<unavailable: ' + st.error + '>'}`)
  return {
    home: HOME,
    userHome: HOME,
    capabilities: CAPABILITIES,
    current,
    roots: [
      {
        id: 'sandbox',
        path: root,
        available: !!st.exists && st.isDir,
        needsPermission: false,
        reason: st.exists ? '' : st.error,
      },
    ],
  }
}

async function handleBrowse(input) {
  const id = input && typeof input.id === 'string' ? input.id : ''
  const sub = input && typeof input.sub === 'string' ? input.sub : ''
  if (id !== 'sandbox') return { ...outcome('root-unknown', `未知主目录：${id || '<empty>'}`), entries: [], count: 0 }
  const root = sandboxRoot()
  if (!root) return { ...outcome('root-unavailable', '主目录路径不可用'), entries: [], count: 0 }
  const target = sub ? path.resolve(root, sub) : root
  const realRoot = path.resolve(root)
  if (target !== realRoot && !target.startsWith(realRoot + path.sep)) {
    return { ...outcome('out-of-root', `子路径超出主目录范围：${sub}`), entries: [], count: 0 }
  }
  const st = statDir(target)
  if (!st.exists) return { ...outcome('not-found', `目录不可用：${target}`), entries: [], count: 0 }
  if (!st.isDir) return { ...outcome('not-a-dir', `不是目录：${target}`), entries: [], count: 0 }
  try {
    const entries = fs
      .readdirSync(target, { withFileTypes: true })
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1))
    const total = entries.length
    const visible = entries.slice(0, LIST_LIMIT)
    return {
      ok: true, code: '', message: '', entries: visible, count: visible.length,
      total, truncated: total > visible.length,
    }
  } catch (e) {
    const code = e && e.code ? e.code : 'error'
    return { ok: false, code, message: (e && e.message) || String(e), entries: [], count: 0, total: 0, truncated: false }
  }
}

async function handleMkdir(input) {
  const parent = input && typeof input.parent === 'string' ? input.parent : ''
  const name = input && typeof input.name === 'string' ? input.name : ''
  const root = sandboxRoot()
  if (!root) return outcome('root-unavailable', '主目录路径不可用')
  const bad = validateSegment(name)
  if (bad) return outcome(bad, `文件夹名称不可用：${name || '<empty>'}`)
  const realRoot = path.resolve(root)
  const target = parent ? path.resolve(realRoot, parent) : realRoot
  if (target !== realRoot && !target.startsWith(realRoot + path.sep)) {
    return outcome('out-of-root', `目标位置不在主目录内：${parent}`)
  }
  const st = statDir(target)
  if (!st.exists) return outcome('invalid-parent', `父目录不存在：${target}`)
  if (!st.isDir) return outcome('invalid-parent', `父路径不是目录：${target}`)
  const dest = path.join(target, name.trim())
  try {
    fs.mkdirSync(dest, { recursive: false })
    console.log(`${LOG_PREFIX} workspace-root mkdir ${dest}`)
    return { ok: true, code: '', message: '', path: dest }
  } catch (e) {
    if (e && e.code === 'EEXIST') return { ok: false, code: 'exists', message: `已存在同名文件夹：${name}`, path: dest }
    return { ok: false, code: 'create-failed', message: `${e && e.code ? e.code : ''}: ${(e && e.message) || String(e)}`, path: dest }
  }
}

async function handlePermissionCheck(input) {
  const id = input && typeof input.id === 'string' ? input.id : ''
  if (id === 'sandbox') return { granted: true, source: 'sandbox', message: '' }
  return { granted: false, source: 'not-applicable', message: 'Android 采用 SAF 导入制，沙箱外目录不直接可读' }
}

async function handlePermissionRequest(input) {
  const id = input && typeof input.id === 'string' ? input.id : ''
  if (id === 'sandbox') return { ok: true, code: '0', granted: true, bridgeUnavailable: false, timeout: false, message: '' }
  return {
    ok: true, code: 'not-applicable', granted: false, bridgeUnavailable: false, timeout: false,
    message: 'Android 无目录级权限申请；请使用「导入」把外部目录拷入沙箱',
  }
}

async function handleOpenAppInfo() {
  if (!host) return { ok: false, message: '宿主桥不可用' }
  try {
    const r = await host.invoke('openAppInfo', {})
    return { ok: !!(r && r.ok !== false), message: (r && r.message) || '' }
  } catch (e) {
    return { ok: false, message: (e && e.message) || String(e) }
  }
}

/** SAF 导入：发起到完成是异步的（Kotlin 后台拷贝），本方法只负责发起并返回 token。 */
async function handleImport(input) {
  if (!host) return outcome('bridge-unavailable', '宿主桥不可用（saf.pickFolder 未注册？）')
  const suggestedName = input && typeof input.suggestedName === 'string' ? input.suggestedName : ''
  try {
    const r = await host.invoke('saf.pickFolder', { suggestedName })
    if (!r || r.ok !== true || !r.token) {
      return { ...outcome(r && r.error ? 'host-rejected' : 'host-failed', (r && (r.error || r.message)) || 'SAF 选择器发起失败') }
    }
    console.log(`${LOG_PREFIX} workspace-root import started token=${r.token} name=${r.name || ''}`)
    return { ok: true, code: '', message: '导入已发起（进度用 importStatus 查询）', token: r.token, name: r.name || '' }
  } catch (e) {
    return outcome('bridge-error', (e && e.message) || String(e))
  }
}

async function handleImportStatus(input) {
  const token = input && typeof input.token === 'string' ? input.token : ''
  if (!token || /[^\w-]/.test(token)) return outcome('invalid-token', 'token 非法')
  try {
    const data = JSON.parse(fs.readFileSync(progressFile(token), 'utf8'))
    return { ok: true, code: '', message: '', ...data }
  } catch (e) {
    if (e && e.code === 'ENOENT') return outcome('not-found', '无此导入任务（或已完成并清理）')
    return outcome('read-failed', (e && e.message) || String(e))
  }
}

async function handleImportCancel(input) {
  const token = input && typeof input.token === 'string' ? input.token : ''
  if (!token || /[^\w-]/.test(token)) return outcome('invalid-token', 'token 非法')
  if (!host) return outcome('bridge-unavailable', '宿主桥不可用')
  try {
    const r = await host.invoke('saf.cancelImport', { token })
    return { ok: !!(r && r.ok !== false), code: '', message: (r && r.message) || '' }
  } catch (e) {
    return outcome('bridge-error', (e && e.message) || String(e))
  }
}

async function handleRemove(input) {
  const name = input && typeof input.name === 'string' ? input.name : ''
  const root = sandboxRoot()
  if (!root) return outcome('root-unavailable', '主目录路径不可用')
  const bad = validateSegment(name)
  if (bad) return outcome(bad, `项目名称不可用：${name || '<empty>'}`)
  const target = path.resolve(root, name.trim())
  if (!target.startsWith(path.resolve(root) + path.sep)) return outcome('out-of-root', '目标不在沙箱内')
  const st = statDir(target)
  if (!st.exists) return outcome('not-found', `项目不存在：${name}`)
  if (!st.isDir) return outcome('not-a-dir', `不是目录：${name}`)
  const cwd = path.resolve(process.cwd())
  if (cwd === target || cwd.startsWith(target + path.sep)) {
    return outcome('busy', '该项目是当前会话工作区，切换后再删除')
  }
  try {
    fs.rmSync(target, { recursive: true, force: true })
    console.log(`${LOG_PREFIX} workspace-root removed ${target}`)
    return { ok: true, code: '', message: '' }
  } catch (e) {
    return outcome('remove-failed', (e && e.message) || String(e))
  }
}

async function handleSetCurrent(input) {
  const name = input && typeof input.name === 'string' ? input.name : ''
  const root = sandboxRoot()
  if (!root) return outcome('root-unavailable', '主目录路径不可用')
  if (name !== '') {
    const bad = validateSegment(name)
    if (bad) return outcome(bad, `项目名称不可用：${name}`)
    const st = statDir(path.resolve(root, name.trim()))
    if (!st.exists || !st.isDir) return outcome('not-found', `项目不存在：${name}`)
  }
  const marker = path.join(root, '.current')
  try {
    if (name === '') fs.rmSync(marker, { force: true })
    else fs.writeFileSync(marker, `${name.trim()}\n`)
    return { ok: true, code: '', message: name === '' ? '已恢复默认工作区' : `已设当前项目：${name.trim()}（下次启动生效）` }
  } catch (e) {
    return outcome('write-failed', (e && e.message) || String(e))
  }
}

const INPUT_SCHEMA = {
  type: 'object',
  properties: { input: { type: 'object', additionalProperties: true } },
  additionalProperties: true,
}
const OUTPUT_SCHEMA = { type: 'object', additionalProperties: true }

export default {
  id: PLUGIN_ID,
  async setup(context) {
    if (!context || !context.rpc || typeof context.rpc.register !== 'function') {
      throw new Error(`${PLUGIN_ID}: unexpected plugin context (missing context.rpc.register)`)
    }
    const method = (description) => ({ description, input: INPUT_SCHEMA, output: OUTPUT_SCHEMA })
    const definition = {
      id: PLUGIN_ID,
      name: 'OC Workspace Roots',
      description: '沙箱工作区选择器（Android SAF 导入制：列/导入/删除 + 进度可取消）',
      events: {},
      methods: {
        roots: method('沙箱根解析 + 能力声明（capabilities/current）'),
        browse: method('列沙箱根（或其子目录）'),
        mkdir: method('在沙箱内新建项目文件夹'),
        permissionCheck: method('权限预检（Android：沙箱恒可用）'),
        permissionRequest: method('权限申请（Android：如实降级为 SAF 导入提示）'),
        openAppInfo: method('深链到本应用信息页'),
        import: method('SAF 选树并拷入沙箱（异步，返回 token）'),
        importStatus: method('查询导入进度（Kotlin 写入的进度文件）'),
        importCancel: method('取消进行中的导入'),
        remove: method('删除沙箱内项目（非当前 cwd）'),
        setCurrent: method('设定默认项目（.current，下次启动 chdir 生效）'),
      },
    }
    const registration = await context.rpc.register(definition, {
      roots: async () => handleRoots(),
      browse: async (payload) => handleBrowse(payloadOf(payload)),
      mkdir: async (payload) => handleMkdir(payloadOf(payload)),
      permissionCheck: async (payload) => handlePermissionCheck(payloadOf(payload)),
      permissionRequest: async (payload) => handlePermissionRequest(payloadOf(payload)),
      openAppInfo: async () => handleOpenAppInfo(),
      import: async (payload) => handleImport(payloadOf(payload)),
      importStatus: async (payload) => handleImportStatus(payloadOf(payload)),
      importCancel: async (payload) => handleImportCancel(payloadOf(payload)),
      remove: async (payload) => handleRemove(payloadOf(payload)),
      setCurrent: async (payload) => handleSetCurrent(payloadOf(payload)),
    })
    console.log(`${LOG_PREFIX} plugin ${PLUGIN_ID} registered (roots/browse/mkdir/import/importStatus/importCancel/remove/setCurrent)`)
    return () => {
      Promise.resolve(registration && registration.dispose && registration.dispose()).catch(() => {})
    }
  },
}
