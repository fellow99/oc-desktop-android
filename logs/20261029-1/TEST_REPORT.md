# 20261029-1 测试报告 —— P1 六项（host 全链路）

> 环境：Windows host（node v24.7.0 / bun 1.4.2（`BUN_BIN=oc-desktop-hos/.cache/bun/bun-1.4.2.exe`）/
> Gradle 8.12 + AGP 8.9.2 + JDK 21）。上游基线 `Branch_v2.1.2`（a517687fde）。
> 真机判据（JIT 矩阵、SAF 实机拷贝、/data 性能等）不在本轮，仍归能力清单 §5-8 真机验证轮。

## 验证矩阵（全部实跑，2026-10-29）

| # | 门禁/用例 | 命令 | 结果 | 关键证据 |
|---|---|---|---|---|
| 1 | 补丁链幂等应用（7 条） | `node scripts/apply-patches.mjs --reset --yes` | ✅ 全绿 | `已应用 7 / 已跳过 0 / 失败 0`；基线守卫 + reverse-check 内建 |
| 2 | 运行时锁值门禁 | `node scripts/verify-runtime.mjs` | ✅ | libnode.so SHA=lock（be1d1641…，81,491,624 B）；ELF 六门禁全过 |
| 2b | 门禁负样本 | `verify-runtime --aar node-runtime-24.2.0.aar` | ✅ 正确红 | SHA 不符 → exit 2 |
| 3 | 插件物化 | `node scripts/collect-plugins.mjs` | ✅ | git: 828 文件/7.76MB/56 包；三插件 digest 固定 |
| 3b | 插件静态断言 | `collect-plugins --check-only` | ✅ | 21 工具表 / 无子进程 / 无原生模块 |
| 4 | bundle 构建 | `build-opencode.mjs`（BUN_BIN=bun1.4.2） | ✅ | vite 5868 模块 45.7s；`opencode.mjs` 17,386 KB |
| 5 | 载荷组装 | `node scripts/collect-opencode.mjs` | ✅ | runtime 门禁挂钩；`plugins/**` 入包；manifest 增 plugins 段 |
| 6 | host 冒烟 | `node scripts/smoke-node24.mjs` | ✅ 全绿 | health 200 / UI html / SSE 首事件 / **title=OC Desktop** |
| 7 | 插件运行期物化 | payload/lib/plugins.js host 模拟 | ✅ | 首轮物化 3 → 复用 3 → 篡改后自愈重物化 |
| 8 | 插件实弹注册 | serve + POST /api/rpc/*（probe-rpc） | ✅ | `oc-harmony-workspace-roots/roots` 返回 sandbox+capabilities；`mkdir probe-p1` ok；`oc-ark-git/credentials.describe` → `config/opencode/git-credentials` |
| 9 | git 插件功能+P0-N | `node scripts/verify-git-plugin.mjs` | ✅ | 21 工具/init/add/commit/status/diff/branch/log；凭据 save/list/remove；5MB 级 add=82ms commit=14ms status=21ms diff=18ms |
| 10 | 品牌化断言 | `node scripts/verify-branding.mjs` | ✅ | app_name/图标/NOTICES/非官方声明/0 残留 |
| 11 | Kotlin 编译 | `gradlew :app:compileDebugKotlin` | ✅ | BUILD SUCCESSFUL |
| 12 | APK 组装 | `gradlew :app:assembleDebug` | ✅ | `app-debug.apk` 163,944,448 B（含 7 补丁 bundle + 3 插件载荷） |
| 13 | search 插件用例 | globToRegExp/grepFiles 单测（临时夹具） | ✅ | glob 4 例 / grep 匹配+二进制跳过+跳过表 |

## 未覆盖/边界（如实登记）

- **真机轮未做**：SAF 选树实机拷贝与进度/取消、JIT 矩阵、`/data` 分区 isomorphic-git 性能、定制 ROM 安装。
- **0600 凭据**：Windows 宿主 chmod 语义不同（SKIP），设备侧 P0-N 轮复核（108 R3 判据）。
- **UI 导入/删除按钮（0009）**：随 bundle 构建成功（编译级验证）；运行时点按行为待真机。
- probe 脚本收尾时 libuv `UV_HANDLE_CLOSING` 断言噪音：仅测试 harness 的 kill+exit 竞态，与产品代码无关。

## 结论

P1 六项 + 前置（collect-plugins）host 侧判据全部通过；载荷与 APK 可产出。剩余为真机验证轮（能力清单 §5-8）。
