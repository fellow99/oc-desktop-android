package org.fellow99.oc.desktop.android

import android.app.Application
import android.content.Context

/** 应用级 Context 持有者（宿主能力桥回调无 Context 参数，从这取）。 */
class App : Application() {

    override fun onCreate() {
        super.onCreate()
        appContext = this
    }

    companion object {
        @Volatile
        lateinit var appContext: Context
            private set
    }
}
