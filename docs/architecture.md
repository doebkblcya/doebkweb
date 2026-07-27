# 项目架构文档

## 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 静态站点生成器 | Astro | ^5.6 |
| 动画库 | Motion（原 Framer Motion） | ^12.11 |
| 类型检查 | @astrojs/check + TypeScript | ^5.8 |
| 搜索 | Pagefind | ^1.5.2 |
| 部署 | Cloudflare Pages + R2 | — |

---

## 目录结构

```
doebkweb/
├── public/                        # 静态资源，直接复制到 dist/
│   ├── favicon.svg                #   站点图标
│   └── music/                     #   MP3 文件（Nginx 直出）
│
├── src/
│   ├── styles/                    # 全局样式
│   │   ├── tokens.css             #   Design Tokens（颜色/间距/字体/阴影/玻璃）
│   │   ├── reset.css              #   CSS Reset
│   │   └── global.css             #   全局排版基础样式
│   │
│   ├── types/                     # TypeScript 类型定义
│   │   └── i18n.ts                #   UIStrings 接口（强制中英文结构一致）
│   │
│   ├── i18n/                      # 国际化文案
│   │   ├── zh.ts                  #   中文 UI 字符串
│   │   └── en.ts                  #   英文 UI 字符串
│   │
│   ├── data/                      # 共享数据层
│   │   ├── music.json             #   音乐配置（唯一数据源，纯 JSON）
	│   │   ├── playlist.ts            #   类型定义 + helper（从 music.json 导入）
│   │   └── photos.ts              #   摄影数据（缩略图/原图/alt）
│   │
│   ├── content/                   # Content Collections
│   │   ├── config.ts              #   Collection schema（zod 校验）
│   │   └── docs/                  #   Markdown 文档
│   │       ├── about.md           #     关于我（listed: false）
│   │       └── *.md               #     技术文档
│   │
│   ├── layouts/                   # 页面布局
│   │   └── BaseLayout.astro       #   全局布局骨架（双栏 + 内容区）
│   │
│   ├── components/                # 可复用组件
│   │   ├── Sidebar.astro          #   左侧导航栏（7.5rem + 设置面板入口）
│   │   ├── VinylPlayer.astro      #   唱片播放器（右上角悬浮，View Transition 持久化）
│   │   └── LanguageSettings.astro #   语言 & 设置弹窗（居中窗口，语言切换 + 内容宽度调节）
│   │
│   └── pages/                     # 路由页面（文件路径 = URL）
│       ├── index.astro            #   / → 301 重定向到 /zh/
│       └── [lang]/                #   语言前缀路由组
│           ├── _getStaticPaths.ts #     共享的 getStaticPaths（zh/en 双路径生成）
│           ├── index.astro        #     /zh/  /en/  首页（全屏欢迎）
│           ├── about.astro        #     /zh/about/  关于我（MD 渲染 + 简历下载）
│           ├── music.astro        #     /zh/music/  专辑架（黑胶动画 + 播放联动）
│           ├── photos.astro       #     /zh/photos/ 摄影网格（懒加载 + Lightbox）
│           ├── 404.astro          #     /zh/404/    自定义 404
│           └── docs/              #     文档系统
│               ├── index.astro    #       文档列表（搜索 + 排序）
│               └── [slug].astro   #       文档详情（Shiki 高亮）
│
├── docs/                          # 项目文档（本文件所在目录）
├── astro.config.mjs               # Astro 配置（i18n + Shiki）
├── tsconfig.json                  # TypeScript 配置
├── package.json                   # 依赖与脚本
└── .gitignore
```

---

## 路由设计

```
/                                  →  301 重定向到 /zh/
/[lang]/                           →  首页（全屏欢迎页）
/[lang]/about/                     →  About Me（Markdown 渲染 + 简历下载）
/[lang]/music/                     →  专辑架（黑胶动画 + 播放联动）
/[lang]/photos/                    →  摄影网格（懒加载 + Lightbox）
/[lang]/docs/                      →  文档列表（搜索 + 排序）
/[lang]/docs/[slug]/               →  文档详情（Shiki 语法高亮）
/[lang]/404/                       →  自定义 404
```

