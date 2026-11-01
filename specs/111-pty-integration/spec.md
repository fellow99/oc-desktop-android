# 111-pty-integration —— 引入 node-pty，实现 PTY 能力（spec）

> 状态：🔶 planned（方案稿，见 [`docs/111-PTY实现方案.md`](../../docs/111-PTY实现方案.md)）
> 需求编号：FR-111-NNN（新写模块统一 FR-<模块>-NNN）
> 涉及工程：`oc-desktop-android`（本模块规格**只落入本工程** `specs/111-pty-integration/`，不提交父工程 `specs`）
> 上架库：`io.github.fellow99:node-bridge:0.2.0` / `node-runtime:26.13.0` / `node-pty:26.13.0`（均 Maven Central）
> 上游基线：opencode `v2.2.5`（`9bbb8ce18c`）

## 1. 目标

给 oc-desktop-android 的**进程内 Node**补上真实 PTY 能力（`libpty_node.so`，N-API addon），
进而点亮 opencode Web UI 的**终端面板**（`PersistentPty`），把能力矩阵「D3 终端/PTY」从平台级 ❌ 变为可用，
同时遵守宪法 C2（不隐藏平台真相）/ C6（凭据不落盘）/ D5（conventional commits）等条款。

## 2. 需求与验收判据

| # | 需求（FR） | 验收判据（可证伪） |
|---|---|---|
| FR-111-001 | **库版本升级**：node-bridge→0.2.0、node-runtime→26.13.0、node-pty→26.13.0，均来自 Maven Central | `gradle/libs.versions.toml` 三者一致更新；`node-pty` 与 `node-runtime` **逐字同版本**；APK 内含 `libpty_node.so` 且 `DT_NEEDED libnode.so` |
| FR-111-002 | **引擎升级 Node 24→26 全链路一致**：runtime.lock、build-opencode 目标、smoke、verify-runtime、regression 同步 | `smoke-node26`（--version/serve/health/UI/title/SSE）全绿；`verify-runtime` 对 26.13.0 AAR + `libpty_node.so` 锁值断言通过；负样本正确红 |
| FR-111-003 | **Phase 0 Spike：node-pty 可在进程内 Node 加载并 spawn `/system/bin/sh`** | `require(libpty_node.so)` 得 `spawn`；`spawn("/system/bin/sh")` 交互回环（write→onData 回显）、resize 生效、SIGTERM 语义；探针证据落 `logs/`，加载选型冻结 |
| FR-111-004 | **Web UI 终端可用（Phase B 最小后端）**：进程内 `PersistentPty` 后端替换外部 daemon spawn | 终端按钮进入可用态；终端内 `sh` 交互回显/`ls`/`pwd` 正确；resize 生效；交互 TUI 可渲染；无外部 ELF spawn（PATH 无 `opencode-pty` 仍工作） |
| FR-111-005 | **能力降级诚实**：未实现 op（snapshot/read_rows/rename/handoff）按能力如实降级，不假装支持 | `supports("rename")=false` 等反馈如实；Phase A 前不宣称「跨重启持久化/快照」能力 |
| FR-111-006 | **（Phase A 递进）全功能对齐**：snapshot / checkpoint 回放 / read_rows+光标 / handoff | 终端重连后屏幕恢复、光标正确、多 attachment（controller/observer）语义正确 |
| FR-111-007 | **回归无退化**：既有能力（对话/工作区/工具/看图/持久化）在 Node 26 下不回归 | `scripts/regression.mjs`（Node 26 口径）全绿；既有 e2e 用例复跑通过 |

## 3. 分阶段交付

| 里程碑 | 范围 | 出口证据 |
|---|---|---|
| M0 Spike | FR-111-003；**Web 终端维持禁用** | `logs/` 探针证据 + 加载选型冻结结论 |
| M1 引擎升级 | FR-111-001/002；Node 26.13.0 + node-pty 26.13.0 全链路 | smoke-node26 + verify-runtime 全绿；APK 冒烟 |
| M2 进程内后端（B） | FR-111-004/005；`DaemonTransport` 进程内替换 + 能力降级 | 官方终端可用 + 交互判据全绿 |
| M3 全功能（A） | FR-111-006 | 对齐桌面终端判据 |
| M4 真机轮 | arm64 物理设备复测（PTY 交互/resize/JIT） | `docs/真机验证记录.md` 新轮 |

## 4. 被否决的替代路线（决策留痕）

- **方案 D（编译并 spawn 真 `opencode-pty` ELF）**：受 L1 noexec / 无法 spawn 外部 ELF 硬约束，不可行。
- **方案 C（前端终端改接进程内 `Pty` 服务）**：需大改官方前端、偏离「官方 UI 100% 复用」，不优先；
  `OPENCODE_NODE_PTY_PATH` 钩子仅在 Phase A 对齐时复用。

## 5. 依赖

- 101（运行时集成）/ 102（载荷管线）/ 109（回归）/ 205（pnpm，示意进程内 Node 皆可驱动的先例）；
- 上架契约（只引用不复制）：`../node-bridge-workspace/docs/发布到maven-central.md` §4.2 配对纪律、附录 A；
  绑定加载契约：`../node-bridge-workspace/aosp-node-pty/README.md`。
