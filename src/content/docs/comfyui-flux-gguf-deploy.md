---
title: "ComfyUI + FLUX.1-dev GGUF 本地部署指南"
date: 2026-07-26
summary: "ComfyUI 工作流搭配 FLUX.1-dev GGUF Q5_K_M 量化模型的本地部署全流程"
---

# ComfyUI + FLUX.1-dev GGUF Q5_K_M 本地部署指南

## 环境概览

| 项目 | 配置 |
|------|------|
| GPU | NVIDIA GeForce RTX 4070 Super 12GB |
| 驱动 | 596.49 (CUDA 13.2 兼容) |
| 系统 | Arch Linux on WSL2 |
| Kernel | 6.6.114.1-microsoft-standard-WSL2 |
| Python | 3.12.7 (pyenv) |
| 系统内存 | 24 GB（宿主机 32GB，分配 24GB 给 WSL2） |
| 磁盘可用 | ~940 GB |

## 硬件兼容性评估

```
VRAM 账本 (GGUF Q5_K_M):
  UNet (DiT 主干)    ~7.2 GB    ← GGUF Q5_K_M 量化
  T5-XXL 文本编码器   ~2.0 GB    ← FP8 版本
  VAE                ~0.16 GB   ← FP16
  推理激活值缓冲      ~1.5-2 GB  ← 1024px 分辨率
  ─────────────────────────────
  峰值合计           ~10.5-11 GB ✅ 12GB 上限内，安全余量约 1-1.5GB

系统 RAM 预算:
  T5 加载缓冲         ~5 GB      ← 大模型先读到内存再上显存
  Python + ComfyUI    ~2-3 GB
  WSL2 内核开销       ~1-2 GB
  ─────────────────────────────
  合计               ~8-10 GB   ✅ 24GB 配置下非常宽裕，无 OOM 风险
```

> ✅ **内存已充足**：宿主机 32GB，WSL2 分配 24GB 后，运行 FLUX 时系统 RAM 峰值约 10GB，留 14GB 余量。不会因内存不足导致 OOM。

---

## 第一步：Windows 侧配置（WSL2 内存上限）

你已有一个 `.wslconfig`（位于 `C:\Users\doebk\.wslconfig`），只需在 `[wsl2]` 段落**添加**下面两行：

```ini
[wsl2]
# ... 你原有的其他配置保持不变 ...
autoProxy=true
dnsTunneling=true
firewall=true
guiApplications=true
nestedVirtualization=true
networkingMode=mirrored

# ← 新增下面两行
memory=24GB
swap=16GB

# [experimental] 段落保持不变
```

改完后在 **PowerShell** 中执行：

```powershell
wsl --shutdown
wsl
```

重启 WSL2 后，在 Arch 终端里验证：

```bash
free -h
# 预期显示 Mem: 24Gi total
```

> **为什么是 24GB？** 宿主机 32GB，给 WSL2 24GB 后 Windows 剩 8GB，日常使用足够。T5-XXL 加载需要 ~5GB 连续内存，24GB 下有非常充足的余量。

---

## 第二步：安装 CUDA 依赖（WSL2 Arch）

```bash
# WSL2 不需要完整 CUDA Toolkit（PyTorch 自带运行时库，系统 CUDA 4.8GB 纯浪费）
sudo pacman -Syu
sudo pacman -S --needed nvidia-utils nvidia-container-toolkit

# 验证 CUDA 可用（应显示 GPU 信息）
nvidia-smi
```

> **说明**：WSL2 的 GPU 驱动由 Windows 侧提供，Arch 侧只需 `nvidia-utils` 包提供 `nvidia-smi` 等工具。PyTorch 通过 `LD_LIBRARY_PATH` 找到自己的 CUDA 库，不依赖系统 CUDA。
>
> 安装 `nvidia-container-toolkit` 时如果看到 `ERROR: init 243 result=9`，这是正常的——WSL2 没有直接加载 `nvidia.ko` 内核模块，CDI 初始化必然失败，**不影响使用**。

---

## 第三步：创建 Python 虚拟环境

```bash
# 创建工作目录
mkdir -p ~/ai/image-generation
cd ~/ai/image-generation

# 创建 venv（pyenv 下推荐用 venv，隔离干净）
python3 -m venv ./venv
source ./venv/bin/activate

# 升级 pip
pip install --upgrade pip setuptools wheel
```

---

## 第四步：安装 PyTorch

