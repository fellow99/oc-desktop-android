# 205-pnpm-plugin —— as-built 判据核录（2026-10-29，host）

> 状态：🔶 as-built（host 全过；设备侧 /data 三态与会话内实调随模拟器恢复/真机轮）
> 实现：`plugins/oc-plugin-pnpm/`（五工具）+ `scripts/collect-plugins.mjs`（pnpm 运行时按 pin 获取）

## P0-M 冻结结论（详见 logs/20261029-2/P0M-PROBE.md）

| 项 | 结论 |
|---|---|
| 版本/形态 | **pnpm 10.34.9**（12.x 已去单文件化，不适用进程内路线）；**整目录投放** pnpm.cjs+worker.js+pnpmrc（8.7MB） |
| 引导方式（O1） | ✅ **argv 注入 + require**（worker_threads 内）；程序化 API 不可用（bundle 无导出面） |
| 完成判定 | require 返回≠完成；以 worker 事件循环排空（beforeExit）为准 |
| install | ✅ 2.4s（fixture：registry 包 + file: 依赖） |
| 脚本安全 | ✅ 双保险：`--ignore-scripts` 显式 + pnpm10 构建白名单默认拒 |
| **run 降级** | ❌ 证伪：pnpm run/exec 依赖 spawn node（平台无 node ELF）⇒ **工具面五件**（install/add/remove/list/why），触发 D13 预设降级 |
| registry | install/add 支持覆写（默认 npmmirror）；list/why/remove 无该选项（pnpm 校验） |

## 验收判据核录

| R（spec 205/规划 D13） | 结果 |
|---|---|
| 工具注册（fail-visible） | ✅ editor.add + 缺失即抛（host mock 形态同 108） |
| install/add/remove/list/why | ✅ host 实跑（T1 list exit0 含 left-pad；T2 why ok；T3 registry 误用正确报错） |
| 沙箱 store/`-C` 目录参数 | ✅ `--store-dir` + `-C` 全工具生效 |
| 物化 | ✅ collect-plugins（pin 10.34.9；断言 pnpm.cjs/worker.js/pnpmrc 在位） |
| 设备侧 /data 三态 + 会话内实调 | ⬜ 待模拟器恢复/真机 |
