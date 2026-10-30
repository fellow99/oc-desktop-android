# 109-regression 技术方案（as-built）

## 实现（scripts/regression.mjs）
1. 包体：debug/release APK 字节数 + SHA-256（缺 debug 即门禁红）；
2. 冒烟：spawn smoke-node24（fail-visible，摘 [smoke] 行核录）；
3. 载荷指纹：tar.gz SHA + manifest（baseline/plugins 数）；
4. 首启分解：最近 evidence 轮占位（设备重测待模拟器恢复）。
输出 logs/<date>-2/REGRESSION.md；任一门禁红 exit 1。

## 首跑核录
debug 163,945,032 B / release 120,766,287 B / tar.gz 39,300,918 B（baseline a517687fde，plugins=3）/ smoke 全绿。
