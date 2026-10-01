# AI 媒体维护入口

音乐模块是**专辑展示**，没有音频上传或播放。更新专辑读 [albums.md](albums.md)，更新摄影读 [photos.md](photos.md)。这些说明和小工具替代旧 `pnpm media` CLI；由 AI 执行整个流程，用户不需要手动改 JSON。

## 当前状态与约定

- 用户已清空 R2。`src/data/albums.json`、`src/data/photos.json` 从空清单重新录入；**禁止恢复旧链接或将尚未上传的 URL 写入公开清单**。
- 原有专辑名称和乐评仅保存在 `examples/previous-albums.json`，供重新查找与复审，不是公开数据。
- R2 bucket：`doebkweb`；公共域名：`https://cdn.doebkblcya.com`。不要新建或清空 bucket，不修改绑定；远程删除由用户手动处理。
- 新对象：`albums/<id>/<version>/cover.jpg`、`albums/<id>/<version>/preview.webp`、`photos/<batch>/<序号>-large.jpg` 和 `<序号>-preview.webp`。
- `version`/`batch` 使用不重复的日期加版本号，例如 `20260930-v1`；内容修改换新版本，禁止覆盖旧 URL。
- 本地 `materials/inbox/` 只放本次照片；工具处理全部文件，不维护历史，不自动跳过。原始素材由用户保留，工具不删除、不修改输入。
- 处理输出和请求 JSON 放 `materials/`，它已被 Git 忽略。网站代码不包含这些素材。

## 准备环境

从仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler --version
exiftool -ver
pnpm exec wrangler whoami
```

Node.js 使用 22.12+。Wrangler 和 sharp 是项目开发依赖；摄影处理还需要本机 ExifTool。缺少 ExifTool 时先报告，按机器的包管理器安装。Wrangler 没有登录时，需要用户完成 `pnpm exec wrangler login` 的账号授权，再继续；已有登录直接使用。凭证不写进 JSON、Git、前端变量或对话输出。

## 两个独立发布步骤

1. **发布对象**：处理本地图片，检查生成结果，用 Wrangler 上传并实际验证 CDN。
2. **发布页面**：对象全部成功后，把已验证 URL 和静态资料写入 JSON，检查和构建，然后按本次任务的发布授权提交/推送。Cloudflare Pages 在 `main` 推送后重新部署。

仅上传 R2 不会让照片出现在网站；只有 JSON 更新并部署后才显示。页面部署不需要 R2 凭证，也不在构建时查专辑 API。

## 上传与校验

处理工具生成 `uploads.json`，每条包含 `key`、本地绝对路径 `file`、`contentType`、`size`。AI 读取这个清单，逐条用参数数组执行 Wrangler，例如：

```bash
pnpm exec wrangler r2 object put 'doebkweb/photos/20260930-v1/001-large.jpg' \
  --file materials/processed/20260930-v1/001-large.jpg \
  --remote --content-type image/jpeg \
  --cache-control 'public, max-age=31536000, immutable'
```

必须带 `--remote`，否则可能只操作本地模拟存储。路径、bucket、类型取自本次清单，不凭记忆拼接旧链接。程序执行用 `execFile`/`spawn` 的参数数组，避免把文件名拼进 shell。

上传后对每个公共 URL 实际 GET，确认 HTTP 200、正确 Content-Type、返回字节数等于 `size`，并解码确认尺寸。HEAD 仅供辅助。可用 Node `fetch`、sharp 在本地验证，不依赖网站截图判断上传成功。

上传失败时保留本地原件和派生文件，停止写入本批公开数据并报告失败对象；已有上传成功的对象暂时保留。用户要求重试时按明确的失败项重试，没有历史扫描或自动跳过机制。若 CDN 尚不可访问，等待可访问再改清单。**不要为修复错误自动删除远程对象。**

## 更新清单后的检查

```bash
node maintenance/media/tools/validate-media.mjs
pnpm exec astro check
pnpm build
git diff --check
```

还要用 build + preview 看页面。检查图片、说明、专辑乐评、搜索、详情弹层、大图和移动布局。本次任务未授权推送时，将已经完成并验证的改动交给用户；已授权发布时执行现有发布流程。

## 小工具边界

| 文件 | 作用 |
|---|---|
| `tools/prepare-photos.mjs` | 本批 RAW/JPEG/PNG → 大 JPEG、预览 WebP、摄影草稿与上传清单 |
| `tools/prepare-cover.mjs` | 本地封面 → 1000px JPEG、360px WebP 预览、URL 草稿与上传清单 |
| `tools/images.mjs` | ExifTool 提取、方向处理、sRGB 派生图共享函数 |
| `tools/validate-media.mjs` | 检查静态清单的数据格式、重复项、图片 URL |

图片工具可用 `node --test maintenance/media/tools/images.test.mjs` 验证；测试会调用本机 ExifTool，不操作 R2。

它们只处理本地数据；不抓取、不上传、不修改公开 JSON、不提交或推送。AI 根据文档组合这些步骤。JSON 格式检查无法证明 R2 对象存在，必须另外执行上传后的 GET 校验。
