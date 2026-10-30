# 106-upstream-adaptation 技术方案（as-built）

> 实现于 20261029-1/2 轮；对应 spec.md；技术细节以源码为准。

## 1. 技术上下文
- 共用上游：`../opencode`（submodule，HEAD 锁 a517687fde / Branch_v2.1.2）
- 工具链：git apply（幂等判据 reverse-check）、bun 1.4.2（OPENCODE_NODE_TARGET=node24）、node ≥20

## 2. 文件清单
| 文件 | 职责 |
|---|---|
| patches/v2.1.2/0001…0008 | ark 五件套原样移植（逐字节一致） |
| patches/v2.1.2/0009-workspace-import-actions.patch | Android 专属：工作区对话框导入/取消/设为默认按钮 + roots.ts RPC 封装 + i18n（自门控 capabilities） |
| patches/v2.1.2/0010-branding-oc-desktop.patch | index.html title → OC Desktop |
| scripts/apply-patches.mjs | 基线守卫（HEAD/工作树）+ 逐条 forward/reverse-check + --reset --yes |
| scripts/build-opencode.mjs | bun install + build-node --bundle-only（BUN_BIN 可指 1.4.x；Windows shell 垫片处理） |
| scripts/collect-opencode.mjs | 裁剪入口：verify-runtime 挂钩 + plugins/** 入包 + ustar prefix 拆分 + 头长回填实测读长 |

## 3. 关键实现要点
1. 幂等三态：reverse-check 通过=已应用跳过；应用后必须再 reverse-check（不留半应用）。
2. 共用 submodule 串行纪律：--reset --yes 需显式；先打印将还原内容。
3. 0009 生成方法：五补丁态 → 临时 GIT_INDEX_FILE 不可行（CRLF）→ 改用
   「clean checkout → --include 限定 0007/0008 → .oc-five 镜像 → git diff --no-index 逐文件 + 前缀 sed」。
4. 已知坑：Windows `/dev/null` 重定向会生成名为 `nul` 的真实文件，挡住工作树守卫（已踩，`del \?\` 清理）。

## 4. 测试
- `apply-patches --reset --yes` → 7/7 应用 0 失败（每轮全量回归首步）。
- bundle 重建后 smoke 全绿（含品牌 title 断言）。
