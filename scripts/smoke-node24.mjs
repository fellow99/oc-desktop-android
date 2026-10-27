#!/usr/bin/env node
/**
 * host 侧门禁（§7.3）：与设备同代 Node 跑一遍 serve 语义，全绿才允许进 APK。
 *
 *   1. `node opencode.mjs --version`
 *   2. `serve --hostname 127.0.0.1 --port 0`（OPENCODE_NODE_ASSETS_DIR 指向 dist assets）
 *   3. 断言：`server listening on …`；`GET /global/health` 200（Basic）；`GET /` 返回 UI html；
 *      `GET /event` 读到首个 SSE 事件
 *
 * 用法：node scripts/smoke-node24.mjs
 */
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, process.env.OPENCODE_DIR ?? '../opencode')
const dist = path.join(repo, 'packages/cli/dist-node')
const BUNDLE = path.join(dist, 'opencode.mjs')
const PASSWORD = randomBytes(24).toString('base64url')
const BASIC = `Basic ${Buffer.from(`opencode:${PASSWORD}`).toString('base64')}`

if (!existsSync(BUNDLE)) {
  console.error(`✗ 缺少 ${BUNDLE}（先构建上游 bundle）`)
  process.exit(2)
}

const version = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')).version
console.log(`[smoke] bundle version=${version}`)

// ① --version
const { spawnSync } = await import('node:child_process')
const ver = spawnSync(process.execPath, [BUNDLE, '--version'], { cwd: dist, encoding: 'utf8' })
const verOut = (ver.stdout ?? '').toString().trim()
if (ver.status !== 0 || !verOut) {
  console.error(`✗ --version 失败 rc=${ver.status} out=${verOut} err=${(ver.stderr ?? '').toString().slice(0, 400)}`)
  process.exit(1) // 此时 serve 尚未启动，无可杀子进程
}
console.log(`[smoke] --version → ${verOut}`)

// ② serve
const child = spawn(process.execPath, [BUNDLE, 'serve', '--hostname', '127.0.0.1', '--port', '0'], {
  cwd: dist,
  env: {
    ...process.env,
    OPENCODE_NODE_ASSETS_DIR: path.join(dist, 'assets'),
    OPENCODE_SERVER_PASSWORD: PASSWORD,
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    NO_PROXY: '127.0.0.1,localhost,::1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let baseUrl = ''
let tail = ''
const listening = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`90s 内未监听；尾部：${tail.slice(-400)}`)), 90_000)
  const onData = (chunk) => {
    const text = chunk.toString()
    tail += text
    if (tail.length > 8192) tail = tail.slice(-4096)
    if (!baseUrl) {
      const at = tail.indexOf('server listening on ')
      if (at >= 0) {
        baseUrl = tail.slice(at + 'server listening on '.length).trim().split(/\s/)[0]
        clearTimeout(timer)
        resolve(baseUrl)
      }
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', (code) => reject(new Error(`serve 提前退出 rc=${code}；尾部：${tail.slice(-400)}`)))
})

try {
  baseUrl = await listening
  console.log(`[smoke] listening → ${baseUrl}`)
  let base = baseUrl.replace('127.0.0.1', '127.0.0.1')
  if (base.endsWith('/')) base = base.slice(0, -1)

  // ③ health
  const health = await fetch(`${base}/global/health`, { headers: { Authorization: BASIC } })
  if (health.status !== 200) throw new Error(`/global/health → ${health.status}`)
  console.log('[smoke] /global/health → 200')

  // ④ UI 首页
  const index = await fetch(`${base}/`, { headers: { Authorization: BASIC } })
  const html = await index.text()
  if (index.status !== 200 || !/<html|<!doctype/i.test(html)) throw new Error(`/ → ${index.status}（非 UI html）`)
  console.log(`[smoke] / → ${index.status}（${html.length} bytes）`)

  // ⑤ SSE 首事件（v2.1.2 路由：/api/event，协议 packages/protocol/src/groups/event.ts:44）
  const sse = await fetch(`${base}/api/event`, { headers: { Authorization: BASIC } })
  if (sse.status !== 200) throw new Error(`/api/event → ${sse.status}`)
  const ct = sse.headers.get('content-type') ?? ''
  if (!ct.includes('text/event-stream')) throw new Error(`/api/event content-type 非 SSE：${ct}`)
  const reader = sse.body.getReader()
  const first = await Promise.race([
    (async () => {
      const { value } = await reader.read()
      return new TextDecoder().decode(value ?? new Uint8Array())
    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('/api/event 15s 无首事件')), 15_000)),
  ])
  if (!first || !(first.startsWith('data:') || first.startsWith(':'))) {
    throw new Error(`/api/event 首块非 SSE：${first.slice(0, 120)}`)
  }
  console.log(`[smoke] /api/event 首块 → ${first.slice(0, 80).replace(/\n/g, ' ')}…`)
  await reader.cancel().catch(() => {})

  console.log('[smoke] ✅ 全绿')
  process.exitCode = 0
} catch (error) {
  console.error(`[smoke] ✗ ${error.message}`)
  console.error(tail.slice(-2000))
  process.exitCode = 1
} finally {
  child.kill('SIGKILL')
}
