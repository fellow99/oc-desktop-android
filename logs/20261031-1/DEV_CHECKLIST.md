# DEV_CHECKLIST — 101-version-2.2.5（oc-desktop-android）

> 日志目录：logs/20261031-1/ ｜ 开始：2026-10-31

## 里程碑
- [ ] M1 静态收敛（清理 / 版本号 / 守卫）
- [ ] M2 补丁迁移（v2.2.5）
- [ ] M3 构建链
- [ ] M4 测试 + 代码评审
- [ ] M5 提交 + 本地 tag

## 执行记录
（按时间追加命令/结果/产物路径）
# 113-version-2.2.5 开发执行日志（android）

## 构建结果（2026-10-31）
- 版本：versionName 2.2.5 / versionCode 20205；守卫基线 9bbb8ce18c / patches/v2.2.5；node-runtime AAR 24.22.1（不变）。
- 补丁：7/7 按序应用（0001/0003/0006/0007/0008 与 ark 同源；0009/0010 本端专属）。
  · 0009 按 v2.2.5 store（rootsUi/createStore）重做：capabilities 字段 + import/importStatus/importCancel/remove/setCurrent
    5 个 RPC 动作（asActionResult 归一）+ UI 三按钮 + 10 i18n key；delta 以「已应用 0007」为基线生成（文件重叠）。
  · 0010 适配 <title data-sm>；smoke 品牌断言正则同步放宽。
- roots.test.ts 23/23 通过；改动面 tsc 无新增错误（仅 custom-elements.d.ts 符号链接在 Windows 被还原成文本的预存在 2 错，非本端引入）。
- build-opencode（OPENCODE_NODE_TARGET=node24, bun 1.4.4, bundle-only linux-arm64）成功。
- collect-opencode + collect-plugins：oc-plugin-git(828 文件/7.76MB)/workspace-roots/search/pnpm 投放。
- smoke-node24：version=2.2.5、/global/health 200、/ 200(9633B)、title=OC Desktop、server.connected，全绿。
- verify-git-plugin：host 功能测试全过（commit/status/diff/add P0-N）。
- verify-branding：app_name/图标/THIRD-PARTY-NOTICES/非官方声明/0 残留，全过。
- verify-runtime：node-runtime 24.22.1 AAR 锁值（libnode.so 81491624B sha256 匹配、ELF AARCH64/node::Start/16KB）。
- APK：./gradlew :app:assembleDebug BUILD SUCCESSFUL → app-debug.apk 132MB；
  aapt 校验 versionCode=20205 versionName=2.2.5 application-label=OC Desktop。真机安装/功能测试待用户连接设备。

## 真机回归修复（2026-10-31，Xiaomi MIX / lithium，Android）
- fix1「+→图片和文件」无反应：MainActivity 缺 WebChromeClient.onShowFileChooser。已实现 SAF
  ACTION_OPEN_DOCUMENT（单/多选、acceptTypes、取消复位、onActivityResult 回传 URI）。
- fix2【严重】升级不重解包：OpencodeRuntime 硬编码 OC_VERSION="2.1.2"，2.1.2→2.2.5 覆盖安装 marker
  仍命中→跳过解包，真机实际跑旧 2.1.2。改为运行时读 PackageInfo.versionName（与 APK 绑定，杜绝再漂移）；
  NOTICES 版本标签同步 2.2.5。验证：覆盖安装+清数据后 server.ready.json version=2.2.5 且 pid=当前进程。
- fix3 选图/Activity 回收后崩到 log 页（rc=-1 node::Start 每进程一次）：进程存活但 Activity 重建时，
  NodeRuntime 进程单例已 Running，新 Activity 二次 start 被拒。改为检测 Running 即「重连」
  （marker pid==本进程 + /global/health 200 → 直接 Ready），探活不过给明确整进程重启终态。
  用 font_scale 触发配置重建确定性复现：修复前 FAILED[start]，修复后 reuse running node→loadUrl 同端口。
- feat 硬件返回（补丁 0011，载荷补丁而非插件：需读/驱动 Web 内部路由/抽屉/mobile 视图，插件够不到）：
  宿主 onBackPressed 在 WebView 可见时 evaluateJavascript("window.__ocAndroidBack()")；
  新 runtime/android/back.ts 按优先级消费：移动抽屉/弹层→关；设置→退出（设置内搜索/子页先回退）；
  会话非“会话”tab→回“会话”tab；首页/会话 tab→不消费（停留，不退出）。单向调用，无 JavascriptInterface。
- build 修复：build-opencode.mjs 原传 build-node.ts 不认的 --target=（其只读 OPENCODE_TARGET env），
  未导出 env 时静默回退主机平台，曾误打入 win32-x64 原生件（fff_c.dll/opentui.dll/OpenConsole.exe，APK 179MB）。
  改为经 OPENCODE_TARGET 传递；回归后 dist 仅 linux-arm64（2 个 .so，0 dll/exe），APK 回到 132,992,968B。
- 门禁回归：verify-branding / verify-runtime(24.22.1+ELF) / verify-git-plugin / smoke-node24
  （version 2.2.5、health 200、/ 200、title OC Desktop、server.connected）全绿。
- 真机：DeepSeek V4.1 Flash 自我介绍、多模态图片识别（红圆/蓝方/文字布局）正确；
  设置-Git 入口可见；工作区沙箱选择/mkdir/打开正常；选图后返回/重开不再崩；
  硬件返回 5 条语义在真机逐条验证通过（用户在第二台真机复核通过）。
