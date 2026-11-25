# 011 — 版本更新：2.4.1（oc-desktop-android）

> **Module:** 011-version-2.4.1 ｜ **Status:** Implemented ｜ **Last Updated:** 2026-11-25
> **需求编号:** 011-version-2.4.1 ｜ **需求名称:** 版本更新：2.4.1 ｜ **git 分支:** 不改动
> **上游基线:** opencode **v2.4.1**（tag `v2.4.1` / 提交 `6f0514052a` / 分支 `Branch_v2.4.1`）
> **应用版本:** **2.4.1** / `versionCode 20401`
> **前序规格:** `specs/011-version-2.2.5/`

## 1. 目的

把 `oc-desktop-android` 的上游基线从 `v2.2.5`（`9bbb8ce18c`）推进到 **`v2.4.1`**（`6f0514052a`），
版本固化为 **`2.4.1` / `20401`**，补丁集迁移到 `patches/v2.4.1/`，清理中间产物并重建载荷。

## 2. 范围

**In scope**

- 补丁迁移到 `patches/v2.4.1/`（迁移矩阵见 `patches/v2.4.1/README.md`）。
- 版本号 `2.4.1` / `20401`（`app/build.gradle.kts`）。
- 构建脚本基线：`6f0514052a` + `patches/v2.4.1`。
- 载荷重建 + host 门禁 + 打包。
- README / 规格索引版本同步。

**Out of scope / ⬜**

- **功能补丁 `0007` / `0008` / `0009` 待重做**：`workspaces/selection` 状态机重构，v2.2.5 的 imperative 钩子失效（自门控，缺失时回退上游行为）。
- **安卓真机**：ADB 未见设备（`adb devices` 为空），真机用例 `⬜`。
- 构建 `OPENCODE_NODE_TARGET=node24` 而运行时已升级到 Node 26.13.0：属 v2.2.5 之前遗留口径，本轮不改（登记 `⬜`）。

## 3. 需求条目

- **FR-ver-201**（MUST）：补丁 3 类校验——逐条 `--check`、反序 `-R --check`、应用后 bundle 成功。
- **FR-ver-202**（MUST）：`versionName=2.4.1` / `versionCode=20401`。
- **FR-ver-203**（MUST）：构建链全绿（守卫 → build → collect → smoke → 打包）。
- **FR-ver-204**（MUST）：历史补丁目录（v2.1.2 / v2.2.5）内容不变。
- **FR-ver-205**（MUST）：敏感信息（API Key / 口令 / 令牌）不落盘。
- **FR-ver-206**（SHOULD）：Conventional Commits 提交；本地 tag `v2.4.1`。

## 4. 验收

| 项 | 判定 |
|---|---|
| 补丁 | 6 条应用成功、0 失败 |
| 载荷 | `opencode-dist.tar.gz` + 插件清单（workspace-roots / search / pnpm） |
| host 门禁 | `/api/info` 200、`/` 200、SSE 首事件、无凭据 401 |
| 版本 | APK 内 `versionName=2.4.1` / `versionCode=20401` |
| 真机 | `⬜` 阻塞（adb 未见设备） |
