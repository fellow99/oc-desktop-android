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
| M-106 | 上游适配（五补丁） | [spec](./106-upstream-adaptation/spec.md) | ✅ Done（as-built 20261029） | 7 补丁幂等应用 + smoke 全绿 |
| M-107 | 合规（§13 清单） | [spec](./107-compliance/spec.md) | 🔶 大部分✅（20261029-2） | G3/G4/G5/G6/G10 ✅；G8 安装文档/Play 专项待 |
| M-108 | Git 插件（isomorphic-git） | [spec](./108-git-plugin/spec.md) | 🔶 Done（host 20261029） | verify-git-plugin 全过；0600/真机随 P0-N 轮 |
| M-109 | 回归基线（四件套） | [spec](./109-regression/spec.md) + [as-built](./109-regression/as-built.md) | 🔶 Done（host 20261029-2） | scripts/regression.mjs；首启/设备重测待 |
| M-110 | jitless 诊断形态 | [spec](./110-jitless/spec.md) | ⬜ Pending | ark 同名；Android 裁剪说明 |
| M-111 | 基线迁移 v2.1.2 | [spec](./111-version-2.1.2/spec.md) | ⬜ Pending | 对标 ark 111 |
| M-112 | JS 搜索兜底（grep/glob） | [spec](./112-js-search/spec.md) | 🔶 Done（host 20261029） | oc-plugin-search；夹具用例全过 |
| M-203 | 工作区选择器（SAF 导入制） | [spec](./203-workspace-picker/spec.md) | 🔶 Done（host 20261029） | 0007/0009 + 插件 RPC 实弹；SAF 实机随真机轮 |
| M-205 | pnpm 插件（本工程新增） | [spec](./205-pnpm-plugin/spec.md) + [as-built](./205-pnpm-plugin/as-built.md) | 🔶 Done（host 20261029-2） | 五工具（run 平台证伪降级）；P0-M 冻结 |

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

## 四、需求覆盖对照（`001-building-workflow`，2026-10-29）

| 需求项 | 状态 | 落点 |
|---|---|---|
| GitHub Actions 自动构建/发布（tag `v*` 触发，如 `v0.12.1`） | ✅ | [.github/workflows/build-release.yml](../.github/workflows/build-release.yml)（载荷五步 + APK + Release） |
| 规格四件套 | ✅ | [001-building-workflow/](./001-building-workflow/)（spec/plan/tasks/test-cases） |
| 签名材料零入库（secrets 注入，无则 debug 兜底） | ✅ | workflow 注秘 step + `keystore.properties.sample` 键名同口径 |
| 引擎双包 Central 解析（CI 无 mavenLocal 依赖） | ✅ | node-bridge 0.2.0 / node-runtime 24.22.1 Central 实证（2026-10-27） |
| 本机等价验证（基线守卫 + assembleDebug + 21 项 workflow 断言） | ✅ | [logs/20261029-2/TEST_REPORT.md](../logs/20261029-2/TEST_REPORT.md) |
| 真实 tag 端到端（push v0.12.1） | ✅ 全链路完成 | 彩排（40867423494）+ 正式 tag v0.12.1（40875919607）均全绿；Release 已发布（签名 APK + sha256） |


## 四、需求覆盖对照（20261029-2 轮：Phase2 收尾 + Phase3 + Phase4）

| 需求项 | 状态 | 落点 |
|---|---|---|
| P1 扫尾（M9/M10/0009v2） | ✅ | auth.test 三例 / search 元数据 / 0009 hunk v2 |
| 205 pnpm（P0-M 冻结 + 五工具） | ✅ host | plugins/oc-plugin-pnpm + logs/20261029-2/P0M-PROBE.md |
| D15 保活 + notify 真实现 | ✅ 编译级 | KeepaliveService + keepalive.set/get（设备面随模拟器恢复） |
| 107 G5/G10 收口 | ✅ | 关于页隐私段 + 口径核录 |
| 109 回归四件套 | ✅ host | scripts/regression.mjs + logs/20261029-2/REGRESSION.md |
| 111 走查 | ✅（基线未变，无需迁移） | logs/20261029-2/PHASE4.md |
| 出口闭环（pnpm→修 bug→git commit） | ✅ host 等价 | docs/evidence/20261029-02/（模拟器 qemu 事件转登记） |
| 模拟器环境事件 | ⬜ 恢复待 | logs/20261029-2/ENVIRONMENT.md |
