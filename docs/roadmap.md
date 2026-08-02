# 路线图

## 版本总览

| 版本 | 状态 | 内容 |
|---|---|---|
| v0.1（Demo） | ✅ 完成 | 项目骨架、Design Tokens、i18n、首页 + About + 404 |
| v0.2 | ✅ 完成 | 文档系统（列表/详情/分类/归档）、双栏布局、音乐播放器 |
| v0.3 | ✅ 完成 | Pagefind 搜索、文档卡片化、内容宽度调节、Markdown 渲染增强 |
| v0.4 | 📋 计划中 | Motion 动效打磨、页面过渡动画 |
| v1.0 | 📋 计划中 | 正式上线、内容完善、SEO/RSS/sitemap |
| v1.1 | ✅ 完成 | 音乐 & 摄影（R2 图床、专辑架、黑胶动画、摄影网格 + Lightbox） |
| v1.2 | ✅ 完成 | 内容迁移与精简（9 篇真实技术文档、组件精简、归档/分类页移除、搜索并入列表页） |
| v1.3 | ✅ 完成 | 多端适配（移动端汉堡导航、断点 640、播放器面板限高、宽度 token 对齐） |

---

## v0.1 — Demo（完成）

**目标**：搭好架构骨架，验证设计方向

### 产出

- **项目工程化**
  - Astro 静态站点，TypeScript 严格模式
  - 目录结构确立，前后端分离干净
  - `.gitignore`、`README.md` 基础文档

- **Apple Design 视觉基础**
  - Design Tokens：颜色（黑白灰主色 + 语义色）、间距、圆角、阴影、玻璃材质
  - CSS Reset + 全局排版（h1-h4 层级、链接样式）
  - 系统字体优先，大标题负字间距，正文舒适行高
  - `[data-theme="dark"]` 暗色预留

- **i18n**
  - `zh`/`en` 双语言 UI
  - TypeScript 接口约束中英文结构一致
  - 语言切换保持当前页面位置

- **页面**
  - 首页：全屏欢迎页（引用语 + 导航按钮 + 渐变入场动画）
  - About Me：Content Collections Markdown 渲染
  - 404：大号状态码 + 返回首页链接
  - 根路由 `/` → `/zh/` 301 重定向

- **双栏布局**
  - 左侧边栏：固定定位，导航链接 + 活跃指示线，折叠 14rem/展开 4rem
  - 右侧边栏：个人信息卡片 + 音乐播放器，折叠 16rem/展开 4rem
  - 两侧边栏 CSS 变量同步驱动内容区 margin 过渡
  - 折叠/展开 spring 缓动动画（mouseenter/mouseleave）

---

## v0.2 — 文档系统 & 扩展（完成）

### 已完成

- **Content Collections**
  - `src/content/docs/` 目录，Markdown + frontmatter
  - 类型安全的 collection schema（`title`, `date`, `updated`, `summary`, `draft`, `listed`）
  - `listed: false` 排除特殊页面（about.md 不出现在文档列表）

- **文档列表页** `/docs/`
  - 全部文档，按日期倒序
  - 空状态：居中 "暂无文档" + 引导文案

- **文档详情页** `/docs/[slug]/`
  - Markdown → HTML 渲染（`getEntry()` + `render()`）
  - 代码块语法高亮（Shiki，github-light 主题）
  - 排版优化（标题层级、`<hr>` 分隔、引用块）
  - frontmatter 信息展示（日期、更新日期）

- **音乐播放器**
  - 自定义 HTML5 Audio 控件
  - 播放/暂停 SVG 图标切换
  - 可点击进度条跳转
  - 曲目结束后自动下一首
  - URL 编码处理中文/空格文件名
  - HTTP Range 流式播放，不占满带宽

---

## v0.3 — 搜索 & 文档优化（完成）

- **Pagefind 搜索**
  - 构建后钩子：`astro build && pagefind --site dist`
  - 文档列表页内嵌搜索下拉，毛玻璃材质面板
  - 搜索结果卡片：标题 + 摘要片段（`<mark>` 高亮匹配词）+ 日期
  - 键盘导航：↑↓ 选择、Enter 跳转、Escape 关闭
  - 加载状态（呼吸圆点动画）+ 空结果引导
  - 搜索范围：仅当前语言 `/docs/` 下的文档

- **文档列表优化**
  - 卡片化布局：白色 `bg-surface` 背景区分，hover 微抬 + 轻阴影
  - 排序切换：按日期最新/最早
  - Spring 缓出动画 (`cubic-bezier(0.16, 1, 0.3, 1)`)

- **文档详情页优化**
  - 返回链接移除（侧边栏已有路径导航）
  - 标题与分割线撑满内容区全宽，正文 `max-width` 约束可读性
  - 阅读时间移除

- **设置面板**
  - 居中弹出窗口，半透明模糊遮罩
  - 语言切换 + 内容宽度三档调节（窄 48rem / 中 64rem / 宽 80rem）
  - 宽度持久化 localStorage，跨页保持
  - Esc 或点击遮罩关闭

