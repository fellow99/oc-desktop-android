# 20261029-1 评审报告（REVIEW_REPORT）

> 评审方式：requesting-code-review（code-reviewer 子代理，独立上下文，51+ 次工具调用）
> 评审范围：工作树相对 HEAD（7b08f55）的全部 P1 变更
> 处置方式：receiving-code-review（逐条对代码核实后修复；非表演式附和）

## 原始结论

**需修复后合入**：1 Critical / 7 Important / 9 Minor（原文见评审输出，全文要点如下）。

## 处置记录

| 级别 | 项 | 摘要 | 处置 | 复测 |
|---|---|---|---|---|
| C1 | SAF 取消/单飞行在拷贝阶段失效 | `onPickerResult` 过早 `pending=null` → cancel 恒 miss、可并发二次导入 | **已修**：`active` 槽贯穿拷贝期；`request` 双槽守卫；cancel 覆盖 pending+active 两阶段；终态清槽 | `compileDebugKotlin` ✅ |
| I1 | copyChildren 进度被子目录局部值覆写 | `.import.json` 统计只含最后一条目录链 | **已修**：`totals: LongArray` 共享累计 + `Pending.lastFiles/lastBytes` | 编译 ✅ |
| I2 | provider displayName 未消毒即拼路径（穿越） | 恶意 provider 可写出自导入目标 | **已修**：`isValidEntryName`（拒 `/`、`\`、`..`、控制符、点开头）逐项过滤 | 编译 ✅ |
| I3 | minSdk24 用 java.time（无 desugaring）→ API24/25 导入必挂 | `LocalDate`/`OffsetDateTime` | **已修**：改 `SimpleDateFormat`（`nowIso()`/`defaultName()`） | 编译 ✅ |
| I4 | ark 凭据单测与新路径适配冲突（测试红） | 断言仍指 `~/.git-credentials` | **已修**：测试改断言 `XDG_CONFIG_HOME/opencode/git-credentials` + 无 XDG 回退两例；win32 平台 skip 标注（0600 判据 POSIX/设备复核） | `node --test`：7 pass / 4 skip / 0 fail ✅ |
| I5 | 插件物化「失败只记录」承诺未实现（单插件异常 FATAL 全服务） | 无 per-plugin try/catch | **已修**：逐插件 try/catch + 结构化跳过日志 | host 模拟：run1 物化 3 / run2 复用 3 / 篡改自愈 ✅ |
| I6 | 校验失败留下无 marker 半成品（当轮即被 loader 执行） | mismatch 后 `continue` | **已修**：mismatch → `rmSync(dest)` 清理 | 同上 ✅ |
| I7 | `importCancel`/`setCurrent` 无 UI 调用方（口径夸大） | 0009 README/能力声明 | **已收窄**：0009 README 改「importCancel/setCurrent 能力由插件 RPC 提供，UI 按钮为后续 hunk」；specs/203 R3 如实标注 | 文档 ✅ |
| M1 | `.current` 回读校验口径弱于插件侧 | `a/../../x` 可逃逸 | **已修**：与 validateSegment 同口径（拒分隔符/`..`/控制符/点开头） | `node --check` ✅ |
| M2 | 孤儿 `.import-*.json` 永久「进行中」并累积 | 无清扫 | **已修**：`sweepStaleProgress`（done≠true 且 >1h 即删，request 时触发） | 编译 ✅ |
| M3 | 终态进度写 -1 | UI 会显示非法值 | **已修**：终态用 `item.lastFiles/lastBytes` 真实计数 | 编译 ✅ |
| M4 | 插件文档漂移（旧凭据路径/`collect-app.mjs` 引用） | ark 残留 | **已修**：README.md / runtime.js / credentials.js 头注释 | 文档 ✅ |
| M5 | search 插件 base 为沙箱内 symlink 时穿透 | fenceResolve 无 realpath | **已修**：`realpathSync` 双侧比对 | `node --check` ✅ |
| M6 | `credentials.remove` 断言过松 | `removed>=0` 恒真枝 | **已修**：收紧为 `ok === true` | verify-git-plugin 全过 ✅ |
| M8 | tar 头 size 与数据读两次 stat 竞态 | 可产损坏 tar | **已修**：以 `readFileSync` 返回长度回填头部 | collect+smoke ✅ |
| M7 | 「删除」按钮无二次确认（不可逆批量删除） | 0009 dialog | **登记后续**：随 0009 下一次 hunk（需再生成补丁，单独评审） | — |
| M9 | `redactUrl` 口令含 `/` 脱敏不彻底 | ark 原版代码 | **登记 ark 同步项**（不在本轮擅改 ark 已验证逻辑） | — |
| M10 | search 20k 扫描上限/超长行丢弃不进 truncated | 元数据不完整 | **登记后续**（随 M7 一起小版本） | — |

## 复验（修复后全量回归）

- 语法：5 个改动 JS 全过 `node --check`
- Kotlin：`compileDebugKotlin` BUILD SUCCESSFUL
- 插件：`verify-git-plugin` 全过（P0-N add=88ms/commit=15ms/status=21ms/diff=17ms）；credentials 单测 0 fail
- 物化：幂等/复用/篡改自愈三段 host 模拟 ✅
- 载荷：`collect-opencode`（runtime 门禁挂钩）✅ → `smoke-node24` 全绿 + title=OC Desktop ✅
- APK：`assembleDebug` 163,944,484 B ✅

## 遗留（不阻塞合入）

1. M7/M10：0009 下一次 hunk（删除确认 + 扫描上限元数据）——与「取消按钮 UI 化」同批。
2. M9：`redactUrl` 边角——向 ark 上游提同步。
3. 真机轮：SAF 实机拷贝/取消、0600、`/data` 性能、JIT 矩阵、定制 ROM（能力清单 §5-8）。
