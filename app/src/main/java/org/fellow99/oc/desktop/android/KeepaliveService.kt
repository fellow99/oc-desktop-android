package org.fellow99.oc.desktop.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * 可选前台服务（D15，Phase 3）：长会话保活。
 *
 * · 默认关闭；开关 = 退出确认对话框的「保活」按钮（Keepalive.prefs 持久化）；
 * · foregroundServiceType=dataSync + 常驻通知（Android 13+ 需 POST_NOTIFICATIONS 运行时授权，
 *   授权在用户点「开启保活」时向 MainActivity 请求）；
 * · 纪律：服务自身零业务逻辑（Node 在主进程，随应用生死；本服务只提供进程优先级提升 + 用户可见通知）。
 */
class KeepaliveService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification(), if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    private fun buildNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, getString(R.string.keepalive_channel), NotificationManager.IMPORTANCE_LOW),
            )
        }
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
        return builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(getString(R.string.keepalive_title))
            .setContentText(getString(R.string.keepalive_text))
            .setOngoing(true)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "keepalive"
        const val NOTIFICATION_ID = 42002

        fun prefs(context: Context) = context.getSharedPreferences("keepalive", Context.MODE_PRIVATE)

        fun start(context: Context) {
            val intent = Intent(context, KeepaliveService::class.java)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, KeepaliveService::class.java))
        }
    }
}
