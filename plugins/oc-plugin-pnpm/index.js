/**
 * oc-plugin-pnpm —— 进程内 pnpm 能力面（本工程新增，规格 specs/205；规划 §5.12 D13）。
 *
 * 形态（P0-M 冻结，logs/20261029-2/P0M-PROBE.md）：
 *   · pnpm 10.34.9 单文件 pnpm.cjs + 同目录 worker.js/pnpmrc 随插件整目录投放（禁 spawn node）；
 *   · 引导 = worker_threads + argv 注入 + require（pnpm 异步任务在 worker 事件循环内继续，
 *     完整退出码/异常经 postMessage 回传；主侧超时 terminate，默认 180s）；
 *   · 所有命令 `-C <workspaceRoot>`（服务端会话目录，服务端围栏）+ 沙箱 `--store-dir`
 *     `<HOME>/pnpm-store`；registry 默认 npmmirror，可由 input.registry 覆写；
 *   · 工具面五件：pnpm_install / pnpm_add / pnpm_remove / pnpm_list / pnpm_why。
 *     `pnpm run` 不提供——生命周期脚本依赖 spawn node（平台无 node ELF，P0-M 证伪，触发 D13 预设降级）；
 *   · 脚本安全：默认 `--ignore-scripts`（显式 flag）+ pnpm10 构建白名单双保险。
 */
import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const PLUGIN_ID = 'oc-android-pnpm'

const PNPM_CJS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pnpm.cjs')
const WORKER_CJS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pnpm-worker.cjs')
const DEFAULT_REGISTRY = process.env.OC_PNPM_REGISTRY || 'https://registry.npmmirror.com'
const TIMEOUT_MS = 180_000
const OUT_MAX = 4000

/** 运行一次 pnpm 命令；resolve({ ok, exitCode, tail, timedOut }) */
function runPnpm(projDir, args, registry) {
  if (!existsSync(PNPM_CJS)) {
    return Promise.resolve({ ok: false, exitCode: 'no-runtime', tail: 'pnpm.cjs 未随包投放（collect-plugins 缺 pnpm 运行时）', timedOut: false })
  }
  return new Promise((resolve) => {
    let tail = ''
    let done = false
    const finish = (extra) => {
      if (done) return
      done = true
      resolve({ ok: false, tail: (tail + (extra ?? '')).slice(-OUT_MAX), ...extra })
    }
    const w = new Worker(WORKER_CJS, {
      workerData: { pnpmCjs: PNPM_CJS, projDir, args, registry },
      stdout: true,
      stderr: true,
    })
    const timer = setTimeout(() => { w.terminate(); finish({ ok: false, exitCode: 'timeout', timedOut: true, tail: (tail + '\n[timeout 180s]').slice(-OUT_MAX) }) }, TIMEOUT_MS)
    w.on('message', (m) => {
      clearTimeout(timer)
      tail = m.tail ?? tail
      finish({ ok: m.exitCode === 0 || m.exitCode === 'returned', exitCode: m.exitCode })
    })
    w.on('error', (e) => { clearTimeout(timer); finish({ ok: false, exitCode: 'worker-error', tail: (tail + '\n[worker-error] ' + e.message).slice(-OUT_MAX) }) })
  })
}

const RESULT_SCHEMA = { type: 'object', additionalProperties: true }
const ok = (tail, meta = {}) => ({ content: tail.slice(-OUT_MAX) || '（无输出）', metadata: { ok: true, ...meta } })
const fail = (tail, code) => ({ content: String(tail).slice(-OUT_MAX), metadata: { ok: false, code } })

export default {
  id: PLUGIN_ID,
  async setup(context) {
    const root = context?.location?.project?.directory
    if (typeof root !== 'string' || root.length === 0) {
      throw new Error(`${PLUGIN_ID}: context.location.project.directory is required (workspace root)`)
    }
    const log = (m) => console.log(`[oc-android] pnpm: ${m}`)
    if (!context?.tool || typeof context.tool.transform !== 'function') {
      throw new Error(`${PLUGIN_ID}: unexpected plugin context (missing context.tool.transform)`)
    }

    const make = (name, description, input, argsOf) => ({
      name,
      description,
      input,
      options: { codemode: false },
      execute: async (input) => {
        const args = argsOf(input ?? {})
        const reg = typeof input?.registry === 'string' && input.registry ? input.registry : DEFAULT_REGISTRY
        log(`${name} ${JSON.stringify(args)}`)
        const r = await runPnpm(root, args, reg)
        const meta = { exitCode: r.exitCode, timedOut: !!r.timedOut }
        return r.ok ? ok(r.tail, meta) : fail(r.tail, name)
      },
    })

    const REGISTRY_PROP = { type: 'string', description: `Registry override. Default ${DEFAULT_REGISTRY}.` }
    const tools = [
      make('pnpm_install', 'Install dependencies for the current workspace (in-process pnpm; lifecycle scripts ignored).',
        { type: 'object', properties: { registry: REGISTRY_PROP }, additionalProperties: false },
        (i) => ['install', '--ignore-scripts']),
      make('pnpm_add', 'Add packages to the current workspace (in-process pnpm).',
        {
          type: 'object',
          properties: {
            packages: { type: 'array', items: { type: 'string' }, description: 'Package specifiers, e.g. ["ms@4"].' },
            dev: { type: 'boolean', description: 'Save as devDependencies.' },
            registry: REGISTRY_PROP,
          },
          required: ['packages'],
          additionalProperties: false,
        },
        (i) => ['add', '--ignore-scripts', ...(i.dev ? ['--save-dev'] : []), ...i.packages]),
      make('pnpm_remove', 'Remove packages from the current workspace.',
        {
          type: 'object',
          properties: { packages: { type: 'array', items: { type: 'string' } } },
          required: ['packages'],
          additionalProperties: false,
        },
        (i) => ['remove', ...i.packages]),
      make('pnpm_list', 'List installed dependencies.',
        {
          type: 'object',
          properties: { depth: { type: 'number', description: 'Default 0.' } },
          additionalProperties: false,
        },
        (i) => ['list', '--depth', String(Math.max(0, Math.min(9, Number(i?.depth) || 0)))]),
      make('pnpm_why', 'Show why a package is installed.',
        {
          type: 'object',
          properties: { package: { type: 'string' } },
          required: ['package'],
          additionalProperties: false,
        },
        (i) => ['why', String(i.package)]),
    ]

    await context.tool.transform((editor) => {
      for (const t of tools) editor.add(t)
      const missing = tools.map((t) => t.name).filter((n) => editor.get(n) === undefined)
      if (missing.length > 0) throw new Error(`${PLUGIN_ID}: tool registration failed (missing ${missing.join(', ')})`)
    })
    log(`registered tools: ${tools.map((t) => t.name).join(', ')} (pnpm 10.34.9 in-process; run 不提供——平台无 node)`)
    return () => {}
  },
}
