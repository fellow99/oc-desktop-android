// oc-desktop-android —— Gradle 设置
//
// 仓库策略（与 aosp-node-bridge 同款）：
//   · 阿里云镜像前置（本机 dl.google.com / maven.google.com 不可达；镜像 404 自动回退官方仓库）；
//   · 但 GitHub CI（GH runner 境外直连官方仓无障碍）必须关闭镜像：Gradle 对镜像 5xx（非 404）
//     会中止整个解析而不回退下一仓库（2026-11-25 v2.4.1 彩排命中 aliyun 502 全链失败）；
//   · mavenLocal() 曾用于提供 small-icu 引擎 io.github.fellow99:node-runtime:24.22.1；
//     24.22.1 已于 2026-10-27 发布 Maven Central（本仓 verify-runtime 对 Central AAR 实测全绿），
//     CI 无 mavenLocal 也能顺位解析；mavenLocal 仅供本机旧缓存加速，可留可删。
// 镜像门控：GH Actions 置 env CI=true；本机不设→ 仅 CI 关闭镜像（各块内写字面判断：pluginManagement 作用域不共享顶层 val）。

pluginManagement {
    repositories {
        if (System.getenv("CI").isNullOrBlank()) {
            maven("https://maven.aliyun.com/repository/gradle-plugin")
            maven("https://maven.aliyun.com/repository/google")
            maven("https://maven.aliyun.com/repository/public")
        }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        mavenLocal() // 本地引擎：io.github.fellow99:node-runtime:24.22.1（runtime.lock.json active）
        if (System.getenv("CI").isNullOrBlank()) {
            maven("https://maven.aliyun.com/repository/google") // AGP 等_google 制品镜像（dl.google.com 本机不可达）
        }
        google()
        mavenCentral() // fellow99 双包在 Central（阿里云 public 镜像缺其 AAR，勿前置）
        if (System.getenv("CI").isNullOrBlank()) {
            maven("https://maven.aliyun.com/repository/public") // 兜底镜像
        }
    }
}

rootProject.name = "oc-desktop-android"

include(":app")
