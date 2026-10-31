# 110-jitless 技术方案（planned / diagnostic only）

> 对应规格：[spec.md](./spec.md) ｜ 状态：⬜ planned（仅诊断，不进产品） ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 运行时 | node-bridge 0.2.0 / node-runtime 24.22.1 | `gradle/libs.versions.toml` |
| 诊断开关 | `NodeRuntimeOptions.jitless=true` 或 `execArgv=["--jitless"]` | 桥 API |
| 产品路径 | `execArgv` 恒空 | `OpencodeRuntime` |
| 上游 | opencode v2.2.5 | `patches/v2.2.5/` |

## 2. 关键决策

- **不排产**：jitless 会废掉 WASM/fetch，与产品主线互斥。
- **仅诊断**：保留方法论与守卫参考，不进入 debug/release 默认路径。
- **若未来需要**：只在诊断 build 打开，并如实上报 `jitless:true` 与降级事实。

## 3. 数据模型

```
RuntimeOptions { jitless: bool, execArgv: string[] }
Facts { jitless: bool, wasm: bool, fetch: bool }
```

## 4. 接口契约

### 4.1 提供（诊断）

- 诊断 build 可设置 `jitless=true`；
- `/facts` 类诊断返回 `jitless` 与能力降级。

### 4.2 消费

- 桥 `NodeRuntimeOptions`；
- `102-payload-pipeline` 的投放期 transform（若需 photon shim）。

## 5. 实现策略（仅诊断）

1. 新增 diagnostic build flavor 或本地开关；
2. 启动时设置 `jitless=true`；
3. 记录 `WebAssembly`/fetch 可用性；
4. 产品 build 断言 `execArgv` 为空。

### 错误处理

- jitless 下 fetch 失败 → 诊断页明示，不当作产品缺陷；
- 不得把 jitless 设为默认。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| 产品路径 | `execArgv` 为空 |
| 诊断路径 | Node 启动、非 WASM 功能可用 |
| 事实上报 | `jitless:true` 可见 |
| 回归 | 默认 build 零回归 |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `specs/110-jitless/spec.md` | 规格 |
| `OpencodeRuntime.kt`（若实现） | 诊断开关 |
| `payload/opencode-server.js`（若实现） | 事实上报 |

## 8. 与规格交叉引用

- 目标/判据 → `spec.md` §1–§3
- 现状 → `spec.md` §4（P0-K 结论：JIT+WASM 可用，无产品必要）
