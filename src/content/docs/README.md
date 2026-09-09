---
title: "文档写作约定"
date: 2026-09-09
summary: "本站技术文章的 frontmatter、发布规则与隐私边界"
draft: true
---

# 文档写作约定

本目录存放公开技术文章。该 README 为 `draft: true`，不会进入列表或生成页面。

## Frontmatter

```yaml
---
title: "文档标题"          # 必填
date: 2026-09-09           # 必填
summary: "一句话摘要"       # 必填
updated: 2026-09-09        # 可选
draft: false               # 可选，默认 false
listed: true               # 可选，默认 true
---
```

Schema 位于 `src/content/config.ts`。当前路由会同时过滤 `draft: true` 和 `listed: false`，两者都不会生成详情页。

## 写作规则

- 正文使用原语言，不为 zh/en 路由复制翻译版本。
- 正文可以保留一个 h1；渲染阶段会移除开头与 frontmatter title 重复的 h1。
- 图片等大资源放 R2，小型配图可放 `public/`。
- 标题层级从 h2 开始组织正文，h2/h3 会进入详情页目录。
- 命令与配置必须能脱离作者本机环境理解。

## 隐私边界

公开文章不得包含：

- 真实密钥、Token、密码和 API Key
- 私有邮箱、手机号或即时通信账号
- 内网 IP、私有域名、服务器凭证
- 本机用户名、机器名、序列号或身份路径
- 未经授权的第三方内容

使用 `~/project`、`/home/user`、`C:\Users\user`、`<TOKEN>`、`<内网IP>` 等占位值。

## 验证与发布

```bash
pnpm exec astro check
pnpm build
pnpm preview
```

确认详情页、目录、代码高亮和 Pagefind 搜索后再提交。完整流程见 `docs/upload.md`。
