# 路线图

## 版本总览（按实际完成顺序）

| 版本 | 状态 | 内容 |
|---|---|---|
| v0.1（Demo） | ✅ 完成 | 项目骨架、Design Tokens、i18n、首页 + About + 404 |
| v0.2 | ✅ 完成 | 文档系统（列表/详情/分类/归档）、双栏布局、音乐播放器 |
| v0.3 | ✅ 完成 | Pagefind 搜索、文档卡片化、内容宽度调节、Markdown 渲染增强 |
| v1.1 | ✅ 完成 | 音乐 & 摄影（R2 图床、专辑架、黑胶动画、摄影网格 + Lightbox）、Cloudflare Pages 上线 |
| v1.2 | ✅ 完成 | 内容迁移与精简（9 篇真实技术文档、组件精简、归档/分类页移除、搜索并入列表页） |
| v1.3 | ✅ 完成 | 多端适配（移动端汉堡导航、断点 640、播放器面板限高、宽度 token 对齐） |
| v1.4 | ✅ 完成 | 三段式主题切换（浅色/深色/自动：侧栏快捷按钮 + 设置面板分段控件、Shiki 双主题、VT 兼容） |
| v1.5 | ✅ 完成 | 动效打磨（Motion spring 结构性动画：抽屉/播放器面板/设置弹窗；方向感知页面过渡；列表页入场动画；reduced-motion 降级） |
| v1.5.1 | ✅ 完成 | 移动端修复 + VT 监听器审计（汉堡抽屉切页残留、汉堡图标隐藏、iOS 100dvh、i18n 切换、设置弹窗 VT-safe） |
| v1.6 | ✅ 完成 | 媒体 CLI + R2 immutable 迁移（media 四子命令、photos.json 化、57 对象带缓存头、Microcastle 专辑） |
| v1.7 | ✅ 完成 | S3 multipart 上传、照片墙 + 札记搜索、播放器/CLI 修复批次、sitemap + SEO meta |
| v1.7.1 | ✅ 完成 | 播放器未播放态按钮偏移修复 + 照片/音乐搜索栏换行临界对齐 |

> 说明：v0.4（Motion 动效）与 v1.0（正式上线）从未独立成版本——部署上线实际随 v1.1 完成，动效/SEO 等未做内容并入「未来方向」。

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

## v1.3 — 多端适配（完成）

2026-08-03 实施。评估方法：Playwright 7 视口 × 6 页面实测 + 源码逐条核对（详见 `~/docs/doebkweb-responsive.md`）。

### 已完成

- **移动端汉堡导航**：≤640px 侧栏变抽屉——汉堡按钮（毛玻璃 fixed 左上）+ 遮罩 + transform 滑入 + Escape/点击链接/遮罩关闭；VT-safe（inline `onclick` + `window.__vt_toggleNav`，切页后 `astro:after-swap` 自动重置）；首页 CSS 隐藏（自带大按钮导航）；i18n 新增 `nav.menu`
- **断点 768 → 640**：Sidebar / BaseLayout / VinylPlayer 三处同步下移，解决 iPad 竖屏（768×1024）侧栏消失——641px+ 保留完整侧栏，≤640 汉堡接管
- **播放器面板限高**：`max-height: calc(100vh - var(--space-6))` + `overflow-y: auto`，修复横屏手机（667×375 等）面板超高且不可滚动、控件不可达
- **宽度 token 对齐**：首页 `64rem` → `var(--max-width-wide)`；docs 列表**保持通栏铺满**（文档目录页定位，限宽实施后经设计决定回滚）
- **类型检查**：Sidebar script 增加 `declare global` window 扩展声明，`astro check` 0 errors

---

## v1.4 — 三段式主题切换（完成）

2026-08-03 实施。

### 已完成

