# 架构说明

更新日期：2026-09-09

## 技术栈

| 层 | 实现 |
|---|---|
| 页面与静态生成 | Astro 5，`output: "static"` |
| 语言与检查 | TypeScript、`@astrojs/check` |
| 动效 | Motion 12 + CSS animation/transition |
| 内容 | Astro Content Collections、Markdown、Shiki |
| 搜索 | Pagefind 1.5，构建后生成索引 |
| 发布 | Cloudflare Pages |
| 媒体 | Cloudflare R2 + 自定义 CDN 域名 |

版本以 `package.json` 和 `pnpm-lock.yaml` 为准，不在本文复制补丁版本。

## 目录结构

```text
public/
├── images/home-figure.webp
├── favicon.svg
├── apple-touch-icon.png
├── _redirects
└── 404.html
src/
├── components/
│   ├── Sidebar.astro
│   ├── LanguageSettings.astro
│   ├── VinylPlayer.astro
│   └── Footer.astro
├── content/
│   ├── config.ts
│   └── docs/*.md
├── data/
│   ├── about.ts
│   ├── music.json
│   ├── playlist.ts
│   ├── photos.json
│   └── photos.ts
├── i18n/
│   ├── zh.ts
│   └── en.ts
├── layouts/BaseLayout.astro
├── pages/
│   ├── index.astro
│   └── [lang]/
│       ├── _getStaticPaths.ts
│       ├── index.astro
│       ├── about.astro
│       ├── docs/
│       ├── music.astro
│       ├── photos.astro
│       └── 404.astro
├── styles/
│   ├── tokens.css
│   ├── reset.css
│   ├── global.css
│   └── prose.css
└── types/i18n.ts
scripts/media.mjs
docs/
```

## 构建与路由

Astro 为 zh/en 预渲染完整 HTML：

```text
/                         → /zh/
/[lang]/                  → 首页
/[lang]/about/            → 关于我
/[lang]/docs/             → 文档列表
/[lang]/docs/[slug]/      → 文档详情
/[lang]/music/            → 音乐
/[lang]/photos/           → 摄影
/[lang]/404/              → 语言内 404
```

`astro.config.mjs` 同时配置：

- `prefixDefaultLocale: true`
- Shiki 的 github-light/github-dark 双主题
- Markdown 表格包裹器
- 移除正文开头与 frontmatter 重复的 h1
- sitemap 集成

`pnpm build` 先执行 Astro，再以 `dist/` 为输入生成 Pagefind 索引。文档列表通过 `import.meta.env.PROD` 控制搜索初始化：开发服务器跳过动态导入，preview 与正式部署从 `/pagefind/pagefind.js` 加载索引。

## 页面骨架

```text
BaseLayout
├── head：SEO、首帧主题脚本、ClientRouter
└── body
    ├── skip link
    ├── audio                         persist: audio
    ├── VinylPlayer                   persist: vinyl-player
    ├── Sidebar + LanguageSettings    每页重建
    └── content-area
        ├── main / slot               每页重建
        └── Footer                    按页面决定是否显示
```

`hideHeader` 实际控制 body 是否带 `has-sidebar`。共享组件仍会渲染；首页通过这个 class 隐藏 Sidebar、汉堡按钮和 VinylPlayer，以满足持久化元素必须在前后页面都存在的条件。

## ClientRouter 与持久化

`BaseLayout` 使用 Astro 5 的 `<ClientRouter fallback="swap" />`。根元素声明 `transition:animate="none"`，因此路由只负责：

- 拦截站内链接并替换页面 body
- 保持 history、前进与后退
- 移动持久化元素到新页面
- 触发 Astro 导航生命周期事件

只有两个持久化节点：

- `#audio`：真实播放源和播放时间
- `#vinyl-app`：播放器 UI 与运行状态

Sidebar 不持久化，因为语言、链接和激活状态依赖当前页面。首页标题、人物、导航也不持久化。

### 脚本生命周期

Astro 打包的 module script 在同一个 document 中去重执行。ClientRouter 返回一个已访问页面时，新 DOM 会出现，但原 module 不一定再次执行。因此：

- 新页面交互优先封装为 Custom Element。
- `connectedCallback` 初始化当前实例。
- `disconnectedCallback` 释放全局监听、Observer、定时器、rAF 和 Motion 控制器。
- 全局事件通过 `AbortController.signal` 成组清理。
- 只有跨页真实状态进入 persist 或全局存储。

首页 `<home-hero>` 已采用这个模式。旧组件仍存在 inline handler + `window.__vt_*`，它们是兼容债务，不是新代码模板。

### 首页状态

首页只有两个稳定状态：

```text
collapsed
├── 大标题居中
├── 人物占据前景
└── portal 不可见、不可点击

expanded
├── 标题缩小并移向左上区域
├── 人物缩放并移到右侧/中部
└── portal 在左下区域显示
```

