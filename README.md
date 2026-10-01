# doebkweb

doebkblcya 的个人静态网站：个人介绍、技术文章、专辑与乐评、摄影作品。

Astro 5 生成 zh/en 静态多页面，Cloudflare Pages 部署页面，Cloudflare R2 保存媒体图片。首页使用独立展开动效，内页使用浏览器原生页面转场。网站运行与构建只读取本地内容数据，不依赖专辑查询 API 或站点后端。

## 功能

- 关于我：个人信息、猫咪图片与名字、联系方式。
- 文档：Markdown 文章、Shiki 双主题代码高亮、目录、Pagefind 全文搜索。
- 唱片：默认“选集”随机展示有乐评的专辑，封套抽出唱片并展开乐评；“唱片架”展示全部专辑，支持搜索和专辑名/艺术家排序。详情弹层提供资料、乐评与可选 Apple Music 跳转链接。
- 摄影：默认连续摄影展，一屏以一张为主，横竖图完整适配统一展示区域，各自札记在下方。照片墙支持原始文件名/拍摄时间排序和札记搜索，点击照片打开大图。
- 中英文 UI、浅色/深色/系统主题、桌面侧栏与移动抽屉、自托管字体。动效遵守系统减少动态效果偏好。
- 设置、专辑与摄影弹层共用模糊背景，通过背景点击或 Escape 关闭。

## 本地运行与检查

Node.js 22.12+，pnpm：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

默认地址 `http://localhost:4321`。Pagefind 索引在构建时生成，全文搜索使用 build + preview 验证。

```bash
node maintenance/media/tools/validate-media.mjs
pnpm exec astro check
pnpm build
pnpm preview
git diff --check
```

页面外观由站点作者手动验收。

## 项目目录

| 位置 | 用途 |
|---|---|
| `src/pages/`、`src/components/`、`src/layouts/` | 页面、组件与布局 |
| `src/styles/` | 全局样式、主题参数与转场 |
| `src/data/about.ts`、`src/data/cats.json` | 关于页正文、猫咪图片与名字 |
| `src/data/albums.json` | 专辑资料、封面、乐评与播放链接 |
| `src/data/photos.json` | 摄影作品、原始文件名、可选拍摄时间与独立札记 |
| `src/data/photo-groups.json` | 摄影分类与照片观看顺序 |
| `src/content/docs/` | 网站公开技术文章 |
| `src/i18n/`、`src/types/i18n.ts` | 中英文 UI 与类型 |
| `public/` | 首页人物画、图标、重定向及静态页面 |
| `maintenance/media/` | AI 媒体维护说明与图片处理小工具 |
| `materials/` | 本地素材、最终编辑成果及工作期间的临时产物，不进 Git |
| `tmp/` | 检查日志、测试缓存等可清理的临时文件，不进 Git |

## 更新内容

技术文章写入 `src/content/docs/*.md`：

```yaml
---
title: "文章标题"
date: 2026-10-02
summary: "一句话概述"
# updated: 2026-10-03
# draft: true
# listed: false
---
```

`title`、`date`、`summary` 必填；`draft: true` 或 `listed: false` 不生成详情路由。正文保持原语言，使用 h2/h3 组织目录；避免暴露凭证和私有环境信息。关于页正文改 `src/data/about.ts`，猫咪图片与名字改 `src/data/cats.json`。UI 文案同时更新 zh/en 与类型。

更新专辑或摄影时，让 AI 阅读 [媒体维护入口](maintenance/media/README.md)，再按 [专辑录入](maintenance/media/albums.md) 或 [摄影上传](maintenance/media/photos.md) 完成处理、上传、验证与数据更新。用户提供素材、专辑名、乐评或札记；图片处理工具由 AI 调用。

照片可以放入 `materials/inbox/photos/` 的分类目录，也可以直接提供本地既有目录。原始素材和最终编辑成果保留；任务完成并验证后，清理查询结果、派生图、草稿、上传回执、日志和临时脚本。

## 发布

对象上传和页面发布是两个步骤。专辑封面和照片上传 R2 `doebkweb`，公共域名为 `https://cdn.doebkblcya.com`；验证实际 GET 成功后才写入公开 JSON。媒体内容改变时使用新版本路径，对象采用 immutable 缓存。

推送 `main` 触发 Cloudflare Pages 部署：构建命令 `pnpm build`，产物目录 `dist/`，站点地址 `https://www.doebkblcya.com`。`astro.config.mjs` 的 `site` 控制 canonical/sitemap，`public/_redirects` 配置根路由跳转。提交与推送按当前任务授权执行。

构建失败时检查 frontmatter、JSON、类型和 i18n；搜索异常时确认 `dist/pagefind/` 已生成；图片异常时核对 JSON 地址与 CDN GET。页面回滚前确认所引用的媒体仍可访问。

协作与实现约束见 [AGENT.md](AGENT.md)。

Copyright © 2026 doebkblcya。站内原创内容未经授权禁止转载。
