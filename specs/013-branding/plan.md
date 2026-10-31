# 013-branding 技术方案（Android as-built）

> 对应规格：[spec.md](./spec.md)
> 父规格：[`../../specs/013-branding/plan.md`](../../specs/013-branding/plan.md)
> 最后更新：2026-11-01

## 1. 技术上下文

| 项 | 值 | 来源 |
|---|---|---|
| 平台 | Android，minSdk 24 / targetSdk 36 | `gradle/libs.versions.toml` |
| 语言 | Kotlin 2.1.20 | 同上 |
| 上游 | opencode v2.2.5 `9bbb8ce18c` | `patches/v2.2.5/README.md` |
| 品牌补丁 | `0010-branding-oc-desktop.patch` | `packages/app/index.html` |
| 图标生成 | `scripts/make-brand-materials.mjs` + `scripts/lib/png.mjs` | 纯 JS PNG 处理 |
| 守卫 | `scripts/verify-branding.mjs` | 6 类断言 |
| smoke | `scripts/smoke-node24.mjs` | title 断言 + `/global/health` |

## 2. 宪法合规

| 条款 | 判定 | 说明 |
|---|---|---|
| FR-013-001..008 | ✅ | 应用名/标题/图标/许可/非官方/守卫均有落点 |
| S5 | ✅ | 品牌物料不含凭据 |
| G3 品牌门 | ✅ | verify-branding + smoke title |

## 3. 研究结论

1. **title 补丁最小**：0010 只改 `packages/app/index.html` 的 `<title data-sm>`，不 fork UI。
2. **图标决策**：直接使用父工程透明 logo 生成五密度 PNG，不使用 adaptive icon；`verify-branding` 明确禁止 `mipmap-anydpi-v26`。
3. **应用名统一**：`app_name=OC Desktop`，禁止 `OC Desktop Android`；版别只在 README/关于页出现。
4. **许可与声明**：`THIRD-PARTY-NOTICES.md` + 关于页字符串 + README 三处共同满足 G3/G6。
5. **冒烟联动**：`smoke-node24` 在 host 侧断言首页 title，能在打包前发现补丁失效。

## 4. 数据模型

```
BrandingInput {
  assets: "../assets/logo.png (200x200 transparent)"
  densities: { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192 }
}
BrandingAssertions {
  app_name: "OC Desktop"
  title_prefix: "OC Desktop"
  icons: "5 densities, exact size"
  res_open_source_residue: 0
  notices: ["opencode", "MIT", "非官方"]
  about: ["非官方", "THIRD-PARTY-NOTICES"]
}
```

## 5. 接口契约

### 5.1 提供

- `app_name` / 关于页字符串 / 图标资源 / 许可文件；
- `verify-branding.mjs` 退出码（0 通过，1 失败）；
- `smoke-node24` title 断言。

### 5.2 消费

- 父工程 `assets/`；
- 上游 `index.html`（补丁 0010）；
- Gradle 资源合并；
- `012-building-workflow` 的构建门禁。

## 6. 实现策略

### 6.1 UI 标题

- `patches/v2.2.5/0010-branding-oc-desktop.patch`：
  - `- <title data-sm>OpenCode</title>`
  - `+ <title data-sm>OC Desktop</title>`
- 补丁按 tag 维护；上游若改 title 结构，重生成补丁。

### 6.2 应用名与关于页

- `app/src/main/res/values/strings.xml`：
  - `app_name` = `OC Desktop`
  - `about_title` = `关于 OC Desktop`
  - `about_body` 含版本、Android Edition、非官方声明、许可指引
- `verify-branding` 断言 `app_name` 与关于页文字。

### 6.3 图标

- `scripts/make-brand-materials.mjs`：
  - 读取父工程 `assets/logo.png`；
  - 用 `scripts/lib/png.mjs` 缩放/编码；
  - 输出五密度 `ic_launcher.png`；
- `verify-branding` 检查尺寸与存在性，禁止 adaptive 资源目录。

### 6.4 许可与非官方声明

- `app/src/main/assets/THIRD-PARTY-NOTICES.md`：opencode/MIT/非官方；
- README 含“非 opencode 团队构建”；
- 关于页字符串含“非官方”与许可指引。

### 6.5 错误处理

- 守卫失败列出具体问题并非零退出；
- 缺图标/尺寸不符/残留 `OpenCode` 均阻断；
- smoke title 不符直接失败。

## 7. 测试与验证

| 项 | 命令 | 通过标准 |
|---|---|---|
| 品牌守卫 | `node scripts/verify-branding.mjs` | 全过 |
| smoke title | `node scripts/smoke-node24.mjs` | title 以 `OC Desktop` 开头 |
| 图标 | 检查 `mipmap-*` | 五密度尺寸正确 |
| 应用名 | 安装后查看 | `OC Desktop` |
| 关于页 | UI 打开 | 非官方声明/许可可见 |

## 8. 文件清单

| 文件 | 作用 |
|---|---|
| `patches/v2.2.5/0010-branding-oc-desktop.patch` | title 补丁 |
| `scripts/make-brand-materials.mjs` | 图标生成 |
| `scripts/lib/png.mjs` | PNG 编解码 |
| `scripts/verify-branding.mjs` | 品牌守卫 |
| `scripts/smoke-node24.mjs` | title 冒烟 |
| `app/src/main/res/values/strings.xml` | 应用名/关于页 |
| `app/src/main/assets/THIRD-PARTY-NOTICES.md` | 许可 |
| `specs/013-branding/spec.md` | 本模块规格 |
