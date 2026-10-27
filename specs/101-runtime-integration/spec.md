# 101-runtime-integration —— 运行时接入（spec）

> 状态：✅ as-built（2026-10-28）· 引用：规划 §5.1/§4.2、宪法 C1/C2/C5 · 实现：`app/src/main/java/org/fellow99/oc/desktop/android/{App,OpencodeRuntime,App,Diagnostics}.kt`

## 1. 目标

把 `io.github.fellow99:node-bridge` + `node-runtime` 双包接进 Android 应用，在**应用自身进程内**拉起 Node 并跑通 opencode serve；失败全程可见。

## 2. 需求与验收判据

| # | 需求 | 判据 | 实测 |
|---|---|---|---|
| R1 | 依赖钉死接线 | gradle 依赖 `node-bridge:0.2.0`（implementation）+ `node-runtime:24.22.1`（runtimeOnly）；版本不 floating | ✅ `app/build.gradle.kts` + `gradle/libs.versions.toml` |
| R2 | 引擎完整性 | APK 内 `libnode.so` SHA-256 = lock 值；`dlopen` 成功 | ✅ 20261028-01（be1d1641… 一致） |
| R3 | 六步启动编排 | 屏幕可见 [1/6]~[6/6] 中文阶段；`ui.log` 有对应取证 | ✅ 20261028-02 |
| R4 | 就绪双判据 | marker(`port>0`) ∧ state=Running ∧ `GET /global/health`==200 才进入 [6/6]；180s 超时判失败 | ✅ |
| R5 | 失败可见 | 任一步失败 → 错误页（阶段+原因+日志尾+重启）；`ui.log` 记 FAILED[stage] | ✅（载荷缺失负样本触发过） |
| R6 | 环境契约 | D9 变量表生效（HOME/XDG/TMP/OPENCODE_*/OC_*） | ✅ server.log cwd/HOME 证据 |
| R7 | 关停语义 | `onDestroy` 不杀 Node 的长连接之外；「重启应用」= 整进程退出（终态如实提示） | ✅（process-in Node 无优雅重启，如实登记） |
| R8 | 诊断面 | `Diagnostics`：marker 读取 / health 探活 / logs(60) / lastCrash / evidence 追加 | ✅ |

## 3. 边界

- 不做 `:node` 独立进程（Phase 3 可选加固）；不做前台服务（D15）。
- Kotlin 不解析载荷内容（宪法 C3）；`probeEngine()` 等桥能力仅在诊断路径使用。

## 4. 证据

- [docs/真机验证记录.md](../../docs/真机验证记录.md) 20261028-01 / -02 两轮
- `docs/evidence/20261028-01/{facts.json, webview-up.png, app-home.png}`
