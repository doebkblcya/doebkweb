---
title: "FLUX.1 Fill 局部重绘部署指南"
date: 2026-07-26
summary: "FLUX.1 Fill 遮罩局部重绘与 Outpainting 的部署配置和应用场景"
---

# FLUX.1 Fill + 遮罩 — 局部重绘部署与应用指南

> 适用场景：换衣物、换背景、修局部、去物体、画面扩展（outpainting）
> 硬件约束：12GB VRAM / 24GB RAM（WSL2）

---

## 目录

1. [为什么需要 Fill 而非基础 img2img](#1-为什么需要-fill-而非基础-img2img)
2. [flux1-dev vs flux1-fill-dev 技术对比](#2-flux1-dev-vs-flux1-fill-dev-技术对比)
3. [模型下载与部署](#3-模型下载与部署)
4. [工作流结构](#4-工作流结构)
5. [遮罩的三种创建方式](#5-遮罩的三种创建方式)
6. [参数调节速查](#6-参数调节速查)
7. [实战场景](#7-实战场景)

---

## 1. 为什么需要 Fill 而非基础 img2img

基础 img2img 的核心操作是**降噪法**（`denoise < 1.0`），改变的是整张图：

```
基础 img2img：全局操作                 Fill + 遮罩：局部操作
┌──────────────────┐                 ┌──────────────────┐
│  ████████████████ │                 │                  │
│  ████████████████ │ 整张图都在变化   │   ▓▓▓▓▓▓▓▓▓▓   │ 只有白色遮罩区变化
│  ████████████████ │ 脸→歪           │                  │ 脸/背景→不变
│  ████████████████ │ 背景→也变了      │                  │
└──────────────────┘                 └──────────────────┘
```

**根本问题**：你只是想换一件衣服，但降噪法没有任何机制区分"要改的部分"和"要保留的部分"。结果要么改动不够（denoise 太低），要么整张图面目全非（denoise 太高）。没有中间甜点。

**Fill 解决了什么**：模型在训练时被教会了一件事——"盯着图中被挖掉的区域，用周围像素的上下文来合理填补"。这个上下文感知能力是基础 img2img 完全不具备的。

---

## 2. flux1-dev vs flux1-fill-dev 技术对比

| 维度 | flux1-dev | flux1-fill-dev |
|------|-----------|----------------|
| **输入通道** | 噪声 latent（1 组） | 噪声 latent + masked latent + mask（3 组） |
| **训练数据** | 完整图 → 加噪 → 去噪恢复 | 完整图 → 随机挖洞 → 去噪填补 |
| **核心能力** | 从零创造画面 | 看着周围，填补空缺 |
| **提示词遵循** | 作用于全图 | 仅作用于遮罩区域 |
| **遮罩感知** | 无（不接收 mask 输入）| 有（mask 是模型的一个专用输入通道） |
| **局部编辑** | 做不到 | 专为此而生 |

**关键理解**：Fill 不是 dev 的"插件"或"升级版"。它是一个独立训练出来的不同模型。把它替换掉 dev 的 UNET 后，整个管线从"自由创作"变为"上下文感知填补"。

---

## 3. 模型下载与部署

### 3.1 模型选型（基于 12GB 显存）

Fill 模型比 dev 略大（多了 mask 处理层），推荐对应量化级别：

| 量化 | 大小 | 显存 | 质量 | 推荐 |
|------|------|------|------|------|
| Q4_K_M | ~7.0 GB | 与当前 dev 持平 | ★★★½ | 保守选择 |
| **Q5_K_M** | **~8.0 GB** | 略高 ~0.3 GB | **★★★★** | **推荐** |
| Q6_K | ~9.2 GB | 较紧张 | ★★★★½ | 可能 swap |

> 你当前 dev 用 Q5_K_M 跑得动（~7.7GB），Fill 的 Q5_K_M 约 8.0GB，仅多 ~0.3GB，12GB 显存仍有余量。如果不放心可以先用 Q4_K_M。

### 3.2 下载地址

Fill 模型的 GGUF 量化版（City96 社区制作）：

```
https://huggingface.co/city96/FLUX.1-Fill-dev-gguf

推荐文件:
  flux1-fill-dev-Q5_K_M.gguf    (~8.0 GB)
  flux1-fill-dev-Q4_K_M.gguf    (~7.0 GB，备选)
```

也可以从 Black Forest Labs 官方下载 `flux1-fill-dev.safetensors`（~24GB），然后自行量化，但 GGUF 社区版足以应对。

### 3.3 放置位置

```bash
# 和当前 dev 模型放同一目录
mv flux1-fill-dev-Q5_K_M.gguf \
  /home/doebk/ai/image-generation/ComfyUI/models/unet/
```

放置后的目录：

```
ComfyUI/models/unet/
├── flux1-dev-Q5_K_M.gguf          # 文生图用
└── flux1-fill-dev-Q5_K_M.gguf     # Fill 用
```

### 3.4 其他依赖

**不需要额外下载。** Fill 复用了你现有的：
- CLIP-L（clip_l.safetensors）
- T5-XXL（t5xxl_fp8_e4m3fn.safetensors）
- VAE（ae.safetensors）

唯一变化就是 UNET 节点里选的模型从 `flux1-dev` 换成 `flux1-fill-dev`。

---

## 4. 工作流结构

### 4.1 核心管线

```
                            ┌─────────────────────┐
                            │    LoadImage         │
                            │  (你要修改的原图)      │
                            └──────┬──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌──────────┐   ┌──────────┐   ┌──────────┐
            │ VAEEncode│   │VAEEncode │   │ 遮罩处理  │  ← ComfyUI 内置节点:
            │          │   │          │   │ (白色=改) │    LoadImage → MaskEditor
            └────┬─────┘   └────┬─────┘   └────┬─────┘
                 │              │              │
                 ▼              ▼              ▼
            latent_image   mask_latent      mask
            (原图latent)   (可选备用)      (黑白遮罩)
                 │                             │
                 └──────────┬──────────────────┘
                            ▼
              ┌─────────────────────────┐
              │  KSampler (Fill 去噪)    │ ← 只处理遮罩白色区域
              │  denoise: 0.6~0.9        │
              └────────────┬────────────┘
                           ▼
                   ┌──────────────┐
                   │  VAEDecode   │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │  SaveImage   │
                   └──────────────┘
```

### 4.2 与你现有工作流的区别

你当前的文生图工作流（`flux-gguf-basic.json`）结构是：

```
EmptyLatentImage → RandomNoise → SamplerCustomAdvanced → VAEDecode
```

Fill 工作流的关键替换：

| 旧节点 | 新节点 | 原因 |
|--------|--------|------|
| `EmptyLatentImage` | `VAEEncode`（输入图片） | 从"空 latent"变为"已编码的原图 latent" |
| `RandomNoise` | 保留（不变） | 噪声仍然要加 |
| 无遮罩 | `LoadImage` + MaskEditor → `VAEEncode`（mask） | Fill 模型需要遮罩通道 |
| `UnetLoaderGGUF` | `UnetLoaderGGUF` | 只换模型名，节点不变 |
| `denoise=1.0` | `denoise=0.7~0.9` | Fill 场景通常用稍低的 denoise |

### 4.3 关键参数

| 参数 | Fill 推荐值 | 说明 |
|------|------------|------|
| **denoise** | 0.7 - 0.9 | Fill 的值比基础 img2img 高。太低（<0.5）遮罩区变化不足；太高（1.0）遮罩区与周围光影不一致 |
| **CFG** | 2.0 - 3.0 | 与 dev 类似，2.0 是安全起点 |
| **steps** | 25 - 30 | 与 dev 一致 |
| **sampler** | dpmpp_2m | 细节更好 |
| **scheduler** | beta | 细节优先 |

---

## 5. 遮罩的三种创建方式

### 方式 A：手绘遮罩（最灵活，最常用）

在 ComfyUI 中：

1. 添加 `LoadImage` 节点，选择原图
2. **右键点击节点 → "Open in MaskEditor"**
3. 用画笔在原图上涂抹：
   - **白色** = 要修改的区域（会被 Fill 重绘）
   - **黑色** = 保留不变的区域
4. 保存后自动生成遮罩输出

```
示例：换衣服
  原图：人物全身照
  遮罩：用画笔涂白上衣区域（包括边缘羽化）

  结果：只有上衣区域被重绘，脸、裤子、背景完全不变
```

### 方式 B：抠图生成遮罩（适合换背景 / 全身衣物）

安装 `rembg` 节点后：

```
LoadImage → rembg(移除背景) → 人物轮廓遮罩 → 反转 = 背景遮罩
                                                │
                                                ▼
                                           Fill 只改背景
```

### 方式 C：语义分割（适合精确选中物体）

需要额外安装 GroundingDINO / SAM 节点（但它们会额外占用显存，12GB 环境不建议常驻）。

---

## 6. 参数调节速查

### 按问题的调试策略

| 问题 | 原因 | 解决 |
|------|------|------|
| 遮罩区变化不够/没变 | denoise 太低 | 提高到 0.8-0.9 |
| 遮罩区与周围融合不自然 | denoise 太高 | 降低到 0.65-0.75 |
| 遮罩边缘有接缝 | 遮罩边缘太硬 | 在 MaskEditor 中用羽化笔刷（软的边缘） |
| 遮罩区内容不符合提示词 | CFG 太低 | 提高到 2.5-3.0 |
| 遮罩区过于塑料感 | CFG 太高 | 降低到 2.0，检查提示词 |
| 生成的内容光影与周围不一致 | 提示词没描述光照 | 加入 `matching lighting, consistent shadows` |
| 纹路/材质不自然 | steps 不够 | 提高到 30 |

### 羽化的重要性

遮罩边缘**不能是硬边界**（0/1 二值）。在 MaskEditor 中：
- 用**软画笔**（低硬度）
- 遮罩边缘有 3-5 像素的灰色过渡
- 这让 Fill 有"过渡区"来平滑地融合新旧内容

---

## 7. 实战场景

### 场景一：换上衣

```
原图：  人物半身照，穿白色T恤
遮罩：  涂白 T恤区域（边缘羽化）
提示词："wearing a black leather jacket, realistic fabric texture, 
         matching the same lighting, consistent with the scene"
denoise: 0.8
CFG:     2.5

预期：T恤变成皮夹克，褶皱/光影与周围协调
```

### 场景二：换背景

```
原图：  人物在前景
遮罩：  涂白背景区域，留黑人物
提示词："a sunlit garden with purple flowers, shallow depth of field,
         natural outdoor lighting, photorealistic"
denoise: 0.9
CFG:     2.0

预期：背景完全替换，人物不受影响
```

### 场景三：去除物体

```
原图：  风景照里有个垃圾桶
遮罩：  涂白垃圾桶 + 周围小范围
提示词：(留空或 "natural continuation of the scene")
denoise: 0.85
CFG:     2.0

预期：垃圾桶被周围的草地/墙面自然填补
```

### 补丁法：多次小遮罩 vs 一次大遮罩

```
一次大遮罩：
  ┌────────────────┐
  │    ████████    │ 一整块涂白 → 一次生成
  │    ████████    │ 风险：大面积内容可能不协调
  └────────────────┘

多次小遮罩（推荐）：
  ┌────────────────┐
  │   ▓▓   ▓▓▓    │ 分区域、分批生成
  │   ▓▓   ▓▓▓    │ 每次只改一小块
  └────────────────┘
  更安全、更可控、融合质量更高
```

---

## 补充：Outpainting（画面扩展）

Fill 还能做"往外扩展"——比原图更大的画面：

1. 新建一个比原图大的空白画布
2. 把原图贴到中间
3. 遮罩涂白四周空白区
4. Fill 自动生成新内容，与中间原图无缝衔接

适合把横图扩展为竖图、加天空、延展背景等。

---

## 附录：与你现有环境的关系

```
你当前的文生图管线：flux1-dev Q5_K_M（~7.7GB）
Fill 管线：          flux1-fill-dev Q5_K_M（~8.0GB）

两者共享：
  ├── CLIP-L (0.2GB)
  ├── T5-XXL (4.6GB)
  └── VAE (0.3GB)

切换方式：
  在 UnetLoaderGGUF 节点里把模型名从
    "flux1-dev-Q5_K_M.gguf"   →  "flux1-fill-dev-Q5_K_M.gguf"
  然后加入 LoadImage + VAEEncode + 遮罩输入即可

不需要：
  ✗ 额外安装 nodes
  ✗ 额外下载 CLIP/VAE
  ✗ 改动系统配置

显存影响：
  净增约 +0.3 GB（Fill 比 dev 略大），12GB 仍够用
```
