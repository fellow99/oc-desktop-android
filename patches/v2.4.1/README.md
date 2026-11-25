# patches/v2.4.1 — oc-desktop-android 上游幂等补丁

基线：opencode **v2.4.1**（tag `v2.4.1` / 提交 `6f0514052a` / 分支 `Branch_v2.4.1`）。

| 补丁 | 落点 | 作用 | 为什么上游不能直接接受 | v2.4.1 迁移 |
| --- | --- | --- | --- | --- |
| `0001-node-target-ohos` | `packages/cli/vite.node.config.ts` | `OPENCODE_NODE_TARGET` 覆盖 + `ohos` 条件优先 | 上游只支持三平台 + node26 SEA | 原样 |
| `0003-runtime-stubs-ohos` | `packages/core/package.json` + `pty.ohos.ts` / `binary.ohos.ts` | `ohos` 变体打桩（`available=false`） | 上游无 ohos 原生 pty | 原样 |
| `0006-shell-select-ohos` | `packages/core/src/shell/select.ts` | `stat()` 吞 `EACCES` + `OC_SHELL_FALLBACK` | 上游未处理应用域 `EACCES` | **重生成** |
| `0010-branding-oc-desktop` | `packages/app/index.html` | `<title>` → `OC Desktop` | 品牌化是发行方决策 | **重生成**（上游改用 `%BASE_URL%`） |
| `0011-android-hardware-back` | `entry.tsx`、`runtime/android/back.ts`、`session/screen.tsx`、`settings/shell.tsx` | 硬件返回键接线（宿主 `evaluateJavascript("window.__ocAndroidBack()")`） | 上游无 Android 宿主返回处理 | **重做**（`settings` 改状态机 API：`search.active()/back()`、`view()`、`back()`、`close()`） |
| `0012-pty-inprocess` | `packages/cli/vite.node.config.ts` + `packages/core/package.json` + `pty/pty.android.ts` | `android` 条件优先；`#pty` 走**惰性**加载的 node-pty；`#persistent-pty-binary` 走 in-process | 上游在模块初始化期 `require` 原生 pty，且无 android 条件 | **重做**（新增惰性变体） |

## 0012 为什么改成惰性变体（本轮关键结论）

上游 `pty.node.ts` 在**模块初始化期**执行 `createRequire(...)(process.env.OPENCODE_NODE_PTY_PATH ?? "@lydell/node-pty")`：

1. 载荷按 `linux-arm64` 构建，`@lydell/node-pty-linux-arm64/lib/index.js` 在 `process.platform === "win32"`
   分支里 `require('./windowsTerminal')` —— 该文件只存在于 win32 包。在 Windows 构建机上跑 host 门禁
   （`smoke-node26.mjs`）会直接在 bundle 导入期崩掉。
2. 设备侧若原生模块缺失或 ABI 不符，同样会让**整个服务端**起不来，而不是"终端不可用"。

`pty.android.ts` 把加载推迟到第一次 `spawn()`，类型与错误面与 `pty.node.ts` 完全一致：
加载失败只影响发起终端的调用方（与 ohos 桩同一条自门控约定）。

## v2.2.5 → v2.4.1 迁移记录

- **原样复用（3 条）**：`0001` / `0003` / `0012`→重做（见下）。
- **重生成 / 重做（4 条）**：`0006`、`0010`、`0011`、`0012`。
- **本轮未迁移（3 条，⬜ 待重做）**：
  - `0007-workspace-roots-picker`、`0009-workspace-import-actions`（`workspaces/selection` 状态机重构）；
  - `0008-git-credentials-settings`（`settings` 状态机重构）。
  见 `specs/011-version-2.4.1/tasks.md` T1-9 ~ T1-12。三者自门控，缺失时完整回退上游行为。

## 验证（2026-11-25）

- `apply-patches.mjs`：基线 `6f0514052a`、工作树干净、6/6 应用、0 失败。
- `build-opencode.mjs`（`OPENCODE_NODE_TARGET=node24`）：bundle `opencode.mjs` 24.78 MB。
- `collect-plugins`（workspace-roots / search / pnpm 插件）+ `collect-opencode`：载荷 tar.gz + 清单。
- `verify-runtime`：`node-bridge@0.2.0` + `node-runtime@26.13.0`（arm64-v8a）与 `runtime.lock.json` 一致；
  `libnode.so` SHA-256 / 体积 / ELF / 16 KB 对齐全过。
- `smoke-node26.mjs`（`--allow-version-drift`）：`--version`、`/global/health` 200、`/` 200（9463 B）、
  `<title>OC Desktop`、SSE 首事件 —— **全绿**。
- `gradlew :app:assembleDebug`：`app-debug.apk` 139 MB，`versionCode 20401` / `versionName 2.4.1`。
