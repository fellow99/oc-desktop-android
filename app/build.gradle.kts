import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// ─────────────────────────────────────────────────────────────────────────────
// OC Desktop Android —— 应用宿主（工程规划 docs/000 §14.1）
//
//   · applicationId / 版本：2.2.5 / 20205
//   · 引擎：node-bridge 0.2.0（API+引导件）+ node-runtime 24.22.1（engine，版本钉死）
//   · ABI：arm64-v8a（引擎 lock 单一 ABI；x86_64 模拟器经 ARM 转译运行）
//   · 签名材料不入库：keystore.properties（.gitignore），提供 .sample
// ─────────────────────────────────────────────────────────────────────────────

val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "org.fellow99.oc.desktop.android"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "org.fellow99.oc.OCDesktopAndroid"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 20205
        versionName = "2.2.5"
        ndk {
            // 引擎 lock：arm64-v8a 单一 ABI（runtime.lock.json matrix）
            abiFilters += listOf("arm64-v8a")
        }
    }

    if (keystoreProps.isNotEmpty()) {
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystoreProps.isNotEmpty()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            // debug 与 release 同 applicationId：探针/真机调试直接覆盖安装（Phase 0 纪律：不搞双包）
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        jniLibs {
            // 16 KB 页对齐要求：库不压缩、按页对齐加载（P0-A 门禁项）
            useLegacyPackaging = false
        }
    }
}

// ── payload 启动脚本 → assets/payload/（生成目录，不进 src 树）─────────────────
val syncPayloadScripts = tasks.register<Copy>("syncPayloadScripts") {
    from(rootProject.file("payload")) {
        include("opencode-server.js", "unpack.js", "lib/*.js")
    }
    into(layout.buildDirectory.dir("generated/payloadAssets/payload"))
}
android.sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/payloadAssets"))
tasks.named("preBuild") { dependsOn(syncPayloadScripts) }

dependencies {
    // 桥：Kotlin API + JNI 引导件（libnode_bridge.so / libnode_host_client.so）+ 库引导 JS
    implementation(libs.node.bridge)
    // Dispatchers.Main（桥只带 coroutines-core；版本与桥对齐）
    implementation(libs.kotlinx.coroutines.android)
    // 引擎：只装 libnode.so（+ libc++_shared.so）；runtimeOnly —— 编译期零引擎符号
    // 版本=Node 版本，单一事实源 aosp-node-runtime 仓 runtime.lock.json（active=24.22.1）
    runtimeOnly(libs.node.runtime)
}
