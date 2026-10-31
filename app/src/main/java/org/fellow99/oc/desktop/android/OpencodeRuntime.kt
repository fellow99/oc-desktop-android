package org.fellow99.oc.desktop.android

import android.content.Context
import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.fellow99.nodebridge.NodeRuntime
import org.fellow99.nodebridge.NodeRuntimeOptions
import org.fellow99.nodebridge.NodeState
import java.io.File
import java.io.FileOutputStream

/**
 * 启动编排（规划 §4.2 六步；D1/D6/D7/D9/D16 落点）。
 *
 *   [1/6] 密码装配 → [2/6] 载荷就位 → [3/6] host.register
 *   → [4/6] rt.start → [5/6] marker+探活双判据 → [6/6] WebView loadUrl
 *
 * 纪律：
 *  · 每个 phase 都有中文阶段文案 + 一行取证日志（Diagnostics.evidence）；
 *  · 任一步失败 → Failed(stage, reason, logTail)，**不允许卡住但不说**；
 *  · Kotlin 不解释业务载荷：tar.gz 只做字节拷贝，解包/校验由 Node（unpack.js）执行（D7「谁写谁读」）。
 */
class OpencodeRuntime(private val context: Context) {

    sealed class Phase {
        data class Step(val text: String) : Phase()
        data class Ready(val baseUrl: String, val authToken: String, val port: Int) : Phase()
        data class Failed(val stage: String, val reason: String, val logTail: String) : Phase()
    }

    val rt: NodeRuntime = NodeRuntime.getInstance(context)

    private val _phase = MutableStateFlow<Phase>(Phase.Step("待启动"))
    val phase: StateFlow<Phase> = _phase.asStateFlow()

    var job: Job? = null
        private set

    fun launchIn(scope: CoroutineScope) {
        if (job != null) return
        job = scope.launch(Dispatchers.Default) { run() }
    }

    private fun step(text: String) {
        _phase.value = Phase.Step(text)
        Diagnostics.evidence(context, "phase $text")
    }

    private fun fail(stage: String, reason: String): Nothing {
        val tail = Diagnostics.nodeLogTail(rt)
        val crash = Diagnostics.lastCrashText(rt)
        val full = buildString {
            append(reason)
            append("\n---- node_bridge.log 尾部 ----\n").append(tail)
            crash?.let { append("\n---- lastCrash ----\n").append(it) }
        }
        Diagnostics.evidence(context, "FAILED[$stage] $reason")
        _phase.value = Phase.Failed(stage, full, tail)
        throw LaunchFailed(stage)
    }

    private class LaunchFailed(val stage: String) : Exception(stage)

    private suspend fun run() {
        try {
            // [1/6] 密码装配
            step("[1/6] 密码装配")
            val password = withContext(Dispatchers.IO) { ConnectionStore.loadOrCreate(context) }

            // 进程级单例 Node 可能已在跑：选图（SAF）使宿主 Activity 被系统销毁重建、但进程未死时，
            // 新 Activity 会拿到同一个 NodeRuntime。node::Start 每进程只允许一次，再 start 必被拒
            // （rc=-1 已启动过）。此场景应**重连**现有服务，而不是重启 Node。
            if (rt.state.value is NodeState.Running) {
                step("[=] 检测到进程内服务运行中，重连")
                val basic = ConnectionStore.basicToken(password)
                val marker = Diagnostics.readyMarker(context)
                if (marker != null && marker.pid == android.os.Process.myPid() &&
                    withContext(Dispatchers.IO) { Diagnostics.probeHealth(marker.port, basic) } in 200..299
                ) {
                    Diagnostics.evidence(context, "reuse running node pid=${marker.pid} port=${marker.port}（Activity 重建后重连）")
                    emitReady(password, marker.port)
                    return
                }
                // 状态显示 Running 但本进程 marker/探活不过：单例无法在同进程二次 start，只能让用户整进程重启
                fail(
                    "reconnect",
                    "进程内 Node 标记为运行但探活失败（Activity 被系统回收后无法在同进程重启）。请点“重启应用”整进程冷启动。",
                )
            }

            // [2/6] 载荷就位（缺 tar.gz → 明确失败并给构建指引）
            step("[2/6] 载荷就位")
            withContext(Dispatchers.IO) { ensurePayload(context) }

            // [3/6] 宿主能力（必须先于 start）
            step("[3/6] 注册宿主能力")
            HostCapabilities.registerAll(rt)

            // [4/6] 启动进程内 Node（bootstrap.js → payload/opencode-server.js）
            step("[4/6] 启动 Node 服务（进程内）")
            val filesDir = context.filesDir.absolutePath
            val appEntry = File(File(filesDir, "payload"), "opencode-server.js").absolutePath
            val result = rt.start(
                NodeRuntimeOptions(
                    entry = "bootstrap.js",
                    appEntry = appEntry,
                    env = buildEnv(password, filesDir),
                ),
            )
            if (!result.ok) fail("start", "启动失败 rc=${result.code}：${result.message ?: "未知"}")

            // [5/6] 就绪双判据：state==Running + server.ready.json（port>0）+ /global/health 200
            step("[5/6] 等待服务就绪（marker + 探活）")
            val ready = awaitReady(password)
                ?: fail(
                    "ready",
                    "服务未在 ${TIMEOUT_MS / 1000}s 内就绪（marker/探活双判据未过；state=${rt.state.value}，lastError=${rt.lastError.ifEmpty { "-" }}）",
                )

            // [6/6] 交给 WebView（MainActivity 订阅 Ready）
            step("[6/6] 连接界面")
            emitReady(password, ready.port)
        } catch (_: LaunchFailed) {
            // 状态已置 Failed；此处仅兜住控制流
        } catch (t: Throwable) {
            fail("unexpected", "未预期异常：${t.javaClass.simpleName}: ${t.message}")
        }
    }

