---
title: "Qwen3-14B Ollama 本地部署指南"
date: 2026-07-26
summary: "Qwen3-14B INT4 量化模型通过 Ollama 在本地部署的完整流程"
---

# Qwen3-14B INT4 量化 + Ollama 本地部署指南

## 环境概览

| 项目 | 配置 |
|------|------|
| GPU | NVIDIA GeForce RTX 4070 Super 12GB |
| 驱动 | 596.49 / CUDA 13.2 |
| 系统 | Arch Linux (rolling) on WSL2 |
| Kernel | 6.6.114.1-microsoft-standard-WSL2 |
| 系统内存 | 32 GB 宿主机 / WSL2 可见 ~24 GB |
| 推理框架 | Ollama（底层 llama.cpp，CUDA 版） |
| 目标模型 | Qwen3-14B-Instruct（Q4_K_M 量化） |
| 实测推理速度 | ~43 tok/s |

---

## 模型特性

Qwen3-14B 是纯文本模型，**默认内置思考链推理**（类似 DeepSeek-R1），回答前会先输出 `Thinking...` 思考过程。不支持多模态（看图/识图需要 Qwen2.5-VL 系列）。

---

## 硬件兼容性评估

### VRAM 账本（Qwen3-14B GGUF Q4_K_M）

```
模型权重（Q4_K_M 量化）   ~8.0 GB    ← 14B × 4.5 bit ≈ 7.9 GB + 少量开销
KV Cache（32K 上下文）    ~1.2 GB    ← 32768 token 长上下文
推理激活临时缓冲          ~1.0 GB    ← 推理时的中间计算
─────────────────────────────────
峰值合计                 ~10.2 GB   ✅ 12GB 上限内，安全余量约 2GB
```

> **结论：12GB 显存完全够用**，32K 上下文随便开。不需要任何 CPU 卸载。

### 上下文窗口 vs 显存

| 上下文长度 | KV Cache 额外显存 | 总预估（含 8GB 模型） |
|-----------|-------------------|------------------------|
| 4K | ~0.15 GB | ~8.2 GB |
| 8K | ~0.3 GB | ~8.3 GB |
| 16K | ~0.6 GB | ~8.6 GB |
| 32K | ~1.2 GB | ~9.2 GB |

Ollama 默认只给 4096 token（极度保守），实际 32K 完全跑得动。

### 系统 RAM 预算

```
Ollama 进程              ~0.5 GB
Open WebUI（如果运行）    ~1.0 GB
WSL2 内核开销            ~1-2 GB
─────────────────────────────────
合计                     ~3-4 GB  ✅ 24GB 分配下极度宽裕
```

---

## 第一步：安装 Ollama（注意：必须用 CUDA 版）

> ⚠️ **Arch Linux `extra/ollama` 包编译时没有开启 CUDA 支持，只能纯 CPU 推理（~5.9 tok/s）。必须用官方脚本安装才能用 GPU。**

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

官方脚本安装路径：`/usr/local/bin/ollama`，模型存储路径：`/var/lib/ollama/.ollama/models/`。

安装完成后启动服务：

```bash
sudo systemctl enable ollama --now
sudo systemctl status ollama
```

日志里看到 `library=CUDA ... NVIDIA GeForce RTX 4070 SUPER` 就说明 GPU 识别成功。默认监听 `127.0.0.1:11434`。

### 如果你已经装了 Arch 官方包

```bash
sudo systemctl stop ollama
sudo pacman -R ollama
curl -fsSL https://ollama.com/install.sh | sh
```

模型文件需要从旧路径迁移到新路径：

```bash
# 检查旧路径是否有文件
ls /var/lib/ollama/blobs/

# 如果有，迁移
sudo mkdir -p /var/lib/ollama/.ollama/models/blobs
sudo cp /var/lib/ollama/blobs/* /var/lib/ollama/.ollama/models/blobs/
sudo chown -R ollama:ollama /var/lib/ollama/.ollama/models/
sudo systemctl restart ollama
ollama list  # 验证模型是否识别
```

---

## 第二步：配置代理（中国大陆必需）

Ollama 是 systemd 服务运行的，**不会继承终端的环境变量**。必须把代理写到服务配置里。

由于 WSL2 默认没有设置 `$EDITOR`，`sudo systemctl edit` 会报错：`Cannot edit files, no editor available`。用 `sudo tee` 代替：