滚轮、触摸和键盘只决定目标状态，不把真实页面滚动量当作动画进度。Motion 插值写入 hero stage 的 CSS 自定义属性；离开首页时由 Custom Element 统一停止。

`<home-hero>` 是 deferred 模块脚本，首帧可能早于元素升级。因此 BaseLayout 的同步 head 脚本在解析期写入 `html[data-hero="pending"]`，`index.astro` 据此先把 portal 画到画面外并禁用点击，保证首帧就是 collapsed；`render()` 接管并写入内联变量后该标记失效。`prefers-reduced-motion` 下不写标记，直接呈现 expanded 终态；模块脚本加载失败时由 `DOMContentLoaded` 清除标记，同样回落到可操作终态。

## 数据流

### 音乐

```text
music.json
  ↓ playlist.ts：类型、排序、URL 派生
  ├── music.astro：专辑架与搜索
  └── BaseLayout → VinylPlayer：扁平曲目列表
                       ↕
                    #audio 自定义事件
```

`trackNo` 是曲序；封面和音频 URL 根据专辑目录派生。播放器初始化使用 ready 守卫，因为其 DOM 跨页不销毁。播放器同时监听 `astro:after-swap`，在语言切换后同步按钮文案、无障碍名称和唱片架链接。

播放器的迷你唱片是面板入口，面板不保留独立关闭按钮；点击面板外部或按 Escape 收起。桌面面板让唱片、唱臂与曲目信息并列，文字区域保留唱臂安全间距；手机端把播放控制独占首行，播放列表、音量和唱片架放在第二行，避免窄屏形成不平衡的 T 形布局。未选择专辑时，唱片架入口占满工具区。

### 摄影

```text
photos.json → photos.ts 类型薄层 → photos.astro
```

页面按日期排序并生成照片墙、时间线和 Lightbox。原图与缩略图 URL 指向 R2。

### 关于页

```text
about.ts → about.astro
```

关于页已经脱离 Markdown collection；只有页面标题等 UI 使用 i18n。

### 文档

```text
src/content/docs/*.md
  ↓ content schema
  ├── docs/index.astro：列表、排序、Pagefind 搜索
  └── docs/[slug].astro：正文、Shiki、TOC、Pagefind 元数据
```

`draft: true` 或 `listed: false` 的条目既不出现在列表，也不生成详情路径。

## 主题与 i18n

主题状态：

```text
localStorage["doebk-theme"] = light | dark | auto
html[data-theme-mode]       = 用户选择
html[data-theme]            = 当前实际 light/dark
```

BaseLayout 的同步 head 脚本在首帧前写入属性，避免闪烁。ClientRouter 替换文档属性后，Sidebar 的 `astro:after-swap` 处理器重新应用主题并同步 UI。

`UIStrings` 约束 zh/en 结构。路由 UI 翻译，文章和关于页正文保持原语言。

## 样式层级

| 文件 | 职责 |
|---|---|
| `tokens.css` | 纸白/纯黑颜色、编辑/正文/元数据字体、字号和间距 |
| `reset.css` | 浏览器样式归一化 |
| `global.css` | body、画册页框、共享标题、工具栏与输入框 |
| `prose.css` | 编辑型 Markdown 正文、结构线和 Shiki 双主题 |
| 组件内 `<style>` | 页面与组件局部布局 |

字体由 Fontsource 包随构建产物自托管，拉丁与中文均使用可变 WOFF2，并由 Unicode range 按实际字形请求。首页使用固定深蓝视觉，不跟随站内页亮/暗主题切换；其余页面浅色为纸白、暗色为纯黑。

## 动效策略

- 根页面切换：无动画，避免新旧页面快照叠加。
- 首页构图：Motion 数值动画，可中断和反向。
- 抽屉、播放器、设置面板：Motion spring。
- hover、focus、颜色变化：CSS transition。
- 黑胶旋转等循环效果：CSS keyframes。
- reduced-motion：移除位移和循环动画，核心控件直接可用。

同一 transform/opacity 不允许同时被 Motion 和 CSS transition 控制。

## 本地状态

| Key/位置 | 内容 |
|---|---|
| `doebk-theme` | 主题模式 |
| audio dataset/属性 | 当前专辑、曲目、播放位置 |
| 照片页 localStorage | 照片墙/时间线偏好 |

页面可派生状态应从当前 DOM 和 URL 重建，不放入全局对象。

## 已知技术债务

- Sidebar、LanguageSettings、文档列表、音乐页、摄影页仍有 inline event 与 `window.__vt_*`。
- `define:vars` 脚本是 inline 脚本，不能直接 import Motion；现有代码使用独立 module 与 window 桥接。
- 项目还没有提交到仓库的自动化浏览器回归测试。

后续迁移顺序见 `docs/roadmap.md`，历史 ClientRouter 问题见 `src/content/docs/vt-bugs.md`。
