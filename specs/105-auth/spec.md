# 105-auth —— 鉴权（spec）

> 状态：✅ as-built（2026-10-28）· 引用：规划 §5.6、宪法 C6 · 实现：`ConnectionStore.kt`、`OpencodeRuntime`（token 装配）、opencode credential store

## 1. 目标

三层凭据各自闭环：**连接密码**（WebView ⇄ 本机服务）、**首屏 token**（免登录）、**模型凭据**（外呼 API），全部只存沙箱。

## 2. 需求与验收判据

| # | 需求 | 判据 | 实测 |
|---|---|---|---|
| R1 | 连接密码生命周期 | 首启生成 32B base64url → `connection.json`（MODE_PRIVATE）；跨启动复用；损坏重生成 | ✅（len=43 观测；二次启动复用） |
| R2 | 服务端鉴权注入 | 密码仅经 env `OPENCODE_SERVER_PASSWORD` 交给 Node；HTTP 层支持 Basic 与 `?auth_token=`（上游三通道） | ✅（health Basic 200；auth_token 首屏过） |
| R3 | 首屏免登录 | WebView 首屏带 `?auth_token=base64("opencode:pwd")`（`+`/`=` 百分号编码）；上游前端读取后自抹 | ✅ T-E1 |
| R4 | 脱敏 | 日志/取证/错误页中 URL 一律 `?auth_token=***`；密码不出现 | ✅ 实现审查 + ui.log 抽查 |
| R5 | 模型凭据 | 存 opencode credential store（DB）；录入路径=设置页（`POST /api/credential` 等价）；provider 依据凭据激活 | ✅ T-E4（401→录入→200 全链路） |
| R6 | legacy 迁移边界 | `auth.json` 仅在 DB 首建时导入（运行期写入无效）—— 如实文档化 | ✅（实测教训，ARCHITECTURE §5.3） |
| R7 | 轮换 | 连接密码：用户重置/文件损坏时再生；模型 key：设置页管理 | ✅ 语义实现 |

## 3. Cookie 备选（不启用）

配对 Cookie 与 Basic 兜底为备选通道（规划 §5.6）；P0 判定首选 `?auth_token=` 可用 ⇒ 备选不启用，仅在 ROM 差异触发时重估。

## 4. 安全边界

- 凭据只存应用沙箱；`evidence()` 禁止写入凭据（宪法 C6）。
- `OPENCODE_SERVER_PASSWORD` 经 env 一次性下行，不落文件（除 connection.json 本体）。