```bash
sudo tee /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:7890"
Environment="HTTPS_PROXY=http://127.0.0.1:7890"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

端口改成你实际代理的端口（7890 是 Clash 默认，自己核对）。

验证代理是否生效：

```bash
sudo systemctl show ollama | grep -i proxy
```

---

## 第三步：拉取并运行模型

```bash
ollama pull qwen3:14b
```

模型约 9.3 GB。Ollama 底层从 Docker Hub 拉取，**国内网络必须配代理**否则极慢（< 2 MB/s）。

下载完成后验证：

```bash
ollama list
```

应该看到：

```
NAME         ID              SIZE      MODIFIED
qwen3:14b    bdbd181c33f2    9.3 GB    ...
```

### 开始对话

```bash
ollama run qwen3:14b
```

此时模型加载到显存（约 5 秒预热），之后交互对话。按 `Ctrl+D` 或 `/bye` 退出。

### 内置命令

```
/set verbose      开启详细统计（显示 token 速度）
/set parameter num_ctx 32768   调整上下文窗口
/set system <prompt>           设置系统提示词
/show            查看当前模型参数
/save <name>     保存会话
/load <name>     恢复会话
/bye             退出
```

`/set verbose` 开启后，每次回复结束会显示详细的 token 计数和速度（如 `eval rate: 43.53 tokens/s`）。

---

## 第四步：配置调优

### 4.1 永久增大上下文窗口

Ollama 默认对你的 12GB 显存只分配 **4096 token** 上下文（粗暴计算公式：总显存 / 3MB），实际 32K 完全没问题。

创建一个定制模型：

```bash
cat > ~/Modelfile.qwen3 << 'EOF'
FROM qwen3:14b
PARAMETER num_ctx 32768
PARAMETER temperature 0.7
PARAMETER top_p 0.8
EOF

ollama create qwen3-local -f ~/Modelfile.qwen3
```

以后用 `ollama run qwen3-local` 就是 32K 上下文了。Open WebUI 里在模型列表也能选到 `qwen3-local`。

### 4.2 模型常驻显存（避免每次重新加载）

```bash
sudo tee /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_KEEP_ALIVE=-1"
EOF
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

默认是闲置 5 分钟后卸载（`OLLAMA_KEEP_ALIVE=5m0s`）。设为 `-1` 永不卸载，下次对话秒回。

### 4.3 关键参数速查

| 参数 | 默认值 | 建议值 | 说明 |
|------|--------|--------|------|
| `temperature` | 0.8 | 0.7-0.8 | 较低→代码/逻辑；较高→创意写作 |
| `top_p` | 0.9 | 0.8 | 核采样阈值 |
| `num_ctx` | 4096（自动） | 8192-32768 | 上下文窗口，12GB 跑满 32K 没问题 |
| `repeat_penalty` | 1.1 | 1.1 | 防止重复 |

---

## 第五步：部署 Open WebUI（多端前端）

Open WebUI 提供 ChatGPT 式的完整界面，支持会话管理、对话历史、多用户、联网搜索、RAG 等。是 Ollama 最推荐的前端。

### 5.1 安装（pip 方式，无需 Docker）

```bash
pip install open-webui
```

### 5.2 启动

```bash
# 本机访问
open-webui serve

# 多端访问（手机等，绑定所有网络接口）
open-webui serve --host 0.0.0.0 --port 8080
```

首次启动会自动下载一个嵌入模型（all-MiniLM-L6-v2，约 477MB），用于 RAG 文档上传功能。不影响基本对话，可以等它下完或跳过。

访问 `http://localhost:8080`，首次打开注册一个账号——**第一个注册的用户自动是管理员**。

### 5.3 手机 / 多端访问

Ollama 只监听 127.0.0.1，外部设备无法直接访问。正确架构：

```
手机 (WiFi) ────┐
                ├── http://<电脑IP>:8080 ──▶ Open WebUI ──▶ Ollama (localhost:11434)
电脑浏览器 ────┘
```

**Windows 防火墙需要放行 8080 端口**，在 Windows 侧（PowerShell 管理员）：

```powershell
New-NetFirewallRule -DisplayName "Open WebUI 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

然后查 WSL2 IP：

```bash
ip addr show | grep 192.168
```

手机连同一 WiFi，浏览器访问 `http://<电脑IP>:8080` 即可。

