package org.fellow99.oc.desktop.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import org.fellow99.nodebridge.NodeRuntime
import org.json.JSONObject

/**
 * 宿主能力桥（规划 §6 #10；Node 侧 `host.invoke(name, json)` → Kotlin）。
 *
 * 纪律：
 *  · **必须先注册再 start**（库契约：未注册的能力如实报错，不静默）；
 *  · handler 跑在主线程 —— 只做轻活，重活返回结构化失败；
 *  · 失败可见：一律返回结构化 JSON，不抛异常吞错。
 */
object HostCapabilities {

    fun registerAll(rt: NodeRuntime) {
        rt.host.register("echo") { args ->
            JSONObject().put("ok", true).put("echo", args).toString()
        }

        rt.host.register("perm.check") {
            val notification = if (Build.VERSION.SDK_INT >= 33) {
                // 通知权限状态（前台服务 Phase 3 才真正用到；这里只如实上报）
                App.appContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
            } else true
            JSONObject()
                .put("ok", true)
                .put("notification", notification)
                .put("sdkInt", Build.VERSION.SDK_INT)
                .toString()
        }

        rt.host.register("openExternal") { args ->
            // 外链交系统浏览器（§6 #8）：只接受 http/https
            runCatching {
                val url = JSONObject(args).optString("url")
                require(url.startsWith("http://") || url.startsWith("https://")) { "非 http(s) URL" }
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                App.appContext.startActivity(intent)
                JSONObject().put("ok", true)
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "openExternal failed")
            }.toString()
        }

        rt.host.register("notify") {
            // Phase 3（D15）才做通知；v1 如实报 not-implemented
            JSONObject().put("ok", false).put("error", "notify: Phase 3 未实现（D15）").toString()
        }

        rt.host.register("saf.pickFolder") {
            // Phase 2（D14/203）：SAF 导入制工作区；脚手架阶段如实报 not-implemented
            JSONObject().put("ok", false).put("error", "saf.pickFolder: Phase 2 未实现（D14/203）").toString()
        }
    }
}
