/**
 * oc-plugin-search —— grep/glob 纯 JS 兜底（P1-3 / 能力清单 §5-3；对标 hos 102-harmony-js-tools）。
 *
 * 为什么必须是插件：Android 应用数据分区 noexec（规划 §4 L1），`rg`/`fff` 原生 ELF 不可得，
 * 上游搜索工具在设备上恒不可用。本插件注册同名 `grep` / `glob` 工具（editor.add 覆盖缺失面），
 * 全部用 Node 内建 fs 实现，不 spawn、不依赖原生模块。
 *
 * 判据（能力清单 §5-3）：会话内 grep/glob 工具返回正确匹配；上限与跳过表；host 用例全绿。
 *   · 上限：结果 200 条 / 单文件 1 MB / 扫描文件 20000 个，超限如实上报 truncated；
 *   · 跳过表：SKIP_DIRS（.git/node_modules/dist/build/out/.cache/target 等）+ 二进制文件
 *     （首 8KB 含 NUL）+ 超大文件，全部计入 metadata.skipped，不静默。
 *
 * 围栏：所有路径消解后必须仍在会话工作区内（context.location.project.directory），防 `..` 逃逸。
 */
import fs from 'node:fs'
import path from 'node:path'

export const PLUGIN_ID = 'oc-android-search'

const MAX_RESULTS = 200
const MAX_FILE_BYTES = 1_048_576
const MAX_FILES_SCAN = 20_000
const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', '.cache', '.gradle', '.idea', '.vs', '.vscode',
  'node_modules', 'dist', 'build', 'out', 'target', '.oc-import-tmp',
])

/** glob → RegExp：支持 **、*、?、[abc]、{a,b}；POSIX 分隔符。 */
export function globToRegExp(pattern) {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*'
        i++
        if (pattern[i + 1] === '/') i++ // `**/` 也匹配零层目录
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else if (c === '[') {
      const end = pattern.indexOf(']', i)
      if (end < 0) re += '\\['
      else { re += pattern.slice(i, end + 1); i = end }
    } else if (c === '{') {
      const end = pattern.indexOf('}', i)
      if (end < 0) re += '\\{'
      else {
        const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        re += `(?:${pattern.slice(i + 1, end).split(',').map(esc).join('|')})`
        i = end
      }
    } else re += /[.+^$()|[\]\\]/.test(c) ? `\\${c}` : c
  }
  return new RegExp(`^${re}$`)
}

/** 相对路径是否命中 glob（basename 或全相对路径任一命中即算）。 */
export function matchGlob(re, relPath) {
  const base = relPath.split('/').at(-1) ?? ''
  return re.test(relPath) || re.test(base)
}

function fenceResolve(root, inputPath) {
  const target = path.resolve(root, inputPath && String(inputPath).length > 0 ? String(inputPath) : '')
  const rel = path.relative(root, target)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null
  // symlink 收口（评审 M5）：base 本身是沙箱内符号链接时拒绝穿透到根外
  try {
    const real = fs.realpathSync(target)
    const realRoot = fs.realpathSync(root)
    const relReal = path.relative(realRoot, real)
    if (relReal.startsWith('..') || path.isAbsolute(relReal)) return null
  } catch {
    return null // 不存在/不可解析：交给上层报「无匹配」
  }
  return target
}

/** 受围栏的递归遍历：返回 {files, skippedDirs, scanned}（跳过表如实上报）。 */
export function walkFiles(root, base) {
  const files = []
  const skippedDirs = []
  let scanned = 0
  const walk = (dir, rel) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      skippedDirs.push(rel)
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (scanned >= MAX_FILES_SCAN) return
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) { skippedDirs.push(`${relPath}/`); continue }
        walk(path.join(dir, entry.name), relPath)
      } else if (entry.isFile()) {
        scanned++
        files.push({ abs: path.join(dir, entry.name), rel: relPath })
      }
    }
  }
  walk(base, '')
  return { files, skippedDirs, scanned }
}

/** grep 核心（可单测）：在文件集内按行匹配。 */
export function grepFiles(files, base, { regex, include, maxResults }) {
  const includeRe = include ? globToRegExp(include) : null
  const lines = []
  let truncated = false
  let skippedBinary = 0
  let skippedLarge = 0
  for (const f of files) {
    if (includeRe && !matchGlob(includeRe, f.rel)) continue
    let stat
    try { stat = fs.statSync(f.abs) } catch { continue }
    if (stat.size > MAX_FILE_BYTES) { skippedLarge++; continue }
    let buf
    try { buf = fs.readFileSync(f.abs) } catch { continue }
    if (buf.subarray(0, 8192).includes(0)) { skippedBinary++; continue }
    const text = buf.toString('utf8')
    const split = text.split('\n')
    for (let i = 0; i < split.length; i++) {
      const line = split[i]
      if (line.length > 2000) continue
      regex.lastIndex = 0
      if (!regex.test(line)) continue
      if (lines.length >= maxResults) { truncated = true; break }
      lines.push(`${f.rel}:${i + 1}: ${line.replace(/\r$/, '').trimEnd()}`)
    }
    if (truncated) break
  }
  return { lines, truncated, skippedBinary, skippedLarge }
}

