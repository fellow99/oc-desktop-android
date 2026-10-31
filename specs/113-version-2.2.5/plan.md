# 113 — 版本更新：2.2.5 技术方案（android）

> **回引:** `spec.md` ｜ **最后更新:** 2026-10-31 ｜ **日志目录:** `logs/20261031-1/`
> **上游基线:** opencode `v2.2.5`（`9bbb8ce18c`）｜ Node v24.22.1 / 系统 WebView ｜ arm64 16KB

## 1. 决策

| # | 决策 | 依据 | 回引 |
|---|---|---|---|
| D1 | 版本号 `2.2.5` = **20205** | 规则一致 | FR-ver-102 |
| D2 | 清理显式清单 + `.gitignore` 断言；保留 .gradle 必要缓存/签名/keystore | 前序 | FR-ver-101 |
| D3 | 补丁：0001/0006 复制；0003/0007/0008/0009/0010 在 v2.2.5 干净树重生成 | `--check` 实测 | FR-ver-104 |
| D4 | 守卫：apply-patches（patchDir/EXPECTED）、collect-opencode（BASELINE/VERSION=2.2.5）、smoke 注释/路由 | 脚本 | FR-ver-105 |
| D5 | bun 1.4.4（BUN_BIN 指向本地 1.4.4） | 上游 packageManager | FR-ver-105 |
| D6 | 工具名 `bash→shell`：android 走上游内置，更新 smoke/regression/文档口径（别名兼容） | U2 | FR-ver-107 |
| D7 | 0009 SAF 导入按新 domain/policy/picker 结构等价移植；11 个 workspace RPC 与 setCurrent 语义保持 | U4 | FR-ver-104 |
| D8 | 0010 品牌化按 `<title data-sm>OpenCode</title>` 锚点替换为 OC Desktop，verify-branding 6 断言随新 bundle 复核 | U6 | FR-ver-105 |
| D9 | 测试在真机进行（用户连线）；无设备时构建侧先全绿，测试阶段暂停等待连线 | 用户 | FR-ver-106/107 |
| D10 | 构建后 opencode 树恢复干净；三端串行末位执行 | 单工作树 | R |

## 2. 步骤

| 步 | 动作 | 出口判据 |
|---|---|---|
| S0 | 记录基线/设备（待连线） | 日志 |
| S1 | 清理 §3 | AC-01 |
| S2 | 版本号 + README | AC-02/03 |
| S3 | 守卫/脚本更新 | 自洽 |
| S4 | 补丁迁移 + README | AC-04 |
| S5 | apply-patches → build-opencode(node24, bun1.4.4) → collect-plugins → collect-opencode（verify-runtime） | AC-05 |
| S6 | smoke-node24（含品牌断言）+ verify-git-plugin + verify-runtime | AC-05 |
| S7 | `gradlew :app:assembleDebug` + apksigner | AC-02/06 |
| S8 | 真机连接 → install -r → 启动非白屏 | AC-07 |
| S9 | 真机功能 + 环境能力测试 | AC-08（TEST_REPORT） |
| S10 | 代码评审 | REVIEW_REPORT |
| S11 | 敏感扫描 + opencode 恢复 | AC-09 |
| S12 | 提交 + 本地 tag v2.2.5（不 push） | AC-10 |

## 3. 清理清单

**删除（断言 .gitignore）**：`app/build/`、`build/`、`.stage/`、`assets/opencode-dist.tar.gz` 及 SHA 清单（以新产物为准）、
`build/plugins`（collect 产物）、工程根散落 `*.log`、临时抓取文件。

**保留**：`.gradle/`（按需）、`gradle/` wrapper、`keystore.properties`、`*.keystore`、`local.properties`、
`logs/`、`patches/`、`specs/`、`plugins/`、`payload/`。

## 4. 风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 0007/0009 新选择器结构差异最大 | 以 v2.2.5 源码等价移植；宿主 RPC 单测（plugins 夹具）兜底 |
| R2 | 0010 品牌断言随新 index.html/bundle 漂移 | verify-branding 先跑，按实际归档调整断言锚点（功能不改） |
| R3 | bun 1.4.4 网络 | 本地 1.4.4 共享，BUN_BIN 指定 |
| R4 | 真机未连线 | 构建侧先行；测试阶段显式暂停等待 |
| R5 | 凭证/Key 落盘或入镜 | 运行时输入、占位符、提交前扫描、截图避开设置页明文 |
