# STRUCTURE —— 项目目录与文件结构（as-built）

> 更新：2026-10-28 · 生成方式：源码扫描（排除 `.git/`、`build/`、`.gradle/`、载荷产物）
> 载荷产物 `app/src/main/assets/opencode-dist.tar.gz`（+.manifest.json）为 `scripts/collect-opencode.mjs` 生成物，已 gitignore，不入本表。

```
oc-desktop-android/
├── settings.gradle.kts            # Gradle 设置：仓库策略（mavenLocal 引擎 / 阿里云镜像 / Central）
├── build.gradle.kts               # 根构建脚本（插件版本集中在 gradle/libs.versions.toml）
├── gradle.properties              # JVM/Android/Kotlin 全局配置
├── gradle/
│   ├── libs.versions.toml         # 版本目录：AGP 8.9.2 / Kotlin 2.1.20 / compileSdk 36 / node-bridge 0.2.0 / node-runtime 24.22.1
│   └── wrapper/…                  # Gradle Wrapper 8.12（gradlew / gradlew.bat）
├── local.properties               # 本机 SDK 路径（gitignore，不入库）
├── keystore.properties.sample     # 签名材料模板（真实 keystore.properties 已 gitignore）
├── runtime.lock.json              # 引擎 lock 镜像引用（权威 = aosp-node-runtime 仓；active 24.22.1 + SHA-256 门禁值）
├── .gitignore                     # Android 模板 + keystore.properties + 载荷产物
│
├── app/                           # Android 宿主（唯一模块 :app）
│   ├── build.gradle.kts           # applicationId org.fellow99.oc.OCDesktopAndroid；v2.1.2(20102)；minSdk 24/target 36；
│   │                              #   abiFilters arm64-v8a；payload 脚本同步任务（→ assets/payload/）；依赖双包
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml    # 权限=INTERNET+ACCESS_NETWORK_STATE；singleTask；configChanges 自理；networkSecurityConfig
│       ├── res/xml/network_security_config.xml   # 仅 127.0.0.1/localhost 放行明文（D4/P0-D）
│       ├── res/values/strings.xml
│       ├── assets/payload/        # ← 生成：payload/ 启动脚本（gradle syncPayloadScripts 任务拷入）
│       └── java/org/fellow99/oc/desktop/android/
│           ├── App.kt             # Application：全局 Context 持有
│           ├── MainActivity.kt    # 加载页/错误页/WebView 壳；导航围栏；clearHistory；返回键策略
│           ├── OpencodeRuntime.kt # 六步启动编排（§4.2）+ D9 环境装配 + marker/探活双判据
│           ├── ConnectionStore.kt # 连接密码生命周期（32B base64url → connection.json，MODE_PRIVATE）
│           ├── HostCapabilities.kt# 宿主能力注册：echo/perm.check/openExternal/notify(stub)/saf.pickFolder(stub)
│           └── Diagnostics.kt     # marker 读取 / /global/health 探活 / 日志尾 / lastCrash / ui.log 取证
│
├── payload/                       # Node 侧启动脚本（随载荷投放的「引导件」，与 Kotlin 侧 env 契约镜像）
│   ├── opencode-server.js         # 六步宿主入口：env→自解包→chdir 工作区→stdout 嗅探→argv=serve→import
│   ├── unpack.js                  # tar(.gz) 幂等自解包（魔数判定 + SHA-256 marker + 临时目录原子替换）
│   └── lib/
│       ├── env.js                 # D9 环境装配唯一事实源（与 OpencodeRuntime.buildEnv 镜像）
│       └── ready.js               # server.ready.json 原子写 + server.log 追加
│
├── scripts/                       # 构建与门禁流水线（host 侧 Node ≥24）
│   ├── collect-opencode.mjs       # 上游 dist-node → assets/opencode-dist.tar.gz + manifest（基线守卫 a517687fde）
│   └── smoke-node24.mjs           # host 门禁：--version / serve / health / UI / SSE（/api/event）
│
├── docs/
│   ├── 000-工程规划.md            # 唯一权威规划（v0.2）
│   ├── 真机验证记录.md            # 每轮环境/步骤/判据/结论（敏感信息零落盘）
│   └── evidence/20261028-01/      # 原始证据：facts.json / 截图 / e2e-chat.json（脱敏）
│
├── specs/                         # 规格体系（本目录，入口 README.md）
│   ├── README.md / SPECS_CHECKLIST.md / STRUCTURE.md / TECH.md / ARCHITECTURE.md
│   ├── constitution.md / overall-spec.md / overall-plan.md / overall-data-model.md / overall-test-cases.md
│   └── 101…111 / 203 / 205        # 模块目录（各含 spec.md，见 SPECS_CHECKLIST）
│
├── README.md / LICENSE
│
└── （规划中，Phase 1+ 落地：patches/v2.1.2/、plugins/、tools/provision 门禁、keystore 与签名流水线）
```

## 设备侧运行时沙箱布局（filesDir）

```
<filesDir>/                              # /data/user/0/org.fellow99.oc.OCDesktopAndroid/files
├── connection.json                      # 连接密码（MODE_PRIVATE，105-auth）
├── node-bridge/                         # 桥库自管：payload(bootstrap/host/selfcheck) + node_bridge.log + app.log
├── payload/                             # 本工程启动脚本（Kotlin 从 assets 拷入）
│   └── server.ready.json                # 就绪 marker（Node 原子写，Kotlin 只读）
├── incoming/opencode-dist.tar(.gz)      # 载荷包字节拷贝（Kotlin 只拷不解）
├── opencode-dist/                       # Node 自解包产物 + .manifest.json（SHA-256 marker）
├── workspace/default/                   # 默认项目根（服务端 cwd；203 将扩展多工作区）
├── config/opencode/opencode.json        # opencode 配置（provider/model 注册；XDG_CONFIG_HOME）
├── data/opencode/                       # opencode.db(WAL) + log/ + shell/（XDG_DATA_HOME）
├── logs/                                # server.log（Node）+ ui.log（Kotlin 取证）
└── tmp/ cache/ state/                   # XDG_TMPDIR/CACHE/STATE（D9 契约）
```
