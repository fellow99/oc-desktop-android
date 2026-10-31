# 113 — 版本更新：2.2.5 任务清单（android）

> **回引:** `spec.md` / `plan.md` ｜ **最后更新:** 2026-10-31 ｜ 日志：`logs/20261031-1/`

## M1 静态收敛

- **T01** 建 `specs/113-version-2.2.5/` 四件套 + `logs/20261031-1/DEV_CHECKLIST.md`
- **T02** 按 plan §3 清理；`git status` 无 ` D `
- **T03** `app/build.gradle.kts` → 2.2.5/20205（含注释版本口径）；README 同步；
  apply-patches/collect-opencode 守卫（9bbb8ce18c、v2.2.5、VERSION 2.2.5）；smoke 工具名口径；bun 1.4.4

## M2 补丁迁移

- **T04** 建 `patches/v2.2.5/`：复制 0001/0006；重生成 **0003/0007/0008/0009/0010**；逐条双向 `--check`
- **T05** 重写 `patches/v2.2.5/README.md`

## M3 构建

- **T06** apply-patches（守卫）→ `OPENCODE_NODE_TARGET=node24 BUN_BIN=<1.4.4> node scripts/build-opencode.mjs`
- **T07** collect-plugins → collect-opencode（verify-runtime 门禁、tar+SHA）
- **T08** smoke-node24（含品牌 title 断言）、verify-git-plugin、verify-runtime 全绿
- **T09** `gradlew :app:assembleDebug`；apksigner 校验；aapt 读版本 2.2.5/20205

## M4 真机测试（等待用户连线）

- **T10** 通知用户连接 Android 真机；`adb devices` 确认；install -r + 启动非白屏
- **T11** 基本功能：DeepSeek `<API_KEY>`（运行时）→ 沙箱新建测试目录工作区 → 「介绍一下你自己」→ 图片分析
- **T12** 环境能力抽查（对照 `../../docs/能力对照清单.md`）：SSE、bash→shell 工具名、git 插件、搜索插件、工作区 SAF/setCurrent、SQLite 持久、通知/保活默认关、16KB
- **T13** 输出 `TEST_REPORT.md`（逐条结论 + 截图，避开凭证明文）

## M5 评审/收口

- **T14** 代码评审（requesting/receiving）→ REVIEW_REPORT；修复 Critical/Important 并回归
- **T15** 敏感信息扫描；opencode 树恢复干净

## M6 提交

- **T16** Conventional Commits 前缀分批提交；keystore/local.properties 不入库；`git tag v2.2.5`；不 push
