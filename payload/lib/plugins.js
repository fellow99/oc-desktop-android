'use strict';
/**
 * 插件运行期物化（D11 / 102 扩展）：载荷内 `opencode-dist/plugins/<name>` → `<HOME>/config/opencode/plugin/<name>`。
 *
 * 为什么运行期还要拷一次：opencode 只扫描 `$XDG_CONFIG_HOME/opencode/plugin/`（§5.11 D11），
 * 而载荷解包到 `opencode-dist/`（D7）。本模块做**幂等 copy**（禁 symlink）：
 *   · 每个插件目录的幂等判据 = 文件清单摘要（materialize.json 的 digest，collect-plugins.mjs 写入）；
 *   · 命中 ⇒ 跳过；不命中或缺失 ⇒ 删旧整拷 + 原子写 marker；
 *   · 任何失败都只记录并继续（插件缺失 ≠ 服务不可启动；上游对插件失败本身 fail-visible）。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function digestOf(dir) {
  const files = [];
  (function walk(current, rel) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'materialize.json') continue; // marker 不参与摘要（幂等判据的排除项）
      const abs = path.join(current, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(abs, relPath);
      else {
        const buf = fs.readFileSync(abs);
        files.push({ path: relPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
      }
    }
  })(dir, '');
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  const digest = crypto.createHash('sha256');
  for (const f of files) digest.update(`${f.path}\0${f.bytes}\0${f.sha256}\n`);
  return { digest: digest.digest('hex'), count: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0) };
}

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

/**
 * @param {{distPluginsDir:string, configPluginDir:string, log:(line:string)=>void}} opts
 * @returns {{materialized:string[], skipped:string[], totalBytes:number}}
 */
function materializePlugins(opts) {
  const { distPluginsDir, configPluginDir, log } = opts;
  const result = { materialized: [], skipped: [], totalBytes: 0 };
  if (!distPluginsDir || !fs.existsSync(distPluginsDir)) {
    log('plugins 载荷目录不存在（未随包投放插件）');
    return result;
  }
  for (const name of fs.readdirSync(distPluginsDir).sort()) {
    // I5 修复：单插件异常只记录并跳过（头注释承诺的 fail-open 语义），绝不 FATAL 整个服务
    try {
      const src = path.join(distPluginsDir, name);
      if (!fs.statSync(src).isDirectory()) continue;
      const dest = path.join(configPluginDir, name);
      const srcStat = digestOf(src);
      let hit = false;
      try {
        const marker = JSON.parse(fs.readFileSync(path.join(dest, 'materialize.json'), 'utf8'));
        hit = marker.digest === srcStat.digest && marker.schema === 1;
      } catch {
        hit = false;
      }
      if (hit) {
        // 命中也要校验目标侧内容没被改动/残缺（dest 被改 ⇒ 重新物化）
        const destStat0 = digestOf(dest);
        hit = destStat0.digest === srcStat.digest;
      }
      if (hit) {
        result.skipped.push(name);
        result.totalBytes += srcStat.bytes;
        continue;
      }
      copyDir(src, dest);
      const destStat = digestOf(dest);
      if (destStat.digest !== srcStat.digest) {
        // I6 修复：校验失败必须清掉半成品（无 marker 的残缺目录会被上游 loader 直接加载执行）
        fs.rmSync(dest, { recursive: true, force: true });
        log(`plugin ${name} 物化校验失败，已清理半成品（源 ${srcStat.digest.slice(0, 12)}… ≠ 目标 ${destStat.digest.slice(0, 12)}…）`);
        continue;
      }
      const tmp = `${path.join(dest, 'materialize.json')}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify({
        schema: 1,
        plugin: name,
        files: destStat.count,
        bytes: destStat.bytes,
        digest: destStat.digest,
        copiedAt: new Date().toISOString(),
      }, null, 2)}\n`);
      fs.renameSync(tmp, path.join(dest, 'materialize.json'));
      result.materialized.push(name);
      result.totalBytes += destStat.bytes;
      log(`plugin ${name} 物化完成（${destStat.count} 文件）→ config/opencode/plugin/${name}`);
    } catch (error) {
      log(`plugin ${name} 物化失败（跳过，不影响服务启动）：${error && error.message}`);
    }
  }
  return result;
}

module.exports = { materializePlugins };
