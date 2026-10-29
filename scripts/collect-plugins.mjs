#!/usr/bin/env node
/**
 * collect-plugins.mjs —— 壳插件构建期物化（P2-9 提前为 P1 硬前置；规格 102 扩展 / 规划 §5.11 D11）。
 *
 * 三件 L1 本地插件 → 构建暂存 build/plugins/<name>/（collect-opencode.mjs 以 `plugins/<name>` 打进载荷）：
 *   · oc-plugin-git             isomorphic-git + 21 个 git_* 工具（依赖需 npm 物化 + 缓存）
 *   · oc-plugin-workspace-roots 工作区选择器能力面（零依赖单文件）
 *   · oc-plugin-search          grep/glob 纯 JS 兜底（零依赖单文件）
 *
 * 为什么构建期物化（对标 ark collect-plugins.mjs）：设备侧不能 npm install（L1 只允许本地），
 * 插件必须在包内自带 node_modules/；平台无 symlink ⇒ 一律 copy。
 *
 * 断言（失败即抛错，绝不静默产出空目录）：
 *   ① git 插件依赖 = pin（isomorphic-git 1.44.2 / diff 9.x）；传输入口 isomorphic-git/http/node 可解析；
 *   ② 21 个 git_* 工具名在 lib/tools/index.js 中登记；
 *   ③ 三插件源码无禁用面（child_process / spawn / exec / .node / .so）；
 *   ④ 物化产物无符号链接、无原生库；git 插件总体积 ≤ 12 MB。
 *
 * 用法：
 *   node scripts/collect-plugins.mjs                # 物化 + 断言 + 写清单
 *   node scripts/collect-plugins.mjs --check-only   # 只做静态断言（不联网、不写盘）
 *   node scripts/collect-plugins.mjs --force        # 忽略缓存重建依赖
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginsSrc = path.join(root, 'plugins')
const stageDir = path.join(root, 'build', 'plugins')
const cacheDir = path.join(root, '.cache', 'git-plugin-runtime')

/** 依赖 pin（与 plugins/oc-plugin-git/lib/runtime.js 的运行时断言一致，双保险）。 */
export const PINS = {
  isomorphicGit: '1.44.2',
  diff: '9.0.0',
  diffMajor: 9,
  packages: 56,
  maxBytes: 12 * 1024 * 1024,
}

const CHECK_ONLY = process.argv.includes('--check-only')
const FORCE = process.argv.includes('--force')
const WIN = process.platform === 'win32'

const PLUGINS = [
  {
    name: 'oc-plugin-git',
    files: ['index.js', 'package.json', 'lib'],
    optional: ['README.md'],
    needsDeps: true,
  },
  { name: 'oc-plugin-workspace-roots', files: ['index.mjs', 'package.json'], optional: ['README.md'], needsDeps: false },
  { name: 'oc-plugin-search', files: ['index.js', 'package.json'], optional: ['README.md'], needsDeps: false },
]

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/** 静态断言：插件源存在、无禁用面（对 lib 与单文件递归）。 */
function assertPluginSource(p) {
  const src = path.join(pluginsSrc, p.name)
  for (const f of p.files) {
    if (!existsSync(path.join(src, f))) fail(`插件源缺失：${p.name}/${f}`)
  }
  const banned = [/child_process/, /\bspawnSync?\b/, /\bexecFileSync?\b/, /require\(["']\.node["']\)/]
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'tests' || entry.name === 'node_modules') continue
        walk(abs)
      } else if (/\.(c|m)?js$/.test(entry.name)) {
        const text = readFileSync(abs, 'utf8')
        for (const re of banned) {
          if (re.test(text)) fail(`插件源命中禁用面（${re}）：${path.relative(root, abs)}`)
        }
      }
    }
  }
  walk(src)
  if (p.name === 'oc-plugin-git') {
    const toolsIndex = readFileSync(path.join(src, 'lib/tools/index.js'), 'utf8')
    const expected = [
      'git_init', 'git_clone', 'git_status', 'git_diff', 'git_log', 'git_show', 'git_add', 'git_commit',
      'git_branch', 'git_checkout', 'git_reset', 'git_merge', 'git_cherry_pick', 'git_revert', 'git_stash',
      'git_tag', 'git_remote', 'git_fetch', 'git_pull', 'git_push', 'git_config',
    ]
    for (const name of expected) {
      if (!toolsIndex.includes(`"${name}"`) && !toolsIndex.includes(`'${name}'`)) {
        fail(`工具表缺少 ${name}（注册且仅注册 21 个 git_* 工具）`)
      }
    }
  }
  return src
}

function bytesOf(dir) {
  let total = 0
  let count = 0
  let packages = 0
  const native = []
  const symlinks = []
  function walk(current, rel) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) { symlinks.push(relPath); continue }
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue
        if (rel === 'node_modules') { if (!entry.name.startsWith('@')) packages += 1 }
        else if (rel.startsWith('node_modules/@') && rel.split('/').length === 2) packages += 1
        walk(abs, relPath)
        continue
      }
      if (/\.(node|so)$/i.test(entry.name)) native.push(relPath)
      total += statSync(abs).size
      count += 1
    }
  }
  walk(dir, '')
  return { total, count, packages, native, symlinks }
}

function manifestOf(dir) {
  const files = []
  function walk(current, rel) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(abs, relPath)
      else if (!entry.isSymbolicLink()) {
        const b = readFileSync(abs)
        files.push({ path: relPath, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') })
      }
    }
  }
  walk(dir, '')
  files.sort((a, b) => (a.path < b.path ? -1 : 1))
  const digest = createHash('sha256')
  for (const f of files) digest.update(`${f.path}\0${f.bytes}\0${f.sha256}\n`)
  return { digest: digest.digest('hex'), count: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0) }
}

