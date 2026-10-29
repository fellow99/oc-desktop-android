package org.fellow99.oc.desktop.android

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * SAF 导入制工作区（203 R2/R3/R5；规划 §5.13 D14）。
 *
 * 流程：`saf.pickFolder`（Node 侧插件 RPC 发起）→ 系统 SAF 选树 → 后台单线程拷入
 * `<filesDir>/workspace/<name>/` → 进度落 `workspace/.import-<token>.json`（插件 importStatus 轮询）
 * → 完成后目标目录写 `.import.json`（来源与时间）→ 清理进度文件（保留 done 态一次供末次查询）。
 *
 * 纪律：
 *  · 零新依赖：不用 androidx.documentfile，DocumentsContract 手写遍历（content:// 非真实路径 ⇒ 导入制）；
 *  · 失败可见：进度文件携带 error；不弹窗、不静默；
 *  · 可取消：cancelImport 置位，逐文件检查（R3）；
 *  · 单飞行：一次只允许一个导入任务（桌面单窗口语义）。
 */
object SafImport {

    private class Pending(
        val token: String,
        val name: String,
        val progressFile: File,
        val canceled: AtomicBoolean = AtomicBoolean(false),
    ) {
        /** 最近一次累计（供终态进度与 .import.json 使用；由拷贝线程更新） */
        @Volatile var lastFiles: Long = 0
        @Volatile var lastBytes: Long = 0
    }

    /** 已发起、等待用户在 SAF 里选树 */
    @Volatile
    private var pending: Pending? = null

