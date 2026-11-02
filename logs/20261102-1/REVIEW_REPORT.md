# REVIEW_REPORT —— 111-pty-integration 代码评审（M0/M1/M2）

> 评审范围：128662e..037b71d（feature）｜ 角色：requesting + receiving-code-review（fallback 单评审人）
> 评审重点：payload/lib/pty-inprocess.js、payload/lib/node-pty.js、opencode-server.js ⑤b、OpencodeRuntime.kt、verify-runtime.mjs

## 评审结论
- 无已证实的 Critical 缺陷；实现与官方 `daemon.ts` 帧协议逐项对齐（ProtocolVersion 7、attached/replay/raw 输出帧）。
- 关键开放项：**整链未做端到端设备验证**（需 payload bundle 重建 + 全应用运行），见 Important I1/I2。

## Critical
- 无（未发现已被证实的阻断性缺陷）。

## Important
- **I1（验证必须）spawn 拦截鲁棒性**：`inject()` 改写 `child_process.spawn`，但 bun 打包 ESM 可能按值捕获 `spawn`，导致拦截失效。**只有 payload bundle 重建后设备端验证能证伪/证实**；若失效，改走 `resolveBinary`/核心补丁路径。→ 列入 4.4 设备验证硬项。
- **I2（验证必须）整体端到端**：daemon 客户端握手（discover/ping/own/create/subscribe）仅 host 单测了 `createHandler`；socket 层 + inject + 官方客户端交互需设备验证。
- **I3（已修复）原始字节损坏**：write/input 走 `base64→utf8→写` 会损坏非 UTF-8 控制/输入序列；已改为直接写 Buffer。
- **I4（已确认可接受）能力降级**：snapshot 返回空 checkpoint、read_rows 近似、foreground_process=null、无 controller_changed —— 单客户端场景 GUI 可回退到 replay 重建；符合 M2「最小可用+如实降级」。

## Minor
- node-pty 适配器退出后 master fd 未显式 close（进程回收可回收，低风险）。
- shutdown 未 unlink service.json（不影响：socket 已移除 → discover 判停）。
- 多订阅者未做单控制器互斥（Android 单客户端，M3 再补）。

## 处置
- 已修复 I3（提交 code-review-fix）。
- I1/I2 作为 **设备端验证 gate**（M1 载荷重建 + 4.4/4.5），不阻断代码落地，但**不得**在未验证前宣告终端可用。
