# 内容与媒体更新

更新日期：2026-09-30

媒体维护入口是 [maintenance/media/README.md](../maintenance/media/README.md)。未来 AI 接到任务后先读入口，再读对应操作文档，完成处理、上传、校验、数据写回和任务已授权的发布。用户不需要操作独立 CLI 或手改 JSON。

- [专辑录入与封面上传](../maintenance/media/albums.md)：专辑名 → AI 查找 → 用户复审/提供乐评 → 处理并上传封面 → 静态 `albums.json`。
- [摄影上传](../maintenance/media/photos.md)：本批目录 → JPEG 或 RAW 内嵌 JPEG → 大图/预览 → R2 → 静态 `photos.json`。

R2 本轮已清空后从空清单重新录入。旧资源不再引用；只有新资源上传并确认可访问后才添加页面数据。原始素材留本地，图片和凭证不提交。

## 技术文章

文章写入 `src/content/docs/*.md`，frontmatter：

```yaml
---
title: "文章标题"
date: 2026-09-30
summary: "一句话概述"
# updated: 2026-10-01
# draft: true
# listed: false
---
```

当前 `draft: true` 和 `listed: false` 都不生成详情路由。正文保持原语言，不机器翻译。运行类型检查、build，使用 preview 验证正文/目录/搜索；提交并按发布授权推送。关于页改 `src/data/about.ts`，UI 文案同时更新 zh/en 及类型。