    /** 就绪后向 UI 发布 Ready（冷启动与“Activity 重建后重连”共用）。 */
    private fun emitReady(password: String, port: Int) {
        val token = Base64.encodeToString(
            "opencode:$password".toByteArray(Charsets.UTF_8),
            Base64.NO_WRAP,
        )
        _phase.value = Phase.Ready("http://127.0.0.1:$port", token, port)
    }

    /** D9 环境契约（payload/lib/env.js 与本表镜像：变量名只在这两处定义）。 */
    private fun buildEnv(password: String, filesDir: String): Map<String, String> = mapOf(
        "HOME" to filesDir,
        "USERPROFILE" to filesDir,
        "TMPDIR" to "$filesDir/tmp",
        "TMP" to "$filesDir/tmp",
        "TEMP" to "$filesDir/tmp",
        "XDG_DATA_HOME" to "$filesDir/data",
        "XDG_CACHE_HOME" to "$filesDir/cache",
        "XDG_CONFIG_HOME" to "$filesDir/config",
        "XDG_STATE_HOME" to "$filesDir/state",
        "OPENCODE_DB" to "$filesDir/data/opencode/opencode.db",
        "OPENCODE_DISABLE_CHANNEL_DB" to "1",
        "OPENCODE_DISABLE_MODELS_FETCH" to "1",
        "OPENCODE_FILEWATCHER_DISABLE" to "1",
        "OPENCODE_DISABLE_FFF" to "1",
        "OPENCODE_DISABLE_AUTOUPDATE" to "1",
        "OPENCODE_CLIENT" to "desktop",
        "OPENCODE_LOG_LEVEL" to "info",
        "OPENCODE_NODE_ASSETS_DIR" to "$filesDir/opencode-dist/assets",
        "OPENCODE_SERVER_PASSWORD" to password,
        "NO_PROXY" to "127.0.0.1,localhost,::1",
        "no_proxy" to "127.0.0.1,localhost,::1",
        "PATH" to "/system/bin",
        // 本工程私有（payload/opencode-server.js 消费）：
        "OC_FILES_DIR" to filesDir,
        "OC_READY_FILE" to "$filesDir/payload/server.ready.json",
        "OC_SERVER_LOG" to "$filesDir/logs/server.log",
        "OC_PAYLOAD_TAR" to "$filesDir/incoming/opencode-dist.tar.gz",
        "OC_VERSION" to appVersion(context),
        "OC_HOST" to "127.0.0.1",
    )

