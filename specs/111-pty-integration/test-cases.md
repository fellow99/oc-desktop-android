# Test Cases: 111-pty-integration（引入 node-pty，实现 PTY 能力）

> 编制：按 `spec.md` + `plan.md` + `docs/111-PTY实现方案.md`。
> **纪律**：判据可证伪；WebView 内容不进 uiautomator 树 ⇒ UI 级判据走**截图 + HTTP/SSE**。
> **凭据纪律（C6）**：DeepSeek key 只进**设备沙箱设置页**，任何用例文档/日志/截图**不得含实值**（一律以 `***` 占位）。
> 状态列：待测时留空，执行时填 PASS / FAIL / SKIP。

---

## 一、host 侧门禁（无设备）

### TC-101: node-runtime/node-pty 版本配对与 Central 可达
- **Priority**：P1 ｜ **Type**：Build/Compliance
- **Precondition**：联网；repo1 可达
- **Steps**：
  1. `curl` 断言 `node-runtime/26.13.0/*.aar` 与 `node-pty/26.13.0/*.aar` 返回 200；
  2. 核对 `node-pty` 与 `node-runtime` 版本**逐字相同**（26.13.0）。
- **Expected**：两者均在 Central；版本一致（配对纪律 §4.2）。
- **Actual**：   **Status**：

### TC-102: verify-runtime（Node 26 + node-pty）全绿与负样本
- **Priority**：P1 ｜ **Type**：Build/Regression
- **Precondition**：`runtime.lock.json` 已更新到 26.13.0 + node-pty 段
- **Steps**：`node scripts/verify-runtime.mjs`；再篡改 `libpty_node.so` 内容复跑（负样本）
- **Expected**：正样本 exit 0 全绿；篡改样本 exit 2 正确红。
- **Actual**：   **Status**：

### TC-103: 构建冒烟（Node 26 口径）
- **Priority**：P1 ｜ **Type**：Build
- **Precondition**：载荷已构建
- **Steps**：`node scripts/build-opencode.mjs`（node26 目标）→ `node scripts/collect-opencode.mjs` → `node scripts/smoke-node26.mjs`
- **Expected**：`--version`/serve/health/UI/title/SSE 全绿。
- **Actual**：   **Status**：

---

## 二、M0 Spike（设备）

### TC-201: 进程内加载 libpty_node.so
- **Priority**：P1 ｜ **Type**：Spike/Functional
- **Precondition**：APK 含 `libpty_node.so` 且装机
- **Steps**：进程内 Node `require(<nativeLibraryDir>/libpty_node.so)`；打印 `typeof spawn`
- **Expected**：加载成功，`typeof spawn === "function"`；不抛 ABI/SELinux 错误。
- **Actual**：   **Status**：

### TC-202: node-pty.spawn("/system/bin/sh") 交互回环
- **Priority**：P1 ｜ **Type**：Spike/Functional
- **Steps**：`spawn("/system/bin/sh")`；`write("echo hi\n")`；观察 `onData`；`resize(120,30)`；`kill("SIGTERM")`
- **Expected**：回显 `hi`；resize 不抛错；exit 事件带 signal/exitCode。
- **Actual**：   **Status**：

### TC-203: 加载选型冻结（S4）
- **Priority**：P2 ｜ **Type**：Decision
- **Steps**：对比 ①`System.loadLibrary("pty_node")` 预载+覆盖 addon 路径 ② Node 侧直接 `require(.so)`
- **Expected**：冻结其一并记录理由到 `logs/.../PTY_SPIKE.md`。
- **Actual**：   **Status**：

---

## 三、M2 终端面板（设备，FR-111-004/005）

### TC-301: 终端按钮进入可用态
- **Priority**：P1 ｜ **Type**：Functional
- **Precondition**：M2 后端已装；服务就绪
- **Steps**：打开 Web UI 终端面板；观察 `capabilities.persistentPty !== false`
- **Expected**：终端入口可用（截图取证）。
- **Actual**：   **Status**：

### TC-302: 终端内 sh 交互
- **Priority**：P1 ｜ **Type**：Functional
- **Steps**：终端内依次 `pwd`、`ls`、`echo smoke-pty`；键入交互
- **Expected**：回显正确、cwd 为工作区根、exit/换行语义正确（截图）。
- **Actual**：   **Status**：

### TC-303: resize 生效
- **Priority**：P2 ｜ **Type**：Functional
- **Steps**：旋转/拖拽改变列×行，观察 `resize` 送达
- **Expected**：`$COLUMNS`/`$LINES` 随之变化；无断流。
- **Actual**：   **Status**：

### TC-304: 无外部 ELF spawn 反证
- **Priority**：P1 ｜ **Type**：Security/Platform
- **Precondition**：PATH 无 `opencode-pty`
- **Steps**：正常使用终端；logcat 无“spawn 外部 ELF”失败
- **Expected**：终端可用，证明走进程内后端（未 spawn 外部守护）。
- **Actual**：   **Status**：

### TC-305: 能力降级诚实
- **Priority**：P2 ｜ **Type**：Edge Case
- **Steps**：触发 rename/snapshot/read_rows（Phase B 未实现）
- **Expected**：如实反馈不支持/降级，不假装成功（符合 C2）。
- **Actual**：   **Status**：

---

## 四、端到端回归（Node 26 下既有能力不退化，FR-111-007）

> 模型凭据经设置页录入（凭据**不落盘**）。

- **TC-401 启动编排**：安装→启动，`[1/6]~[6/6]` + marker(port>0) + health 200 + UI 上屏（截图）。P1
- **TC-402 工作区**：创建/导入工作区；服务端 `cwd` 指向工作区根。P1
- **TC-403 文本对话**：新建会话（`deepseek/deepseek-flash`）发「介绍一下你自己」→ assistant 回复、finish=stop。P1
- **TC-404 看图分析**：附图片 → 模型识别并回复图内真实内容 + 工具调用。P1
- **TC-405 会话持久化**：重启后历史会话仍在。P2
- **TC-406 回归四件套**：`node scripts/regression.mjs`（Node 26 口径）全绿。P1

**Actual**（逐项填 PASS/FAIL/SKIP）：TC-401 __ TC-402 __ TC-403 __ TC-404 __ TC-405 __ TC-406 __

---

## 五、凭证与脱敏（C6）

- TC-501：全库扫描明文凭据（key/口令/auth_token 实值）0 命中。P1
- TC-502：诊断/日志对 URL 一律 `?auth_token=***`；截图不落 key。P1
