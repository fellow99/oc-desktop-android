# 203-plugin-workspace-picker 技术方案（as-built）

> 对应规格：[spec.md](./spec.md) ｜ 状态：🔶 as-built（host 侧） ｜ 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| UI 补丁 | 0007（四主目录/浏览/新建） | `patches/v2.2.5/0007` |
| Android 动作补丁 | 0009（导入/取消/删除/设默认，自门控） | `patches/v2.2.5/0009` |
| 插件 | `plugins/oc-plugin-workspace-roots` | RPC `workspace.*` |
| SAF | `SafImport.kt`（DocumentsContract 遍历拷贝） | `app/src/main/java/...` |
| 默认工作区 | `<filesDir>/workspace/default`；`.current` 切换 | `payload/opencode-server.js` |

## 2. 关键决策

- **导入制**：`content://` 非真实路径，SAF 选树后拷入沙箱，不申请全局存储权限。
- **自门控**：插件 capabilities 缺省时 0009 的导入/删除按钮不渲染，ark/hos 零影响。
- **进度可见**：`.import-<token>.json` 文件 + `importStatus` 轮询 + `importCancel`。
- **切换语义**：`.current` 写工作区名，Node 启动时 chdir；不可用回退 default。
- **路径围栏**：插件只允许工作区根下操作。

## 3. 数据模型

```
WorkspaceRoot { name, path, kind: sandbox|documents|downloads|desktop }
ImportManifest { sourceUri, importedAt, files, bytes }
ImportProgress { token, total, done, bytes, canceled, error }
CurrentWorkspace { name }  # workspace/.current
```

## 4. 接口契约

### 4.1 提供

- `workspace.roots` → 根列表 + capabilities；
- `workspace.browse` / `workspace.mkdir`；
- `workspace.import` / `importStatus` / `importCancel` / `remove` / `setCurrent`；
- `saf.pickFolder` / `saf.cancelImport`。

### 4.2 消费

- 104 宿主能力桥；
- 0007/0009 补丁 UI；
- `102-payload-pipeline` 的插件物化。

## 5. 实现策略

1. 插件注册 `workspace.*` RPC；
2. 0007 UI 提供根切换/浏览/新建；
3. 0009 UI 增加导入/删除按钮（capabilities 自门控）；
4. `SafImport` 后台线程遍历 DocumentFile，分批写进度；
5. `importStatus` 轮询进度；`importCancel` 置取消标志；
6. `setCurrent` 写 `.current`；Node 启动读取并 chdir。

### 错误处理

- SAF 授权失败 → `{ok:false,error}`；
- 导入失败 → 清理 staging，保留原工作区；
- 取消 → 删除未完成目录，进度标 canceled；
- 越界路径 → 拒绝。

## 6. 测试与验证

| 项 | 判据 |
|---|---|
| RPC | `roots/browse/mkdir` 实弹 |
| 导入 | SAF 选树 → 拷贝 → `.import.json` |
| 进度 | `importStatus` 可轮询；取消生效 |
| 切换 | `.current` → 重启后 cwd 改变 |
| 权限 | Manifest 无存储权限 |
| 证据 | `docs/evidence/20261029-01`、`logs/20261029-2` |

## 7. 文件清单

| 文件 | 作用 |
|---|---|
| `plugins/oc-plugin-workspace-roots/index.mjs` | RPC |
| `patches/v2.2.5/0007-workspace-roots-picker.patch` | UI |
| `patches/v2.2.5/0009-workspace-import-actions.patch` | Android 动作 |
| `app/src/main/java/.../SafImport.kt` | SAF 拷贝/进度/取消 |
| `HostCapabilities.kt` | saf 能力 |
| `payload/opencode-server.js` | `.current` chdir |

## 8. 与规格交叉引用

- R1 → 0007/0009 + RPC
- R2/R3 → `SafImport.kt`
- R4 → `.current`
- R5 → Manifest
- R6 → `HostCapabilities`
