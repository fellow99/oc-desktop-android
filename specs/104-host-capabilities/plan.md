# 104-host-capabilities 技术方案（as-built）

> 对应规格：[spec.md](./spec.md) ｜ 状态：✅ as-built（notify/saf 为 stub） ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 桥 | `rt.host.register` | node-bridge 0.2.0 |
| 实现 | `HostCapabilities.kt` | `app/src/main/java/...` |
| Context | `App.appContext` | `App.kt` |
| 线程 | 主线程轻活；重活结构化失败 | 设计 |

## 2. 关键决策

- **先注册再 start**：桥契约。
- **未实现如实报错**：`notify` / `saf.pickFolder` 返回 `{ok:false,error}`，不静默。
- **JSON 入出**：统一 `JSONObject`，参数窄化。
- **外链白名单**：仅 http(s)。

## 3. 数据模型

```
HostResult { ok: bool, data?: object, error?: string }
Capabilities = echo | perm.check | openExternal | notify | saf.pickFolder
```

## 4. 接口契约

### 4.1 提供

- `echo(args)` → `{ok:true,echo:args}`；
- `perm.check` → `{ok:true,notification,sdkInt}`；
- `openExternal(url)` → `{ok}`；
- `notify` / `saf.pickFolder` → stub。

### 4.2 消费

- `App.appContext`；
- Android `NotificationManager` / `Intent`；
- 203 落地后 SAF 真实现。

## 5. 实现策略

1. `registerAll()` 在 `rt.start` 前调用；
2. 每个 handler 捕获异常并返回结构化 `{ok:false,error}`；
3. `openExternal` 校验 scheme 后 `ACTION_VIEW + NEW_TASK`；
4. `perm.check` 在 API 33+ 检查 `POST_NOTIFICATIONS`；
5. 203 将 `saf.pickFolder` 升级为 `ACTION_OPEN_DOCUMENT_TREE` + `DocumentFile` 拷贝。

### 错误处理

- 未知能力 → `{ok:false,error:"unknown capability"}`；
- 参数非法 → `{ok:false,error}`；
- 不抛未捕获异常到 Node。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| echo | 探针返回 `{ok:true}` |
| 权限 | `perm.check` 返回 SDK/通知态 |
| 外链 | http(s) 打开系统浏览器 |
| stub | notify/saf 返回明确错误 |
| 注册顺序 | Node 启动前完成 |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `HostCapabilities.kt` | 能力注册/实现 |
| `App.kt` | 全局 Context |
| `docs/evidence/20261028-01/facts.json` | echo 证据 |

## 8. 与规格交叉引用

- R1/R2 → `echo`/`perm.check`
- R3 → `openExternal`
- R4/R5 → stub；203 升级
- 纪律 → 注册顺序/主线程/结构化失败
