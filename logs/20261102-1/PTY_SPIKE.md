# M0 Spike —— node-pty 在进程内 Node 的可用性（PTY_SPIKE）

> 轮次：20261102-1（111-pty-integration 开发日志）｜ 设备：真机 Xiaomi Mi MIX（Android 8.0/API26，arm64-v8a，MIUI 定制 ROM，非 root）
> 判据：均可证伪；无凭据落盘。状态：**PASS**（S1/S2 ✅，S4 冻结，S3 部分证）
> 对应：spec FR-111-003 / test-cases TC-201/TC-202/TC-203

## 1. 环境
- 引擎：`node-runtime:26.13.0`（libnode.so）+ `node-pty:26.13.0`（libpty_node.so），Maven Central 配对（ABI 147）
- 宿主：`OpencodeRuntime` 进程内 Node，入口指向一次性 `payload/pty-probe.js`（探针已按 D3 删除）
- nativeLibraryDir：`/data/app/<pkg>/lib/arm64`

## 2. 探针证据（logcat NODE_BRIDGE 摘录）
```
node=v26.13.0 platform=android arch=arm64
loaded libpty_node.so via dlopen; keys=fork,open,resize,process; typeof fork=function
forked pid=20791 fd=140 pty=/dev/pts/0
DATA "setgid(2) failed.: Operation not permitted\r\necho PROBE_OK\r\n"
RESULT PASS interactive-echo
```
- `pty=/dev/pts/0` ⇒ 拿到**真 PTY 从端**（非伪 pipe）。
- 写入 `echo PROBE_OK\n` 后从 PTY 主端回读 `echo PROBE_OK\r\n` ⇒ 交互回环 + CRLF 行规成立（真 TTY 烙印）。

## 3. 关键结论（S4 冻结）
| 项 | 结论 |
|---|---|
| S1 加载 | ✅ `libpty_node.so` 可在进程内 Node 26.13.0 dlopen |
| S2 spawn sh | ✅ `fork('/system/bin/sh',…)` 起真 PTY（/dev/pts/0） |
| S3 交互 | ✅ 交互回环 + CRLF；setgid 警告为 toybox 非 root 固有，非 PTY 故障 |
| S4 加载选型 | **冻结**：`extractNativeLibs=false` ⇒ nativeLibraryDir 无实体文件。定案 = ① 宿主 `System.loadLibrary("pty_node")` 预载（Android linker 按 soname 从 APK 映射）＋ ② Node 侧 `process.dlopen(mod,'libpty_node.so')`(soname) |
| 补充 | native API 为 `fork/open/resize/process`（无 `spawn`）；`spawn` 由 node-pty JS wrapper 构建；`env` 须为 `K=V` 字符串数组；`helperPath` 须传 `''` |

## 4. 对 M2 的启示
- 需随载荷物化 node-pty **JS wrapper**（把 native `fork/open/resize` 包装成 `spawn`/`onData`/`onExit`，对齐 opencode 的 `Proc` 接口）。
- `OC_NATIVE_LIB_DIR` env 注入 + 宿主预载是绑定接线基线。
- setgid 警告可能需要文档向用户说明（非 root 下 toybox sh 的行为），非阻断。
