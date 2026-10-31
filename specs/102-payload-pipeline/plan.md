# 102-payload-pipeline 技术方案（as-built）

> 对应规格：[spec.md](./spec.md) ｜ 状态：✅ as-built ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 上游 | opencode v2.2.5 `9bbb8ce18c` | `patches/v2.2.5/README.md` |
| 构建 | bun 1.4.x，`build-node --bundle-only`，target node24 | `scripts/build-opencode.mjs` |
| 打包 | Node 自写 ustar + gzip | `scripts/collect-opencode.mjs` |
| 设备解包 | Node `payload/unpack.js` | 流式 tar 解析 |
| 资产 | `app/src/main/assets/opencode-dist.tar.gz` | 生成，gitignore |

## 2. 关键决策

- **Kotlin 只拷贝字节**，解包/校验/marker 全在 Node（宪法 C3）。
- **双名探测 + 魔数判定**：兼容 AGP 把 `*.tar.gz` 预解压为 `*.tar`。
- **staging + 原子替换**：防断点/半包。
- **manifest 命中即跳过**：`version + tarSha256`。
- **路径穿越防护**：拒绝 `..`/绝对路径。

## 3. 数据模型

```
PayloadManifest {
  schema: 1
  version: "2.2.5"
  baseline: "9bbb8ce18c"
  tarSha256: "..."
  files: int
  bytes: int
}
UnpackMarker { version, tarSha256, unpackedAt }
```

## 4. 接口契约

### 4.1 提供

- `collect-opencode.mjs` → tar.gz + manifest；
- `unpack.js` → `ensureUnpacked(tar, dist, version)`；
- `OpencodeRuntime.ensurePayload()` → `incoming/`。

### 4.2 消费

- 上游 `dist-node/`；
- `smoke-node24.mjs`；
- `OPENCODE_NODE_ASSETS_DIR`。

## 5. 实现策略

1. 基线守卫（HEAD/版本）；
2. 收集 `dist-node/` + assets；
3. 写 ustar（512 对齐）+ gzip；
4. 计算 SHA-256 与 manifest；
5. 设备首启拷贝 assets → `incoming/`；
6. Node 判定 gzip/裸 tar → 解包到 `dist.tmp-<pid>` → 原子替换；
7. 写 manifest；失败保留旧目录。

### 错误处理

- 哈希不符：拒绝启动，错误页；
- 缺资产：明确“载荷缺失”；
- 路径穿越：拒绝该条目并失败。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| 基线 | 错基线 collect 退出码 2 |
| 形态 | tar.gz / 裸 tar 均可解包 |
| 幂等 | 二次启动跳过解包 |
| 升级 | version 变化触发重建 |
| 门禁 | smoke `/global/health` 200、`/` SPA、SSE 首帧 |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `scripts/collect-opencode.mjs` | 打包 + manifest |
| `scripts/smoke-node24.mjs` | host 门禁 |
| `payload/unpack.js` | 设备解包 |
| `payload/opencode-server.js` | 调用解包 |
| `app/src/main/assets/opencode-dist.tar.gz` | 生成资产 |

## 8. 与规格交叉引用

- R1 → `apply-patches`/`collect` 基线守卫
- R2/R4/R5/R6/R7 → `payload/unpack.js`
- R3 → `smoke-node24.mjs`
- R8 → `.gitignore` + 错误页
