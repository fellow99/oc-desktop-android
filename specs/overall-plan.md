# overall-plan —— 整体技术方案（怎么做）

> 更新：2026-10-28 · 技术具体；与 [ARCHITECTURE.md](./ARCHITECTURE.md) 互补（那里讲结构，这里讲机制与关键路径）。

## 1. 构建链（host 侧）

```
上游源码（../opencode @ Branch_v2.1.2 / a517687fde，零补丁）
  └─ packages/cli/dist-node/            # opencode.mjs(17.4MB) + assets/(52MB, 含 app-archive.bin)
       └─ scripts/collect-opencode.mjs  # ①基线守卫(HEAD/版本) ②ustar 打包 ③gzip(level 6)
            ├─ app/src/main/assets/opencode-dist.tar.gz   (37.2MB, gitignore)
            └─ app/src/main/assets/opencode-dist.manifest.json (version/baseline/tarSha256/files/bytes)
                 └─ scripts/smoke-node24.mjs   # 门禁：--version → serve(--port 0) → health → UI → /api/event SSE
                      └─ gradle :app:assembleDebug  # syncPayloadScripts 把 payload/*.js 并入 assets/payload/
```

要点：
- collect 脚本自写 **ustar 打包器**（不依赖 tar 命令，Windows 可跑）；临时文件写输出目录（跨盘 rename EXDEV 教训）。
- smoke 是**进 APK 前的强制门禁**（§7.3）：任一红即阻断。

## 2. 运行链（设备侧首启）

```
MainActivity.onCreate
  └─ OpencodeRuntime.launchIn（协程）
       ├─ [1/6] ConnectionStore.loadOrCreate      # filesDir/connection.json
       ├─ [2/6] ensurePayload                     # assets "opencode-dist.tar.gz"→失败回退 ".tar"（AGP 预解压）
       │        + assets/payload/*.js 拷贝          # → filesDir/payload/
       ├─ [3/6] HostCapabilities.registerAll      # 先于 start（桥契约）
       ├─ [4/6] rt.start(entry=bootstrap.js, appEntry=<abs>/payload/opencode-server.js, env=D9)
       │        Node: bootstrap → opencode-server.js
       │          ├─ buildEnv(process.env, filesDir)        # HOME/XDG/TMP/OPENCODE_*/OC_*（lib/env.js 镜像）
       │          ├─ ensureUnpacked(tar, dist, version)     # 魔数判 gz/裸tar → SHA-256 → 解包到 staging → 原子替换 → .manifest.json
       │          ├─ chdir(filesDir/workspace/default)      # 项目根（D14）
       │          ├─ stdout 嗅探 "server listening on "      # → server.ready.json（原子写）+ OC_SERVER_READY
       │          ├─ argv = [node, opencode.mjs, serve, --hostname 127.0.0.1, --port 0]
       │          └─ import(opencode-dist/opencode.mjs)      # OPENCODE_NODE_ASSETS_DIR 已指 assets/
       ├─ [5/6] awaitReady：marker(port>0) ∧ state=Running ∧ GET /global/health==200（180s）
       └─ [6/6] MainActivity：loadUrl("http://127.0.0.1:<port>/?auth_token=" + urlencode(base64("opencode:"+pwd)))
```

## 3. 关键机制

### 3.1 环境契约（D9，双端镜像）

变量名单一定义于 `payload/lib/env.js` 与 `OpencodeRuntime.buildEnv`（成对修改）：`HOME/USERPROFILE=filesDir`、`TMPDIR/TMP/TEMP`、`XDG_{DATA,CACHE,CONFIG,STATE}_HOME`、`OPENCODE_DB`、`OPENCODE_DISABLE_*`、`OPENCODE_NODE_ASSETS_DIR`（UI 归档读取点）、`OPENCODE_SERVER_PASSWORD`、`NO_PROXY`、`PATH=/system/bin:…`、`OC_{FILES_DIR,READY_FILE,SERVER_LOG,PAYLOAD_TAR,VERSION,HOST}`。

### 3.2 幂等自解包（D7）

1. `.manifest.json` 存在 ∧ version 相同 ∧ tarSha256 相同 → 跳过；
2. 否则：sha256(tar) → 解包到 `dist.tmp-<pid>`（流式 tar 解析器：ustar 头/512 对齐/防路径穿越）→ 原子替换 → 写 manifest；
3. gzip 魔数 `1f 8b` 判定（兼容 AGP 预解压裸 tar 与原始 tar.gz 两种形态）。

### 3.3 就绪与端口（D3）

Node 侧嗅探上游唯一就绪信号（`server listening on <url>`）写 marker；Kotlin 250ms 轮询双判据 + `/global/health`（Basic）。产品路径必须 `--port 0`（模拟器实测：进程死亡后 loopback 监听 socket 泄漏，固定端口会 EADDRINUSE）。

### 3.4 鉴权与凭据（D6）

- 连接密码：`ConnectionStore` 生成 32B base64url → `connection.json`（MODE_PRIVATE）跨启动复用；只经 env 交给 Node。
- WebView 首屏：`?auth_token=base64("opencode:pwd")`（**百分号编码** `+`/`=`），上游前端读取后抹参数、后续 SDK 自动 Basic。
- 模型凭据：opencode credential store（DB，`/api/credential`，UI 设置页同路径）；`auth.json` 迁移仅在 DB 首建时生效（⇡ 首配需在首启前放置或运行期走 API）。

### 3.5 WebView 壳（D4）

`javaScriptEnabled + domStorageEnabled + databaseEnabled`；`networkSecurityConfig` 仅放行 loopback 明文；导航围栏只拦主 frame（非本机 → 系统浏览器）；首屏 `clearHistory()`；`configChanges` 自理使旋转/折叠不重建（WebView 免重载）；`onReceivedError`(主 frame ∧ 未成功过) → 错误页。

### 3.6 失败取证

Kotlin 侧 `Diagnostics.evidence` 追加 `logs/ui.log`（阶段/失败/端口，**禁止**记录凭据）；Node 侧 `logs/server.log`；桥侧 `node-bridge/node_bridge.log` + `lastCrash()`。错误页 = 阶段 + 原因 + `logs(60)` 尾 + `lastCrash` + 重启按钮。

## 4. 测试策略

- **host 门禁**：`smoke-node24.mjs`（不进 APK 就能证伪 bundle 问题）。
- **Phase 0 探针**（已清）：debug 源集 + 探针载荷，一次 Node 进程裁决 JIT/SQLite/sh/WebView 八项/桥；`autorun=1` 全自动取证。
- **端到端**：安装 → 预置 config/凭据 → 启动 → `/api/*` 驱动会话与消息（等价 UI 操作）→ 截图取证；用例索引见 [overall-test-cases.md](./overall-test-cases.md)。

## 5. 风险与回退（承接规划 §12，本迭代新增结论）

| 风险 | 现状 | 处置 |
|---|---|---|
| R1 引擎行为漂移 | 24.22.1 模拟器实测 JIT/WASM 机制可用（转译性能偏差仅参考） | P0-K 真机复测；lock 支持多版本并存回退 |
| R2 明文/能力 ROM 差异 | networkSecurityConfig 实测生效；WebView 八项全 ok | LAN 路线 B 备案不变 |
| R5 pnpm 脚本问题 | 未启用（205 未实现） | 默认 `--ignore-scripts` 方案不变 |
| 新增：AGP 资产预解压 | 已适配（双名探测+魔数） | 升级 AGP 时回归 P0-G |
| 新增：凭据首配时序 | 已明确（首启前放置 或 运行期 API） | 105 文档化 |
