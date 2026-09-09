# 内容与媒体上传

更新日期：2026-09-09

网站内容分两条发布路径：媒体通过本地 CLI 上传 R2，代码和文章通过 Git 发布到 Cloudflare Pages。

## 安全约束

- 不提交 R2 凭证、API Token、原始媒体或 `_r2-upload/`。
- 不在命令记录、文档和截图中暴露密钥。
- 公开文章不得包含真实密码、私有地址、内网域名、机器名或个人身份路径。
- 媒体对象使用 immutable 缓存；内容改变必须更换文件名。

## 媒体 CLI

入口：

```bash
pnpm media <photos|album|ncm|review> [参数]
```

### 凭证

从 Cloudflare R2 创建具有目标 bucket 对象读写权限的 S3 API Token，在本地 shell 环境提供：

```bash
export CLOUDFLARE_R2_ACCESS_KEY_ID="..."
export CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
export CLOUDFLARE_ACCOUNT_ID="..."   # 可选；脚本有项目默认值
```

不要把值写入仓库文件。上传前确认 `exiftool` 在 PATH；图片处理依赖仓库中的 `sharp`。

### 工作目录

```text
_r2-upload/
├── music/<专辑>/
└── photos/<批次>/
```

该目录已在 `.gitignore` 中。

## 上传专辑

```bash
pnpm media album _r2-upload/music/<专辑>/
pnpm media album _r2-upload/music/<专辑>/ --no-upload
```

不传目录时，CLI 会列出 `_r2-upload/music/` 中可用的专辑。

处理流程：

1. 扫描 MP3/NCM；专辑目录不要混放两种源格式。
2. NCM 目录可以交互转换为 MP3。
3. 读取 ID3 的曲名、艺术家、专辑与 TRCK。
4. 选择目录封面或内嵌封面，生成 `cover.jpg`。
5. 按文件名匹配 LRC。
6. 新专辑经确认后写入 `src/data/music.json`；已有专辑不重复写入。
7. 上传并校验 R2 对象。

`trackNo` 是最终曲序。上传后检查 JSON 中的标题、艺术家、曲序和文件名，不依赖原始数组顺序。

## 转换 NCM

```bash
pnpm media ncm <文件或目录> [--out <目录>]
pnpm media ncm <文件或目录> --out <目录> --remove
```

`--remove` 只在成功转换后删除源文件。执行前确认输入和输出路径，重要源文件应另有备份。

## 上传照片

```bash
pnpm media photos _r2-upload/photos/<批次>/
pnpm media photos _r2-upload/photos/<批次>/ --no-upload
```

不传目录时，CLI 会扫描 `_r2-upload/photos/`。

处理流程：

1. RAW 通过 exiftool 提取预览 JPEG；JPG/JPEG 直接处理。
2. 生成约 2000px 长边、q85 的 JPEG 大图。
3. 生成约 480px 长边、q80 的 WebP 缩略图。
4. 读取拍摄日期、方向和尺寸。
5. 经确认后向 `src/data/photos.json` 添加条目。
6. 上传 `photos/originals/` 与 `photos/thumbs/` 并校验。

上传后补充有意义的 `alt` 和可选札记，不保留无意义的自动描述。

## 编辑札记

```bash
pnpm media review
pnpm media review --music <专辑名> "文字"
pnpm media review --photo <src片段或序号> "文字"
```

音乐札记写入 `music.json` 的 `review`，摄影札记写入 `photos.json` 的 `note`。空文本用于清空。

## 上传实现

- S3 SigV4 直连 Cloudflare R2。
- 小文件单次 PUT；大于 5 MiB 使用 multipart。
- 失败最多重试三次。
- 对象统一写入 `public, max-age=31536000, immutable`。
- 上传后检查状态、cache-control、大小和 GET/Range 响应。

如确需绕过 CLI，可使用 wrangler：

```bash
wrangler r2 object put "doebkweb/<key>" \
  --file=<本地文件> \
  --remote \
  --cache-control "public, max-age=31536000, immutable"
```

缺少 `--remote` 时操作的是本地模拟 bucket。

## 发布技术文章

文章路径：

```text
src/content/docs/<slug>.md
```

Frontmatter：

```yaml
---
title: "文档标题"
date: 2026-09-09
summary: "一句话摘要"
updated: 2026-09-09  # 可选
draft: false         # 可选，默认 false
listed: true         # 可选，默认 true
---
```

当前路由逻辑中：

- `draft: true`：不进入列表，不生成详情页。
- `listed: false`：同样不进入列表，也不生成详情页。
- 文档正文不翻译；同一内容在 zh/en UI 下展示。

发布流程：

```bash
pnpm exec astro check
pnpm build
pnpm preview
git add src/content/docs/<slug>.md
git commit -m "docs: ..."
git push origin main
```

Pagefind 只在 build 后生成，因此新增文章必须检查 preview 中的搜索结果。

## 发布数据修改

CLI 写回 JSON 后，媒体已经在 R2，但网页仍需 Git 部署才能引用新数据：

```bash
pnpm exec astro check
pnpm build
git diff -- src/data/music.json src/data/photos.json
git add src/data/music.json src/data/photos.json
git commit -m "content: update media"
git push origin main
```

只暂存实际发生变化的数据文件，不要使用宽泛命令把 `_r2-upload/` 或临时文件带入提交。
