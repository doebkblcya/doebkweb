# AGENT.md — doebkweb

本文件是协作代理的项目约束。产品现状见 `README.md`，详细设计见 `docs/`。

## 项目目标

doebkweb 是纯静态个人站，包含个人介绍、技术文档、唱片架和摄影画廊。深蓝首页以 `doebkblcya` 大标题和人物画作为前后景；站内页采用展览画册风格，以纸白/纯黑表面、编辑字体、结构线和大块留白组织内容。

## 常用命令

```bash
pnpm install
pnpm dev                 # 默认 http://localhost:4321
pnpm exec astro check    # 类型与 Astro 模板检查
pnpm build               # Astro 构建 + Pagefind 索引
pnpm preview             # 验证 dist 与 Pagefind
pnpm media               # 查看媒体 CLI 用法
```

仓库使用 pnpm，提交 `pnpm-lock.yaml`。`pnpm dev` 不生成 Pagefind 索引，搜索必须用 `pnpm build && pnpm preview` 验证。

## 事实来源

| 内容 | 唯一来源 |
|---|---|
| 专辑、曲目、札记 | `src/data/music.json` |
| 照片、日期、说明 | `src/data/photos.json` |
| 关于页正文 | `src/data/about.ts` |
| 中英文 UI | `src/types/i18n.ts`、`src/i18n/zh.ts`、`src/i18n/en.ts` |
| 技术文章 | `src/content/docs/*.md` |
| 主题与尺寸 token | `src/styles/tokens.css` |
| 路由、Shiki、sitemap | `astro.config.mjs` |

不要在文档中手工维护容易失真的内容数量；需要数量时从数据源计算。

## 不可破坏的架构约束

- Astro 静态输出，无站点后端和数据库。
- `BaseLayout.astro` 在所有语言页面渲染 `audio`、`VinylPlayer` 和 `Sidebar`。
- Astro 5 使用 `<ClientRouter />`。它只服务于客户端导航和音乐连续播放；根页面设置 `transition:animate="none"`，不恢复全站左右滑动转场。
- 只有 `#audio` 与 `#vinyl-app` 持久化。Sidebar、首页 hero 和页面内容必须随导航重建。
- 首页不显示 Sidebar、移动端汉堡和 VinylPlayer，但持久化播放器仍留在 DOM 中。
- `tmp/`、`_r2-upload/`、构建目录和浏览器测试产物不提交。

## ClientRouter 生命周期

打包后的 module script 在同一 document 中只执行一次，不能假设返回页面时脚本会重跑。

新交互优先使用 Custom Element：

- `connectedCallback()` 查询自身子树并初始化。
- `disconnectedCallback()` 停止 Motion 动画、取消 `requestAnimationFrame`、Observer 和定时器。
- window/document 监听统一绑定同一个 `AbortController.signal`，销毁时一次 `abort()`。
- 初始化必须幂等，DOM 查询限制在组件自身，不把一次性页面节点长期缓存到全局。

现有 Sidebar、LanguageSettings、文档列表、音乐页和摄影页仍有 `window.__vt_*` 与 inline handler。维护这些代码时继续遵守 remove-before-add；新代码不要扩大这套全局状态。完整背景见 `src/content/docs/vt-bugs.md`。

## 首页约束

- 背景色为深蓝 `#06182d`，主标题固定为 `doebkblcya`。
- 首页不增加年份、归档、说明、提示语等解释文本。
- 首态由大标题和人物占据主要画面；导航入口隐藏且不可点击。
- 一次滚轮、滑动、方向键或首页非交互区域点击触发完整展开/收起，不按页面滚动距离拖拽进度。
- 展开后标题、人物、导航互不遮挡；桌面和移动端分别计算终态比例。
- `prefers-reduced-motion` 下直接显示可操作终态。
- 首页交互由 `<home-hero>` 自己管理生命周期，不重新引入 `window.__vt_home*`。

## 样式与动效

- 全局颜色、间距和字体参数优先使用 `tokens.css`。
- 字体通过 Fontsource 自托管：Newsreader、Hanken Grotesk、JetBrains Mono、Noto Serif SC 与 Noto Sans SC 均使用可变 WOFF2。
- 站内 UI 使用直角、1px 结构线和低对比表面；除唱片等固有圆形外，不恢复大面积圆角、胶囊和悬浮卡片阴影。
- 首页固定深蓝；其余页面浅色为纸白，暗色为纯黑，不把首页蓝色延伸为全站暗色。
- Astro scoped CSS 中引用 `html[data-theme]` 时使用 `:global()`。
- 简单 hover/focus 用 CSS；可中断的结构变化使用 Motion。
- 同一属性不能同时由 CSS transition 和 Motion 控制。
- Motion、CSS animation 都必须提供 reduced-motion 降级。
- 移动端分界为 `640px`；全高界面使用 `dvh`，同时保留兼容 fallback 和 safe-area。
- 不为了视觉“更满”牺牲标题、导航的点击区域或可读性。

## 主题与语言

- 主题模式存于 `localStorage["doebk-theme"]`：`light | dark | auto`。
- `html[data-theme]` 是实际主题，`html[data-theme-mode]` 是用户选择。
- 首帧主题脚本在 `BaseLayout` 的 head 内；ClientRouter 换页后由 Sidebar 的 `astro:after-swap` 恢复运行时属性。
- 文档正文、关于页正文不翻译；只翻译 UI。
- 新增 UI 字段时先修改 `UIStrings`，再同时补齐 zh/en。

## 内容与媒体

- 文档 frontmatter：`title`、`date`、`summary` 必填；`updated`、`draft`、`listed` 可选。
- 当前实现中 `draft: true` 和 `listed: false` 都不会生成文档详情路由。
- 本地 UI 素材放 `public/`；音乐、摄影原图、缩略图和封面放 Cloudflare R2。
- 媒体通过 `pnpm media` 处理。不要提交凭证、原始媒体或 `_r2-upload/`。
- R2 对象使用 immutable 缓存；内容改变时更换文件名，不覆盖同 URL 内容。

## 修改与验证

1. 修改前先检查 `git status`，保留用户已有改动。
2. 页面交互改动至少验证：直接访问、站内点击进入、离开后返回、浏览器前进/后退。
3. 首页同时验证桌面和手机视口，检查收起态、展开态、快速反向操作。
4. 播放器相关改动必须确认 `#audio` 和 `#vinyl-app` 跨页仍是同一实例。
5. 交付前运行 `pnpm exec astro check`、`pnpm build` 和 `git diff --check`。
6. `pnpm dev` 下文档搜索不会初始化 Pagefind，也不应请求 `/pagefind/pagefind.js`；全文搜索只在 build + preview 或生产环境验证。
7. 页面视觉调整不以自动截图代替验收；完成代码与静态检查后交给站点作者手动确认构图和比例。

## 文档索引

- `docs/requirements.md`：当前产品需求与验收标准
- `docs/architecture.md`：代码、路由、状态和生命周期
- `docs/deployment.md`：构建、Cloudflare Pages 与故障排查
- `docs/upload.md`：媒体和文章发布流程
- `docs/roadmap.md`：完成阶段、当前方向和后续工作
