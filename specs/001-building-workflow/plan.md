# 001-building-workflow —— 实施方案（plan）

> 日期：2026-10-29 · 回引：[spec.md](./spec.md)、规划 §14.3、102-payload-pipeline、`keystore.properties.sample`

## 1. 交付物

`.github/workflows/build-release.yml` —— 单 job 声明式工作流，全部命令零侵入复用 `scripts/*`。

## 2. 运行环境设计（runner 依赖矩阵）

| 依赖 | 版本/来源 | 依据 |
|---|---|---|
| runner | `ubuntu-latest` | hosted 预装 Android SDK（license 已接受，缺组件 AGP 自动补装）、git、bash |
| Node | `24`（actions/setup-node@v4） | 脚本执行 + `smoke-node24` host 门禁（本机实证 v24.7.0 同代） |
| bun | `1.4.2`（oven-sh/setup-bun@v2，钉死） | 上游 `build-node.ts` 版本守卫要求 `bun@^1.4.2`（CI 首跑实证：1.3.14 被拒）；README 快速开始同口径 |
| JDK | `17` temurin（actions/setup-java@v4，`cache: gradle`） | AGP 8.9.2 要求；顺带 Gradle 缓存 |
| Android SDK | hosted 预装 | compileSdk 36；hosted 镜像含 platform/build-tools，缺口 AGP 自动下载 |
| 引擎双包 | Maven Central | `node-bridge:0.2.0` + `node-runtime:24.22.1` 已发布（2026-10-27 实证），`settings.gradle.kts` 的 `mavenLocal()` 在 CI 为空但会顺位落到 `mavenCentral()` |

## 3. 关键决策

### D1 上游检出位置：workspace 内 `upstream-opencode/`，经 `OPENCODE_DIR`/`--repo` 注入

`actions/checkout` 的 `path` 不指向 workspace 外（避免 `../opencode` 逃逸的不确定性）。三个脚本均支持注入：

- `apply-patches.mjs --repo <abs path>`（脚本参数）
- `build-opencode.mjs` / `collect-opencode.mjs` / `smoke-node24.mjs`：`OPENCODE_DIR=<abs path>` 环境变量

### D2 载荷五步 = README 快速开始逐字口径

```
node scripts/apply-patches.mjs --repo "$UPSTREAM"                     # 基线守卫 + 幂等补丁
OPENCODE_DIR="$UPSTREAM" OPENCODE_NODE_TARGET=node24 node scripts/build-opencode.mjs
OPENCODE_DIR="$UPSTREAM" node scripts/collect-plugins.mjs             # isomorphic-git 物化（需网络）
OPENCODE_DIR="$UPSTREAM" node scripts/collect-opencode.mjs            # tar.gz + manifest → assets/
OPENCODE_DIR="$UPSTREAM" node scripts/smoke-node24.mjs                # host 门禁（全绿才打包）
```

- 不传 `OPENCODE_TARGET`：保持脚本默认 `linux-arm64`（与本地/规划口径一致，纯 JS bundle 的 bun 编译目标）。
- 不加 `--skip-install`：CI 全新环境必须 `bun install --os=* --cpu=*`。
- detached HEAD 于 `a517687fde` 满足 `apply-patches` ①基线 ②干净工作树两守卫。

### D3 签名：secrets 可选注入，无则 debug 兜底

Secrets 契约（全部可选，仓库 Settings → Secrets → Actions 配置）：

| Secret | 含义 |
|---|---|
| `KEYSTORE_BASE64` | `oc-desktop-android.keystore` 的 base64（`base64 -w0` 产出） |
| `KEYSTORE_PASSWORD` | storePassword |
| `KEY_ALIAS` | keyAlias（现库样例为 `oc-desktop-android`） |
| `KEY_PASSWORD` | keyPassword |

注入逻辑（shell 分支，写 `$GITHUB_ENV` 的 `VARIANT`）：

- 有 `KEYSTORE_BASE64` → 解码 keystore 到仓库根 + 以 `printf` 生成 `keystore.properties`（复用 `keystore.properties.sample` 的键名）→ `VARIANT=release`
- 否则 → `VARIANT=debug`（AGP 默认 debug keystore 签名，可直接安装）

两产物均落 `app/build/outputs/apk/{release,debug}/`，与 `build.gradle.kts` 现有条件签名逻辑（`keystoreProps.isNotEmpty()`）天然兼容，**gradle 侧零改动**。

### D4 发布：`softprops/action-gh-release@v2`，仅 tag 触发

- 触发面：`on.push.tags: ['v*']`（覆盖 `v0.12.1` 及后续 tag）+ `workflow_dispatch`（手动，仅构建验证）。
- Release 条件：`if: startsWith(github.ref, 'refs/tags/v')`。
- 附件：`dist/oc-desktop-android-<tag>.apk` + 同名 `.sha256`（`sha256sum` 生成）。
- `generate_release_notes: true` 自动变更说明；权限最小化 `permissions: contents: write`。
- 产物同时 `actions/upload-artifact@v4` 留存（含 workflow_dispatch 手动跑）。

### D5 版本不注入

APK `versionName=2.1.2/versionCode=20102` 维持 D16 冻结；tag 只进 Release 名与文件名（spec §3）。

## 4. workflow 步骤清单（step 级）

1. 检出本仓库（checkout@v4）
2. 检出上游 `anomalyco/opencode@a517687fde` → `upstream-opencode/`（fetch-depth: 1，ref 锁 SHA）
3. setup-node@v4（24）
4. setup-bun@v2（1.3.14）
5. setup-java@v4（17 temurin + gradle 缓存）
6. 载荷①–⑤（五步各一 step，见 D2）
7. 签名材料注秘（可选分支，见 D3）
8. `./gradlew :app:assemble${VARIANT} --stacktrace`（gradlew 已有可执行位）
9. 收集产物：重命名为 `oc-desktop-android-<ref_name>.apk` + SHA-256 清单
10. upload-artifact@v4（`dist/`）
11. gh-release@v2（仅 `refs/tags/v*`）

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| `actions/checkout` 拉取任意 SHA 需服务端 `allowReachableSHA1InWant` | GitHub 默认允许拉取可达 SHA；`a517687fde` 在 Branch_v2.1.2 可达 |
| hosted runner 缺 platform 36 | AGP 自动补装（hosted license 预接受）；如失效再显式 `android-actions/setup-android` |
| bun 版本漂移导致上游构建差异 | setup-bun 钉死 `1.4.2`（上游守卫 `^1.4.2` 硬约束，CI 首跑彩排实证） |
| `mavenLocal()` 空目录告警 | 仅为顺位仓库；`node-runtime:24.22.1` 已在 Central，实测可解析 |
| smoke-node24 需 Node ≥ 引擎同代 | setup-node 钉 24 |
| workflow_dispatch 时 `$GITHUB_REF_NAME` 为分支名 | 文件名兜底使用 ref_name，不发布 Release，无歧义 |

## 6. 不做的事

- 不改 `scripts/*`、`build.gradle.kts`、`settings.gradle.kts`（R7 已满足，无需动仓库解析配置）。
- 不加 PR/push-main 触发、不加 matrix、不加签名材料兜底仓库文件。
