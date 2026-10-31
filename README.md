# OC Desktop · Android Edition（`oc-desktop-android`）

> **版别定位：Android Edition** —— OC Desktop 的 **Android 版本**；与两个鸿蒙版别（[`oc-desktop-ark`](../oc-desktop-ark)、[`oc-desktop-hos`](../oc-desktop-hos)）**同构对标**：同一上游、同一服务端形态、同一补丁与插件体系。
>
> 本版**无 Electron、无内嵌浏览器内核**：进程内 Node（`io.github.fellow99:node-bridge`，Maven Central）
> 承载 opencode v2 服务端，**系统 WebView** 同源渲染其 Web UI。
>
> 本工程**非 opencode 团队构建**，与 [opencode](https://github.com/anomalyco/opencode) 无隶属关系；opencode 为上游开源项目（MIT），
> 本工程仅是其桌面形态在 Android 上的第三方移植。

| 项 | 值 |
|---|---|
| 应用名 / 包名 | **OC Desktop Android** / `org.fellow99.oc.OCDesktopAndroid` |
| 版本 | `2.2.5` / `versionCode 20205` |
| 目标设备 | 平板 / 折叠屏 / 桌面窗口优先（phone 可用，不做专属设计） |
| 上游基线 | opencode **v2.2.5**（tag `v2.2.5` / 提交 `9bbb8ce18c` / 分支 `Branch_v2.2.5`） |
| Node 运行时 | `io.github.fellow99:node-bridge:0.2.0` + `io.github.fellow99:node-runtime`（Maven 双包）→ Node 24.x（引擎版本以 aosp-node-runtime 仓 `runtime.lock.json` 为准，当前 24.22.1 / arm64-v8a） |
| 渲染 | **系统 WebView**（应用进程内；`networkSecurityConfig` 放行 loopback 明文） |
| 数据 | `node:sqlite`（WAL）→ `<filesDir>/data/opencode/opencode.db` |
| 规划 | [`docs/000-工程规划.md`](docs/000-工程规划.md)（**唯一权威规划**，v0.3） |
| 能力清单 | [`docs/安卓环境能力清单-2.1.2.md`](docs/安卓环境能力清单-2.1.2.md)（对标 ark/hos 落地面 + 待实现项） |
| 特色能力 | Git（isomorphic-git 插件）+ **pnpm（进程内 pnpm，本版新增）** |

## 快速开始（✅ Phase 0 已落地；载荷产物需先构建）

```bash
# ① 上游产物（host 侧；补丁 → bun → bundle-only → 裁剪 → 插件物化 → tar.gz）
node scripts/apply-patches.mjs            # 幂等补丁 + 基线守卫（Branch_v2.2.5，基线 9bbb8ce18c；7 条 = ark 五件套 + 0009/0010）
OPENCODE_NODE_TARGET=node24 BUN_BIN=<bun-1.4.2> node scripts/build-opencode.mjs   # --bundle-only（上游 build-node 守卫要求 bun ^1.4.2；CI 同口径）
node scripts/collect-plugins.mjs          # 插件物化（git/workspace-roots/search → build/plugins）
node scripts/collect-opencode.mjs         # verify-runtime 门禁 + 插件入包 → assets/opencode-dist.tar.gz + SHA-256 清单
node scripts/smoke-node24.mjs             # host 门禁（含品牌 title 断言；全绿才打包）

# ② APK
./gradlew :app:assembleDebug

# ③ 装机与启动
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.fellow99.oc.OCDesktopAndroid/.MainActivity
```

> **CI**：推送 `v*` tag（如 `v0.12.1`）自动执行以上①②并发布 GitHub Release（[.github/workflows/build-release.yml](.github/workflows/build-release.yml)；规格见 [`specs/001-building-workflow/`](specs/001-building-workflow/spec.md)。签名 secrets 可选：不配则出 debug 签名包）。

## 装机前必须知道

| # | 事项 |
|---|---|
| 1 | **载荷必须先构建**：`assets/opencode-dist.tar.gz` 为空时应用会显示「载荷缺失」错误页（预期行为） |
| 2 | **JIT 是能力前提**：引擎 24.22.1 在 Android 15(API 36) 已实测 JIT+WASM 可用（桥仓 R2 记录）；`--jitless` 仅作诊断（会废掉 WASM/fetch） |
| 3 | **工作区是导入制**：SAF 选择目录（`content://`）后拷入沙箱作为项目根，不申请全局存储权限 |
| 4 | **pnpm 默认忽略生命周期脚本**：脚本无法在子进程跑 Node；放行需白名单并显式提示 |

## 目录

```
app/          Android 宿主（MainActivity / WebView 壳 / 启动编排 / 宿主能力）
payload/      Node 侧启动脚本（opencode-server.js + unpack.js + lib/*）
patches/      上游幂等补丁（对标 ark：0001/0003/0006/0007/0008）
plugins/      壳插件（oc-plugin-git / oc-plugin-workspace-roots / oc-plugin-pnpm）
scripts/      构建与门禁流水线（apply-patches / build / collect / smoke / verify）
specs/        规格体系（对标 ark：101–111、203、205）
docs/         工程规划（唯一权威）+ 真机验证记录 + 证据
```

## 已知限制（继承自运行时与平台）

`node::Start` 每进程一次（崩溃即终态）· 不能 spawn node ELF（git/pnpm/opencode 全部进程内）· PTY / 系统 git / `rg` 不可用 ·
`bash` 工具取决于 `/system/bin/sh` 实测 · MIUI 等定制 ROM 需开启「USB 安装」· 后台常驻为可选前台服务（默认关）。

详见 `docs/000-工程规划.md` §8.2 / §12 与 `aosp-node-bridge/docs/002-真机验证记录.md`。

## 许可

MIT（见 `LICENSE`）。随包分发 Node.js / pnpm / isomorphic-git 适用其上游许可（见 `docs/000-工程规划.md` §13 G3）。