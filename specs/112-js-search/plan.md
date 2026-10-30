# 112-js-search 技术方案（as-built）

## 1. 结构（`plugins/oc-plugin-search/index.js`，单文件零依赖）
- `globToRegExp`：**/*/?/[abc]/{a,b} 编译（纯字符串状态机，无依赖）；
- `walkFiles(root, base)`：围栏内递归（SKIP_DIRS 跳过表 + 20000 文件上限 + scannedTruncated 如实上报）；
- `grepFiles`：逐文件（≤1MB、非二进制[首 8KB 无 NUL]、逐行 ≤2000 字符），结果上限 200 截断标注，
  skipped = { dirs, binary, large, longLines } 全计数；
- `fenceResolve`：resolve+relative 围栏 + **target==root 合法放行**（闭环轮实测修复：原实现把
  rel==='' 误判越界，默认路径必触发）+ symlink realpath 双侧收口（M5）。

## 2. 工具
grep（pattern/path/include/ignoreCase/maxResults）与 glob（pattern/path/limit）；注册 fail-visible。

## 3. 测试
- 夹具四例：**/*.ts、src/*、brace、负例；grep 匹配/二进制跳过/长行跳过（longLines=1）；
- 闭环轮真跑：grep 越界 bug 由模型反馈暴露 → 修复 → 复测通过（src/index.js 定位正确）。
