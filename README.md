# doebkweb

doebkblcya 的个人静态网站：个人介绍、技术文档、唱片架和摄影画廊。

网站使用 Astro 5 生成静态页面，部署在 Cloudflare Pages；音乐和摄影资源存放在 Cloudflare R2。首页以跟随明暗主题的纸白/纯黑背景、`doebkblcya` 大标题和人物画作为核心视觉，单次下拉完成构图重排并显示导航。站内页采用展览画册式排版，以编辑字体、细结构线和留白统一各页面。

## 功能

- 技术文档：Astro Content Collections、Shiki 双主题代码高亮、目录 rail、Pagefind 全文搜索。
- 唱片架：专辑搜索与排序、曲目播放、黑胶和唱臂动效、跨页面连续播放。
- 摄影画廊：照片墙/时间线切换、札记搜索、响应式 Lightbox。
- 关于页：内容由 TypeScript 数据文件维护，包含自述与联系方式。
- 双语 UI：中文和英文路由，正文内容保持原语言。
- 三段式主题：浅色、深色、跟随系统。
- 响应式导航：桌面固定侧栏，手机抽屉导航；首页使用独立导航入口。
- 自托管字体：Newsreader、Hanken Grotesk、JetBrains Mono 与 Noto 中文可变字体，不依赖第三方字体 CDN。
- 内容工作流：媒体 CLI 负责转码、R2 上传、校验和数据写回。

ClientRouter 仅用于无刷新的站内导航和播放器持久化。全站根转场已关闭，首页和其他页面各自管理动效生命周期。

## 快速开始

```bash
pnpm install
pnpm dev
pnpm exec astro check
pnpm build
pnpm preview
```

开发服务器默认是 `http://localhost:4321`。Pagefind 只在生产构建后存在，搜索请通过 `pnpm build && pnpm preview` 检查。

## 目录

```text
src/
├── components/             Sidebar、播放器、设置、页脚
├── content/docs/           技术文章
├── data/                   about.ts、music.json、photos.json 及派生 helper
├── i18n/                   中英文 UI
├── layouts/BaseLayout.astro
├── pages/[lang]/           zh/en 页面与文档路由
└── styles/                 tokens、reset、global、prose
public/
├── images/home-figure.webp 首页人物素材
├── favicon.svg
├── apple-touch-icon.png
└── _redirects
docs/                       项目文档
scripts/media.mjs           媒体 CLI
```

## 数据来源

| 内容 | 文件 |
|---|---|
| 关于页 | `src/data/about.ts` |
| 专辑与曲目 | `src/data/music.json` |
| 摄影 | `src/data/photos.json` |
| UI 文案 | `src/i18n/zh.ts`、`src/i18n/en.ts` |
| 文档 | `src/content/docs/*.md` |

内容数量不在文档中重复维护，始终以这些数据文件和 Content Collection 为准。

## 发布

推送 `main` 后由 Cloudflare Pages 执行 `pnpm build` 并发布 `dist/`。媒体文件不进入 Git，通过 `pnpm media` 上传到 `cdn.doebkblcya.com`。

## 项目文档

- [协作约束](AGENT.md)
- [产品需求](docs/requirements.md)
- [架构说明](docs/architecture.md)
- [部署指南](docs/deployment.md)
- [内容与媒体上传](docs/upload.md)
- [路线图](docs/roadmap.md)

Copyright © 2026 doebkblcya。站内原创内容未经授权禁止转载。
