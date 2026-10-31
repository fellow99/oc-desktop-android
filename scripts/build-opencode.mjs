#!/usr/bin/env node
/**
 * 构建上游 opencode 的 Node 产物（bundle-only）——工程规划 §5.2/§7.1③（移植自 ark 同名脚本）。
 *
 * 前置：`node scripts/apply-patches.mjs` 已应用补丁（本脚本**不**自动打补丁，
 * 以免绕过基线/工作树守卫 —— 守卫在 apply-patches 里）。
 *
 * 产物：../opencode/packages/cli/dist-node/{opencode.mjs, assets/**}
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, process.env.OPENCODE_DIR ?? '../opencode')
const target = process.env.OPENCODE_TARGET ?? 'linux-arm64'
const nodeTarget = (process.env.OPENCODE_NODE_TARGET ?? '').trim()

// 未显式指定 node24 即判失败（否则上游按默认 node 产出，与设备运行时 24.22.1 错位）
if (nodeTarget === '') {
  console.error('✗ 必须显式设置 OPENCODE_NODE_TARGET=node24（对齐 libnode v24.22.1）')
  process.exit(2)
}

// Windows 上 bun 是 npm 的 .cmd 垫片（没有 bun.exe）：默认需经 shell；
// 提供 BUN_BIN（如本地 .cache/bun/bun-x.y.z/bun.exe）时直接执行。
const WIN = process.platform === 'win32'
const BUN = process.env.BUN_BIN || 'bun'
const useShell = WIN && !process.env.BUN_BIN

const bunProbe = spawnSync(BUN, ['--version'], { encoding: 'utf8', shell: useShell })
const bunVersion = bunProbe.status === 0 ? (bunProbe.stdout || '').trim() : ''
if (bunVersion === '') {
  console.error('✗ 未找到 bun（请安装 1.3+，或用 BUN_BIN 指向 bun 可执行文件）')
  process.exit(2)
}
console.log(`bun ${bunVersion}`)

function run(cmd, args, cwd, extraEnv = {}) {
  console.log(`→ ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv }, shell: WIN })
  if (r.error && r.error.code === 'ENOENT') {
    console.error(`✗ 未找到 ${cmd}（请安装 bun 1.3+，或用 BUN_BIN 指向它）`)
    process.exit(2)
  }
  if (r.status !== 0) {
    console.error(`✗ 命令失败（exit=${r.status}）：${cmd} ${args.join(' ')}`)
    process.exit(r.status ?? 1)
  }
}

if (!existsSync(path.join(repo, 'package.json'))) {
  console.error(`✗ 找不到上游仓库：${repo}（用 OPENCODE_DIR 指定）`)
  process.exit(2)
}

// 目标平台经环境变量 OPENCODE_TARGET 传给 build-node.ts（其只认该 env；
// CLI 参数 --target= 不被识别会静默回退到主机平台，曾误打入 win32-x64 原生件）。
const flags = ['--bundle-only']

const skipInstall = process.argv.includes('--skip-install')
if (!skipInstall) {
  run(BUN, ['install', '--os=*', '--cpu=*'], repo, { OPENCODE_NODE_TARGET: nodeTarget })
}
run(BUN, ['run', '--cwd', 'packages/cli', 'script/build-node.ts', ...flags], repo, {
  OPENCODE_NODE_TARGET: nodeTarget,
  OPENCODE_TARGET: target,
})

const out = path.join(repo, 'packages/cli/dist-node')
if (!existsSync(path.join(out, 'opencode.mjs'))) {
  console.error(`✗ 未产出 opencode.mjs：${out}`)
  process.exit(1)
}
console.log(`✓ 产物：${out}（OPENCODE_NODE_TARGET=${nodeTarget}；下一步 node scripts/collect-opencode.mjs）`)