### 5.4 多用户管理

默认只有登录界面，新用户无法自己注册。管理员操作：

1. 点击头像 → **管理员面板** → 设置 → 通用 → **启用新用户注册**（勾上）
2. 新用户注册后，管理员面板 → 用户 → 找到用户 → 编辑 → 把模型权限勾上(`qwen3:14b`)
3. 或者在管理员面板 → 模型 → 把模型设为所有用户默认可用

### 5.5 Open WebUI 模型选择

Open WebUI 启动后自动探测 Ollama API，你已下载的模型会出现在模型选择下拉框中，无需任何额外配置。也可以选择通过 Modelfile 创建的定制模型（如 `qwen3-local`）。

---

## 第六步：语音输入

语音输入（STT，Speech to Text）使用 **浏览器内置的 Web Speech API**，Chrome/Edge 支持最好。

- **零配置、零显存开销**——音频在浏览器端捕获，发到浏览器厂商的云端处理，不经过你的电脑 GPU
- 桌面浏览器和手机浏览器都可用，输入框旁边有麦克风图标
- 中文识别准确度与 Whisper API 相当
- 注意：音频会离开你的设备，不适合处理机密内容

如果需要完全离线的语音识别，可本地部署 Whisper，但额外占用 ~3GB 显存，在 12GB 上较紧张。

---

## 第七步：监控与验证

### 7.1 确认 GPU 在推理中工作

```bash
# 终端 1：发起推理
ollama run qwen3:14b
# 然后输入一个问题

# 终端 2：监控 GPU
watch -n 0.5 nvidia-smi
```

正常情况：`GPU-Util` 70-90%，`Memory-Usage` ~10GB。**nvidia-smi 的 Processes 列表可能不显示 ollama 进程名**（它有独立的 llama.cpp runner 子进程），以显存占用和利用率为准。

### 7.2 确认 CUDA 启用

```bash
journalctl -u ollama --since "5 min ago" | grep -i "cuda\|gpu"
```

看到 `library=CUDA ... NVIDIA GeForce RTX 4070 SUPER` 就对了。如果没有任何 CUDA 或 GPU 相关输出，说明装的是纯 CPU 版本。

### 7.3 查看实时 token 速度

方式一——终端交互模式：

```
>>> /set verbose
>>> 你好
# 回复结束后看到 eval rate: XX.XX tokens/s
```

方式二——日志实时刷新：

```bash
journalctl -u ollama -f | grep "tg="
```

每秒打印一条 `tg = XX.X t/s`。

方式三——API 测速：

```bash
time curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:14b","prompt":"用 500 字介绍深度学习","stream":false}' \
  | jq -r '.response' | wc -c
```

### 7.4 卸载模型（释放显存）

```bash
# 立即释放
curl http://localhost:11434/api/generate -d '{"model": "qwen3:14b", "keep_alive": 0}'

# 或者重启服务
sudo systemctl restart ollama
```

---

## 第八步：作为 API 服务使用

Ollama 自带 **OpenAI 兼容 API**，监听 `http://localhost:11434`。

### 8.1 Chat Completions（和 OpenAI API 一样）

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:14b",
    "messages": [
      {"role": "user", "content": "用一句话介绍 Linux 内核"}
    ],
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

### 8.2 Python 调用（openai 库直接连）

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"  # 不校验 key，填任意值
)

