'use strict';
/**
 * tar.gz 幂等自解包（D7 / P0-G；Android 与 ark 的最大差异点）。
 *
 * 流程：
 *   ① `.manifest.json` 存在且 `version`/`tarSha256` 命中 ⇒ 跳过（幂等，升级=换版本戳）；
 *   ② 否则 SHA-256 源 tar → 解包到 `dist.tmp-<pid>/`（断点安全：先临时目录再 rename）
 *      → 原子替换 `dist/` → 原子写 `.manifest.json`。
 *
 * tar 为 ustar 格式（scripts/collect-opencode.mjs 产出）；仅支持常规文件/目录，
 * 显式拒绝绝对路径与 `..`（防路径穿越）。gzip 用流式解压（65 MB 级载荷，避免整块 inflate 峰值）。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

/** @param {string} file @returns {Promise<string>} hex sha256 */
function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/** 解析 ustar 头（512B）：返回 {name, size, type} 或 null（结束块）。 */
function parseHeader(block) {
  let allZero = true;
  for (let i = 0; i < 512; i++) if (block[i] !== 0) { allZero = false; break; }
  if (allZero) return null;
  const readStr = (off, len) => block.subarray(off, off + len).toString('utf8').replace(/\0.*$/, '').trim();
  let name = readStr(0, 100);
  const prefix = readStr(345, 155);
  if (prefix) name = `${prefix}/${name}`;
  const sizeOct = readStr(124, 12);
  const size = parseInt(sizeOct, 8) || 0;
  const type = String.fromCharCode(block[156] || 0x30);
  return { name, size, type };
}

/** 安全路径：拒绝绝对路径 / `..` / 空名 / 前缀混淆（relative 校验，防 root 同前缀目录绕过）。 */
function safeJoin(root, name) {
  if (!name || name.startsWith('/') || name.includes('\0')) throw new Error(`tar 条目非法：${JSON.stringify(name)}`);
  const target = path.resolve(root, name);
  const rel = path.relative(root, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`tar 路径穿越：${JSON.stringify(name)}`);
  return target;
}

/**
 * 幂等解包。
 * @param {{tarFile:string, dist:string, version:string, log:(line:string)=>void}} opts
 * @returns {Promise<{skipped:boolean, files?:number, tarSha256:string}>}
 */
async function ensureUnpacked(opts) {
  const { tarFile, dist, version, log } = opts;
  const manifestFile = path.join(dist, '.manifest.json');

  if (fs.existsSync(manifestFile)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (m.schema === 1 && m.version === version && m.tarSha256) {
        const tarSha256 = await sha256File(tarFile);
        if (m.tarSha256 === tarSha256) {
          log(`marker 命中（version=${version}），跳过解包`);
          return { skipped: true, tarSha256 };
        }
        log(`tar 变化（manifest=${m.tarSha256.slice(0, 12)}… 实际=${tarSha256.slice(0, 12)}…）→ 重解包`);
      } else {
        log(`manifest 版本不匹配（${m.version} → ${version}）→ 重解包`);
      }
    } catch (e) {
      log(`manifest 读取失败（${e && e.message}）→ 重解包`);
    }
  }

  const tarSha256 = await sha256File(tarFile);
  const staging = `${dist}.tmp-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  let files = 0;
  let bytes = 0;
  await new Promise((resolve, reject) => {
    // AGP 打包可能把 assets 里的 .tar.gz 预解压成裸 tar（merger 实测）：魔数 1f 8b 判定
    const magic = Buffer.alloc(2);
    const fd = fs.openSync(tarFile, 'r');
    fs.readSync(fd, magic, 0, 2, 0);
    fs.closeSync(fd);
    const isGzip = magic[0] === 0x1f && magic[1] === 0x8b;
    log(`payload ${isGzip ? 'tar.gz' : '裸 tar'}`);
    const source = isGzip ? zlib.createGunzip() : null;
    const input = fs.createReadStream(tarFile);
    const tarStream = source ?? input;
    if (source) input.pipe(source);
    let rest = Buffer.alloc(0);
    let phase = 'header'; // header | data
    let entry = null;
    let written = 0;

    const fail = (e) => { input.destroy(); if (source) source.destroy(); reject(e); };

    tarStream.on('data', (chunk) => {
      let buf = rest.length ? Buffer.concat([rest, chunk]) : chunk;
      try {
        for (;;) {
          if (phase === 'header') {
            if (buf.length < 512) break;
            const head = parseHeader(buf.subarray(0, 512));
            if (!head) { phase = 'end'; continue; }
            entry = head;
            written = 0;
            buf = buf.subarray(512);
            if (entry.type === '5' || (entry.size === 0 && entry.name.endsWith('/'))) {
              fs.mkdirSync(safeJoin(staging, entry.name), { recursive: true });
              files++;
              entry = null;
              continue;
            }
            phase = 'data';
          } else if (phase === 'data') {
            if (!entry) throw new Error('data 阶段无条目头');
            const want = entry.size - written;
            if (want <= 0) {
              // 条目结束：跳过 512 对齐 padding
              const pad = (512 - (entry.size % 512)) % 512;
              if (buf.length < pad) break;
              buf = buf.subarray(pad);
              phase = 'header';
              entry = null;
              continue;
            }
            if (buf.length === 0) break;
            const take = Math.min(want, buf.length);
            const target = safeJoin(staging, entry.name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.appendFileSync(target, buf.subarray(0, take));
            written += take;
            bytes += take;
            buf = buf.subarray(take);
            if (written === entry.size) {
              files++;
              const pad = (512 - (entry.size % 512)) % 512;
              if (buf.length < pad) break;
              buf = buf.subarray(pad);
              phase = 'header';
              entry = null;
            }
          } else if (phase === 'end') {
            // 两个全零块即结束；后面（若有）忽略
            resolve(undefined);
            return;
          }
        }
        rest = buf;
      } catch (e) { fail(e); }
    });
    tarStream.on('end', () => {
      try {
        if (phase === 'end' || (phase === 'header' && entry === null && rest.length < 512)) resolve(undefined);
        else reject(new Error(`tar 提前结束（phase=${phase}）`));
      } catch (e) { reject(e); }
    });
    tarStream.on('error', reject);
    input.on('error', reject);
  });

  // 原子替换：旧目录改名让位 → staging 就位 → 删旧
  const backup = `${dist}.old-${process.pid}`;
  fs.rmSync(backup, { recursive: true, force: true });
  if (fs.existsSync(dist)) fs.renameSync(dist, backup);
  fs.renameSync(staging, dist);
  fs.rmSync(backup, { recursive: true, force: true });

  const manifest = {
    schema: 1,
    version,
    tarSha256,
    files,
    bytes,
    unpackedAt: new Date().toISOString(),
  };
  const tmp = `${manifestFile}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(tmp, manifestFile);
  log(`解包完成：files=${files} bytes=${bytes}`);
  return { skipped: false, files, tarSha256 };
}

module.exports = { ensureUnpacked, sha256File };
