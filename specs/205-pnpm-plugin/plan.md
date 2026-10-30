# 205-pnpm-plugin 技术方案（as-built）

## 1. 运行时（P0-M 冻结，logs/20261029-2/P0M-PROBE.md）
- pnpm **10.34.9** 整目录形态：pnpm.cjs + **worker.js**（内部 worker 池，缺即
  `Worker pnpm#1 exited with code 1`）+ pnpmrc；12.x 已去单文件化不适用；
- 获取：collect-plugins 按 pin `npm install pnpm@<pin> --prefix`（npm 自解包，弃手写 tar——
  其 pax 变体与手写解析存在兼容黑洞）；缓存 .cache/pnpm-dist。

## 2. 引导（worker_threads）
- `pnpm-worker.cjs`：workerData={pnpmCjs,projDir,args,registry} → argv 注入
  `['node','pnpm','-C',projDir,--registry?,...args]` → require(pnpmCjs)；
- **完成判定 = beforeExit**（require 返回≠异步 main 完成）；stdout/stderr 拦截聚合，tail≤4KB 回传；
- 主侧 180s 超时 terminate。

## 3. 工具面（五件；run 证伪降级）
pnpm_install / pnpm_add（dev 可选）/ pnpm_remove / pnpm_list（depth 钳位）/ pnpm_why；
公共：`-C <workspaceRoot>`（服务端围栏）+ `--store-dir` 沙箱 + `--ignore-scripts`（白名单双保险）；
registry 覆写仅 install/add（pnpm 对 list/why 报 Unknown option——实测）。

## 4. 宿主集成
- 插件目录定位 pnpm.cjs（__dirname），运行期随四插件一并物化到 config/opencode/plugin/；
- fixture 实测：install 2.4s / list·why exit0 / add ms@2.1.3 落盘 + package.json 更新；
- 已知呈现：上游把 tool metadata 对象拼进回复显示 [object Object]（不影响执行，登记观察）。
