# 20261029-2 开发清单（DEV_CHECKLIST）—— 需求 001-building-workflow

> 流程：specs-based-devflow（规格四件套 → 开发 → 评审 → 测试 → 提交）
> 规格落位：`specs/001-building-workflow/`（按需求约定：模块加本工程 specs，不入父工程）
> 事实源：docs/000-工程规划.md §14.3、README 快速开始、scripts/*（基线守卫实现）、Maven Central 实证

## 任务映射（tasks.md → 落点）

| # | 任务 | 落点（本仓库） | 状态 |
|---|---|---|---|
| T1 | 规格四件套 | specs/001-building-workflow/{spec,plan,tasks,test-cases}.md | ✅ |
| T2 | workflow 实现 | .github/workflows/build-release.yml | ✅ |
| T3 | 语义校验 | YAML 解析 + actionlint（视网络可用性） | ✅ |
| T4 | 基线守卫等价验证 | `collect-opencode.mjs --check`（OPENCODE_DIR=../opencode） | ✅ |
| T5 | APK 构建步等价验证 | `./gradlew :app:assembleDebug`（本机） | ✅ |
| T6 | 文档登记 | specs/README.md、specs/SPECS_CHECKLIST.md、README.md | ✅ |
| T7 | 代码评审 + 修复 | logs/20261029-2/REVIEW_REPORT.md | ✅ |
| T8 | 测试执行 + 报告 | logs/20261029-2/TEST_REPORT.md | ✅ |

## 步骤记录（关键事实与决策）

1. **环境核录**（Step 0）：分支 main 干净（需求"分支不改动"满足）；无 .github/、无 tag；引擎双包 `node-bridge:0.2.0` / `node-runtime:24.22.1` 已上 Maven Central（2026-10-27，curl maven-metadata 实证 + AAR 实体核录）→ CI 无需 mavenLocal/引擎本地构建。
2. **基线守卫坑位**：`apply-patches.mjs` 以 `git rev-parse --short`（auto 长度）对 `a517687fde` 做 startsWith；本机实测 auto 长度=10。**CI 若 shallow clone（对象集小）auto 长度可能缩至 7 位 → 守卫误杀**。对策：上游检出 `fetch-depth: 0`，ref 用完整 SHA `a517687fde98a7329ada3ae644a01a9fc6c4e99e`（本机 rev-parse 实证）。
3. **上游落位**：`actions/checkout` 的 `path` 不出 workspace → 检出至 `upstream-opencode/`，经 `apply-patches --repo` 参数与 `OPENCODE_DIR` 环境变量注入三个脚本（plan D1）。
4. **载荷五步**：与 README 快速开始逐字同口径（`OPENCODE_NODE_TARGET=node24` 显式；`OPENCODE_TARGET` 不设走默认 linux-arm64；不加 `--skip-install`）。
5. **签名**：secrets 可选（KEYSTORE_BASE64/KEYSTORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD）→ 有则 release 签名，无则 debug 兜底；gradle 侧零改动（`keystoreProps.isNotEmpty()` 条件签名原生兼容）。
6. **发布**：`softprops/action-gh-release@v2`，仅 `refs/tags/v*`；附件 APK + SHA-256；`permissions: contents: write` 最小权限；产物同时 upload-artifact 留存。

## 与规格判据的对照

R1–R8 见 spec.md 判据表；本机可验项在 TEST_REPORT 核录，T-C9（真推 tag）标注用户侧执行。
