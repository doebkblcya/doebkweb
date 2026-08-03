# CLAUDE.md — doebkweb

个人静态技术站点 — 程序员名片 · 技术文档知识库 · 摄影画廊 · 唱片架。Astro 静态生成，Apple Design 风格。

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
- **Motion 约定**（v1.5，vanilla `motion` 包，import { animate, spring, inView } from "motion"）：
  - **transform 所有权**：被 JS 动画接管的属性（transform/opacity）必须从该元素 CSS 移除 transition——否则 CSS transition 与 JS 内联值互相干扰。CSS 只留基础态值（首帧正确），JS 动画结束清 inline 落回 CSS
  - **class 切换与动画时序**：CSS 无 transition 时 class 切换瞬时生效（如 `.open` 置终值），Motion 读当前值会读到**目标值**导致 from==to 无动画（打开动画硬切）——动画前必须先设 inline 初值（显式 from），动画结束清 inline 落回 class。面板/抽屉/设置弹窗均踩过此坑（v1.5 修复）
  - **清理时序**：Motion 完成时终值写回 inline 晚于 `finished` resolve——`finished.then` 里需 `requestAnimationFrame` 延迟一帧再清（否则残留如 `translateX(-100%)` 在桌面断点无 CSS transform 时会移出屏）
  - **`reduceMotion: true`**（vanilla 选项；`reducedMotion: "user"` 是 React MotionConfig 的 props，vanilla animate 无此字段）——每处动画都加，系统偏好下自动降级为纯 opacity 淡入
  - **`define:vars` 脚本内联输出，不能 import**——动画逻辑放独立 `<script>` 块（打包 module），主脚本经 `window.__vt_xxx` 桥接调用（例：VinylPlayer 的 `__vt_panelAnimate`）
  - persist 组件脚本只在首载执行一次；页面级脚本每次 VT 导航重跑 → 入场动画（inView + stagger）天然切页重放
- **音乐**：`src/data/music.json` 是唯一数据源，加专辑只改这一个文件（曲序用 `trackNo` 字段，数据层排序，数组书写顺序不承担语义）
- **响应式**：断点 **640px** 是手机分界（≤640：汉堡抽屉接管侧栏、播放器全宽面板；≥641：完整侧栏）。播放器面板有 `max-height: calc(100dvh - var(--space-6))`（vh fallback 在前）+ 内部滚动限高，勿移除。汉堡交互在 Sidebar.astro（`#nav-trigger` / `#nav-mask`），走 `window.__vt_toggleNav/CloseNav`（inline onclick，VT-safe），切页由 `astro:after-swap` 重置。iOS Safari 全高元素（sidebar/播放器面板/TOC）用 `100dvh`（100vh 含地址栏，底部内容被遮）。docs 列表页通栏铺满为设计决定，勿加限宽
- **View Transitions**：VT 只替换 DOM，不执行 body 内 `<script>` → 切页回来后所有 `addEventListener` 丢失。**所有非 persist 元素的交互必须用 inline HTML 属性。**
  - **`onclick=""`**：页面交互的唯一入口。逻辑全部放在 `window.__vt_xxx` 全局函数中，函数内每次 `document.getElementById` 取最新 DOM，不依赖闭包。
  - **元素级 `addEventListener` 一律禁止**（非 persist 元素）——齿轮/遮罩/navList hover 均踩过（v1.5.1）：侧栏每页重建后监听器绑在旧元素，新元素点击无响应（用户实测"刷新才能恢复"）。交互必须 inline onclick + window 函数；document 级监听（keyboard/after-swap 等）存 `window.__vt_xxx`，每次脚本执行先 `removeEventListener` 旧函数再 `addEventListener` 新函数，否则累积。**去掉某元素的 persist 时，必须 grep 审计该子树内所有元素级 addEventListener**。
  - **persist 组件**（VinylPlayer）：`dataset.ready` 防重入。每页都必须渲染（首页用 CSS 隐藏）。**Sidebar 不 persist**——文案/href 随语言渲染，persist 会保留旧语言 DOM 导致切语言不更新；VT 交换重建侧栏，状态由 `astro:after-swap` 兜底（抽屉复位/滑块定位/主题恢复）。
  - `pnpm dev` 无法测试 Pagefind 搜索，需 `pnpm build && pnpm preview`

## 详细文档

| 文件 | 内容 |
|---|---|
| `docs/requirements.md` | 需求、设计语言、内容策略、约束 |
| `docs/architecture.md` | 目录结构、路由、数据流、CSS 层级、事件总线 |
| `docs/deployment.md` | 本地开发、Pages 部署、R2 上传、DNS、故障排查 |
| `docs/roadmap.md` | 版本历史、已完成功能、待开发计划 |
| `docs/upload.md` | 上传指南：媒体 CLI（photos/album/ncm/review）+ 文档 git 流程 |
