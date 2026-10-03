# AI 媒体维护入口

本目录提供 AI 媒体维护说明和本地处理小工具。用户提供素材或专辑名后，AI 完成资料整理、处理、R2 上传、验证和静态数据更新。专辑流程见 [albums.md](albums.md)，摄影流程见 [photos.md](photos.md)，萌宠视频见 [pets.md](pets.md)；项目运行与部署见 [项目 README](../../README.md)。

## 数据与素材约定

- `src/data/albums.json`、`src/data/photos.json` 保存公开图片地址与资料，图片文件不提交 Git。
- R2 bucket：`doebkweb`；公共域名：`https://cdn.doebkblcya.com`。上传直接使用该 bucket 名称；远程删除由站点作者执行。
- 新对象：`albums/<id>/<version>/cover.jpg`、`albums/<id>/<version>/preview.webp`、`photos/<batch>/<序号>-large.jpg` 和 `<序号>-preview.webp`；透明图的大图改用 `-large.webp`。
- `version`/`batch` 使用不重复的日期加版本号，例如 `20260930-v1`；内容修改换新版本，禁止覆盖旧 URL。
- 本地 `materials/inbox/photos/` 可按用户分类放入子目录，也可直接提供现有照片目录；每个分组只含本批照片，逐组处理全部文件，不维护历史、不自动跳过。处理工具不删除、不修改输入。
- 关于页猫咪独立使用 `src/data/pets.json` 与 R2 的 `pets/<version>/<id>/`，摄影清单和展览编排不引用；媒体清单工具同时校验猫咪数据。当前展示待机循环与名字，其他动作资料仅供维护。视频上传后验证类型、字节数和校验值；上传前还要验证透明通道。
- 处理输出和请求 JSON 放被 Git 忽略的 `materials/`；本地图片副本不参与网站构建或展示。

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

必须带 `--remote`，否则可能只操作本地模拟存储。路径、bucket、类型取自本次上传清单。程序执行用 `execFile`/`spawn` 的参数数组，避免把文件名拼进 shell。

上传后对每个公共 URL 实际 GET，确认 HTTP 200、正确 Content-Type、返回字节数等于 `size`，并解码确认尺寸。HEAD 仅供辅助。可用 Node `fetch`、sharp 在本地验证，不依赖网站截图判断上传成功。

上传失败时保留本地原件和派生文件，停止写入本批公开数据并报告失败对象；已有上传成功的对象暂时保留。用户要求重试时按明确的失败项重试，没有历史扫描或自动跳过机制。若 CDN 尚不可访问，等待可访问再改清单。**不要为修复错误自动删除远程对象。**

## 更新清单后的检查

```bash
node maintenance/media/tools/validate-media.mjs
pnpm exec astro check
pnpm build
git diff --check
```

默认完成数据与编译检查后，把预览交给用户手动验收外观和交互。需要检查构建结果时使用 `pnpm preview`；仅在任务明确要求时补充浏览器检查。本次已授权发布就执行发布流程，否则交付本地改动。

## 小工具边界

| 文件 | 作用 |
|---|---|
| `tools/prepare-photos.mjs` | 本分组 RAW/JPEG/PNG → 大图、预览 WebP、含拍摄时间/曝光参数的摄影草稿与上传清单；透明图可保留 alpha |
| `tools/prepare-cover.mjs` | 本地封面 → 1000px JPEG、360px WebP 预览、URL 草稿与上传清单 |
| `tools/images.mjs` | ExifTool 提取、方向处理、sRGB 派生图共享函数 |
| `tools/validate-media.mjs` | 检查静态清单的数据格式、重复项、图片 URL |

图片工具可用 `node --test maintenance/media/tools/images.test.mjs` 验证；测试会调用本机 ExifTool，不操作 R2。

它们只处理本地数据；不抓取、不上传、不修改公开 JSON、不提交或推送。AI 根据文档组合这些步骤。JSON 格式检查无法证明 R2 对象存在，必须另外执行上传后的 GET 校验。

## 完成后的本地清理

确认对象上传、公开数据更新和检查通过后，清理本批查询结果、下载副本、压缩派生图、请求 JSON、草稿、上传回执、日志和一次性脚本，以及 `tmp/` 中的临时产物。

用户原始素材和最终编辑成果默认保留；用户明确要求删除时执行指定范围的本地清理。网站不需要本地媒体副本，不能把保留副本当作运行要求。R2 删除仍由站点作者执行。
