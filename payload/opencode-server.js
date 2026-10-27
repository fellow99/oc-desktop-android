'use strict';
/**
 * opencode 服务端宿主入口（规划 §5.2 / §4.2；工程 101/102）。
 *
 * 由库的 `bootstrap.js` 经 `NODE_BRIDGE_ENTRY` 解析后执行。职责固定为六步：
 *   ① 装配环境（payload/lib/env.js，§5.9 D9）
 *   ② 载荷自解包（payload/unpack.js，D7：marker 幂等）
 *   ③ chdir 到沙箱工作区（**必须在 import 之前**；服务端的「项目根」= cwd，D14）
 *   ④ 安装 stdout 嗅探：命中 `server listening on <url>` ⇒ 写 marker + 打印 `OC_SERVER_READY`
 *   ⑤ 设 process.argv 为 `serve` 语义（--port 0，D3）
 *   ⑥ 动态 import 产物；异常写日志且**不 process.exit**（进程内 Node 崩溃会带走整个 App，§2.1）
 */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildEnv } = require('./lib/env');
const { appendLog, writeReady } = require('./lib/ready');
const { ensureUnpacked } = require('./unpack');

const FILES_DIR = process.env.OC_FILES_DIR || process.env.HOME || process.env.USERPROFILE || '';
const SERVER_LOG = process.env.OC_SERVER_LOG || (FILES_DIR ? path.join(FILES_DIR, 'logs', 'server.log') : '');
const READY_FILE = process.env.OC_READY_FILE || (FILES_DIR ? path.join(FILES_DIR, 'payload', 'server.ready.json') : '');
const HOST = process.env.OC_HOST || '127.0.0.1';
const VERSION = process.env.OC_VERSION || '0.0.0-dev';
const TAR_FILE = process.env.OC_PAYLOAD_TAR || (FILES_DIR ? path.join(FILES_DIR, 'incoming', 'opencode-dist.tar.gz') : '');
const DIST_DIR = FILES_DIR ? path.join(FILES_DIR, 'opencode-dist') : '';
const WORKSPACE_ROOT = FILES_DIR ? path.join(FILES_DIR, 'workspace') : '';
const DEFAULT_WORKSPACE = WORKSPACE_ROOT ? path.join(WORKSPACE_ROOT, 'default') : '';
const STARTED_AT = Date.now();

function log(line) {
  appendLog(SERVER_LOG, line);
  try {
    process.stdout.write(`[oc-android] ${line}\n`);
  } catch {
    // stdout 不可用时不阻断启动
  }
}

/** 宿主可识别的致命行：Kotlin 侧命中即快速失败，不必等满 180 s */
function fatal(reason) {
  log(`FATAL ${reason}`);
  try {
    process.stdout.write(`OC_SERVER_FATAL ${JSON.stringify({ reason })}\n`);
  } catch {
    // 忽略
  }
}

/** 从 URL 取端口 */
function portOf(url) {
  const m = /:(\d{1,5})(?:\/|$)/.exec(url || '');
  return m ? Number(m[1]) : 0;
}

/**
 * 嗅探 `server listening on <url>`（上游 server-process.ts 的唯一就绪信号）。
 * 维护滚动尾部处理跨 chunk 的行；写 marker 后加闩，只写一次。
 */
function installStdoutSniffer() {
  const original = process.stdout.write.bind(process.stdout);
  let tail = '';
  let written = false;
  process.stdout.write = function patched(chunk, encoding, callback) {
    try {
      if (!written) {
        const text = tail + (typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        const at = text.indexOf('server listening on ');
        if (at >= 0) {
          const url = text.slice(at + 'server listening on '.length).trim().split(/\s/)[0];
          const port = portOf(url);
          if (port > 0 && READY_FILE) {
            written = true;
            const info = writeReady(READY_FILE, { port, host: HOST, version: VERSION, startedAt: STARTED_AT });
            original(`[oc-android] marker written: ${READY_FILE} port=${port}\n`);
            original(`OC_SERVER_READY ${JSON.stringify(info)}\n`);
          }
        }
        tail = text.slice(-64);
      }
    } catch (error) {
      original(`[oc-android] stdout sniffer failed: ${error && error.message}\n`);
    }
    return original(chunk, encoding, callback);
  };
}

async function main() {
  if (!FILES_DIR) throw new Error('OC_FILES_DIR/HOME 均未设置（环境契约破坏）');

  // ① 环境装配（import 之前生效；os.homedir()/tmpdir() 读真实 environ，Node 会同步 process.env）
  Object.assign(process.env, buildEnv(process.env, FILES_DIR));

  // ② 载荷自解包（幂等）
  if (!fs.existsSync(TAR_FILE)) throw new Error(`载荷 tar 不存在：${TAR_FILE}（Kotlin 侧 ensurePayload 未执行？）`);
  const unpacked = await ensureUnpacked({ tarFile: TAR_FILE, dist: DIST_DIR, version: VERSION, log });
  log(`payload ${unpacked.skipped ? '复用' : `新解包 files=${unpacked.files}`}`);

  // ③ chdir 沙箱工作区（D14：filesDir/workspace/default 为脚手架默认项目根）
  fs.mkdirSync(DEFAULT_WORKSPACE, { recursive: true });
  process.chdir(DEFAULT_WORKSPACE);
  log(`cwd=${process.cwd()}`);

  // ④ 就绪嗅探
  installStdoutSniffer();

  // ⑤ serve 语义（D3：产品路径必须 --port 0，端口由 OS 分配）
  process.argv = ['node', 'opencode.mjs', 'serve', '--hostname', HOST, '--port', '0'];

  // ⑥ import stock bundle（D2）。失败 = 终态：写 FATAL 后交给 bootstrap 的兜底（不 process.exit）
  const entry = path.join(DIST_DIR, 'opencode.mjs');
  if (!fs.existsSync(entry)) throw new Error(`bundle 缺失：${entry}`);
  log(`import ${entry} …`);
  await import(pathToFileURL(entry).href);
}

main().catch((error) => {
  fatal(`${(error && error.stack) || error}`);
  // 不 process.exit：进程内 Node 没有优雅退出；Kotlin 侧 marker 超时 → 错误页
});
