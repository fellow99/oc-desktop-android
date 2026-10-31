# 101 — 版本更新：2.2.5 功能规格（android）

> **Module:** release ｜ **Status:** Implementing ｜ **Last Updated:** 2026-10-31
> **需求编号:** 101-version-2.2.5 ｜ **需求名称:** 版本更新：2.2.5
> **git 分支:** 不改动（沿用 `main`）
> **涉及工程:** `oc-desktop-android`（父工程 `D:\opencode-workspace\`）
> **上游基线:** opencode **v2.2.5**（tag `v2.2.5` / 提交 `9bbb8ce18c` / 分支 `Branch_v2.2.5`）
> **运行期:** 进程内 Node v24.22.1（io.github.fellow99:node-bridge 0.2.0，arm64，16KB 对齐）+ 系统 WebView
> **前序规格:** `specs/101-version-2.1.2/`

## 1. 目的

把 `oc-desktop-android` 上游基线从 `v2.1.2`（`a517687fde`）推进到 **`v2.2.5`**（`9bbb8ce18c`），
版本固化为 **`2.2.5` / `versionCode 20205`**；清理中间/临时文件，补丁集迁移到 `patches/v2.2.5/`，
重新编译构建，并在 **Android 真机**上完成基本功能与环境能力测试（用户在测试阶段提供连线真机）。

## 2. 范围

**In scope**

- 中间/临时文件清理（显式清单，见 plan）。
- 版本号 `2.2.5` / `20205`（`app/build.gradle.kts`、README、文档）。
- 补丁迁移（7 条）：
  - 原样复用：0001 / 0006。
  - **重生成**：0003（package.json 导出图）、0007（workspaces/selection 重构）、0008（settings 重排）、
    0009（SAF 导入动作，基于新 domain/policy/picker 结构）、0010（品牌化 title，锚点 `<title data-sm>OpenCode</title>` 仍在）。
- 守卫更新：`apply-patches.mjs`（patchDir=v2.2.5、EXPECTED=9bbb8ce18c）、`collect-opencode.mjs`
  （BASELINE=9bbb8ce18c、`VERSION='2.2.5'`）、smoke-node24 注释/路由口径。
- bun：`BUN_BIN` 指向 1.4.4（上游 packageManager 硬校验）。
- 重新构建：apply-patches → build-opencode（OPENCODE_NODE_TARGET=node24）→ collect-plugins →
  collect-opencode（verify-runtime 门禁）→ smoke-node24 → `gradlew :app:assembleDebug`。
- **真机测试**（用户连线）：DeepSeek Key、沙箱工作区、一次对话、图片分析；按 `docs/能力对照清单.md` 环境能力抽查。
- 敏感信息不落盘。

**Out of scope**

- 不直接编辑上游入库；只经 `patches/`。不改分支。
- PTY 仍打桩；无 MCP stdio / 插件在线安装；pnpm 插件维持现状。
- 不改 CI（v* tag → Release 工作流保持；本地 tag 不 push）。

## 3. 上游漂移评估（对本工程）

| # | 事实 | 影响 |
|---|---|---|
| U1 | 1117 提交；v2.2.0 UI 改版、`@opencode/ai` 重构 | android 进程内插件（git/search/workspace/pnpm）不 import `@opencode/ai`；Web UI 同源跟随 |
| U2 | 内置 `bash→shell` 改名 | android **无 shell 插件、走上游内置工具**：工具名变为 `shell`（上游 `bash→shell` 别名自动改写旧调用）；smoke-node24 / regression / 测试用例中写死的 `bash` 工具名口径需核对更新 |
| U3 | v2.2.4 持久终端重构 | 0003 ohos/android 桩按新 pty-binding 复核；available=false 不变 |
| U4 | workspaces/selection 重构（roots.ts → domain/policy/picker） | 0007 三根 + 0009 SAF 导入（import/setCurrent 等）按新结构重生成，11 个 RPC 语义保持 |
| U5 | settings 重排（无 settings/git） | 0008 凭据入口在新设置架构重锚；凭据宿主 RPC（plugins/oc-plugin-git/lib/credentials.js）独立不变 |
| U6 | index.html title 锚点仍在（`<title data-sm>OpenCode</title>`） | 0010 品牌化可继续按锚点替换 |
| U7 | 图片生成实验默认开（provider 支持时）与图片分析是两回事 | 多模态分析链路保留；新 image_generate 工具在本平台不专门验证（记录为上游同源能力） |

## 4. 需求条目

- **FR-ver-101**（MUST）：清理不伤已跟踪文件。
- **FR-ver-102**（MUST）：`app/build.gradle.kts` versionName `2.2.5`、versionCode `20205`。
- **FR-ver-103**（MUST）：README/文档版本同步。
- **FR-ver-104**（MUST）：`patches/v2.2.5/` 7 条双向 check 通过；旧目录保留。
- **FR-ver-105**（MUST）：构建链全绿（apply-patches 守卫、build/collect、verify-runtime、smoke-node24、assembleDebug）。
- **FR-ver-106**（MUST）：真机部署成功（用户连线后 adb install -r + 启动非白屏）。
- **FR-ver-107**（MUST）：真机基本功能 + 环境能力测试，逐条有结论（TEST_REPORT）。
- **FR-ver-108**（MUST）：敏感信息不落盘；Key 运行时输入、用后不留痕。
- **FR-ver-109**（SHOULD）：Conventional Commits 提交；本地 tag v2.2.5，不 push。

## 5. 验收标准

| # | 标准 | 证据 |
|---|---|---|
| AC-01 | 清理不伤跟踪文件 | git status 无 ` D ` |
| AC-02 | 版本 2.2.5/20205 | build.gradle.kts + APK aapt |
| AC-03 | 文档无旧版残留 | grep 记录 |
| AC-04 | 补丁双向可应用 | check 记录 |
| AC-05 | 构建链全绿 | 日志 |
| AC-06 | APK 签名产出 | app-debug.apk（apksigner 校验） |
| AC-07 | 真机安装启动 | adb + 截图 |
| AC-08 | 真机测试逐条有结论 | TEST_REPORT |
| AC-09 | 敏感信息零落盘 | 扫描记录 |
| AC-10 | 提交规范 + 本地 tag | git log/tag |

## 6. 敏感信息纪律

DeepSeek Key 仅在应用 UI 运行时输入，规格/日志/报告/脚本一律 `<API_KEY>` 占位；不写 URL 内嵌凭证；
`keystore.properties` 不入库；提交前暂存区复查 + 全库扫描；测试结束不在文档/截图保留 Key。
