# doebkweb

doebkblcya 的个人静态网站：个人介绍、技术文档、专辑与乐评、摄影画廊。

Astro 5 生成静态多页面，Cloudflare Pages 部署；专辑封面和摄影图片存放在 R2。首页保留大标题、人物与展开动效，站内采用编辑字体、细线和留白。内页之间使用浏览器原生页面转场；首页独立，不参与切页动画。

## 功能

- 文档：Astro Content Collections、Shiki 双主题高亮、目录、Pagefind 全文搜索。
- 唱片：默认“选集”随机展示有乐评的专辑，封套抽出唱片并展开完整乐评；“唱片架”保留全部封面网格、搜索及专辑名/艺术家排序。点击封面打开居中的模糊背景详情弹层。
- 摄影：照片墙/时间线、说明搜索、大图弹窗与键盘切换。
- 中英文 UI、浅色/深色/系统主题，桌面侧栏与移动抽屉。
- 自托管中英文字体，纯静态运行，无后端、音乐播放或跨页面播放器。

## 本地运行

Node.js 22.12+，pnpm：

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm exec astro check
pnpm build
pnpm preview
```

默认 `http://localhost:4321`。全文搜索在 build + preview 中验证；开发模式不加载 Pagefind。

## 内容来源

| 内容 | 位置 |
|---|---|
| 关于页 | `src/data/about.ts` |
| 专辑与乐评 | `src/data/albums.json` |
| 摄影 | `src/data/photos.json` |
| 中英文 UI | `src/i18n/zh.ts`、`src/i18n/en.ts` |
| 技术文章 | `src/content/docs/*.md` |
| 布局、转场 | `src/layouts/BaseLayout.astro`、`src/styles/transitions.css` |
| 媒体维护文档与工具 | `maintenance/media/` |

## 更新与发布

让 AI 阅读 [媒体维护入口](maintenance/media/README.md)，按 [专辑录入](maintenance/media/albums.md) 或 [摄影上传](maintenance/media/photos.md) 执行。资料在录入时查找并复审，最终写入静态 JSON；封面和照片上传 R2 后才更新公开记录。没有独立媒体 CLI，也没有网站运行时专辑 API。

原始素材与派生文件放本地 `materials/`，不进 Git。对象上传使用项目 Wrangler；`main` 推送触发 Cloudflare Pages 的 `pnpm build` 和 `dist/` 部署。R2 已在本轮重置；公开媒体清单只收录重新上传并验证成功的资源。

## 文档

- [协作约束](AGENT.md)
- [产品需求](docs/requirements.md)
- [架构](docs/architecture.md)
- [部署](docs/deployment.md)
- [内容与媒体](docs/upload.md)
- [路线图](docs/roadmap.md)

Copyright © 2026 doebkblcya。站内原创内容未经授权禁止转载。
