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
