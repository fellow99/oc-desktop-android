#!/usr/bin/env node
/**
 * make-brand-materials.mjs —— 由父工程 `../assets/logo.svg` 生成 Android 启动器图标物料。
 *
 * 品牌决策（与 oc-desktop-hos 透明图标口径一致）：
 *   直接使用父工程 `../../assets/logo.png` 同款**透明**图标（橙色品牌图形，透明底），
 *   不做白底合成、不引入 adaptive-icon 前景/背景（启动器需要圆角/圆形遮罩时自行施加）。
 *
 * 唯一事实源 = 父工程矢量 `../../assets/logo.svg`（与 `logo.png` 同一图案）：
 *   · 用本机 Chromium（Chrome/Edge）headless 把 SVG 栅格化，**构建期不引三方图像库**；
 *   · 自证：200px 透明栅格化结果必须与父工程 `../../assets/logo.png` **逐像素一致**
 *     （同一图案的硬证据），不一致即硬失败。
 *
 * 产物（app/src/main/res/，全部入库、构建期零浏览器依赖）：
 *   mipmap-<density>/ic_launcher.png（透明底；mdpi 48 … xxxhdpi 192）
 *
 * 用法：
 *   node scripts/make-brand-materials.mjs            生成全部物料
 *   node scripts/make-brand-materials.mjs --check    只校验（重渲染 200px 与父工程 logo.png 像素比对）
 *   OCR_CHROMIUM=<exe> 可显式指定 Chromium 路径。
 * ============================================================================
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { decodePng } from './lib/png.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(SCRIPT_DIR, '..')
const PARENT_ASSETS = join(PROJECT_ROOT, '..', 'assets')
const RES_DIR = join(PROJECT_ROOT, 'app', 'src', 'main', 'res')
const CHECK_ONLY = process.argv.includes('--check')

/** mipmap 密度 → ic_launcher 边长 px（透明全幅） */
const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
]
const REF_SIZE = 200 // 与父工程 logo.png 同尺寸，逐像素自证

function fail(message) {
  console.error(`[brand-material] ✗ ${message}`)
  process.exit(1)
}

function findChromium() {
  const candidates = [
    process.env.OCR_CHROMIUM,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'chromium',
    'google-chrome',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      if (candidate.includes('/') || candidate.includes('\\')) {
        if (existsSync(candidate)) return candidate
      } else {
        execFileSync(candidate, ['--version'], { stdio: 'ignore' })
        return candidate
      }
    } catch {
      // 继续
    }
  }
  fail('未找到本机 Chromium（Chrome/Edge）。SVG→PNG 栅格化需要它；用 OCR_CHROMIUM=<exe> 指定。')
}

/**
 * 渲染一张 size×size 的**透明** PNG，logo 铺满整个画布。
 * 走「HTML 包裹 + <img> 固定尺寸」：SVG 自带 width/height(200)，直接截会按固有尺寸摆放。
 */
function render(chromium, workDir, { size, label }) {
  const htmlPath = join(workDir, `${label}.html`)
  const outPath = join(workDir, `${label}.png`)
  const html =
    '<!doctype html><html><head><meta charset=utf-8><style>' +
    'html,body{margin:0;padding:0;background:transparent;overflow:hidden}' +
    `img{display:block;width:${size}px;height:${size}px}</style></head>` +
    '<body><img src="logo.svg"></body></html>'
  writeFileSync(htmlPath, html)
  execFileSync(
    chromium,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${size},${size}`,
      `--screenshot=${outPath}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`,
    ],
    { stdio: 'ignore' },
  )
  if (!existsSync(outPath)) fail(`栅格化未产出：${label}`)
  return readFileSync(outPath)
}

/** 4 通道逐像素平均绝对差（同尺寸） */
function pixelDiff(a, b, label) {
  if (a.width !== b.width || a.height !== b.height) {
    fail(`${label} 尺寸不一致：${a.width}×${a.height} vs ${b.width}×${b.height}`)
  }
  let sum = 0
  for (let i = 0; i < a.rgba.length; i += 1) sum += Math.abs(a.rgba[i] - b.rgba[i])
  return sum / a.rgba.length
}

function main() {
  const svgPath = join(PARENT_ASSETS, 'logo.svg')
  const logoPng = join(PARENT_ASSETS, 'logo.png')
  if (!existsSync(svgPath)) fail(`父工程矢量物料缺失：${svgPath}`)
  if (!existsSync(logoPng)) fail(`父工程透明物料缺失：${logoPng}`)
  const reference = decodePng(readFileSync(logoPng), 'logo.png')

  const chromium = findChromium()
  const workDir = mkdtempSync(join(tmpdir(), 'oc-brand-'))
  try {
    writeFileSync(join(workDir, 'logo.svg'), readFileSync(svgPath))

    // ① 自证：透明背景 + logo 铺满 200px，必须与父工程 logo.png 逐像素一致
    const refBytes = render(chromium, workDir, { size: REF_SIZE, label: 'ref200' })
    const diff = pixelDiff(decodePng(refBytes, 'ref200.png'), reference, '200px 栅格化 vs 父工程 logo.png')
    if (diff > 0) fail(`栅格化 200px 与父工程 logo.png 不一致（平均绝对差 ${diff.toFixed(2)}）——物料可能已变更`)
    console.log('[brand-material] ✓ 200px 栅格化与父工程 logo.png 逐像素一致（平均绝对差 0.00）')

    if (CHECK_ONLY) {
      console.log('[brand-material] --check 通过')
      return
    }

    for (const d of DENSITIES) {
      const bytes = render(chromium, workDir, { size: d.size, label: `${d.dir}-${d.size}` })
      writeFileSync(join(RES_DIR, d.dir, 'ic_launcher.png'), bytes)
      console.log(`[brand-material] ✓ ${d.dir}/ic_launcher.png ${d.size}×${d.size}（透明）`)
    }
    console.log('[brand-material] 完成：透明品牌启动器图标已写入 app/src/main/res/mipmap-*')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()