const GREP_INPUT = {
  type: 'object',
  properties: {
    pattern: { type: 'string', description: 'Regular expression (JavaScript syntax).' },
    path: { type: 'string', description: 'Sub-directory to search, relative to the workspace root. Defaults to the root.' },
    include: { type: 'string', description: 'Glob filter for file names, e.g. "*.ts" or "src/**".' },
    ignoreCase: { type: 'boolean', description: 'Case-insensitive match. Default false.' },
    maxResults: { type: 'number', description: `Max matched lines (1-${MAX_RESULTS}). Default ${MAX_RESULTS}.` },
  },
  required: ['pattern'],
  additionalProperties: false,
}

const GLOB_INPUT = {
  type: 'object',
  properties: {
    pattern: { type: 'string', description: 'Glob pattern, e.g. "**/*.kt", "src/*.{ts,tsx}".' },
    path: { type: 'string', description: 'Sub-directory to search, relative to the workspace root.' },
    limit: { type: 'number', description: `Max paths returned (1-${MAX_RESULTS}). Default ${MAX_RESULTS}.` },
  },
  required: ['pattern'],
  additionalProperties: false,
}

export default {
  id: PLUGIN_ID,
  async setup(context) {
    const root = context?.location?.project?.directory
    if (typeof root !== 'string' || root.length === 0) {
      throw new Error(`${PLUGIN_ID}: context.location.project.directory is required (fence root)`)
    }
    const log = (message) => console.log(`[oc-android] search: ${message}`)
    if (!context?.tool || typeof context.tool.transform !== 'function') {
      throw new Error(`${PLUGIN_ID}: unexpected plugin context (missing context.tool.transform)`)
    }

    const grepTool = {
      name: 'grep',
      description:
        'Search file contents with a regular expression (pure-JavaScript implementation for devices without ripgrep). ' +
        `Returns up to ${MAX_RESULTS} "path:line: text" matches. Skips .git/node_modules/build etc. and binary files; ` +
        'skips are reported in metadata.',
      input: GREP_INPUT,
      options: { codemode: false },
      execute: async (input) => {
        const base = fenceResolve(root, input?.path)
        if (!base) return { content: 'path 越界（必须在工作区内）', metadata: { ok: false, code: 'out-of-root' } }
        let regex
        try {
          regex = new RegExp(String(input.pattern), input?.ignoreCase === true ? 'i' : '')
        } catch (error) {
          return { content: `正则无效：${error?.message ?? error}`, metadata: { ok: false, code: 'invalid-pattern' } }
        }
        const { files, skippedDirs, scanned } = walkFiles(root, base)
        const max = Math.min(Math.max(1, Number(input?.maxResults) || MAX_RESULTS), MAX_RESULTS)
        const r = grepFiles(files, base, { regex, include: input?.include, maxResults: max })
        const content = r.lines.length > 0
          ? r.lines.join('\n') + (r.truncated ? `\n… 结果截断（上限 ${max} 条）` : '')
          : '（无匹配）'
        return {
          content,
          metadata: {
            ok: true,
            matches: r.lines.length,
            truncated: r.truncated,
            scannedFiles: scanned,
            skipped: { dirs: skippedDirs, binary: r.skippedBinary, large: r.skippedLarge },
          },
        }
      },
    }

    const globTool = {
      name: 'glob',
      description:
        'Find files by glob pattern (pure-JavaScript implementation for devices without fd/fff). ' +
        `Returns up to ${MAX_RESULTS} relative paths. Skips .git/node_modules/build etc.; skips are reported in metadata.`,
      input: GLOB_INPUT,
      options: { codemode: false },
      execute: async (input) => {
        const base = fenceResolve(root, input?.path)
        if (!base) return { content: 'path 越界（必须在工作区内）', metadata: { ok: false, code: 'out-of-root' } }
        let re
        try {
          re = globToRegExp(String(input.pattern))
        } catch (error) {
          return { content: `glob 无效：${error?.message ?? error}`, metadata: { ok: false, code: 'invalid-pattern' } }
        }
        const { files, skippedDirs, scanned } = walkFiles(root, base)
        const limit = Math.min(Math.max(1, Number(input?.limit) || MAX_RESULTS), MAX_RESULTS)
        const hits = []
        let truncated = false
        for (const f of files) {
          if (!matchGlob(re, f.rel)) continue
          if (hits.length >= limit) { truncated = true; break }
          hits.push(f.rel)
        }
        return {
          content: hits.length > 0 ? hits.join('\n') + (truncated ? `\n… 结果截断（上限 ${limit} 条）` : '') : '（无匹配）',
          metadata: {
            ok: true,
            count: hits.length,
            truncated,
            scannedFiles: scanned,
            skipped: { dirs: skippedDirs },
          },
        }
      },
    }

    await context.tool.transform((editor) => {
      editor.add(grepTool)
      editor.add(globTool)
      const missing = ['grep', 'glob'].filter((name) => editor.get(name) === undefined)
      if (missing.length > 0) {
        throw new Error(`${PLUGIN_ID}: tool registration failed (missing ${missing.join(', ')})`)
      }
    })
    log('registered tools: grep, glob (JS fallback)')
    return () => {}
  },
}
