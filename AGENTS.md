# AGENTS.md — oc-desktop-android（Android Edition）

> 本文件定义了本工程中 AI Agent 必须遵守的规范与工作流程。
> 父工程总纲见 [`../AGENTS.md`](../AGENTS.md)；本文件聚焦本版别特有约束。

---

## 一、工程定位

**Android Edition** —— OC Desktop 的 **Android 版本**；与两个鸿蒙版别（[`../oc-desktop-ark`](../oc-desktop-ark)、[`../oc-desktop-hos`](../oc-desktop-hos)）**同构对标**：同一上游、同一服务端形态、同一补丁与插件体系。
本版**无 Electron、无内嵌浏览器内核**：进程内 Node（`io.github.fellow99:node-bridge`）承载 opencode v2 服务端，**系统 WebView** 同源渲染其 Web UI。

| 项 | 值 |
|---|---|
| 应用名 / 包名 | **OC Desktop Android** / `org.fellow99.oc.OCDesktopAndroid` |
| 版本 | `2.2.5` / `versionCode 20205` |
| 目标设备 | 平板 / 折叠屏 / 桌面窗口优先（phone 可用，不做专属设计） |
| 上游基线 | opencode **v2.2.5**（`9bbb8ce18c` / `Branch_v2.2.5`） |
| Node 运行时 | `io.github.fellow99:node-bridge:0.2.0` + node-runtime → Node 24.22.1 / arm64-v8a |
| 渲染 | 系统 WebView（`networkSecurityConfig` 放行 loopback 明文） |
| 数据 | `node:sqlite`（WAL）→ `<filesDir>/data/opencode/opencode.db` |
| 规划 | `docs/000-工程规划.md`（**唯一权威规划**） |
| 能力清单 | `docs/安卓环境能力清单-2.1.2.md` |
| 特色能力 | Git（isomorphic-git 插件）+ **pnpm（进程内 pnpm，本版新增）** |

> 本工程**非 opencode 团队构建**，与上游无隶属关系；opencode 仅是其桌面形态在 Android 上的第三方移植。

---

## 二、目录结构

```
app/src/             Kotlin 源码（MainActivity / 服务端装配 / WebView 壳）
scripts/             构建流水线（apply-patches / build-opencode / collect-plugins / collect-opencode / smoke-node24）
patches/             对上游的幂等补丁（0001/0003/0006/0007/0008 + 0009/0010/0011，含 SAF 工作区、品牌、硬返回接线）
specs/               NNN-name/{spec.md,plan.md} 规格体系
docs/                工程规划 + 能力清单
```

---

## 三、快速开始 / 构建

```bash
# ① 上游产物（host 侧；补丁 → bun → bundle-only → 裁剪 → 插件物化 → tar.gz）
node scripts/apply-patches.mjs
OPENCODE_NODE_TARGET=node24 BUN_BIN=<bun-1.4.2> node scripts/build-opencode.mjs
node scripts/collect-plugins.mjs
node scripts/collect-opencode.mjs
node scripts/smoke-node24.mjs

# ② APK
./gradlew :app:assembleDebug

# ③ 装机与启动
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.fellow99.oc.OCDesktopAndroid/.MainActivity
```

- CI：`v*` tag 触发 GitHub Actions 构建 debug APK 并发布 GitHub Release。
- 16 KB 页对齐运行时；minSdk 24 / targetSdk 36。

---

## 四、CodeGraph 代码地图（规范）

### 4.1 索引
- 本工程根目录已有**独立** `.codegraph/` 索引；父工程根目录另有聚合索引。
- 验证：`codegraph status`；缺索引 `codegraph init -i`。

### 4.2 查询
- 本工程内检索 → 在本目录执行；跨子工程全局检索 → 到父工程目录。
- **优先使用 codegraph**（代码库探索铁律），grep/Read 仅作细节确认。

### 4.3 更新（强约束）
> 本工程**已配置 `post-commit` 钩子**，提交后自动 `codegraph sync`。

```bash
cd /d/opencode-workspace/oc-desktop-android && codegraph sync
# 再到父工程，让聚合索引同步
cd /d/opencode-workspace && codegraph sync
```

- 日常 `codegraph sync`（增量）；切换分支/大重构 `codegraph index`（全量）；锁残留 `codegraph unlock`。

---

## 五、规格体系（specs）

本工程 `specs/` 模块（部分）：
- **基础（1XX）**：`101-runtime-integration`、`102-payload-pipeline`、`103-webview-shell`、`104-host-capabilities`、`105-auth`、`106-upstream-adaptation`、`107-compliance`、`109-regression`、`110-jitless`、`111-pty-integration`
- **插件（2XX）**：`203-plugin-workspace-picker`、`204-plugin-git`、`205-pnpm-plugin`、`206-js-search`
- **公共（0XX）**：`011-version-*`、`012-building-workflow`、`013-branding`

规范编写用 `specs-as-built`；开发用 `specs-based-devflow`；规格说明用 `speckit-*`。权威顺序：父宪法 → 父 overall → 工程规划 → 本文档 overall → 模块 spec/plan。

---

## 六、通用规范
- 中文交互/文档/提交注释；英文代码与术语。
- Git 提交用 Conventional Commits（加载 `git-commit` 技能，11 种 type，≤72 字符，禁 `--no-verify`）。
- 严禁提交敏感信息（注意 `keystore.properties` / `local.properties` / signing 材料均在 `.gitignore`，**严禁提交**）；禁 `as any`/`@ts-ignore`/空 `catch`。
- 多步骤任务先建 Todo；修复 Bug 只做最小改动；`opencode/` 只读，改动走 `patches/`。
- 调试用 `systematic-debugging`；代码审查用 `requesting/receiving-code-review`；需求规划用 `brainstorming`。

---
> **最后更新**：2026-11-02 · 上游基线 v2.2.5
