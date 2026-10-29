# 106-upstream-adaptation —— 上游适配/幂等补丁（spec）

> 状态：✅ as-built（2026-10-29，host 全链路验证）· 引用：规划 §5.10/§9 · 对标：ark `patches/v2.1.2/` 五件套同名移植

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

## 3. as-built 现状（2026-10-29）

- `patches/v2.1.2/`：ark 五件套原样移植（0001/0003/0006/0007/0008，逐字节一致）+ Android 专属
  `0009-workspace-import-actions.patch`（203 R1 的 UI 导入/删除动作，自门控）与
  `0010-branding-oc-desktop.patch`（index.html title → OC Desktop）。
- `scripts/apply-patches.mjs`：基线守卫（HEAD=a517687fde）+ 工作树守卫 + 逐条 reverse-check 幂等；
  `--reset --yes` 需显式。共用 submodule 串行纪律随脚本固化。
- 验证：`apply-patches.mjs --reset --yes` → `已应用 7 / 失败 0`；bundle 重建后 smoke 全绿
  （logs/20261029-1/TEST_REPORT.md #1/#6）。

## 4. 判据汇总

补丁应用后：`git apply --reverse --check` 通过；正反向往返 SHA-256 还原；smoke 全绿；不落入既有补丁上下文区间。
（2026-10-29：脚本内建 ③④ 两步 reverse 校验，往返还原由幂等判据承载；smoke 全绿 ✅。）
