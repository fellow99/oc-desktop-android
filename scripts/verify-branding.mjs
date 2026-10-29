#!/usr/bin/env node
/**
 * verify-branding.mjs —— 品牌化断言守卫（P1-4 / E5；对标 hos 103-branding 的漂移守卫思路）。
 *
 * 断言（任一失败 ⇒ 退出码 1）：
 *   ① strings.xml app_name = 「OC Desktop Android」；
 *   ② AndroidManifest 声明 icon/roundIcon（自适应图标物料在位）；
 *   ③ assets/THIRD-PARTY-NOTICES.md 存在且含 opencode/MIT（G3）；
 *   ④ 关于页字符串含非官方声明（G6）；
 *   ⑤ 应用面资源（res/）无 「OpenCode」 指称残留（上游包名/代码路径不在断言范围）；
 *   ⑥ README.md 含非官方声明。
 * UI document.title 判据由补丁 0010 + smoke-node24（服务首页 title 断言）承担。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

const strings = readFileSync(path.join(root, 'app/src/main/res/values/strings.xml'), 'utf8')
if (!/<string name="app_name">OC Desktop Android<\/string>/.test(strings)) {
  problems.push('strings.xml app_name ≠ 「OC Desktop Android」')
}
if (!strings.includes('非官方') || !strings.includes('THIRD-PARTY-NOTICES')) {
  problems.push('关于页字符串缺非官方声明或许可指引（G6/G3）')
}

const manifest = readFileSync(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8')
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) problems.push('Manifest 未声明 android:icon')
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) problems.push('Manifest 未声明 android:roundIcon')

const notices = path.join(root, 'app/src/main/assets/THIRD-PARTY-NOTICES.md')
if (!existsSync(notices)) {
  problems.push('缺 app/src/main/assets/THIRD-PARTY-NOTICES.md（G3）')
} else {
  const text = readFileSync(notices, 'utf8')
  if (!text.includes('opencode')) problems.push('THIRD-PARTY-NOTICES 未收录 opencode')
  if (!text.includes('MIT')) problems.push('THIRD-PARTY-NOTICES 未标注 MIT 许可')
  if (!text.includes('非官方')) problems.push('THIRD-PARTY-NOTICES 缺非官方声明')
}

/* res/ 下应用面资源不得出现 OpenCode 指称（上游包名/代码不在范围） */
function walkRes(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) walkRes(abs)
    else if (/\.xml$/.test(entry.name)) {
      const text = readFileSync(abs, 'utf8')
      if (/OpenCode/.test(text)) problems.push(`应用面资源含 OpenCode 残留：${path.relative(root, abs)}`)
    }
  }
}
walkRes(path.join(root, 'app/src/main/res'))

const readme = readFileSync(path.join(root, 'README.md'), 'utf8')
if (!readme.includes('非 opencode 团队构建')) problems.push('README.md 缺非官方声明（G6）')

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`)
  process.exit(1)
}
console.log('✓ 品牌化断言全过：app_name / 图标 / THIRD-PARTY-NOTICES / 非官方声明 / 0 残留（应用面资源）')
