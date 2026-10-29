# 001-building-workflow —— 测试用例（test-cases）

> 日期：2026-10-29 · 回引：[spec.md](./spec.md) 判据表 R1–R8
> 口径：本机可执行 = 静态校验 + 等价命令；真实 tag 触发端到端（T-C9）需仓库推送权限，标注「用户侧执行」。

| # | 用例 | 验证 R | 步骤 | 通过判据 | 结果 |
|---|---|---|---|---|---|
| T-C1 | YAML 可解析 | R1 | node `yaml` 加载 `build-release.yml` | 解析成功且为映射结构 | ✅ |
| T-C2 | Actions 语义校验 | R1 | actionlint（或等价检查器）跑 workflow 文件 | 0 error | ✅ |
| T-C3 | 触发面断言 | R1 | 解析 `on` 段 | 含 `push.tags == ['v*']` 与 `workflow_dispatch` | ✅ |
| T-C4 | 载荷五步同口径 | R2/R3 | 文本断言五个 step 的 run 命令 | 与 README 快速开始逐字同口径；`OPENCODE_NODE_TARGET=node24` 显式存在；上游 ref 为 `a517687fde` | ✅ |
| T-C5 | 签名分支逻辑 | R4/R6 | 审查注秘 step：有 `KEYSTORE_BASE64` → `VARIANT=release` + 生成 `keystore.properties`；无 → `VARIANT=debug` | 两分支闭合；材料只落 workspace 不入库 | ✅ |
| T-C6 | 签名材料零入库 | R6 | `git status --porcelain` + `git check-ignore` | `keystore.properties`、`*.keystore` 均被 ignore，git 追踪集中无新敏感文件 | ✅ |
| T-C7 | APK 构建步等价（本机） | R4 | `./gradlew :app:assembleDebug`（本机后台执行） | `app/build/outputs/apk/debug/app-debug.apk` 产出，BUILD SUCCESSFUL | ✅ |
| T-C8 | 基线守卫等价（本机） | R3 | `node scripts/collect-opencode.mjs --check`（`OPENCODE_DIR` 指向上游） | 退出码 0，基线核录一致 | ✅ |
| T-C9 | tag 触发端到端（用户侧） | R1/R2/R4/R5 | 仓库推送 `v0.12.1` tag → GitHub Actions 观测 | workflow 全绿；Release 出现且附件含 APK + `.sha256`；未配 secrets 时为 debug 签名包 | ⬜ 需仓库推送权限 |
| T-C10 | 失败可观测 | R8 | 审查 step 划分 + artifact step | 五步/构建/发布独立命名；`dist/` 无论发布与否均上传 artifact | ✅ |

## 环境记录

- 本机：Windows 10 / Git Bash；Node v24.7.0；bun 1.3.14；JDK 17（Android Studio 捆绑）；AGP 8.9.2。
- Maven Central 实证：`curl https://repo1.maven.org/maven2/io/github/fellow99/node-runtime/maven-metadata.xml` → `24.22.1`（2026-10-27 发布）；`node-bridge` → `0.2.0`。
