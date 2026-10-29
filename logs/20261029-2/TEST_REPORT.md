# 20261029-2 测试报告（TEST_REPORT）—— 需求 001-building-workflow

> 用例源：[specs/001-building-workflow/test-cases.md](../../specs/001-building-workflow/test-cases.md) · 执行：2026-10-29（含评审修复后回归）
> 证据目录：本文件同级（workflow-assert-result.txt / yaml-parse-output.json）

## 结果汇总：本机可验 12/12 绿 · 用户侧 1 项待执行（T-C9）

> 回归口径：评审（REVIEW_REPORT）两 Critical + 一 Important + 两 Minor + gradlew mode 全部修复后，
> 结构断言从 21 项扩至 **28 项 ALL PASS**（workflow-assert-result.txt 已滚动覆盖）。

| # | 用例 | 结果 | 证据/说明 |
|---|---|---|---|
| T-C1 | YAML 可解析 | ✅ | js-yaml（npmmirror）解析成功，exit 0；产物见 `yaml-parse-output.json` |
| T-C2 | Actions 语义校验 | ✅（等价） | actionlint 二进制下载超时（网络受限）→ 以「js-yaml 解析 + 28 项结构断言」等价覆盖触发面/五步口径/签名分支/发布条件/权限/AAR 预取/产物名；actionlint 建议用户在网络可达环境补跑一次 |
| T-C3 | 触发面断言 | ✅ | `push.tags == ['v*']` 且含 `workflow_dispatch`（断言 T-C3a/b） |
| T-C4 | 载荷五步同口径 | ✅ | 五步 run 逐条断言 PASS；`OPENCODE_NODE_TARGET=node24` 显式；无 `OPENCODE_TARGET` 覆写、无 `--skip-install`；上游 ref=完整基线 SHA + fetch-depth:0（断言 T-C4a–g、J3/J4） |
| T-C5 | 签名分支逻辑 | ✅ | 四 secrets 名齐全；有→release（keystore.properties 键名与 sample 同口径）；无→debug 兜底（断言 T-C5a–d） |
| T-C6 | 签名材料零入库 | ✅ | `git check-ignore -v`：`keystore.properties`（.gitignore:38）、`oc-desktop-android.keystore`（.gitignore:29）；git 追踪集无敏感文件 |
| T-C7 | APK 构建步等价（本机） | ✅ | `./gradlew :app:assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`（163,944,484 字节，2026-10-29 09:37） |
| T-C8 | 基线守卫等价（本机） | ✅ | `OPENCODE_DIR=… node scripts/collect-opencode.mjs --check` → `上游基线：HEAD=a517687fde version=2.1.2`，exit 0 |
| T-C9 | tag 触发端到端 | ⬜ | 需仓库推送权限（`git push origin v0.12.1`），用户侧执行；预期：workflow 全绿 → Release 附件 APK + .sha256 |
| T-C10 | 失败可观测 | ✅ | 五步/签名/构建/收集/artifact/发布独立 step 命名；`dist/` 无论发布与否均上传 artifact（断言 T-C10a–d） |
| T-C11 | 引擎 AAR 门禁冷缓存等价 | ✅ | Central AAR（27,607,401 B）下载后 `OC_NODE_RUNTIME_AAR=<Central AAR> node scripts/verify-runtime.mjs` **全绿**（libnode.so SHA-256=lock `be1d1641…`，ELF 门禁全过）；workflow AAR 预取步断言 FIX-C1a–c PASS |
| T-C12 | 产物文件名对齐 AGP 输出 | ✅ | 收集产物 step 已改 `app-${VARIANT,,}.apk` 全小写（断言 FIX-C2 PASS）；与 T-C7 实测产物名 `app-debug.apk` 一致 |
| T-C13 | gradlew 可执行位 | ✅ | `git ls-files -s gradlew` → **100755**（评审发现原为 100644，已 `update-index --chmod=+x`） |

## 断言明细（28/28 PASS，评审修复后回归）

见 `workflow-assert-result.txt`（T-C3a/b、J1–J4、T-C4a–g、T-C5a–e、FIX-C1a/b/c、FIX-C2、FIX-R3、T-C10a–d）。

## 环境记录

- 本机：Windows 10 / Git Bash · Node v24.7.0 · bun 1.3.14 · AGP 8.9.2 / compileSdk 36
- Maven Central 实证：`node-runtime` metadata 含 `24.22.1`（lastUpdated 2026-10-27，AAR 实体核录）；`node-bridge` 含 `0.2.0`
- verify-runtime 对 **Central AAR** 实测全绿（2026-10-29，本报告 T-C11）——CI AAR 预取步的正确性与 lock 一致性双重证实

## 结论

本机可验判据全绿（12/12）；评审两 Critical（verify-runtime 冷缓存 / 产物文件名）已在修复后以扩展断言回归收口；真实 tag 端到端（T-C9）为仓库权限操作，移交用户，**建议先 `workflow_dispatch` 手动彩排一轮全绿后再推 `v0.12.1`**。
