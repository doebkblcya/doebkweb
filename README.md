# doebkweb

doebkblcya 的个人静态网站：个人介绍、技术文章、专辑与乐评、摄影作品。

Astro 5 生成 zh/en 静态多页面，Cloudflare Pages 部署页面，Cloudflare R2 保存专辑封面、摄影、猫咪图片和萌宠视频。内容资料由仓库中的 Markdown 与本地数据文件提供，媒体从 R2 加载；构建和浏览不调用专辑查询 API，也无需站点后端。首页是单层画面，使用 CSS 入场动效；内页使用浏览器原生页面转场。

## 功能

- 首页：手写名字、四个导航入口与油画花篮，黑白主题；签名逐字入场，花篮轻缓入场后静止。导航始终可点击，悬停或键盘聚焦时使用与侧栏一致的文字与背景颜色变化。手机使用纵向构图；减少动态效果时显示静态画面。
- 关于我：个人信息、三只猫的透明待机动画与名字、联系方式。猫咪固定在介绍旁，按前爪脚底对齐、保留各自大小；页面聚焦且区域可见时循环播放，离开视野、后台或弹层打开时暂停；减少动态效果或播放失败时显示待机封面。
- 文档：Markdown 文章、Shiki 双主题代码高亮、目录、Pagefind 全文搜索。
- 唱片：默认“选集”纳入全部有乐评的专辑，每次进入随机排列，每次展示一张，上下滚动或滑动切换，封套抽出唱片并展开乐评；“唱片架”展示全部专辑，支持搜索和专辑名/艺术家排序。详情弹层提供资料、乐评与可选 Apple Music 跳转链接。
- 摄影：默认“摄影展”随机展示已编排且有札记的照片，桌面左图右札记、窄屏上图下札记，照片轻缓入场，沿用选集的上下切换方式。两种展览均固定在视口内，作品连续上下移动、触摸拖动跟手；长正文可独立阅读。照片墙展示全部摄影记录，使用统一 3:2 预览，支持原始文件名/拍摄时间排序和札记搜索，点击查看完整大图。
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

代码改动执行类型检查和构建，媒体数据改动另执行清单检查；仅改文档时检查引用与 `git diff --check` 即可。页面外观与交互由站点作者手动验收。`pnpm preview` 用于查看构建结果，不是每次检查都必需。

## 项目目录

| 位置 | 用途 |
|---|---|
| `src/pages/`、`src/components/`、`src/layouts/` | 页面、组件与布局 |
| `src/styles/` | 全局样式、主题参数与转场 |
| `src/scripts/` | 选集与摄影展手势、切换，以及关于页待机动画播放管理 |
| `src/data/about.ts` | 关于页正文与联系方式 |
| `src/data/pets.json` | 猫咪名字、待机封面、两套透明视频及动作维护资料 |
| `src/data/albums.json` | 专辑资料、封面、乐评与播放链接 |
| `src/data/photos.json` | 摄影作品、原始文件名、可选拍摄时间/曝光参数与独立札记 |
| `src/data/photo-groups.json` | 摄影分类与展览作品选择 |
| `src/content/docs/` | 网站公开技术文章 |
| `src/i18n/`、`src/types/i18n.ts` | 中英文 UI 与类型 |
| `public/` | 首页花篮、图标、重定向及静态页面 |
| `maintenance/media/` | AI 媒体维护说明与图片、萌宠视频处理小工具 |
| `materials/` | 按需使用的本地素材与处理工作目录，不进 Git |
| `tmp/` | 按需创建的检查日志、测试缓存目录，不进 Git |

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

`title`、`date`、`summary` 必填；`draft: true` 或 `listed: false` 不生成详情路由。正文保持原语言，使用 h2/h3 组织目录；避免暴露凭证和私有环境信息。关于页正文改 `src/data/about.ts`，猫咪名字与视频地址改 `src/data/pets.json`。UI 文案同时更新 zh/en 与类型。

更新专辑或摄影时，让 AI 阅读 [媒体维护入口](maintenance/media/README.md)，再按 [专辑录入](maintenance/media/albums.md) 或 [摄影上传](maintenance/media/photos.md) 完成处理、上传、验证与数据更新。用户提供素材、专辑名、乐评或札记；图片处理工具由 AI 调用。

猫咪素材按 [萌宠视频流程](maintenance/media/pets.md) 从校准透明母版导出、验证和上传。网站仅在关于页加载待机所需的一套视频与封面，不加载其他动作；当前不启用悬浮、拖动或点击互动。

照片可以放入 `materials/inbox/photos/` 的分类目录，也可以直接提供本地既有目录。处理时不修改原件；完成后的中间产物清理及原件保留规则见媒体维护入口。网站展示不需要保留本地媒体副本。

项目说明集中在本文件、[AGENT.md](AGENT.md) 和 `maintenance/media/` 的维护文档。`src/content/docs/` 是网站文章，不属于项目维护说明。

## 发布

对象上传和页面发布是两个步骤。专辑封面和照片上传 R2 `doebkweb`，公共域名为 `https://cdn.doebkblcya.com`；验证实际 GET 成功后才写入公开 JSON。媒体内容改变时使用新版本路径，对象采用 immutable 缓存。

推送 `main` 触发 Cloudflare Pages 部署：构建命令 `pnpm build`，产物目录 `dist/`，站点地址 `https://www.doebkblcya.com`。`astro.config.mjs` 的 `site` 控制 canonical/sitemap，`public/_redirects` 配置根路由跳转。提交与推送按当前任务授权执行。

构建失败时检查 frontmatter、JSON、类型和 i18n；搜索异常时确认 `dist/pagefind/` 已生成；图片异常时核对 JSON 地址与 CDN GET。页面回滚前确认所引用的媒体仍可访问。

协作与实现约束见 [AGENT.md](AGENT.md)。

Copyright © 2026 doebkblcya。站内原创内容未经授权禁止转载。
