# 205-pnpm-plugin —— 进程内 pnpm（spec，本工程新增编号）

> 状态：⬜ planned（Phase 2；**全量档位已确认**，见规划 §5.12 D13）· ark 无此能力

## 1. 目标

设备上可用的 pnpm：单文件 `pnpm.cjs` 随载荷投放，**同进程** `require` 引导（禁 spawn node ELF），沙箱化一切目录，默认忽略生命周期脚本。

## 2. 需求与验收判据（届时生效）

| # | 需求 | 判据 |
|---|---|---|
| R1 | 工具面（全量档位） | `pnpm_install / pnpm_add / pnpm_remove / pnpm_run / pnpm_list / pnpm_why` 六工具在会话可用，输出流式回传 |
| R2 | 引导方式冻结 | P0-M 实测二选一：① `require("./pnpm.cjs")` 前注入 `process.argv=["pnpm",…]`；② programmatic API（`runPnpm` 等）。两者都不成立才启用降级预案（安装子集 + UI 如实标注） |
| R3 | 沙箱配置 | store/cache/global/state 全落沙箱（`.npmrc` + env 双保险）；`package-import-method=auto`（hardlink→copy 回退），`/data` 三态实测记录 |
| R4 | 脚本安全 | 默认 `--ignore-scripts`；白名单放行须显式提示 |
| R5 | 网络 | 走系统网络；`npm_config_registry` 可配镜像；超时/重试显式化 |
| R6 | 失败可见 | 失败原因回传会话，不静默 |
| R7 | 物化 | `opencode-dist/lib/pnpm.cjs` 随载荷（102 扩展 collect 规则）+ `oc-plugin-pnpm` 物化到 `config/opencode/plugin/` |

## 3. 依赖

102（collect 扩展）、106（如需 UI 提示补丁）、P0-M 探针（引导方式/三态/ignore-scripts 生效性）。
