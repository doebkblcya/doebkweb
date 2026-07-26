# 路线图

## 版本总览

| 版本 | 状态 | 内容 |
|---|---|---|
| v0.1（Demo） | ✅ 完成 | 项目骨架、Design Tokens、i18n、首页 + About + 简历 + 404 |
| v0.2 | ✅ 完成 | 文档系统（列表/详情/分类/归档）、双栏布局、音乐播放器 |
| v0.3 | 📋 计划中 | Pagefind 搜索集成 |
| v0.4 | 📋 计划中 | Motion 动效打磨、页面过渡动画 |
| v1.0 | 📋 计划中 | 正式上线、内容完善、SEO/RSS/sitemap |
| v1.1 | ✅ 完成 | 音乐 & 摄影（R2 图床、专辑架、黑胶动画、摄影网格 + Lightbox） |

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
  - About Me：Content Collections Markdown 渲染 + 简历下载
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
  - 类型安全的 collection schema（`title`, `date`, `updated`, `category`, `summary`, `draft`, `listed`）
  - `listed: false` 排除特殊页面（about.md 不出现在文档列表）
  - 3 篇示例文档用于开发调试

- **文档列表页** `/docs/`
  - 全部文档，按日期倒序
  - 筛选栏：按分类快速筛选
  - 空状态：居中 "暂无文档" + 引导文案
  - "查看归档" 链接

- **文档详情页** `/docs/[slug]/`
  - Markdown → HTML 渲染（`getEntry()` + `render()`）
  - 代码块语法高亮（Shiki，github-light 主题）
  - 排版优化（正文行宽、标题层级、`<hr>` 分隔、引用块）
  - frontmatter 信息展示（日期、更新日期、分类、阅读时间）

- **分类页** `/docs/category/[category]/`
  - 按 frontmatter `category` 筛选
  - 空状态：该分类暂无文档

- **归档页** `/docs/archive/`
  - 按年月分组展示
  - 空状态：暂无归档

- **音乐播放器**
  - 自定义 HTML5 Audio 控件
  - 播放/暂停 SVG 图标切换
  - 可点击进度条跳转
  - 曲目结束后自动下一首
  - URL 编码处理中文/空格文件名
  - HTTP Range 流式播放，不占满带宽

- **右侧边栏**
  - 个人信息卡片（头像/姓名/简介/位置/GitHub 链接）
  - 音乐播放器集成
  - 折叠状态隐藏所有交互内容
  - 空播放列表时显示引导文案

---

## v0.3 — 搜索（计划中）

### 待实现

- **Pagefind 集成**
  - 构建后钩子：`astro build` 后自动运行 Pagefind CLI
  - `dist/pagefind/` 输出搜索索引

- **搜索页** `/search/`
  - Pagefind 默认搜索 UI（或轻量自定义）
  - 搜索结果列表（标题 + 片段 + 链接）
  - 无结果状态：搜索建议

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
  - 简历 PDF 终稿

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
  - 共享数据层 `src/data/playlist.ts`：Album/Track 接口、专辑分组、URL 辅助函数
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
  - 简历下载移入 About Me 页面，删除独立简历页

- **Cloudflare Pages 部署（代码已就绪，待 Dashboard 创建项目）**
  - 静态站点迁移至 Pages，`git push main` 自动构建部署
  - `_redirects` 替代 Nginx `/ → /zh/` 重定向
  - 与 VPS 完全解耦

### 待完成

- **Cloudflare Pages**：Dashboard 创建项目、绑定域名、切 DNS
- **LRC 歌词展示 UI**（数据字段已预留）
- **摄影内容填充**（照片上传至 R2 + 缩略图生成）

---

## 未来方向（v1.2+）

- 暗色/亮色模式切换
- 移动端汉堡菜单
- 文档标签云/热力图
- 文章内目录（TOC）自动生成
- 系列文章导航（上一篇/下一篇）
