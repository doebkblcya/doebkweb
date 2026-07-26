---
title: "从零搭建静态博客"
date: 2026-07-22
category: "frontend"
summary: "使用 Astro 从零搭建一个纯静态博客的完整过程记录。"
---

## 为什么选择 Astro

Astro 是一个现代的静态站点生成器，核心理念是"默认零 JS"。它支持多种前端框架混用，但最终输出的是纯静态 HTML。

选 Astro 的理由：

1. **Content Collections** — Markdown 内容管理，frontmatter 类型安全
2. **内置 i18n** — 国际化路由开箱即用
3. **组件化** — `.astro` 单文件组件，模板和样式在一起
4. **构建产物干净** — 纯 HTML + CSS，无 JS 运行时开销

## 项目结构

```
src/
├── content/docs/     # Markdown 文档
├── components/       # 可复用组件
├── layouts/          # 页面布局
└── pages/            # 路由页面
```

## 关键决策

### Design Tokens

使用 CSS 自定义属性集中管理所有视觉参数。颜色、间距、字体、阴影全部通过 token 引用，换肤只需改变量值。

### 侧边栏

折叠式侧边栏，鼠标 hover 时展开。左右各一个，左栏导航，右栏工具。

### Markdown 驱动

关于我也是一篇 Markdown 文档。统一的内容管线意味着添加新页面和写一篇新文章一样简单。

## 部署

`pnpm build` 输出 `dist/`，rsync 到 VPS，Nginx 直出静态文件。无后端、无数据库、无运维负担。
