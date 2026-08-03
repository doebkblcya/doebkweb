# 个人静态技术站点需求说明书

## 项目概述

搭建一套纯静态个人网站，无后端服务、无数据库，不包含评论、留言等动态交互功能。

四重定位：
- **程序员求职个人线上名片**（About Me）
- **自用技术文档知识库**（Markdown 本地管理、全文搜索、Shiki 代码高亮）
- **唱片架**（黑胶播放器 + 专辑管理 + 跨页持久化播放）
- **摄影画廊**（响应式网格 + 懒加载 + Lightbox 全屏预览）

所有内容以 Markdown / JSON 本地管理，构建编译为静态 HTML 文件，部署于 Cloudflare Pages。

---

## 一、技术选型

| 项 | 选型 | 理由 |
|---|---|---|
| 静态站点生成器 | **Astro** | 原生 Content Collections（Markdown frontmatter 类型安全）、默认零 JS 输出、内置 i18n 路由、CSS Variables 架构天然支持整体换肤 |
| Markdown 内容组织 | `src/content/docs/` 扁平存放，frontmatter 管理元数据 | 结构简单、Astro Content Collections 原生支持 |
| 全文搜索 | **Pagefind** | 构建后自动生成索引，零运行时开销，搜索体验好 |
| Web 服务器 | **Cloudflare Pages** | 全球边缘节点，自动 SSL，免费 |
| 媒体资源 | **Cloudflare R2** | 零出口费，全球 CDN，自定义域名 |
| 部署方式 | `git push main` → Pages 自动构建 | 零手动操作 |

### Markdown Frontmatter 规范

每篇文档包含以下 frontmatter：

```yaml
---
title: "文档标题"
date: 2026-07-23
updated: 2026-07-23        # 可选，最近修改日期
summary: "一句话摘要"
draft: false               # 可选，true = 构建时跳过
listed: true               # 可选，false = 不出现在文档列表（如 about.md）
---
```

---

## 二、页面与路由规划

采用 Astro 内置 i18n 路由，URL 前缀 `/[lang]/`：

| 页面 | 路由 | 说明 |
|---|---|---|
| 首页 | `/` 或 `/[lang]/` | 站点总入口，导航引导 |
| About Me | `/[lang]/about` | 个人介绍 |
| 音乐 | `/[lang]/music` | 专辑架展示 + 播放联动 |
| 摄影 | `/[lang]/photos` | 照片网格 + Lightbox 预览 |
| 文档列表 | `/[lang]/docs` | 全部文档列表 + 内嵌 Pagefind 搜索 + 排序切换 |
| 文档详情 | `/[lang]/docs/[slug]` | 单篇文档渲染 |
| 404 | `/[lang]/404` | 自定义错误页面 |

> v1.2 精简：原「分类页 `/docs/category/[category]`」「时间归档 `/docs/archive`」「独立搜索页 `/search`」已移除，搜索并入文档列表页内嵌。

### i18n 约束

- 支持语言：`zh`（中文）、`en`（英文）
- 仅 UI 文案翻译，**文档内容不做翻译**
- 语言切换不影响当前所在页面位置

---

## 三、功能取舍标准

- **核心功能必须实现**：页面导航、文档列表/详情、内嵌搜索
- **暂缓开发**：RSS 订阅、sitemap 自动生成
- **已实现**：暗色/亮色模式切换（三段式 浅色/深色/自动，v1.4）

---

## 四、视觉与交互约束

### 设计语言：Apple Design

以 Apple 现代设计风格为交付标准，核心理念：

- **直接操控** — 交互元素 1:1 跟随用户输入，即时反馈
- **可中断的动效** — 所有动画基于 spring（弹性物理），不锁定用户输入，可随时抓取/反转
- **材质与景深** — 导航、工具栏使用半透明毛玻璃（`backdrop-filter`），内容在下层滚动
- **排版优先** — 系统字体优先，字间距/行高随字号动态调整
- **克制** — 动效只为物理交互服务（非装饰），反馈只在有意义时刻出现

### 技术落地策略

| 设计诉求 | 实现方式 |
|---|---|
| 整体可换肤 | CSS 自定义属性（design tokens）集中管理颜色、间距、字体、阴影 |
| 暗色模式 | 颜色 token 按 `:root` 和 `[data-theme="dark"]` 分两层；三段式切换（浅色/深色/自动），localStorage 记忆 + 跟随系统 |
| Spring 动画 | `motion` 库（原 Framer Motion），默认 `damping: 1.0`（无回弹），手势交互时 `damping: ~0.8` |
| 毛玻璃材质 | `backdrop-filter: blur() saturate()` + 半透明背景 |
| 滚动条 | Apple 风格浅色细滚动条：token 化（`--color-scrollbar`），细宽圆角无轨道 thumb，hover 加深，暗色模式自动适配 |
| 排版 | `system-ui` 字体栈；大标题 `letter-spacing: -0.02em` + `line-height: 1.05`；正文 `line-height: 1.5`；所有间距使用 `rem`/`em` |
| 减少动效 | `@media (prefers-reduced-motion: reduce)` 降级为 opacity 淡入淡出 |
| 响应式 | 移动优先，breakpoint 以内容自然断点为准（非固定设备宽度） |

### 页面职责解耦

- 个人介绍（About Me）与文档列表各自独立页面，不合并
- 导航栏全局统一，标明当前所在位置

---

## 五、内容策略

### 当前状态

已有 9 篇真实技术文档（ComfyUI/FLUX/Gyroflow/Qwen/ASR/ReActor/VT 故障报告/WSL2 音频），存放在 `src/content/docs/`。

### 空内容降级策略

| 页面 | 空状态表现 |
|---|---|
| 文档列表 | 居中提示"暂无文档"，附带引导说明 |
| 搜索（无结果） | "未找到匹配的文档" + 搜索建议 |
| 精选文档区 | 首页不展示该区块，不存在时不渲染 |

### 图片资源

- **网站素材**（favicon、UI 图标等）：本地 `public/` 目录
- **摄影作品**：Cloudflare R2 图床（`photos/originals/` 存原图，`photos/thumbs/` 存 WebP 缩略图）
- **专辑封面**：R2 `music/<专辑>/cover.jpg`，与音乐文件同目录

### 音乐资源

- MP3 存放于 Cloudflare R2 `music/<专辑名>/`，通过 CDN 加速访问
- LRC 歌词文件同目录存放，路径按 `music/<专辑名>/<曲名>.lrc`
- 浏览器 HTTP Range 按需缓冲，CDN 边缘缓存减少回源

---

## 六、部署与资源规范

- **构建产物**：`astro build` 输出 `dist/`，包含完整静态资源（HTML/CSS/JS/Pagefind 索引）
- **部署**：Cloudflare Pages（`git push main` 自动构建部署）
- **媒体资源**：Cloudflare R2 + CDN（`cdn.doebkblcya.com`）
- **域名**：doebkblcya.com / www.doebkblcya.com
- **HTTPS**：Cloudflare 自动 SSL

---

## 七、架构约束

1. 纯静态输出，无服务端运行时
2. CSS 变量集中管理，主题可整体替换
3. 组件化开发，页面 = 组件组合
4. Markdown 内容与 UI 完全解耦
5. i18n UI 文案独立文件管理
6. 构建流程可复现（`pnpm install && pnpm build`）
