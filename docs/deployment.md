# 部署指南

更新日期：2026-09-30

## 发布架构

Astro 静态 HTML → Cloudflare Pages（`www.doebkblcya.com`/`doebkblcya.com`）；封面与摄影派生图 → R2 `doebkweb` → `cdn.doebkblcya.com`。两者独立发布，图片不进入 Pages 包。

推送 `main` 触发现有 Pages 自动部署。安装 `pnpm install --frozen-lockfile`，构建 `pnpm build`，产物 `dist`。Node.js 使用 22.12+；网站无运行时密钥或后端变量。

```bash
pnpm install --frozen-lockfile
node maintenance/media/tools/validate-media.mjs
pnpm exec astro check
pnpm build
pnpm preview
git diff --check
```

`build` 和 `deploy` 脚本都执行 Astro 构建与 Pagefind 索引。开发模式没有索引，不加载 `/pagefind/pagefind.js`。

## 页面检查

查看 zh/en 首页、展开/收回、内页之间的链接跳转、前进/后退、主题/语言、文档搜索和目录。专辑检查搜索和详情；摄影检查两个视图、自然比例、大图和加载失败。手机检查抽屉、弹窗焦点及溢出。转场由浏览器提供，不支持时普通导航是正常结果。

`astro.config.mjs` 的 `site` 控制 canonical/sitemap。`public/_redirects` 提供根路由 301，静态 404 页面引导中文 404。

## R2 与缓存

R2 已由用户清空后重新录入，公开清单只保留已验证的新对象。上传流程见 [媒体入口](../maintenance/media/README.md)，AI 用 Wrangler `--remote` 上传、实际 GET 校验成功，再修改 JSON。远程清理由用户执行，网站维护不自动删除对象。

新路径为 `albums/<id>/<version>/cover.jpg` 和 `photos/<batch>/<序号>-large.jpg`/`<序号>-preview.webp`。对象缓存 `public, max-age=31536000, immutable`；改图使用新版本路径，避免重用被清空前的旧路径。普通 `<img>` 展示不需要音频 Range 或播放器 CORS 逻辑。

## 故障与回滚

- 构建失败：本地复现 frozen install、类型检查与 build；检查 frontmatter、JSON 和 i18n。
- 搜索失败：确认执行包含 Pagefind 的构建，`dist/pagefind/` 存在，使用 preview 验证。
- 图片失败：核对 JSON、上传清单、对象大小写和 CDN GET。未上传/不可访问的对象不写入公开数据，不覆盖同名 immutable 对象。
- 页面发布失败：优先回滚 Pages 历史部署。媒体记录错误则修正 Git 数据，必要时新版本上传，不自动删 R2 对象。R2 重置后不要回滚到依赖已删除媒体的旧版本。
- 交互异常：用普通页面加载和前进/后退复现；当前没有 ClientRouter 或持久化播放器。
