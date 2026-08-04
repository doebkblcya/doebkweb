---
title: "文档上传约定（内部说明）"
date: 2026-08-04
summary: "本站文档目录的上传约定：frontmatter 必填项与隐私红线（本文件 draft，不发布）"
draft: true
---

# 文档上传约定

本站技术文档放在本目录（`src/content/docs/`），Markdown 写作，提交后经 Cloudflare Pages 自动构建发布。本文档 `draft: true` 不会发布，仅作内部指引。

## Frontmatter（必填）

```yaml
---
title: "文档标题"          # 必填
date: 2026-08-04          # 必填，写作/发布日期（YAML date）
summary: "一句话摘要"       # 必填，列表页展示
# 可选：
updated: 2026-08-05       # 更新日期
draft: true               # 草稿：不出现在列表，也不生成页面（仅本 README 用）
listed: false             # 隐藏：列表不显示，但页面仍可访问
---
```

Schema 定义见 `src/content/config.ts`。缺 `title`/`date`/`summary` 会构建失败。

## 隐私红线（必须遵守）

文档会公开部署到互联网，以下内容**一律不得出现**：

| 内容 | 做法 |
|---|---|
| 真实密钥 / Token / 密码 / API Key | 用占位符：`DEEPGRAM_API_KEY=xxx` |
| 真实用户名 / 本地绝对路径 | 用 `~`、`/home/user/`、`C:\Users\user\` 占位，禁止写 `/home/doebk/` 等真实路径 |
| 内网 IP、公司内部域名、服务器地址 | 用 `<内网IP>` 占位；`127.0.0.1`/`localhost` 本地示例可保留 |
| 个人联系方式（邮箱/手机号/微信号） | 仅 about 页可放公开邮箱，正文不放 |
| 硬件/环境指纹级细节 | 可写型号（如 RTX 4070），不写机器名/序列号/唯一标识 |

**原则**：文档里的命令应"换个环境就能跑"——所有路径、凭据、地址都必须是示例值或占位符。

## 其他约定

- 文档内容不翻译，仅 UI 文案走 i18n
- 图片等大文件放 R2，文档内用小文件/外部链接
- 上传流程：`git push main` → Cloudflare Pages 自动构建（详见 `docs/upload.md`）
