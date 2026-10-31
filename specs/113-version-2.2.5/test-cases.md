# 113 — 版本更新：2.2.5 测试用例（android）

> **回引:** `spec.md` / `plan.md` ｜ **最后更新:** 2026-10-31
> **设备:** Android 真机（测试阶段由用户连线；`adb devices` 确认，arm64 原生优先）。
> **凭证纪律:** DeepSeek Key 与任何账号/密码仅运行时输入，文档占位 `<API_KEY>`/`<USER>`/`<PASSWORD>`，不落盘、不入截图。

## 1. 环境

| 项 | 值 |
|---|---|
| 主机 | Windows + JDK 17（sdkman）+ Android SDK（local.properties）+ Node 24.14.1 + bun 1.4.4 |
| 上游 | `../opencode` @ v2.2.5 `9bbb8ce18c` |
| 产物 | app/build/outputs/apk/debug/app-debug.apk（versionName 2.2.5 / versionCode 20205） |

## 2. 静态与构建用例

| 用例 | 关联 | 步骤 | 期望 | 结果 |
|---|---|---|---|---|
| TC-01 清理不伤跟踪文件 | AC-01 | `git status --porcelain` | 无 ` D ` | ⬜ |
| TC-02 版本号 | AC-02 | `app/build.gradle.kts` / aapt | 2.2.5 / 20205 | ⬜ |
| TC-03 补丁正向 | AC-04 | 7 条 `git apply --check` | 全通过 | ⬜ |
| TC-04 补丁反向 | AC-04 | 应用后 `--reverse --check` | 全通过 | ⬜ |
| TC-05 守卫自洽 | AC-05 | apply-patches/collect-opencode | 9bbb8ce18c / v2.2.5 | ⬜ |
| TC-06 node24 构建 | AC-05 | build-opencode.mjs | dist-node 产出 | ⬜ |
| TC-07 载荷/运行时门禁 | AC-05 | collect-opencode（verify-runtime 六门禁 + 16KB） | 全绿、tar+SHA | ⬜ |
| TC-08 host 冒烟 | AC-05 | smoke-node24（含品牌 title） | 全绿 | ⬜ |
| TC-09 APK 签名/版本 | AC-02/06 | assembleDebug + apksigner + aapt | app-debug.apk，Verifies，2.2.5/20205 | ⬜ |

## 3. 真机基本功能（对应需求）

| 用例 | 关联 | 步骤 | 期望 | 结果 |
|---|---|---|---|---|
| TC-10 真机连接 | FR-106 | `adb devices`（请用户连线、允许调试） | 列出 1 台 device（非 unauthorized） | ⬜ |
| TC-11 安装启动 | FR-106 | `adb install -r app-debug.apk`；启动 | 安装成功、界面加载非白屏 | ⬜ |
| TC-12 设置 DeepSeek Key | FR-107 | 设置/凭据页录入 `<API_KEY>`（运行时） | Key 保存；模型可选 deepseek 系列 | ⬜ |
| TC-13 创建工作区 | FR-107 | 沙箱中新建测试目录并选为当前工作区 | 目录创建、cwd 切换成功 | ⬜ |
| TC-14 一次对话 | FR-107 | 发送「介绍一下你自己」 | SSE 流式、finish=stop、正常回复 | ⬜ |
| TC-15 图片分析对话 | FR-107 | 发送一张图片要求描述 | 基于图片内容回复（多模态） | ⬜ |

## 4. 环境能力抽查（对照父工程 `docs/能力对照清单.md`）

| 用例 | 关联 | 步骤 | 期望 | 结果 |
|---|---|---|---|---|
| TC-16 工具名口径（v2.2.5 变化点） | U2 | 让模型执行一条简单 shell 命令 | 上游内置工具名为 `shell`（旧 `bash` 经别名兼容）；命令成功 | ⬜ |
| TC-17 流式/SSE | 3.4 | 长回复观察逐字流式 + 首帧事件 | 正常，无中断 | ⬜ |
| TC-18 文件读写编辑 | 4.16 | 模型在工作区 read/write/edit 文件 | 落盘且内容正确 | ⬜ |
| TC-19 搜索插件 | grep/glob | 会话内让模型搜索某关键字/文件 | oc-plugin-search 返回结果（无 rg，纯 JS） | ⬜ |
| TC-20 Git 插件 | 5.3 | 公开仓 init/add/commit/log；凭据页 0600 不回显（用后删除） | 全链通过、凭据不回显 | ⬜ |
| TC-21 工作区插件 | 5.5 | roots/browse/mkdir/SAF import/setCurrent | 各 RPC 正常、cwd 可切换 | ⬜ |
| TC-22 pnpm 插件 | 5.8 | `pnpm add` 一个小包（如 ms） | 进程内安装成功（按上轮口径，不验证 run 生命周期脚本） | ⬜ |
| TC-23 SQLite 会话持久 | 2.6/2.7 | 两次对话后重启应用 | 历史会话仍在 | ⬜ |
| TC-24 平台边界回归 | §9 | PTY 不可用、插件在线安装不投放、MCP stdio 不投放 | 行为与清单一致（不回退） | ⬜ |
| TC-25 品牌化 | 7.2 | 启动页/title/关于页 | title=OC Desktop、图标/关于页正常 | ⬜ |
| TC-26 导航围栏 | 3.11 | 点击 UI 内外链 | 主 frame 外链分流系统浏览器（按实际可见项） | ⬜ |
| TC-27 通知/保活默认关 | 1.13/1.17 | 关于页开关默认态 | 保活默认关闭；notify 按授权态如实回传 | ⬜ |

## 5. 敏感信息

| 用例 | 关联 | 步骤 | 期望 | 结果 |
|---|---|---|---|---|
| TC-28 暂存区/全库扫描 | AC-09 | diff 复查 + grep（Key 前缀/密码字面量） | 零命中 | ⬜ |
| TC-29 设备/截图清理 | AC-09 | 截图不拍设置页明文；报告不写 Key | 无残留 | ⬜ |
| TC-30 opencode 树恢复 | D10 | `git -C ../opencode status` | 干净 | ⬜ |
