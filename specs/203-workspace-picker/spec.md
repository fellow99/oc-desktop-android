# 203-workspace-picker —— 工作区选择器（spec）

> 状态：⬜ planned（Phase 2）· 引用：规划 §5.13 D14 / §14.2（203）· 对标：ark `203-plugin-workspace-picker` + 补丁 0007
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
