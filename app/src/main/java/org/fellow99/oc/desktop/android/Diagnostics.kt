package org.fellow99.oc.desktop.android

import android.content.Context
import android.util.Base64
import org.fellow99.nodebridge.CrashRecord
import org.fellow99.nodebridge.NodeLogEntry
import org.fellow99.nodebridge.NodeRuntime
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 诊断与取证（规划 §6 #3/#16；失败可见原则 §3.2）：
 *  · marker：`filesDir/payload/server.ready.json`（Node 原子写，Kotlin 只读）；
 *  · 探活：`GET /global/health`（带 Basic，200 即 API 可用）；
 *  · 取证：阶段与异常追加到 `filesDir/logs/ui.log`，可经 run-as 导出，不依赖 logcat。
 */
object Diagnostics {

    data class ReadyInfo(val port: Int, val host: String, val url: String, val version: String, val pid: Int)

    fun readyMarker(context: Context): ReadyInfo? = runCatching {
        val file = File(context.filesDir, "payload/server.ready.json")
        if (!file.isFile) return null
        val obj = JSONObject(file.readText())
        val port = obj.optInt("port", 0)
        if (port <= 0) return null
        ReadyInfo(port, obj.optString("host", "127.0.0.1"), obj.optString("url"), obj.optString("version"), obj.optInt("pid", 0))
    }.getOrNull()

    /** `GET /global/health`（D3 判据之一）。返回 HTTP code；异常返回 -1。 */
    fun probeHealth(port: Int, basicToken: String): Int = runCatching {
        val conn = (URL("http://127.0.0.1:$port/global/health").openConnection() as HttpURLConnection).apply {
            connectTimeout = 3000
            readTimeout = 5000
            requestMethod = "GET"
            setRequestProperty("Authorization", "Basic $basicToken")
        }
        val code = conn.responseCode
        conn.inputStream.use { it.readBytes() } // 消费掉，连接可复用
        code
    }.getOrDefault(-1)

    fun nodeLogTail(rt: NodeRuntime, maxLines: Int = 60): String = runCatching {
        val logs: List<NodeLogEntry> = rt.logs(maxLines)
        if (logs.isEmpty()) "(无日志)" else logs.joinToString("\n") { "[${it.stream}] ${it.text}" }
    }.getOrDefault("(读日志失败)")

    fun lastCrashText(rt: NodeRuntime): String? {
        val crash: CrashRecord? = runCatching { rt.lastCrash() }.getOrNull()
        return crash?.let { "[${it.stage}] ${it.raw.trim()}" }
    }

    private val lock = Any()

    /** 取证追加（脱敏纪律：调用方不得把密码/auth_token 写进来）。 */
    fun evidence(context: Context, line: String) {
        synchronized(lock) {
            runCatching {
                val dir = File(context.filesDir, "logs").apply { mkdirs() }
                File(dir, "ui.log").appendText("${System.currentTimeMillis()} $line\n")
            }
        }
    }
}