    /** assets/payload 启动脚本 + assets/opencode-dist.tar.gz → filesDir（幂等）。 */
    private fun ensurePayload(context: Context) {
        // ① 启动脚本（KB 级，内容哈希幂等）
        copyAssetFile(context, "payload/opencode-server.js", File(context.filesDir, "payload/opencode-server.js"))
        copyAssetFile(context, "payload/unpack.js", File(context.filesDir, "payload/unpack.js"))
        copyAssetFile(context, "payload/lib/env.js", File(context.filesDir, "payload/lib/env.js"))
        copyAssetFile(context, "payload/lib/ready.js", File(context.filesDir, "payload/lib/ready.js"))
        copyAssetFile(context, "payload/lib/plugins.js", File(context.filesDir, "payload/lib/plugins.js"))

        // ② 载荷 tar.gz（MB 级；marker 版本一致时不拷贝，二次启动零拷贝；版本变化 → 重拷 + Node 重解包）
        val dist = File(context.filesDir, "opencode-dist")
        val manifest = File(dist, ".manifest.json")
        var manifestVersion: String? = null
        if (manifest.isFile) {
            manifestVersion = runCatching {
                org.json.JSONObject(manifest.readText()).optString("version")
            }.getOrNull()
        }
        val currentVersion = appVersion(context)
        if (manifestVersion == currentVersion) {
            Diagnostics.evidence(context, "payload marker 命中（version=$manifestVersion），跳过 tar 拷贝")
            return
        }
        if (manifestVersion != null) Diagnostics.evidence(context, "payload 版本变化 $manifestVersion → 重拷")
        val incoming = File(context.filesDir, "incoming/opencode-dist.tar.gz")
        // AGP 会把 assets 里的 *.tar.gz 解压并去掉 .gz 后缀打进 APK（merger 实测）；
        // 因此优先探测原名，回退裸 tar 名。内容（gz 或裸 tar）由 Node 侧魔数判定，Kotlin 只做字节拷贝。
        val assetStream = runCatching { context.assets.open("opencode-dist.tar.gz") }
            .recoverCatching { e ->
                if (e is java.io.FileNotFoundException || e is java.io.IOException) {
                    context.assets.open("opencode-dist.tar")
                } else throw e
            }
            .getOrElse { fail("payload", "载荷缺失：assets/opencode-dist.tar(.gz) 均不存在（先跑 scripts/collect-opencode.mjs）") }
        step("[2/6] 载荷就位（拷贝载荷包）")
        assetStream.use { input ->
            incoming.parentFile?.mkdirs()
            FileOutputStream(incoming).use { output -> input.copyTo(output, 256 * 1024) }
        }
        Diagnostics.evidence(context, "tar 拷贝完成 incoming=${incoming.length()}")
    }

    private fun copyAssetFile(context: Context, assetPath: String, target: File) {
        val bytes = context.assets.open(assetPath).use { it.readBytes() }
        // 内容比对幂等（避免同长异内容漏更新；文件均为 KB 级）
        if (target.isFile && target.readBytes().contentEquals(bytes)) return
        target.parentFile?.mkdirs()
        val tmp = File(target.parentFile, "${target.name}.tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(target)) {
            target.delete()
            check(tmp.renameTo(target)) { "payload 脚本落盘失败：$target" }
        }
    }

    private suspend fun awaitReady(password: String): Diagnostics.ReadyInfo? {
        val deadline = System.currentTimeMillis() + TIMEOUT_MS
        val basic = ConnectionStore.basicToken(password)
        var lastHealth = -1
        while (System.currentTimeMillis() < deadline) {
            val state = rt.state.value
            if (state is NodeState.Failed) return null
            val marker = Diagnostics.readyMarker(context)
            // marker 必须来自**本进程**（force-stop 后残留的旧 marker 端口不可信）
            if (marker != null && marker.pid == android.os.Process.myPid() && state is NodeState.Running) {
                lastHealth = Diagnostics.probeHealth(marker.port, basic)
                if (lastHealth in 200..299) return marker
            }
            delay(250)
        }
        Diagnostics.evidence(context, "awaitReady 超时 lastHealth=$lastHealth state=${rt.state.value}")
        return null
    }

    companion object {
        /** 与 ark 一致：bundle import 可能 2–6s，留足余量（§7.4）。 */
        private const val TIMEOUT_MS = 180_000L

        // （载荷版本戳改由 appVersion(context) 动态取 versionName，避免发版漏改导致升级不重解包。）
    }

    /** 当前 APK 版本名（载荷版本戳，与 payload/.manifest.json.version 比对，升级即重解包）。 */
    private fun appVersion(context: Context): String =
        runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
        }.getOrNull() ?: "0.0.0"
}
