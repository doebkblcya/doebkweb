# 摄影模块 — 图片处理与上传

## 图片规格

| | 格式 | 长边 | 质量 | 单张大小 |
|---|---|---|---|---|
| 缩略图 | WebP | 480px | 80 | ~20KB |
| 大图 | JPEG | 2000px | 85 | ~300KB |

原图：相机 RAW（6192×4128 或 4128×6192），约 30–40MB。

缩略图用于网格展示，大图用于 Lightbox 全屏预览。

## 处理流程

### 1. 安装依赖

```bash
sudo pacman -S perl-image-exiftool
```

### 2. 准备 RAW 文件

将 RAW 文件放入 `_r2-upload/photos/raw/`（此目录已加入 `.gitignore`）。

### 3. 运行脚本

```bash
pnpm process-photos _r2-upload/photos/raw _r2-upload/photos
```

脚本会依次：
1. `exiftool` 从 RAW 提取相机内嵌的全分辨率 JPEG
2. `sharp` 旋转缩放 → `originals/*.jpg`（2000px）
3. `sharp` 旋转缩放 → `thumbs/*.webp`（480px）

已存在的输出文件自动跳过，支持断点续传。

### 4. 上传 R2

```bash
cd _r2-upload/photos

# 上传大图
for f in originals/*.jpg; do
  wrangler r2 object put "doebkweb/photos/$f" --file="$f" --remote
done

# 上传缩略图
for f in thumbs/*.webp; do
  wrangler r2 object put "doebkweb/photos/$f" --file="$f" --remote
done
```

> **注意**：上传前需关闭代理：`unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY`

### 5. 添加数据条目

编辑 `src/data/photos.ts`，为每张照片添加一条记录（`Photo` 接口：`date` 必填，`note` 可选）：

```ts
{
  src:   `${R2_PHOTOS}/originals/IMG_0001.jpg`,
  thumb: `${R2_PHOTOS}/thumbs/IMG_0001.webp`,
  alt:   "照片描述",
  width: 2000,
  height: 1333,
  date:  "2026-07-25T19:44:41",
  note:  "拍摄说明（可选）",
}
```

### 6. 验证

```bash
pnpm dev
```

打开 `http://localhost:4321/zh/photos/` 确认照片正常显示，点击照片验证 Lightbox 大图。

## R2 目录结构

```
doebkweb/
└── photos/
    ├── originals/    ← JPEG 大图（2000px 长边）
    └── thumbs/       ← WebP 缩略图（480px 长边）
```

CDN 访问路径：`https://cdn.doebkblcya.com/photos/originals/<文件名>` 和 `.../thumbs/<文件名>`。
