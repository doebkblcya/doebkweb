# AGENT.md — doebkweb

本文件是协作代理的项目约束。项目结构、内容更新与部署见 `README.md`；媒体操作见 `maintenance/media/`。

## 项目目标

doebkweb 是纯静态个人站，包含个人介绍、技术文档、唱片架和摄影画廊。首页以 `doebkblcya` 大标题和人物画作为前后景；全站采用展览画册风格，以纸白/纯黑表面、编辑字体、结构线和大块留白组织内容。

## 常用命令

```bash
pnpm install
pnpm dev                 # 默认 http://localhost:4321
pnpm exec astro check    # 类型与 Astro 模板检查
pnpm build               # Astro 构建 + Pagefind 索引
pnpm preview             # 验证 dist 与 Pagefind
node maintenance/media/tools/validate-media.mjs  # 静态媒体清单检查
```

仓库使用 pnpm，提交 `pnpm-lock.yaml`。`pnpm dev` 不生成 Pagefind 索引，搜索必须用 `pnpm build && pnpm preview` 验证。

## 事实来源

| 内容 | 唯一来源 |
|---|---|
| 专辑、资料、乐评 | `src/data/albums.json` |
| 照片、原始文件名、拍摄时间、札记 | `src/data/photos.json` |
| 摄影展分类与编排 | `src/data/photo-groups.json` |
| 关于页正文 | `src/data/about.ts` |
| 关于页猫咪图片与名字 | `src/data/cats.json` |
| 中英文 UI | `src/types/i18n.ts`、`src/i18n/zh.ts`、`src/i18n/en.ts` |
| 技术文章 | `src/content/docs/*.md` |
| 主题与尺寸 token | `src/styles/tokens.css` |
| 路由、Shiki、sitemap | `astro.config.mjs` |

不要在文档中手工维护容易失真的内容数量；需要数量时从数据源计算。

## 不可破坏的架构约束

- Astro 静态输出，无站点后端和数据库。保留 zh/en 多页面路由。
- 普通页面导航，不使用 ClientRouter、audio、播放器、跨页面音频持久化或 `window.__vt_*` 全局桥接。
- 内页用原生跨文档 View Transition：正文 90ms 淡出、280ms 淡入/6px 位移，侧栏稳定。不支持时普通导航，不加兼容依赖。
- 首页不启用跨文档 VT，保留 `<home-hero>` 自身动效，避免冲突；所有动效遵守 reduced-motion。
- 页面脚本初始化当前 DOM，使用本页变量与事件监听。弹窗优先用原生 dialog；前进/后退恢复时清理弹窗和抽屉临时状态。
- `tmp/`、`materials/`、`_r2-upload/`、`.wrangler/`、构建目录、测试产物和凭证不提交。任务完成并验证后清理中间产物；保留原始素材和最终编辑成果。

## 首页约束

- 背景色跟随全站明暗主题，主标题固定为 `doebkblcya`。
- 首页不增加年份、归档、说明、提示语等解释文本。
- 首态由大标题和人物占据主要画面；导航入口隐藏且不可点击。
- 一次滚轮、滑动、方向键或首页非交互区域点击触发完整展开/收起，不按页面滚动距离拖拽进度。
- 展开后标题、人物、导航互不遮挡；桌面和移动端分别计算终态比例。
- `prefers-reduced-motion` 下直接显示可操作终态。
- 模块脚本执行前的首帧由 `html[data-hero="pending"]`（BaseLayout head 内联脚本）固定为收起态，不要在 CSS 默认值里直接写终态；reduced-motion 与脚本加载失败时不设标记，回落到可操作终态。
- 首页交互由 `<home-hero>` 自己管理生命周期，不重新引入 `window.__vt_home*`。

## 样式与动效

- 全局颜色、间距和字体参数优先使用 `tokens.css`。
- 文档、摄影与唱片页的搜索和排序/视图工具栏共用 `global.css` 样式，保持字号、图标、内边距和选中状态一致；页面只保留内容间距等必要差异。
- 内页标题分隔线与紧接的工具栏共用一条边线，不叠加空白夹层；关于页与文档详情页沿用相同的页头间距规则。
- 字体通过 Fontsource 自托管：Newsreader、Hanken Grotesk、JetBrains Mono、Noto Serif SC 与 Noto Sans SC 均使用可变 WOFF2。
- 站内 UI 使用直角、1px 结构线和低对比表面；除唱片等固有圆形外，不恢复大面积圆角、胶囊和悬浮卡片阴影。
- 全站不显示关闭按钮或叉号；弹窗通过点击背景和 Escape 关闭，移动端抽屉通过遮罩、Escape 或再次点击菜单入口收起。
- 侧栏底部设置入口为左对齐文字，与导航同宽，上方一条细线，无图标和方框。
- 设置、专辑和摄影弹层共用 `global.css` 的 `dialog::backdrop`；模糊强度与背景色只在 `tokens.css` 的 `--modal-backdrop-blur`、`--modal-backdrop-bg` 维护，不在组件中单独覆盖。
- 首页与其余页面共用背景色 token：浅色为纸白，暗色为纯黑。
- Astro scoped CSS 中引用 `html[data-theme]` 时使用 `:global()`。
- 简单 hover/focus 用 CSS；可中断的结构变化使用 Motion。
- 同一属性不能同时由 CSS transition 和 Motion 控制。
- Motion、CSS animation 都必须提供 reduced-motion 降级。
- 移动端分界为 `640px`；全高界面使用 `dvh`，同时保留兼容 fallback 和 safe-area。
- 不为了视觉“更满”牺牲标题、导航的点击区域或可读性。