页面对应 `/src/pages/[lang]/*.astro`，由 Astro 文件路由自动映射。

---

## Design Tokens 架构

```
:root {                        ← 当前：亮色模式
  --color-bg-page: #f5f5f7
  --color-bg-surface: #ffffff
  --color-text-primary: #1d1d1f
  --color-accent: #0071e3
  --glass-bg: rgba(255,255,255,0.72)
  ...
}

[data-theme="dark"] {          ← 预留：暗色模式（空实现）
  /* 后续补充 */
}
```

**换肤方式**：修改 `tokens.css` 中的 CSS 自定义属性值即可整体更换品牌色、字体、间距。不涉及组件代码改动。

---

## i18n 架构

```
src/types/i18n.ts              UIStrings 接口（类型约束）
       │
       ├── src/i18n/zh.ts      UI 文案实现（中文）
       └── src/i18n/en.ts      UI 文案实现（英文）
                │
                ▼
       layouts/BaseLayout.astro
         ├── <html lang={lang}>
         ├── <title> 根据 title prop + site.title 拼接
         ├── <Sidebar t={t}>
         └── <VinylPlayer>
```

**规则**：
- `zh.ts` 和 `en.ts` 导出同名 `ui` 对象，结构由 `UIStrings` 接口约束
- 新增 UI 文案时：先在 `UIStrings` 中加字段 → 再在 `zh.ts`/`en.ts` 中补全 → 编译期 TS 检查遗漏
- 路由级翻译由 `[lang]` 动态参数 + `getStaticPaths` 实现，每页预渲染 zh/en 两份 HTML
- **文档内容不翻译**，语言切换仅切换 UI 文案

---

## 组件数据流

```
BaseLayout.astro
  ├── 导入 tokens.css → reset.css → global.css（全局生效）
  ├── 根据 Astro.currentLocale 选择 zh/en UI 文案
  ├── 始终渲染（所有页面）：
  │   ├── <audio id="audio" persist />  # 音频元素，跨页持久化
  │   ├── <VinylPlayer />               # 唱片播放器，跨页持久化
  │   ├── {!hideHeader && <Sidebar />}  # 首页隐藏
  │   └── <main><slot /></main>
  └── 首页：body 无 has-sidebar class，VinylPlayer CSS 隐藏
```

每个 `[lang]` 页面文件：
1. `export { getStaticPaths }` → 生成 zh/en 两条静态路径
2. 导入 `BaseLayout` → 传 `title`、`hideHeader`、`hideFooter` prop
3. 根据当前 locale 加载对应 i18n 文案
4. 渲染页面内容

---

## View Transition 持久化架构

### 机制

`#audio` 和 `VinylPlayer` 使用 `transition:persist` 跨页面保持 DOM 元素。两者在 BaseLayout 中始终渲染，首页通过 CSS 隐藏 VinylPlayer。

```
所有页面:
  <audio id="audio" persist />     ← 始终存在，跨页存活
  <VinylPlayer persist />          ← 始终存在，首页 CSS 隐藏
  <Sidebar />                      ← hideHeader 时不存在
```

### 首页行为

首页 `body` 无 `has-sidebar` class → `body:not(.has-sidebar) .vinyl-app { display: none }`。
首页脚本：pause audio → 清 dataset → dispatch `vp-reset` CustomEvent 在 `#audio` 上，
VinylPlayer 监听 `vp-reset` 重置 UI（封面、文本、按钮）。

### VinylPlayer 生命周期

```
init() 执行一次（vinylReady 守卫）
  ├─ wireAudio()        → 所有监听器绑定到 #audio（play/pause/ended/album-change/track-change/vp-reset）
  ├─ document click      → 委托事件（始终有效）
  ├─ 读 audio.dataset    → 恢复封面/专辑名
  └─ 同 syncPlayingState → 同步播放状态

无 teardown / before-swap / after-swap（组件从不销毁）
```

### 事件总线

