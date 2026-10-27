# ARCHITECTURE —— 整体架构

> 更新：2026-10-28 · 与规划 §4 同构；本文补齐 **as-built 实测差异**（标注 ⚡ 的条目为本工程实测新增/修正）。

## 1. 进程与模块总览

```
┌─ APK（OC Desktop Android / org.fellow99.oc.OCDesktopAndroid）────────────────┐
│ app 模块（MainActivity，singleTask，configChanges 自理）                     │
│  ┌─ Kotlin 宿主（app/src/main/java/…/）───────────────────────────┐         │
│  │ App.kt（全局 Context）                                          │         │
│  │ OpencodeRuntime：[1/6]密码→[2/6]载荷→[3/6]host.register         │         │
│  │                →[4/6]rt.start→[5/6]marker+health→[6/6]Ready     │         │
│  │ ConnectionStore / HostCapabilities / Diagnostics                │         │
│  │ MainActivity：加载页 ⇄ WebView ⇄ 错误页（失败可见）              │         │
│  └──────────▲──────────────────────────────┬─────────────────────┘         │
│             │ 状态/日志/能力桥（JNI）        │ loadUrl(同源+auth_token)      │
│  ┌──────────┴──────────────────────────────▼─────────────────────┐         │
│  │ node-bridge AAR（libnode_bridge.so + libnode_host_client.so）   │         │
│  │ node-runtime AAR（libnode.so 24.22.1 + libc++_shared.so）       │         │
│  └──────────┬───────────────────────────────────────────────────┘         │
│             │ 同一进程（Node 崩溃=应用崩溃，终态）                          │
│  ┌──────────▼───────────────────────────────────────────────────┐         │
│  │ Node：bootstrap.js →（NODE_BRIDGE_ENTRY）payload/opencode-server.js       │
│  │   ① env 装配(D9) ② unpack.js 自解包(D7) ③ chdir workspace/default         │
│  │   ④ stdout 嗅探→server.ready.json ⑤ argv=serve --port 0 ⑥ import bundle   │
│  │ opencode v2.1.2：/（内嵌 UI）+ /api/* + /api/event(SSE) + /auth/*          │
│  │ 数据：node:sqlite(WAL)→data/opencode/opencode.db；凭据→credential store    │
│  └──────────┬───────────────────────────────────────────────────┘         │
│             ▲ same-origin（零 CORS / 零头改写 / 零 IPC 载体）                │
│  ┌──────────┴───────────────────────────────────────────────────┐         │
│  │ 系统 WebView：opencode v2 Web UI（SolidJS SPA + SSE + localStorage）       │
│  └──────────────────────────────────────────────────────────────┘         │
└───────────────────────────────────────────────────────────────────────────┘
```

## 2. 启动时序（§4.2 as-built）

| 阶段 | 执行者 | 产出/判据 | 失败路径 |
|---|---|---|---|
| [1/6] 密码装配 | Kotlin `ConnectionStore` | `connection.json`（32B base64url，复用） | 读写异常→重新生成 |
| [2/6] 载荷就位 | Kotlin（拷贝）+ assets 双名探测 | `incoming/opencode-dist.tar(.gz)` + `payload/*.js` | 缺载荷→**错误页**「载荷缺失：先跑 collect-opencode.mjs」（实测触发过 ✅） |
| [3/6] 宿主能力 | Kotlin `HostCapabilities.registerAll` | 5 个能力名注册 | —（必须先于 start） |
| [4/6] 启动 Node | 桥 `rt.start(bootstrap.js, appEntry=绝对路径)` | `state=Starting`，投递 rc=0 | rc≠0→错误页（附日志尾） |
| [5/6] 就绪双判据 | Node 写 marker + Kotlin 探活 | `server.ready.json(port>0)` **且** `/global/health` 200 **且** state=Running；180s 超时 | 超时/Failed→错误页 |
| [6/6] 连接界面 | Kotlin `MainActivity` | `loadUrl(http://127.0.0.1:<port>/?auth_token=…)`；`clearHistory` | 主 frame 错误→错误页 |

实测时序（模拟器/转译，20261028-02）：解包 2s → import ≈30s → health 200 → WebView 上屏。

## 3. 数据流

1. **UI ⇄ 服务端**：同源 `fetch("/api/*")` + SSE `/api/event`；鉴权经首屏 `?auth_token=` 换取 SDK Basic 头（上游 `entry.tsx` 原生消费后抹参数）。
2. **Kotlin ⇄ Node**：仅三条窄通道 —— `NodeRuntimeOptions.env`（下行一次性）、`host.register`（Node→Kotlin JSON 能力调用）、状态/日志/崩溃（StateFlow/logs/lastCrash）。**业务数据不过 Kotlin**。
3. **构建期数据流**：上游源码 →（bundle 构建已完成）`dist-node/` → `collect-opencode.mjs`（tar.gz+清单）→ APK assets → 首启拷贝 → Node 自解包 → `import`。

## 4. 目录职责与责任分界

| 层 | 归属 | 不做什么 |
|---|---|---|
| 应用宿主层 | 本工程 Kotlin | 不解释业务载荷、不实现会话/模型/工具语义、不新增注入桥 |
| 引导件层 | `payload/*.js` | 不做业务；env 契约与 Kotlin 镜像（变量名单一定义） |
| 上游层 | opencode v2.1.2 | 不修改（stock bundle；补丁面见 106，本迭代为零补丁） |
| 运行时层 | node-bridge / node-runtime | 引用不复制（契约见桥仓文档 §5/§6） |

## 5. ⚡ as-built 实测修正（对规划 §4 的增量）

| # | 修正 | 依据 |
|---|---|---|
| 1 | AGP 把 assets `*.tar.gz` 预解压为裸 `.tar`：资产名双探测 + Node 端 gzip 魔数判定 | merger.xml + 真机两形态均过（20261028-02） |
| 2 | SSE 全局事件路由为 **`/api/event`**（非 `/event`；`/event` 回落 SPA） | 上游 protocol/groups/event.ts:44 + smoke 断言 |
| 3 | opencode 凭据走 **credential store（DB）**，UI 路径 = `POST /api/credential`；`auth.json` 迁移仅在 DB 首建时生效 | 上游 credential.ts + migration 20260805* + e2e 401→修复记录 |
| 4 | `kotlinx-coroutines-android` 必须显式依赖（桥仅带 core），否则 `Dispatchers.Main` 缺失崩溃 | 真机 FATAL 日志（20261028） |
| 5 | 模拟器（x86_64+arm64 转译）可运行 arm64 引擎；进程死亡后 loopback LISTEN socket 泄漏 ⇒ **必须 `--port 0`** | 真机验证记录 20261028-01 |
| 6 | `/global/health` 在根命名空间（不带 `/api` 前缀）；`/doc` 回落 SPA | smoke + curl 实测 |
