# Phase 3 评估与备案（2026-10-29）

> 依据：规划 §5.14 D15 / §13 G8 / §11 Phase 3。本轮在模拟器/宿主可验证范围内完成实现与评估；
> 需物理设备/Play 后台的判据如实登记待办。

## 1. 前台服务保活（D15 / P3-13）—— 已实现，编译级验证

- 实现：`KeepaliveService`（`foregroundServiceType=dataSync` + 常驻通知，IMPORTANCE_LOW）；
  `HostCapabilities` 新增 `notify {title,body}`（33+ 无授权时如实回 `notifications-not-granted`）、
  `keepalive.set/get {enabled}`（SharedPreferences 持久化，默认关）；
- 入口：**关于对话框**「保活: 关（点击开启）/开（点击关闭）」（33+ 点开启时请求 POST_NOTIFICATIONS）；
- 权限：`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_DATA_SYNC`、`POST_NOTIFICATIONS`（清单申报，§10 口径）；
- 验证：`compileDebugKotlin` ✅；运行时启停/通知显示/杀后台实测 → **待模拟器恢复**（环境事件 20261029-02）。

## 2. `:node` 独立进程评估（P3-14）—— 结论：**v1 维持进程内，不启用**

| 维度 | 进程内（现状） | `:node` 独立进程 |
|---|---|---|
| 崩溃恢复 | ❌ Node 崩 = 应用崩（错误页「重启应用」） | ✅ Node 崩可重启 Activity 重连 |
| 内存 | 单进程共享堆 | **进程 ×2**（libnode 常驻两份 ~150MB+ RSS 量级） |
| IPC | 零（同进程直调） | WebView↔Node 需跨进程代理 HTTP/事件，**端口与就绪协议全要重设计** |
| 生命周期 | `node::Start` 每进程一次（约束不变） | 同约束仍在（`:node` 进程同样只能 Start 一次）|
| 保活协同 | 前台服务提升**本进程**优先级即覆盖 Node | 需前台服务绑 `:node` 进程（两套保活面）|

**判定**：收益（崩溃恢复）不抵代价（内存翻倍 + IPC 重设计 + 双保活面），且崩溃属低频事件、
错误页路径已可用；维持 D1/B 原判「可选加固，默认不启用」。复评触发条件：真机长会话崩溃率显著。
（内存实测：模拟器轮 `dumpsys meminfo` 数据待模拟器恢复后补录归档。）

## 3. 分发评估（P3-15 / G8）—— 结论：**侧载 APK 主线；Play 走 AAB+PAD，暂不启动**

- 现状包体：`app-debug.apk` **163,944,484 B**（≈156MB；release 签名轮实测 120,766,287 B——debug 含
  调试符号与未压缩差异；release 才是发布口径）；
- Play 政策面：AI 内容（G10，上游 UI 自带口径）、大包（>150MB 触发 **Play Asset Delivery install-time
  pack** 要求——载荷 tar.gz ≈75MB 适合 PAD 拆分；libnode.so 随 base）、前台服务需申报用途（D15 默认关 ✓）；
- 判定：侧载主线不受阻；**Play 路线在分发启动前完成 AAB 构建演练 + PAD 拆包 + 政策预检**（独立专项）；
  本轮以 `assembleDebug` 产物核录包体基线（109 四件套之一）。
- 局域网回退路线 B（P3-17）**维持备案不实现**：触发条件=特定 ROM 拦 loopback（未观测到）；启用时
  设计要点已登记（`0.0.0.0`+LAN IP+密码+显式提示，networkSecurityConfig 需同步放宽）。

## 4. 待办（物理设备/Play）

- 保活：真机前台服务启停、通知显示、后台时长实测；`dumpsys meminfo` 基线补录。
- 分发：`bundleDebug` AAB 产物演练 + PAD install-time 拆包验证 + Play 政策预检清单。
