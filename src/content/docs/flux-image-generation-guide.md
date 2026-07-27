---
title: "FLUX 图像生成 — 原理、配置与调参"
date: 2026-07-26
summary: "基于 ComfyUI GGUF 工作流的 FLUX 图像生成深度解析，含参数调优与采样器对比"
---

# FLUX 图像生成 — 原理、配置与调参指南

> 基于 ComfyUI GGUF 工作流 (`flux-gguf-basic.json`) 的深度解析

---

## 目录

1. [核心概念](#1-核心概念)
   - [文本编码器 (Text Encoder)](#11-文本编码器-text-encoder)
   - [CLIP](#12-clip)
   - [T5-XXL](#13-t5-xxl)
   - [VAE (变分自编码器)](#14-vae-变分自编码器)
   - [UNET / DiT (扩散模型主干)](#15-unet--dit-扩散模型主干)
   - [Latent (潜在空间)](#16-latent-潜在空间)
   - [噪声 (Noise)](#17-噪声-noise)
   - [采样器 (Sampler)](#18-采样器-sampler)
   - [调度器 (Scheduler) 与 Sigmas](#19-调度器-scheduler-与-sigmas)
   - [Guider 与 CFG](#110-guider-与-cfg)
     - [BasicGuider vs CFGGuider（版本陷阱）](#-重要-basicguider-vs-cfgguidercomfyui-版本陷阱)
     - [关于负向提示词](#关于负向提示词negative-prompt)
2. [工作流中各节点配置详解](#2-工作流中各节点配置详解)
3. [如何微调生图效果](#3-如何微调生图效果)
   - [场景一：去油腻/塑料感](#场景一画面油腻塑料感不够真实锐利flux-最常见问题)
4. [常见问题速查](#4-常见问题速查)
   - [BasicGuider 看不到 CFG？](#q-basicguider-为什么看不到-cfg-参数comfyui-版本陷阱)
   - [负向提示词要不要填？](#q-flux-推荐使用负向提示词吗)
   - [调参会涨显存吗？](#q-换采样器调-cfg改-max_shift-会涨显存吗)

---

## 1. 核心概念

### 1.1 文本编码器 (Text Encoder)

**一句话：把你说的话翻译成模型能"看懂"的数学表示。**

当你输入一句提示词（如 "a cat on a sofa"），计算机并不能直接理解这些文字。文本编码器的工作就是把这串文字转换成一个**高维向量**（一堆数字），这个向量捕捉了文字的语义信息——猫是什么、沙发是什么、"在...上面"是什么空间关系。

在扩散模型中，这个向量会在每一步去噪时注入模型，告诉模型"你要生成这样的内容"。

**FLUX 特殊之处**：它用了**两个**文本编码器而非一个，这是它语义理解能力远超 Stable Diffusion 的关键原因。

---

### 1.2 CLIP

**CLIP** (Contrastive Language-Image Pre-training) 是 OpenAI 在 2021 年发布的模型。它的核心创新是：

- 用 **4 亿对图文** 联合训练，让模型学会把相似的图文映射到相近的向量空间
- 训练目标很简单：给定一批图文对，让匹配的图文向量尽可能相似，不匹配的尽可能远离

```
图片：[猫的照片]  →  CLIP图像编码器  →  [0.3, -0.1, 0.8, ...]
文字："一只猫"    →  CLIP文本编码器  →  [0.2, -0.1, 0.7, ...]
                                         ↑ 这两个向量非常接近！
```

在图像生成中，我们只用 **CLIP 的文本编码器部分**（CLIP-L，约 235MB），它把你的提示词变成向量，作为生成条件喂给扩散模型。

**CLIP 的特点**：
- 擅长理解**物体、场景、风格**等视觉概念
- 对空间关系、数量、逻辑理解较弱（比如"左边三只右边两只"容易出错）
- 模型小、速度快

---

### 1.3 T5-XXL

**T5** (Text-to-Text Transfer Transformer) 是 Google 的语言模型，**T5-XXL** 是其最大版本（约 110 亿参数）。

与 CLIP 不同，T5 是一个**纯文本模型**——它没有见过任何图像，但它对语言的语法、语义、逻辑、数量关系理解极深。

**在 FLUX 中的作用**：
- FLUX 同时使用 CLIP-L 和 T5-XXL 两个编码器
- CLIP-L 提供**视觉概念对齐**（"猫长什么样"）
- T5-XXL 提供**深度语义理解**（"三只猫在傍晚阳光下"的精确含义）
- FLUX 内部有一个融合机制，将两个编码器的输出组合起来

**这就是 FLUX 提示词理解能力远超 SD 的根本原因**——T5-XXL 参数量是 CLIP-L 的几十倍，且是纯语言模型，对复杂描述的解析能力不在一个量级。

> 你的工作流中用 `t5xxl_fp8_e4m3fn.safetensors`（FP8 精度），将原始 ~9GB 的模型压缩到 4.6GB。

---

### 1.4 VAE (变分自编码器)

**VAE** = Variational Autoencoder（变分自编码器）

**一句话：VAE 是图像的压缩器和解压器。**

直接对 1024×1024×3 像素（约 300 万个值）做扩散去噪，计算量是天文数字。VAE 的巧妙之处在于：

```
编码（生成时不需要，训练时需要）：
  真实图像 [1024×1024×3]  →  VAE编码器  →  Latent [128×128×16]
                                          （压缩比 ~48:1）

解码（生图时用）：
  Latent [128×128×16]  →  VAE解码器  →  图像 [1024×1024×3]
```

**关键点**：
- 扩散模型的全部去噪过程都在 **latent 空间**（压缩空间）进行，速度快得多
- VAE 只在最后一步解码时才把 latent 变回图像
- FLUX 的 VAE（`ae.safetensors`，320MB）是专门训练的，和 SD 的 VAE 不通用
- **如果换 VAE 会影响图像的整体色调/细节/锐度**，但 FLUX 通常只用官方的

---

### 1.5 UNET / DiT (扩散模型主干)

**扩散模型的核心**——一个学习"从噪声中恢复图像"的神经网络。

工作原理（简化版）：
1. 训练时：给模型看一张加过噪声的图，问"噪声长什么样？"
2. 生成时：从纯噪声出发，每一步让模型预测并减去一点点噪声
3. 配合文本条件，模型会学会"去掉噪声后留下符合描述的内容"

**FLUX 使用的不是传统 UNET，而是 DiT (Diffusion Transformer)**——用 Transformer 架构替代卷积网络，效果更好、更吃显存。

你的工作流中用的是 `flux1-dev-Q5_K_M.gguf`：
- **flux1-dev** = FLUX.1 的 dev 版本（开源，非商业用途）
- **Q5_K_M** = GGUF 量化格式，5-bit，K-quant 中等质量
- 原始模型 ~23GB → 量化后 ~7.7GB，画质损失极小

---

### 1.6 Latent (潜在空间)

Latent 是 VA"压缩后的图像空间"。它不是人类可理解的像素，而是抽象的特征表示。

**EmptyLatentImage** 节点创建的不是真正的图像，而是一个 **空的 latent 张量**（全是占位值，没有内容）。它定义了：
- 输出图像的长宽比和尺寸
- batch size（一次生成几张）

真正的"内容"来自噪声和去噪过程。

---

### 1.7 噪声 (Noise)

**噪声 = 生成过程的起点，也是决定随机性的唯一来源。**

扩散模型的核心逻辑很反直觉：

1. 从**纯随机噪声**开始（完全看不出任何内容）
2. 每一步"猜"噪声的样子并减去一点
3. 经过 N 步后，噪声被逐渐替换为有意义的图像内容

**Seed（种子）的作用**：
- 同一个 seed → 每次生成相同的初始噪声 → **完全相同的输出**
- 不同 seed → 不同初始噪声 → 不同结果（构图、光照、细节都会变）
- Seed 是复现和迭代的关键：先找到好 seed，再微调其他参数

---

### 1.8 采样器 (Sampler)

采样器决定了 **"每一步如何从 latent 中去掉噪声"** 的计算策略。

常见采样器对比：

| 采样器 | 速度 | 质量 | 特点 |
|--------|------|------|------|
| **euler** | ⚡快 | ★★★★ | 简单高效，FLUX 默认推荐 |
| **heun** | 🐢慢 | ★★★★ | euler 的改进版，细节略好 |
| **dpmpp_2m** | ⚡快 | ★★★★★ | DPM-Solver，质量最好之一 |
| **dpmpp_3m_sde** | 🐢慢 | ★★★★★ | 带随机性的高阶采样，细节丰富 |
| **lcm** | ⚡⚡很快 | ★★★ | 专门配合 LCM LoRA，只需 4-8 步 |
| **uni_pc** | ⚡快 | ★★★★★ | 统一预测校正，质量好 |

> 你的工作流用 `euler` — 速度最快、质量足够好。追求细节可以换 `dpmpp_2m`。

---

### 1.9 调度器 (Scheduler) 与 Sigmas

**调度器控制"每一步分配多少去噪力度"**，输出一组 `sigmas`（噪声水平序列）。

FLUX 常见的调度器：

| 调度器 | 含义 | 适用场景 |
|--------|------|----------|
| **simple** | 线性均匀分配 | 标准生图，20 步够用 |
| **beta** | 类似余弦退火 | 细节更平滑 |
| **ddim_uniform** | DDIM 风格均匀 | 老派风格 |
| **sgm_uniform** | SGM 风格的标准化调度 | 配合某些蒸馏模型 |

**Steps（采样步数）的影响**：
- **10 步**：速度快，细节/构图可能不稳
- **20 步**：质量与速度的平衡点，推荐
- **30-50 步**：更稳定的细节，10 步后边际收益递减
- FLUX 比 SD 收敛更快，20 步通常足够

**Denoise 参数**：
- `1.0` = 从纯噪声开始（标准文生图）
- `<1.0` = 保留部分原图信息（图生图/高清修复用）

---

### 1.10 Guider 与 CFG

**Guider** 将模型和 conditioning（提示词编码）组合起来，控制**模型多大程度上遵循你的提示词**。

**CFG (Classifier-Free Guidance)** 是最关键的生图参数之一：

```
CFG = 1.0：模型几乎不"强迫"，画面偏软、对比度低、细节糊
CFG = 2.0：轻微引导，FLUX 实际推荐的起点
CFG = 3.5：较强引导，但 FLUX 上容易出现伪影/过饱和
CFG = 7-10：过度强迫，画面崩溃
```

#### ⚠️ 重要：BasicGuider vs CFGGuider（ComfyUI 版本陷阱）

新版 ComfyUI 重构了 Guider 节点，**两个节点行为完全不同**：

| 节点 | CFG 参数 | 实际 CFG 值 | 需要负向条件 |
|------|---------|------------|------------|
| **BasicGuider** | ❌ 无（UI 里看不到滑条） | 永远 **1.0**（硬编码） | 不需要 |
| **CFGGuider** | ✅ 有（可调滑条） | 你设的值（如 2.0） | **必须**接负向条件 |

源码证据：
```python
# Base CFGGuider 默认值
class CFGGuider:
    def __init__(self):
        self.cfg = 1.0      # ← 默认 1.0

# Guider_Basic 继承但从不修改 CFG
class Guider_Basic(CFGGuider):
    def set_conds(self, positive):  # 只设 positive，不调 set_cfg()
        ...                         # CFG 永远是 1.0
```

**如果你在 ComfyUI 里看到 BasicGuider 节点但找不到 CFG 滑条** — 这不是 bug，是它本来就没有。旧版 JSON 里的 `widgets_values: [3.5]` 是版本升级留下的孤儿数据，不会被读取。

> **本工作流已从 BasicGuider 迁移至 CFGGuider**，CFG 设为 2.0，同时新增了负向提示词节点（默认留空）。

#### FLUX 的 CFG 远低于 SD

- SD 通常 CFG 7-8
- FLUX 推荐 CFG **1.8-3.0**（T5-XXL 本身语义理解足够强）
- 超过 3.5 容易产生伪影、过饱和、塑料感
- **画面油腻/不够锐 → 降 CFG，不是升 CFG**

#### 关于负向提示词（Negative Prompt）

**FLUX 不推荐使用负向提示词**，这和 SD 完全不同。T5-XXL 的理解能力太强，泛化的负面词（`bad quality, ugly, blurry`）反而会干扰生成。

- 本工作流的负向节点**默认为空字符串** — 这是正确做法
- 只在遇到反复出现的**特定问题**时临时填入精准的负面词
- 不要堆砌 SD 风格的质量标签



---

## 2. 工作流中各节点配置详解

以下基于当前 `flux-gguf-basic.json` 的实际值。

### ModelSamplingFlux（节点 7）

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `max_shift` | **1.25** | 信噪比偏移上限。越大 = 细节越多越锐，但过高会不稳定 | 512 图用 0.8-1.0，1024 图用 1.0-1.3，2048 图用 1.3-1.5 |
| `base_shift` | 0.5 | 基础偏移。调整整体饱和度/对比度的噪声调度 | 通常不动，0.3-0.7 之间。降低→画面柔和；升高→高对比度 |
| `width` / `height` | 1024×1024 | 必须和 EmptyLatentImage 一致！告诉 Flux 当前分辨率以正确设置调度 | 严格匹配你的 latent 尺寸 |

### BasicScheduler（节点 14）

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `scheduler` | **beta** | 噪声调度策略。beta 比 simple 在低噪阶段停留更久，细节更充分 | beta=细节优先，simple=速度优先 |
| `steps` | **25** | 去噪步数 | 15=快速测试，25=当前推荐，30=追求质量 |
| `denoise` | 1.0 | 去噪起点 | 文生图固定 1.0；图生图可降到 0.6-0.8 |

### CFGGuider（节点 8）⚠️ 已从 BasicGuider 迁移

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `cfg` | **2.0** | 提示词遵循度（Classifier-Free Guidance） | 1.8-2.5 为 FLUX 推荐范围。越低越自然但可能偏离提示词，越高越听指令但可能过饱和 |

> **为什么换掉了 BasicGuider？** 新版 ComfyUI 的 BasicGuider 没有 CFG 参数，CFG 永远硬编码为 1.0。需要用 CFGGuider 才能有效控制引导强度。

### 负向提示词 CLIPTextEncode（节点 15）🆕

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `text` | **(空)** | 负向 conditioning，告诉模型"不要生成什么" | **FLUX 推荐留空**。只在遇到特定问题（如画面总出现水印）时精准填入，不要堆砌泛化负面词 |

> 空负向提示词不影响 CFG 的工作方式——CFG 正常生效，只是"负面参照"为空白噪声。

### EmptyLatentImage（节点 6）

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `width` / `height` | 1024×1024 | 输出尺寸 | FLUX 推荐 1024×1024 或 896×1152 等。不要用 SD 的 512 尺寸 |
| `batch_size` | 1 | 一次生成几张 | 显存够可以 2-4 张一起跑 |

### RandomNoise（节点 9）

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `noise_seed` | 882259498755905 | 随机种子 | 固定=可复现，随机化=探索多样性。右键种子可切换 `fixed` / `increment` / `randomize` 模式 |

> `control_after_generate`：种子旁的辅助控制（`fixed` / `increment` / `decrement` / `randomize`），决定每次生成后种子如何变化。当前为 `fixed`——每次生成后用同一 seed。

### KSamplerSelect（节点 13）

| 参数 | 当前值 | 作用 | 调节建议 |
|------|--------|------|---------|
| `sampler_name` | **dpmpp_2m** | 采样算法。二阶 ODE 求解器，边缘更锐、纹理更丰富 | 见上文采样器对比表。euler 偏软偏糊，dpmpp_2m 细节更好 |

---

## 3. 如何微调生图效果

### 3.1 按场景的推荐调参策略

#### 场景一："画面油腻/塑料感、不够真实锐利"（FLUX 最常见问题）

这是默认参数下 FLUX 的典型表现——过度光滑、像 CG 渲染。**优先级从高到低**：

1. **降 CFG** — FLUX 高 CFG 会加剧塑料感，2.0 是安全起点（SD 用户要打破高 CFG 的习惯）
2. **换采样器** — `euler` → `dpmpp_2m`，边缘更锐、纹理真实感更强
3. **换调度器** — `simple` → `beta`，在低噪阶段分配更多去噪力，细节更充分
4. **加 steps** — 20 → 25（配合 dpmpp_2m），去噪更彻底，不残留模糊
5. **提 max_shift** — 1.15 → 1.25，增加细节锐度
6. **优化提示词** — 加入 `raw photo, film grain, textured, sharp focus, no airbrushing`

> ⚠️ 以上 5 个参数改动**都不会增加显存占用**，只有 steps 增加会略微延长生成时间。

```
去塑料感关键词：
  raw candid photograph, natural skin texture, fine details, 
  film grain, sharp focus, fujifilm, kodak portra, available light

避免（容易触发塑料感）：
  smooth, perfect skin, airbrushed, retouched, CGI, 3d render,
  octane render, unreal engine, beautiful, stunning
```

#### 场景二："画面不太符合我的描述"

**优先级从高到低**：
1. **重写提示词** — FLUX 对自然语言理解极强，直接用完整句子描述，不要用标签式提示词（如 SD 的 `masterpiece, 1girl, ...`）
2. **调 CFG** — 提到 4-5 让模型更听你的，但别超过 6
3. **调 max_shift** — 稍降到 0.9-1.0 让模型更稳定

```
FLUX 好提示词示例：
"A warm-lit living room in late afternoon, a fluffy white cat with grey tabby patches 
sleeping curled up on a velvet green sofa, golden sunlight streaming through sheer curtains, 
shallow depth of field, photorealistic, cozy atmosphere"

而非标签式：
"cat, sofa, living room, sunlight, golden hour, 4k, photorealistic"
```

#### 场景三："画面细节不够，有点模糊"

1. **增加 steps** — 从 20 提到 25-30
2. **换采样器** — 从 `euler` 换 `dpmpp_2m` 或 `dpmpp_3m_sde`
3. **换调度器** — 从 `simple` 换 `beta`
4. **检查分辨率** — 确保是 1024×1024 或更高，不要用 SD 尺寸

#### 场景四："色彩太浓/太淡"

1. **调 CFG** — 色彩过饱和 → 降 CFG（2.5-3.0）；色彩太淡 → 升 CFG（4.0-4.5）
2. **调 base_shift** — 降低（如 0.3）让画面柔和，升高（如 0.7）增加对比度
3. **优化提示词** — 明确描述想要的色调，如 `muted tones`, `warm color palette`, `desaturated`

#### 场景五："构图不对，主体位置错了"

1. **换 seed** — 初始噪声会大幅影响构图
2. **更具体描述位置** — `on the left`, `in the foreground`, `centered`, `in the corner`
3. **描述构图** — `rule of thirds composition`, `wide shot`, `close-up portrait`
4. 如果还不行，考虑用 ControlNet/IP-Adapter 等更高级的控制手段（需要额外节点）

### 3.2 系统性调试流程

```
第 1 轮：找到合适的 seed
  ├─ 固定所有参数，换 5-10 个 seed
  ├─ 找到构图/氛围最接近目标的 seed
  └─ 后续都在这个 seed 上调

第 2 轮：调整提示词
  ├─ 用完整句子，别用标签
  ├─ 加入风格词：photorealistic / oil painting / cinematic / anime style
  ├─ 加入光照：golden hour / studio lighting / moody / backlit
  └─ 加入细节：intricate details / sharp focus / texture

第 3 轮：精细调参
  ├─ CFG: 微调 0.2 一档（1.8 → 2.0 → 2.2），找到最佳平衡
  ├─ Steps: 先保持 25，不够再加到 30
  ├─ max_shift: 1.15 → 1.25 → 1.35 直到满意
  └─ 采样器/调度器: 固定 dpmpp_2m + beta，一般不需要再调

第 4 轮：如果需要可加 LoRA
  └─ 加载风格 LoRA 或角色 LoRA，强度一般 0.7-0.85
```

### 3.3 各参数对画面的影响速查表

| 你想... | 调哪个 | 怎么调 |
|---------|--------|--------|
| 去油腻/塑料感 | **CFG** | 降低（3.5 → 1.8-2.2） |
| 去油腻/塑料感 | **sampler + scheduler** | euler+simple → dpmpp_2m+beta |
| 更锐利的细节 | **max_shift** | 升高（1.15 → 1.25-1.35） |
| 构图/布局不一样 | **seed** | 换一个随机值 |
| 更忠实于提示词 | **CFG** | 增大（1.5 → 2.5） |
| 让模型多点创意 | **CFG** | 减小（2.5 → 1.5） |
| 更多细节 | **steps** | 增大（25 → 30） |
| 更快出图 | **steps** | 减小（25 → 15） |
| 画质更好 | **sampler** | euler → dpmpp_2m |
| 画面更柔和 | **base_shift** | 降低（0.5 → 0.3） |
| 画面更锐利/高对比 | **base_shift** | 升高（0.5 → 0.7） |
| 色彩不自然/过饱和 | **CFG** | 降低（这是 FLUX 高 CFG 的典型症状） |
| 不同分辨率出图 | **width/height + max_shift** | 同步修改三处* |

> \*三处需同步：EmptyLatentImage 的宽高、ModelSamplingFlux 的宽高、以及 max_shift 按分辨率调整。

> ⚠️ 以上所有参数改动**都不会增加显存**，只有 steps 和 sampler 类型会影响生图速度。

> \*三处需同步：EmptyLatentImage 的宽高、ModelSamplingFlux 的宽高、以及 max_shift 按分辨率调整。

### 3.4 GGUF 量化级别选择

如果你的 7.7GB Q5_K_M 模型需要更小或更大的版本：

| 量化 | 大小 | 质量 | 显存需求 | 适合 |
|------|------|------|---------|------|
| Q4_K_S | ~6.2 GB | ★★★ | 8GB GPU | 最省显存，质量尚可 |
| Q4_K_M | ~6.8 GB | ★★★½ | 8-10GB GPU | 性价比高 |
| **Q5_K_M** | **~7.7 GB** | **★★★★** | **10-12GB GPU** | **推荐，你当前用的** |
| Q6_K | ~8.9 GB | ★★★★½ | 12-16GB GPU | 接近原版 |
| Q8_0 | ~11.5 GB | ★★★★★ | 16GB+ GPU | 几乎无损 |

---

## 4. 常见问题速查

### Q: FLUX 能用 SD 的 VAE 吗？
**不能。** FLUX 的 latent 空间尺寸（128×128×16）和 SD（64×64×4）完全不同，必须用 FLUX 官方的 `ae.safetensors`。

### Q: 为什么我的显存不够？
| 组件 | 显存占用 |
|------|---------|
| UNET (Q5_K_M GGUF) | ~7.7 GB 加载 + 推理临时空间 |
| T5-XXL (FP8) | ~4.6 GB |
| CLIP-L | ~235 MB |
| VAE | ~320 MB |

总计约 13GB+。如果显存不够：
- 换更小量化的 UNET（Q4_K_S，~6.2GB）
- 使用 `--lowvram` 启动 ComfyUI
- 使用 T5 的 Q8 或更小版本

### Q: 提示词应该用中文还是英文？
**英文。** T5-XXL 和 CLIP-L 都是在英文上训练的，虽然 T5 有一定多语言能力，但英文效果最好。FLUX 不支持中文生图。

### Q: 1024 分辨率生图太慢怎么办？
- 先用 512×512 + steps=15 快速迭代（找 seed + 调提示词）
- 确定方案后再用 1024×1024 完整生成
- 注意：FLUX 的 512 训练不如 1024 充分，低分辨率可能画质下降

### Q: BasicGuider 为什么看不到 CFG 参数？（ComfyUI 版本陷阱）

**新版 ComfyUI 的 BasicGuider 移除了 CFG 参数**，CFG 被硬编码为 1.0。源码中 `Guider_Basic` 继承 `CFGGuider` 但从不调用 `set_cfg()`，所以永远是 1.0。旧版 JSON 里残留的 `widgets_values: [3.5]` 是版本升级留下的孤儿数据，不会被读取。

**解决**：换成 `CFGGuider` 节点，它需要额外连接负向 conditioning（可以留空）。参见 1.10 节详细说明。

### Q: FLUX 推荐使用负向提示词吗？

**不推荐。** T5-XXL 对任何输入都会认真"理解"，堆砌泛化负面词（`bad quality, blurry` 等）反而会干扰生成。工作流中负向节点默认留空是正确的做法。只在遇到多次反复出现的特定问题时才临时填入精准的负面词。

### Q: 换采样器/调 CFG/改 max_shift 会涨显存吗？

**不会。** 这些改动的都是数学参数或算法选择，不涉及加载新的模型权重或多个 latent 并行，**显存峰值完全不变**。唯一的代价是：steps 从 20→25 多跑 25% 时间，dpmpp_2m 每步比 euler 慢约 10-20%。不 OOM，放心调。

### Q: GGUF 和普通 safetensors 有什么区别？
- **safetensors**：原始权重，完整精度，慢但画质最高
- **GGUF**：量化压缩，速度快、省显存，画质损失很小
- 对于大多数用户，GGUF Q5_K_M 是最佳平衡点

---

## 附录：你的工作流连线图（当前版本）

```
UnetLoaderGGUF                 DualCLIPLoaderGGUF         EmptyLatentImage
  (flux1-dev-Q5_K_M.gguf)        (t5xxl + clip_l)          (1024×1024, batch=1)
       │                               │                         │
       ▼                               ├──────────────────┐      │
ModelSamplingFlux                      │                  │      │
  (max_shift=1.25                     ▼                  ▼      │
   base_shift=0.5)          CLIPTextEncode(正)   CLIPTextEncode(负)
       │                     (提示词→正向)        (空→负向)    │
       ├──────────┐                │                  │        │
       │          │                ▼                  ▼        │
       │          │           CFGGuider ◄────────────┘        │
       │          │             (cfg=2.0)                     │
       │          │                  │                         │
       │          │                  ▼                         │
       │          │         SamplerCustomAdvanced ◄────────────┘
       │          │           ▲           ▲         ┌──────────┘
       │          │           │           │         │
       │          │     RandomNoise   KSamplerSel  │
       │          │     (seed+fixed)  (dpmpp_2m)   │
       │          ▼                                │
       │     BasicScheduler                        │
       │     (beta,steps=25,denoise=1.0)───────────┘
       │
       │ (模型同时送给 scheduler)
       │
  [不参与下面]     SamplerCustomAdvanced
                       │
                       ▼
                   VAEDecode ◄── VAELoader (ae.safetensors)
                       │
                       ▼
                   SaveImage → ComfyUI/output/
```
