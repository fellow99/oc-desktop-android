# 20261029-2 评审报告（REVIEW_REPORT）—— 需求 001-building-workflow

> 评审方式：requesting-code-review（code-reviewer 子代理，独立上下文，约 30 次工具调用，只读）
> 评审范围：`8a4d174..081b84e`（specs 四件套 + 登记 + workflow）
> 处置方式：receiving-code-review —— 每条先对仓库源码核实、再修复；无表演式认同；有争鸣处如实记录。

## 评审员原始结论（要点）

**Strengths**：fetch-depth:0 对 auto-abbrev 基线守卫的必要性核实成立且注释清晰；签名分支与 gradle 条件签名三方同口径（yml/sample/build.gradle.kts）；secrets 经 step env 映射 + printf 格式串零注入面；失败传播干净、artifact 全程留存；collect-plugins 确不依赖 OPENCODE_DIR；文档纪律好。

**Issues**：
- **Critical #1**：载荷④（collect-opencode 默认跑 verify-runtime 门禁）在 CI 冷缓存必炸 —— `findAar()` 只查 `~/.m2` 与 Gradle 缓存，hosted runner 两者皆空 → exit 2；且失败发生在 Gradle step 之前，`setup-java` 的 gradle 缓存（`post-if: success()`）永不落盘 → **每次推 tag 同一位置永久红**。
- **Critical #2**：收集产物文件名 `app-${VARIANT}.apk` 大小写错配（AGP 实际输出全小写 `app-debug.apk`，本仓 TEST_REPORT/README 即反证），Linux 大小写敏感 → `test -f` 必挂 → Release 永远出不来。
- **Important #3**：bun 版本口径三处打架（README 示例 `<bun-1.4.2>` vs plan/CI/TEST 钉 1.3.14）。
- **Minor #4**：`settings.gradle.kts` 与 `runtime.lock.json` 注释仍称"Central 尚未发布 24.22.1"，与 R7 实证矛盾。
- **Minor #5**：签名 secrets 部分配置无前置校验，报错不直观。

**Recommendations**：真推 tag 前按可能性排序的炸点清单（含 `gradlew` git mode 未验——本环境只读无法核）；建议修完先用 `workflow_dispatch` 彩排；可选 core.abbrev 优化（现状正确仅慢）；测试结论修正 —— 静态断言对真实执行路径失明，建议增补 T-C11（冷缓存）/T-C12（产物文件名）。

**Assessment**：No（修完两个 Critical 即可转 Yes）。

## 处置记录（逐条核实 → 修复）

| # | 评审断言 | 核实结果 | 处置 |
|---|---|---|---|
| C1 | verify-runtime 冷缓存必炸；`OC_NODE_RUNTIME_AAR` 为脚本原生入口 | ✅ 实锤：`verify-runtime.mjs` env/`--aar` 入口（L28）、`findAar()` 仅查 ~/.m2+Gradle 缓存（L51-70）、`collect-opencode` 默认跑门禁且 `--check` 在门禁前退出（T-C8 盲区实锤）；本机 `~/.m2` 有 24.22.1（publishToMavenLocal）解释为何本机全量能过 | **修复**：载荷①前新增「引擎 AAR 预取」step（curl Central AAR → `OC_NODE_RUNTIME_AAR` 注 GITHUB_ENV）。**实证**：下载 Central AAR 后 `OC_NODE_RUNTIME_AAR=<Central AAR> node scripts/verify-runtime.mjs` 全绿（libnode.so SHA-256=lock `be1d1641…`），T-C9 最大风险提前消化 |
| C2 | 产物文件名大小写错配 | ✅ 实锤：源行 `app-${VARIANT}.apk`；AGP 输出 `app-debug.apk`（T-C7 产物实证） | **修复**：`app-${VARIANT,,}.apk`（一行） |
| I3 | bun 版本口径打架 | ✅ 实锤：`bun --version`=1.3.14（本机实证）；README:29 示例 `bun-1.4.2` 为过时占位 | **修复**：README 示例统一为 `<bun-1.3.14>` 并注明"=CI 钉死口径" |
| M4 | 两处注释与 R7 矛盾 | ✅ 属实（不影响运行） | **修复**：`settings.gradle.kts` mavenLocal 注释、`runtime.lock.json` maven.runtime 标注滚动为"Central 2026-10-27 已发布 + 实测全绿"（纯注释/描述字段，lock JSON 解析校验通过） |
| M5 | secrets 部分配置无校验 | ✅ 合理建议 | **修复**：注秘分支内加四值齐备断言（缺项 `::error::` 明示 + exit 1） |
| R③ | `gradlew` git mode 未验 | ✅ 实锤为 **100644**（本机 `ls -la` 的 rwx 是 Windows 权限映射假象）——CI Linux 会 Permission denied，评审员建议清单里最实的隐藏炸点 | **修复**：`git update-index --chmod=+x gradlew` → 100755（T-C13） |
| R-测试 | 增补 T-C11/T-C12；静态断言盲区坦白 | ✅ 采纳 | test-cases 增补 T-C11（Central AAR 冷缓存等价，已实测）/T-C12（产物文件名断言）/T-C13（gradlew mode）；TEST_REPORT 回归口径同步 |
| R-彩排 | workflow_dispatch 先彩排再打 tag | ✅ 采纳，写入最终报告与 T-C9 建议 | 移交用户 |
| R-abbrev | core.abbrev + fetch-depth:1 优化 | 记录不采纳（YAGNI）：现状正确，全量克隆成本可接受，不为省几分钟引入新面 | 留档 |

## 修复后回归

- workflow 结构断言 **28/28 ALL PASS**（原 21 项 + T-C5e、FIX-C1a/b/c、FIX-C2、FIX-R3）；证据 `workflow-assert-result.txt`（已滚动覆盖）。
- `runtime.lock.json` JSON 解析 OK；`settings.gradle.kts` 仅注释变更。
- 本轮无 Critical 残留 → 无需二次送审（评审意见本身即源于独立全量通读，修复逐条对其实证落地）。

**最终 Assessment（自评）：Ready（Critical/Important 全修复且回归绿；端到端由 T-C9 用户侧彩排收口）。**