    /** 用户已选树、后台拷贝进行中（取消与单飞行守卫覆盖到整个拷贝阶段，C1 修复） */
    @Volatile
    private var active: Pending? = null
    private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "oc-saf-import") }

    /**
     * 发起 SAF 选树（主线程调用，立即返回）。返回给桥的 JSON：
     * `{ok, token, name}` 或 `{ok:false, error}`。
     */
    @Synchronized
    fun request(activity: MainActivity, suggestedName: String?): JSONObject {
        sweepStaleProgress(activity)
        if (pending != null || active != null) {
            return JSONObject().put("ok", false).put("error", "已有导入任务进行中（先完成或取消）")
        }
        val token = newToken()
        val name = sanitizeName(activity, suggestedName) ?: defaultName()
        val pendingItem = Pending(token, name, progressFile(activity, token))
        pending = pendingItem
        writeProgress(pendingItem, done = false, canceled = false, error = "", copiedFiles = 0, copiedBytes = 0, importedTo = "")
        val ok = activity.launchTreePicker(REQUEST_CODE)
        if (!ok) {
            pending = null
            return JSONObject().put("ok", false).put("error", "无法打开系统目录选择器")
        }
        return JSONObject().put("ok", true).put("token", token).put("name", name)
    }

    /** 取消（桥 saf.cancelImport）。pending（未选树）与 active（拷贝中）两个阶段都可取消。 */
    fun cancel(token: String): JSONObject {
        val waiting = pending?.takeIf { it.token == token }
        val running = active?.takeIf { it.token == token }
        val item = waiting ?: running
        if (item == null) {
            return JSONObject().put("ok", false).put("message", "无此进行中的导入任务")
        }
        item.canceled.set(true)
        if (waiting != null) {
            // 还没选树：直接终态并清 slot（后续 onPickerResult 会因 pending=null 忽略）
            pending = null
            finishProgress(item, done = true, canceled = true, error = "已取消（未选择目录）", importedTo = "")
        }
        return JSONObject().put("ok", true).put("message", "已请求取消")
    }

    /** MainActivity.onActivityResult 回传（主线程）。 */
    fun onPickerResult(activity: MainActivity, resultCode: Int, treeUri: Uri?) {
        val item = pending ?: return
        pending = null
        if (resultCode != android.app.Activity.RESULT_OK || treeUri == null) {
            finishProgress(item, done = true, canceled = item.canceled.get(), error = "用户取消或未选择目录", importedTo = "")
            return
        }
        active = item
        executor.execute {
            try {
                copyTree(activity, item, treeUri)
            } finally {
                if (active === item) active = null
            }
        }
    }

    // ── 拷贝实现 ─────────────────────────────────────────────────────────────

    private fun copyTree(activity: MainActivity, item: Pending, treeUri: Uri) {
        val resolver = activity.contentResolver
        val filesDir = activity.filesDir
        val workspaceRoot = File(filesDir, "workspace")
        var dest = File(workspaceRoot, item.name)
        var n = 2
        while (dest.exists()) dest = File(workspaceRoot, "${item.name} ${n++}")
        try {
            val rootDocId = DocumentsContract.getTreeDocumentId(treeUri)
            dest.mkdirs()
            // 共享累计（I1 修复：递归各层累加到同一数组，不再用本层局部值覆写外层）
            val totals = longArrayOf(0L, 0L)
            copyChildren(activity, resolver, treeUri, rootDocId, dest, item, totals)
            if (item.canceled.get()) {
                dest.deleteRecursively()
                finishProgress(item, done = true, canceled = true, error = "已取消", importedTo = "")
                return
            }
            // .import.json（203 R2：记来源与时间）
            File(dest, ".import.json").writeText(
                JSONObject()
                    .put("sourceUri", treeUri.toString())
                    .put("importedAt", nowIso())
                    .put("files", totals[0])
                    .put("bytes", totals[1])
                    .toString(),
            )
            finishProgress(item, done = true, canceled = false, error = "", importedTo = dest.absolutePath)
        } catch (t: Throwable) {
            dest.deleteRecursively()
            finishProgress(item, done = true, canceled = item.canceled.get(), error = "${t.javaClass.simpleName}: ${t.message}", importedTo = "")
        }
    }

    /** provider 返回的显示名消毒（I2 修复：拒 `/`、`\`、`..`、控制符与点开头，防路径穿越/隐藏项） */
    private fun isValidEntryName(name: String?): Boolean {
        if (name.isNullOrEmpty()) return false
        if (name == "." || name == "..") return false
        if (name.startsWith(".")) return false
        if (name.contains('/') || name.contains('\\')) return false
        return name.none { it.code < 0x20 || it.code == 0x7f }
    }

    private fun copyChildren(
        activity: MainActivity,
        resolver: android.content.ContentResolver,
        treeUri: Uri,
        parentDocId: String,
        destDir: File,
        item: Pending,
        totals: LongArray,
    ) {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId)
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
        resolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                if (item.canceled.get()) return
                val docId = cursor.getString(0)
                val displayName = cursor.getString(1)
                if (!isValidEntryName(displayName)) continue
                val mime = cursor.getString(2)
                val childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)
                if (DocumentsContract.Document.MIME_TYPE_DIR == mime) {
                    val sub = File(destDir, displayName)
                    sub.mkdirs()
                    copyChildren(activity, resolver, treeUri, docId, sub, item, totals)
                    totals[0] += 1 // 目录本身计一件（进度感）
                } else {
                    val target = File(destDir, displayName)
                    resolver.openInputStream(childUri)?.use { input ->
                        target.outputStream().use { output -> input.copyTo(output, 256 * 1024) }
                    } ?: continue
                    totals[0] += 1
                    totals[1] += target.length()
                }
                item.lastFiles = totals[0]
                item.lastBytes = totals[1]
                if (totals[0] % 16 == 0L) {
                    writeProgress(item, done = false, canceled = item.canceled.get(), error = "", copiedFiles = totals[0], copiedBytes = totals[1], importedTo = "")
                }
            }
        }
    }

    // ── 工具 ─────────────────────────────────────────────────────────────────

    private fun newToken(): String =
        java.util.UUID.randomUUID().toString().replace("-", "").take(24)

    private fun progressFile(context: Context, token: String): File =
        File(File(context.filesDir, "workspace"), ".import-$token.json")

    private fun sanitizeName(context: Context, raw: String?): String? {
        val value = raw?.trim() ?: return null
        if (value.isEmpty() || value.length > 255) return null
        if (value == "." || value == "..") return null
        if (value.contains('/') || value.contains('\\')) return null
        if (value.any { it.code < 0x20 || it.code == 0x7f }) return null
        return value
    }

    private fun defaultName(): String =
        "import-" + java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date())

    /** ISO-8601 本地时间（I3 修复：minSdk 24 无 java.time，改用 SimpleDateFormat） */
    private fun nowIso(): String =
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", java.util.Locale.US).format(java.util.Date())

    /** 清扫孤儿进度文件（M2：done=false 且超过 1 小时的 `.import-*.json`，避免永久「进行中」与文件累积） */
    private fun sweepStaleProgress(activity: MainActivity) {
        val dir = File(activity.filesDir, "workspace")
        val stale = System.currentTimeMillis() - 60 * 60 * 1000L
        dir.listFiles { f -> f.name.startsWith(".import-") && f.name.endsWith(".json") }?.forEach { f ->
            runCatching {
                val json = JSONObject(f.readText())
                if (json.optBoolean("done", false) != true && f.lastModified() < stale) f.delete()
            }
        }
    }

    private fun writeProgress(
        item: Pending,
        done: Boolean,
        canceled: Boolean,
        error: String,
        copiedFiles: Long,
        copiedBytes: Long,
        importedTo: String,
    ) {
        item.progressFile.parentFile?.mkdirs()
        val json = JSONObject()
            .put("token", item.token)
            .put("name", item.name)
            .put("done", done)
            .put("canceled", canceled)
            .put("copiedFiles", copiedFiles)
            .put("copiedBytes", copiedBytes)
            .put("importedTo", importedTo)
        if (error.isNotEmpty()) json.put("error", error)
        val tmp = File(item.progressFile.parentFile, item.progressFile.name + ".tmp")
        tmp.writeText(json.toString())
        if (!tmp.renameTo(item.progressFile)) {
            tmp.copyTo(item.progressFile, overwrite = true)
            tmp.delete()
        }
    }

    private fun finishProgress(
        item: Pending,
        done: Boolean,
        canceled: Boolean,
        error: String,
        importedTo: String,
    ) {
        // 终态保留一次供插件末次 importStatus（真实计数；未拷贝时为 0）
        writeProgress(item, done, canceled, error, copiedFiles = item.lastFiles, copiedBytes = item.lastBytes, importedTo = importedTo)
    }

    const val REQUEST_CODE = 42001
}
