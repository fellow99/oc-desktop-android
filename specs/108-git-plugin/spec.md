# 108-git-plugin —— Git 能力（isomorphic-git 插件）（spec）

> 状态：🔶 as-built（2026-10-29 host 侧全过；设备侧判据随真机轮）· 引用：规划 §5.12 D12 · 对标：ark `108-git-plugin` / hos 204

## 1. 目标

会话内 Git 全能力：不依赖系统 git、不 spawn 子进程，isomorphic-git 纯 JS 嵌入服务端进程。

## 2. 需求与验收判据（届时生效）

| # | 需求 | 判据 |
|---|---|---|
| R1 | 工具面 | `git_status/diff/log/branch/commit/checkout/…` 工具在会话可用且输出可见 |
| R2 | VCS 覆盖 | 上游 diff/分支界面基于插件工作（对比 ark 108 行为） |
| R3 | 凭据页 | 设置→Git 凭据（HTTPS token/用户名口令）落 `config/opencode/`（0600 语义）；插件消费（依赖 106 的 0008） |
| R4 | 性能基准 | 5MB 级仓库全量 status/diff/commit 可接受（阈值见 ark 108 spec）；不可行则降级「只读 diff」并如实标注 |
| R5 | 物化 | 插件随载荷物化到 `config/opencode/plugin/`（禁 symlink，一律 copy） |

## 3. 依赖

106（0007/0008 UI 面）、102（collect-plugins 物化步骤）、设备 `/data` 分区读写性能（P0-N 基准）。

## 4. as-built 判据核录（2026-10-29，host）

| # | 判据 | 结果 | 证据 |
|---|---|---|---|
| R1 工具面 | 21 个 `git_*` 注册并实跑 | ✅ host | `verify-git-plugin.mjs`：init/add/commit/status/diff/branch/log 全 PASS（对 staged 产物） |
| R2 VCS 覆盖 | provider 注册 + selection=git | ✅ host | 插件日志 `vcsProvider=git(override)`（上游 Vcs.selected 逻辑见 ark 108 真机结论） |
| R3 凭据页 | 落 `config/opencode/`（0600）+ 插件消费 | ✅ host（0600 设备侧复核） | RPC describe → `config/opencode/git-credentials`；口令不回显；Windows 宿主 chmod SKIP |
| R4 性能基准 | ≈5MB 仓库 status/diff/commit | ✅ host 预演 | add=82ms / commit=14ms / status=21ms / diff=18ms（阈值内）；真机阈值随 P0-N 轮 |
| R5 物化 | 随载荷 copy 到 `config/opencode/plugin/` | ✅ | collect-plugins（56 包/7.76MB/断言）+ payload/lib/plugins.js（digest 幂等+篡改自愈）+ serve 实弹 RPC |
