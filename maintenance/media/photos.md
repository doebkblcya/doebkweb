# 摄影处理、上传与编排

先读 [媒体维护入口](README.md)，本文补充摄影处理与编排规则。输入目录按入口约定准备，保留用户分类名称；不要从照片内容自行重新命名或合并分类。工具逐组调用，不递归扫描输入目录。

同一作品使用一份输入。用户提供修好的 JPG 时直接用 JPG，RAW 仅用于必要时补充同名照片的拍摄时间或曝光参数，不从 RAW 重新生成画面。处理时不移动、删除或修改原始素材；完成后按入口约定清理。

## 图片处理

- JPEG/PNG：直接生成网页派生图。
- RAW：ExifTool 提取可解码的内嵌 JPEG，选像素面积最大的一份，默认长边至少 1600px；没有合格预览时报告并请求导出的 JPEG，不自动解码 RAW。
- 压缩前读取 EXIF 的拍摄时间、实际焦距、光圈、快门时间、ISO，保存到数据草稿；不录入相机型号、镜头型号或 GPS。根据图片方向校正旋转/镜像，转换为 sRGB。网页文件移除 EXIF/GPS；原件不变。
- 普通大图：JPEG，长边不超过 2400px，质量 88；预览：WebP，长边不超过 960px，质量 80。保持比例、不放大。
- 透明抠图：请求指定 `preserveTransparency: true`，大图和预览均输出 WebP，保留 alpha，不转成 JPEG 或填充背景。抠图本身按用户请求另行完成，这个工具只缩放压缩。

## 单个分组的请求

```json
{
  "batch": "20261002-nanjing-v1",
  "input": "materials/inbox/photos/南京",
  "annotations": {
    "DSC0001.JPG": { "note": "用户提供的札记" },
    "DSC0002.JPG": { "date": "2026-09-06T15:28:28" }
  }
}
```

`batch` 是唯一的日期/版本标识，仅使用小写英文字母、数字、连字符。`input` 可以是绝对路径。可选 `output` 必须是独立、不存在的目录，不能与输入嵌套；默认 `materials/processed/<batch>/`。

`annotations` 仅用于用户札记、已知拍摄时间或原文件名映射。处理过的抠图文件名改变时可用 `name` 保存原始文件名，例如 `"小狼.png": { "name": "正面.png", "note": "小狼" }`。不添加描述字段，不替用户撰写札记。无札记省略 `note`。

可选参数：`largeEdge`、`largeQuality`、`previewEdge`、`previewQuality`、`minimumRawEdge`、`preserveTransparency`。默认参数足够时不增加配置。

## 执行与上传

1. 核对用户分类、文件数量和输入格式。快速了解画面时优先一张缩略总览，避免逐张查看大图；用户分类决定组别。
2. 为每个分组写一份请求，执行：

   ```bash
   node maintenance/media/tools/prepare-photos.mjs materials/photo-request.json
   ```

3. 工具在处理派生图前读取原件 EXIF，输出每张大图/预览、含可用元数据的 `photos.draft.json`、`uploads.json`。`id` 由批次与序号组成，`name` 保存原始文件名含扩展名；网站排序不使用 R2 的序号文件名。
4. 核对草稿元数据：`DateTimeOriginal` 保存为相机本地拍摄时间 `YYYY-MM-DDTHH:mm:ss`，来源仅有日期时允许 `YYYY-MM-DD`，不转换到执行机器时区。`FocalLength` 保存为 `focalLength`（实际毫米数，不换算等效焦距），`FNumber` 保存为 `aperture`，`ExposureTime` 保存为 `exposureTime`（秒），`ISO` 保存为 `iso`；四项均为正数，ISO 为整数。JPG 缺少字段时，AI 可用 ExifTool 读取明确对应的同名 RAW，补充草稿中缺失的字段，不覆盖 JPG 中已有值。仍缺少的字段直接省略，不猜测，不填录入日、文件修改时间或占位值。不要从已去除 EXIF 的网页派生图提取；不录入相机、镜头型号。
5. 按入口文档上传、GET 校验；透明图另核对 alpha。全部成功后才更新公开清单。
6. 将新照片追加/更新到 `src/data/photos.json`；修改现有图片时保留作品身份并使用新的 R2 版本路径，避免重复收录同一张照片。
7. 按用户分类在 `src/data/photo-groups.json` 安排摄影展，用照片 ID 引用图片，不重复保存照片资料。照片墙自动展示摄影清单中的所有记录。
8. 按入口文档检查、交付或发布，再清理中间产物。

## 摄影数据

```json
{
  "id": "20261002-nanjing-v1-001",
  "name": "DSC0001.JPG",
  "src": "https://cdn.doebkblcya.com/photos/20261002-nanjing-v1/001-large.jpg",
  "thumb": "https://cdn.doebkblcya.com/photos/20261002-nanjing-v1/001-preview.webp",
  "width": 2400,
  "height": 1600,
  "date": "2026-09-06T15:28:28",
  "focalLength": 103,
  "aperture": 5.6,
  "exposureTime": 0.0025,
  "iso": 100,
  "note": "用户提供的札记"
}
```

示例 URL 不可直接发布。`width`/`height` 为校正方向后大图实际尺寸。预览与大图保持一致比例、方向和透明度。`date`、`note` 和四项曝光参数均可省略；无独立描述或标题字段，HTML 图片替代文本使用 `name`。网页以静态数据展示，不在浏览器解析 EXIF，也不为补充元数据重新上传已有图片。摄影展右侧依次展示可用拍摄日期/时分、札记和曝光参数；快门由秒数格式化为 `1/400 s` 等形式，无元数据时只显示札记。

## 摄影展编排

```json
[
  {
    "id": "nanjing",
    "name": "南京",
    "photos": ["20261002-nanjing-v1-001"]
  }
]
```

分组 `name` 仅保留用户目录分类供编排维护，页面不显示组标题。札记只存于各照片自己的 `note`，展览在照片右侧显示、窄屏改为下方，大图与照片墙搜索读取同一字段。关于页的猫咪使用独立 `src/data/pets.json` 与透明待机视频，名字存于各自 `name`，不放入摄影清单或展览编排。不设置分组 `note`、继承或共享逻辑。用户希望同一文字用于多张照片时分别写入各照片，后续可独立修改；不自行撰写新的札记。没有札记省略照片 `note`，只在照片墙展示，不显示占位。

每组 `photos` 保存纳入摄影展的照片 ID，只编排有非空札记的照片；前端也会排除无札记或仅空白的记录。数组顺序保留分类与无脚本时的展示顺序；正常进入展台时随机排列，本轮观看顺序固定。无 `rows`、`layout` 或 `composition` 等大小和对齐配置。每次展示一张完整照片与自己的札记，手机沿用同样的上下切换方式。引用已验证照片的 ID；同一作品不重复出现在展览中。未安排进展览或无札记的记录仍显示在照片墙。

照片墙默认按原始文件名排序，支持拍摄时间从新到旧，无时间的统一放入“没有时间”；搜索只匹配札记。动画、图片加载与弹层行为见 [AGENT.md](../../AGENT.md)。
