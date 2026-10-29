#!/usr/bin/env node
/**
 * 组装 Android 载荷（§7.1 ⑥）：上游 dist-node → assets/opencode-dist.tar.gz + 清单。
 *
 *   源：../opencode/packages/cli/dist-node/{opencode.mjs, assets/**}
 *   出：app/src/main/assets/opencode-dist.tar.gz（ustar tar.gz）
 *       打印 manifest JSON（schema/version/tarSha256/files/bytes）
 *
 * 纪律：
 *   · 基线守卫：../opencode HEAD 必须 = 锁定基线 a517687fde（Branch_v2.1.2，tag v2.1.2）；
 *     `--force` 可跳过（仅诊断，禁止用于交付）；
 *   · `--check`：只校验源与基线，不产出；
 *   · 不裁剪 assets（P0-C/K 结论出来前，wasm 资产一律随包——JIT 主线依赖 WASM）；
 *   · 输出文件只原子替换（tmp + rename）。
 *
 * 用法：node scripts/collect-opencode.mjs [--check] [--force]
 */
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { execSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CHECK = process.argv.includes('--check')
const FORCE = process.argv.includes('--force')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, process.env.OPENCODE_DIR ?? '../opencode')
const dist = path.join(repo, 'packages/cli/dist-node')
const outDir = path.join(root, 'app/src/main/assets')
const BASELINE = process.env.EXPECTED_BASELINE ?? 'a517687fde'
const VERSION = '2.1.2'

// ── 基线守卫 ─────────────────────────────────────────────────────────────────
function gitHead(dir) {
  try {
    return execSync('git rev-parse --short=10 HEAD', { cwd: dir, encoding: 'utf8' }).trim()
  } catch {
    return '(git 不可用)'
  }
}

const head = gitHead(repo)
let pkgVersion = '(unknown)'
try {
  pkgVersion = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')).version
} catch { /* ignore */ }

console.log(`上游基线：HEAD=${head} version=${pkgVersion}（期望 ${BASELINE} / ${VERSION}）`)
if ((head !== BASELINE || pkgVersion !== VERSION) && !FORCE) {
  console.error(`✗ 基线不匹配。若确属诊断需要，加 --force 重跑。`)
  process.exit(2)
}
if (!existsSync(path.join(dist, 'opencode.mjs'))) {
  console.error(`✗ 缺少产物：${dist}/opencode.mjs（先在上游按 §5.2 构建bundle）`)
  process.exit(2)
}
if (!existsSync(path.join(dist, 'assets'))) {
  console.error(`✗ 缺少资产：${dist}/assets（bundle 需要 OPENCODE_NODE_ASSETS_DIR 指向它）`)
  process.exit(2)
}
if (CHECK) {
  console.log('✓ 基线与产物齐备（--check 不产出）')
  process.exit(0)
}

// ── 运行时锁值门禁（P1-5；--skip-runtime-check 仅诊断）────────────────────────
if (!process.argv.includes('--skip-runtime-check')) {
  const { spawnSync } = await import('node:child_process')
  const verify = spawnSync(process.execPath, [path.join(root, 'scripts', 'verify-runtime.mjs')], { stdio: 'inherit' })
  if (verify.status !== 0) {
    console.error(`✗ verify-runtime 门禁未过（exit=${verify.status}）；不把不确定引擎打进载荷。`)
    process.exit(2)
  }
}

// ── 插件暂存（P2-9/P1 前置；collect-plugins.mjs 产出 build/plugins）──────────
const pluginsStage = path.join(root, 'build', 'plugins')
if (!existsSync(path.join(pluginsStage, 'oc-plugin-git', 'index.js'))) {
  console.error(`✗ 缺插件暂存：${pluginsStage}（先跑 node scripts/collect-plugins.mjs）`)
  process.exit(2)
}

// ── ustar 打包 ───────────────────────────────────────────────────────────────
/** @param {string[]} rel 相对路径（/ 分隔） */
function listFiles(base) {
  const out = []
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs).sort()) {
      const a = path.join(abs, name)
      const r = rel ? `${rel}/${name}` : name
      const st = statSync(a)
      if (st.isDirectory()) {
        out.push({ rel: r, abs: a, dir: true, size: 0 })
        walk(a, r)
      } else {
        out.push({ rel: r, abs: a, dir: false, size: st.size })
      }
    }
  }
  walk(base, '')
  return out
}

function octal(value, len) {
  const s = value.toString(8)
  return s.padStart(len - 1, '0') + '\0'
}

