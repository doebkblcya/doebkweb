# 项目架构文档

## 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 静态站点生成器 | Astro | ^5.6 |
| 动画库 | Motion（原 Framer Motion） | ^12.11 |
| 类型检查 | @astrojs/check + TypeScript | ^5.8 |
| 搜索 | Pagefind | 后续集成 |
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
│   │   ├── playlist.ts            #   音乐播放列表（专辑/曲目/LRC）
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
│   │   ├── Sidebar.astro          #   左侧导航栏（静态固定宽度 12rem）
│   │   ├── VinylPlayer.astro      #   唱片播放器（右上角悬浮，View Transition 持久化）
│   │   └── LanguageSettings.astro #   语言 & 设置面板
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
│               ├── index.astro    #       文档列表（分类筛选）
│               ├── [slug].astro   #       文档详情（Shiki 高亮）
│               ├── archive.astro  #       时间归档
│               └── category/
│                   └── [category].astro  # 分类筛选
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
/[lang]/docs/                      →  文档列表（分类筛选）
/[lang]/docs/[slug]/               →  文档详情（Shiki 语法高亮）
/[lang]/docs/category/[category]/  →  分类筛选页
/[lang]/docs/archive/              →  时间归档（年月分组）
/[lang]/search/                    →  全文搜索（计划中）
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
         ├── <Header t={t}>
         └── <Footer t={t}>
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
  ├── hideHeader === false 时渲染侧边栏 + 播放器：
  │   ├── <Sidebar t={t} />           # 左侧：导航 + 语言设置
  │   ├── <main class="content-area">  # 中间：页面内容
  │   │   └── <slot />
  │   └── <VinylPlayer />              # 右上角：唱片播放器
  └── hideHeader === true 时仅渲染 <slot />（全屏页面）
```

每个 `[lang]` 页面文件：
1. `export { getStaticPaths }` → 生成 zh/en 两条静态路径
2. 导入 `BaseLayout` → 传 `title`、`hideHeader`、`hideFooter` prop
3. 根据当前 locale 加载对应 i18n 文案
4. 渲染页面内容

---

## View Transition 持久化架构

### 机制

`Sidebar`、`VinylPlayer` 和 `#audio` 使用 `transition:persist` 跨页面导航保持 DOM 元素。`BaseLayout` 通过 `hideHeader` prop 控制在首页是否渲染这些组件：

```
其他页面 (hideHeader=false):          首页 (hideHeader=true):
  <Sidebar />                            (无 Sidebar)
  <VinylPlayer />                        (无 VinylPlayer)
  <audio id="audio" />                 <audio id="audio" (persist) />
```

### 导航到首页时发生的事

首页不渲染 `Sidebar` / `VinylPlayer`，Astro View Transition 发现目标页无匹配的 persist 元素 → **移除**这些元素。导航回其他页面时 → **重建**新元素。

### 问题与解决方案

| 问题 | 根因 | 修复 |
|---|---|---|
| 重建后脚本不初始化 | `window.__sidebarReady` 等全局守卫在元素移除后仍为 `true`，新元素初始化被跳过 | 守卫改用 `element.dataset.xyz`（随元素销毁），`astro:after-swap` 事件清守卫并重新 `init()` |
| 闭包持有旧 DOM 引用 | 事件回调捕获的是已被销毁的元素引用 | `els()` 函数获取实时 DOM 引用；委托事件到 `document` 上监听 |
| `style.display = ""` 不生效 | 清空 inline style 后 CSS class 的 `display: none` 重新生效 | 全部使用显式值（`"block"`, `"flex"`, `"inline-block"`, `"none"`） |
| persist audio 播放状态丢失 | `init()` 硬编码 `playing = false`，未同步 persist audio 的真实状态 | `init()` 末尾读取 `audio.paused` 同步 `applyPlayingState()` |

### 组件级 re-init 模式

```javascript
// 每个 persist 组件使用相同模式
(function () {
  function init() {
    var el = document.getElementById("my-component");
    if (!el) return;
    if (el.dataset.ready === "1") return;  // 元素级守卫
    el.dataset.ready = "1";
    // ... 绑定事件、初始化状态 ...
  }

  init();
  document.addEventListener("astro:after-swap", function () {
    var el = document.getElementById("my-component");
    if (el) el.dataset.ready = "";
    init();
  });
})();
```

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
- 左侧边栏（静态固定宽度 12rem，导航激活项跟踪）
- 首页（全屏欢迎页，渐变入场动画，音乐/摄影导航按钮）
- 关于我（Content Collections，Markdown 渲染，listed: false 排除，内嵌简历下载）
- 文档系统（列表/详情/分类/归档 + Shiki 语法高亮）
- 音乐页（专辑架网格排列，封面 hover 黑胶唱片滑出 + 播放按钮，曲目列表展开收起，与 VinylPlayer CustomEvent 双向联动同步播放状态）
- 摄影页（自适应网格 + 懒加载 + Lightbox 全屏预览 + 键盘导航）
- 共享数据层（`src/data/playlist.ts` / `photos.ts`，集中管理内容）
- 404 页面
- i18n 中英文 UI 切换（含音乐/摄影完整文案）
- 唱片播放器（右上角悬浮，transition:persist 跨页持久化，唱片旋转动画 + 唱臂联动，CustomEvent 事件总线与外部分页同步，re-init 模式处理 View Transition 元素重建）
- Cloudflare R2 图床 + 音乐托管（cdn.doebkblcya.com，2 专辑 14 首曲目已上传）
- Cloudflare Pages 代码就绪（_redirects / 404.html）（Dashboard 创建待完成）
- wrangler CLI 管理 R2（API Token + --remote + unset proxy）

未实现：
- Pagefind 搜索
- Motion spring 动效（页面过渡、手势交互）
- 暗色模式（CSS 变量已预留）
- 移动端汉堡菜单
- RSS / sitemap
