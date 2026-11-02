# DEV_CHECKLIST —— 111-pty-integration 开发日志

> 里程碑 M1 引擎升级：node-runtime 24.22.1 → 26.13.0 + 引入 node-pty:26.13.0。
> 设备：真机 Xiaomi Mi MIX（Android 8.0/API26，arm64-v8a，MIUI 定制 ROM，非 root）。

## M1 任务状态
- [x] 3.1 gradle/libs.versions.toml：nodeRuntime→26.13.0、nodePty=26.13.0
- [x] 3.2 app/build.gradle.kts：runtimeOnly(node.pty)
- [x] 3.3 runtime.lock.json：26.13.0 + node-pty SHA + 门禁
- [x] 3.4 build-opencode.mjs node26 目标；smoke-node24→26
- [x] 3.5 regression/verify-branding 引用；verify-runtime 增 node-pty 断言
- [ ] 3.6 collect/smoke/verify/regression 全绿
- [ ] 3.7 assembleDebug + APK 含 libnode.so+libpty_node.so + 装机冒烟

## M0 Spike（FR-111-003）— ✅ PASS（真机 Mi MIX API26，20261102-1）
- [x] S1 加载：libpty_node.so 进程内 dlopen（node v26.13.0 arch=arm64）
- [x] S2 spawn sh：fork('/system/bin/sh') → pty=/dev/pts/0 真 PTY
- [x] S3 交互：回环 + CRLF（echo PROBE_OK）
- [x] S4 选型冻结：System.loadLibrary("pty_node") 预载 + Node process.dlopen(soname)
- 证据：logs/20261102-1/PTY_SPIKE.md

## M1 引擎升级更新
- [x] 3.7a assembleDebug：APK 含 libnode.so(26.13.0, 87.7MB) + libpty_node.so(71KB)；verify-runtime 全绿
- [ ] 3.6 待：payload(bun) 重建 + smoke-node26 + regression（需 host node26 口径）
- [ ] 3.7b 待：装机完整应用冒烟（需 payload 重建后）

## M2 进程内 PersistentPty 后端（FR-111-004/005）— 代码落地
- [x] 4.1 node-pty 适配 payload/lib/node-pty.js（soname dlopen + Proc 接口；M0 定稿）
- [x] 4.2 进程内守护 payload/lib/pty-inprocess.js（inject 拦截 spawn→进程内 daemon + Unix socket JSON 帧协议 + createHandler）
- [x] 4.3 opencode-server.js ⑤b 接线；env.js OPENCODE_PTY_INPROCESS=1；OpencodeRuntime preload+ensurePayload+buildEnv
- [x] host 单测：createHandler 全 op（ping/own/create/list/write/rename/snapshot/read_rows/terminate/shutdown/unknown）PASS
- [ ] 4.4 设备端终端面板可用性（需 payload bundle 重建 + 全应用运行）
- [ ] 4.5 既有 e2e 回归（Node 26）