- **Markdown 渲染增强**
  - h4/h5/h6 层级样式
  - `<kbd>` 按键样式（等宽字体 + 底部加粗立体感）
  - 表格隔行变色 (zebra striping)
  - 外部链接自动加 `↗` 标识
  - 标题 hover 时左侧淡入 `#` 锚点
  - `<details>/<summary>` 折叠块（三角箭头旋转动画）

- **内容**
  - About Me 替换为详细真实的个人介绍
  - 9 篇技术文档导入（ComfyUI / FLUX / Gyroflow / Qwen / ASR 等）

---

## v0.4 — 动效打磨（计划中）

### 待实现

- **页面过渡**
  - 路由切换时淡入淡出
  - View Transitions API（Astro 内置支持）

- **Spring 物理动效**
  - 导航卡片 hover 时弹性缩放（`damping: 1.0`, `response: 0.4s`）
  - 滚动触发内容渐现
  - 下拉/手势交互区域（如有）

- **可访问性**
  - `prefers-reduced-motion` 全局降级为 opacity 渐变
  - `prefers-reduced-transparency` 毛玻璃降级为纯色
  - 键盘导航可见焦点环优化

---

## v1.0 — 正式上线（计划中）

### 待完成

- **内容**
  - About Me 完整内容（技术栈、经历、项目）
  - 至少 3 篇技术文档

- **运维**
  - Nginx 静态文件配置已就绪
  - 部署脚本固化
  - 监控与日志

- **辅助功能**
  - RSS 订阅自动生成
  - `sitemap.xml` 自动生成
  - SEO meta 逐页完善

---

## v1.1 — 音乐 & 摄影（完成）

### 已完成

- **Cloudflare R2 图床 + 音乐托管**
  - R2 bucket 创建 + 自定义域名 `cdn.doebkblcya.com` 绑定
  - 图片 + 音乐 MP3 + LRC 歌词通过 CDN 全球加速访问
  - 音乐播放器路径改为 R2 URL，目录结构 `music/<专辑>/<曲目>`
  - 已上传 2 张专辑 14 首曲目（fade / 如臨深遠 ～雨縒煙柳～）
  - wrangler CLI 管理 R2（需 `--remote` 标志，上传时需关闭代理）
  - 本地 `_r2-upload/` 目录作为上传暂存区（已加入 .gitignore）

- **代码适配**
  - `VinylPlayer.astro`：R2 URL 构造、专辑目录结构、LRC 支持、唱片标签显示专辑名 + 曲名
  - 音乐数据层：`src/data/music.json` 唯一数据源 + `src/data/playlist.ts` 类型/helper
  - 共享数据层 `src/data/photos.ts`：Photo 接口、空数据就绪
  - `public/_redirects`：`/ → /zh/` 301
  - `public/404.html`：全局 404 回退
  - `package.json`：deploy 脚本简化

- **音乐页面** `/music/`
  - 专辑架网格排列（CSS Grid）
  - 封面 hover：黑胶唱片从背后滑出（cubic-bezier spring 物理），播放按钮叠加层渐现
  - 点击播放按钮 → 播放整张专辑（从第一曲开始）+ 展开曲目列表
  - 点击卡片其他区域 → 切换曲目列表展开/收起
  - 曲目列表 grid-template-rows 0fr/1fr accordion 展开动画
  - 曲目按钮：点击播放指定曲目（含编号、标题、时长）
  - `is-playing` 状态：播放中专辑黑胶保持滑出、名称变 accent 色
  - CustomEvent 事件总线：与 VinylPlayer 双向同步（专辑+曲目+播放状态）

- **摄影页面** `/photos/`
  - 响应式网格布局（desktop 多列、mobile 双列）
  - 原生 `loading="lazy"` + IntersectionObserver 懒加载
  - 封面 hover 放大 + 半透明图片说明渐现
  - Lightbox 全屏预览（前后切换、键盘 Esc/←/→ 导航、点击背景关闭）
  - 空状态引导文案

- **导航更新**
  - 侧边栏新增音乐/摄影链接
  - 首页导航按钮新增音乐/摄影入口

- **Cloudflare Pages 部署（代码已就绪，待 Dashboard 创建项目）**
  - 静态站点迁移至 Pages，`git push main` 自动构建部署
  - `_redirects` 替代 Nginx `/ → /zh/` 重定向
  - 与 VPS 完全解耦

### 待完成

- **Cloudflare Pages**：✅ 已完成（Dashboard 创建项目、绑定域名、切 DNS，`git push main` 自动构建部署）
- **LRC 歌词展示 UI**（数据字段已预留，仍未完成）
- **摄影内容填充**：🔄 部分完成（3 张照片已上传 R2，`scripts/process-photos.mjs` 就绪，持续添加中）

---

## v1.2 — 内容迁移与精简（完成）

2026-07-28 重构：demo 内容替换为真实技术文档，删减冗余组件与页面。

### 已完成

