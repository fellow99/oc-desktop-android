# specs/ —— OC Desktop · Android Edition 规格索引

> **工程：** `oc-desktop-android`（进程内 Node 24.22 + 系统 WebView）
> **版本：** 2.2.5 / `versionCode 20205`
> **上游基线：** opencode **v2.2.5**（`9bbb8ce18c` / `Branch_v2.2.5`）
> **方法：** `specs-as-built` —— 以源码、真机证据与构建产物为事实源；已实现模块标 `as-built`，未实现标 `planned`。
> **父规范：** [`../../specs/constitution.md`](../../specs/constitution.md)、[`../../specs/012-building-workflow/`](../../specs/012-building-workflow/)、[`../../specs/013-branding/`](../../specs/013-branding/)。
> **最后更新：** 2026-11-01（按父宪法重排：版本 → `011`、构建 → `012`、Git → `204`、搜索 → `206`）

---

## 一、文档总览

| 层级 | 分类 | 文档数量 | 说明 |
|---|---|---|---|
| 公共 | `011` 版本更新 | 2 个版本 | v2.1.2 / v2.2.5 |
| 公共 | `012` 构建工作流 | 4 | Android CI 构建发布 |
| 公共 | `013` 品牌化 | 2 | 应用名/标题/图标/守卫 |
| 整体 | 项目级顶层 | 10 | README / STRUCTURE / TECH / ARCHITECTURE / constitution / checklist / overall-* |
| 基础 | `101–110` | 20 | 运行时、载荷、WebView、宿主、鉴权、上游、合规、回归、jitless |
| 插件 | `203–206` | 12+ | 工作区、Git、pnpm、JS 搜索 |
| **合计** | **17 个模块目录 + 10 顶层文档** | | 以实际目录为准 |

> 按需求约定：**不设** `API.md` / `overall-api.md` —— API 契约以上游 `/api/*`（OpenAPI `/doc`）为准。

---

## 二、项目级顶层文档

