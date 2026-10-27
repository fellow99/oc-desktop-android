// oc-desktop-android —— Gradle 设置
//
// 仓库策略（与 aosp-node-bridge 同款）：
//   · 阿里云镜像前置（本机 dl.google.com / maven.google.com 不可达；镜像 404 自动回退官方仓库）；
//   · mavenLocal() 提供 small-icu 引擎 io.github.fellow99:node-runtime:24.22.1
//     （由 aosp-node-runtime 仓 `publishToMavenLocal` 产出；Maven Central 尚未发布 24.22.1）。
pluginManagement {
    repositories {
        maven("https://maven.aliyun.com/repository/gradle-plugin")
        maven("https://maven.aliyun.com/repository/google")
        maven("https://maven.aliyun.com/repository/public")
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        mavenLocal() // 本地引擎：io.github.fellow99:node-runtime:24.22.1（runtime.lock.json active）
        maven("https://maven.aliyun.com/repository/google") // AGP 等_google 制品镜像（dl.google.com 本机不可达）
        google()
        mavenCentral() // fellow99 双包在 Central（阿里云 public 镜像缺其 AAR，勿前置）
        maven("https://maven.aliyun.com/repository/public") // 兜底镜像
    }
}

rootProject.name = "oc-desktop-android"

include(":app")
