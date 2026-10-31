# 101-runtime-integration 技术方案（as-built）

> 对应规格：[spec.md](./spec.md) ｜ 状态：✅ as-built ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 宿主 | Android Activity，单进程 | `app/src/main/java/.../MainActivity.kt` |
| 运行时 | `io.github.fellow99:node-bridge:0.2.0` + `node-runtime:24.22.1` | `gradle/libs.versions.toml` |
| Node | arm64-v8a，16 KB 页对齐 | `runtime.lock.json` |
| 入口 | `bootstrap.js` → `payload/opencode-server.js` | `app/build.gradle.kts` / `payload/` |
| 数据 | `node:sqlite`（WAL） | `payload/opencode-server.js` |

## 2. 关键决策

- **进程内 Node**：不启用 `:node` 独立进程；崩溃即应用崩溃，如实提示重启。
- **六阶段状态机**：密码 → 载荷 → host 注册 → `rt.start` → 就绪双判据 → loadUrl。
- **先注册 host 再 start**：桥契约要求；避免 Node 早期调用能力失败。
- **就绪双判据**：`server.ready.json(port>0, pid)` ∧ `state=Running` ∧ `GET /global/health` 200。
- **令牌一次下行**：密码只经 env 传递，不写日志。

## 3. 数据模型

```
RuntimeState = Idle | Starting | Running | Failed(stage, reason, logTail)
ReadyMarker { port: int, pid: int, version: string }
Connection { password: base64url(32B) }
```

## 4. 接口契约

### 4.1 提供

- `OpencodeRuntime.launchIn(activity)`：启动编排；
- `awaitReady(timeout=180s)`：就绪判据；
- `Diagnostics`：marker/health/logs/lastCrash/evidence。

### 4.2 消费

- `NodeRuntime.start(options)`（桥 API）；
- `HostCapabilities.registerAll()`；
- `ConnectionStore.loadOrCreate()`；
- `payload/opencode-server.js`。

## 5. 实现策略

1. `MainActivity.onCreate` 先设置加载页，再启动协程编排；
2. `ConnectionStore` 读取/生成 `connection.json`；
3. `ensurePayload` 拷贝 assets 到 `incoming/`；
4. `HostCapabilities.registerAll`；
5. `rt.start(bootstrap.js, appEntry=payload/opencode-server.js, env=buildEnv())`；
6. 轮询 marker + health；成功后 `loadUrl` 带 `auth_token`；
7. 任一步失败写 `ui.log` 并显示错误页。

### 错误处理

- rc≠0：错误页附日志尾；
- 超时：阶段 `ready` 失败；
- 崩溃：`lastCrash` + “请重启应用”，不提供假重试。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| 依赖 | `gradle dependencies` 版本钉死 |
| 引擎 | `verify-runtime.mjs` SHA/对齐 |
| 启动 | 屏幕 [1/6]~[6/6] |
| 就绪 | marker + health 200 |
| 失败 | 删载荷 → 错误页三要素 |
| 证据 | `docs/evidence/20261028-01/`、`docs/真机验证记录.md` |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `app/src/main/java/.../MainActivity.kt` | 宿主/加载页/错误页 |
| `app/src/main/java/.../OpencodeRuntime.kt` | 六阶段编排 |
| `app/src/main/java/.../ConnectionStore.kt` | 密码 |
| `app/src/main/java/.../HostCapabilities.kt` | 能力注册 |
| `app/src/main/java/.../Diagnostics.kt` | 取证 |
| `payload/opencode-server.js` | Node 入口 |
| `payload/lib/env.js` | 环境契约 |

## 8. 与规格交叉引用

- R1/R2 → `verify-runtime` / `runtime.lock.json`
- R3/R4 → `OpencodeRuntime` 状态机
- R5 → `MainActivity` 错误页
- R6 → `payload/lib/env.js`
- R7/R8 → `Diagnostics`
