# 001-building-workflow —— GitHub Actions 构建发布流程（spec）

> 状态：✅ as-built（2026-10-29；CI 真跑彩排 debug 版全绿 run 40867423494，正式 v0.12.1 已发布：run 40875919607 全绿，Release 挂签名 APK+sha256）· 引用：规划 §5.2/§7.1/§14.3、102-payload-pipeline（载荷流水线契约）、宪法 C3/C4
> 需求模块落位：`oc-desktop-android/specs/`（按需求约定，不入父工程 specs）

## 1. 目标

给 `oc-desktop-android` 增加云端自动构建与发布能力：推送 `v*` 格式 tag（如 `v0.12.1`）即触发 GitHub Actions，
在云端完成「上游基线检出 → 载荷五步流水线 → APK 构建 → GitHub Release 发布」，
产出与本机 §14.3 口径一致的、可安装的 APK 包。**不改动 Git 分支策略、不改动本机构建脚本。**

## 2. 需求与验收判据

| # | 需求 | 判据（可观测） | 实测 |
|---|---|---|---|
| R1 | tag 触发 | 推送 `v*` tag（如 `v0.12.1`）触发 workflow；`workflow_dispatch` 可手动触发（仅构建验证，不发布） | ✅ 断言 T-C3 + CI 真跑彩排（run 40867423494 全绿；正式 tag 待推送） |
| R2 | 云端载荷构建 | CI 上依次执行 `apply-patches → build-opencode(OPENCODE_NODE_TARGET=node24) → collect-plugins → collect-opencode → smoke-node24`，与 README 快速开始/规划 §14.3 完全同口径；任一门禁红则整个流程失败 | ✅ **CI 真跑全绿**（彩排 run 40867423494；verify-runtime 冷缓存门禁由 AAR 预取步真实通过） |
| R3 | 上游基线守卫 | CI 检出 `anomalyco/opencode` 锁定基线 `a517687fde`（Branch_v2.1.2）；`apply-patches`/`collect-opencode` 的基线断言在 CI 上生效（HEAD 不符即失败） | ✅ 断言 J3/J4 + T-C8 等价；fetch-depth:0 保 abbrev 长度（见 plan D1 注） |
| R4 | APK 产物 | 载荷门禁全绿后 `gradle :app:assemble{Release,Debug}` 产出 APK：配置了签名 secrets → `release` 签名包；未配置 → `debug` 签名包（可直接安装） | ✅ **CI 真跑 assembleDebug 绿**（125,401,263 B APK + sha256 产出；gradlew mode 100755 实证生效） |
| R5 | 自动发布 | tag 触发的构建成功后自动创建 GitHub Release（release 名含 tag），附件含 APK 与 `.sha256` 校验清单 | ✅ 断言 T-C10c/d + 彩排中 Release 步按设计 skipped（`workflow_dispatch` 不发布）；正式 tag 发布待推送 `v0.12.1` |
| R6 | 安全纪律 | 签名材料零入库：keystore 经 secrets（base64）注入，`keystore.properties`/`*.keystore` 保持 gitignore；workflow 具最小权限（`contents: write`）；无敏感明文 | ✅ T-C6 check-ignore 实证 + 断言 T-C5a-e |
| R7 | 引擎依赖 | CI 直接从 Maven Central 解析 `io.github.fellow99:node-bridge:0.2.0` + `node-runtime:24.22.1`（不依赖 mavenLocal） | ✅ Central 已核录（2026-10-27 发布）；2026-10-29 对 Central AAR 实测 verify-runtime 全绿（libnode.so SHA-256=lock） |
| R8 | 失败可观测 | 载荷五步、APK 构建、发布各自独立 step，失败可直接定位到步；产物同时以 artifact 形式上传留存 | ✅ 断言 T-C10a-d |

## 3. 边界与非目标

- **不改动**分支模型：workflow 只读当前默认分支与 tag，不新建分支。
- **不改动**本机构建脚本与 `scripts/*`：CI 是同一套命令的云端编排，脚本零修改。
- **不注入** tag 到 `versionName`/`versionCode`：版本标识维持 D16 冻结口径（2.1.2 / 20102）；tag 只用于 Release 命名。
- 真实 tag 触发的端到端验证需要仓库推送权限（`git push origin v0.12.1`），不在本机执行，见 test-cases T-C9。
- 不建 matrix（仅 arm64-v8a 单 ABI，与引擎 lock 一致）；不做 PR 触发（本需求只管 tag 触发构建）。

## 4. 验收口径汇总

1. `.github/workflows/` 下存在声明式 workflow，YAML 语义校验通过（actionlint/解析器）。
2. workflow 内载荷五步命令与 README 快速开始逐字同口径（`OPENCODE_NODE_TARGET=node24` 显式存在）。
3. 签名分支逻辑可静态推演：有 secrets → release 签名；无 → debug。
4. 本机等价验证全绿：`collect-opencode --check`（基线守卫）+ `:app:assembleDebug`（APK 构建步）。
5. 规格四件套齐备并登记进 `specs/README.md` 与 `specs/SPECS_CHECKLIST.md`。
