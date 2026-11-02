'use strict';
/**
 * 进程内 PersistentPty 守护（111-pty-integration / M2，D9 载荷物化模块）。
 *
 * 目标：不碰上游 core，让 opencode 的 `PersistentPty`（Web UI 终端面板）在 Android 上可用。
 *
 * 机制：`core/src/persistent-pty/daemon.ts` 会用 `child_process.spawn("<pty-bin>", ["daemon",
 * "--runtime-dir", root, "--name", id], {detached:true})` 去拉起一个**外部 ELF 守护**，然后轮询
 * `<root>/<id>/service.json` 并通过 **Unix socket + 长度前缀 JSON 帧**通信。Android 无法 spawn 外部 ELF；
 * 本模块在载荷引导期用 `inject()` 拦截 `spawn`：当目标是 pty daemon 时，改为在**同进程**内启动一个
 * 等价守护（写 service.json、起 Unix socket、按同一帧协议服务），并返回一个永久"存活"的假 child ——
 * 于是官方 `daemon.ts` 客户端原样工作，前端终端 100% 复用官方 UI。
 *
 * 协议版本：ProtocolVersion=7（对齐 daemon.ts）。帧 = 4B 大端长度 + JSON；输出为裸帧 0x00+start(8)+end(8)+data。
 */
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('./node-pty'); // 见 payload/lib/node-pty.js（node-pty 适配）

const ProtocolVersion = 7;
const MaxFrameBytes = 8 * 1024 * 1024;

let ID = 0;

function lifecycle(terminal) {
  return terminal.exited ? { status: 'exited', exit_code: terminal.exitCode } : { status: 'running' };
}
function wireOf(s) {
  return {
    id: s.id,
    pid: s.exitCode !== undefined ? null : s.proc.pid,
    title: s.title,
    user_title: s.userTitle,
    foreground_process: null,
    group_id: s.groupID,
    command: s.command,
    cwd: s.cwd,
    cols: s.cols,
    rows: s.rows,
    lifecycle: lifecycle(s),
    output_head: s.head,
    output_tail: s.tail,
  };
}

/** 一个会话：node-pty Proc + 输出缓冲/游标 + 订阅者。 */
function createSession({ program, args, cwd, title, groupID, env, cols, rows }) {
  const proc = spawn(program, args, { name: title, cols, rows, cwd, env });
  const s = {
    id: ++ID,
    command: [program, ...args],
    proc,
    title,
    userTitle: null,
    groupID,
    cwd,
    cols,
    rows,
    exitCode: undefined,
    buffer: '', // 累计输出（UTF-8 字符串），cursor 用字节长度
    head: 0,
    tail: 0,
    subs: new Map(), // attachmentID -> subscriber
  };
  proc.onData((chunk) => {
    s.buffer += chunk;
    const start = s.tail;
    s.tail = Buffer.byteLength(s.buffer);
    for (const sub of s.subs.values()) sub.onOutput(start, s.tail, Buffer.from(chunk, 'utf8'));
  });
  proc.onExit((ev) => {
    s.exitCode = ev.exitCode;
    for (const sub of s.subs.values()) sub.onExit(s, ev.exitCode);
  });
  sessions.set(s.id, s);
  return s;
}

const sessions = new Map();

/* ───────────────────────── 帧协议（编解码） ───────────────────────── */
function encode(value) {
  const payload = Buffer.from(JSON.stringify(value));
  if (payload.length > MaxFrameBytes) throw new Error('pty frame too large');
  const out = Buffer.alloc(payload.length + 4);
  out.writeUInt32BE(payload.length, 0);
  payload.copy(out, 4);
  return out;
}
function readFrame(buf) {
  if (buf.length < 4) return null;
  const len = buf.readUInt32BE(0);
  if (len > MaxFrameBytes) throw new Error('pty frame too large');
  if (buf.length < len + 4) return null;
  return { payload: buf.subarray(4, 4 + len), rest: buf.subarray(4 + len) };
}