- **状态模型**：`localStorage["doebk-theme"]`（light/dark/auto，缺省 auto）+ `<html data-theme>`（有效主题，驱动 CSS）+ `<html data-theme-mode>`（用户模式，驱动 UI 高亮）
- **FOUC 防护**：BaseLayout head 内联脚本首帧前同步设属性 + meta theme-color；Shiki 代码块改用 `themes: {light, dark}` + `defaultColor: false`，prose.css 按 `[data-theme]` 属性切换
- **切换入口**：侧栏太阳/月亮按钮（图标显示目标状态，`__vt_toggleTheme`）+ 设置面板「外观」分段控件（`__vt_setTheme`，chips 复用语言切换样式）
- **系统跟随**：auto 模式下 matchMedia 监听系统主题变化（remove-before-add 防累积），仅更新有效主题不污染用户选择
- **VT 兼容**：交换会清掉 html 运行时属性且 head 内联脚本不重跑 → `__vt_applyTheme` 挂在 persist 侧栏的 `astro:after-swap` 恢复；meta theme-color 交换后重建
- **暗色色板**：Apple 风格（纯黑底 #000 + 表面 #1c1c1e，accent 反转白色），新增 `--color-text-on-accent` token（替换 skip-link / VinylPlayer action-btn 硬编码 #fff）
- **验证**：Playwright 实测属性切换、重载持久化、VT 切页保持、chips 联动、Shiki 明暗色值；`astro check` 0 errors

---

## v1.5 — 动效打磨（完成）

2026-08-03 实施。范围（用户确认）：页面切换过渡 + 结构性动画 spring 化 + 内容入场；滚动视差明确不做。

### 已完成

- **页面切换过渡**：Astro `transition:animate` 方向感知 slide+fade——自定义 `@keyframes vt-in/out-forward/backward`（±24px，new 0.38s `cubic-bezier(0.16,1,0.3,1)` / old 0.28s ease-out），前进右滑入、后退左滑入；persist 元素不参与 root 动画；`prefers-reduced-motion` 下 `::view-transition-*` 禁用
- **结构性动画 spring 化**（Motion vanilla `animate` + `spring`，`{ stiffness: 380, damping: 32, reduceMotion: true }`，可中断可反转）：
  - 汉堡抽屉滑入/滑出（`__vt_toggleNav` / `__vt_closeNav(instant)`；after-swap 走 instant 不播动画）
  - 播放器面板弹入/收起（`__vt_panelAnimate` 独立 script 块桥接——主 script 带 define:vars 内联输出无法 import）
  - 设置面板 modal 弹出/关闭（动画结束才设 hidden）
- **内容入场**：docs/music/photos 三列表页 `inView` + stagger 延迟（JS 设初始态 opacity 0 + translateY(10px)，动画结束清 inline；排序/搜索重排不重放；reduced-motion 降级为淡入）
- **transform 所有权约定**：JS 接管属性的 CSS transition 移除，只留基础态值；`finished.then` 内 rAF 延迟一帧清理（Motion 终值写回晚于 resolve，避免残留 transform 在桌面断点移出侧栏）
- **验证**：Playwright 实测过渡动画激活（vt-in/out）、抽屉/面板/设置 spring 中间值与终态、入场 0→1、reduced-motion 降级（入场淡入 + 过渡禁用）、桌面断点 resize 侧栏可见、v1.4 主题回归；`astro check` 0 errors；console 0 errors

---

## v1.5.1 — 移动端修复 + VT 监听器审计（完成）

2026-08-03 实施。v1.5 之后移动端真机验收发现的问题批次，用户手动验证通过。

### 已完成

- **汉堡抽屉切页后不收回**：`navAnim.stop()` 会把当前中间值**异步写回** inline（晚于同步清空，实测侧栏停在中途、桌面断点残留 transform 移出屏）——instant 复位改用 `cancel()`（取消，不写回当前值）+ rAF 延迟一帧兜底清
- **汉堡图标打开时淡出隐藏**：`aria-expanded` 属性驱动 CSS（opacity 200ms 淡出 + visibility 延迟），关闭立即恢复；toggle/closeNav 全路径维护属性，VT 切页自动复位
- **iOS Safari 100vh 修复**：100vh 含地址栏高度，底部内容（主题/设置图标、面板底、TOC 底）被遮不可见——sidebar `height: 100dvh` + `padding-bottom: env(safe-area-inset-bottom)`（home indicator 避让）、播放器面板/TOC `max-height: 100dvh`（vh fallback 在前）
- **侧栏去 persist（i18n 切换修复）**：persist 保留旧语言 DOM——切英文后导航文案/链接仍是中文（点导航全跳回 zh）；移除 `transition:persist` 每页重建，状态由 `astro:after-swap` 兜底（抽屉复位/滑块定位/主题恢复）；after-swap 处理器改 remove-before-add 防累积
- **设置弹窗 VT-safe**：齿轮/遮罩原来用元素级 `addEventListener`——侧栏每页重建后监听器绑在旧元素，新元素点击无响应（用户实测"刷新才能打开"）——改 inline `onclick` + `window.__vt_toggleSettings/closeSettings`（函数内每次取最新 DOM）；弹窗内部 `stopPropagation` 防误关
- **navList hover 委托**：滑块跟随改 document 级委托（mouseover/mouseout + relatedTarget 判断，remove-before-add）；滑块函数内部取最新 DOM
- **监听器审计**：docs 列表页 click/keydown 补 remove-before-add（页面级脚本每次 VT 重跑防累积）；确认 [slug] TOC / photos 键盘已合规、VinylPlayer persist 元素级监听有效
- **CLAUDE.md 约定强化**：元素级 `addEventListener` 一律禁止（非 persist 元素）+ "去掉某元素 persist 时必须 grep 审计子树内元素级监听器"
- **验证**：Playwright 复现矩阵（抽屉中间值/切页复位、图标淡出、dvh 尺寸、i18n 双向切换、多次切页监听器无累积）+ 用户真机手动验收通过

