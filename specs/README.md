# oc-desktop-android 规格文档（specs/）

> **文档体系**：本目录是 `oc-desktop-android` 的规格（specs）与规范文档之家。**唯一权威规划**是 [`docs/000-工程规划.md`](../docs/000-工程规划.md)（v0.2）；本目录的任何文档与其冲突时，以规划为准。
> **生成方式**：`specs-as-built` 方法 —— 以**源码与真机证据**为唯一事实源逆向成文；已实现模块标注 `as-built`（附实测判据），未实现模块标注 `planned`（仅目标与验收判据，不含臆造细节）。

## 一、这是什么工程

**OC Desktop Android**（`org.fellow99.oc.OCDesktopAndroid`，v2.1.2/20102）：opencode 桌面端的 **Android 版**。

- **进程内 Node**（`io.github.fellow99:node-bridge:0.2.0` + `node-runtime:24.22.1`，Maven 双包）承载 **opencode v2.1.2 stock CLI bundle** 的 `serve` 服务；
- **系统 WebView** 同源加载本机服务内嵌的 v2 Web UI —— 零 CORS、零 JS 注入桥、零内嵌浏览器内核、无 Electron；
- 对标兄弟工程 [`oc-desktop-ark`](../oc-desktop-ark)（鸿蒙 ArkUI 版）的同构形态；特色能力：isomorphic-git 插件 + **进程内 pnpm**（ark 无）。

## 二、文档索引（项目级）

| 文档 | 回答什么 |
|---|---|
| [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | 每个模块规范文档的完成情况登记 |
| [STRUCTURE.md](./STRUCTURE.md) | 整个项目的目录与文件结构（as-built） |
| [TECH.md](./TECH.md) | 整个项目的技术选型与版本钉死 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 整体架构：进程/模块/数据流/启动时序 |
| [constitution.md](./constitution.md) | 宪法原则（最高约束，冲突时以本文为准） |
| [overall-spec.md](./overall-spec.md) | 整体规格：做什么 + 验收判据（技术无关） |
| [overall-plan.md](./overall-plan.md) | 整体技术方案：怎么做（技术具体） |
| [overall-data-model.md](./overall-data-model.md) | 数据模型：沙箱文件布局 / marker / 凭据 / 会话数据 |
| [overall-test-cases.md](./overall-test-cases.md) | 测试用例索引目录（探针 / 端到端 / 回归） |

> 按需求约定：**不设** `API.md` / `overall-api.md` —— API 契约以上游 `/api/*`（OpenAPI `/doc`）为准，本目录只做引用。

## 三、模块级文档（编号对标 ark specs/，见规划 §14.2）

| 模块 | 目录 | spec | 状态 |
|---|---|---|---|
| 101 运行时接入 | [101-runtime-integration/](./101-runtime-integration/) | [spec.md](./101-runtime-integration/spec.md) | ✅ as-built |
| 102 载荷流水线 | [102-payload-pipeline/](./102-payload-pipeline/) | [spec.md](./102-payload-pipeline/spec.md) | ✅ as-built |
| 103 WebView 渲染壳 | [103-webview-shell/](./103-webview-shell/) | [spec.md](./103-webview-shell/spec.md) | ✅ as-built |
| 104 宿主能力 | [104-host-capabilities/](./104-host-capabilities/) | [spec.md](./104-host-capabilities/spec.md) | ✅ as-built |
| 105 鉴权 | [105-auth/](./105-auth/) | [spec.md](./105-auth/spec.md) | ✅ as-built |
| 106 上游适配（补丁） | [106-upstream-adaptation/](./106-upstream-adaptation/) | [spec.md](./106-upstream-adaptation/spec.md) | ✅ as-built |
| 107 合规 | [107-compliance/](./107-compliance/) | [spec.md](./107-compliance/spec.md) | 🔶 部分（G3/G4/G6） |
| 108 Git 插件 | [108-git-plugin/](./108-git-plugin/) | [spec.md](./108-git-plugin/spec.md) | 🔶 as-built（host） |
| 109 回归基线 | [109-regression/](./109-regression/) | [spec.md](./109-regression/spec.md) | ⬜ planned |
| 110 jitless 诊断形态 | [110-jitless/](./110-jitless/) | [spec.md](./110-jitless/spec.md) | ⬜ planned |
| 111 基线迁移（v2.1.2） | [111-version-2.1.2/](./111-version-2.1.2/) | [spec.md](./111-version-2.1.2/spec.md) | ⬜ planned |
| 112 JS 搜索兜底（本工程新增） | [112-js-search/](./112-js-search/) | [spec.md](./112-js-search/spec.md) | 🔶 as-built（host） |
| 203 工作区选择器 | [203-workspace-picker/](./203-workspace-picker/) | [spec.md](./203-workspace-picker/spec.md) | 🔶 as-built（host） |
| 205 pnpm 插件（本工程新增） | [205-pnpm-plugin/](./205-pnpm-plugin/) | [spec.md](./205-pnpm-plugin/spec.md) | ⬜ planned |
| 001 构建发布流程（需求模块） | [001-building-workflow/](./001-building-workflow/) | [spec.md](./001-building-workflow/spec.md) | 🚧 as-built（CI 端到端待真推 tag） |

## 四、写作纪律

1. `spec.md` 只写「**做什么 + 验收判据**」（技术无关，可证伪）；实现细节回引 `overall-plan.md` 与源码路径。
2. 判据一律写成「能观测到 X」；真机结论一律引用 [`docs/真机验证记录.md`](../docs/真机验证记录.md) 的轮次，不重复粘贴证据。
3. 运行时契约（桥/引擎）**只引用不复制**：`aosp-node-bridge/docs/000-工程规划.md` §5/§6 为准。
4. **敏感信息纪律**：任何文档不得出现 API Key、口令、auth_token 实值；示例一律 `***` 掩码。
