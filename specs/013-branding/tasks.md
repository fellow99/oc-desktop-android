# 013-branding-r2 — 包名修改 任务记录（Android Edition）

> **需求编号:** 013-branding-r2 ｜ **git 分支:** 不改动 ｜ **日期:** 2026-11-02

## 变更

| 项 | 现值 | 新值 |
|---|---|---|
| `applicationId` | `top.fellow99.oc.OCDesktopAndroid` | `top.fellow99.oc.OCDesktopAndroid` |
| `namespace` | `top.fellow99.oc.OCDesktopAndroid` | `top.fellow99.oc.OCDesktopAndroid` |
| 源码包目录 | `app/src/main/java/org/fellow99/oc/desktop/android/` | `app/src/main/java/top/fellow99/oc/OCDesktopAndroid/` |
| Kotlin `package`（8 个文件） | `top.fellow99.oc.OCDesktopAndroid` | `top.fellow99.oc.OCDesktopAndroid` |

- Manifest 使用相对名（`.App`/`.MainActivity`/`.KeepaliveService`），随 namespace 解析，无需改动。
- `org.fellow99.nodebridge.*` 为库引用，**不改**。

## 验收

- 编译 `assembleDebug` 通过；包内 `applicationId` 为新值。
