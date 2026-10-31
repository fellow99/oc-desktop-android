# 011-version-2.1.2 技术方案（as-built，历史锚点）

> 对应规格：[spec.md](./spec.md) ｜ 状态：✅ done（2026-10） ｜ 最后更新：2026-11-01
> 说明：本文件为 v2.1.2 升级轮的历史技术记录；当前基线已是 v2.2.5，见 [`../011-version-2.2.5/`](../011-version-2.2.5/)。

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 上游 | opencode v2.1.2 `a517687fde` / `Branch_v2.1.2` | submodule |
| Node | `node-runtime:24.22.1` | `gradle/libs.versions.toml` |
| 应用 | 2.1.2 / 20102 | `app/build.gradle.kts`（历史） |
| 补丁 | `patches/v2.1.2/` 8 条 | 目录 |
| 引擎 | 16 KB 对齐 arm64-v8a | `runtime.lock.json` |

## 2. 关键决策

- **升级前逐项核对** serve/鉴权/UI/SSE/health/凭据/SQLite/目录/补丁/引擎。
- **补丁按新 tag 重建**，不就地改旧补丁。
- **先 host 冒烟再打包**；真机回归四件套。
- **文档同步**：`TECH.md` 基线行、`patches/v2.1.2/README.md`、版本规格。

## 3. 数据模型

```
UpgradeCheck {
  contract: "serve|auth|ui|sse|health|credential|sqlite|dirs|patches|engine"
  evidence: "upstream path:line | command output"
  drift: bool
  action: "none|patch|adapt"
}
```

## 4. 接口契约

### 4.1 提供

- 升级核对单（spec §2 C1–C10）；
- 补丁重建与基线守卫；
- 回归四件套入口。

### 4.2 消费

- 上游 v2.1.2 源码；
- `scripts/apply-patches.mjs`、`collect-opencode.mjs`、`smoke-node24.mjs`；
- `109-regression`。

## 5. 实现策略

1. `collect-opencode.mjs` 更新 `EXPECTED_BASELINE=a517687fde` / `VERSION=2.1.2`；
2. `patches/v2.1.2/` 按上游重生成；
3. `apply-patches --check` 通过；
4. 构建 + smoke；
5. 真机回归（会话/流式/看图/工作区/返回）；
6. 更新 `TECH.md` 与版本规格。

### 错误处理

- 基线不符：停止，不自动 reset；
- 补丁反向失败：重建补丁；
- smoke 红：不打包。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| 基线 | HEAD `a517687fde` |
| 补丁 | 8/8 应用、反向通过 |
| 载荷 | 69.6MB / 41 文件（历史） |
| smoke | health 200、SPA、SSE |
| 真机 | 20261028/29 轮 |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `patches/v2.1.2/` | 历史补丁 |
| `specs/011-version-2.1.2/spec.md` | 核对单 |
| `docs/真机验证记录.md` | 证据 |
| `scripts/collect-opencode.mjs` | 基线/版本 |

## 8. 与规格交叉引用

- C1–C10 → `spec.md` §2
- 流程 → `spec.md` §3
- 当前版本 → `../011-version-2.2.5/`
