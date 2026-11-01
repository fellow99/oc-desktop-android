# 111-pty-integration 任务清单（tasks.md）

> 依赖序执行；每个任务完成即按 Conventional Commits 前缀提交（feat/fix/test/build/docs/chore/refactor/perf）。
> 里程碑：M0 Spike → M1 引擎升级 → M2 进程内后端(B) → M3 全功能(A) → M4 真机轮。

## 阶段 1 · 准备（Setup）

- [ ] 1.1 〔docs〕确认 `docs/111-PTY实现方案.md` 与 `specs/111-pty-integration/*` 就位并录入 `specs/SPECS_CHECKLIST.md`（D6 规格先行）
- [ ] 1.2 〔build〕核对上架库可达：`node-runtime:26.13.0` / `node-pty:26.13.0` AAR 在 repo1 可解析（§4.2 配对纪律 curl 判据）

## 阶段 2 · M0 Spike（FR-111-003）

- [ ] 2.1 〔test〕拉设备：真机优先，否则 `avdmanager`/emulator 拉起 `sdk_gphone64_x86_64`（api 36/37）
- [ ] 2.2 〔feat〕探针：进程内 Node `require(<nativeLibraryDir>/libpty_node.so)` 能否加载、`typeof spawn==="function"`
- [ ] 2.3 〔feat〕探针：`node-pty.spawn("/system/bin/sh")` 交互回环（write→onData 回显、resize、kill/SIGTERM）
- [ ] 2.4 〔feat〕冻结加载选型（A 预载 vs B 直接 require；S4）；`web UI 终端维持禁用`（不翻转 `capabilities`）
- [ ] 2.5 〔docs〕探针证据落 `logs/<date>-<n>/PTY_SPIKE.md`（脱敏）

## 阶段 3 · M1 引擎升级（FR-111-001/002）

- [ ] 3.1 〔build〕`gradle/libs.versions.toml`：nodeRuntime→26.13.0、新增 nodePty=26.13.0
- [ ] 3.2 〔build〕`app/build.gradle.kts`：`runtimeOnly(node.pty)`（与 runtime 同版本）
- [ ] 3.3 〔build〕`runtime.lock.json`：26.13.0 + 新 SHA + node-pty 段
- [ ] 3.4 〔build〕`scripts/build-opencode.mjs` node24→node26 目标；`smoke-node24.mjs`→`smoke-node26.mjs`
- [ ] 3.5 〔build〕`scripts/regression.mjs` 引用新 smoke；`verify-runtime.mjs` 增 node-pty 锁值断言
- [ ] 3.6 〔test〕`collect-opencode.mjs` + `smoke-node26.mjs` + `verify-runtime.mjs` + `regression.mjs` 全绿（含负样本红）
- [ ] 3.7 〔build〕`./gradlew :app:assembleDebug`；APK 内含 `libnode.so` + `libpty_node.so`；冒烟装机

## 阶段 4 · M2 进程内 PersistentPty 后端（B）（FR-111-004/005）

- [ ] 4.1 〔feat〕node-pty JS wrapper 物化（载荷内，copy+digest 幂等；`payload/lib/env.js` 注入 require 路径）
- [ ] 4.2 〔feat〕进程内 `DaemonTransport` 替换（list/get/create/write/resize/input/terminate/subscribe）；`resolveBinary` 指向内嵌入口
- [ ] 4.3 〔feat〕能力降级诚实：rename/snapshot/read_rows 按能力反馈，不假装支持
- [ ] 4.4 〔test〕设备：终端按钮进入可用态；`sh` 交互回显/ls/pwd；resize 生效；无外部 ELF spawn 反证
- [ ] 4.5 〔test〕既有 e2e（对话/工作区/工具/看图/持久化）在 Node 26 下回归不退化（`regression.mjs`）

## 阶段 5 · M3 全功能（A）（FR-111-006）

- [ ] 5.1 〔feat〕snapshot / checkpoint 回放 / read_rows+光标
- [ ] 5.2 〔feat〕rename / control / 多 attachment（controller/observer）
- [ ] 5.3 〔feat〕跨重启 handoff（复用 `OPENCODE_NODE_PTY_PATH` 对齐机制）
- [ ] 5.4 〔test〕对齐桌面终端判据（重连恢复屏幕/光标/多角色）

## 阶段 6 · M4 真机轮（FR-111-007）

- [ ] 6.1 〔test〕arm64 物理设备复测：PTY 交互、resize、JIT/WASM、首启分解
- [ ] 6.2 〔docs〕`docs/真机验证记录.md` 新轮登记（脱敏；证据归档 `docs/evidence/`）

## 阶段 7 · 收尾

- [ ] 7.1 〔docs〕能力清单 `docs/安卓环境能力清单-*.md` 更新：D3 终端/PTY 状态 + ABI/版本
- [ ] 7.2 〔docs〕回填 `specs/SPECS_CHECKLIST.md` 与 as-built 判据核录
