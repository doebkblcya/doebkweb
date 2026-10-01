# 架构说明

更新日期：2026-10-01

## 静态多页面

Astro 5 的 `output: static` 生成 zh/en 独立 HTML，路由保持 `/[lang]/about/`、`docs/`、`music/`、`photos/`。BaseLayout 提供元信息、主题首帧、侧栏、页脚；首页设置 `hideHeader`，保留独立 `<home-hero>` 交互。

导航是普通链接，每个新页面独立加载脚本。已移除 ClientRouter、持久化 audio、VinylPlayer、曲目派生数据和 `window.__vt_*` 全局桥接。页面脚本只负责本页 DOM，无跨页播放状态或交换 DOM 的生命周期兼容逻辑。历史记录 `src/content/docs/vt-bugs.md` 不再代表当前实现。

## 页面转场

内页 head 输出 `@view-transition { navigation: auto; }`，`transitions.css` 将正文与侧栏分开命名。正文离场约 90ms 淡出、入场 280ms 淡入并上移 6px；侧栏保持静态。只动画化透明度与位移，不动画化模糊、不逐项编排内容。首页不输出 opt-in，进出首页为普通导航，避免与 hero 冲突。

浏览器需同时支持且源/目标页均启用跨文档转场。不支持时普通切页，不引入兼容库。`prefers-reduced-motion` 禁用原生转场。转场只负责视觉，不控制导航和业务状态。

## 页面数据与交互

- `albums.json` + `albums.ts`：静态专辑、封面 URL、用户原文乐评、Apple Music 专辑链接和资料来源。唱片页默认“选集”，可切换为完整“唱片架”；搜索/排序只处理唱片架现有 DOM。两种视图共用原生 dialog，在模糊背景上居中展示封面、资料和乐评，无关闭按钮；底部“播放”通过 `appleMusicUrl` 跳转 Apple Music，`sources` 仅供维护核对。支持点击背景、Escape 和焦点返回，长内容在弹层内滚动。
- `AlbumSelection.astro`：只渲染非空乐评候选，封套、CSS 黑胶、名称/艺术家/年份和完整乐评组成一组。页面脚本用 Fisher–Yates 打散候选并选出最多三张；sessionStorage 只保存本标签页上一次展示的 ID 序列，避免相邻重复。初次进入和从唱片架切回时重选，历史缓存返回不重排，阅读中不换作品。
- IntersectionObserver 持续观察当前展示的作品，每次进入视线时触发 CSS 抽出和文字展开，离开视线后复位，滚动回来时重播且不改变顺序；视图切换/页面离开时断开，历史返回时恢复观察。没有持续旋转、轮播或额外动画依赖。减少动态效果时直接显示静态展开状态。
- 专辑列表与唱片中心标签使用 `thumb`（360px WebP）懒加载；选集封套进入视线时升级为 `cover`（1000px JPEG）。详情大图只在打开对应 dialog 时写入 `src`，关闭时移除，隐藏弹层不提前请求大图。无 JS 时显示服务器生成的前三篇乐评和完整唱片架。
- `photos.json` + `photos.ts`：图片 URL、尺寸、拍摄日、alt 和 note。摄影页沿用统一 4:3 缩略图网格，时间线按日期分组；札记只在大图下方以斜体衬线和引号展示；原生 dialog 使用半透明模糊背景，图片和札记整体居中，无边框和关闭按钮，支持点击背景关闭、焦点管理、Escape 和方向键。请求序号防止慢加载旧图片覆盖新图片。
- `about.ts`：关于页正文。
- Content Collections：Markdown 文档和 frontmatter；构建 Shiki 双主题高亮，Pagefind 建立双语索引。
- 文档列表脚本：本页闭包管理搜索防抖、异步结果序号与键盘选择，直接 DOM 日期排序；开发模式不导入 Pagefind。
- 文档详情：普通锚点，滚动时以 rAF 更新目录高亮，无全局导航事件。
- 侧栏：服务器标记当前链接，移动端用 inert 和焦点循环限制关闭抽屉的可达性。
- 设置：侧栏底部同宽文字入口，左对齐、上方细线，无图标和方框；原生 dialog，无关闭按钮，通过点击背景或 Escape 关闭；主题读取 `doebk-theme`（light/dark/auto），页面 head 防首帧闪烁；语言切换普通链接。

设置、专辑和摄影弹层共用 `global.css` 的 `dialog::backdrop`。`tokens.css` 集中定义 `--modal-backdrop-blur: 28px` 与 `--modal-backdrop-bg`（65% 黑色），组件不单独定义遮罩效果。

页面后退缓存恢复时关闭弹窗/抽屉并同步主题；无需恢复共享播放器。

## 本地媒体流程

`maintenance/media/` 放 AI 文档与小工具。sharp 负责派生图，ExifTool 只提取 RAW 内嵌 JPEG 和拍摄日；Wrangler 上传远程 R2。工具不修改公开数据或执行 Git。AI 核对资料与图片、上传并验证对象后，更新网站 JSON，再构建/发布。

R2 已清空，公开媒体数组从空开始。旧专辑名和乐评存放在 maintenance 示例目录中，仅作重新录入参考。静态构建和访客加载不访问外部专辑 API。

## 样式与资源

`tokens.css`、reset、global、prose 与页面 scoped CSS 组成样式体系；转场集中于 `transitions.css`。字体由 Fontsource 自托管。Motion 仅用于现有首页动画，图片和专辑展示不增加动效依赖。

文档、摄影与唱片工具栏的搜索框、图标、排序/视图按钮与移动端换行规则集中在 `global.css`，使用相同字号、内边距和 `aria-pressed` 选中样式。页面只保留工具栏与内容之间的必要间距差异。

内页页头间距由共享 `.page-divider` 维护；紧接工具栏时取消分隔线下方间距及工具栏上边框，共用一条线。唱片架的两层工具栏直接相接，文档列表首行不重复画上边框。

public 保存 UI 素材；R2 保存封面、大图和预览。原始素材、派生输出、Wrangler 状态和凭证不进 Git。
