# overall-spec —— 整体规格（做什么 + 验收判据）

> 更新：2026-10-28 · 技术无关；判据可证伪。实现细节见 [overall-plan.md](./overall-plan.md)。

## 1. 产品规格（v1 目标逐条验收）

| # | 能力 | 规格 | 验收判据 | 状态 |
|---|---|---|---|---|
| S1 | 能起 | APK 可安装、可启动，无白屏无闪退；加载页有阶段文案；就绪后进入 opencode Web UI | 屏幕依次出现 [1/6]~[6/6] 文案；最终呈现 v2 UI 首页（可截图） | ✅ 实测 |
| S2 | 能对话 | 新建会话 → 发消息 → 流式回复 → 会话持久化 | API/UI 建会话发消息，收到 assistant 文本（finish=stop）；重启应用后会话仍在（DB） | ✅ 实测（SSE 流式由上游 UI 消费） |
| S3 | 能配模型 | 设置页可录入 provider 凭据；模型可选 | 录入 DeepSeek key 后 `/api/provider` 出现 deepseek 且默认模型 `deepseek/deepseek-flash` | ✅ 实测（凭据经 credential store） |
| S4 | 能看图 | 会话可附图片，多模态模型能描述图片内容 | 附截图提问，回复包含图中真实内容 | ✅ 实测 |
| S5 | 能用工具 | 上游文件读写/编辑/搜索工具可用；`bash` 工具经 `/system/bin/sh` | 会话中工具调用可见且执行成功 | ✅ 实测（shell 工具在 e2e 中被模型自主调用并成功） |
| S6 | 能选工作区 | 默认沙箱工作区为项目根；（203）SAF 导入/导出 | 服务端 cwd=沙箱工作区；`/api/provider.location` 同值 | ✅ 默认工作区实测 / ⬜ 203 |
| S7 | 能用 Git | isomorphic-git 插件（108） | 规格见 [108-git-plugin](./108-git-plugin/spec.md) | ⬜ |
| S8 | 能用 pnpm | 进程内 pnpm 工具面（205） | 规格见 [205-pnpm-plugin](./205-pnpm-plugin/spec.md) | ⬜ |
| S9 | 失败可见 | 任何一步失败在 UI 留下可截图文字（阶段+原因+日志尾+重启提示） | 制造失败（删载荷）→错误页呈现三要素 | ✅ 实测 |
| S10 | 能分发 | 侧载 APK 可复现；Play AAB 评估（Phase 3） | assembleDebug/Release 产物可安装 | ✅ debug 实测 / ⬜ AAB |

## 2. 非目标（v1 不做）

不做 opencode fork；不内嵌浏览器内核；不申请全局存储；不承诺 PTY/终端面板；插件不在线安装；不做 phone 专属优化；不与 ark/hos 共包名签名数据（规划 §0.3）。

## 3. 模块规格索引

| 模块 | 做什么 | 状态 |
|---|---|---|
| [101 运行时接入](./101-runtime-integration/spec.md) | 双包接线、六步编排、就绪判据、关停语义 | ✅ as-built |
| [102 载荷流水线](./102-payload-pipeline/spec.md) | 上游产物 → tar.gz → APK assets → Node 自解包（幂等） | ✅ as-built |
| [103 WebView 壳](./103-webview-shell/spec.md) | WebView 配置、围栏、历史、错误页、旋转免重建 | ✅ as-built |
| [104 宿主能力](./104-host-capabilities/spec.md) | host 桥能力面（echo/perm/openExternal/notify/saf） | ✅ as-built（2 stub） |
| [105 鉴权](./105-auth/spec.md) | 密码生命周期、auth_token 首屏、模型凭据边界 | ✅ as-built |
| [106 上游适配](./106-upstream-adaptation/spec.md) | 幂等补丁五件套（按需引入） | ⬜ |
| [107 合规](./107-compliance/spec.md) | §13 清单（许可/隐私/政策/PoC 清理） | ⬜ |
| [108 Git 插件](./108-git-plugin/spec.md) | isomorphic-git 工具面 + VCS 覆盖 + 凭据页 | ⬜ |
| [109 回归基线](./109-regression/spec.md) | 四件套复跑 | ⬜ |
| [110 jitless](./110-jitless/spec.md) | 诊断形态（不进产品） | ⬜ |
| [111 基线迁移](./111-version-2.1.2/spec.md) | 上游升级核对单 | ⬜ |
| [203 工作区选择器](./203-workspace-picker/spec.md) | 多工作区 + SAF 导入制 | ⬜ |
| [205 pnpm 插件](./205-pnpm-plugin/spec.md) | 进程内 pnpm 全量工具面 | ⬜ |

## 4. 本迭代（000-scaffold）范围声明

本迭代交付：**基础脚手架**（101/102/103/104/105 的最小可用实现）+ **Phase 0 探针裁决**（P0-A/B/D/E/J/K，测后清理）+ **规范文档体系** + **端到端连通证明**（DeepSeek 对话/看图/工作区）。不包含：106-111、203、205 的功能面，签名发布流水线，UI 深度打磨。
