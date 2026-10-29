# 001-building-workflow —— 任务清单（tasks）

> 日期：2026-10-29 · 回引：[spec.md](./spec.md) / [plan.md](./plan.md)

| # | 任务 | 产出 | 依赖 | 状态 |
|---|---|---|---|---|
| T1 | 规格四件套（spec/plan/tasks/test-cases） | `specs/001-building-workflow/` | — | ✅ |
| T2 | 编写 `.github/workflows/build-release.yml`（触发面/环境/载荷五步/签名分支/APK/产物/发布，plan §4 十一步） | workflow 文件 | T1 | ✅ |
| T3 | workflow 语义校验：YAML 解析 + GitHub Actions 语义检查（actionlint 或等价） | 校验输出 | T2 | ✅ |
| T4 | 本机等价验证①：`node scripts/collect-opencode.mjs --check`（基线守卫口径） | 退出码 0 | T2 | ✅ |
| T5 | 本机等价验证②：`./gradlew :app:assembleDebug`（APK 构建步等价，本机后台已跑） | APK 产物 | T2 | ✅ |
| T6 | 文档登记：`specs/README.md` 模块表 + `specs/SPECS_CHECKLIST.md` 需求覆盖 + README 快速开始补 CI 入口 | 三个文档滚动 | T2 | ✅ |
| T7 | 代码评审（requesting-code-review 子代理 → REVIEW_REPORT → receiving-code-review 逐条核实）→ Critical/Important 全修复 | `logs/<轮>/REVIEW_REPORT.md` | T2–T5 | ✅ |
| T8 | 测试执行（test-cases.md 全量）→ TEST_REPORT | `logs/<轮>/TEST_REPORT.md` | T7 | ✅ |
| T9 | git 提交（conventional commits：docs → ci → fix/test 系列） | 提交链 | T7/T8 | ✅ |
| T10 | （用户侧）配置签名 secrets（可选）+ `git push origin v0.12.1` 触发端到端 | GitHub Release + APK | T9 | ⬜ 需仓库权限 |

> T10 为仓库推送权限操作，本环境不代执行（spec §3 边界）。
