#!/usr/bin/env node
/**
 * verify-git-plugin.mjs —— oc-plugin-git host 功能测试（P1-2；对标 ark verify-git-plugin.mjs）。
 *
 * 被测对象 = **staged 产物**（build/plugins/oc-plugin-git，collect-plugins.mjs 物化后的随包形态，
 * 自带 node_modules）——「测所发之物」。先跑 collect-plugins 再跑本脚本。
 *
 * 覆盖：21 工具注册、init/add/commit/status/diff/branch/log 工具面、凭据 save/list/remove
 * （落 config/opencode/、口令不回显；0600 判据在 POSIX 宿主核，Windows 宿主如实标注为设备侧判据）、
 * P0-N 基准 host 预演（≈5MB 仓库 status/diff/commit 时限）。
 *
 * 用法：node scripts/verify-git-plugin.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const staged = path.join(root, 'build/plugins/oc-plugin-git/index.js')
const source = path.join(root, 'plugins/oc-plugin-git/index.js')
const pluginPath = existsSync(staged) ? staged : source
if (!existsSync(pluginPath)) {
  console.error('✗ 插件源缺失（先跑 node scripts/collect-plugins.mjs）')
  process.exit(2)
}
if (pluginPath === source) {
  console.error('✗ 未找到 staged 插件（build/plugins/oc-plugin-git）；host 测试必须针对物化产物（自带依赖）')
  process.exit(2)
}

let failed = 0
const t = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!ok) failed++
}
/** 工具结果成功判定：内容不得是运行时缺失/错误文案 */
const okResult = (r) => {
  const text = typeof r?.content === 'string' ? r.content : JSON.stringify(r ?? {})
  return !/not available|RuntimeUnavailable|(^|\W)error/i.test(text)
}

const sandbox = mkdtempSync(path.join(tmpdir(), 'oc-git-verify-'))
const home = path.join(sandbox, 'home')
const configHome = path.join(home, 'config')
mkdirSync(home, { recursive: true })
mkdirSync(configHome, { recursive: true })
process.env.HOME = home
process.env.USERPROFILE = home
process.env.XDG_CONFIG_HOME = configHome

let tools = []
let rpcHandlers = null

/* 围栏根=项目根（真实运行时 location.project.directory 即仓库根）：先建仓库再装配 mock */
const repo = path.join(sandbox, 'repo')
mkdirSync(repo, { recursive: true })
process.chdir(repo)
writeFileSync(path.join(repo, 'a.txt'), 'hello oc\n')

const mockContext = {
  location: { project: { directory: repo }, directory: repo },
  tool: {
    transform: async (fn) => {
      const added = []
      const editor = { add: (tool) => added.push(tool), get: (name) => added.find((x) => x.name === name), errors: [] }
      await fn(editor)
      tools = added
    },
  },
  vcs: { transform: async () => {}, reload: async () => {} },
  rpc: {
    register: async (definition, handlers) => {
      rpcHandlers = handlers
      return { dispose: async () => {} }
    },
  },
}

const plugin = await import(pathToFileURL(pluginPath).href)
const dispose = await plugin.default.setup(mockContext)

t('21 个工具注册', tools.length === 21, `实际 ${tools.length}`)
const names = tools.map((x) => x.name)
for (const expect of ['git_init', 'git_status', 'git_diff', 'git_commit', 'git_log', 'git_branch', 'git_config']) {
  t(`工具 ${expect} 在列`, names.includes(expect))
}
t('凭据 RPC 注册', !!rpcHandlers && typeof rpcHandlers['credentials.save'] === 'function')

const byName = Object.fromEntries(tools.map((x) => [x.name, x]))

/* ── 工具面 ───────────────────────────────────────────────────────────────── */
const rInit = await byName.git_init.execute({ dir: '.' })
t('git_init', okResult(rInit), String(rInit.content ?? '').slice(0, 40))
await byName.git_add.execute({ dir: '.', files: ['a.txt'] })
const rCommit = await byName.git_commit.execute({ dir: '.', message: 'init commit' })
t('git_commit', okResult(rCommit), String(rCommit.content ?? '').slice(0, 40))
const rStatus = await byName.git_status.execute({ dir: '.' })
t('git_status 可用', okResult(rStatus), String(rStatus.content ?? '').slice(0, 50).replace(/\n/g, ' '))
writeFileSync(path.join(repo, 'a.txt'), 'hello oc\nchanged\n')
/* fs-adapter 以 mtime 为缓存粒度（ark 原版语义）：同毫秒内「编辑→add」会命中旧缓存；
 * 等 60ms 模拟真实用户节奏（该粒度观察已登记 20261029-1 REVIEW_REPORT，作为 ark 上游同步项） */
