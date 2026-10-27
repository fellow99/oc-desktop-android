# 107-compliance —— 合规与分发前置（spec）

> 状态：⬜ planned（Phase 3 前逐条落实）· 引用：规划 §13

## 1. 目标

分发前完成合规清单 G1~G10；本工程当前仅 G9（PoC 清理）已触发执行。

## 2. 清单与判据（届时逐条打勾）

| # | 项 | 判据 | 状态 |
|---|---|---|---|
| G1 | 无动态下发可执行代码 | 运行期只解包 JS 载荷；不 dlopen 可写目录 `.so` | ✅（设计即合规，发版前复核） |
| G2 | 16KB 页对齐 | 引擎构建期保证 + lock 门禁 | ✅ lock 24.22.1 合格 |
| G3 | 第三方许可清单 | `THIRD-PARTY-NOTICES`（Node.js/opencode/pnpm/isomorphic-git/引导件）随包 | ⬜ |
| G4 | 供应链可追溯 | runtime.lock + 载荷 SHA-256 清单随包 | ✅ 部分（lock 引用 + manifest；随包分发待做） |
| G5 | 数据与隐私 | 会话/密钥/工作区全本地；外呼仅模型请求；隐私政策声明 | ⬜ |
| G6 | 非官方声明 | README + 关于页（非 opencode 官方，MIT 第三方移植） | ⬜（README 已含，关于页待做） |
| G7 | targetSdk 政策 | targetSdk 36 达标；前台服务用途声明（若启用） | ✅（36） |
| G8 | 分发 | 侧载 APK 主线安装文档；Play AAB+PAD 评估 | ⬜ |
| G9 | PoC 清理 | 探针 Activity/诊断端点/`--inspect`/`--jitless` 不进发布包 | ✅（本迭代 debug probe 源集已删除） |
| G10 | AI 内容 | 遵循平台 AI 政策；沿用上游 UI 标识口径 | ⬜ |

## 3. 签名与发版（配套）

`keystore.properties`（gitignore）+ `.sample` 模板已就位；release signingConfig 接线在 `app/build.gradle.kts`（材料存在时生效）。发版前 T-R1（SHA-256 归档）必须过。
