package org.fellow99.oc.desktop.android

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.SecureRandom

/**
 * 连接密码的生命周期（D6 / 规划 §5.6）：
 *
 *  · 首启生成 32B 随机 → base64url，落 `filesDir/connection.json`（MODE_PRIVATE，应用沙箱）；
 *  · 跨启动复用；轮换仅在用户主动重置或文件损坏时发生；
 *  · 密码只经 env 交给 Node（OPENCODE_SERVER_PASSWORD），**绝不写日志**（诊断对 URL 一律 `?auth_token=***`）。
 */
object ConnectionStore {

    private const val FILE = "connection.json"

    fun loadOrCreate(context: Context): String {
        val file = File(context.filesDir, FILE)
        // 文件损坏 → 重新生成（服务端密码与 marker 同生共死，密码换了旧 marker 自然失效）
        runCatching {
            val obj = JSONObject(file.readText())
            val pwd = obj.optString("password")
            if (pwd.length >= 32) return pwd
        }
        val password = generate()
        val obj = JSONObject()
            .put("schema", 1)
            .put("password", password)
            .put("createdAt", System.currentTimeMillis())
        file.writeText(obj.toString())
        return password
    }

    /** Basic 凭据头值：`opencode:<password>` 的 base64（上游鉴权三通道之一，§2.2 d）。 */
    fun basicToken(password: String): String =
        Base64.encodeToString("opencode:$password".toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

    private fun generate(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }
}
