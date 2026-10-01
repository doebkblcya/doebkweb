# 摄影处理、上传与记录

先阅读 [README.md](README.md)。用户把**本次全部照片**放入 `materials/inbox/`。约定目录仅包含本批 RAW/JPEG/PNG，不递归扫描，不判断是否上传过；同一照片选择 RAW、JPEG 或 PNG 一份输入，避免重复展示。

## 图片处理

- JPEG/PNG：直接生成网页派生图，不做 RAW 转码。
- RAW：ExifTool 提取 `JpgFromRaw`、`PreviewImage`、`OtherImage`、`ThumbnailImage` 中可解码的 JPEG，选像素面积最大的一张。默认长边至少 1600px；没有合格预览就停止并报告，请用户提供导出的 JPEG。不会偷偷改用 RAW 解码。
- 内嵌 JPEG 是相机已经处理好的预览，包含相机的色彩、锐化等效果；这里不做曝光、白平衡或镜头的 RAW 显影调整。
- 根据 JPEG 自身方向或 RAW 方向校正旋转/镜像，再生成 sRGB 图片。网页文件移除 EXIF/GPS，原始素材始终留在本地。
- 大图：JPEG，默认长边不超过 2400px，质量 88，用于点开查看。
- 预览：WebP，默认长边不超过 960px，质量 80。二者都保持比例、不放大。

## 执行步骤

1. 检查原件、文件数量和 ExifTool 环境；确认当前批次的文件夹。不要移动/删除用户原始素材。
2. 创建 `materials/photo-request.json`，例如：

```json
{
  "batch": "20260930-v1",
  "input": "materials/inbox",
  "annotations": {
    "DSC0001.NEF": {
      "alt": "傍晚的河岸，远处有一座桥",
      "note": "用户提供的拍摄札记"
    },
    "DSC0002.JPG": {
      "date": "2026-09-29",
      "alt": "雨后街道的灯光倒影"
    }
  }
}
```

3. 执行：

```bash
node maintenance/media/tools/prepare-photos.mjs materials/photo-request.json
```

4. 输出在 `materials/processed/<batch>/`：每张大图/预览、`photos.draft.json`、`uploads.json`。查看照片确认方向、色彩、清晰度、比例，再核对草稿中的拍摄日期和说明。
5. 工具从 `DateTimeOriginal` 取相机拍摄日，不用文件修改时间代替。没有日期时使用明确填写的逐张 `date` 或请求的 `defaultDate`；还不知道就询问用户。输入仅有拍摄日，清单统一保存 `YYYY-MM-DD`，不因服务器时区变化跨日。
6. `alt` 必须是对照片内容的简洁描述，AI 看过照片后填写；不能用文件名充数。`note` 是用户札记，没有就省略。工具允许空 alt 草稿，公开清单校验会阻止发布。
7. 用 Wrangler 上传 `uploads.json` 中的全部对象，按 README 做 GET、字节数和解码检查。本批全部成功后才将草稿追加到 `src/data/photos.json`。
8. 执行数据校验、类型检查和构建；预览照片墙、时间线、搜索、大图及前后切换，按本次发布授权推送。仅上传图片不会更新网站。

## 请求参数

`batch` 是唯一的新版本名称（小写英文字母/数字/连字符）；`input` 是当前批目录。可选 `output` 指定独立且不存在的输出目录，不能包含输入或被输入包含；工具不会向输入目录写文件。

还可指定 `largeEdge`、`largeQuality`、`previewEdge`、`previewQuality`、`minimumRawEdge`。没有特殊需求采用默认值。不要为了通过检查把只有小缩略图的 RAW 当作大图发布。

失败时没有完成的上传清单不用于上传；检查报错后，清理/更换本地派生输出目录再重做。工具处理全部本批文件，不做历史自动跳过。

## 摄影数据格式

```json
{
  "src": "https://cdn.doebkblcya.com/photos/20260930-v1/001-large.jpg",
  "thumb": "https://cdn.doebkblcya.com/photos/20260930-v1/001-preview.webp",
  "alt": "傍晚的河岸，远处有一座桥",
  "width": 2400,
  "height": 1600,
  "date": "2026-09-29",
  "note": "用户提供的拍摄札记"
}
```

示例 URL 不能直接发布。`width`/`height` 取**校正方向后网页大图**的实际尺寸，供等比布局使用。预览与大图来自同一输入并保持相同方向。唯一来源是 `photos.json`，不维护第二份网站图片记录。
