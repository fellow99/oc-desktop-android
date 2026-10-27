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

/** 512B ustar 头 */
function tarHeader(name, size, typeFlag, mtimeSec) {
  const head = Buffer.alloc(512, 0)
  const nameBuf = Buffer.from(name, 'utf8')
  if (nameBuf.length > 100) throw new Error(`路径过长（>100，未用 prefix 拆分）：${name}`)
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
const mtime = Math.floor(Date.now() / 1000)
const chunks = []
let logicalBytes = 0

for (const e of entries) {
  if (e.dir) {
    chunks.push(tarHeader(e.rel, 0, '5', mtime))
  } else {
    chunks.push(tarHeader(e.rel, e.size, '0', mtime))
    const data = readFileSync(e.abs)
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
  builtAt: new Date().toISOString(),
}
writeFileSync(path.join(outDir, 'opencode-dist.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log('✓ 载荷已产出：')
console.log(`  ${outTar}`)
console.log(JSON.stringify(manifest, null, 2))
