# oc-desktop-android 宪法（Constitution）

> **地位**：本文件是本工程的**最高约束**。`specs/**` 的任何 spec/plan 与实现，若与本文冲突，以本文为准。
> **来源**：条款从 `docs/000-工程规划.md`（v0.2）与参考工程（`aosp-node-bridge` 库契约、`oc-desktop-ark` 同构落地、真机教训）中**抽取**，不是发明。
> **修改**：改本文必须同时改规划的对应章节，并在 `specs/SPECS_CHECKLIST.md` 登记影响面。

## 一、六条核心原则

### C1 壳薄、契约硬

Kotlin 宿主**只**做四件事：**启动编排 / 观测 / 宿主能力 / 渲染**。业务逻辑一律在 Node 侧（opencode 服务端）。

- 禁止在 Kotlin 里实现会话、消息、模型、工具调用等业务语义。
- WebView ⇄ Node 的**唯一**业务通道是同源 HTTP/SSE；**不新增** JS 注入桥、自定义协议或 IPC 载体。
- 宿主能力只经 `rt.host.register`（JSON 入出，名字必须已注册；未注册必须如实报错，不得静默返回空）。

### C2 不隐藏平台真相

平台做不到的事，必须让用户看见，不许静默降级、不许假装成功。

- 终端/PTY、内容搜索降级、pnpm 忽略脚本等缺口，UI 必须给出可读原因。
- 每个启动阶段都有**中文阶段文案 + 结构化取证**（`files/logs/ui.log`）；失败必须落到错误页（阶段+原因+日志尾）。
- `rt.start()` 返回 ok 只代表**已投递**；就绪必须有独立判据（marker + `/global/health` 探活）。

### C3 谁写谁读

需要 Node 读取的文件，由 **Node 自己写/解包**；Kotlin 不解释业务载荷。

- 载荷归档由 Kotlin 做**字节拷贝**（incoming/），解包、SHA-256 校验、marker 维护全部在 Node（`payload/unpack.js`）。
- marker 由写方原子写（tmp+rename）；读方只读。
- 日志分文件：桥写 `node_bridge.log`/`app.log`，本工程写 `logs/server.log`（Node）与 `logs/ui.log`（Kotlin），互不共文件。

### C4 不改上游

对 `opencode` 优先用现成机制（env/条件变体/配置）；确需修改只允许**幂等补丁**（106 模块），不做长期分叉。

- 补丁判据：`git apply --reverse --check` 通过；不落入既有补丁上下文；基线守卫（HEAD=锁定 tag 且工作树干净）。
- ⚡ as-built 现状：v2.1.2 stock bundle 在 Android 上**零补丁**即可 serve（JIT 主线），106 的五补丁仅在触发其针对缺口时引入。

### C5 失败可见、判据可证伪

每条验收写成「能观测到 X」（HTTP 状态/marker 内容/屏幕文案），不接受「看起来好了」。

- 就绪=marker(port>0) ∧ health 200 ∧ state=Running，三者同时成立。
- 每轮真机结论必须落 [`docs/真机验证记录.md`](../docs/真机验证记录.md)（环境/步骤/判据/证据），证据存 `docs/evidence/`。

### C6 安全与隐私边界

- 凭据（连接密码/模型 Key）只存应用沙箱（`MODE_PRIVATE` / credential store）；**绝不**写日志、写文档、写截图。
- 文档/证据落盘前必须脱敏（key/口令/auth_token 实值 0 命中）；诊断输出对 URL 一律 `?auth_token=***`。
- 权限最小化：仅 `INTERNET`+`ACCESS_NETWORK_STATE`；不申请存储/安装/悬浮窗（§10）。
- 测试用模型凭据只进设备沙箱；轮换/撤销由用户在设置页操作。

## 二、工程纪律

| # | 纪律 | 说明 |
|---|---|---|
| D1 | 版本钉死 | gradle/libs.versions.toml + runtime.lock.json；禁止 floating 依赖 |
| D2 | 引擎 lock 单一事实源 | aosp-node-runtime 仓 `runtime.lock.json`；本仓只镜像引用 |
| D3 | 探针即弃 | Phase 0 探针（debug 源集）验证后整目录删除（G9 PoC 清理）；本迭代已执行 |
| D4 | 载荷产物不入库 | `assets/opencode-dist.tar.gz` 由脚本生成 + gitignore；缺载荷=明确错误页 |
| D5 | 提交规范 | Conventional Commits 前缀（feat/fix/docs/chore/refactor/test/build/ci/perf）；不带 AI 署名脚注 |
| D6 | 规格先行于扩展 | 新功能先进 `specs/<模块>/spec.md`（做什么+判据）再实现；规格与实现冲突时改规格并登记 |