## 主题与语言

- 主题模式存于 `localStorage["doebk-theme"]`：`light | dark | auto`。
- `html[data-theme]` 是实际主题，`html[data-theme-mode]` 是用户选择。
- 首帧主题脚本在 `BaseLayout` 的 head 内；设置组件在页面加载及后退缓存恢复时同步主题。
- 文档正文、关于页正文不翻译；只翻译 UI。
- 新增 UI 字段时先修改 `UIStrings`，再同时补齐 zh/en。

## 内容与媒体

- 文档 frontmatter：`title`、`date`、`summary` 必填；`updated`、`draft`、`listed` 可选。
- 当前实现中 `draft: true` 和 `listed: false` 都不会生成文档详情路由。
- 本地 UI 素材放 `public/`；专辑封面、摄影网页大图和预览放 Cloudflare R2，原件留本地。
- 媒体任务先读 `maintenance/media/README.md`，再读 `albums.md` 或 `photos.md`，用文档和小工具执行，无独立媒体 CLI。
- 专辑资料在录入时查询并由用户复审；乐评保持用户原文。网站运行和构建不查外部专辑 API。
- 唱片页默认“选集”，仅纳入非空乐评，每次进入随机抽取最多三张，并避开本标签页上一次的排列；阅读及历史返回时顺序稳定。“唱片架”保留全部专辑网格、搜索与专辑名/艺术家排序。
- 唱片架按艺术家排序时显示艺人分组标题，组内专辑按名称排序；按专辑名排序恢复连续网格。搜索时隐藏空组，复用既有专辑节点及弹层事件。
- 选集由封套、CSS 黑胶和完整乐评组成；IntersectionObserver 在每次进入视线时触发抽出/文字展开，离开视线后复位，阅读时静止且不重排。遵守 reduced-motion，不增加动画依赖，不自动轮播或持续旋转。
- 专辑封面使用 360px WebP 预览和 1000px JPEG 大图；列表懒加载，选集大图进入视线时加载，详情图打开弹层才设置 `src`、关闭后移除，不预加载整批封面大图。
- 摄影批目录只放本次上传的照片，全部处理，不做历史自动跳过；RAW 仅提取内嵌 JPEG。
- 猫咪图片与名字放在关于页“我的猫”分区，独立数据源 cats.json；摄影清单与编排不包含猫咪，不复制或重新上传已有 R2 资源。
- 摄影默认为按用户分类与观看顺序组织的连续“摄影展”，完整“照片墙”默认按原始文件名排序，也可按相机拍摄时间倒序；缺少时间的归到“没有时间”，不补录入日期。
- 摄影图片以原始文件名标识，不维护独立描述字段；搜索只匹配用户札记。没有札记时图片下方与大图弹层均不显示文本或占位。札记只属于单张照片，保存在 photos.json 的可选 note；摄影展每张照片下方与其大图显示该札记，照片墙搜索也仅匹配这份文本。photo-groups.json 的 name 仅记录用户分类供编排维护，不在页面作为标题或札记显示；不存在分组札记或继承逻辑。
- 摄影展以一屏一张为基础，每张照片居中适配统一的展示区域，横图限制宽度、竖图限制高度，完整显示画面；不设置大小、左右、高低差等单张排版参数。photo-groups.json 仅保存分类与照片 ID 顺序，沿用普通滚动。每张照片独立进入视野时以 600ms 淡入/6px 上移，每张照片自己的札记稍后出现；滚出视野后复位，再进入时重播，阅读时静止。仅 CSS 与 IntersectionObserver，遵守 reduced-motion，无 JS 时完整显示；照片墙不加滚动动效。
- 摄影预览长边 960px WebP、大图长边 2400px JPEG，不放大原件。透明抠图大图也使用 WebP，保留 alpha。只懒加载预览，打开弹层加载当前大图，关闭移除地址；网页派生图不保留 EXIF/GPS。
- 公开媒体清单只收录已上传且验证可访问的资源；远程删除由站点作者执行。
- Wrangler 上传与站点发布分开：对象实际 GET 验证后，AI 更新 JSON、检查与构建，再执行本次已授权的发布。
- R2 对象使用 immutable 缓存；内容改变时更换文件名，不覆盖同 URL 内容。

## 修改与验证

1. 修改前先检查 `git status`，保留用户已有改动。
2. 页面交互改动至少验证：直接访问、站内点击进入、离开后返回、浏览器前进/后退。
3. 首页同时验证桌面和手机视口，检查收起态、展开态、快速反向操作。
4. 媒体记录必须通过清单检查，图片必须已上传且能从公共 URL 获取；空清单显示空态，不使用示例或隐式备用数据。
5. 交付前运行 `pnpm exec astro check`、`pnpm build` 和 `git diff --check`。
6. `pnpm dev` 下文档搜索不会初始化 Pagefind，也不应请求 `/pagefind/pagefind.js`；全文搜索只在 build + preview 或生产环境验证。
7. 页面视觉调整不以自动截图代替验收；完成代码与静态检查后交给站点作者手动确认构图和比例。

## 文档索引

- `README.md`：项目结构、内容更新与部署

- `maintenance/media/README.md`：AI 媒体维护入口
- `maintenance/media/albums.md`：专辑录入、复审、封面与乐评
- `maintenance/media/photos.md`：摄影处理、上传与记录
