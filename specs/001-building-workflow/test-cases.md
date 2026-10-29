# 001-building-workflow —— 测试用例（test-cases）

> 日期：2026-10-29 · 回引：[spec.md](./spec.md) 判据表 R1–R8
> 口径：本机可执行 = 静态校验 + 等价命令；真实 tag 触发端到端（T-C9）需仓库推送权限，标注「用户侧执行」。

| # | 用例 | 验证 R | 步骤 | 通过判据 | 结果 |
|---|---|---|---|---|---|
| T-C1 | YAML 可解析 | R1 | node `yaml` 加载 `build-release.yml` | 解析成功且为映射结构 | ✅ |
| T-C2 | Actions 语义校验 | R1 | actionlint（或等价检查器）跑 workflow 文件 | 0 error | ✅ 等价口径（actionlint 下载受限，以 js-yaml 解析 + 28 项结构断言覆盖） |
| T-C3 | 触发面断言 | R1 | 解析 `on` 段 | 含 `push.tags == ['v*']` 与 `workflow_dispatch` | ✅ |
| T-C4 | 载荷五步同口径 | R2/R3 | 文本断言五个 step 的 run 命令 | 与 README 快速开始逐字同口径；`OPENCODE_NODE_TARGET=node24` 显式存在；上游 ref 为 `a517687fde` | ✅ |
| T-C5 | 签名分支逻辑 | R4/R6 | 审查注秘 step：有 `KEYSTORE_BASE64` → `VARIANT=release` + 生成 `keystore.properties`；无 → `VARIANT=debug` | 两分支闭合；材料只落 workspace 不入库；部分配置显式报错 | ✅ |
| T-C6 | 签名材料零入库 | R6 | `git status --porcelain` + `git check-ignore` | `keystore.properties`、`*.keystore` 均被 ignore，git 追踪集中无新敏感文件 | ✅ |
| T-C7 | APK 构建步等价（本机） | R4 | `./gradlew :app:assembleDebug`（本机后台执行） | `app/build/outputs/apk/debug/app-debug.apk` 产出，BUILD SUCCESSFUL | ✅ |
| T-C8 | 基线守卫等价（本机） | R3 | `node scripts/collect-opencode.mjs --check`（`OPENCODE_DIR` 指向上游） | 退出码 0，基线核录一致 | ✅（注意盲区：`--check` 在 verify-runtime 之前退出，冷缓存路径由 T-C11 覆盖） |
| T-C9 | tag 触发端到端（CI 真跑） | R1/R2/R4/R5 | `workflow_dispatch` 真跑彩排（debug 版）→ run 40867423494 | 16 业务 step 全绿；assembleDebug BUILD SUCCESSFUL；产物 APK+`.sha256`；Release 步按设计 skipped | ✅ 2026-10-29（正式 `v0.12.1` tag 发布待用户推送） |
| T-C10 | 失败可观测 | R8 | 审查 step 划分 + artifact step | 五步/构建/发布独立命名；`dist/` 无论发布与否均上传 artifact | ✅ |
| T-C11 | 引擎 AAR 门禁冷缓存等价（评审后增补） | R2/R7 | 从 Central 下载 `node-runtime-24.22.1.aar` → `OC_NODE_RUNTIME_AAR=<路径> node scripts/verify-runtime.mjs` | 门禁全绿（AAR 与 lock 的 libnode.so/libc++_shared.so SHA-256 一致）；workflow 含 AAR 预取步注入该 env | ✅（本机实测 Central AAR 全绿；workflow 断言 FIX-C1a–c） |
| T-C12 | 产物文件名对齐 AGP 实际输出（评审后增补） | R4/R5 | 断言收集产物 step 使用 `app-${VARIANT,,}.apk`（全小写，对齐 T-C7 实测产物名） | 断言 FIX-C2 PASS | ✅ |
| T-C13 | gradlew 可执行位（评审后增补） | R4 | `git ls-files -s gradlew` | mode = 100755 | ✅ |

## 环境记录

- 本机：Windows 10 / Git Bash；Node v24.7.0；bun 1.3.14；JDK 17（Android Studio 捆绑）；AGP 8.9.2。
- Maven Central 实证：`curl https://repo1.maven.org/maven2/io/github/fellow99/node-runtime/maven-metadata.xml` → `24.22.1`（2026-10-27 发布）；`node-bridge` → `0.2.0`。
