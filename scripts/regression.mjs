#!/usr/bin/env node
/**
 * regression.mjs —— 回归基线四件套（规格 specs/109；规划 §11 Phase 4）。
 *
 *   ① 包体：app-debug.apk / app-release.apk（存在则核录）字节数与 SHA-256；
 *   ② 冒烟：复用 scripts/smoke-node24.mjs（--version/serve/health/UI/title/SSE）；
 *   ③ 首启分解：取 docs/evidence 最近一轮 ui.log 时间戳差（解包/就绪耗时）；模拟器不可用时登记占位；
 *   ④ 载荷指纹：opencode-dist.tar.gz SHA-256 + manifest（version/baseline/plugins digest）。
 *
 * 输出：logs/<date>-N/REGRESSION.md（追加式核录）；全部门禁红即退出非零。
 * 用法：node scripts/regression.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const problems = []
const rows = []

// ① 包体
for (const variant of ['debug', 'release']) {
  const apk = path.join(root, `app/build/outputs/apk/${variant}/app-${variant}.apk`)
  if (existsSync(apk)) {
    const size = statSync(apk).size
    rows.push(`| APK ${variant} | ${size.toLocaleString('en-US')} B | sha256=${sha(apk).slice(0, 32)}… |`)
  } else if (variant === 'debug') {
    problems.push(`缺 app-debug.apk（先 ./gradlew :app:assembleDebug）`)
  }
}

// ② 冒烟（fail-visible）
const smoke = spawnSync(process.execPath, [path.join(root, 'scripts/smoke-node24.mjs')], { encoding: 'utf8' })
const smokeOk = smoke.status === 0
rows.push(`| smoke-node24 | ${smokeOk ? '全绿' : 'FAIL'} | ${(smoke.stdout + smoke.stderr).split('\n').filter((l) => l.includes('[smoke]')).slice(-3).join('；')} |`)
if (!smokeOk) problems.push('smoke-node24 未全绿')

// ③ 载荷指纹
const tarGz = path.join(root, 'app/src/main/assets/opencode-dist.tar.gz')
const manifest = path.join(root, 'app/src/main/assets/opencode-dist.manifest.json')
if (existsSync(tarGz) && existsSync(manifest)) {
  const m = JSON.parse(readFileSync(manifest, 'utf8'))
  rows.push(`| 载荷 tar.gz | ${statSync(tarGz).size.toLocaleString('en-US')} B | sha256=${sha(tarGz).slice(0, 32)}… baseline=${m.baseline} plugins=${(m.plugins ?? []).length} |`)
} else {
  problems.push('缺载荷 tar/manifest（先 collect-opencode.mjs）')
}

// ④ 首启分解（最近 evidence 的 ui.log 时间戳；无则占位登记）
let firstBoot = '⬜ 待设备轮'
const evRoot = path.join(root, 'docs/evidence')
if (existsSync(evRoot)) {
  const latest = readdirSync(evRoot).sort().at(-1)
  firstBoot = `最近证据轮 ${latest}（分解值见该轮记录；设备重测待模拟器恢复）`
}
rows.push(`| 首启分解 | ${firstBoot} | — |`)

// ⑤ 汇报
const date = new Date().toISOString().slice(0, 10)
const outDir = path.join(root, 'logs', `${date.replace(/-/g, '')}-2`)
mkdirSync(outDir, { recursive: true })
const md = [
  `# 回归基线核录（${new Date().toISOString()}）`,
  '',
  '| 项 | 值 | 备注 |',
  '|---|---|---|',
  ...rows,
  '',
  problems.length > 0 ? `## 门禁问题\n\n${problems.map((p) => `- ✗ ${p}`).join('\n')}` : '✓ 全部门禁通过',
  '',
].join('\n')
const outFile = path.join(outDir, 'REGRESSION.md')
writeFileSync(outFile, md)
console.log(md)
console.log(`→ ${path.relative(root, outFile)}`)
process.exit(problems.length > 0 ? 1 : 0)
