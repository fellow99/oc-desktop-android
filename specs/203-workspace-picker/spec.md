# 203-workspace-picker —— 工作区选择器（spec）

> 状态：🔶 as-built（2026-10-29 host 侧全过；SAF 实机拷贝/进度随真机轮）· 引用：规划 §5.13 D14 / §14.2（203）· 对标：ark `203-plugin-workspace-picker` + 补丁 0007/0009
> as-built 现状：默认工作区 `<filesDir>/workspace/default` 已作为项目根运行（T-E5 ✅）

## 1. 目标

多工作区管理（沙箱内多项目并列）+ SAF 导入/导出；**不做**全局存储直写（`content://` 非真实路径 ⇒ 导入制）。

## 2. 需求与验收判据（届时生效）

| # | 需求 | 判据 |
|---|---|---|
| R1 | 三动作选择器 | UI 内可「列沙箱项目 / 导入新项目 / 删除项目」（补丁 0007 UI + 插件 RPC `workspace.roots`） |
| R2 | SAF 导入制 | 选树 → DocumentFile 遍历拷入 `workspace/<name>/`（带 `.import.json` 记来源与时间）→ 以副本为项目根；导出反向拷回 |
| R3 | 成本可见 | 大仓库导入显示字节进度且可取消；不做后台同步 |
| R4 | 切换语义 | 切工作区 = 服务端以该目录为 cwd（重启编排 [4/6] 前的 chdir 目标变更）；不跨工作区串数据 |
| R5 | 权限边界 | 全程 SAF 运行时授权；不申请 `MANAGE_EXTERNAL_STORAGE`/`READ_MEDIA_*` |
| R6 | 能力桥 | `saf.pickFolder` 从 stub 升级为真实现（104 届时更新） |

## 3. 依赖

106 补丁 0007（UI）、插件 `oc-plugin-workspace-roots`（RPC）、102 载荷物化扩展。

## 4. as-built 判据核录（2026-10-29，host）

| # | 判据 | 结果 | 证据 |
|---|---|---|---|
| R1 三动作 | RPC 面 `roots/browse/mkdir`（0007 UI）+ `import/importStatus/importCancel/remove`（0009 按钮，capabilities 自门控） | ✅ host | serve 实弹：`roots` 返回 sandbox+`capabilities:["import","remove","setCurrent"]`；`mkdir probe-p1` ok |
| R2 SAF 导入制 | Kotlin `SafImport`（DocumentsContract 遍历拷入 + `.import.json`） | ✅ 编译级 | `compileDebugKotlin` 过；实机拷贝待真机轮 |
| R3 成本可见 | 进度文件 `.import-<token>.json`（Kotlin 写）+ importStatus 轮询 + cancelImport | ✅ 机制（取消经 RPC；UI 取消按钮为 0009 后续 hunk） | SafImport.kt（16 文件/批写进度；canceled 逐文件检查；孤儿进度 1h 清扫） |
| R4 切换语义 | `workspace/.current` → 启动编排 chdir（payload/opencode-server.js ③） | ✅ | 代码 + `.current` 不可用回退 default |
| R5 权限边界 | 全程 SAF；未新增清单权限 | ✅ | AndroidManifest 仍仅 INTERNET+ACCESS_NETWORK_STATE |
| R6 能力桥 | `saf.pickFolder`/`saf.cancelImport`/`openAppInfo` 真实现 | ✅ 编译级 | HostCapabilities.kt（token 立即返回；后台拷贝） |

补丁落点：0007（ark UI 原样）+ 0009（Android 导入/删除按钮，自门控）——见 specs/106。