function cacheHit() {
  const igPkg = path.join(cacheDir, 'node_modules/isomorphic-git/package.json')
  const diffPkg = path.join(cacheDir, 'node_modules/diff/package.json')
  if (!existsSync(igPkg) || !existsSync(diffPkg)) return false
  try {
    const ig = JSON.parse(readFileSync(igPkg, 'utf8'))
    const df = JSON.parse(readFileSync(diffPkg, 'utf8'))
    return ig.version === PINS.isomorphicGit && Number.parseInt(df.version, 10) === PINS.diffMajor
  } catch {
    return false
  }
}

function installDeps() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'oc-git-runtime-'))
  console.log(`→ 物化依赖：isomorphic-git@${PINS.isomorphicGit} + diff@${PINS.diff}（npm install → ${tmp}）`)
  writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
    name: 'oc-git-runtime', private: true, version: '0.0.0',
    dependencies: { 'isomorphic-git': PINS.isomorphicGit, diff: PINS.diff },
  }, null, 2))
  try {
    execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'],
      { cwd: tmp, stdio: 'inherit', shell: WIN })
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true })
    fail(`依赖物化失败（npm install）：${error && error.message ? error.message : error}`)
  }
  const staged = path.join(tmp, 'node_modules')
  if (!existsSync(staged)) {
    rmSync(tmp, { recursive: true, force: true })
    fail('npm install 未产出 node_modules（拒绝静默产出空目录）')
  }
  rmSync(cacheDir, { recursive: true, force: true })
  mkdirSync(cacheDir, { recursive: true })
  cpSync(staged, path.join(cacheDir, 'node_modules'), { recursive: true })
  rmSync(tmp, { recursive: true, force: true })
  console.log(`✓ 依赖已缓存：${path.relative(root, path.join(cacheDir, 'node_modules'))}`)
}

function stageOne(p) {
  const src = assertPluginSource(p)
  const dest = path.join(stageDir, p.name)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  for (const f of p.files) cpSync(path.join(src, f), path.join(dest, f), { recursive: true })
  for (const f of p.optional) {
    if (existsSync(path.join(src, f))) cpSync(path.join(src, f), path.join(dest, f), { recursive: true })
  }
  if (p.needsDeps) {
    if (!cacheHit()) {
      if (CHECK_ONLY) fail('依赖缓存缺失（--check-only 模式不联网）；先跑一次不带 --check-only 的物化')
      installDeps()
    }
    cpSync(path.join(cacheDir, 'node_modules'), path.join(dest, 'node_modules'), { recursive: true })
    rmSync(path.join(dest, 'node_modules/.bin'), { recursive: true, force: true })
    const igPkg = JSON.parse(readFileSync(path.join(dest, 'node_modules/isomorphic-git/package.json'), 'utf8'))
    if (igPkg.version !== PINS.isomorphicGit) fail(`isomorphic-git 版本不符：期望 ${PINS.isomorphicGit}，实际 ${igPkg.version}`)
    const transport = path.join(dest, 'node_modules/isomorphic-git/http/node/index.js')
    const transportMjs = path.join(dest, 'node_modules/isomorphic-git/http/node/index.cjs')
    if (!existsSync(transport) && !existsSync(transportMjs)) fail('缺少 HTTPS 传输入口 isomorphic-git/http/node')
    const stats = bytesOf(dest)
    if (stats.packages !== PINS.packages) fail(`依赖包数不符：期望 ${PINS.packages}，实际 ${stats.packages}（依赖树变了 ⇒ 复核 pin）`)
    if (stats.total > PINS.maxBytes) fail(`插件体积超限：${stats.total} B > ${PINS.maxBytes} B`)
    if (stats.native.length > 0) fail(`插件含原生库（禁止）：${stats.native.join(', ')}`)
    if (stats.symlinks.length > 0) fail(`插件含符号链接（平台不支持）：${stats.symlinks.join(', ')}`)
  }
  const manifest = manifestOf(dest)
  writeFileSync(path.join(dest, 'materialize.json'), JSON.stringify({
    schema: 1, plugin: p.name, files: manifest.count, bytes: manifest.bytes,
    digest: manifest.digest, builtAt: Date.now(),
  }, null, 2) + '\n')
  return { name: p.name, ...manifest }
}

function main() {
  for (const p of PLUGINS) assertPluginSource(p)
  if (CHECK_ONLY) {
    console.log('✓ --check-only：三插件源静态断言通过（21 工具 / 无子进程 / 无原生模块）')
    return
  }
  if (FORCE) rmSync(cacheDir, { recursive: true, force: true })
  rmSync(stageDir, { recursive: true, force: true })
  mkdirSync(stageDir, { recursive: true })
  const results = PLUGINS.map(stageOne)
  writeFileSync(path.join(stageDir, 'materialize.json'), JSON.stringify({
    schema: 1, plugins: results, builtAt: Date.now(),
  }, null, 2) + '\n')
  for (const r of results) {
    console.log(`✓ 投放 ${r.name}：${r.count} 文件 / ${(r.bytes / 1048576).toFixed(2)} MB / digest=${r.digest.slice(0, 16)}…`)
  }
  console.log(`✓ 暂存完成：${path.relative(root, stageDir)}（collect-opencode.mjs 将以 plugins/ 前缀打进载荷）`)
}

main()
