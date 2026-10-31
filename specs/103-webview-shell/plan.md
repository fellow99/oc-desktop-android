# 103-webview-shell 技术方案（as-built）

> 对应规格：[spec.md](./spec.md) ｜ 状态：✅ as-built ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 容器 | `android.webkit.WebView` | `MainActivity.kt` |
| 明文 | `network_security_config.xml` 仅 loopback | `res/xml/` |
| 首屏 | `http://127.0.0.1:<port>/?auth_token=...` | `OpencodeRuntime` |
| 返回 | 补丁 0011 + WebView 历史 | `patches/v2.2.5/0011` |

## 2. 关键决策

- **零 JS 注入**：不 `evaluateJavascript`，仅同源加载。
- **主 frame 围栏**：外链交系统浏览器；子 frame 不拦。
- **configChanges 自理**：旋转/折叠不重建 WebView。
- **首屏 clearHistory**：避免返回键回到加载页。
- **错误页只在主 frame 且未成功过时触发**：避免子资源失败误报。

## 3. 数据模型

```
WebViewState = Loading | Ready | Error(reason, logTail)
NavDecision = AllowLocal | OpenExternal | Block
```

## 4. 接口契约

### 4.1 提供

- `loadUrl(url)`；
- `onPageFinished` → `clearHistory`；
- `onReceivedError` → 错误页；
- `shouldOverrideUrlLoading` 围栏。

### 4.2 消费

- `OpencodeRuntime` 的 port/token；
- `HostCapabilities.openExternal`；
- 补丁 0011 的返回语义。

## 5. 实现策略

1. 配置 `javaScriptEnabled/domStorageEnabled/databaseEnabled`；
2. 设置 `networkSecurityConfig`；
3. 首屏 URL 带 token；
4. `WebViewClient` 处理围栏/错误/历史；
5. `onBackPressed`：可后退 → `goBack`；否则按补丁 0011 语义（抽屉/设置/会话 tab）；
6. `configChanges` 清单覆盖旋转/折叠。

### 错误处理

- 主 frame 错误 → 错误页（原因 + 日志尾）；
- 外链失败 → `{ok:false,error}`，不崩溃；
- token 不写入日志。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| 配置 | P0-E 八项能力 8/8 |
| 明文 | 仅 loopback 可加载 |
| 首屏 | 免登录进入首页 |
| 围栏 | 外链打开系统浏览器 |
| 返回 | 补丁 0011 五语义真机 |
| 旋转 | 不重建、不重载 |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `MainActivity.kt` | WebView/加载页/错误页/返回 |
| `res/xml/network_security_config.xml` | 明文放行 |
| `patches/v2.2.5/0011-android-hardware-back.patch` | 返回语义 |
| `docs/evidence/20261028-01/` | P0-D/E 证据 |

## 8. 与规格交叉引用

- R1/R2 → WebView 配置 + networkSecurityConfig
- R3 → `?auth_token=` 首屏
- R4/R5 → WebViewClient + 0011
- R6 → `configChanges`
- R7/R8 → 错误页/加载页
