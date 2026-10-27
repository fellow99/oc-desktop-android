# 106-upstream-adaptation —— 上游适配/幂等补丁（spec）

> 状态：⬜ planned（按需引入）· 引用：规划 §5.10/§9 · 对标：ark `patches/v2.1.2/` 五件套同名移植

## 1. 目标

在**不改上游**前提下，为 Android 平台差异做最小补丁面；补丁幂等、可反向、基线守卫。

## 2. 需求与验收判据（届时生效）

| # | 补丁 | 作用 | 引入条件 |
|---|---|---|---|
| R1 | `0001-node-target-ohos`（可裁剪 hunk，名称/意图不变） | `resolve.conditions` 前置 + `OPENCODE_NODE_TARGET=node24` build.target | 上游条件解析在 Android 上出错时 |
| R2 | `0003-runtime-stubs-ohos` | `#pty`/`#persistent-pty-binary` 打桩（顶层 require 失败会中断 bundle） | 换用会触发该路径的构建形态时 |
| R3 | `0006-shell-select-ohos` | shell 探测容错 + `OC_SHELL_FALLBACK` | P0-J 已证 `/system/bin/sh` 可用 ⇒ 仅当上游 shell 探测误判时 |
| R4 | `0007-workspace-roots-picker` | UI 工作区选择器（经壳插件 RPC） | 203 落地时 |
| R5 | `0008-git-credentials-settings` | 设置→Git 凭据页 | 108 落地时 |
| R6 | 流水线接线 | `scripts/apply-patches.mjs`（基线守卫+reverse-check）接入 102 构建链；「共用 submodule 串行」纪律 | 首个补丁引入时 |

## 3. as-built 现状

v2.1.2 stock bundle（零补丁）已在 Android 完成 serve + 对话 + 看图 + shell 工具全链路（20261028-02）⇒ 本模块**暂无激活补丁**，仅保留规格与引入条件；stock 事实记录于 ARCHITECTURE §5。

## 4. 判据汇总

补丁应用后：`git apply --reverse --check` 通过；正反向往返 SHA-256 还原；smoke 全绿；不落入既有补丁上下文区间。
