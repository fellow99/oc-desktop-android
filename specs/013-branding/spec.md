# 013 — 品牌化（Android Edition）功能规格（as-built）

> **Module:** 013-branding ｜ **Status:** Implemented ｜ **Last Updated:** 2026-11-01
> **应用:** OC Desktop Android / `org.fellow99.oc.OCDesktopAndroid`
> **上游基线:** opencode v2.2.5（`9bbb8ce18c`）
> **父规格:** [`../../specs/013-branding/spec.md`](../../specs/013-branding/spec.md)（父工程公共品牌化）
> **证据:** 补丁 `0010`、`scripts/verify-branding.mjs`、`scripts/smoke-node24.mjs`、`app/src/main/res/values/strings.xml`、`app/src/main/AndroidManifest.xml`

## 1. 模块概述

### 1.1 目的

把 Android 版的应用名、Web UI 标题、图标、关于页与许可声明收敛为 **OC Desktop**，并用可执行守卫防止上游升级后回退。

### 1.2 解决的问题

- 上游 `index.html` 的 `<title>` 是 `OpenCode`，用户会误以为是官方应用；
- Android 版有版别后缀，容易把 `OC Desktop Android` 写进显示名；
- 图标、关于页、第三方许可分散，缺少统一断言。

### 1.3 范围

**包含**：`app_name`、`document.title`、图标物料、关于页非官方声明、第三方许可、品牌守卫、smoke title 断言。

**不包含**：上游服务名/法律声明改写；应用商店图标审核；Play Store 文案。

## 2. 用户故事

- 作为 Android 用户，我在应用列表看到 `OC Desktop`，不是 `OC Desktop Android`。
- 作为用户，我在 Web UI 标题看到 `OC Desktop`。
- 作为合规评审者，我能用 `verify-branding.mjs` 一次检查应用名/图标/许可/非官方声明。
- 作为维护者，我升级上游后能通过 smoke title 断言发现品牌漂移。

## 3. 功能需求

- **FR-013-001**：`strings.xml` 的 `app_name` MUST 为 `OC Desktop`；MUST NOT 为 `OC Desktop Android`。
- **FR-013-002**：Web UI 首页 `<title>` MUST 以 `OC Desktop` 开头（补丁 0010 + smoke 断言）。
- **FR-013-003**：Manifest MUST 声明 `android:icon="@mipmap/ic_launcher"`，五密度图标 MUST 存在且尺寸正确。
- **FR-013-004**：应用面 `res/` MUST NOT 出现 `OpenCode` 指称残留（上游包名/代码路径除外）。
- **FR-013-005**：关于页字符串 MUST 含非官方声明与第三方许可指引。
- **FR-013-006**：`THIRD-PARTY-NOTICES.md` MUST 存在，含 `opencode`、`MIT`、非官方声明。
- **FR-013-007**：品牌守卫 MUST 在构建/冒烟阶段运行；失败 MUST 阻断发布。
- **FR-013-008**：图标物料 MUST 由父工程 `assets/` 派生，生成过程幂等。

## 4. 关键实体

| 实体 | 说明 | 关键属性 |
|---|---|---|
| 应用名 | `strings.xml app_name` | 文本 |
| UI 标题 | `index.html <title>` | 文本、补丁 0010 |
| 图标 | `mipmap-*/ic_launcher.png` | 密度、尺寸、透明度 |
| 关于页 | `strings.xml` | 非官方声明/许可 |
| 许可 | `THIRD-PARTY-NOTICES.md` | opencode/MIT/非官方 |
| 守卫 | `verify-branding.mjs` | 检查项、退出码 |

## 5. 验收场景

### 场景 1：应用名

- Given 安装 APK
- When 查看应用列表
- Then 显示 `OC Desktop`

### 场景 2：Web UI 标题

- Given 应用启动
- When `smoke-node24` 请求 `/`
- Then `<title>` 以 `OC Desktop` 开头

### 场景 3：图标

- Given 构建产物
- When 检查 `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png`
- Then 尺寸分别为 48/72/96/144/192，文件存在

### 场景 4：品牌守卫

- Given 仓库
- When `node scripts/verify-branding.mjs`
- Then 全过；若 `res/` 残留 `OpenCode` 则失败

### 场景 5：非官方声明

- Given 关于页/许可文件
- When 查看
- Then 可见“非官方”与“MIT/第三方许可”

## 6. 非功能需求

- **一致性**：应用名与 hos/ark 统一为 `OC Desktop`。
- **可追溯**：补丁 0010、物料脚本、守卫结果可查。
- **安全**：品牌脚本不下载未校验物料。

## 7. 假设与约束

- 父工程 `assets/logo.png` 为透明母版；Android 图标沿用透明 PNG（非 adaptive）是当前品牌决策。
- 上游 `<title>` 可能带 `data-sm` 等属性；补丁正则需兼容。
- `verify-branding` 只检查应用面 `res/`，不检查上游代码路径。

## 8. 依赖

- 父工程 `assets/` 与 `013-branding`；
- 补丁 `0010-branding-oc-desktop.patch`；
- `scripts/make-brand-materials.mjs`、`scripts/verify-branding.mjs`、`scripts/smoke-node24.mjs`；
- `012-building-workflow` 的构建门禁。