/* 把单个连接当作会话：读请求帧 → 处理 → 写响应帧 */
function handleConnection(socket, daemon) {
  let pending = Buffer.alloc(0);
  let attachedSub = null;
  socket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    for (;;) {
      const fr = readFrame(pending);
      if (!fr) break;
      pending = fr.rest;
      let req;
      try { req = JSON.parse(fr.payload.toString('utf8')); } catch { continue; }
      if (!req || req.token !== daemon.token) { try { socket.write(encode({ type: 'error', message: 'authentication failed' })); } catch {} continue; }
      const op = req.request && req.request.op;
      if (op === 'subscribe') {
        // 首帧：attached
        const s = sessions.get(req.request.id);
        if (!s) { try { socket.write(encode({ type: 'error', message: 'no such terminal' })); } catch {} continue; }
        const offset = req.request.offset || 0;
        const available = s.tail;
        const replay = Buffer.from(s.buffer, 'utf8').subarray(Math.max(0, offset));
        attachedSub = {
          socket,
          attachmentID: req.request.attachment_id || crypto_random(),
          role: req.request.role || 'observer',
          onOutput(start, end, data) {
            const frame = Buffer.alloc(17 + data.length);
            frame.writeUInt8(0, 0);
            frame.writeBigUInt64BE(BigInt(start), 1);
            frame.writeBigUInt64BE(BigInt(end), 9);
            data.copy(frame, 17);
            try { socket.write(frame); } catch {}
          },
          onExit(s, exitCode) { try { socket.write(encode({ type: 'exited', exit_code: exitCode, final_offset: s.tail })); } catch {} },
        };
        s.subs.set(attachedSub.attachmentID, attachedSub);
        const terminal = wireOf(s);
        try {
          socket.write(encode({
            type: 'attached', terminal, role: attachedSub.role,
            generation: 1, requested_offset: offset, available_offset: available, end_offset: s.tail,
            truncated: false, replay_base64: replay.toString('base64'),
          }));
        } catch {}
        continue;
      }
      try {
        const resp = daemon.handle(req.request);
        if (resp) socket.write(encode(resp));
      } catch (e) {
        try { socket.write(encode({ type: 'error', message: e.message })); } catch {}
      }
    }
  });
  socket.on('close', () => { if (attachedSub) { sessions.forEach((s) => s.subs.delete(attachedSub.attachmentID)); } });
  socket.on('error', () => {});
}
function crypto_random() {
  const b = require('crypto').randomBytes(16);
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** 纯 op 处理器（与 socket 解耦，便于 host 单测；makeDaemon 用 server/socketPath 组装）。 */
function createHandler(ctx) {
  const { token, instance_id, server, socketPath } = ctx;
  return (request) => {
    switch (request.op) {
      case 'ping':
        return { type: 'pong', instance_id, pid: process.pid, protocol: ProtocolVersion, features: ['rename'] };
      case 'own':
        return { type: 'owned' };
      case 'shutdown':
        for (const s of sessions.values()) { try { s.proc.kill('SIGHUP'); } catch {} }
        sessions.clear();
        try { fs.unlinkSync(socketPath); } catch {}
        if (server) server.close(() => {});
        return { type: 'ok' };
      case 'list':
        return { type: 'terminals', terminals: Array.from(sessions.values()).map(wireOf) };
      case 'create': {
        const program = request.program || '/system/bin/sh';
        const args = request.args || [];
        if (!/^\//.test(program)) throw new Error(`pty program 必须绝对路径：${program}`);
        const s = createSession({
          program, args, cwd: request.cwd, title: request.title || 'terminal',
          groupID: request.group_id, env: request.env, cols: request.cols || 80, rows: request.rows || 24,
        });
        return { type: 'created', terminal: wireOf(s) };
      }
      case 'write': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        s.proc.write(Buffer.from(request.data_base64, 'base64').toString('utf8'));
        return { type: 'ok' };
      }
      case 'resize': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        s.cols = request.cols; s.rows = request.rows;
        s.proc.resize(request.cols, request.rows);
        return { type: 'ok' };
      }
      case 'control':
      case 'input': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        if (request.cols) { s.cols = request.cols; s.rows = request.rows; try { s.proc.resize(request.cols, request.rows); } catch {} }
        if (request.data_base64) s.proc.write(Buffer.from(request.data_base64, 'base64').toString('utf8'));
        return { type: 'ok' };
      }
      case 'rename': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        s.userTitle = request.title;
        for (const sub of s.subs.values()) { try { sub.socket.write(encode({ type: 'title_changed', title: request.title || '' })); } catch {} }
        return { type: 'ok' };
      }
      case 'snapshot': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        return { type: 'snapshot', terminal: wireOf(s), text: s.buffer, checkpoint_base64: '', cursor_x: 0, cursor_y: 0 };
      }
      case 'read_rows': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        const lines = s.buffer.split('\n');
        return { type: 'rows', terminal: wireOf(s), lines, cursor_x: 0, cursor_y: lines.length ? lines.length - 1 : 0 };
      }
      case 'terminate': {
        const s = sessions.get(request.id);
        if (!s) return error('no such terminal');
        try { s.proc.kill('SIGHUP'); } catch {}
        return { type: 'ok' };
      }
      default:
        return error(`unsupported op: ${request.op}`);
    }
  };
}

/** 进程内守护对象：service.json + Unix socket 服务 + 各 op 处理。 */
function makeDaemon(root, name) {
  const token = crypto_random();
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const socketPath = path.join(dir, 'service.sock');
  const instance_id = `inprocess-${process.pid}-${crypto_random()}`;
  const server = net.createServer((socket) => handleConnection(socket, daemon));
  const daemon = { token, instance_id, server, socketPath };
  daemon.handle = createHandler(daemon);
  return new Promise((resolve, reject) => {
    server.listen(socketPath, () => {
      try {
        fs.writeFileSync(path.join(dir, 'service.json'), JSON.stringify({
          instance_id, pid: process.pid, protocol: ProtocolVersion, socket: socketPath, token, features: ['rename'],
        }));
        resolve(daemon);
      } catch (e) { reject(e); }
    });
    server.on('error', reject);
  });
}
function error(message) { return { type: 'error', message }; }

/** 拦截 child_process.spawn：把 pty 守护的“spawn 外部 ELF”换成进程内守护。 */
function inject() {
  const cp = require('child_process');
  const realSpawn = cp.spawn;
  cp.spawn = function (file, args, options) {
    if (Array.isArray(args) && args[0] === 'daemon' && /pty/i.test(file)) {
      const rid = args.indexOf('--runtime-dir');
      const nid = args.indexOf('--name');
      const root = rid >= 0 ? args[rid + 1] : require('os').tmpdir();
      const name = nid >= 0 ? args[nid + 1] : 'pty';
      makeDaemon(root, name).catch((e) => {
        try { process.stderr.write(`[oc-pty-inprocess] daemon start fail: ${e.message}\n`); } catch {}
      });
      // 假 child：立即 emit "spawn" 且永不退出，让 daemon.ts 的轮询就绪逻辑走通。
      const { EventEmitter } = require('events');
      const child = new EventEmitter();
      child.pid = process.pid;
      child.exitCode = null;
      child.signalCode = null;
      child.unref = () => child;
      child.kill = () => true;
      process.nextTick(() => child.emit('spawn'));
      return child;
    }
    return realSpawn.apply(this, arguments);
  };
  return cp.spawn;
}

module.exports = { inject, makeDaemon, createHandler, ProtocolVersion };
