# SPECS_CHECKLIST —— 规格完成度

> 更新：2026-10-28 · 需求 `000-scaffold`（工程搭建）
> 状态口径：✅ Done（as-built，已实测/自检） · 🚧 In Progress · ⬜ Pending（planned，仅有目标与判据）
> 生成方式：`specs-as-built`（源码/真机证据为唯一事实源）

## 一、项目级文档（P-01 … P-10）

| # | 文档 | 路径 | 状态 |
|---|---|---|---|
| P-01 | 目录与文件结构 | [STRUCTURE.md](./STRUCTURE.md) | ✅ Done |
| P-02 | 技术选型 | [TECH.md](./TECH.md) | ✅ Done |
| P-03 | 整体架构 | [ARCHITECTURE.md](./ARCHITECTURE.md) | ✅ Done |
| P-04 | 宪法原则 | [constitution.md](./constitution.md) | ✅ Done |
| P-05 | 整体规格 | [overall-spec.md](./overall-spec.md) | ✅ Done |
| P-06 | 整体技术方案 | [overall-plan.md](./overall-plan.md) | ✅ Done |
| P-07 | 数据模型 | [overall-data-model.md](./overall-data-model.md) | ✅ Done |
| P-08 | 测试用例索引 | [overall-test-cases.md](./overall-test-cases.md) | ✅ Done |
| P-09 | 文档索引 | [README.md](./README.md) | ✅ Done |
| — | 完成度追踪 | [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | ✅ Done |

> 按需求约定：**不生成** `API.md` / `overall-api.md`（API 契约以上游 `/api/*` 为准，引用见 [overall-data-model.md](./overall-data-model.md)）。

## 二、模块级文档（M-101 … M-205）

| # | 模块 | spec.md | 状态 | 依据 |
|---|---|---|---|---|
| M-101 | 运行时接入（双包/编排/关停） | [spec](./101-runtime-integration/spec.md) | ✅ Done（as-built） | 源码 + 真机 20261028 两轮 |
| M-102 | 载荷流水线（collect/smoke/自解包） | [spec](./102-payload-pipeline/spec.md) | ✅ Done（as-built） | scripts/* + smoke 全绿 |
| M-103 | WebView 渲染壳 | [spec](./103-webview-shell/spec.md) | ✅ Done（as-built） | MainActivity + P0-D/E |
| M-104 | 宿主能力桥 | [spec](./104-host-capabilities/spec.md) | ✅ Done（as-built，SAF/notify 为 stub） | HostCapabilities + 探针 echo |
| M-105 | 鉴权（密码/auth_token/凭据） | [spec](./105-auth/spec.md) | ✅ Done（as-built） | ConnectionStore + e2e 对话 |
| M-106 | 上游适配（五补丁） | [spec](./106-upstream-adaptation/spec.md) | ⬜ Pending | 规划 §5.10；stock bundle 暂免补丁 |
| M-107 | 合规（§13 清单） | [spec](./107-compliance/spec.md) | ⬜ Pending | 规划 §13 |
| M-108 | Git 插件（isomorphic-git） | [spec](./108-git-plugin/spec.md) | ⬜ Pending | 对标 ark 108 |
| M-109 | 回归基线（四件套） | [spec](./109-regression/spec.md) | ⬜ Pending | 规划 Phase 4 |
| M-110 | jitless 诊断形态 | [spec](./110-jitless/spec.md) | ⬜ Pending | ark 同名；Android 裁剪说明 |
| M-111 | 基线迁移 v2.1.2 | [spec](./111-version-2.1.2/spec.md) | ⬜ Pending | 对标 ark 111 |
| M-203 | 工作区选择器（SAF 导入制） | [spec](./203-workspace-picker/spec.md) | ⬜ Pending | D14；当前默认工作区已可用 |
| M-205 | pnpm 插件（本工程新增） | [spec](./205-pnpm-plugin/spec.md) | ⬜ Pending | D13 全量档位 |

## 三、需求覆盖对照（本迭代 `000-scaffold`）

| 需求项 | 状态 | 落点 |
|---|---|---|
| 搭建基础脚手架（不实现具体功能） | ✅ | app/ 宿主五类 + payload/ + scripts/（[STRUCTURE.md](./STRUCTURE.md)） |
| 针对未明确判断实现探针并测试 | ✅ | P0-A/B/D/E/J/K 全绿（[真机验证记录](../docs/真机验证记录.md) 20261028-01） |
| 探针测试后清理 | ✅ | `app/src/debug/` probe 源集已整目录删除（G9） |
| 编写规范文档（specs/ 结构） | ✅ | 本清单 §一/§二 |
| 开发实现 + Android Studio 构建 | ✅ | `gradle :app:assembleDebug` 通过（Gradle 8.12 + AGP 8.9.2 + JDK 21，Android Studio JBR 可直接打开） |
| 调试/测试（DeepSeek/工作区/对话/看图） | ✅ | 端到端四项全过（[真机验证记录](../docs/真机验证记录.md) 20261028-02） |
| 敏感信息不落盘文档 | ✅ | 全仓 grep 校验（key/口令/auth_token 实值 0 命中，evidence 已脱敏） |
