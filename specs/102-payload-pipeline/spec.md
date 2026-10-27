# 102-payload-pipeline —— 载荷流水线（spec）

> 状态：✅ as-built（2026-10-28）· 引用：规划 §5.2/§5.7/§7.1、宪法 C3/C4 · 实现：`scripts/{collect-opencode,smoke-node24}.mjs`、`payload/unpack.js`、`OpencodeRuntime.ensurePayload`

## 1. 目标

把上游 opencode CLI 产物变成 APK 资产，并在设备上**幂等自解包**，供进程内 Node `import`。

## 2. 需求与验收判据

| # | 需求 | 判据 | 实测 |
|---|---|---|---|
| R1 | 基线守卫 | 上游 HEAD ≠ 锁定基线（a517687fde / v2.1.2）时 collect 拒绝产出（码 2） | ✅ 脚本断言 |
| R2 | 产物形态 | `assets/opencode-dist.tar.gz`（ustar+gzip）+ manifest（schema/version/baseline/tarSha256/files/bytes） | ✅ 37.2MB / 69.6MB 解包 / 41 文件 |
| R3 | host 门禁 | smoke：`--version`、serve(--port 0)、`/global/health` 200、`/` UI html、`/api/event` SSE 首帧；任一红不进 APK | ✅ 全绿 |
| R4 | 投放 | Kotlin 仅字节拷贝到 `incoming/`；**解包/校验/marker 全在 Node** | ✅（宪法 C3） |
| R5 | 幂等自解包 | manifest(version+tarSha256) 命中 → 跳过；版本/内容变化 → 重建；断点安全（staging+原子替换）；路径穿越防护 | ✅ T-E3 + host T-H4 |
| R6 | AGP 兼容 | assets `*.tar.gz` 被 AGP 预解压为 `*.tar` 时仍可工作（双名探测 + gzip 魔数 `1f 8b`） | ✅ 两形态真机均过 |
| R7 | 载荷版本升级 | 换 version → 重拷贝 + 重解包（旧目录原子让位） | ✅ 设计+单侧验证 |
| R8 | 产物不入库 | tar.gz/manifest 已 gitignore；缺失时 App 出「载荷缺失」指引 | ✅ T-E2 |

## 3. 裁剪与体积

- 本迭代**不裁剪** assets（P0-C/K 未出真机结论前保留全部 wasm，JIT 主线依赖 WASM）；后续按 106 收集规则裁剪平台无关冗余。
- 体积实测：gz 37.2MB；APK(debug) 122MB（含引擎 81MB）。

## 4. 边界与后续

- 上游 bundle 为 stock（零补丁，C4）；106 引入补丁后本流水线在 collect 前插入「apply-patches + 重建 bundle」步骤，契约不变。
- `OPENCODE_NODE_ASSETS_DIR` 必须指向解包后 `assets/`（bundle 非 SEA 形态的 UI 归档读取点）。
