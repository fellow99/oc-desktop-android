# 20261029-1 开发清单 —— P1 六项（能力清单 §5-P1，无独立需求编号）

> 流程：specs-based-devflow（Specification 沿用既有 planned 规格，本清单即 Development 记录）
> 事实源：docs/000-工程规划.md §5.10/§5.12/§5.13/§7.1 + specs/{106,107,108,203} + 能力清单 §5
> 参照：oc-desktop-ark（同名补丁/脚本/插件移植）

## 任务映射（P1 六项 → 落点）

| P1 # | 任务 | 落点（本仓库） | 对应规格 |
|---|---|---|---|
| 5 | verify-runtime.mjs 锁值门禁 | scripts/verify-runtime.mjs | 101/102 扩展 |
| 1 | 补丁体系 | patches/v2.1.2/ + scripts/apply-patches.mjs + build-opencode.mjs | 106 R1–R6 |
| 9(前置) | collect-plugins.mjs 物化 | scripts/collect-plugins.mjs + payload/lib/plugins.js | 102 扩展（P2-9 提前，P1 硬前置） |
| 3 | grep/glob JS 插件 | plugins/oc-plugin-search/ | 新增 112 式模块 |
| 2 | isomorphic-git 插件 | plugins/oc-plugin-git/ + 0008 + verify-git-plugin.mjs（P0-N） | 108 R1–R5 |
| 6 | 工作区选择器 | plugins/oc-plugin-workspace-roots/ + 0007/0009 + Kotlin SAF | 203 R1–R6 |
| 4 | 品牌化 | 0010 + 图标/关于页/THIRD-PARTY-NOTICES + verify-branding.mjs | 107 G3/G6 + E5 |

## 步骤记录

- [x] S1 侦查：规划/规格/ark 参照/opencode 树状态（ark 五件套当前已应用，HEAD=a517687fde ✅）
- [x] S2 P1-1 补丁体系落地（五件套复制 + README + apply/build 脚本移植）
- [x] S3 P1-5 verify-runtime.mjs（SHA-256 + ELF 六门禁 + 16KB 对齐，AAR 取自 Gradle 缓存）
- [x] S4 前置：collect-plugins.mjs（三插件物化 + 断言）+ payload/lib/plugins.js 运行期物化
- [x] S5 P1-3 oc-plugin-search（grep/glob 纯 JS 兜底）
- [x] S6 P1-2 oc-plugin-git 移植适配（RPC id 保持 oc-ark-git；凭据落 config/opencode/）+ verify-git-plugin.mjs（含 P0-N 基准）
- [x] S7 P1-6 oc-plugin-workspace-roots（Android 语义）+ Kotlin SAF 导入制 + 0009 补丁
- [x] S8 P1-4 品牌化（0010 title + 图标 + 关于页 + THIRD-PARTY-NOTICES + verify-branding.mjs）
- [x] S9 流水线接线（collect-opencode 扩展 + smoke 断言扩展）
- [x] S10 host 全链路验证（apply-patches → build → collect-plugins → collect → smoke + 各 verify）
- [x] S11 Code Review（requesting → 接收处置 → 复审）
- [x] S12 文档滚动（specs 状态/能力清单/SPECS_CHECKLIST/README）+ 分阶段提交

## 如实登记（范围与偏差）

- 0009/0010 为 Android 专属追加补丁（ark 无）；0001–0008 与 ark 逐字节一致。
- 203 R1 的 UI 三动作：列/新建/选择由 0007（ark UI）提供，导入/删除按钮由 0009 提供。
- P0-N / P0-M 等设备侧判据在本轮只做 **host 侧等价验证**；真机判据仍 ⬜（能力清单 §5-8 不在本轮）。
