# overall-test-cases —— 测试用例索引

> 更新：2026-10-28 · 判据均可证伪；证据一律归档 `docs/evidence/` 并在 [`docs/真机验证记录.md`](../docs/真机验证记录.md) 登记。**用例与文档不得包含凭据实值。**

## 一、host 侧门禁（无设备）

| # | 用例 | 判据 | 工具 | 状态 |
|---|---|---|---|---|
| T-H1 | 载荷组装 | manifest 产出且字段齐全（version/baseline/tarSha256/files/bytes） | `node scripts/collect-opencode.mjs` | ✅ |
| T-H2 | 基线守卫 | HEAD≠锁定基线时 collect 以码 2 拒绝（`--force` 仅诊断） | 同上（改 HEAD 模拟） | ✅ |
| T-H3 | serve 冒烟 | `--version` 正常；`server listening`；`/global/health` 200；`/` UI html；`/api/event` 首帧 SSE | `node scripts/smoke-node24.mjs` | ✅ 全绿 |
| T-H4 | 自解包解析器 | 对真实 69.6MB 裸 tar：72 条目、字节总数一致、manifest 写入、入口/资产存在 | host node 脚本驱动 `payload/unpack.js` | ✅ |

## 二、Phase 0 探针（设备；探针代码已按 G9 清理，判据留档）

| # | 用例 | 判据 | 结果（20261028-01） |
|---|---|---|---|
| T-P0-A | 依赖接线与构建 | APK 含 libnode.so 且 SHA=lock；debug APK 可安装 | ✅（81MB；SHA 与 `runtime.lock.json` 一致） |
| T-P0-B | node:sqlite | 建库→WAL→写读回→第二连接并发读 全过 | ✅ |
| T-P0-K | JIT/WASM | `wasm=ok`；hotLoop（转译环境仅参考） | ✅ wasm ok / ⚠️ 128ms（转译，真机复测） |
| T-P0-D | loopback 明文 | WebView 成功加载 `http://127.0.0.1:<port>/` | ✅ |
| T-P0-E | WebView 八项 | localStorage/IndexedDB/fetch/EventSource/crypto.subtle/wasm/blobWorker/inlineScript 全 ok | ✅ 8/8 |
| T-P0-J | shell 三事件 | spawn/close 事件、stdout+stderr 哨兵、exit code 透传 | ✅ |
| T-P0-X | 宿主桥往返 | `host.invoke('echo')` 返回 ok | ✅ |
| T-P0-Y | 端口策略 | `--port 0` + ready 回传；固定端口在该平台 EADDRINUSE（负样本） | ✅ |

## 三、端到端（设备，20261028-02 轮）

| # | 用例 | 步骤 | 判据 | 状态 |
|---|---|---|---|---|
| T-E1 | 启动编排 | 安装→启动 | [1/6]~[6/6] 文案；marker `port>0`；health 200；UI 上屏（截图） | ✅ |
| T-E2 | 载荷缺失失败可见 | 无载荷启动 | 错误页含「载荷缺失…collect-opencode.mjs」（截图级证据：ui.log FAILED[payload]） | ✅ |
| T-E3 | 二次启动幂等 | 再次启动 | marker 命中跳过解包与 tar 拷贝（ui.log） | ✅ |
| T-E4 | 模型配置 | 录入 DeepSeek 凭据（设置页/credential API 等价） | `/api/provider` 列出 deepseek；`/api/config` 默认模型 `deepseek/deepseek-flash` | ✅ |
| T-E5 | 工作区 | 启动后查服务端 cwd | `cwd=<filesDir>/workspace/default`；`/api/provider.location.directory` 同值 | ✅ |
| T-E6 | 文本对话 | 建会话（deepseek-flash）→「介绍一下你自己」 | assistant 文本回复、finish=stop、tokens 记录 | ✅（evidence/e2e-chat.json） |
| T-E7 | 看图分析 | 附截图（file:// URI）→「分析这张截图」 | 回复包含图中真实内容（识别为 opencode 会话首页） | ✅ |
| T-E8 | 工具调用 | （伴随 T-E7）模型自主调 shell | 工具执行成功（`/system/bin/sh`） | ✅ |

## 四、回归（109 模块落地后启用）

| # | 用例 | 触发时机 |
|---|---|---|
| T-R1 | 签名 APK + SHA-256 归档 | 每次发版 |
| T-R2 | 首启耗时分解（解包/Start/import） | 引擎或载荷变更 |
| T-R3 | smoke 四判据复跑 | 上游 tag 变更 |
| T-R4 | e2e 对话+看图冒烟 | 任何 release 前 |

## 五、复现命令（脱敏）

```bash
# host 门禁
node scripts/collect-opencode.mjs && node scripts/smoke-node24.mjs
# 构建/装机/启动
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.fellow99.oc.OCDesktopAndroid/org.fellow99.oc.desktop.android.MainActivity
# 服务端判据（port 见 run-as .../files/payload/server.ready.json；pwd 见 connection.json，勿外传）
adb forward tcp:<port> tcp:<port>
curl -u opencode:<pwd> http://127.0.0.1:<port>/global/health
```
