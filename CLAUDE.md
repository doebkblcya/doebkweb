# CLAUDE.md — doebkweb

个人静态技术站点：求职名片 + 技术文档知识库。Astro 静态生成，Apple Design 风格。

**CLAUDE.md 保持简洁，详细文档在 `docs/` 目录下。**

- **禁止 Read 图片文件**：我不是多模态模型，Read 截图/PNG/JPG 只会返回 `[Unsupported Image]`，没有任何信息增量。截图只能给人看，对我没用。验证视觉效果用 Playwright accessibility snapshot（DOM 结构/文字/状态都能确认），截图直接跳过。

- **Playwright 效率**：
  - `browser_snapshot` 返回的是 YAML 文本（可访问性树），我能读，用来验证 DOM/文字/状态。`browser_take_screenshot` 返回 PNG，我**不能读**，别用。
  - **合并操作用 `browser_run_code_unsafe`**：不要 type → wait → snapshot 拆成 3 个 tool call 各等一个往返。一把梭写成 Playwright 脚本，一次调用完成连续操作 + 等待 + 返回文本结果。省掉 3-5 个 agent 往返。
  - 验证结果用 `browser_evaluate` 返回布尔/字符串，比 snapshot 取整页 YAML 轻量。

## 命令

```bash
pnpm dev       # → http://localhost:4321
pnpm build     # → dist/
pnpm preview   # 本地预览构建产物
```

部署：`git push main` → Cloudflare Pages 自动构建。

## 技术栈

Astro ^5.6 · Motion ^12.11 · Pagefind · Shiki 代码高亮 · Cloudflare Pages + R2（`cdn.doebkblcya.com`）

## 关键约定

- **纯静态输出**，无后端，无数据库
- **Design Tokens**：`src/styles/tokens.css` 管所有颜色/间距/字体，换肤只改这一个文件。`:root` = 亮色，`[data-theme="dark"]` = 暗色
- **主题（三段式 浅色/深色/自动）**：状态 = `localStorage["doebk-theme"]`（light/dark/auto，缺省 auto）+ `<html data-theme>`（有效主题，驱动 CSS）+ `<html data-theme-mode>`（用户模式，驱动 UI）。FOUC 防护在 BaseLayout head 内联脚本（首帧前设属性，VT 下不重跑）；状态变更唯一入口 `window.__vt_setTheme(mode)`（Sidebar persist 脚本定义，写存储 + 属性 + `syncThemeUI` chips/图标联动 + auto 挂 matchMedia 监听）。**VT 交换会清掉 html 运行时属性**——`astro:after-swap` 处理器里调 `__vt_applyTheme()` 恢复（勿移除）。组件 scoped 样式里引用 `[data-theme="dark"]` 必须用 `:global()` 包裹（否则被加 astro-cid 前缀永不匹配）；Shiki 双主题 `defaultColor: false` 只出 `--shiki-light/dark*` 变量，切换 CSS 在 prose.css
- **i18n**：`src/types/i18n.ts` 定义 `UIStrings` 接口 → `zh.ts` / `en.ts` 实现。文档内容不翻译，只翻译 UI 文案
- **Content Collections**：Markdown 放 `src/content/docs/`，frontmatter 必填 `title`、`date`、`summary`；可选 `updated`、`draft`、`listed`（schema 见 `src/content/config.ts`，无 `category` 字段）
- **媒体资源**：大文件走 R2（`cdn.doebkblcya.com`），小文件放 `public/`
- **动画**：简单交互用 CSS transition，spring 物理动效用 Motion 库。`prefers-reduced-motion` 降级为 opacity
- **音乐**：`src/data/music.json` 是唯一数据源，加专辑只改这一个文件（曲序用 `trackNo` 字段，数据层排序，数组书写顺序不承担语义）
- **响应式**：断点 **640px** 是手机分界（≤640：汉堡抽屉接管侧栏、播放器全宽面板；≥641：完整侧栏）。播放器面板有 `max-height: calc(100vh - var(--space-6))` + 内部滚动限高，勿移除。汉堡交互在 Sidebar.astro（`#nav-trigger` / `#nav-mask`），走 `window.__vt_toggleNav/CloseNav`（inline onclick，VT-safe），切页由 `astro:after-swap` 重置。docs 列表页通栏铺满为设计决定，勿加限宽
- **View Transitions**：VT 只替换 DOM，不执行 body 内 `<script>` → 切页回来后所有 `addEventListener` 丢失。**所有非 persist 元素的交互必须用 inline HTML 属性。**
  - **`onclick=""`**：页面交互的唯一入口。逻辑全部放在 `window.__vt_xxx` 全局函数中，函数内每次 `document.getElementById` 取最新 DOM，不依赖闭包。
  - **`document` 级监听**（keyboard）：存 `window.__vt_xxx`，每次脚本执行先 `removeEventListener` 旧函数再 `addEventListener` 新函数。
  - **persist 组件**（VinylPlayer、Sidebar）：`dataset.ready` 防重入。每页都必须渲染（首页用 CSS 隐藏）。
  - `pnpm dev` 无法测试 Pagefind 搜索，需 `pnpm build && pnpm preview`

## 详细文档

| 文件 | 内容 |
|---|---|
| `docs/requirements.md` | 需求、设计语言、内容策略、约束 |
| `docs/architecture.md` | 目录结构、路由、数据流、CSS 层级、事件总线 |
| `docs/deployment.md` | 本地开发、Pages 部署、R2 上传、DNS、故障排查 |
| `docs/roadmap.md` | 版本历史、已完成功能、待开发计划 |
| `docs/photos.md` | 照片处理脚本、上传流程、R2 路径规范 |