所有自定义事件在 `#audio` 上：
- `album-change` ← music 页 dispatch → VinylPlayer 监听到 → 加载专辑
- `track-change` ← VinylPlayer dispatch → VinylPlayer 监听到 → 更新 UI
- `vp-reset` ← 首页 dispatch → VinylPlayer 监听 → 清 UI

### 音乐数据流

```
src/data/music.json           ← 唯一数据源（JSON）
       │
       ▼
src/data/playlist.ts          ← 类型 + getFlatTracks() + getTrackUrl()
       │
       ├── BaseLayout         → getFlatTracks() → VinylPlayer (define:vars)
       └── music.astro        → albums + getTrackUrl()

---

## CSS 层级

| 文件 | 作用 | 加载方式 |
|---|---|---|
| `tokens.css` | 自定义属性定义（零选择器） | BaseLayout 中 `import` |
| `reset.css` | 浏览器默认样式清零 | BaseLayout 中 `import` |
| `global.css` | 全局排版（body/h1-h4/a 基础样式） | BaseLayout 中 `import` |
| 组件 `<style>` | 组件隔离样式（Astro scoped） | 各 .astro 文件内 |

---

## 动效策略

| 场景 | 实现 | 参数 |
|---|---|---|
| 链接/按钮 hover | CSS `transition` | 150ms ease |
| 按钮 press | CSS `transform: scale(0.97)` | — |
| 卡片 hover | CSS `scale(1.01)` + `box-shadow` | 150ms |
| 导航当前项 | 静态 `is-active` class（颜色） | — |
| 页面切换动画 | Motion 库（后续） | damping 1.0, response 0.3s |
| 滚动视差/手势 | Motion 库（后续） | damping 0.8, response 0.3s |
| 减少动效 | `@media (prefers-reduced-motion)` | opacity 渐变降级 |

---

## 存储架构

```
Cloudflare Pages（静态站点）
├── HTML/CSS/JS              ← Astro 构建产物
├── 简历 PDF                  ← public/resume.pdf
└── favicon.svg               ← public/

Cloudflare R2 ✅（媒体资源）
├── 摄影原图                  ← 冷存储
├── 缩略图 + WebP             ← CDN 热数据
├── 专辑封面                  ← 音乐播放器引用
└── 音乐 MP3                  ← CDN 加速，HTTP Range 流式播放
    └── cdn.doebkblcya.com

VPS（FastAPI，独立服务）
└── mustdo.doebkblcya.com     ← :8001
```

| 资源类型 | 存储 | 原因 |
|---|---|---|
| 网站文件 | Cloudflare Pages | 全球边缘节点，免运维 |
| 音乐 | R2 + CDN | 大文件 CDN 加速，R2 无出口费 |
| 照片/封面 | R2 + CDN | 多图并发，全球加速 |

---

## 当前 Demo 边界

已实现：
- 项目骨架 + Design Tokens + 全局样式
- 左侧边栏（7.5rem 固定宽度，导航激活项跟踪）
- 首页（全屏欢迎页）
- 关于我（Content Collections Markdown 渲染，listed: false）
- 文档系统（列表 + 详情，Shiki 语法高亮，9 篇技术文档）
- 文档搜索（Pagefind 内嵌下拉，键盘导航，毛玻璃面板）
- 内容宽度三档调节（窄/中/宽，localStorage 持久化）
- 设置面板（居中弹出窗口：语言切换 + 宽度控制）
- Markdown 渲染增强（h4-h6、kbd、表格斑马纹、外部链接标识、标题锚点、折叠块）
- 音乐页（专辑架网格 + 黑胶动画 + 播放联动）
- 摄影页（网格 + 懒加载 + Lightbox）
- 唱片播放器（persist 持久化，唱片旋转 + 唱臂联动）
- i18n 中英文 UI 切换
- Cloudflare R2 媒体托管 + Pages 部署

未实现：
- Motion spring 动效（页面过渡、手势交互）
- 暗色模式（CSS 变量已预留）
- 移动端汉堡菜单
- RSS / sitemap
