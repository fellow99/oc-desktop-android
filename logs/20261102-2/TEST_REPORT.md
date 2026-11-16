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
| TC-301 终端可用态（capabilities） | ✅ | 官方 API create 返回 running 真 pid；**GUI 终端面板实测可用**（截图） |
| TC-302 终端 sh 输出 | ✅ | API list `output.tail>0`；**GUI 面板提示符 `lithium:/data/data/…`、`pwd`/`echo hello_pty_ok` 正确回显与执行**（截图 term14） |
| TC-304 无外部 ELF spawn 反证 | ✅ | 进程内守护（inject 拦截 spawn→进程内 daemon+Unix socket），PATH 无 `opencode-pty` 仍工作 |
| TC-305 能力降级诚实 | ✅ | snapshot/read_rows/rename 按能力如实（含 `supports("rename")`）；未宣称跨重启持久化 |
| 服务端日志 | ✅ | server.log：「PTY 进程内模式已启用（inject + OPENCODE_NODE_PTY_PATH=…/node-pty.js）」 |

> 补充：构建配置由「ohos 打桩硬禁用」改为 0012 补丁 `android` 条件（`#pty`/`#persistent-pty-binary` → node 变体）；修复守护 socket 超 AF_UNIX sun_path(108B) 的 `listen EINVAL`。

### 三bis、GUI 终端面板白屏/断连根治（systematic-debugging + CDP 取证，20261103）

真机 终端面板原为**白屏**；逐步取证定位并修复 3 个叠加根因（提交 `ed1df23`→`1576e88`）：

| # | 根因 | 现象 | 修复 |
|---|---|---|---|
| 1 | node-pty `fork` 传 `uid/gid=0`，非 root 应用 `setgid(0)` EPERM → pty.cc `_exit(1)`，shell 从未 exec（M0 的"echo"仅为 PTY 行规回显，误报） | 无提示符/打字无反应 | `fork` 改 `uid/gid=-1` |
| 2 | `fs.createReadStream(null,{fd})` 在非阻塞 PTY fd 上遇 `EAGAIN` 即终止 → 输出停流 | 命令输出不回流 | 改 `tty.ReadStream(fd)`（node-pty 原样） |
| 3 | 终端 shell 用 `/bin/sh`（Android 无，仅 `/system/bin/sh`）→ `execvp(3) failed` | shell 起不来 | 注入 `OC_SHELL_FALLBACK=/system/bin/sh`（0006 补丁 fallback 读它；env.js + buildEnv 双处） |
| 4 | 进程内守护 live 输出帧缺官方 daemon 必需的 4B 长度前缀 → `daemon.ts` 帧解码错位 → 流报错 → WS 关闭 | **"Terminal disconnected"** | 输出帧补 `[len][0x00][start8][end8][data]` |
| 5 | `terminate` 未从 sessions 删除 | 删除后 tab 残留 | terminate 删除会话 |

**验证（截图 term12–14）**：终端面板显示提示符 `lithium:/data/data/top.fellow99.oc.OCDesktopAndroid/files/…`，
输入 `pwd` → 工作区路径，`echo hello_pty_ok` → `hello_pty_ok`，换行/光标均正常 ⇒ **完全交互**。
（注：旧 daemon 遗留的"终端 1"是 stale tab，应用重启即清净。）

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
- **GUI 终端面板已实测可用（20261103）**：经 systematic-debugging + CDP 取证修复 5 个根因（shell 路径/uid-gid/EAGAIN/输出帧长度前缀/terminate），截图 term12–14 证实提示符 + `pwd`/`echo` 全交互。
- 残余/open：M3（快照 checkpoint/read_rows 全量对齐、多 attachment 角色、跨重启 handoff）与 M4（多机型 PTY 全项/resize/长时）列入后续。
- 凭据：key 实值 0 落盘；扫描见 C6 自检（TC-501）。
