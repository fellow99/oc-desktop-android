# 112-js-search —— grep/glob 纯 JS 搜索兜底（spec）

> 状态：🔶 as-built（2026-10-29 host 侧；工具注册实弹待真机）· 引用：能力清单 §5-3 · 对标：hos `102-harmony-js-tools`（本工程无 hos 仓，按能力清单描述实现）
> 模块：`plugins/oc-plugin-search/`（编号 112 顺延，ark 无对应）

## 1. 目标

Android 应用数据分区 noexec（规划 §4 L1）⇒ `rg`/`fff` 原生 ELF 不可得。本模块以纯 JS 注册同名
`grep` / `glob` 工具（上游工具面补位），会话内搜索可用且**如实上报上限与跳过**。

## 2. 需求与验收判据

| # | 需求 | 判据 |
|---|---|---|
| R1 | 工具注册 | `grep`/`glob` 经 `context.tool.transform` 注册；缺失即抛错（fail-visible） |
| R2 | 正确匹配 | grep 返回 `path:line: text`；glob 支持 `**`/`*`/`?`/`[abc]`/`{a,b}` |
| R3 | 上限如实 | 结果 ≤200 条（truncated 标注）；单文件 1MB、扫描 2 万文件封顶 |
| R4 | 跳过表 | `.git/node_modules/dist/build/out/target/.cache` 等目录 + 二进制（首 8KB 含 NUL）+ 超大文件计入 `metadata.skipped` |
| R5 | 围栏 | 路径消解必须仍在会话工作区内（`location.project.directory`），防 `..` 逃逸 |

## 3. as-built 判据核录（2026-10-29，host）

| # | 结果 | 证据 |
|---|---|---|
| R1 | ✅ 机制 | 注册路径与 ark git 插件同型（editor.add + editor.get 复核） |
| R2 | ✅ | 临时夹具 4 例全 PASS（`**/*.ts`/`src/*`/brace/负例；grep 2 匹配） |
| R3/R4 | ✅ | skipped 表实测（`.git/`、`node_modules/`、binary=1） |
| R5 | ✅ | fenceResolve 越界返回 out-of-root |

## 4. 依赖

102（collect-plugins 物化）；设备侧随真机轮验证会话内工具调用。
