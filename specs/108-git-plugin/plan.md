# 108-git-plugin 技术方案（as-built）

## 1. 结构（移植自 ark，3 处适配）
- `plugins/oc-plugin-git/`：index.js（工具注册+VCS 覆盖+凭据 RPC）+ lib/*（repo/fence/auth/credentials/diff/report/runtime/tools×21）
- 适配点：① 凭据路径 → `$XDG_CONFIG_HOME/opencode/git-credentials`（0600 写入+回读校验）；
  ② LOG_PREFIX → [oc-android]；③ RPC id **保持 oc-ark-git**（补丁 0008 UI 硬编码）。

## 2. 运行时
- 懒加载 isomorphic-git@1.44.2 + diff@9.0.0（顶层零 import，防构建期门禁假阴性）；
- collect-plugins 按 pin npm install → 缓存 .cache/git-plugin-runtime → staging（56 包/7.76MB/.bin 剔除/
  禁 symlink/禁原生/禁 child_process 断言）。

## 3. 工具面（21）
git_init/clone/status/diff/log/show/add/commit/branch/checkout/reset/merge/cherry_pick/revert/stash/
tag/remote/fetch/pull/push/config；全部经 fence（仓库根 chroot）+ guarded（失败可见）+ reloadVcs。

## 4. 凭据面
`~/.git-credentials` 同形格式；save/remove 原子写（temp+rename）+ 0600 强制 + 回读校验（POSIX）；
list/describe 不回显口令；auth.js redactUrl 全 userinfo 脱敏（M9，含 auth.test.mjs 三例）。

## 5. 验证
- `verify-git-plugin.mjs`：mock context 实跑 21 工具 + 凭据三连 + P0-N host 预演
  （5MB 级 add=82ms/commit=14ms/status=21ms/diff=18ms）；
- 已知边界：Windows chmod 语义 → 0600 用例 SKIP（设备/POSIX 判据）；
  fs-adapter mtime 缓存粒度 → 同毫秒「编辑→add」需真实节奏（ark 同源行为）。
