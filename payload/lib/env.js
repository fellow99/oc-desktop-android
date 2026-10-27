'use strict';
/**
 * 应用语义环境的**唯一事实源**（Node 侧；与 OpencodeRuntime.buildEnv 镜像）。
 *
 * 与 oc-desktop-ark/payload/lib/env.js 同构，差异：
 *   · 新增 OPENCODE_NODE_ASSETS_DIR（Android 无 resfile 真路径，必须显式指给 bundle 读 app-archive.bin）；
 *   · HOME / TMPDIR 显式钉到应用沙箱（§5.9 D9）。
 *
 * 纪律：不解释业务语义，只做透明赋值；调用时机 = import 业务入口**之前**。
 */

/** @param {Record<string, string | undefined>} base @param {string} filesDir */
function buildEnv(base, filesDir) {
  const env = Object.assign({}, base);
  env.HOME = filesDir;
  env.USERPROFILE = filesDir;
  const tmp = `${filesDir}/tmp`;
  env.TMPDIR = tmp;
  env.TMP = tmp;
  env.TEMP = tmp;
  env.XDG_DATA_HOME = `${filesDir}/data`;
  env.XDG_CACHE_HOME = `${filesDir}/cache`;
  env.XDG_CONFIG_HOME = `${filesDir}/config`;
  env.XDG_STATE_HOME = `${filesDir}/state`;
  env.OPENCODE_DB = `${filesDir}/data/opencode/opencode.db`;
  env.OPENCODE_DISABLE_CHANNEL_DB = '1';
  env.OPENCODE_DISABLE_MODELS_FETCH = '1';
  env.OPENCODE_FILEWATCHER_DISABLE = '1';
  env.OPENCODE_DISABLE_FFF = '1';
  env.OPENCODE_DISABLE_AUTOUPDATE = '1';
  env.OPENCODE_CLIENT = 'desktop';
  env.OPENCODE_LOG_LEVEL = env.OPENCODE_LOG_LEVEL || 'info';
  env.OPENCODE_NODE_ASSETS_DIR = `${filesDir}/opencode-dist/assets`;
  env.NO_PROXY = '127.0.0.1,localhost,::1';
  env.no_proxy = env.NO_PROXY;
  // bash 工具要能找到 sh/toybox（§5.9：PATH 前置 /system/bin；不产生空尾项——POSIX 中空 PATH 项=当前目录）
  const extraPath = env.PATH && env.PATH !== '/system/bin' ? env.PATH.replace(/^\/system\/bin:?/, '') : '';
  env.PATH = extraPath ? `/system/bin:${extraPath}` : '/system/bin';
  return env;
}

module.exports = { buildEnv };
