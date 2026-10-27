# overall-data-model —— 数据模型

> 更新：2026-10-28 · 覆盖：沙箱文件布局、marker/清单 schema、鉴权数据、opencode 侧持久化。API 契约引用上游 `/api/*`（OpenAPI），本文不复制。

## 1. 设备沙箱（filesDir）数据分类

| 类别 | 路径 | 写方 | 读方 | 生命周期 |
|---|---|---|---|---|
| 连接密码 | `connection.json` | Kotlin（首启生成） | Kotlin | 跨启动复用；损坏即重生成 |
| 桥引导件 | `node-bridge/payload/**` | 桥（幂等物化） | Node（bootstrap） | 桥版本 marker `builtin-v2` |
| 启动脚本 | `payload/opencode-server.js`、`unpack.js`、`lib/*.js` | Kotlin（APK assets 拷贝，幂等） | Node（bootstrap 经 NODE_BRIDGE_ENTRY） | 随 APK 升级 |
| 载荷包 | `incoming/opencode-dist.tar(.gz)` | Kotlin（字节拷贝） | Node（unpack.js） | marker 命中后不再拷贝 |
| 载荷解包 | `opencode-dist/**` + `.manifest.json` | **Node** | Node（import）+ Kotlin（version 判断） | 版本变化即重建 |
| 就绪 marker | `payload/server.ready.json` | Node（原子写） | Kotlin（只读） | 每次启动覆盖 |
| 服务日志 | `logs/server.log` | Node | 人 | 追加 |
| UI 取证 | `logs/ui.log` | Kotlin | 人 | 追加 |
| 工作区 | `workspace/<name>/` | Node/opencode | Node | 用户数据（默认 `default`） |
| opencode 配置 | `config/opencode/opencode.json` | 用户/宿主 | opencode（启动时） | 用户数据 |
| opencode 数据 | `data/opencode/**`（opencode.db WAL、credential、log、shell、repos） | opencode | opencode | 用户数据 |

## 2. 关键 JSON Schema

### 2.1 `connection.json`（Kotlin 读写，MODE_PRIVATE）

```json
{ "schema": 1, "password": "<32B base64url>", "createdAt": 1793122366595 }
```

### 2.2 `server.ready.json`（Node 原子写 → Kotlin 只读；D3 判据）

```json
{
  "schema": 1,
  "port": 37591,                // >0 即端口已知
  "host": "127.0.0.1",
  "url": "http://127.0.0.1:37591",
  "pid": 25934,
  "startedAt": 1793122366595,
  "version": "2.1.2"
}
```

### 2.3 `opencode-dist/.manifest.json`（Node 解包幂等 marker；D7）

```json
{
  "schema": 1,
  "version": "2.1.2",                              // = OC_VERSION；版本变化触发重解包
  "tarSha256": "2fd7f578…c87",                     // 源包内容指纹
  "files": 72, "bytes": 69621011,
  "unpackedAt": "2026-10-27T17:32:51.431Z"
}
```

### 2.4 `config/opencode/opencode.json`（opencode 配置；示例为本工程 e2e 实配形状）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "deepseek/deepseek-flash",
  "provider": { "deepseek": { "models": { "deepseek-flash": { "name": "DeepSeek Flash" } } } }
}
```

### 2.5 构建期 `opencode-dist.manifest.json`（host 侧产物清单，随仓不入 APK）

```json
{ "schema": 1, "version": "2.1.2", "baseline": "a517687fde", "tarSha256": "…",
  "files": 41, "bytes": 69621011, "tarBytes": 69670400, "gzBytes": 37227818, "builtAt": "…" }
```

## 3. opencode 侧持久化（引用上游 schema）

| 对象 | 存储 | 说明 |
|---|---|---|
| 会话/消息 | SQLite `data/opencode/opencode.db`（WAL） | `session.create` → `ses_*`；`session.prompt` → `msg_*`（user/assistant） |
| 模型凭据 | credential store（同 DB） | `POST /api/credential {"integrationID","value":{"type":"key","key"}}` → `cred_*`，`active` 唯一 |
| 事件流 | 内存 + SSE `/api/event` | 首帧 `server.connected`；Volatile 契约（慢消费者会断） |
| legacy 迁移 | `data/opencode/auth.json` | 仅 DB 首建时导入（migration `20260805200742`） |

## 4. 数据边界

- **业务数据不经过 Kotlin**：会话/消息/凭据全部在 Node 侧（同源 HTTP 到达，SQLite 落盘）。
- **凭据最小暴露**：连接密码只在 env（`OPENCODE_SERVER_PASSWORD`）与 `connection.json`；模型 key 只在 credential store（DB 内）。日志/取证/文档零出现。
- **路径安全**：解包器拒绝绝对路径与 `..`（防穿越）；WebView 只放行本机导航；外链交系统。
