'use strict';
/**
 * oc-plugin-pnpm 的执行 worker（worker_threads）。
 *
 * 契约（P0-M 冻结，logs/20261029-2/P0M-PROBE.md）：
 *   workerData = { pnpmCjs, projDir, args, registry? }
 *   · argv 注入引导：['node','pnpm','-C',projDir,(--registry r),...args]
 *   · registry 仅对 install/add 合法（pnpm 对 list/why 等会报 Unknown option）
 *   · stdout/stderr 拦截聚合；pnpm 入口为异步 main —— **require 返回 ≠ 完成**，
 *     完成判定 = 事件循环排空（beforeExit）；exit 兜底。
 *   · 结束 postMessage { tail(≤4KB), exitCode }；require 抛错如实回传。
 */
const { parentPort, workerData } = require('node:worker_threads')
let out = ''
process.stdout.write = (c) => { out += typeof c === 'string' ? c : c.toString(); return true }
process.stderr.write = (c) => { out += typeof c === 'string' ? c : c.toString(); return true }
let posted = false
const finish = (exitCode) => {
  if (posted) return
  posted = true
  try { parentPort.postMessage({ tail: out.slice(-4000), exitCode }) } catch {}
}
process.on('beforeExit', (code) => finish(code))
process.on('exit', (code) => finish(code))
try {
  const { pnpmCjs, projDir, args, registry } = workerData
  const front = registry ? ['--registry', registry] : []
  process.argv = ['node', 'pnpm', '-C', projDir, ...front, ...args]
  require(pnpmCjs)
} catch (e) {
  out += '\n[pnpm-worker-threw] ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : String(e))
  finish('threw')
}
