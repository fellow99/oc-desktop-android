# 107-compliance 技术方案（as-built）

## 1. 已落地项与实现
| 项 | 实现 |
|---|---|
| G3 许可清单 | `app/src/main/assets/THIRD-PARTY-NOTICES.md`（组件/版本/许可/来源表）|
| G4 供应链 | `runtime.lock.json` + verify-runtime 门禁 + 载荷 manifest（tarSha256/plugins digest）|
| G5 隐私 | 关于页字符串明示「不收集任何设备或使用信息；网络仅限模型服务与包管理镜像」|
| G6 非官方声明 | README + 关于页（AlertDialog，strings.xml about_*）|
| G10 AI 内容 | 口径核录：沿用上游 v2 UI 标识，不加隐藏水印 |

## 2. 守卫
- `scripts/verify-branding.mjs`：app_name/图标/NOTICES/非官方声明/res 下 0 OpenCode 残留（六断言）。
- 修复触发：任何品牌漂移在 collect 前被 verify-branding 拦截。

## 3. 余项
- G8 安装文档已出（docs/安装.md）；Play 专项（AAB+PAD+政策预检）待分发启动。
