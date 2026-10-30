# ark 上游同步项（20261029-2）

## 1. redactUrl userinfo 全脱敏（评审 M9，本仓已修）
- 位置：plugins/oc-plugin-git/lib/auth.js 的 redactUrl()
- 修复：URL 解析优先（username='*'、password=''），正则兜底 //[^@]*@ → //
- 原因：口令含字面 / 时，原实现 [^@/]*@ 只脱敏到第一个斜杠
- 建议：ark 侧同文件同步该实现，并附 tests/auth.test.mjs 三例

## 2. fenceResolve target==root 语义（闭环轮实测发现，本仓已修）
- 若 ark 引入 grep/glob JS 兜底（对应本仓 oc-plugin-search），注意
  fenceResolve 对 path.relative(root, target) === ''（target 即 root）应放行，
  不得与「越界」同分支处理——默认不传 path 的调用必触发。

## 3. worker.js 伴随文件（205 形态提醒）
- pnpm.cjs 非 self-contained：运行期 path.join(__dirname,'worker.js') 起内部 worker 池，
  进程内引用必须整目录（pnpm.cjs+worker.js+pnpmrc）投放，缺 worker.js 即
  Worker pnpm#1 exited with code 1。
