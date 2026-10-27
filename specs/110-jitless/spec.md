# 110-jitless —— 无 JIT 诊断形态（spec）

> 状态：⬜ planned（仅诊断，不进产品）· 引用：规划 §14.2（110）；对标 ark `110-jitless`

## 1. 目标

当目标平台/ROM 的 W^X 策略封死 JIT 时，提供 `--jitless` 诊断形态以定位问题；**绝不进产品路径**（WASM 全废 ⇒ fetch 等依赖 WASM 的能力失效）。

## 2. Android 侧差异（相对 ark）

| 项 | ark（OHOS） | 本工程（Android） |
|---|---|---|
| JIT 门槛 | ACL `ALLOW_WRITABLE_CODE_MEMORY` 审批 | 无 ACL；风险在 targetSdk W^X 策略 |
| photon 守卫 | bundle 投放期锚点替换 + 纯 JS 替身（`__PI_JITLESS_PHOTON__`） | 如需 jitless 诊断，同方案移植（102 投放期做，锚点唯一 + 三闸校验） |
| 触发方式 | build flavor | `NodeRuntimeOptions.jitless=true`（桥已支持）或 `execArgv=["--jitless"]`，仅诊断 build |

## 3. 判据（届时生效）

1. jit 形态零回归（`typeof WebAssembly !== "undefined"` 时守卫零动作，smoke 全绿）；
2. jitless 形态：Node 启动、非 WASM 功能可用、`/facts` 类诊断如实上报 `jitless:true` 与降级事实；
3. 产品路径（debug/release 默认）`execArgv` 恒为空。

## 4. 现状

P0-K：Android 15(API36) 真机 + API37 模拟器（转译）均证 JIT+WASM 机制可用 ⇒ jitless 无产品必要，仅保留诊断规格。