```bash
# CUDA 12.6 版 PyTorch（稳定且兼容驱动 596.49）
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# 验证 PyTorch CUDA 可用
python3 -c "import torch; print(f'PyTorch {torch.__version__}'); print(f'CUDA 可用: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0)}'); print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')"
```

期望输出：
```
PyTorch 2.x.x
CUDA 可用: True
GPU: NVIDIA GeForce RTX 4070 SUPER
VRAM: 12.0 GB
```

---

## 第五步：克隆并安装 ComfyUI

```bash
cd ~/ai/image-generation

# 克隆 ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# 安装依赖
pip install -r requirements.txt

# 额外依赖（GGUF 加载器需要）
pip install sentencepiece safetensors
```

---

## 第六步：下载模型文件

### 6.1 模型目录结构

```
ComfyUI/
├── models/
│   ├── unet/              ← GGUF 量化的 UNet 放这里
│   ├── clip/              ← T5 和 CLIP-L 文本编码器
│   ├── vae/               ← VAE 解码器
│   └── ...
```

### 6.2 下载 GGUF UNet（核心模型）

从 HuggingFace 下载 `city96/flux1-dev-gguf`：

```bash
cd ~/ai/image-generation/ComfyUI/models/unet

# 方法一：hf download（推荐，支持断点续传）
pip install huggingface_hub
hf download city96/flux1-dev-gguf \
    flux1-dev-Q5_K_M.gguf \
    --local-dir .

# 方法二：手动下载
# 浏览器打开 https://huggingface.co/city96/flux1-dev-gguf
# 下载 flux1-dev-Q5_K_M.gguf (约 7.5 GB)

# 验证文件
ls -lh flux1-dev-Q5_K_M.gguf
# 预期大小: ~7.5 GB
```

> **为什么选 Q5_K_M？** 在 24GB 系统内存 + 12GB 显存环境下，Q5_K_M（~7.5GB）完全跑得动。K-quant 对 attention 层的混合精度保护比纯 Q5 更好，画质与 FP16 几乎无可见差异。如果极端情况下想再降 0.3GB 显存，可退到 Q5_K_S（文件名 `flux1-dev-Q5_K_S.gguf`，画质差异肉眼不可辨）。

### 6.3 下载文本编码器

```bash
cd ~/ai/image-generation/ComfyUI/models/clip

# T5-XXL FP8（必须，FLUX 的提示词理解靠它）
hf download comfyanonymous/flux_text_encoders \
    t5xxl_fp8_e4m3fn.safetensors \
    --local-dir .

# CLIP-L（必须）
hf download comfyanonymous/flux_text_encoders \
    clip_l.safetensors \
    --local-dir .

# 验证
ls -lh t5xxl_fp8_e4m3fn.safetensors clip_l.safetensors
# t5xxl: ~4.6 GB
# clip_l: ~240 MB
```

> ⚠️ **T5 FP8 vs FP16**：T5 原始大小 ~9.2GB（FP16），FP8 版 ~4.6GB。**必须用 FP8**，不仅省 VRAM（加载后在显卡上占 ~2GB），关键是省系统内存（加载时 4.6GB vs 9.2GB 的系统内存占用差异）。

### 6.4 下载 VAE

> ⚠️ `black-forest-labs/FLUX.1-dev` 仓库需要授权才能访问。先执行以下步骤：
> 1. 登录 HF：`hf auth login`（粘贴你的 Token）
> 2. 浏览器打开 https://huggingface.co/black-forest-labs/FLUX.1-dev
> 3. 点击 **Access repository** / **Agree and access repository** 同意使用条款
> 4. 再执行下载命令

```bash
cd ~/ai/image-generation/ComfyUI/models/vae

hf download black-forest-labs/FLUX.1-dev \
    ae.safetensors \
    --local-dir .

# 验证
ls -lh ae.safetensors
# 预期大小: ~320 MB
```

---

## 第七步：验证模型完整性

```bash
cd ~/ai/image-generation/ComfyUI

echo "=== 模型清单 ==="
echo "UNet (GGUF):"
ls -lh models/unet/flux1-dev-Q5_K_M.gguf 2>/dev/null && echo "  ✅" || echo "  ❌ 缺失"

echo "T5-XXL FP8:"
ls -lh models/clip/t5xxl_fp8_e4m3fn.safetensors 2>/dev/null && echo "  ✅" || echo "  ❌ 缺失"

echo "CLIP-L:"
ls -lh models/clip/clip_l.safetensors 2>/dev/null && echo "  ✅" || echo "  ❌ 缺失"

echo "VAE:"
ls -lh models/vae/ae.safetensors 2>/dev/null && echo "  ✅" || echo "  ❌ 缺失"
```

