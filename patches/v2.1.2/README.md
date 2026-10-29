# patches/v2.1.2 —— opencode v2.1.2 上游补丁（Android 版，五件套 + 两件 Android 专属）

本目录是**上游补丁**（不是本工程的构建脚本），由 `scripts/apply-patches.mjs` 幂等应用到
`../opencode`，再由 `scripts/build-opencode.mjs` / `scripts/collect-opencode.mjs` 构建投放。
契约见 `docs/000-工程规划.md` §5.10/§9 与 `specs/106-upstream-adaptation`。

## 基线（改动与验证的唯一基准）

| 项 | 值 |
|---|---|
| 仓库 | `../opencode`（上游，submodule，**与 ark/hos 共用**） |
| tag | **v2.1.2** |
| 提交 | **a517687fde**（`release: v2.1.2`），分支 `Branch_v2.1.2` |
| 补丁头路径 | `a/packages/...` → `b/packages/...`（`git apply` 默认 `-p1`） |

换基线必须**新建** `patches/<新 tag>/` 目录重生成补丁，本目录只对 v2.1.2 成立
（`scripts/apply-patches.mjs` 的 `EXPECTED=a517687fde` 会前置校验）。

## 与 ark 五件套的关系（移植记录，2026-10-29）

0001/0003/0006/0007/0008 **自 ark `patches/v2.1.2/` 原样复制**（`oc-desktop-ark` 同名同序；
基线相同、五条在新基线上 `git apply --check` 全过，无 Android 专属 hunk 需求——规划 §9 预期的
「条件名增补」已由 O5 关闭：`ohos` 条件名保留，Android 侧没有独立变体文件也不影响，
`pty.ohos.ts`/`binary.ohos.ts` 打桩文件正是 0003 需要的落点）。
两处 RPC 能力名与 UI 契约（`oc-harmony-workspace-roots` / `oc-ark-git`）**原样沿用**——
UI 侧硬编码见 `packages/app/src/workspaces/selection/roots.ts` 与
`packages/app/src/settings/git/credentials.ts`，插件侧必须一字不差。

在 ark 五件套之上，本工程追加两条 **Android 专属**补丁（编号顺延，均**自门控**）：

| 编号 | 落点文件 | 作用（摘要） |
|---|---|---|
| `0009-workspace-import-actions.patch` | `workspaces/selection/{roots.ts,dialog.tsx}`、`i18n/*` | 需求 203（Android）：工作区对话框沙箱 Tab 增加「导入(SAF)/删除」两动作（RPC `import`/`importStatus`/`remove`；`importCancel`/`setCurrent` 能力由插件 RPC 提供，UI 按钮为后续 hunk）；插件未提供 capabilities 时按钮不出现（自门控）。 |
| `0010-branding-oc-desktop.patch` | `packages/app/index.html` | 需求 107/E5：`<title>` OpenCode → OC Desktop（document.title 判据；归档断言由 smoke-node24 与 verify-branding 承担）。 |

## 补丁清单（ark 五件套）

| 编号 | 落点文件 | 作用（摘要） |
|---|---|---|
| `0001-node-target-ohos.patch` | `packages/cli/vite.node.config.ts` | ① `build.target` 支持 `OPENCODE_NODE_TARGET` 覆盖（本工程 Node 24 构建链）；② `resolve.conditions` 增 `ohos` 条件变体优先。 |
| `0003-runtime-stubs-ohos.patch` | `packages/core/package.json` + 新文件 `pty.ohos.ts` / `binary.ohos.ts` | PTY 打桩（`available=false`），避免 `@lydell/node-pty` 顶层加载失败中断 bundle import。 |
| `0006-shell-select-ohos.patch` | `packages/core/src/shell/select.ts` | ① `stat()` 的 `EACCES` 与 `ENOENT` 一视同仁；② `fallback()` 增认 `OC_SHELL_FALLBACK`。 |
| `0007-workspace-roots-picker.patch` | 新文件 `workspaces/selection/roots.ts`(+test)；改 `dialog.tsx`、`i18n/*` | 需求 203：工作区目录选择对话框升级（沙箱/文档/下载根 + 插件 RPC），自门控回退上游行为。 |
| `0008-git-credentials-settings.patch` | 新文件 `settings/git/*`；改 `settings/{route,pages,shell}.tsx`、`i18n/*` | 需求 108：「设置 → Git」凭据页，自门控。能力侧由壳插件 `plugins/oc-plugin-git` 提供。 |

## 生成/验证命令（可复现）

```bash
# 在 ../opencode（干净 v2.1.2 工作树）上逐条验证：
git apply --check <patch>            # 正向可应用（未应用态）
git apply -R --check <patch>         # 应用态反向可应用（幂等判据）
node scripts/apply-patches.mjs --check   # 本工程入口（基线守卫 + 逐条状态）
```
