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
│   │   ├── global.css             #   全局排版基础样式
│   │   └── prose.css              #   Markdown 正文排版（about + 文档详情共享）
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
│   │   └── photos.ts              #   摄影数据（原图/缩略图/alt/日期）
│   │
│   ├── content/                   # Content Collections
│   │   ├── config.ts              #   Collection schema（zod 校验）
│   │   └── docs/                  #   Markdown 文档
│   │       ├── about.md           #     关于我（listed: false）
│   │       └── *.md               #     技术文档（9 篇）
│   │
│   ├── layouts/                   # 页面布局
│   │   └── BaseLayout.astro       #   全局布局骨架（侧边栏 + 内容区 + 页脚）
│   │
│   ├── components/                # 可复用组件
│   │   ├── Sidebar.astro          #   左侧导航栏（7.5rem，导航 + 设置面板入口；≤640px 变汉堡抽屉）
│   │   ├── VinylPlayer.astro      #   唱片播放器（迷你碟触发 + 展开面板，View Transition 持久化）
│   │   ├── LanguageSettings.astro #   语言切换弹窗（居中窗口）
│   │   └── Footer.astro           #   页脚（hideFooter prop 控制）
│   │
│   └── pages/                     # 路由页面（文件路径 = URL）
│       ├── index.astro            #   / → 301 重定向到 /zh/
│       └── [lang]/                #   语言前缀路由组
│           ├── _getStaticPaths.ts #     共享的 getStaticPaths（zh/en 双路径生成）
│           ├── index.astro        #     /zh/  /en/  首页（全屏欢迎）
│           ├── about.astro        #     /zh/about/  关于我（MD 渲染）
│           ├── music.astro        #     /zh/music/  专辑架（黑胶动画 + 播放联动）
│           ├── photos.astro       #     /zh/photos/ 摄影网格（懒加载 + Lightbox）
│           ├── 404.astro          #     /zh/404/    自定义 404
│           └── docs/              #     文档系统
│               ├── index.astro    #       文档列表（搜索 + 排序）
│               └── [slug].astro   #       文档详情（Shiki 高亮）
│
├── docs/                          # 项目文档（本文件所在目录）
├── scripts/
│   └── process-photos.mjs         # 照片处理脚本（RAW → 2000px JPEG + 480px WebP）
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
/[lang]/about/                     →  About Me（Markdown 渲染）
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
  --color-accent: #1d1d1f      ← 黑色 accent（Apple 风格）
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
  ├── <ViewTransitions /> 启用 View Transitions 路由
  ├── 导入 tokens.css → reset.css → global.css（全局生效）
  ├── 根据 Astro.currentLocale 选择 zh/en UI 文案
  ├── 始终渲染（所有页面）：
  │   ├── <audio id="audio" data-astro-transition-persist="audio" />  # 音频元素，跨页持久化
  │   ├── <VinylPlayer data-astro-transition-persist="vinyl-player" /> # 唱片播放器，跨页持久化
  │   ├── <Sidebar />                    # 始终渲染，首页靠 CSS 隐藏（不再用 hideHeader 条件）；内含汉堡按钮 nav-trigger + 遮罩 nav-mask（≤640px）
  │   │                                  #   交互走 inline onclick → window.__vt_toggleNav / __vt_closeNav（VT-safe）
  │   ├── <main><slot /></main>
  │   └── {!hideFooter && <Footer />}    # 页脚，首页隐藏
  └── 首页：body 无 has-sidebar class → Sidebar / VinylPlayer 均 CSS 隐藏
```

每个 `[lang]` 页面文件：
1. `export { getStaticPaths }` → 生成 zh/en 两条静态路径
2. 导入 `BaseLayout` → 传 `title`、`hideHeader`、`hideFooter` prop
3. 根据当前 locale 加载对应 i18n 文案
4. 渲染页面内容

---

## View Transition 持久化架构

### 机制

`#audio` 和 `VinylPlayer` 使用 `data-astro-transition-persist` 属性跨页面保持 DOM 元素。两者在 BaseLayout 中始终渲染，首页通过 CSS 隐藏。

