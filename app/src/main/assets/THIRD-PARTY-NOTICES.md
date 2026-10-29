# THIRD-PARTY-NOTICES

OC Desktop Android（`org.fellow99.oc.OCDesktopAndroid`）随包分发以下第三方组件，本文件是其许可清单（规划 §13 G3）。本应用与 opencode 团队无隶属关系（非官方第三方移植）。

| 组件 | 版本 | 许可 | 来源 |
|---|---|---|---|
| opencode（CLI bundle + Web UI） | 2.1.2 | MIT | https://github.com/anomalyco/opencode |
| Node.js（libnode.so，含 V8 / OpenSSL / ICU / zlib 等，详见其上游 LICENSES） | 24.22.1 | MIT（及随包内嵌组件各自的许可） | https://nodejs.org （aosp-node-runtime 自建） |
| node-bridge / node-runtime（Android 桥与引擎 AAR） | 0.2.0 / 24.22.1 | MIT | io.github.fellow99（Maven） |
| isomorphic-git（含其传递依赖，见插件内 node_modules/*/LICENSE） | 1.44.2 | MIT | https://isomorphic-git.org |
| js-diff（diff） | 9.0.0 | Apache-2.0（jsdiff 9.x） | https://github.com/kpdecker/jsdiff |
| Kotlin / Coroutines（宿主运行时） | 2.1.20 / 1.9.0 | Apache-2.0 | JetBrains / kotlinx |

> 各组件的完整许可文本以其上游发布物为准；MIT/Apache-2.0 均要求保留版权与许可声明，本应用不在本文件中复制全文。
> 本应用自身为 MIT 许可（见仓库 LICENSE），与上述组件无关。
