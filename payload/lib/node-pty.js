'use strict';
/**
 * node-pty 绑定适配（111-pty-integration / M2，D9 载荷物化模块）。
 *
 * 职责：把 node-pty 原生 addon（libpty_node.so）包装成 opencode `core/src/pty/pty.ts` 期望的
 * `Proc`（spawn/onData/onExit/write/resize/kill + pid），并使 `#pty` 的
 * `require(OPENCODE_NODE_PTY_PATH ?? "@lydell/node-pty")` 能解析到本模块（module.exports.spawn）。
 *
 * M0 Spike 定稿（logs/20261102-1/PTY_SPIKE.md）：
 *   · extractNativeLibs=false ⇒ nativeLibraryDir 无实体文件；宿主先 System.loadLibrary("pty_node")
 *     经 Android linker 按 soname 从 APK 映射，Node 侧 process.dlopen((soname)) 解析到已加载 soinfo；
 *   · 原生 API = fork/open/resize/process（无 spawn）；spawn 由本模块自建；
 *   · 原生 fork 约束：env 须为 `K=V` 字符串数组；helperPath 须为字符串（空串=无 helper）→ fork(..., true, '', onexit)。
 */
const fs = require('fs');

let _native = null;

function getNative() {
  if (_native) return _native;
  const Module = require('module');
  const mod = new Module('libpty_node.so');
  mod.filename = 'libpty_node.so';
  process.dlopen(mod, 'libpty_node.so'); // 依赖宿主已 System.loadLibrary("pty_node")
  const exports = mod.exports;
  if (typeof exports.fork !== 'function') {
    throw new Error(`node-pty native 异常：无 fork。keys=${Object.keys(exports).join(',')}`);
  }
  _native = exports;
  return _native;
}

/** node-pty 兼容 spawn → opencode `Proc`。 */
function spawn(file, args, opt = {}) {
  const native = getNative();
  const cols = opt.cols || 80;
  const rows = opt.rows || 24;
  const envArr = Object.entries(opt.env || process.env || {}).map(([k, v]) => `${k}=${v}`);
  let exitListener = null;
  let dataListeners = [];

  const term = native.fork(
    file,
    args || [],
    envArr,
    opt.cwd || process.cwd(),
    cols,
    rows,
    -1, -1, true, '', // uid/gid=-1（跳过 setgid/setuid：非 root 应用 setgid(0) 会 EPERM 并被 node-pty _exit(1)，shell 永不 exec——111-PTY 真机定位）
    (code, signal) => {
      if (exitListener) {
        const f = exitListener;
        exitListener = null;
        f({ exitCode: code, signal });
      }
    },
  );

  // 主端读：PTY 输出（含回显/转义流）。
  // ⚠ 必须用 tty.ReadStream：fs.createReadStream(null,{fd}) 在非阻塞 PTY fd 上遇 EAGAIN 即终止，
  //   导致后续输出不再读取（111-PTY 真机定位）。tty.ReadStream 按 node-pty 原样，内部正确处理 EAGAIN。
  const tty = require('tty');
  const reader = new tty.ReadStream(term.fd);
  reader.setEncoding('utf8');
  reader.on('data', (chunk) => {
    const s = String(chunk);
    for (const cb of dataListeners) {
      try { cb(s); } catch (_) { /* 监听器自管异常 */ }
    }
  });
  reader.on('error', () => {
    // EAGAIN/EIO 是 TTY 常态：tty.ReadStream 内部处理并保持读取，勿在此终止。
  });

  return {
    pid: term.pid,
    onData(listener) {
      dataListeners.push(listener);
      return { dispose: () => { dataListeners = dataListeners.filter((x) => x !== listener); } };
    },
    onExit(listener) {
      exitListener = listener;
      return { dispose: () => { exitListener = null; } };
    },
    write(data) {
      try {
        if (Buffer.isBuffer(data)) fs.writeSync(term.fd, data); // 键盘/粘贴可能含非 UTF-8 字节，保留原始字节
        else fs.writeSync(term.fd, String(data));
      } catch (_) { /* 已退出 */ }
    },
    resize(c, r) {
      try { native.resize(term.fd, c, r); } catch (_) { /* 已退出 */ }
    },
    kill(signal) {
      try { process.kill(term.pid, signal || 'SIGHUP'); } catch (_) { /* 已退出 */ }
    },
  };
}

module.exports = { spawn };
