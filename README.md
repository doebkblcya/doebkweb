# doebkweb

个人静态站点 — 程序员名片 + 技术文档 + 摄影画廊 + 唱片架。

基于 [Astro](https://astro.build) 构建，Apple Design 风格，纯静态输出，部署于 Cloudflare Pages。

## 快速开始

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发服务器 → http://localhost:4321
pnpm build          # 生产构建 → dist/
pnpm preview        # 预览构建产物（含 Pagefind 搜索）
```

部署：`git push main` → Cloudflare Pages 自动构建。

## 功能

- **技术文档** — Markdown 管理，Shiki 代码高亮，h4-h6 / kbd / 表格 / 折叠块 / 外部链接标识等完整渲染
- **全文搜索** — Pagefind 构建时索引，文档列表页内嵌下拉搜索，毛玻璃面板，键盘导航
- **音乐播放器** — 黑胶唱片动画，专辑架，跨页持久化（View Transitions），不与页面切换冲突
- **摄影画廊** — 响应式网格，懒加载，Lightbox 全屏预览，键盘左右切换
- **双语切换** — zh/en UI 文案，TypeScript 类型约束中英文一致，文档内容不翻译
- **内容宽度调节** — 齿轮菜单居中弹窗，三档宽度（窄/中/宽），localStorage 持久化

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Astro ^5.6（纯静态生成） |
| 动画 | Motion ^12.11（spring 物理动效） |
| 搜索 | Pagefind ^1.5.2 |
| 代码高亮 | Shiki（github-light 主题） |
| 部署 | Cloudflare Pages + R2 媒体托管 |
| CDN | cdn.doebkblcya.com |

## 目录

```
doebkweb/
├── src/
│   ├── pages/[lang]/      # 路由页面（zh/en 双语言）
│   │   ├── docs/          #   文档系统
│   │   ├── about.astro    #   关于我
│   │   ├── music.astro    #   音乐
│   │   └── photos.astro   #   摄影
│   ├── components/        # 可复用组件
│   │   ├── Sidebar.astro
│   │   ├── VinylPlayer.astro
│   │   └── LanguageSettings.astro
│   ├── layouts/           # 布局
│   ├── content/docs/      # Markdown 文档
│   ├── data/              # 音乐/摄影数据
│   ├── i18n/              # 中英文案
│   └── styles/            # Design Tokens + 全局样式
├── docs/                  # 项目文档
└── public/                # 静态资源
```

## 项目文档

| 文件 | 内容 |
|---|---|
| `docs/requirements.md` | 需求、设计语言、内容策略 |
| `docs/architecture.md` | 目录结构、路由、数据流、CSS 层级 |
| `docs/roadmap.md` | 版本历史、已完成功能、待开发计划 |
| `docs/deployment.md` | 本地开发、Pages 部署、R2 上传 |
| `docs/photos.md` | 照片处理、上传流程、R2 路径规范 |
| `CLAUDE.md` | AI 协作约定 |
