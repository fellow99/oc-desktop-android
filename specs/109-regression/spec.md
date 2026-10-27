# 109-regression —— 回归基线（spec）

> 状态：⬜ planned（Phase 4）· 引用：规划 Phase 4 / §14.4

## 1. 目标

任何引擎 lock 或上游 tag 变更后，四件套复跑，结论可对比。

## 2. 回归四件套（判据）

| # | 项 | 判据 |
|---|---|---|
| R1 | 签名 APK | 产物 SHA-256 归档于 `docs/evidence/<date>/` |
| R2 | 首启耗时分解 | 解包/`node::Start`/import 三段耗时记录（对照上轮） |
| R3 | 包体 | debug/release 体积记录（对照 §7.2 预算） |
| R4 | 功能冒烟 | `/global/health` 200 + 首屏关键字段 + e2e 对话/看图最小冒烟 |

## 3. 触发时机

引擎版本变更、上游 tag 变更、AGP/gradle 大版本升级、载荷裁剪规则变更。用例索引见 [overall-test-cases.md](../overall-test-cases.md) §四。