response = client.chat.completions.create(
    model="qwen3:14b",
    messages=[{"role": "user", "content": "用 Python 写快速排序"}],
    temperature=0.7,
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### 8.3 API 端点一览

| 端点 | 用途 |
|------|------|
| `/v1/chat/completions` | 对话补全 |
| `/v1/completions` | 文本补全 |
| `/v1/models` | 列出模型 |
| `/v1/embeddings` | 嵌入向量 |
| `/api/generate` | Ollama 原生生成 |
| `/api/chat` | Ollama 原生对话 |

---

## 日常使用速查

```bash
# 启动服务
sudo systemctl start ollama

# 终端对话
ollama run qwen3:14b

# 查看模型列表
ollama list

# 查看模型详情
ollama show qwen3:14b

# 创建自定义模型
ollama create qwen3-local -f ~/Modelfile.qwen3

# 删除模型
ollama rm qwen3:14b

# 停止服务
sudo systemctl stop ollama

# 卸载模型释放显存
curl http://localhost:11434/api/generate -d '{"model": "qwen3:14b", "keep_alive": 0}'
```

---

## 故障排查

### 推理速度只有 5-6 tok/s（应该是 40+ tok/s）

**Arch 官方 ollama 包是纯 CPU 版。** 检查日志是否含 CUDA：

```bash
journalctl -u ollama --no-pager | grep -i cuda
```

如果没有 `library=CUDA` 字样，卸掉官方包，换官方脚本安装：

```bash
sudo systemctl stop ollama
sudo pacman -R ollama
curl -fsSL https://ollama.com/install.sh | sh
```

### `ollama pull` 下载极慢（< 2 MB/s）

Ollama 从 Docker Hub 拉取模型，国内直连很慢。必须给 systemd 服务配代理（不是终端环境变量），见第二步。

### `sudo systemctl edit ollama` 报错 "no editor available"

WSL2 默认没有设置 `$EDITOR`。用 `sudo tee /etc/systemd/system/ollama.service.d/override.conf` 代替（参考第二步和 4.2 的写法）。

### WSL2 中 nvidia-smi 看不到 GPU

Windows 侧 PowerShell：

```powershell
wsl --version  # 确保 WSL >= 2.0
wsl --update
```

### 502 Bad Gateway / 连接拒绝

```bash
sudo systemctl start ollama
sudo systemctl status ollama
```

### 手机无法访问 Open WebUI

1. 确认启动了 `open-webui serve --host 0.0.0.0 --port 8080`
2. Windows 防火墙放行 8080 端口（PowerShell 管理员）：`New-NetFirewallRule -DisplayName "Open WebUI 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow`
3. 手机和电脑连接同一 WiFi

### 新用户无法使用模型

管理员面板 → 用户 → 编辑用户 → 勾选模型权限。或在管理员面板 → 模型 → 设为所有用户默认可用。

### 显存不足 (OOM)

```bash
# 查看显存占用
nvidia-smi

# 减小上下文窗口
ollama run qwen3:14b
>>> /set parameter num_ctx 4096
```

---

## 进阶参考

### Qwen2.5-VL-7B（多模态，识图）

```bash
ollama pull qwen2.5vl:7b
```

7B 参数量化后约 ~5GB，支持图片输入。12GB 显存可以两个模型都装，Ollama 只加载当前活跃的那一个。

### Qwen3-32B GPU+CPU 混合推理

```bash
sudo pacman -S llama.cpp
# 下载 Qwen3-32B-Instruct Q3_K_L GGUF (~16GB)
# https://huggingface.co/Qwen/Qwen3-32B-Instruct-GGUF

llama-cli \
  -m ~/models/qwen3-32b-instruct-q3_k_l.gguf \
  -ngl 22 \       # 约 22 层放 GPU
  -c 8192 \
  --temp 0.7
```

- 显存占用：约 10GB（GPU）+ ~10GB（CPU）
- 速度：5-15 tok/s
- 12GB 显存 + 32GB RAM 够跑

### 更多前端

| 工具 | 特点 |
|------|------|
| [Page Assist](https://chromewebstore.google.com) | 浏览器插件，右键划词直接问模型，零部署 |
| [Chatbox](https://chatboxai.app) | 桌面客户端，设计最好的 Ollama GUI |
| aichat | 终端 AI 助手：`cargo install aichat` |

---

## 当前环境信息

```
Arch Linux (rolling) on WSL2
Kernel: 6.6.114.1-microsoft-standard-WSL2
NVIDIA Driver: 596.49 / CUDA 13.2
GPU: NVIDIA GeForce RTX 4070 Super (12282 MiB VRAM)
System RAM: 32 GB (WSL2 visible: ~24 GB)
Ollama: 0.32.4 (CUDA 版), /usr/local/bin/ollama
Open WebUI: v0.10.2 (pip 安装)
模型存储: /var/lib/ollama/.ollama/models/
实测速度: ~43 tok/s (Qwen3-14B Q4_K_M, 32K ctx)
```

---

## 参考链接

- Ollama 官方文档：https://ollama.com/docs
- Qwen3 模型主页：https://huggingface.co/Qwen
- Open WebUI 文档：https://docs.openwebui.com
- llama.cpp：https://github.com/ggerganov/llama.cpp
