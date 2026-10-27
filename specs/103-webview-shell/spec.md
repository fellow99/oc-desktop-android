# 103-webview-shell —— WebView 渲染壳（spec）

> 状态：✅ as-built（2026-10-28）· 引用：规划 §5.4/§6、宪法 C1/C2 · 实现：`MainActivity.kt`、`res/xml/network_security_config.xml`

## 1. 目标

以系统 WebView 同源渲染 opencode v2 Web UI，全程零注入；加载页/错误页/围栏/返回语义完备。

## 2. 需求与验收判据

| # | 需求 | 判据 | 实测 |
|---|---|---|---|
| R1 | 必备配置 | javaScriptEnabled + domStorageEnabled + databaseEnabled（缺一则 SPA 首屏崩） | ✅（P0-E 八项佐证） |
| R2 | loopback 明文 | networkSecurityConfig 仅 `127.0.0.1`/`localhost` 放行；其余禁明文 | ✅ P0-D |
| R3 | 首屏免登录 | `loadUrl("http://127.0.0.1:<port>/?auth_token=…")`（token 百分号编码）；UI 直进会话首页 | ✅（截图 webview-up/app-home） |
| R4 | 导航围栏 | 仅拦主 frame；本机域名放行；外部 http(s) → 系统浏览器 | ✅ 实现审查 |
| R5 | 历史语义 | 首屏 `onPageFinished` → `clearHistory()`；返回键：WebView 可后退则 goBack，否则退出确认对话框 | ✅ |
| R6 | 旋转/折叠免重建 | `configChanges` 自理（orientation/screenSize/screenLayout/smallestScreenSize/keyboardHidden/uiMode/density）；WebView 不重载 | ✅（same-origin 服务仍在） |
| R7 | 主 frame 错误可见 | `onReceivedError`(主 frame ∧ 未成功过) → 错误页（原因+日志尾）；auth_token 不落任何输出 | ✅ |
| R8 | 加载页 | 启动期显示阶段文案（六步），非白屏 | ✅ T-E1 |

## 3. 边界

- Service Worker：UI 生产构建注册 `/sw.js`，不支持则无害失败，不作判据（规划 §5.4）。
- 不做 `evaluateJavascript` 注入兜底（保持零注入；P0-E 八项全 ok 佐证无必要）。
- phone 不做专属优化（大屏优先）。