---

## v1.6 — 媒体 CLI + R2 immutable 迁移（完成）

2026-08-03 实施。

### 已完成

- **R2 immutable 缓存迁移**：57 个对象（3 专辑音乐 + 6 照片）全部重传并带 `cache-control: public, max-age=31536000, immutable`；边缘缓存 HIT 实测（GET 二次请求）；验证方法修正——**R2 自定义域 HEAD 请求恒 DYNAMIC**（R2 特性），缓存状态必须读 GET 响应头；`.lrc`（text/plain）不在 Cloudflare 默认缓存扩展名列表，回源 32B 无成本，接受不缓存
- **media CLI**（`scripts/media.mjs`，`pnpm media`）：
  - `photos <RAW目录>`：exiftool 提取 + sharp 转码（断点续传）→ 上传 → photos.json 条目自动生成（宽高/拍摄日期从 EXIF）
  - `album <专辑目录>`：music-metadata 读 ID3（标题/艺术家/曲序 TRCK）→ 封面（目录已有 > ncm/ID3 内嵌）统一压缩 1000px q80 → 上传 → 新专辑自动生成 music.json 草稿（交互确认）
  - `ncm <文件|目录>`：Node 原生解密（AES-128-ECB + XOR + RC4 变体，基于 taurusxin/ncmdump，MIT 注明来源）——实测 ncm 解密产物**自带完整 ID3（含 TRCK 曲序）**；封面区数据提取落盘 cover.jpg；`--remove` 可选删除源文件；无 ffmpeg 依赖
  - `review`：札记编辑（交互式 + 参数式），写回 music.json / photos.json
  - 上传核心：v4 API 直传（fetch 不走代理，直连）+ 并发 6 + 重试 ×2 + 流式 body + 上传后自动验证（200/cache-control/content-length/HIT，`.lrc` 跳过 HIT 断言）
- **摄影数据 JSON 化**：`src/data/photos.json`（数据源）+ `photos.ts`（类型薄导出层）
- **新专辑 Microcastle（Deerhunter）**：12 首 ncm 解密 → 上传，music.json 条目自动生成（曲序/lrc 全自动）
- **文档**：新增 `docs/upload.md` 上传指南（媒体 CLI + 文档 git 流程，替代 photos.md）；deployment.md 上传流程改 CLI 主路径 + wrangler 兜底

---

## v1.7 — S3 multipart 上传 + 照片墙/札记搜索 + 修复批次（完成）

2026-08-04 实施。

### 已完成