/** 512B ustar 头（路径 >100B 时按 ustar prefix 拆分：prefix ≤155 + name ≤100） */
function tarHeader(name, size, typeFlag, mtimeSec) {
  const head = Buffer.alloc(512, 0)
  let nameBuf = Buffer.from(name, 'utf8')
  let prefixBuf = null
  if (nameBuf.length > 100) {
    // 在 name 内找最靠后的 '/' 使前缀 ≤155B、余下 ≤100B（按字节切，容忍 UTF-8 多字节段边界）
    let cut = -1
    for (let i = name.length - 1; i > 0; i--) {
      if (name[i] !== '/') continue
      const p = Buffer.from(name.slice(0, i), 'utf8')
      const n = Buffer.from(name.slice(i + 1), 'utf8')
      if (p.length <= 155 && n.length > 0 && n.length <= 100) { cut = i; break }
    }
    if (cut < 0) throw new Error(`路径无法按 ustar prefix 拆分（>100B 且无可切分点）：${name}`)
    prefixBuf = Buffer.from(name.slice(0, cut), 'utf8')
    nameBuf = Buffer.from(name.slice(cut + 1), 'utf8')
    prefixBuf.copy(head, 345)
  }
  nameBuf.copy(head, 0)
  head.write('0000644\0', 100, 'utf8') // mode
  head.write('0000000\0', 108, 'utf8') // uid
  head.write('0000000\0', 116, 'utf8') // gid
  head.write(octal(size, 12), 124, 'utf8') // size
  head.write(octal(mtimeSec, 12), 136, 'utf8') // mtime
  head.write('        ', 148, 'utf8') // chksum（先按空格算）
  head.write(typeFlag, 156, 'utf8')
  head.write('ustar\0', 257, 'utf8')
  head.write('00', 263, 'utf8')
  let sum = 0
  for (const b of head) sum += b
  const chk = sum.toString(8).padStart(6, '0') + '\0 '
  Buffer.from(chk, 'utf8').copy(head, 148)
  return head
}

const entries = listFiles(dist)
// 插件以 `plugins/<name>/...` 追加进同一载荷（运行期由 payload/lib/plugins.js 物化到 config/opencode/plugin/）
const pluginNames = readdirSync(pluginsStage).filter((n) => statSync(path.join(pluginsStage, n)).isDirectory())
const pluginManifests = []
for (const name of pluginNames) {
  const marker = path.join(pluginsStage, name, 'materialize.json')
  if (existsSync(marker)) {
    const m = JSON.parse(readFileSync(marker, 'utf8'))
    pluginManifests.push({ name, files: m.files, bytes: m.bytes, digest: m.digest })
  }
}
for (const e of listFiles(pluginsStage)) {
  entries.push({ rel: `plugins/${e.rel}`, abs: e.abs, dir: e.dir, size: e.size })
}
const mtime = Math.floor(Date.now() / 1000)
const chunks = []
let logicalBytes = 0

for (const e of entries) {
  if (e.dir) {
    chunks.push(tarHeader(e.rel, 0, '5', mtime))
  } else {
    const data = readFileSync(e.abs)
    chunks.push(tarHeader(e.rel, data.length, '0', mtime))
    chunks.push(data)
    const pad = (512 - (data.length % 512)) % 512
    if (pad) chunks.push(Buffer.alloc(pad, 0))
    logicalBytes += data.length
  }
}
chunks.push(Buffer.alloc(1024, 0)) // 结束双零块

const tarBuf = Buffer.concat(chunks)
const hash = createHash('sha256').update(tarBuf).digest('hex')
const gz = gzipSync(tarBuf, { level: 6 })

mkdirSync(outDir, { recursive: true })
const outTar = path.join(outDir, 'opencode-dist.tar.gz')
// 临时文件放输出目录（同盘）：跨盘 rename 会 EXDEV
const tmp = path.join(outDir, `.opencode-dist.tar.gz.tmp-${process.pid}`)
writeFileSync(tmp, gz)
rmSync(outTar, { force: true })
renameSync(tmp, outTar)

const manifest = {
  schema: 1,
  version: VERSION,
  baseline: head,
  tarSha256: hash,
  files: entries.filter((e) => !e.dir).length,
  bytes: logicalBytes,
  tarBytes: tarBuf.length,
  gzBytes: gz.length,
  plugins: pluginManifests,
  builtAt: new Date().toISOString(),
}
writeFileSync(path.join(outDir, 'opencode-dist.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log('✓ 载荷已产出：')
console.log(`  ${outTar}`)
console.log(JSON.stringify(manifest, null, 2))
