---
title: "关于我"
date: 2026-07-23
summary: "全栈工程师，关注前端工程化与分布式系统"
draft: false
listed: false
---

你好，我是 doebkblcya，目前在杭州做全栈开发。日常工作涵盖 React 前端、Node.js 后端，以及部分 Rust 基础设施。喜欢把折腾过的技术问题整理成文档，这也是这个站点存在的理由。

## 技术栈

**日常主力**：TypeScript（前端 + 全栈）、Python（脚本 + 数据处理）、Go（CLI 工具）、Rust（学习阶段，主力做编译相关工具）

**前端**：React + Next.js 为主。近两年在团队内推了 Server Components 和 Streaming SSR 的落地，把首屏 TTFB 从 1.2s 压到了 180ms。组件库用的自研设计系统，基于 Radix 做无样式原语，外观按 Figma token 驱动。样式方案从 CSS Modules 迁到了 Tailwind，再迁到了 Panda CSS — 每一轮都有血泪教训。

**后端**：Node.js 写业务层，Express 为主，部分新服务迁到了 Fastify。偏好 PostgreSQL + Prisma 的组合，缓存层用 Redis。有 GraphQL 切 REST 的经历，核心教训是：除非你的前端团队真的需要组合查询，否则 REST + 类型生成（如 tRPC）更实际。

**基础设施**：Docker 做本地开发环境统一，GitHub Actions 跑 CI/CD。服务器用 Ubuntu，Nginx 做反向代理。玩过一阵子 Kubernetes，结论是中小团队用 Docker Compose + 云服务更合适。

## 做过的事

**2024-2026 / 某 SaaS 公司前端团队**。加入时只有一个 Create React App 搭的单体应用，构建时间 4 分钟。半年内把它拆成了 TurboRepo monorepo，共享包独立发布，CI 构建降到 45 秒。主导了 RSC 迁移的 PoC，说服了技术负责人采用混合渲染策略：营销页面静态生成、控制台 CSR、报表页面 SSR streaming。

期间写过一个关键的小工具：把 Figma 的 design tokens JSON 自动转成 TypeScript 类型和 CSS 变量，省掉了设计师与前端之间"改颜色靠截图标注"的沟通成本。目前在 GitHub 上有 1.2k star。

**2022-2024 / 初创公司全栈**。三个人从零搭了一个内部协作平台，用户认证、RBAC 权限、WebSocket 实时通知、仪表盘图表全是我一个人写的。最大的教训是：不成熟的数据库设计会在三个月后反噬你。重构了两次 schema migration 策略才稳定下来。

用了 PostgreSQL 的 row-level security 来简化权限逻辑，省掉了一大坨中间件代码。那段时间对 SQL 的理解上了一个台阶 — 之前总是 ORM 一把梭，后来才意识到窗口函数和 CTE 在报表场景下有多好用。

**业余项目**：维护了一个 Astro 主题模板，做技术写作的人用。写了一个 VS Code 插件，在保存 Markdown 时自动优化 frontmatter 格式和 frontmatter schema 校验。还有一些零散的 Rust 小工具，主要是文件批处理和日志解析。

## 关于本站

这个站点用 Astro 构建，部署在 Cloudflare Pages。所有技术文档以 Markdown 管理，音乐和摄影内容走 Cloudflare R2 + CDN。

选 Astro 的原因很实际：我需要 Markdown 原生支持、零 JS 交付静态页面、以及双语路由，Astro 的 Content Collections 和 i18n routing 刚好覆盖。用了一个月跑通了从本地 Markdown 到线上部署的完整流程。

搭建这个站点的底层动力是：有一个完全属于自己的写作空间。不依赖第三方平台、不面向算法优化、纯纯地记录和整理。

## 联系

- **GitHub**：[github.com/doebkblcya](https://github.com/doebkblcya)
- **邮箱**：doebkblcya@gmail.com

简历按需提供，暂时不直接公开下载。
