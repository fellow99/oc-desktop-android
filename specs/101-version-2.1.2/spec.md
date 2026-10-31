# 101 — 版本更新：2.1.2 功能规格（android）

> 状态：✅ done（2026-10）· 引用：规划 §12 R7；跨端统一模块名 `101-version-2.1.2`（由原 111 更名，对标 hos/ark）
> 当前基线：opencode **v2.1.2**（tag/分支 `Branch_v2.1.2`，HEAD `a517687fde`）✅ 已核

## 1. 目标

上游升级（v2.1.2 → 新 tag）时，逐项核对 serve/鉴权/UI 托管契约是否漂移；漂移则触发补丁（106）或适配。

## 2. 核对单（升级时逐项打勾，附上游 path:line 证据）

| # | 契约点 | 核对内容 | 当前依据 |
|---|---|---|---|
| C1 | serve 语义 | `serve --hostname --port`；`server listening on <url>` 就绪信号 | server-process（嗅探依赖此行） |
| C2 | 鉴权三通道 | Basic / `?auth_token=` / Cookie；前端 `entry.tsx` 读取后自抹 | §2.2(d)(e) |
| C3 | UI 同源托管 | 非 API 路径回落内嵌 SPA；归档经 `OPENCODE_NODE_ASSETS_DIR/app-archive.bin`（非 SEA） | vite.node.config.ts appAssetsPlugin |
| C4 | SSE 路由 | 全局事件 `/api/event`（Effect HttpApi event.subscribe） | protocol/groups/event.ts:44 |
| C5 | health 路由 | `/global/health`（根命名空间） | smoke 实测 |
| C6 | 凭据面 | credential store + `/api/credential`；auth.json 迁移仅首建 | core/credential + migration |
| C7 | SQLite | `node:sqlite` WAL 兼容（DB 路径由 `OPENCODE_DB` 指定） | D8 + P0-B |
| C8 | 目录根 | XDG 四目录 + `os.homedir()` 可写 | D9 + global-roots.ts |
| C9 | 补丁面 | 新基线重建 `patches/<新 tag>/`；正反向往返校验 | §9 纪律 |
| C10 | 引擎匹配 | 新上游对 Node 版本要求 ↔ runtime.lock 可选集 | lock 多版本并存 |

## 3. 流程

新 tag → `scripts/collect-opencode.mjs`（改 EXPECTED_BASELINE/VERSION）→ smoke → 设备回归四件套（109）→ 本核对单逐项复核 → 更新 TECH.md 基线行。