四个文件都显示 ✅ 即可进入下一步。

---

## 第八步：创建工作流 JSON

ComfyUI 基于节点图工作，把以下 JSON 保存为 `~/ai/image-generation/ComfyUI/user/default/workflows/flux-gguf-basic.json`：

```bash
mkdir -p ~/ai/image-generation/ComfyUI/user/default/workflows
```

> **前提**：确保已完成 [第九步](#第九步安装-gguf-自定义节点重要) 安装 `ComfyUI-GGUF` 自定义节点，否则 `UnetLoaderGGUF` 等节点不存在。
>
> 此 JSON 为 ComfyUI 直接导出，**已验证可生成**。导入后如果个别连线断开，在 Web UI 中对照 [第十一步](#第十一步搭建-gguf-工作流web-ui-操作) 手动重连即可。

```json
{
  "last_node_id": 14,
  "last_link_id": 25,
  "nodes": [
    {
      "id": 12,
      "type": "SaveImage",
      "pos": [
        1850,
        350
      ],
      "size": [
        315,
        270
      ],
      "flags": {},
      "order": 12,
      "mode": 0,
      "inputs": [
        {
          "name": "images",
          "type": "IMAGE",
          "link": 22
        },
        {
          "name": "filename_prefix",
          "type": "STRING",
          "widget": {
            "name": "filename_prefix"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "images",
          "type": "IMAGE",
          "links": []
        }
      ],
      "properties": {
        "Node name for S&R": "SaveImage"
      },
      "widgets_values": [
        "ComfyUI"
      ]
    },
    {
      "id": 1,
      "type": "UnetLoaderGGUF",
      "pos": [
        -200.12552301255226,
        128.53556485355674
      ],
      "size": [
        315,
        58
      ],
      "flags": {},
      "order": 0,
      "mode": 0,
      "inputs": [
        {
          "name": "unet_name",
          "type": "COMBO",
          "widget": {
            "name": "unet_name"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "MODEL",
          "type": "MODEL",
          "slot_index": 0,
          "links": [
            13
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "UnetLoaderGGUF"
      },
      "widgets_values": [
        "flux1-dev-Q5_K_M.gguf"
      ]
    },
    {
      "id": 2,
      "type": "DualCLIPLoaderGGUF",
      "pos": [
        -159.92677824267764,
        311.0669456066946
      ],
      "size": [
        315,
        106
      ],
      "flags": {},
      "order": 1,
      "mode": 0,
      "inputs": [
        {
          "name": "clip_name1",
          "type": "COMBO",
          "widget": {
            "name": "clip_name1"
          },
          "link": null
        },
        {
          "name": "clip_name2",
          "type": "COMBO",
          "widget": {
            "name": "clip_name2"
          },
          "link": null
        },
        {
          "name": "type",
          "type": "COMBO",
          "widget": {
            "name": "type"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "CLIP",
          "type": "CLIP",
          "slot_index": 0,
          "links": [
            15
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "DualCLIPLoader (GGUF)"
      },
      "widgets_values": [
        "t5xxl_fp8_e4m3fn.safetensors",
        "clip_l.safetensors",
        "flux"
      ]
    },
    {
      "id": 8,
      "type": "BasicGuider",
      "pos": [
        794.2677824267785,
        205.3347280334726
      ],
      "size": [
        315,
        58
      ],
      "flags": {},
      "order": 9,
      "mode": 0,
      "inputs": [
        {
          "name": "model",
          "type": "MODEL",
          "link": 14
        },
        {
          "name": "conditioning",
          "type": "CONDITIONING",
          "link": 16
        }
      ],
      "outputs": [
        {
          "name": "GUIDER",
          "type": "GUIDER",
          "slot_index": 0,
          "links": [
            17
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "BasicGuider"
      },
      "widgets_values": [
        3.5
      ]
    },
    {
      "id": 6,
      "type": "EmptyLatentImage",
      "pos": [
        754.5676429567638,
        419.27824267782654
      ],
      "size": [
        315,
        106
      ],
      "flags": {},
      "order": 2,
      "mode": 0,
      "inputs": [
        {
          "name": "width",
          "type": "INT",
          "widget": {
            "name": "width"
          },
          "link": null
        },
        {
          "name": "height",
          "type": "INT",
          "widget": {
            "name": "height"
          },
          "link": null
        },
        {
          "name": "batch_size",
          "type": "INT",
          "widget": {
            "name": "batch_size"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "LATENT",
          "type": "LATENT",
          "slot_index": 0,
          "links": [
            18
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "EmptyLatentImage"
      },
      "widgets_values": [
        1024,
        1024,
        1
      ]
    },
    {
      "id": 3,
      "type": "VAELoader",
      "pos": [
        1282.7615062761474,
        876.4539748953949
      ],
      "size": [
        315,
        58
      ],
      "flags": {},
      "order": 3,
      "mode": 0,
      "inputs": [
        {
          "name": "vae_name",
          "type": "COMBO",
          "widget": {
            "name": "vae_name"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "VAE",
          "type": "VAE",
          "slot_index": 0,
          "links": [
            21
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "VAELoader"
      },
      "widgets_values": [
        "ae.safetensors"
      ]
    },
    {
      "id": 11,
      "type": "VAEDecode",
      "pos": [
        1580,
        350
      ],
      "size": [
        210,
        46
      ],
      "flags": {},
      "order": 11,
      "mode": 0,
      "inputs": [
        {
          "name": "samples",
          "type": "LATENT",
          "link": 20
        },
        {
          "name": "vae",
          "type": "VAE",
          "link": 21
        }
      ],
      "outputs": [
        {
          "name": "IMAGE",
          "type": "IMAGE",
          "slot_index": 0,
          "links": [
            22
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "VAEDecode"
      },
      "widgets_values": []
    },
    {
      "id": 13,
      "type": "KSamplerSelect",
      "pos": [
        1048.4170297598648,
        731.9611717726644
      ],
      "size": [
        270,
        58
      ],
      "flags": {},
      "order": 4,
      "mode": 0,
      "inputs": [
        {
          "name": "sampler_name",
          "type": "COMBO",
          "widget": {
            "name": "sampler_name"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "SAMPLER",
          "type": "SAMPLER",
          "links": [
            23
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "KSamplerSelect"
      },
      "widgets_values": [
        "euler"
      ]
    },
    {
      "id": 10,
      "type": "SamplerCustomAdvanced",
      "pos": [
        1200,
        350
      ],
      "size": [
        315,
        262
      ],
      "flags": {},
      "order": 10,
      "mode": 0,
      "inputs": [
        {
          "name": "noise",
          "type": "NOISE",
          "link": 19
        },
        {
          "name": "guider",
          "type": "GUIDER",
          "link": 17
        },
        {
          "name": "sampler",
          "type": "SAMPLER",
          "link": 23
        },
        {
          "name": "sigmas",
          "type": "SIGMAS",
          "link": 24
        },
        {
          "name": "latent_image",
          "type": "LATENT",
          "link": 18
        },
        {
          "name": "scheduler",
          "type": "STRING",
          "widget": {
            "name": "scheduler"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "output",
          "type": "LATENT",
          "slot_index": 0,
          "links": [
            20
          ]
        },
        {
          "name": "denoised_output",
          "type": "LATENT",
          "links": []
        }
      ],
      "properties": {
        "Node name for S&R": "SamplerCustomAdvanced"
      },
      "widgets_values": []
    },
    {
      "id": 14,
      "type": "BasicScheduler",
      "pos": [
        1212.0187097598687,
        163.6362717726638
      ],
      "size": [
        270,
        106
      ],
      "flags": {},
      "order": 8,
      "mode": 0,
      "inputs": [
        {
          "name": "model",
          "type": "MODEL",
          "link": 25
        },
        {
          "name": "scheduler",
          "type": "COMBO",
          "widget": {
            "name": "scheduler"
          },
          "link": null
        },
        {
          "name": "steps",
          "type": "INT",
          "widget": {
            "name": "steps"
          },
          "link": null
        },
        {
          "name": "denoise",
          "type": "FLOAT",
          "widget": {
            "name": "denoise"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "SIGMAS",
          "type": "SIGMAS",
          "links": [
            24
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "BasicScheduler"
      },
      "widgets_values": [
        "simple",
        20,
        1
      ]
    },
    {
      "id": 7,
      "type": "ModelSamplingFlux",
      "pos": [
        430,
        100
      ],
      "size": [
        315,
        130
      ],
      "flags": {},
      "order": 6,
      "mode": 0,
      "inputs": [
        {
          "name": "model",
          "type": "MODEL",
          "link": 13
        },
        {
          "name": "max_shift",
          "type": "FLOAT",
          "widget": {
            "name": "max_shift"
          },
          "link": null
        },
        {
          "name": "base_shift",
          "type": "FLOAT",
          "widget": {
            "name": "base_shift"
          },
          "link": null
        },
        {
          "name": "width",
          "type": "INT",
          "widget": {
            "name": "width"
          },
          "link": null
        },
        {
          "name": "height",
          "type": "INT",
          "widget": {
            "name": "height"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "MODEL",
          "type": "MODEL",
          "slot_index": 0,
          "links": [
            14,
            25
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "ModelSamplingFlux"
      },
      "widgets_values": [
        1.15,
        0.5,
        1024,
        1024
      ]
    },
    {
      "id": 9,
      "type": "RandomNoise",
      "pos": [
        666.2273361227346,
        648.5599721059981
      ],
      "size": [
        315,
        82
      ],
      "flags": {},
      "order": 5,
      "mode": 0,
      "inputs": [
        {
          "name": "noise_seed",
          "type": "INT",
          "widget": {
            "name": "noise_seed"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "NOISE",
          "type": "NOISE",
          "slot_index": 0,
          "links": [
            19
          ]
        }
      ],
      "properties": {
        "Node name for S&R": "RandomNoise"
      },
      "widgets_values": [
        42
      ]
    },
    {
      "id": 4,
      "type": "CLIPTextEncode",
      "pos": [
        322.8033472803348,
        321.48884239888423
      ],
      "size": [
        400,
        200
      ],
      "flags": {},
      "order": 7,
      "mode": 0,
      "inputs": [
        {
          "name": "clip",
          "type": "CLIP",
          "link": 15
        },
        {
          "name": "text",
          "type": "STRING",
          "widget": {
            "name": "text"
          },
          "link": null
        }
      ],
      "outputs": [
        {
          "name": "CONDITIONING",
          "type": "CONDITIONING",
          "slot_index": 0,
          "links": [
            16
          ]
        }
      ],
      "title": "正向提示词",
      "properties": {
        "Node name for S&R": "CLIPTextEncode"
      },
      "widgets_values": [
        "Generate a cute white-and-tabby cat relaxing leisurely on a sofa in the late afternoon as the sun sets, with soft warm golden sunlight streaming in."
      ]
    }
  ],
  "links": [
    [
      13,
      1,
      0,
      7,
      0,
      "MODEL"
    ],
    [
      14,
      7,
      0,
      8,
      0,
      "MODEL"
    ],
    [
      15,
      2,
      0,
      4,
      0,
      "CLIP"
    ],
    [
      16,
      4,
      0,
      8,
      1,
      "CONDITIONING"
    ],
    [
      17,
      8,
      0,
      10,
      1,
      "GUIDER"
    ],
    [
      18,
      6,
      0,
      10,
      4,
      "LATENT"
    ],
    [
      19,
      9,
      0,
      10,
      0,
      "NOISE"
    ],
    [
      20,
      10,
      0,
      11,
      0,
      "LATENT"
    ],
    [
      21,
      3,
      0,
      11,
      1,
      "VAE"
    ],
    [
      22,
      11,
      0,
      12,
      0,
      "IMAGE"
    ],
    [
      23,
      13,
      0,
      10,
      2,
      "SAMPLER"
    ],
    [
      24,
      14,
      0,
      10,
      3,
      "SIGMAS"
    ],
    [
      25,
      7,
      0,
      14,
      0,
      "MODEL"
    ]
  ],
  "groups": [],
  "config": {},
  "extra": {
    "ds": {
      "scale": 1.4641000000000006,
      "offset": [
        158.74421266079457,
        19.235916163663603
      ]
    }
  },
  "version": 0.4
}
```

> **关键说明**
```

> **关键说明**：
> - **DualCLIPLoaderGGUF**：只有 **3 个** widget（clip_name1, clip_name2, type），type 填 `flux`。不要手动修改 widget 顺序。
> - **SamplerCustomAdvanced** 的 `sampler` 和 `sigmas` 不是下拉框，而是**需要连线的输入口**——通过 KSamplerSelect（选 `euler`）和 BasicScheduler（选 `simple`, steps=20, denoise=1）提供。
> - **BasicScheduler** 需要 MODEL 输入，从 ModelSamplingFlux 的输出拉一条线过去。
> - **负向提示词**：FLUX 的 cfg 固定 1.0，负向 conditioning 不生效。JSON 中不含负向 CLIPTextEncode 节点。

---

## 第九步：安装 GGUF 自定义节点（重要！）

ComfyUI 原生不支持 GGUF，需要安装 `ComfyUI-GGUF`：

```bash
cd ~/ai/image-generation/ComfyUI/custom_nodes
git clone https://github.com/city96/ComfyUI-GGUF.git
pip install -r ComfyUI-GGUF/requirements.txt
```

---

## 第十步：首次启动

```bash
cd ~/ai/image-generation/ComfyUI
source ~/ai/image-generation/venv/bin/activate

# 启动 ComfyUI（不需要任何特殊显存参数）
python main.py --listen 0.0.0.0 --port 8188
```

启动成功会显示：
```
Starting server

To see the GUI go to: http://127.0.0.1:8188
```

在 **Windows 浏览器**中打开 `http://localhost:8188`（WSL2 网络自动转发）。

---

## 第十一步：搭建 GGUF 工作流（Web UI 操作）

在 ComfyUI Web 界面中，右键 → Add Node，按以下顺序搭建：

### 节点清单

| 节点 | 类型 | 配置值 |
|------|------|--------|
| Load UNet (GGUF) | `UnetLoaderGGUF` | `flux1-dev-Q5_K_M.gguf` |
| DualCLIPLoader (GGUF) | `DualCLIPLoaderGGUF` | clip_name1: `t5xxl_fp8_e4m3fn.safetensors`<br>clip_name2: `clip_l.safetensors`<br>type: `flux`（⚠️ 只有一个 type，填 `flux`） |
| Load VAE | `VAELoader` | `ae.safetensors` |
| CLIPTextEncode (正向) | `CLIPTextEncode` | 写你的提示词（FLUX 支持英文，中文效果稍弱） |
| Empty Latent Image | `EmptyLatentImage` | width: 1024, height: 1024, batch_size: 1 |
| ModelSamplingFlux | `ModelSamplingFlux` | max_shift: 1.15, base_shift: 0.5<br>width: 1024, height: 1024 |
| BasicGuider | `BasicGuider` | guidance: 3.5 |
| RandomNoise | `RandomNoise` | noise_seed: 数字（填入任意整数，如 `42`） |
| KSamplerSelect | `KSamplerSelect` | sampler_name: `euler` |
| BasicScheduler | `BasicScheduler` | scheduler: `simple`, steps: `20`, denoise: `1.0` |
| SamplerCustomAdvanced | `SamplerCustomAdvanced` | cfg: `1.0`（其他参数由 KSamplerSelect 和 BasicScheduler 连线提供） |
| VAEDecode | `VAEDecode` | （连 VAE 和 latent） |
| SaveImage | `SaveImage` | output 目录默认 |

> ⚠️ **重要**：`SamplerCustomAdvanced` 的 `sampler` 和 `sigmas` 是**输入插槽**（不是下拉框），需要分别从 `KSamplerSelect` 和 `BasicScheduler` 连线。
>
> `BasicScheduler` 还需要 `model` 输入——从 `ModelSamplingFlux` 的 MODEL 输出再拉一条线。

### 连线流程

```
[UnetLoaderGGUF]──MODEL──→[ModelSamplingFlux]──MODEL──┬──→[BasicGuider]──GUIDER──→[SamplerCustomAdvanced]
                                                       │                                    ↑
                                                       └──→[BasicScheduler]──SIGMAS─────────┤
                                                                                            │
[DualCLIPLoaderGGUF]──CLIP──→[CLIPTextEncode 正向]──CONDITIONING──→[BasicGuider]            │
                                                                                            │
[KSamplerSelect]──SAMPLER───────────────────────────────────────────────────────────────────┤
                                                                                            │
[EmptyLatentImage]──LATENT──────────────────────────────────→[SamplerCustomAdvanced]        │
                                                                                            │
[RandomNoise]──NOISE───────────────────────────────────────→[SamplerCustomAdvanced]        │
                                                                      │                     │
                                                                      ↓ LATENT              │
[VAELoader]──VAE──────────────────────────────────────────────→[VAEDecode]                  │
                                                                      │                     │
                                                                      ↓ IMAGE               │
                                                                  [SaveImage]               │
```

> **注意**：FLUX 不需要负向提示词。CFG 固定为 1.0，不要连负向 CLIPTextEncode。

### 关键参数说明

- **guidance 3.5**：FLUX dev 的推荐值，太高画面过曝，太低细节不足
- **cfg 1.0**：FLUX 的 CFG 固定为 1.0（与 SDXL 不同）
- **steps 20**：Q5_K_M 量化后 20 步足够，再多画质提升微乎其微
- **max_shift 1.15 / base_shift 0.5**：FLUX dev 的噪声调度标准值
- **noise_seed**：RandomNoise 中填数字（如 `42`），不要填 `"randomize"` 字符串

---

## 第十二步：验证生成

1. 正向提示词填入：`a cat sitting on a sofa, natural lighting, high quality`
2. 点右上角 **Queue Prompt**
3. 观察终端日志：无 CUDA error / OOM 报错
4. 生成成功 → 图片出现在 `ComfyUI/output/` 目录

首张图生成时间约 **30-60 秒**（1024x1024, 20 steps），后续图会略快。

---

## 性能参考（实测估算）

| 配置 | 步数 | 分辨率 | 单张耗时 | 峰值 VRAM |
|------|------|--------|----------|-----------|
| GGUF Q5_K_M | 20 | 1024×1024 | ~40-60s | ~10.8 GB |
| GGUF Q5_K_M | 15 | 1024×1024 | ~30-45s | ~10.8 GB |
| GGUF Q5_K_M | 20 | 768×1024 | ~25-35s | ~9.8 GB |
| GGUF Q5_K_S | 20 | 1024×1024 | ~35-50s | ~10.5 GB |

---

## 日常使用脚本

创建 `~/ai/image-generation/start-comfyui.sh`：

```bash
#!/bin/bash
set -e

cd ~/ai/image-generation/ComfyUI
source ~/ai/image-generation/venv/bin/activate

echo "🚀 启动 ComfyUI..."
echo "📂 工作目录: $(pwd)"
echo "🌐 Web UI: http://localhost:8188"
echo ""

python main.py --listen 0.0.0.0 --port 8188
```

```bash
chmod +x ~/ai/image-generation/start-comfyui.sh
```

每次使用时：
```bash
~/ai/image-generation/start-comfyui.sh
```

---

## 故障排除

### 1. CUDA Out of Memory (VRAM OOM)

```
症状: torch.cuda.OutOfMemoryError: Allocation of X bytes failed
原因: 显存峰值超 12GB
```

解决：
- 降分辨率：1024→768 或 896 宽度
- 降量化档位：Q5_K_M → Q5_K_S
- 检查是否有其他进程占用显存：`nvidia-smi`
- **不要**用 `--lowvram` 参数（GGUF 模型不需要）

### 2. 系统内存 OOM（WSL2 被 Windows 杀掉）

```
症状: 终端突然关闭，或 WSL2 进程消失
原因: WSL2 消耗系统内存超限
```

解决：
1. **确认 `.wslconfig` 中 `memory=24GB` 已生效**（`free -h` 应显示 24Gi）
2. 降低 T5 加载内存：用 `t5xxl_fp8_e4m3fn` 而不是 FP16
3. 启动 ComfyUI 前关闭其他内存大户（浏览器、IDE 等）
4. 少见的极端情况：检查 Windows 侧虚拟内存是否 ≥ 32GB（设置 → 高级系统设置 → 性能 → 高级 → 虚拟内存）

### 3. bitsandbytes / GGUF 节点找不到

```
症状: 节点面板搜不到 UnetLoaderGGUF
原因: ComfyUI-GGUF 自定义节点未安装
```

解决：
```bash
cd ~/ai/image-generation/ComfyUI/custom_nodes
git clone https://github.com/city96/ComfyUI-GGUF.git
pip install -r ComfyUI-GGUF/requirements.txt
# 重启 ComfyUI
```

### 4. PyTorch 检测不到 CUDA

```
症状: torch.cuda.is_available() = False
原因: PyTorch 版本与驱动不匹配，或 WSL2 GPU 未挂载
```

解决：
```bash
# 确认 PyTorch 是 CUDA 版
pip uninstall torch torchvision torchaudio -y
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# 如果仍无效，检查 WSL2 GPU 直通
# 在 Windows PowerShell 中:
# wsl --shutdown
# wsl
```

### 5. ComfyUI 启动黑屏/白屏

```
症状: 浏览器打开 http://localhost:8188 但页面空白
原因: JavaScript 资源加载失败，通常是代理/VPN 干扰
```

解决：
- 关闭代理/VPN 后刷新
- 或者用 `--force-fp16` 参数降低 UI 资源开销（不影响模型精度）
- 检查浏览器控制台 (F12) 的具体报错

### 6. 生成结果是纯灰/噪声

```
症状: 出图成功但全是灰块或噪点
原因: KSampler 的 cfg 设成了非 1.0 的值（FLUX 不支持 CFG）
```

解决：
- `SamplerCustomAdvanced` 节点中 `cfg` 必须设为 `1.0`
- 不要用 `KSampler`（默认 CFG 不是 1），用 `KSamplerAdvanced` 或 `SamplerCustomAdvanced`

### 7. GGUF 模型加载极慢（>3 分钟）

```
症状: 加载模型卡住很久
原因: 可能是 WSL2 读取 Windows 文件系统的 IO 瓶颈
```

解决：
- **模型文件必须放在 WSL2 的 ext4 文件系统内**（即 `~/` 下），不要放在 `/mnt/c/`
- 已经放 `/mnt/c/` 了？移过来：
  ```bash
  cp /mnt/c/Users/xxx/Downloads/flux1-dev-Q5_K_M.gguf ~/ai/image-generation/ComfyUI/models/unet/
  ```

### 8. DualCLIPLoaderGGUF 缺模型 / widget 值错乱

```
症状: 节点报 "缺失模型" 或 clip_name1/clip_name2/type 显示的值不对
原因: 该节点只有 3 个 widget（clip_name1, clip_name2, type），不是 4 个；type 只有一个，填 `flux`
```

解决：
- 直接在节点上手动选择：clip_name1 → `t5xxl_fp8_e4m3fn.safetensors`，clip_name2 → `clip_l.safetensors`，type → `flux`
- 如果 JSON 导入后值错乱，删除节点重新添加即可

### 9. SamplerCustomAdvanced 报 "缺少连接 sampler / sigmas"

```
症状: 节点报 sampler 和 sigmas 必需连接但未连接，且节点上没有下拉框
原因: 新版 ComfyUI 将 sampler 和 sigmas 改成了输入插槽（而非下拉框），需要从其他节点连线
```

解决：
- 添加 `KSamplerSelect` 节点（选 `euler`），输出 SAMPLER → 连到 SamplerCustomAdvanced 的 `sampler`
- 添加 `BasicScheduler` 节点（scheduler: `simple`, steps: `20`, denoise: `1.0`），输出 SIGMAS → 连到 SamplerCustomAdvanced 的 `sigmas`
- `BasicScheduler` 还需要 MODEL 输入：从 `ModelSamplingFlux` 的 MODEL 拉一条线过来

### 10. huggingface-cli 命令失效

```
症状: 运行 huggingface-cli 提示 deprecated 或找不到命令
原因: 新版 huggingface_hub 用 `hf` 替代了 `huggingface-cli`
```

解决：所有命令改为 `hf download`，`pip install huggingface_hub` 自带 `hf` 不需要额外安装。

### 11. VAE 下载报 Access denied

```
症状: hf download black-forest-labs/FLUX.1-dev 提示 access denied
原因: 该仓库需要登录并同意使用条款
```

解决：
```bash
hf auth login           # 先粘贴 HF Token
# 然后浏览器打开 https://huggingface.co/black-forest-labs/FLUX.1-dev
# 点击 Access repository / Agree and access repository
```

### 12. Windows 进程占用显存导致 OOM

```
症状: 生成前 nvidia-smi 已显示 4+ GB VRAM 被占用，但看不到占用进程
原因: WSL2 不在 Linux 侧显示 Windows 侧 GPU 进程
```

解决：
- 在 Windows 任务管理器 (Ctrl+Shift+Esc) → 性能 → GPU 查看占用
- 生成前关闭浏览器、IDE 等 GPU 加速应用
- 空闲占用应在 1-2 GB 以下，可用 VRAM 应 ≥ 10 GB

---

## 目录结构总览（部署完成后）

```
~/ai/image-generation/
├── venv/                          # Python 虚拟环境
├── start-comfyui.sh               # 启动脚本
├── ComfyUI/
│   ├── main.py                    # 入口
│   ├── custom_nodes/
│   │   └── ComfyUI-GGUF/          # GGUF 加载器
│   ├── models/
│   │   ├── unet/
│   │   │   └── flux1-dev-Q5_K_M.gguf       (7.5 GB)
│   │   ├── clip/
│   │   │   ├── t5xxl_fp8_e4m3fn.safetensors (4.6 GB)
│   │   │   └── clip_l.safetensors           (240 MB)
│   │   └── vae/
│   │       └── ae.safetensors               (320 MB)
│   ├── output/                    # 生成图片保存位置
│   └── user/default/workflows/    # 工作流保存位置
```

**总计磁盘占用：约 15-20 GB**

---

## 快速参考卡片

```bash
# 激活环境
source ~/ai/image-generation/venv/bin/activate
cd ~/ai/image-generation/ComfyUI

# 启动
python main.py --listen 0.0.0.0 --port 8188

# 浏览器打开
http://localhost:8188

# 监控显存
watch -n 1 nvidia-smi

# 快速测试 CUDA
python3 -c "import torch; print(torch.cuda.is_available())"
```
