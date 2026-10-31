# 105-auth 技术方案（as-built）

> 对应规格：[spec.md](./spec.md) ｜ 状态：✅ as-built ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 连接密码 | 32B base64url → `connection.json`（MODE_PRIVATE） | `ConnectionStore.kt` |
| 服务端注入 | `OPENCODE_SERVER_PASSWORD` env | `OpencodeRuntime.buildEnv` |
| 首屏 | `?auth_token=base64("opencode:"+pwd)` | `MainActivity` |
| 模型凭据 | opencode credential store（DB） | 上游 `/api/credential` |

## 2. 关键决策

- **三层凭据分离**：连接密码、首屏 token、模型 key 各自闭环。
- **密码跨启动稳定**：文件复用；损坏重生成。
- **token 一次性**：首屏 URL 传递，前端读取后自抹。
- **脱敏**：日志/错误页 URL 一律 `?auth_token=***`。
- **legacy 迁移**：`auth.json` 仅 DB 首建时导入。

## 3. 数据模型

```
ConnectionFile { password: base64url }
AuthToken = base64("opencode:" + password)  # URL 编码 +
ModelCredential -> credential store (DB)
```

## 4. 接口契约

### 4.1 提供

- `ConnectionStore.loadOrCreate()`；
- `buildEnv()` 注入 `OPENCODE_SERVER_PASSWORD`；
- `authToken()` 生成首屏参数；
- `Diagnostics.redactUrl()`。

### 4.2 消费

- 上游 `entry.tsx` 的 `?auth_token=`；
- `/global/health` Basic；
- 设置页 `/api/credential`。

## 5. 实现策略

1. 首启生成 32B 随机 base64url，写 `connection.json`；
2. 启动时读取；损坏则重生成；
3. env 下行密码；
4. 首屏 URL 拼接并百分号编码 `+`/`=`；
5. 日志脱敏；
6. 模型 key 由用户在设置页录入，存 credential store。

### 错误处理

- 密码文件损坏 → 重生成（会让旧会话失效，如实提示）；
- 错口令 → UI 登录失败可见；
- 日志禁止输出密码/token。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| 密码 | 首启 len≈43；二次启动复用 |
| 服务端 | health Basic 200 |
| 首屏 | 免登录进入首页 |
| 脱敏 | 日志无 `auth_token` 实值 |
| 模型 key | 401→录入→200 |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `ConnectionStore.kt` | 密码持久化 |
| `OpencodeRuntime.kt` | env/首屏 token |
| `MainActivity.kt` | loadUrl |
| `Diagnostics.kt` | 脱敏 |
| `docs/证据` | 真机记录 |

## 8. 与规格交叉引用

- R1 → `ConnectionStore`
- R2/R3 → env + 首屏 token
- R4 → 脱敏
- R5/R6/R7 → credential store / 轮换
