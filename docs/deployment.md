# 部署指南

更新日期：2026-09-09

## 发布架构

```text
Git 仓库
  └── Cloudflare Pages
      ├── www.doebkblcya.com
      └── doebkblcya.com

Cloudflare R2
  └── cdn.doebkblcya.com
      ├── music/
      └── photos/
```

网站本身是 Astro 静态产物。R2 媒体独立发布，不进入 Pages 构建包。

## 本地验证

推荐 Node.js 20 或更高版本，并使用仓库锁定的 pnpm 依赖树。

```bash
pnpm install --frozen-lockfile
pnpm exec astro check
pnpm build
pnpm preview
```

构建脚本执行两个阶段：

1. `astro build` 生成 `dist/`。
2. `pagefind --site dist` 为 zh/en 页面生成搜索索引。

开发服务器不包含 Pagefind 构建产物，文档页会跳过 Pagefind 初始化，因此 `pnpm dev` 下不会请求 `/pagefind/pagefind.js`。全文搜索使用 `pnpm build && pnpm preview` 验证。

## Cloudflare Pages

项目约定：推送 `main` 后触发自动部署。

| 设置 | 值 |
|---|---|
| Production branch | `main` |
| Install | `pnpm install --frozen-lockfile` 或平台自动安装 |
| Build command | `pnpm build` |
| Output directory | `dist` |
| Node.js | 20+ |
| 网站运行时变量 | 无 |

不要把 R2 S3 凭证配置为网站前端变量。媒体 CLI 在本地运行，Pages 构建不需要这些密钥。

### 路由文件

- `src/pages/index.astro` 将根路由重定向到 `/zh/`。
- `public/_redirects` 提供 Pages 层的根路径 301。
- `public/404.html` 将未知路径引导到中文 404 页面。
- `src/pages/[lang]/404.astro` 是完整的站内 404 UI。

`astro.config.mjs` 中的 `site` 用于 canonical 和 sitemap，变更正式域名时必须同步修改。

## 发布前检查

```bash
pnpm exec astro check
pnpm build
git diff --check
```

然后用 `pnpm preview` 检查：

- `/zh/` 和 `/en/`
- 首页展开、返回首页和浏览器前进/后退
- `/zh/docs/` 搜索
- 一篇文档详情与目录
- 音乐跨页播放
- 摄影 Lightbox
- sitemap 文件存在

涉及导航改动时，必须通过页面内链接触发 ClientRouter；直接输入 URL 只能验证完整页面加载。

## R2 媒体

R2 bucket 为 `doebkweb`，公开资源通过 `https://cdn.doebkblcya.com` 访问。

```text
music/<专辑>/cover.jpg
music/<专辑>/<曲目>.mp3
music/<专辑>/<歌词>.lrc
photos/originals/<文件>.jpg
photos/thumbs/<文件>.webp
```

正常上传使用 `pnpm media`，凭证、处理参数和 immutable 约束见 `docs/upload.md`。

R2 CORS 至少允许正式站点执行 `GET`、`HEAD`，并暴露音频 Range 需要的响应头。修改域名时同步更新 AllowedOrigins。

## 缓存

- Astro 的哈希静态资源可以长期缓存。
- 媒体 CLI 上传的 R2 对象使用 `public, max-age=31536000, immutable`。
- 同 URL 的媒体内容不得被覆盖；修改内容时更换文件名并更新数据源。
- R2 自定义域名的 HEAD 缓存状态不适合判断 HIT，校验以 GET/Range 响应为准。

## 回滚

网站发布异常时优先使用 Cloudflare Pages 的历史部署回滚，不修改 DNS。若故障来自媒体数据：

1. 回滚引用该媒体的 Git 提交。
2. 保留已有 immutable 对象，修正后以新文件名重新上传。
3. 再更新 JSON 数据指向新 URL。

## 故障排查

### Pages 构建失败

- 确认安装和构建都使用 pnpm。
- 检查 Node.js 版本。
- 本地运行 `pnpm install --frozen-lockfile && pnpm build`。
- 检查 Content Collections frontmatter 和 i18n 类型错误。

### 搜索不可用

- 确认部署命令是 `pnpm build`，不是只执行 `astro build` 或 `pnpm deploy`。
- 检查 `dist/pagefind/` 是否存在。
- 在 preview/生产环境验证，不在 dev 环境判断。

### 控制台出现 `reportAllChanges` / `startTime`

- 若堆栈来源是 `VM...` 和 `<anonymous>`，先关闭 Chrome DevTools 的 Performance 实时指标并重新加载。
- 该堆栈通常来自 DevTools 注入的 Web Vitals 采集脚本，不是站点打包资源；站点自身没有注册 `reportAllChanges`。
- 只有错误能定位到 `/_astro/` 或仓库源文件时，才按站点运行时故障继续排查。

### 音乐或图片失败

- 检查 `music.json` / `photos.json` URL 与 R2 key 是否一致。
- 检查文件名 URL 编码和对象大小写。
- 检查 R2 CORS、Range 响应和 CDN 状态。
- 不要通过重新上传同名 immutable 对象修复内容。

### 客户端导航状态异常

- 检查只有 audio 与 VinylPlayer 使用 persist。
- 检查页面交互是否在断开时清理。
- 同时验证站内点击、返回和 history 前进/后退。
- 参考 `src/content/docs/vt-bugs.md`。
