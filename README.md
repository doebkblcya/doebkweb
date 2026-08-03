# doebkweb

> 个人静态技术站点 — 程序员名片 · 技术文档知识库 · 摄影画廊 · 唱片架

Apple Design 风格的纯静态站点,基于 [Astro](https://astro.build) 构建,部署于 Cloudflare Pages,媒体资源托管于 R2 CDN。

[![Astro](https://img.shields.io/badge/Astro-5.6-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![i18n](https://img.shields.io/badge/i18n-中文%20%2F%20English-1d1d1f)]()
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20R2-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![View Transitions](https://img.shields.io/badge/View%20Transitions-✓-0071e3)]()

---

## 功能

| 功能 | 说明 |
|---|---|
| **技术文档** | 9 篇真实技术文档,Markdown 内容 + Shiki 语法高亮;右侧目录 rail(滚动高亮)、表格横向滚动、kbd / 折叠块 / 外部链接标识等增强渲染 |
| **全文搜索** | Pagefind 构建时索引,文档列表页内嵌下拉搜索,毛玻璃面板 + 键盘导航(↑↓ / Enter / Esc) |
| **音乐播放器** | 黑胶唱片动画(旋转 + 唱臂联动)、专辑架联动播放;View Transitions 跨页持久化,切页不中断;曲序由数据层 `trackNo` 排序 |
| **摄影画廊** | 响应式网格 + 原生懒加载,Lightbox 全屏预览(键盘 ← → / Esc 导航) |
| **双语 UI** | 中 / 英文案,TypeScript 接口约束结构一致;文档内容不翻译,仅 UI 翻译 |
| **多端适配** | 桌面完整侧栏,iPad 竖屏保留侧栏,手机(≤640px)汉堡抽屉导航;播放器面板横屏可滚动 |
| **三段式主题** | 浅色 / 深色 / 自动(跟随系统),侧栏太阳月亮快捷切换 + 设置面板分段控件;localStorage 记忆,View Transitions 切页不闪 |

---

## 快速开始

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发服务器 → http://localhost:4321
pnpm build          # 生产构建 → dist/
pnpm preview        # 本地预览构建产物(含 Pagefind 搜索)
```

**部署**:`git push main` → Cloudflare Pages 自动构建分发,媒体资源走 R2 CDN(`cdn.doebkblcya.com`)。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | [Astro](https://astro.build) ^5.6(纯静态生成 + View Transitions) |
| 语言 | TypeScript ^5.8(`@astrojs/check` 类型检查) |
| 动画 | Motion ^12.11(依赖就绪,spring 物理动效规划中) |
| 搜索 | Pagefind ^1.5.2(构建时索引,零运行时开销) |
| 代码高亮 | Shiki 双主题(github-light / github-dark,按 `html[data-theme]` 切换) |
| 部署 | Cloudflare Pages + R2 媒体托管(`cdn.doebkblcya.com`) |

---

## 目录结构

```
doebkweb/
├── src/
│   ├── pages/[lang]/          # 路由页面(zh/en 双语言生成)
│   │   ├── index.astro        #   首页(全屏欢迎)
│   │   ├── about.astro        #   关于我
│   │   ├── music.astro        #   专辑架
│   │   ├── photos.astro       #   摄影画廊
│   │   ├── docs/              #   文档列表 + 详情(TOC rail)
│   │   └── 404.astro
│   ├── components/            # Sidebar(移动端汉堡)/ VinylPlayer / LanguageSettings / Footer
│   ├── layouts/BaseLayout.astro   # 全局布局(持久化 audio + 播放器 + 侧栏)
│   ├── content/docs/          # Markdown 文档(Content Collections)
│   ├── data/                  # music.json(唯一数据源)/ playlist.ts / photos.ts
│   ├── i18n/                  # zh.ts / en.ts(UIStrings 接口约束)
│   └── styles/                # tokens.css(Design Tokens)/ reset / global / prose
├── docs/                      # 项目文档(需求/架构/路线图/部署/照片)
├── scripts/process-photos.mjs # 照片处理(RAW → JPEG + WebP)
└── public/                    # 静态资源
```

---

## 项目文档

| 文件 | 内容 |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | 需求、设计语言、内容策略、约束 |
| [`docs/architecture.md`](docs/architecture.md) | 目录结构、路由、数据流、CSS 层级、事件总线 |
| [`docs/roadmap.md`](docs/roadmap.md) | 版本历史(按完成顺序)、未来方向 |
| [`docs/deployment.md`](docs/deployment.md) | 本地开发、Pages 部署、R2 上传、故障排查 |
| [`docs/photos.md`](docs/photos.md) | 照片处理脚本、上传流程、R2 路径规范 |
| [`CLAUDE.md`](CLAUDE.md) | AI 协作约定(View Transitions / 响应式 / 音乐数据) |

---

## 许可

Copyright © 2026 doebkblcya · [个人主页](https://doebkblcya.com) · 未经授权禁止转载