```
所有页面:
  <audio id="audio" data-astro-transition-persist="audio" />           ← 始终存在，跨页存活
  <VinylPlayer data-astro-transition-persist="vinyl-player" />         ← 始终存在，首页 CSS 隐藏
  <Sidebar />                    ← 始终渲染，首页 CSS 隐藏
```

### 首页行为

首页 `body` 无 `has-sidebar` class → `body:not(.has-sidebar) .vinyl-app { display: none }`，Sidebar 同理隐藏。
首页为纯静态欢迎页（引用语 + 自我介绍 + 导航按钮），无脚本，不重置播放器 —— 播放状态跨页保持。

### VinylPlayer 生命周期

```
init() 执行一次（vinylReady 守卫）
  ├─ wireAudio()        → 所有监听器绑定到 #audio（play/pause/ended/album-change/track-change）
  ├─ document click      → 委托事件（始终有效）
  ├─ 读 audio.dataset    → 恢复封面/专辑名
  └─ 同 syncPlayingState → 同步播放状态

无 teardown / before-swap / after-swap（组件从不销毁）
```

### 事件总线

所有自定义事件在 `#audio` 上：
- `album-change` ← music 页 dispatch → VinylPlayer 监听到 → 加载专辑
- `track-change` ← VinylPlayer dispatch → VinylPlayer 监听到 → 更新 UI

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
| `prose.css` | `.page-body` Markdown 排版（about + 文档详情共享，改一处两页生效） | about / docs/[slug] 中 `import` |
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
- 左侧边栏（7.5rem 固定宽度，导航激活项跟踪 + 设置面板入口）
- 首页（纯静态全屏欢迎页：引用语 + 自我介绍 + 导航按钮）
- 关于我（Content Collections Markdown 渲染，listed: false）
- 文档系统（列表 + 详情，Shiki 语法高亮，9 篇真实技术文档）
- 文档详情页右侧目录（TOC rail：构建时静态生成、锚点跳转 + 滚动高亮，毛玻璃卡片，小屏隐藏；正文 80rem 行宽，正文 + rail 组合靠左，大屏右侧留白；点击即时切高亮 + 滚动动画中锁定高亮，末尾章节特判高亮）
- 文档搜索（Pagefind 内嵌列表页，键盘导航，毛玻璃面板）+ 日期排序切换
- 设置面板（居中弹出窗口：语言切换）
- Markdown 渲染增强（h4-h6、kbd、表格斑马纹、外部链接标识、标题锚点、折叠块）
- 音乐页（专辑架网格 + 黑胶动画 + 播放联动，2 张专辑 14 首曲目，`trackNo` 曲序数据层排序）
- 摄影页（网格 + 懒加载 + Lightbox，3 张照片已上传 R2）
- 唱片播放器（persist 持久化，唱片旋转 + 唱臂联动，曲名悬停滚动动画）
- 全局滚动条（Apple 风格浅色细滚动条：token 化 + 双引擎实现，页面与播放器面板统一）
- 多端适配（v1.3）：移动端汉堡导航（≤640px 侧栏变抽屉，遮罩/Escape/点链接关闭，VT-safe）、断点 768→640（iPad 竖屏保留侧栏）、播放器面板限高（max-height + 内部滚动，横屏可用）、首页宽度 token 对齐
- Footer 页脚 + skip-link 无障碍跳转
- i18n 中英文 UI 切换
- Cloudflare R2 媒体托管 + Pages 部署（git push main 自动构建）

未实现：
- Motion spring 动效（依赖已装 ^12.11，代码尚未使用）
- 暗色模式（CSS 变量已预留）
- LRC 歌词展示 UI（数据字段已预留）
- RSS / sitemap

搁置：简历下载模块（代码与 i18n 文案已移除，如重启需恢复 about 页按钮 + resume.pdf）
