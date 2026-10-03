# 专辑录入与封面上传

先阅读 [媒体维护入口](README.md)，本文仅补充专辑资料、封面与乐评的录入规则。

## 录入流程

1. 用户提供专辑名，必要时补艺术家或版本。AI 搜索艺术家官网、唱片公司、发行页面等资料；核对同名专辑、发行版本与再版年份。
   - 确认作品类型：同名歌曲、EP、精选辑不能混用。例如单独 EP 找不到时换平台或地区查找，不能用收录它的精选辑封面代替。
   - Apple/iTunes 可在录入阶段提供元信息与封面，但搜索结果必须核对名称、艺术家和发行版本；所有音频/试听字段都忽略。
2. 整理候选的专辑名、艺术家、发行日期、风格、厂牌、封面和来源链接，给用户复审。核对 Apple Music 对应专辑页面，将已确认的链接写入 `appleMusicUrl`，供网站的“播放”入口跳转。找不到或无法确定的信息留空，不编造。只知道年份就存 `YYYY`，不补造月日。
3. 乐评由用户提供，保持原文；没有乐评时 `review` 为 `""`。AI 不自行代写评论，除非用户明确要求用于预览排版的占位文本。已被用户确认的信息无需重复确认。
4. 复审通过后下载该版本的封面至 `materials/covers/`，查看确认图片内容；运行下面的封面处理工具，再查看派生图。封面只缩小，不放大，保持比例。
5. 按维护入口上传并校验封面，通过后写入 `src/data/albums.json`；执行清单与编译检查，按当前授权交付或发布，并清理本批中间产物。

搜索或外部 API 只在录入阶段由 AI 使用。站点构建与访客浏览都只读已经整理好的 JSON 和 R2 图片，不依赖外部 API、第三方封面直链或后端。

## 准备封面

创建 `materials/cover-request.json`：

```json
{
  "id": "funeral-arcade-fire",
  "version": "20260930-v1",
  "input": "materials/covers/funeral-source.jpg"
}
```

```bash
node maintenance/media/tools/prepare-cover.mjs materials/cover-request.json
```

默认生成长边 1000px、质量 82 的 JPEG 大图，以及长边 360px、质量 78 的 WebP 预览。两份都使用 sRGB、移除源 EXIF/GPS、自动校正 JPEG 方向，只缩小不放大。也接受可由 sharp 解码的 PNG/WebP 封面。可通过 `edge`、`quality`、`previewEdge`、`previewQuality` 调整。

生成在 `materials/processed/<id>-<version>/`：`cover.jpg`、`preview.webp`、`cover.draft.json` 和 `uploads.json`。草稿包含 `cover` 和 `thumb`，上传清单包含两份图片。输出目录必须不存在；失败后检查/清理本地派生目录再重做，不影响原始封面。

## 专辑数据

数组中一条完整示例（**URL 仅为格式示例，不能未经上传直接发布**）：

```json
{
  "id": "funeral-arcade-fire",
  "name": "Funeral",
  "artist": "Arcade Fire",
  "cover": "https://cdn.doebkblcya.com/albums/funeral-arcade-fire/20260930-v1/cover.jpg",
  "thumb": "https://cdn.doebkblcya.com/albums/funeral-arcade-fire/20260930-v1/preview.webp",
  "released": "2004-09-14",
  "genres": ["Indie rock"],
  "label": "Merge Records",
  "review": "这里写用户提供的乐评。\n支持换行。",
  "sources": [
    { "title": "发行方专辑页面", "url": "https://www.mergerecords.com/product/funeral" }
  ]
}
```

- 必填：稳定且唯一的 `id`、`name`、`artist`、已上传的 `cover`、`review`。
- 可选：`thumb`、`released`（`YYYY-MM-DD` 或 `YYYY`）、`genres`、`label`、`appleMusicUrl`、`sources`。新增封面必须生成并验证 `thumb`；字段可选仅为兼容已有记录。
- `id` 仅使用小写英文字母、数字、连字符。不同版本可用不同 id；同一条记录更新时保持 id，封面路径换新 version。
- 乐评是纯文本，不渲染 HTML/Markdown；保留用户文字和段落。非空乐评自动成为“选集”候选，无需维护推荐清单；所有专辑均在“唱片架”展示。页面实现约束见 [AGENT.md](../../AGENT.md)。
- 导入 Apple Music 资料库 XML 时可优先提取本地音频的内嵌封面，不改变音频原件。用户已确认清单和版本时，按本次核对要求处理；找不到 Apple Music 的作品省略播放链接，仍可展示专辑。
- `appleMusicUrl` 为已确认的 Apple Music 专辑 HTTPS 链接，显示在详情底部的“播放”区域；点击在新标签页打开 Apple Music，站内不播放音频。未确认链接时不显示该区域。
- `sources` 只放复审过的 HTTPS 链接，保留供维护时追溯资料，不在弹层里显示“资料来源”。不能确认的可选字段直接省略。

同批多个专辑按用户确认的清单和核对要求整理、校验后一次更新 JSON。
