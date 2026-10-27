# 104-host-capabilities —— 宿主能力桥（spec）

> 状态：✅ as-built（2026-10-28；notify/saf 为如实 stub）· 引用：规划 §6、宪法 C1/C2 · 实现：`HostCapabilities.kt`

## 1. 目标

以 `rt.host.register` 提供 Node → Kotlin 能力面；未实现的能力如实报错，绝不静默。

## 2. 能力清单与判据

| 能力名 | 语义 | 判据 | 状态 |
|---|---|---|---|
| `echo` | 桥连通性往返 | `host.invoke('echo', …)` 返回 `{ok:true,echo:<args>}` | ✅ 探针实测 |
| `perm.check` | 权限状态上报 | 返回 `{ok:true, notification:<bool>, sdkInt}`（通知权限；33+ 运行时检查） | ✅ 实现 |
| `openExternal` | 外链交系统 | 仅接受 http(s)；`ACTION_VIEW` + NEW_TASK；失败返回 `{ok:false,error}` | ✅ 实现（配合 103 围栏） |
| `notify` | 通知（D15 前台服务配套） | 返回 `{ok:false,error:"Phase 3 未实现（D15）"}` | ⬜ stub（如实） |
| `saf.pickFolder` | SAF 选目录（D14/203） | 返回 `{ok:false,error:"Phase 2 未实现（D14/203）"}` | ⬜ stub（如实） |

## 3. 纪律

- **先注册再 start**（桥契约）；handler 跑主线程只做轻活，重活返回结构化失败。
- Context 来自 `App.appContext`（Application 级）。
- 能力名与规划 §6 一致；203 落地时 `saf.pickFolder` 升级为真实现（`ACTION_OPEN_DOCUMENT_TREE` + DocumentFile 拷贝导入），本 spec 届时更新。

## 4. 证据

- 探针 `host.invoke('echo')` → `{"ok":true}`（docs/evidence/20261028-01/facts.json `host` 字段）。
