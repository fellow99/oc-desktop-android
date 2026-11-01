# 111-pty-integration 技术方案（plan）

> 依据：`docs/111-PTY实现方案.md`。核心洞察：Web UI 终端走 `PersistentPty`（外部 daemon ELF，Android 不可用）；
> `node-pty` 以进程内 N-API addon（`libpty_node.so`）上架，可由进程内 Node 直接加载，**绕开 spawn 外部 ELF 死结**。

## 1. 架构变更

```
 Web UI 终端面板(gui-plugins/terminal)  ── HTTP/SSE ──►  server/handlers/persistent-pty.ts
                                                              │ PersistentPty.Service(core)
                                                              ▼
                                             [In-process PTY 后端] ──替换── daemon spawn + socket
                                                              └─ node-pty (libpty_node.so)
 nativeLibraryDir: libnode.so + libpty_node.so（只读，本进程加载）
```

- **不改官方 UI / 不改服务层路由**；只替换 `PersistentPty` 的传输/执行后端（`makeDaemonTransport`）。
- 用「进程内会话管理器」实现 `DaemonTransport` 契约（`request / requestIfRunning / supports / shutdown / handoff / subscribe`），
  会话直接由 `node-pty` 驱动，无 socket 往返。
- `#persistent-pty-binary` 的 `resolveBinary` 在 Android 形态解析到**内嵌 in-process daemon 入口**（返回「已就绪」标记，跳过外部 spawn）。

## 2. 关键文件与结构

### 2.1 库与配置
- `gradle/libs.versions.toml`：`nodeRuntime="26.13.0"`，新增 `nodePty="26.13.0"`；
- `app/build.gradle.kts`：`runtimeOnly(node.runtime)` + `runtimeOnly(node.pty)`（同版本配对）。

### 2.2 引擎升级面
- `runtime.lock.json`：node=`26.13.0` + 新 SHA + 新增 `node-pty` 段；
- `scripts/build-opencode.mjs`：node24→**node26** 目标；
- `scripts/smoke-node24.mjs` → `smoke-node26.mjs`（改名/新增），`regression.mjs` 同步引用；
- `scripts/verify-runtime.mjs`：增对 `node-pty` AAR `libpty_node.so` 锁值断言。

### 2.3 node-pty 绑定接线（Phase 0 S4 冻结其一）
- **A（推荐）** 宿主预载：`HostCapabilities` 里 `System.loadLibrary("pty_node")`；Node 侧把 node-pty addon 解析覆盖到
  `<nativeLibraryDir>/libpty_node.so`（`OPENCODE_NODE_PTY_PATH` 或自建 require 路径）；
- **B** Node 侧直接 `require(<nativeLibraryDir>/libpty_node.so)`（Node 对 `.so` 绝对路径可 dlopen）。
- 提供**极薄 JS wrapper**：在 node-pty 外包成 opencode 所需 `Proc`/`spawn` 接口（复用官方 `pty/pty.node.ts` 包装形态），
  **不重实现** node-pty。

### 2.4 载荷物化
- node-pty JS wrapper 随 `collect-opencode.mjs`（或新增 collect 步骤）打入载荷（copy，禁 symlink，digest 幂等，遵循「插件物化」纪律）；
- `OPENCODE_NODE_PTY_PATH` / 自建后端 require 路径由 `payload/lib/env.js` 注入（镜像 `OpencodeRuntime.buildEnv`，双处一致）。

### 2.5 后端能力矩阵（Phase B → Phase A）
| op | B | A |
|---|---|---|
| list/get/create | ✅ | ✅ |
| write/resize/input/terminate | ✅ | ✅ |
| subscribe（输出流+exit） | ✅ | ✅ |
| control/rename | rename 降级（supports=false） | ✅ |
| snapshot/read_rows/光标 | read_rows 降级；snapshot ⬜ | ✅ |
| 跨重启 handoff/checkpoint | ⬜（不宣称） | ✅ |

## 3. 测试策略
- host：`smoke-node26`（冒烟四判据 + title）· `verify-runtime`（26.13.0 + node-pty 锁值）· `regression`（Node 26 口径）。
- 设备：探针（PTY 回环/加载选型）→ 终端面板交互判据（截图/HTTP，WebView 内容不进 uiautomator 树）→ 既有 e2e 回归。
- `test-cases.md` 见同目录；判据均可证伪，凭据实值**不落盘**。

## 4. 风险与缓解
- **R1 libpty 加载失败**（ABI/SELinux/只读）→ M0 先证，不过则不进入 M1/M2，如实降级；
- **R2 Node 26 回归** → 退路 24.22.1 对；引擎升级与 PTY 解耦可独立回滚；
- **R4 后端工作量低估**（快照/回放重）→ B→A 分阶段控范围，B 只做最小契约+降级。

## 5. 兼容与约束
- ABI 仅 arm64-v8a（与 runtime lock 一致）；minSdk 24；`useLegacyPackaging=false`（16KB 对齐）；
- 不改上游（如需动上游，新增 `0012-pty-inprocess.patch` 并配 README，遵守幂等纪律 C4/D）。