| 文档 | 路径 | 说明 |
|---|---|---|
| 方案总纲 | [ARCHITECTURE.md](./ARCHITECTURE.md) | 进程/模块/数据流/启动时序 |
| 技术选型 | [TECH.md](./TECH.md) | 技术选型与版本钉死（已回写 v2.2.5） |
| 宪法原则 | [constitution.md](./constitution.md) | 最高约束 |
| 项目结构 | [STRUCTURE.md](./STRUCTURE.md) | 目录与文件结构 |
| 检查清单 | [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | 模块完成度 |
| 整体规格 | [overall-spec.md](./overall-spec.md) | 做什么 + 验收判据 |
| 整体方案 | [overall-plan.md](./overall-plan.md) | 怎么做（技术具体） |
| 数据模型 | [overall-data-model.md](./overall-data-model.md) | 沙箱布局/marker/凭据/会话 |
| 测试索引 | [overall-test-cases.md](./overall-test-cases.md) | 探针/端到端/回归 |

---

## 三、公共模块（`0XX`）

### 011 — 版本更新（Version）

| 版本 | 目录 | 文档 | 状态 |
|---|---|---|---|
| v2.1.2 | [011-version-2.1.2/](./011-version-2.1.2/) | spec | ✅ 历史锚点 |
| v2.2.5 | [011-version-2.2.5/](./011-version-2.2.5/) | spec / plan / tasks / test-cases | ✅ 当前（真机验证） |

### 012 — 构建工作流（Building Workflow）

> 从原 `001-building-workflow` 迁移；GitHub Actions tag 构建 + Release。

| 文档 | 链接 | 说明 |
|---|---|---|
| 功能规格 | [012-building-workflow/spec.md](./012-building-workflow/spec.md) | 触发、载荷五步、APK、Release |
| 技术方案 | [012-building-workflow/plan.md](./012-building-workflow/plan.md) | runner、secrets、步骤、风险 |
| 任务清单 | [012-building-workflow/tasks.md](./012-building-workflow/tasks.md) | T1–T* |
| 测试用例 | [012-building-workflow/test-cases.md](./012-building-workflow/test-cases.md) | CI 断言/彩排 |

### 013 — 品牌化（Branding）

> 补丁 0010 + 图标生成 + `verify-branding` + smoke title。

| 文档 | 链接 | 说明 |
|---|---|---|
| 功能规格 | [013-branding/spec.md](./013-branding/spec.md) | 应用名/标题/图标/许可/守卫 |
| 技术方案 | [013-branding/plan.md](./013-branding/plan.md) | 补丁、图标、守卫、测试 |

---

## 四、基础功能模块（`1XX`）

| 模块 | 目录 | spec | 状态 |
|---|---|---|---|
| 101 运行时接入 | [101-runtime-integration/](./101-runtime-integration/) | [spec.md](./101-runtime-integration/spec.md) | ✅ as-built |
| 102 载荷流水线 | [102-payload-pipeline/](./102-payload-pipeline/) | [spec.md](./102-payload-pipeline/spec.md) | ✅ as-built |
| 103 WebView 渲染壳 | [103-webview-shell/](./103-webview-shell/) | [spec.md](./103-webview-shell/spec.md) | ✅ as-built |
| 104 宿主能力 | [104-host-capabilities/](./104-host-capabilities/) | [spec.md](./104-host-capabilities/spec.md) | ✅ as-built（2 stub） |
| 105 鉴权 | [105-auth/](./105-auth/) | [spec.md](./105-auth/spec.md) | ✅ as-built |
| 106 上游适配（补丁） | [106-upstream-adaptation/](./106-upstream-adaptation/) | [spec.md](./106-upstream-adaptation/spec.md) | ✅ as-built |
| 107 合规 | [107-compliance/](./107-compliance/) | [spec.md](./107-compliance/spec.md) | 🔶 部分（G3/G4/G6） |
| 109 回归基线 | [109-regression/](./109-regression/) | [spec.md](./109-regression/spec.md) | 🔶 as-built（脚本化） |
| 110 jitless 诊断形态 | [110-jitless/](./110-jitless/) | [spec.md](./110-jitless/spec.md) | ⬜ planned（仅诊断） |

> 108 未分配；Git 插件已移至 `204`。104 的 `notify/saf` stub 在 `104-host-capabilities/spec.md` 中如实标注。

---

## 五、补丁 / 插件模块（`2XX`）

| 模块 | 目录 | spec | 状态 |
|---|---|---|---|
| 203 工作区选择器 | [203-plugin-workspace-picker/](./203-plugin-workspace-picker/) | [spec.md](./203-plugin-workspace-picker/spec.md) | 🔶 as-built（host） |
| 204 Git 插件 | [204-plugin-git/](./204-plugin-git/) | [spec.md](./204-plugin-git/spec.md) | 🔶 as-built（host） |
| 205 pnpm 插件 | [205-pnpm-plugin/](./205-pnpm-plugin/) | [spec.md](./205-pnpm-plugin/spec.md) | ⬜ planned |
| 206 JS 搜索兜底 | [206-js-search/](./206-js-search/) | [spec.md](./206-js-search/spec.md) | 🔶 as-built（host） |

> 原 `108-git-plugin` → `204-plugin-git`；原 `112-js-search` → `206-js-search`；原 `203-workspace-picker` → `203-plugin-workspace-picker`。

---

## 六、编号迁移表

| 旧编号 | 新编号 | 说明 |
|---|---|---|
| `001-building-workflow` | `012-building-workflow` | 公共构建工作流 |
| `101-version-*` | `011-version-*` | 公共版本模块 |
| `108-git-plugin` | `204-plugin-git` | Git 插件 |
| `112-js-search` | `206-js-search` | JS 搜索插件 |
| `203-workspace-picker` | `203-plugin-workspace-picker` | 与 hos/ark 命名对齐 |

---

## 七、写作纪律

1. `spec.md` 只写“做什么 + 验收判据”（技术无关、可证伪）；实现细节回引 `overall-plan.md` 与源码路径。
2. 判据写成“能观测到 X”；真机结论引用 [`docs/真机验证记录.md`](../docs/真机验证记录.md) 的轮次。
3. 运行时契约（桥/引擎）只引用不复制：`aosp-node-bridge/docs/000-工程规划.md` §5/§6。
4. 敏感信息纪律：任何文档不得出现 API Key、口令、auth_token 实值；示例一律 `***`。
5. FR 编号 `FR-<模块编号>-<三位序号>`；模块编号取目录三位编号。**历史例外**：Android 既有 101–206 模块的 `R1..Rn` 为模块内局部需求编号，按顺序等价 `FR-<模块编号>-00n`；新写/重写模块统一使用 `FR-<模块编号>-NNN`。

---

## 八、快速导航

| 目标读者 | 推荐顺序 |
|---|---|
| 新加入开发者 | `../../specs/constitution.md` → `101-runtime-integration` → `103-webview-shell` |
| Kotlin 宿主开发 | `101` / `103` / `104` / `105` 的 spec+plan → `app/src/main/java/**` |
| Node/构建 | `102-payload-pipeline` → `106-upstream-adaptation` → `012-building-workflow` |
| 插件 | `203` / `204` / `205` / `206` |
| 测试/发布 | `109-regression` → `011-version-2.2.5` → `012-building-workflow` |
