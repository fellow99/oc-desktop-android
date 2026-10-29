# 109-regression —— as-built 判据核录（2026-10-29-2）

> 状态：🔶 as-built（host 侧脚本化全过；签名 release SHA 与首启分解以历史轮核录，设备重测随模拟器恢复）
> 实现：`scripts/regression.mjs`（四件套一键化，红即 exit 1）

## 四件套核录（logs/20261029-2/REGRESSION.md）

| 件 | 结果 |
|---|---|
| ① 包体 | debug 163,945,032 B / release 120,766,287 B（SHA-256 前 32 位核录） |
| ② 冒烟 | smoke-node24 全绿（含品牌 title 断言） |
| ③ 首启分解 | 占位登记（最近证据轮 20261029-01；设备重测待模拟器恢复） |
| ④ 载荷指纹 | tar.gz 39,300,918 B / baseline=a517687fde / plugins=3（digest 见 manifest） |

## 使用约定

- 门禁红（缺产物/冒烟失败）⇒ exit 1 阻断；核录追加至 `logs/<date>-2/REGRESSION.md`；
- 触发时机：每次引擎 lock 变更、上游换 tag、载荷/插件/宿主大改后。