- **媒体 CLI 上传迁移 S3 API**：v4 API 无 multipart 且单连接被 BDP 限制（~1MB/s）——上传改走 S3（`r2.cloudflarestorage.com`，手写 SigV4 签名零依赖）；>5MB 文件 multipart 分片（5MB/片并发上传）突破单连接瓶颈；新凭证 `CLOUDFLARE_R2_ACCESS_KEY_ID/SECRET_ACCESS_KEY`（R2 → Manage R2 API Tokens）；签名修复：header 名小写化（Content-Type 大写曾致 SignatureDoesNotMatch）+ AWS URI 编码（`!'()*` 必须 %XX）
- **验证修复**：lrc（text/plain）被 CF 压缩后 HEAD 无 content-length（undici Accept-Encoding）——长度改从 GET Range 206 的 `Content-Range` 解析（不受压缩影响），14/14 lrc 复核通过
- **photos 支持 JPG**：输入识别 RAW/JPG——RAW exiftool 提取内嵌 JPEG、JPG 直接压缩；竖图逻辑（小图 rotate 像素、大图保留标签、宽高交换）两种输入统一；交互模式扫描含 RAW/JPG 的目录
- **album 自动 ncm 转换**：纯 ncm 目录（约定不混杂）询问后就地转换 + 删除源，再继续专辑流程
- **photos.json note 字段恒存在**：生成/清空都写空串（曾 delete 字段导致结构不齐）
- **照片页**：照片墙视图（`display: contents` 打破日期分组 → 单 grid 连续铺满，前满尾空、图片不放大）+ 时间线切换（默认墙、localStorage 记忆、切换 stagger 淡入重放，样式仿 music 排序控件）；札记搜索（music 同款搜索框，按 note 实时过滤 + 无结果提示）；toolbar 布局与 music 严格一致（搜索前、切换后）
- **播放器**：唱臂百分比定位（相对唱片 wrap，pivot 恒在右缘外侧等比——修复移动端比例失衡 + 暂停悬臂）；黑胶滑出动画 `@media (hover: hover)` 限定（触屏含平板无 hover 粘滞）；`:active` 去左移只留缩放按压反馈
- **修复批次**：设置弹窗 VT 切页后困在抽屉（sidebar transform 是 fixed 包含块——open() 时提升 overlay 到 body，inline onclick 兜底不依赖脚本重跑）；侧栏滑块切页瞬时定位（新 DOM 无 inline transform 会从顶部滑下）；摄影札记占位文案与真实札记字体字号统一；搜索框占位文案「搜索摄影札记…」/「Search photo notes…」
- **sitemap + SEO meta**：`@astrojs/sitemap` 构建自动生成（zh/en 全 URL）；BaseLayout 输出 canonical + og:type/title/description/url/locale；各页专属 description（about/music/photos/docs 文案 + 文档详情用 frontmatter summary）；og:image/twitter:card/JSON-LD/RSS 明确不做
- **文档**：README/upload.md/deployment.md/architecture.md 同步（S3 凭证、multipart、照片 JPG、照片墙功能表）；CLAUDE.md 补「跨页共享组件脚本 VT 后不重跑」约定

---

## v1.7.1 — 播放器按钮偏移 + 搜索栏换行临界对齐（完成）

2026-08-04 实施。v1.7 之后验收发现的布局问题批次，Playwright 实测三态/全宽度验证。

### 已完成

- **播放器未播放态按钮偏移**：无专辑加载时「专辑架」按钮偏右 8px（中心 769 vs 容器 761）——init/showAlbumUI 只 `display:none` 了按钮和分隔线，未隐藏容器 span（`#actions-info`/`#volume-wrap`），零宽 flex item 在行内照常占 `gap` 把唯一可见按钮顶偏；修复为容器一并隐藏/恢复（`els()` 补 volumeWrap 引用），加载专辑后全控件恢复显示、两行均居中（实测未播放/播放/桌面三态回归）
- **照片/音乐搜索栏换行临界对齐**：两页 toolbar 样式同构，唯一差异是右侧按钮组宽度（view-toggle「照片墙·时间线」6 字 vs sort-group「专辑名·歌手」5 字，宽 140 vs 126）——换行临界视口不同（photos 411 / music 397），400–410 区间照片两行、音乐一行；photos `.search-wrap` min-width 180→166，用按钮组差 14px 抵消（166+16+140 = 180+16+126 = 322），两页换行临界同为 toolbar 322px（视口 397 起同时换一行），实测 375–1280 全宽度两页布局行为一致

---

## 未来方向（v1.8+）

- 真实内容填充（摄影/音乐/技术文档持续补充）
- LRC 歌词展示 UI（数据字段已预留）

**明确不做**：
- ~~滚动视差 / drag~~（决策：纯装饰，违背 Apple 克制原则；TOC 高亮已有 IntersectionObserver，2026-08-03）
- ~~文档标签云/热力图~~（决策：文档规模小，标签体系收益低，2026-08-03）
- ~~系列文章导航（上一篇/下一篇）~~（决策：文档相互独立、非系列化，2026-08-03）
- ~~迷你碟→大碟 morph 形变动画~~（决策：跨元素形变复杂度高、收益低，2026-08-04）
- ~~RSS 订阅~~（决策：个人站读者面窄，订阅收益低，2026-08-04）
