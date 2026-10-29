package org.fellow99.oc.desktop.android

import android.Manifest
import android.content.Context
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

        rt.host.register("notify") { args ->
            // D15/Phase 3：应用内通知（长任务完成提醒）。13+ 需通知授权（保活开启时已请求）。
            runCatching {
                val title = JSONObject(args).optString("title", "OC Desktop")
                val body = JSONObject(args).optString("body")
                val manager = App.appContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                if (Build.VERSION.SDK_INT >= 26) {
                    manager.createNotificationChannel(
                        android.app.NotificationChannel("notify", "应用通知", android.app.NotificationManager.IMPORTANCE_DEFAULT),
                    )
                }
                val builder = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(App.appContext, "notify") else android.app.Notification.Builder(App.appContext)
                builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(body)
                val nm = if (Build.VERSION.SDK_INT >= 33) {
                    // 33+ 未授权时 notify() 静默失败——如实上报授权状态
                    if (App.appContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                        manager.notify(42003, builder.build()); "granted"
                    } else "notifications-not-granted"
                } else { manager.notify(42003, builder.build()); "granted" }
                JSONObject().put("ok", true).put("permission", nm)
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "notify failed")
            }.toString()
        }

        rt.host.register("keepalive.set") { args ->
            // D15/Phase 3：可选前台服务保活开关（持久化；默认关）
            runCatching {
                val enabled = JSONObject(args).optBoolean("enabled")
                KeepaliveService.prefs(App.appContext).edit().putBoolean("enabled", enabled).apply()
                val activity = MainActivity.instanceOrNull()
                    ?: return@register JSONObject().put("ok", false).put("error", "MainActivity 未就绪").toString()
                activity.runOnUiThread {
                    if (enabled) KeepaliveService.start(activity) else KeepaliveService.stop(activity)
                }
                JSONObject().put("ok", true).put("enabled", enabled)
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "keepalive.set failed")
            }.toString()
        }

        rt.host.register("keepalive.get") {
            runCatching {
                JSONObject()
                    .put("ok", true)
                    .put("enabled", KeepaliveService.prefs(App.appContext).getBoolean("enabled", false))
                    .toString()
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "keepalive.get failed").toString()
            }
        }

        rt.host.register("saf.pickFolder") { args ->
            // P1-6 / 203 R2：SAF 导入制工作区。发起后立即返回 token；拷贝后台进行，
            // 进度由插件经 importStatus 轮询 `workspace/.import-<token>.json`（SafImport 写入）。
            runCatching {
                val suggested = JSONObject(args).optString("suggestedName")
                val activity = MainActivity.instanceOrNull()
                    ?: return@register JSONObject().put("ok", false).put("error", "MainActivity 未就绪").toString()
                SafImport.request(activity, suggested.ifEmpty { null }).toString()
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "saf.pickFolder failed").toString()
            }
        }

        rt.host.register("saf.cancelImport") { args ->
            runCatching {
                val token = JSONObject(args).optString("token")
                SafImport.cancel(token).toString()
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "saf.cancelImport failed").toString()
            }
        }

        rt.host.register("openAppInfo") {
            // 深链到本应用信息页（203 权限归位；Android 无目录级 ACL，用户只能 here 管理）
            runCatching {
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.fromParts("package", App.appContext.packageName, null))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                App.appContext.startActivity(intent)
                JSONObject().put("ok", true)
            }.getOrElse {
                JSONObject().put("ok", false).put("error", it.message ?: "openAppInfo failed")
            }.toString()
        }
    }
}
