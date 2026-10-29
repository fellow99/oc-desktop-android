# P0-M 探针报告 —— 进程内 pnpm（host 侧，2026-10-29）

## 版本与形态
- **pnpm 12 已去单文件化**（bin/pnpm.mjs + 平台原生二进制路线）⇒ 进程内 require 路线不适用；
- 选定 **pnpm 10.34.9**（10.x 末版，单文件 `dist/pnpm.cjs` 8,676,125B），与规划 D13 形态一致；
- **关键结构发现**：pnpm.cjs 非自足——运行期 `path.join(__dirname,"worker.js")` 起内部 worker 池，
  **必须整目录投放**（pnpm.cjs + worker.js + pnpmrc，8.7MB）。缺 worker.js 时 `Worker pnpm#1 exited with code 1`。

## 引导方式冻结（规划 O1）
✅ **argv 注入 + require**：`process.argv=['node','pnpm','-C',projDir,...args]; require(pnpmCjs)`
  - `--version` 同步打印并**正常返回（不 process.exit）**；
  - `install` 异步执行（require 返回 ≠ 完成），需**等待/异步聚合**；
  - 程序化 API（备选②）：bundle 无导出面 ⇒ 不可用（探针证实）。

## install 冒烟（host）
| 判据 | 结果 |
|---|---|
| `install`（registry 镜像 + 沙箱 store-dir + `-C` 目录参数） | ✅ **2.4s**，Packages +2（left-pad 1.3.0 + file: 依赖） |
| `--ignore-scripts` 哨兵（postinstall 写 pwned.txt） | ✅ 未触发（显式 flag）|
| pnpm10 构建脚本白名单（onlyBuiltDependencies 默认拒） | ✅ 双保险 |
| 沙箱 store-dir | ✅ `.pnpm-store` 落工程指定目录 |
| `run`（spawn node 跑脚本） | ❌ **平台证伪**：依赖 spawn node ELF ⇒ 工具面降级为 install/add/remove/list/why 五工具（触发 D13 预设降级预案） |

## 设备侧待验（模拟器恢复后）
`/data` 分区 hardlink/symlink/reflink 三态（`package-import-method=auto` 行为）、真实网络与耗时、
`pnpm store add/add/remove/list/why` 在会话内被模型调用。

## 实现决定（oc-plugin-pnpm）
- 引导：worker_threads（**workerData 传参**，worker 内 argv 注入 + stdout/stderr 拦截聚合 + 完整退出码/异常回传；
  主侧超时 terminate）；
- 参数：所有工具带 `-C <workspaceRoot>`（服务端会话目录）与沙箱 `--store-dir`、默认 registry 镜像可覆写；
- 工具面：**五工具**（install/add/remove/list/why），run 不做（如实登记）。
