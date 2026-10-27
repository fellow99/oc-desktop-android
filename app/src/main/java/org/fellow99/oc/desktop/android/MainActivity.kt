package org.fellow99.oc.desktop.android

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import android.net.Uri
import android.content.Intent
import java.net.URLEncoder

/**
 * 主界面（规划 §4.2 / §6）：
 *  · 先显示应用内加载页（阶段文案），失败切错误页（阶段+原因+日志尾+重启提示）；
 *  · 就绪后 WebView 同源加载 `http://127.0.0.1:<port>/?auth_token=…`（D6）；
 *  · 导航围栏：本机服务放行，外链交系统浏览器（只拦主 frame）；
 *  · 首屏成功 clearHistory，防返回键回到加载页；configChanges 自理，旋转/折叠免重建。
 */
class MainActivity : Activity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var runtime: OpencodeRuntime

    private lateinit var phaseText: TextView
    private lateinit var loadingView: View
    private lateinit var webView: WebView
    private lateinit var errorText: TextView
    private lateinit var errorView: View

    private var firstPageDone = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runtime = OpencodeRuntime(this)

        setContentView(buildViews())

        scope.launch {
            runtime.phase.collect { phase ->
                when (phase) {
                    is OpencodeRuntime.Phase.Step -> showStep(phase.text)
                    is OpencodeRuntime.Phase.Ready -> showWeb(phase)
                    is OpencodeRuntime.Phase.Failed -> showError(phase)
                }
            }
        }
        runtime.launchIn(scope)
    }

    override fun onDestroy() {
        scope.cancel()
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
            return
        }
        if (webView.visibility == View.VISIBLE) {
            AlertDialog.Builder(this)
                .setTitle("退出")
                .setMessage("退出 OC Desktop Android？（进程内 Node 随应用结束，会话数据已落盘）")
                .setPositiveButton("退出") { _, _ -> finishAndRemoveTask() }
                .setNegativeButton("取消", null)
                .show()
            return
        }
        super.onBackPressed()
    }

    // ── 视图 ─────────────────────────────────────────────────────────────────

    private fun buildViews(): View {
        val root = FrameLayout(this)

        // 加载页
        val loading = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }
        phaseText = TextView(this).apply {
            textSize = 16f
            setPadding(48, 24, 48, 24)
            gravity = Gravity.CENTER
        }
        loading.addView(ProgressBar(this))
        loading.addView(phaseText)
        loadingView = loading
        root.addView(loading, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // WebView（就绪后显示）
        webView = WebView(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.WHITE)
        }
        root.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // 错误页
        val error = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }
        errorText = TextView(this).apply {
            textSize = 12f
            typeface = android.graphics.Typeface.MONOSPACE
            setTextIsSelectable(true)
            setPadding(32, 16, 32, 16)
        }
        error.addView(
            ScrollView(this).apply { addView(errorText) },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f),
        )
        error.addView(Button(this).apply {
            text = "重启应用"
            setOnClickListener {
                // 进程内 Node 无优雅重启：整进程退出，由用户/系统冷启动（规划 §2.1 崩溃终态）
                runtime.rt.shutdown("ui-restart")
                finishAndRemoveTask()
                Runtime.getRuntime().exit(0)
            }
        })
        errorView = error
        errorView.visibility = View.GONE
        root.addView(errorView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        return root
    }

    private fun showStep(text: String) {
        if (firstPageDone || webView.visibility == View.VISIBLE) return
        loadingView.visibility = View.VISIBLE
        errorView.visibility = View.GONE
        phaseText.text = "OC Desktop Android\n\n$text"
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showWeb(ready: OpencodeRuntime.Phase.Ready) {
        if (webView.visibility == View.VISIBLE) return
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // SPA 首屏必需（D4）
            databaseEnabled = true
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                // 只拦主 frame：本机服务放行；其余交系统（§6 #11）
                if (!request.isForMainFrame) return false
                val host = url.host ?: return false
                if (host == "127.0.0.1" || host == "localhost") return false
                return runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url.toString())))
                    true
                }.getOrDefault(true)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (!firstPageDone) {
                    firstPageDone = true
                    view?.clearHistory() // 防返回键回到加载页（§4.2）
                }
                super.onPageFinished(view, url)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true && !firstPageDone) {
                    val desc = error?.description ?: "页面加载失败"
                    showError(
                        OpencodeRuntime.Phase.Failed(
                            "webview",
                            "主界面加载失败：$desc\nURL 主机已掩码（auth_token 不落日志）",
                            Diagnostics.nodeLogTail(runtime.rt),
                        ),
                    )
                }
                super.onReceivedError(view, request, error)
            }
        }
        loadingView.visibility = View.GONE
        errorView.visibility = View.GONE
        webView.visibility = View.VISIBLE
        // auth_token 里的 '+'/'=' 必须百分号编码（URLSearchParams 会把裸 '+' 解成空格）
        val token = URLEncoder.encode(ready.authToken, "UTF-8")
        webView.loadUrl("${ready.baseUrl}/?auth_token=$token")
        Diagnostics.evidence(this, "loadUrl ${ready.baseUrl}/?auth_token=*** port=${ready.port}")
    }

    private fun showError(phase: OpencodeRuntime.Phase.Failed) {
        loadingView.visibility = View.GONE
        webView.visibility = View.GONE
        errorView.visibility = View.VISIBLE
        errorText.text = "启动失败（阶段：${phase.stage}）\n\n${phase.reason}"
    }
}
