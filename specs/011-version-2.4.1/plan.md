# 011-version-2.4.1 技术方案（oc-desktop-android，As-Built）

> 对应规格：[spec.md](./spec.md) ｜ 最后更新：2026-11-25

## 1. 基线

| 项 | 值 |
|---|---|
| 上游 | `opencode` submodule，tag `v2.4.1` / `6f0514052a` / `Branch_v2.4.1` |
| 应用 | `2.4.1` / `20401` |
| 补丁 | `patches/v2.4.1/`（6 条；历史目录只读） |
| 构建 bun | 1.4.5（上游要求 ^1.4.4） |

## 2. 补丁矩阵

| 补丁 | 迁移 |
|---|---|
| `0001-node-target-ohos` | 原样 |
| `0003-runtime-stubs-ohos` | 原样 |
| `0006-shell-select-ohos` | **重生成** |
| `0010-branding-oc-desktop` | **重生成**（上游改用 `%BASE_URL%`） |
| `0011-android-hardware-back` | **重做**（settings 改状态机 API） |
| `0012-pty-inprocess` | **重做**（新增惰性 `pty.android.ts`） |
| `0007` / `0008` / `0009` | ⬜ 待重做 |

## 3. 命令链

```bash
node scripts/apply-patches.mjs
OPENCODE_NODE_TARGET=node24 node scripts/build-opencode.mjs
node scripts/collect-plugins.mjs
node scripts/collect-opencode.mjs
node scripts/smoke-node26.mjs --allow-version-drift
./gradlew :app:assembleDebug
```

## 4. 结果

- 补丁 6/6 应用、0 失败；bundle（node24）24.78 MB。
- `verify-runtime`：`node-bridge@0.2.0` + `node-runtime@26.13.0` 与 `runtime.lock.json` 一致；`libnode.so` SHA/体积/ELF/16 KB 全过。
- `smoke-node26 --allow-version-drift` **全绿**：`--version`、`/global/health` 200、`/` 200（9463 B）、`<title>OC Desktop`、SSE 首事件。
- `0012` 重做的原因：上游在模块初始化期 `require` node-pty，linux-arm64 包在 win32 分支引用缺失的
  `./windowsTerminal` → host 门禁直接崩；改为惰性 `pty.android.ts` 后既保住 host 门禁，也让设备侧原生
  模块缺失只影响终端而不是整个服务端。
- `gradlew :app:assembleDebug` → `app-debug.apk` 139 MB，`versionCode 20401` / `versionName 2.4.1`。

## 5. 待收敛项

| # | 项 | 状态 | 建议 |
|---|---|---|---|
| V-01 | `0007` / `0008` / `0009` 在新状态机上重做 | ⬜ | 同 ark/hos |
| V-02 | 安卓真机回归（ADB 未见设备） | ⬜ | 打开 USB 调试后复跑 |
| V-03 | `OPENCODE_NODE_TARGET` 与运行时 26.13.0 对齐 | ⬜ | 改为 node26 并复跑冒烟 |
