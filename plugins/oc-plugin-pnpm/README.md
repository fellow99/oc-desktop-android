# oc-plugin-pnpm

进程内 pnpm 能力面（specs/205；D13）。五工具：`pnpm_install / pnpm_add / pnpm_remove / pnpm_list / pnpm_why`。

- pnpm 运行时（10.34.9：`pnpm.cjs` + `worker.js` + `pnpmrc`）由 `scripts/collect-plugins.mjs` 构建期
  按 pin 获取并物化进本目录（**不入 git**）；
- 引导 = worker_threads + argv 注入（P0-M 冻结）；命令 `-C <workspaceRoot>` + 沙箱 store；
- `pnpm run` 不提供：生命周期脚本依赖 spawn node（平台无 node ELF，P0-M 证伪，D13 预设降级）；
- 脚本安全双保险：`--ignore-scripts` + pnpm10 构建白名单。