- **真实技术文档 9 篇**：ComfyUI FLUX GGUF 部署、FLUX 填图/生图指南、Gyroflow 快速上手、Qwen3-14B Ollama 部署、mustdo ASR 优化、ReActor 换脸指南、VT 故障报告、WSL2 音频 CLI
- **移除 demo 内容**：`build-a-blog.md`、`hello-world.md`、`linux-notes.md`
- **组件精简**：删除 Header、RightSidebar、NavCard、ProfileBrief、MusicPlayer、LanguageSwitcher；保留 Sidebar / VinylPlayer / LanguageSettings，新增 Footer
- **页面精简**：移除归档页 `/docs/archive`、分类页 `/docs/category/*`、独立搜索页 `/search`，Pagefind 搜索并入文档列表页内嵌
- **摄影**：3 张照片上传 R2（`photos/originals` + `photos/thumbs`），`photos.ts` 增加 `date`（必填）/ `note`（可选）字段
- **简历模块搁置**：移除 about 页下载按钮、i18n 文案（`resumeDesc`/`downloadResume`）与文档描述，恢复时需重新添加 resume.pdf
- **文档详情页 TOC + 行宽重做**：右侧目录 rail（`getHeadings()` 构建时静态生成，h2/h3，锚点跳转 + IntersectionObserver 滚动高亮，`__vt_tocInit` VT 安全重绑；毛玻璃卡片样式，`prefers-reduced-transparency` 降级纯色）；标题/正文/横线左对齐，正文行宽 80rem，rail 紧贴正文、大屏右侧留白；删除设置面板三档宽度调节（48/64/80rem 与 localStorage 逻辑）
- **TOC 交互修复**：点击条目即时切换高亮（onclick 直设，不依赖 scroll-spy 滚动回调）；点击后锁定高亮（滚动动画中 scroll-spy 不抢，滚轮/触摸/滚动键手动滚动解锁）；末尾章节特判（滚到文档底部时高亮最后一个标题，解决末尾内容不足顶不进观察带、高亮滞后一节的结构缺陷）；顺带修复兜底逻辑 `links` 变量 ReferenceError
- **全局滚动条**：Apple 风格浅色细滚动条——`--color-scrollbar`/`--color-scrollbar-hover` token 化，`scrollbar-width: thin` + `::-webkit-scrollbar` 8px 圆角无轨道、hover 加深；暗色模式自动适配
- **音乐曲序**：`Track` 接口新增 `trackNo` 字段，数据层按此升序排列（数组书写顺序不承担语义）；fade 与如臨深遠 按官方曲序标注
- **曲名悬停滚动**：播放器曲目列表标题过长时悬停启动无缝左滚（双份文本 `translateX(-50%)` 12s 循环），移出恢复省略号；溢出判断基于第一份文本宽度（双份结构下整体宽度会误判）；`prefers-reduced-motion` 降级
- **面板闪关修复**：点击专辑卡片后面板闪开即关（`handleDocClick` 把冒泡点击误判为面板外点击）——`__vt_musicAlbumClick` 加 `e.stopPropagation()` 阻止冒泡

---

## 未来方向（v1.4+）

- 暗色/亮色模式切换（tokens 已预留 `[data-theme="dark"]`）
- 动效打磨（Motion 库，依赖已装 ^12.11 未使用：spring 物理、页面过渡）
- 真实内容填充（摄影/音乐/技术文档持续补充）
- LRC 歌词展示 UI（数据字段已预留）

**明确不做**：
- ~~文档标签云/热力图~~（决策：文档规模小，标签体系收益低，2026-08-03）
- ~~系列文章导航（上一篇/下一篇）~~（决策：文档相互独立、非系列化，2026-08-03）

---

## v1.3 — 多端适配（完成）

2026-08-03 实施。评估方法：Playwright 7 视口 × 6 页面实测 + 源码逐条核对（详见 `~/docs/doebkweb-responsive.md`）。

### 已完成

- **移动端汉堡导航**：≤640px 侧栏变抽屉——汉堡按钮（毛玻璃 fixed 左上）+ 遮罩 + transform 滑入 + Escape/点击链接/遮罩关闭；VT-safe（inline `onclick` + `window.__vt_toggleNav`，切页后 `astro:after-swap` 自动重置）；首页 CSS 隐藏（自带大按钮导航）；i18n 新增 `nav.menu`
- **断点 768 → 640**：Sidebar / BaseLayout / VinylPlayer 三处同步下移，解决 iPad 竖屏（768×1024）侧栏消失——641px+ 保留完整侧栏，≤640 汉堡接管
- **播放器面板限高**：`max-height: calc(100vh - var(--space-6))` + `overflow-y: auto`，修复横屏手机（667×375 等）面板超高且不可滚动、控件不可达
- **宽度 token 对齐**：首页 `64rem` → `var(--max-width-wide)`；docs 列表**保持通栏铺满**（文档目录页定位，限宽实施后经设计决定回滚）
- **类型检查**：Sidebar script 增加 `declare global` window 扩展声明，`astro check` 0 errors