await new Promise((resolve) => setTimeout(resolve, 60))
await byName.git_add.execute({ dir: '.', files: ['a.txt'] })
const rDiff = await byName.git_diff.execute({ dir: '.', mode: 'staged' })
t('git_diff 检出变更', okResult(rDiff) && JSON.stringify(rDiff).includes('changed'), String(rDiff.content ?? '').slice(0, 40))
const rBranch = await byName.git_branch.execute({ dir: '.', name: 'feature', checkout: true })
t('git_branch 建并切', okResult(rBranch), String(rBranch.content ?? '').slice(0, 40))
const rLog = await byName.git_log.execute({ dir: '.' })
t('git_log 含提交', okResult(rLog) && JSON.stringify(rLog).includes('init commit'), String(rLog.content ?? '').slice(0, 40))

/* ── 凭据面 ───────────────────────────────────────────────────────────────── */
const credFile = path.join(configHome, 'opencode', 'git-credentials')
const saved = await rpcHandlers['credentials.save']({ protocol: 'https', host: 'github.com', username: 'oc', password: 'token-123' })
const isWin = process.platform === 'win32'
t('credentials.save', isWin ? saved.ok === true || saved.code === 'write-failed' : saved.ok === true, JSON.stringify(saved).slice(0, 80))
t('凭据落 config/opencode/', existsSync(credFile), credFile)
if (!isWin) {
  const mode = (statSync(credFile).mode & 0o777).toString(8)
  t('凭据 0600', mode === '600', mode)
} else {
  console.log('SKIP 凭据 0600（Windows 宿主 chmod 语义不同；设备侧 P0-N 轮复核）')
}
const listed = await rpcHandlers['credentials.list']({})
t('credentials.list 含 host 且口令不回显', JSON.stringify(listed).includes('github.com') && !JSON.stringify(listed).includes('token-123'))
const removed = await rpcHandlers['credentials.remove']({ protocol: 'https', host: 'github.com', username: 'oc' })
t('credentials.remove', removed.ok === true, JSON.stringify(removed))

/* ── P0-N 基准（host 预演）：复用围栏内仓库（repo/data/），保证 dir:'.' 在围栏内 ── */
mkdirSync(path.join(repo, 'data'), { recursive: true })
const chunk = ('oc-desktop-android benchmark line 0123456789 ABCDEFGHIJ\n').repeat(4000)
for (let i = 0; i < 28; i++) writeFileSync(path.join(repo, 'data', `f${i}.txt`), `# file ${i}\n${chunk}`)
let t0 = Date.now()
await byName.git_add.execute({ dir: '.', files: ['data'] })
const addMs = Date.now() - t0
t0 = Date.now()
await byName.git_commit.execute({ dir: '.', message: 'big baseline' })
const commitMs = Date.now() - t0
t0 = Date.now()
await byName.git_status.execute({ dir: '.' })
const statusMs = Date.now() - t0
writeFileSync(path.join(repo, 'data', 'f0.txt'), readFileSync(path.join(repo, 'data', 'f0.txt'), 'utf8').replace('benchmark', 'BENCHMARK'))
await new Promise((resolve) => setTimeout(resolve, 60))
await byName.git_add.execute({ dir: '.', files: ['data'] })
t0 = Date.now()
const bigDiff = await byName.git_diff.execute({ dir: '.', mode: 'staged' })
const diffMs = Date.now() - t0
t('P0-N commit < 30s', commitMs < 30_000, `${commitMs} ms（add ${addMs} ms）`)
t('P0-N status < 15s', statusMs < 15_000, `${statusMs} ms`)
t('P0-N diff < 30s 且有结果', diffMs < 30_000 && JSON.stringify(bigDiff).includes('BENCHMARK'), `${diffMs} ms`)
console.log(`  P0-N host 预演：add=${addMs}ms commit=${commitMs}ms status=${statusMs}ms diff=${diffMs}ms`)

try { dispose && dispose() } catch { /* ignore */ }
try { process.chdir(root); rmSync(sandbox, { recursive: true, force: true, maxRetries: 3 }) } catch (e) {
  console.log(`  （沙箱清理跳过：${e.code ?? e.message}——不影响门禁）`)
}

if (failed > 0) {
  console.error(`\n✗ ${failed} 项失败`)
  process.exit(1)
}
console.log(`\n✓ oc-plugin-git host 功能测试全过（被测=${pluginPath === staged ? 'staged 产物' : '源'}）`)
