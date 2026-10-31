# patches/v2.2.5 — oc-desktop-android 上游幂等补丁

基线：opencode **v2.2.5**（tag `v2.2.5` / 提交 `9bbb8ce18c` / 分支 `Branch_v2.2.5`）。
Web 层补丁与 hos / ark 同源同语义（node24 目标）；本端另含 Android 专属 0009/0010/0011。

| 补丁 | 作用 | v2.2.5 迁移 |
| --- | --- | --- |
| 0001-node-target-ohos.patch | 构建目标锁 node24（对齐 node-runtime AAR v24.22.1） | 干净应用 |
| 0003-runtime-stubs-ohos.patch | core 导出图打桩 + persistent-pty/pty 空实现 | 按 v2.2.5 导出图重生成（含持久化终端新结构） |
| 0006-shell-select-ohos.patch | shell 选择器 | 干净应用 |
| 0007-workspace-roots-picker.patch | 四主目录选择器（roots.ts + UI + 18 i18n key） | 按新 workspaces/selection 拆分重生成 |
| 0008-git-credentials-settings.patch | 设置页 Git 凭据入口 | 按 v2.2.5 新 settings 架构重生成 |
| 0009-workspace-import-actions.patch | **Android 专属**：沙箱 SAF 导入/取消/删除/设默认（capabilities 自门控 + 10 i18n key） | 按 v2.2.5 store 结构重做，delta 基于 0007 之后的状态生成 |
| 0010-branding-oc-desktop.patch | index.html `<title>OC Desktop</title>` | 适配 `<title data-sm>` |
| 0011-android-hardware-back.patch | **Android 专属**：硬件返回接线（新增 `runtime/android/back.ts` + entry 安装 + 设置/会话注册）。抽屉→关、设置→退出、会话非会话 tab→回会话 tab；首页/会话 tab 不退出 | v2.2.5 新增（基于 SettingsSurface/attachment.mobile/corvu） |

## 顺序依赖

0009 改动的文件与 0007 重叠（dialog.tsx / roots.ts / i18n），其 delta 以「已应用 0007」
为基线生成，**必须在 0007 之后应用**（apply-patches 按编号顺序，天然满足）。
能力由壳插件 `oc-plugin-workspace-roots` 声明：无 `capabilities` 时三个动作按钮整体不渲染（自门控）。

## 验证

- 干净 v2.2.5 工作树按编号顺序 `apply-patches.mjs`：8/8 应用、0 失败。
- roots.test.ts 23 项通过；改动面 tsc 无新增错误（仅余预存在的 custom-elements.d.ts 符号链接 TS1128×2）。
- build（node24 / bun 1.4.4）→ collect-opencode/plugins（4 插件 + git 828 文件）
  → smoke-node24（version=2.2.5、/global/health 200、/ 200、title=OC Desktop、server.connected）全绿。
- verify-git-plugin、verify-branding（app_name/图标/NOTICES）、verify-runtime（node-runtime 24.22.1 锁值/ELF 门禁）通过。
- `./gradlew :app:assembleDebug` BUILD SUCCESSFUL → app-debug.apk（versionCode 20205 / versionName 2.2.5）。
