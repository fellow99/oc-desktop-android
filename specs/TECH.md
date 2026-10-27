# TECH —— 技术选型

> 更新：2026-10-28 · 版本策略：**全部钉死**（不允许 floating）；升级 = 显式改版本 + 跑对应门禁。

## 1. 形态选型

| 维度 | 选型 | 依据 |
|---|---|---|
| 宿主形态 | **路线 A：进程内 Node**（`dlopen libnode.so + node::Start`） | 与 ark 同构；零 IPC；文档/补丁/插件复用（规划 §2.1） |
| 渲染 | **系统 WebView**（`android.webkit.WebView`），同源 HTTP/SSE | 无 Electron、无内嵌内核；`?auth_token=` 首屏免登录 |
| 服务端 | **opencode v2.1.2 stock CLI bundle**（`serve --hostname 127.0.0.1 --port 0`） | 不改上游；`--port 0` 防 EADDRINUSE（D3） |
| 不做 | 子进程 node / 内嵌浏览器内核 / 全局存储权限 / PTY / 插件在线安装 | 规划 §0.3 非目标 |

## 2. 版本清单（钉死）

| 层 | 组件 | 版本 | 出处 |
|---|---|---|---|
| 构建 | Gradle | 8.12（wrapper） | `gradle/wrapper/gradle-wrapper.properties` |
| 构建 | Android Gradle Plugin | 8.9.2 | `gradle/libs.versions.toml` |
| 语言 | Kotlin | 2.1.20（jvmTarget 17） | 同上 |
| 平台 | compileSdk / targetSdk | 36 | 同上（P0-K 主线） |
| 平台 | minSdk | 24（引擎硬要求） | 同上 + `runtime.lock.json` matrix |
| ABI | arm64-v8a（单 ABI） | — | `runtime.lock.json` |
| 运行时 | io.github.fellow99:**node-bridge** | 0.2.0（Maven Central） | 桥 API + JNI 引导件 + 库引导 JS |
| 运行时 | io.github.fellow99:**node-runtime** | **24.22.1**（mavenLocal；Central 发布后切换） | 引擎 `libnode.so`；单一事实源 aosp-node-runtime 仓 `runtime.lock.json`（active） |
| 并发 | kotlinx-coroutines-android | 1.9.0（与桥 POM 对齐） | Dispatchers.Main 必需（实测教训） |
| 上游 | opencode | v2.1.2（tag/分支 `Branch_v2.1.2`，HEAD `a517687fde`） | 共用 submodule，基线守卫 |
| 引擎校验 | libnode.so SHA-256 | `be1d1641…472397e`；libc++_shared `cd617628…ae4c00b` | `runtime.lock.json`（P0-A 实测一致） |
| 模型 | DeepSeek `deepseek-flash`（V4.1-Flash，text+image 输入） | 经 opencode `deepseek` provider（openai 兼容端点） | e2e 实测（真机验证记录 20261028-02） |

## 3. 关键机制选型

| 机制 | 选型 | 一句话理由 |
|---|---|---|
| 端口发现 | `--port 0` + stdout 嗅探 `server listening on` → `server.ready.json` | OS 分配防占用；marker+探活双判据可证伪（D3） |
| 载荷投放 | assets tar(.gz) → Kotlin 字节拷贝 → **Node 自解包**（幂等 SHA marker） | 「谁写谁读」；AGP 预解压 `.gz` 的实测适配（魔数判定） |
| 鉴权 | `?auth_token=base64("opencode:<pwd>")` 首屏 + 密码 `connection.json` 复用 | 上游前端原生消费，零注入（D6）；凭据走 opencode credential store |
| UI 资产 | bundle 内联（virtual 模块）读 `OPENCODE_NODE_ASSETS_DIR/app-archive.bin` | 非 SEA 形态必须显式指目录（上游 `vite.node.config.ts`） |
| 明文放行 | networkSecurityConfig 仅 `127.0.0.1`/`localhost` | Android 9+ 默认禁明文（P0-D 实测生效） |
| 数据库 | `node:sqlite`（引擎内置）WAL | 零补丁零 ABI（P0-B 实测） |
| 子进程 | `/system/bin/sh`（toybox） | P0-J 实测三事件+哨兵全过；bash 工具可用 |
| JIT | 默认 JIT（`execArgv` 空） | R2 教训 + P0-K：`--jitless` 仅诊断（WASM 全废） |
| 仓库策略 | mavenLocal（引擎）→ 阿里云 google 镜像 → google → Central → 阿里云 public | 本机 dl.google.com 不可达；阿里云 public 缺 fellow99 AAR（实测） |

## 4. 工具链（host 侧）

| 工具 | 版本 | 用途 |
|---|---|---|
| JDK | Temurin 21（AGP 兼容） | gradle 构建跑在 21（AS JBR 25 仅 IDE 内使用） |
| Node.js | ≥24（本机 24.7） | collect / smoke / 上游构建 |
| bun | 1.3.14 | 上游 bundle 构建（`build-node.ts --bundle-only`，本迭代直接消费既有产物） |
| Android SDK | platforms android-36/37.0、build-tools 36、platform-tools 37 | 构建/装机/取证 |
| 设备 | Android Emulator API 37 x86_64（arm64 转译）或 arm64 真机 | 探针/e2e（转译下 JIT 性能数据仅参考） |
