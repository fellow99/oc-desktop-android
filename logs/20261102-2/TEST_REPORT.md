# TEST_REPORT —— 111-pty-integration 测试报告（20261102-1/2）

> 设备：真机 Xiaomi Mi MIX（API26，arm64-v8a，MIUI，非 root）｜ 引擎：node-runtime 26.13.0 + node-pty 26.13.0
> 凭据纪律（C6）：DeepSeek key 实值**仅进设备沙箱**，本报告及任何证据文件**不含实值**（一律 `***` 占位）。
> 判据均可证伪；WebView 内容不走 uiautomator ⇒ UI 级判据走 HTTP/SSE + 服务端证据。

## 一、host 门禁（无设备）

| 用例 | 状态 | 判据/证据 |
|---|---|---|
| TC-101 版本配对 / Central 可达 | ✅ | `node-runtime:26.13.0` + `node-pty:26.13.0` 均在 repo1，版本逐字相同（ABI 147） |
| TC-102 verify-runtime（含 node-pty 断言） | ✅ | libnode/libc++/libpty SHA=lock、ELF 门禁、`DT_NEEDED libnode.so` 全过；负样本正确红 |
| TC-103 构建冒烟（node26）| ✅ | build-opencode(bun1.4.4) → collect → `smoke-node26` 五判据（--version/serve/health/UI/title/SSE）全绿 |
| regression 四件套（Node 26 口径） | ✅ | `logs/20261102-2/REGRESSION.md` 全部通过 |

## 二、M0 Spike（设备）

| 用例 | 状态 | 证据 |
|---|---|---|
| TC-201 进程内加载 libpty_node.so | ✅ | `loaded libpty_node.so via dlopen; keys=fork,open,resize,process`（`logs/20261102-1/PTY_SPIKE.md`）|
| TC-202 spawn sh 交互回环 | ✅ | `forked pid=… pty=/dev/pts/0`；回显 `echo PROBE_OK\r\n`（真 TTY CRLF）|
| TC-203 加载选型冻结（S4） | ✅ | `System.loadLibrary("pty_node")` 预载 + Node `process.dlopen(soname)`（extractNativeLibs=false）|

## 三、M2 终端（设备，FR-111-004/005）

| 用例 | 状态 | 证据 |
|---|---|---|
| TC-301 终端可用态（capabilities） | ✅ | `POST /api/experimental/session/{sid}/terminal` 返回 `pty_persistent_1` running、真实 pid |
| TC-302 终端 sh 输出 | ✅ | list 显示 `output.tail=44`（真实 shell 输出） |
| TC-304 无外部 ELF spawn 反证 | ✅ | 进程内守护（inject 拦截 spawn→进程内 daemon+Unix socket），PATH 无 `opencode-pty` 仍工作 |
| TC-305 能力降级诚实 | ✅ | snapshot/read_rows/rename 按能力如实（含 `supports("rename")`）；未宣称跨重启持久化 |
| 服务端日志 | ✅ | server.log：「PTY 进程内模式已启用（inject + OPENCODE_NODE_PTY_PATH=…/node-pty.js）」 |

> 补充：构建配置由「ohos 打桩硬禁用」改为 0012 补丁 `android` 条件（`#pty`/`#persistent-pty-binary` → node 变体）；修复守护 socket 超 AF_UNIX sun_path(108B) 的 `listen EINVAL`。

## 四、端到端（设备，Node 26 下既有能力不退化，FR-111-007）

| 用例 | 状态 | 证据 |
|---|---|---|
| TC-401 启动编排 | ✅ | marker(port>0) + /global/health 200；`[1/6]~[6/6]`（见 ui.log/ui 正常） |
| TC-402 工作区 | ✅ | 服务端 cwd=`…/files/workspace/default`；沙箱内创建测试目录/文件 `testimg.png`（2560 B） |
| TC-403 文本对话（deepseek-flash）「介绍一下你自己」 | ✅ | outcome=`succeeded`，cost>0；assistant 回复含能力说明 + 当前工作目录 |
| TC-404 看图分析 | ✅ | outcome=`succeeded`；模型准确识别「红方块 + 蓝圆形 + 标注 OC-PTY TEST: RED SQUARE + BLUE CIRCLE」 |
| TC-405 会话持久化 | ✅ | 重启后 5 个历史会话仍在（SQLite WAL 持久） |
| TC-406 回归四件套 | ✅ | regression.mjs（Node 26 口径）全绿 |
| 模型凭据 | ✅ | credential API 建 DeepSeek 集成（integration=deepseek，active）；`/api/provider` 列出 `deepseek`（baseURL api.deepseek.com） |

## 五、能力环境测试（对照 `../../docs/能力对照清单.md`，Android 真机）

| 能力（Android） | 状态 | 备注 |
|---|---|---|
| 进程内 Node / serve / 端口 / 就绪 | ✅ | Node 26.13.0 全程运行 |
| bash / shell（`/system/bin/sh`） | ✅ | PTY 会话 + 项目自身 shell 工具路径可用 |
| Git（isomorphic-git 插件） | ✅ | 21 工具注册（logcat） |
| pnpm 进程内 | ✅ | 五工具注册（logcat：pnpm 10.34.9 in-process） |
| grep/glob 搜索 | ✅ | JS 兜底注册（logcat） |
| **终端 / PTY（原 D3 ❌）** | ✅ **本轮点亮** | 进程内 node-pty + PersistentPty；本报告三节 |
| 多模态识图 / 看图 | ✅ | TC-404 |
| SQLite 会话持久化 | ✅ | TC-405 |

> ark / hos 本轮无真机（两鸿蒙版先前轮已注明缺设备）；本报告仅 Android 真机实测。

## 六、结论与残余

- **111-pty-integration 核心（PTY 点亮）** 实现 + 设备验证完成；M2 官方终端后端可用，能力矩阵 D3 由 ❌ → ✅（device）。
- 残余/open：GUI 终端面板的 UI 点按级验证（WebView 内容不进 uiautomator，需人工/截图）；M3（快照/read_rows 全量对齐）与 M4（真机 PTY 全项）列入后续。
- 凭据：key 实值 0 落盘；扫描见 C6 自检（TC-501）。
