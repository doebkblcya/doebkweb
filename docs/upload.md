# 上传指南

站点的内容上传分两类：**媒体资源**（音乐/照片，走 media CLI → R2）和**文档**（Markdown，走 git → Cloudflare Pages）。

---

## 一、媒体上传（media CLI）

`pnpm media` 统一管理音乐与照片的转码、上传、验证与札记。

### 前置

```bash
# 环境变量（~/.zshrc）
# R2 S3 凭证（必填，上传用）。创建：Cloudflare 控制台 → R2 → Manage R2 API Tokens → Create API token（对象读+写）
export CLOUDFLARE_R2_ACCESS_KEY_ID="你的AK"
export CLOUDFLARE_R2_SECRET_ACCESS_KEY="你的SK"
```

媒体文件放入 `_r2-upload/`（已加入 `.gitignore`，不提交 git）。

### 音乐

```bash
# 上传专辑（自动完成以下全部）。目录约定：要么全 mp3 要么全 ncm——
# 全 ncm 时交互询问是否就地转换 mp3（确认后转换+删除 ncm 源，再继续专辑流程）
pnpm media album _r2-upload/music/<专辑名>/

# 单独转换（批量/保留 ncm 源场景；--remove 可选：成功后删除源 ncm）
pnpm media ncm _r2-upload/music/<专辑名>/ --out _r2-upload/music/<专辑名>/ --remove
```

**交互模式**：`pnpm media album`（不带参数）→ 列出 `_r2-upload/music/` 下的专辑目录供选择 → 处理 → 上传前确认。

`media album` 自动：
- **读 ID3 标签**（music-metadata）：曲序 TRCK、标题、艺术家、专辑——ncm 解密产物自带完整 ID3，普通 mp3 同样可靠
- **lrc 按歌名自动匹配**（三级：精确 → 包含 → 未匹配报告）
- **封面**：目录内已有 cover 文件 > ncm 封面区/ID3 内嵌封面 → 统一压缩 `cover.jpg`（1000px q80 mozjpeg）
- **music.json 草稿**：新专辑自动生成条目（交互确认写回）；已有专辑只上传不动数据
- **上传 + 自动验证**（见下）

### 照片

```bash
pnpm media photos <照片目录>
```

`media photos` 自动：
- **识别输入**：RAW（ARW/CR2 等）→ exiftool 提取相机内嵌 JPEG；JPG/JPEG → 直接压缩（断点续传，产物已存在自动跳过）
  - `originals/*.jpg` — 2000px 长边，q85 mozjpeg，复制 EXIF
  - `thumbs/*.webp` — 480px 长边，q80
- **竖图**：按 EXIF orientation 旋转（小图旋转像素、大图保留标签），photos.json 宽高自动交换
- **photos.json 条目**：新增照片自动生成（宽高/拍摄日期从 EXIF 读取，`note` 字段恒存在，交互确认后写回）
- **上传 + 自动验证**（见「上传核心约定」）

**交互模式**：`pnpm media photos`（不带参数）→ 列出 `_r2-upload/photos/` 下含 RAW/JPG 的目录供选择 → 处理 → 上传前确认。

常用参数：

```bash
pnpm media photos <照片目录> --no-upload    # 只转码 + 生成条目，不上传
```

图片规格：

| | 格式 | 长边 | 质量 | 单张大小 |
|---|---|---|---|---|
| 缩略图 | WebP | 480px | 80 | ~20KB |
| 大图 | JPEG | 2000px | 85 | ~300KB |

札记：`pnpm media review --photo <src|序号> "拍摄说明"`（或交互式）

前置：`sudo pacman -S perl-image-exiftool`

### 札记

```bash
pnpm media review                                # 交互式（音乐/摄影）
pnpm media review --music <专辑名> "文字"          # 参数式（空 = 清空）
pnpm media review --photo <src|序号> "文字"
```

写入 `src/data/music.json`（`review`）或 `src/data/photos.json`（`note`）。

### 上传核心约定

- **缓存头**：所有对象（含 LRC）统一带 `cache-control: public, max-age=31536000, immutable`——内容变 → **换文件名上传**，不改同名文件
- **S3 直连**：上传走 S3 API（`r2.cloudflarestorage.com`，SigV4 签名），不走系统代理；并发 6，失败重试 ×2
- **multipart 分片**：>5MB 文件自动 multipart（5MB 分片并发上传）——v4 API 无 multipart 且单连接被 BDP 限制（~1MB/s），分片是突破慢速的关键
- **自动验证**：HEAD 断言（200 + cache-control）→ GET Range ×2 断言边缘缓存 HIT；长度从 206 响应的 `Content-Range` 解析（lrc 为 text/plain 会被 CF 压缩，HEAD 无 content-length）

### 缓存行为说明

| | immutable 头（浏览器缓存） | Cloudflare 边缘缓存 |
|---|---|---|
| MP3 / 封面 / 照片 | ✓ 缓存一年 | ✓ HIT |
| LRC（.lrc） | ✓ 缓存一年 | ✗ 不缓存（.lrc 扩展名不在 CF 默认缓存列表，回源 32B 无成本，接受） |

验证注意：**R2 自定义域 HEAD 请求恒返回 `cf-cache-status: DYNAMIC`**（R2 特性）——检查缓存状态必须读 GET 响应头，不能用 `curl -sI`。

### wrangler 兜底

```bash
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY   # 大文件上传必须关代理

wrangler r2 object put "doebkweb/music/<专辑>/<文件>" --file=./原文件 --remote \
  --cache-control "public, max-age=31536000, immutable"
```

> 不带 `--remote` 走本地模拟模式，文件不会到达远端 R2。

### 数据文件

| 文件 | 内容 |
|---|---|
| `src/data/music.json` | 专辑唯一数据源（`review` 札记、`trackNo` 曲序、`lrc` 关联） |
| `src/data/photos.json` | 照片唯一数据源（`note` 札记、宽高、日期） |
| `src/data/photos.ts` | Photo 类型 + 薄导出层 |

---

## 二、文档上传（git 流程）

文档**不走 R2、不走 CLI**——Markdown 提交 git，Cloudflare Pages 自动构建。

```bash
# 1. 放文件
src/content/docs/<slug>.md

# 2. 填 frontmatter
---
title: "文档标题"          # 必填
date: 2026-08-03           # 必填，决定列表倒序
summary: "一句话摘要"       # 必填，列表卡片显示
updated: 2026-08-05        # 可选，详情页"更新于"
draft: false               # 可选，true = 构建完全跳过（草稿）
listed: true               # 可选，false = 不进列表且不生成详情页（about.md 用法）
---

# 3. 本地验证
pnpm dev                   # → http://localhost:4321/zh/docs/<slug>/

# 4. 提交部署
git add src/content/docs/<slug>.md
git commit -m "..."
git push main              # → Pages 自动构建
```

要点：
- 内容不翻译（i18n 只翻 UI 文案）
- 无分类字段；搜索由构建时 Pagefind 自动索引
