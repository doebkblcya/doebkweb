# 部署指南

## 目标架构

```
doebkblcya.com           →  Cloudflare Pages（静态站点）
cdn.doebkblcya.com        →  Cloudflare R2（媒体资源：音乐/图片/专辑封面）
mustdo.doebkblcya.com     →  VPS FastAPI（独立服务，不动）
```

---

## 本地开发

项目代码在 WSL 中，所有命令在 WSL 终端执行。

### 开发模式（热更新）

```bash
pnpm dev
```

启动 Astro 开发服务器，默认监听 `http://localhost:4321`。

### 生产构建

```bash
pnpm build      # 构建 → dist/
pnpm preview    # 预览构建产物
```

---

## 部署（Cloudflare Pages）

部署自动化：`git push main` → Cloudflare Pages 检测新提交 → 自动 `pnpm build` → 分发到全球边缘节点。

无需手动 rsync，无需管理服务器。

### 首次设置（已完成）

1. Cloudflare Dashboard → Workers & Pages → Pages → 连接 GitHub 仓库
2. 构建设置：框架 Astro，构建命令 `pnpm build`，输出目录 `dist`
3. 自定义域名绑定 `doebkblcya.com` + `www.doebkblcya.com`
4. DNS CNAME 指向 Pages
5. SSL 自动配置，无需维护

### Build 环境

| 项 | 值 |
|---|---|
| 依赖安装 | `pnpm install`（需 `packageManager` 字段，Pages 自动识别 pnpm） |
| 构建命令 | `pnpm build` |
| 输出目录 | `dist` |
| Node 版本 | 20+ |
| 环境变量 | 无需额外设置 |

---

## 媒体资源（Cloudflare R2）

### 存储策略

所有大文件媒体资源存放于 R2 bucket `doebkweb`，通过自定义域名 `cdn.doebkblcya.com` 访问。

### 目录结构

```
R2 doebkweb/
├── music/
│   └── <专辑名>/
│       ├── cover.jpg          (专辑封面)
│       ├── <曲名>.mp3
│       └── <曲名>.lrc         (歌词，可选)
└── photos/                    (后续)
    ├── originals/             (高分辨率 JPEG)
    └── thumbs/                (压缩 WebP)
```

### wrangler CLI 设置

```bash
# 安装（全局）
npm install -g wrangler

# 认证（API Token 方式）
# 1. Cloudflare Dashboard → My Profile → API Tokens → Create Token → R2 Edit
# 2. 写入 ~/.zshrc
echo 'export CLOUDFLARE_API_TOKEN="你的token"' >> ~/.zshrc
source ~/.zshrc
```

### 上传文件

**本地准备**：将文件放入 `_r2-upload/` 目录（已加入 `.gitignore`，不提交到 git）。

**CLI 上传（wrangler）**：

```bash
# 关键：需要 --remote 标志 + 关闭代理（代理会拖慢大文件上传）
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY

# 上传单个文件
wrangler r2 object put doebkweb/music/<专辑>/<文件名> --file=./原文件 --remote

# 批量上传专辑
cd _r2-upload/music/<专辑名>/
for f in *.mp3 *.lrc *.JPG; do
  wrangler r2 object put "doebkweb/music/<专辑名>/$f" --file="$f" --remote
done
```

> **注意**：不带 `--remote` 时 wrangler 走本地模拟模式，文件不会到达远端 R2。上传大文件必须关闭代理环境变量。

### CORS 配置

R2 bucket 已配置 CORS，允许主站跨域访问音频和图片：

```json
[
  {
    "AllowedOrigins": ["https://www.doebkblcya.com", "https://doebkblcya.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"]
  }
]
```

---

## 音乐配置

音乐数据独立存放在 `src/data/music.json`，纯 JSON 格式：

```json
{
  "r2Base": "https://cdn.doebkblcya.com/music",
  "albums": [
    {
      "name": "专辑名（对应 R2 music/ 子目录）",
      "artist": "歌手",
      "review": "个人札记（可选，空字符串则无）",
      "meta": {},
      "tracks": [
        { "trackNo": 1, "title": "曲名", "file": "文件名.mp3" },
        { "trackNo": 2, "title": "曲名", "file": "文件名.mp3", "lrc": "歌词.lrc" }
      ]
    }
  ]
}
```

加专辑只需编辑此 JSON，`playlist.ts` 自动生成派生数据。

> **曲序**：`trackNo` 为曲目序号（1 起），数据层按此升序排列（`playlist.ts` 中 sort），数组书写顺序不承担语义；缺省 `trackNo` 的曲目排最后、保持数组序。对应歌词文件名：`文件名.lrc` 放 R2 同目录。

---

## 构建产物

`pnpm build` 生成的 `dist/` 目录结构：

```
dist/
├── _redirects                      # Pages 级重定向（/ → /zh/）
├── 404.html                        # Pages 级 404 回退
├── index.html                      # / → /zh/ 重定向页
├── zh/
│   ├── index.html                  # 首页
│   ├── about/index.html            # About Me
│   ├── music/index.html            # 音乐专辑架
│   ├── photos/index.html           # 摄影网格
│   ├── 404.html                    # 自定义 404
│   └── docs/
│       ├── index.html              # 文档列表（含内嵌 Pagefind 搜索 + 排序）
│       └── <slug>/index.html       # 单篇文档详情
├── en/                             # 英文页面（同上结构）
├── _astro/                         # CSS/JS 资源（哈希命名，可永久缓存）
├── pagefind/                       # 搜索索引
└── favicon.svg
```

> v1.2 精简后：无独立归档页 `/docs/archive`、分类页 `/docs/category/*`、搜索页 `/search`，搜索内嵌在文档列表页。

---

## DNS 记录

| 记录 | 类型 | 指向 |
|---|---|---|
| `doebkblcya.com` | CNAME | `doebkweb.pages.dev` |
| `www.doebkblcya.com` | CNAME | `doebkblcya.com` |
| `cdn.doebkblcya.com` | CNAME | R2 bucket（Cloudflare 自动管理） |
| `mustdo.doebkblcya.com` | A | VPS IP（FastAPI，不动） |

---

## 回退方案

如果 Pages 部署出问题：

1. DNS 改回 VPS IP（A 记录）
2. 在 VPS 目录中重新 `rsync dist/` 恢复旧部署
3. 排查 Pages 问题，修复后再切回

---

## 故障排查

### 部署不更新

- Cloudflare Pages Dashboard 查看构建日志
- 确认 `git push` 成功到达 `main` 分支
- 清除 Pages 缓存（Dashboard → Settings → Builds & deployments → Clear cache）

### 音乐播放失败

- 确认 MP3 文件已上传到 R2 `music/` 路径
- 检查 `src/data/music.json` 中曲目 file 字段与 R2 文件名一致
- R2 CORS 配置是否正确
- 浏览器 DevTools Network 面板查看请求是否返回 200
- 文件名中如有特殊字符，确认 URL 编码正确

### 页面 404

- 确认 Pages 构建成功，无报错
- 检查 `_redirects` 是否在 `dist/` 根目录
