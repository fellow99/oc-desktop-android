# Phase 4 与探针补遗登记（20261029-2）

## 111 基线迁移演练（P3-16）—— 走查结论
- 当前上游基线未变（HEAD=a517687fde / Branch_v2.1.2 / version=2.1.2，apply-patches 基线守卫每轮校验）⇒
  **无需迁移**；111 核对单完整试跑留待**上游换 tag 真实触发**时执行（核对单本身已按 ark 111 同构就绪）。

## P3-18 探针补遗（模拟器恢复后逐项）
- [ ] EventSource 息屏 ≥60s（adb input keyevent 26 → SSE 心跳连续性）
- [ ] 双实例专项（二次 am start → singleTask 单实例断言）
- [ ] 密码轮换交互（O7：connection.json 重置 → 旧 token 401 → 错误页路径）
- [ ] `os.cpus()` 经 bash 工具（/proc/cpuinfo + nproc 取证）
- [ ] `/data` symlink/hardlink 三态（run-as + toybox ln，供 205 package-import-method 参考）
- 真机项：JIT 矩阵、首启分解、SAF 实机、0600、`/data` 性能、定制 ROM（归真机轮）。

## 文档债（下一轮）
- as-built 模块 plan.md 补齐（106/107/108/203/112/205/109）
- docs/000-工程规划 v0.4（§11 登记 20261029-1/2 两轮、§14.1 现状翻转、附录 A）
- 容器仓 README 子工程表补行
