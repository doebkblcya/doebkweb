---
title: "MustDo 语音转文字模块优化方案"
date: 2026-07-26
summary: "ASR 语音识别模块的性能优化记录，含模型选型与推理加速"
---

# MustDo 语音转文字模块优化方案

## 当前状态

### 架构概述

MustDo 后端（FastAPI + SQLite，部署在 2C2G VPS）通过 WebSocket 代理模式对接讯飞语音听写 API：

```
浏览器/小程序                   FastAPI 后端                      讯飞云
─────────────                  ────────────                    ────────
WebSocket ──────> voice.py ────> voice_stream.py ────> iflytek.py ────> wss://iat-api.xfyun.cn
 PCM chunk               认证/校验          编排/事件流          协议封装
```

### 数据流

```
1. 前端按住说话 → 浏览器采集 PCM（16kHz/16bit/mono）
2. 前端先发 WebSocket 给后端完成认证
3. 后端连接讯飞 WS，成功后向前端发送 ready 事件
4. 前端收到 ready 后开始发送 PCM chunk
5. 后端按讯飞协议拆成 1280B/40ms 音频帧代理转发
6. 讯飞返回 interim/partial 结果 → 后端即时推给前端
7. 前端松手发 end 事件 → 后端发结束帧 → 等待 final 结果
8. final 结果返回前端 → POST /api/todos/ai → DeepSeek 解析 → 入库
```

### 模块边界

代码抽象清晰，ASR 供应商被完全隔离在 `services/iflytek.py` 中：

| 模块 | 职责 | 对外接口 |
|---|---|---|
| `routers/voice.py` | WebSocket/HTTP 边界，认证，响应 | FastAPI endpoint |
| `services/voice_stream.py` | 编排：音频流 → ASR → 事件流 | `transcribe_pcm_stream()` |
| `services/iflytek.py` | 纯讯飞协议：鉴权 URL、音频帧、结果解析 | `IflytekIatClient` / `IflytekIatSession` |

`IflytekIatSession` 暴露的核心接口：

```python
await session.send_pcm(chunk)              # 喂音频字节
await session.finish()                     # 结束标记
async for event in session.recognition_events():
    # event.text        → 当前 chunk 新增的文本
    # event.transcript  → 累积完整文本
    # event.is_final    → 是否为最终结果
```

前端只认识三种事件类型：`ready`、`partial`、`final`，不关心后端用哪个 ASR 供应商。

### 存在的问题

**讯飞免费 API 延迟过高。** 免费层存在：

- 并发限制和低优先级队列
- WebSocket 连接排队
- 转写请求排队

实测用户说话结束后 2-5 秒才能拿到最终结果，加上 DeepSeek 解析的 1-2 秒，用户感知延迟达到 4-7 秒。对于语音待办这种短交互场景，体验明显不够理想。

---

## 候选方案对比

### 约束条件

- 当前 VPS 为 2C2G，跑着 FastAPI + SQLite + 前端静态托管
- **不能在同一台 VPS 上部署模型**（内存不足）
- 语音平均时长 <10 秒，对话场景，对响应速度敏感
- 后端 WebSocket 代理架构已成熟，前端无 ASR 耦合

### 方案一：本地部署 SenseVoice-Small

| 维度 | 评估 |
|---|---|
| 模型大小 | ~65MB（ONNX Int8 量化） |
| 运行所需内存 | ~500-800MB（模型 + Python + ONNX Runtime） |
| 10 秒音频处理耗时 | ~0.6s（CPU）/ ~0.06s（GPU） |
| 流式支持 | ✅ FunASR WebSocket，端到端延迟 <200ms |
| 中文准确率 | ~93%（日常口语场景） |
| 单次成本 | 几乎为 0 |
| 运维 | 需单独一台 2C4G VPS（月费约 ¥30-60）或升级现有 VPS |

**结论：不适合。** 2C2G VPS 跑不动，必须加机器。在 MustDo 当前体量下，加一台服务器的月费已经超过云 API 的全部开销。

### 方案二：豆包 ASR（火山引擎）

| 维度 | 评估 |
|---|---|
| 部署方式 | 云 API，支持 WebSocket 流式 |
| 延迟 | ~500ms（端到端，推测） |
| 中文准确率 | ⭐ 评测中优于讯飞（4.8 vs 1） |
| 单次成本（5s 语音） | ~0.007 元 |
| 每月 1000 次 | ~7 元 |
| 新用户额度 | 企业认证 20 小时免费 |
| 需要改代码量 | ~100-150 行 |

**结论：可选。** 中文效果最好，但延迟比 Deepgram 高约 200ms。

### 方案三：Deepgram Nova-3（推荐）

| 维度 | 评估 |
|---|---|
| 部署方式 | 云 API，支持 WebSocket 流式 |
| 延迟 | **<300ms**（业界最快） |
| 端到端延迟（含网络） | ~300ms（官宣 sub-300ms） |
| 中文准确率 | 中等偏上，日常口语够用 |
| 流式中间结果 | ✅ interim_results 实时推送 |
| 单次成本（5s 语音） | ~0.0004 元 |
| 每月 1000 次 | ~0.4 元 |
| 新用户额度 | **$200**（够日常使用数年） |
| 需要改代码量 | ~100-150 行 |

**结论：推荐。** 延迟最低，成本最低，改动最小。

### 综合对比

| | 讯飞免费（现状） | SenseVoice 自部署 | 豆包 ASR | Deepgram |
|---|---|---|---|---|
| 延迟 | 2-5s | <200ms | ~500ms | **<300ms** |
| 中文准确率 | ~91% | ~93% | **最高** | 中等 |
| 月成本（1000 次） | 0 元 | ~50 元（加服务器） | ~7 元 | **~0.4 元** |
| 加服务器 | 不需要 | **需要** | 不需要 | 不需要 |
| 代码改动 | 0（基准） | ~200 行 + 部署 | ~100-150 行 | **~100-150 行** |
| 运维 | 0 | 需要管模型服务 | 0 | 0 |
| 免费额度 | 5 小时 | 0 | 20 小时 | **$200** |

---

## 推荐方案：切换到 Deepgram

### 为什么是 Deepgram

1. **延迟最低**：<300ms 端到端，比讯飞免费 API 快 10-15 倍
2. **成本趋零**：MustDo 的用量下每月不到 1 元
3. **无需加服务器**：2C2G VPS 继续用，只负责 WebSocket 转发
4. **改动最小**：替换一层协议实现，架构不变，前端不变
5. **$200 免费额度**：在 MustDo 的量级下基本等于永久免费

### 预期效果

用户说一句 5 秒的话：

| 阶段 | 现状（讯飞免费） | 优化后（Deepgram） |
|---|---|---|
| WebSocket 连接 | 1-2s（排队） | ~200ms |
| 中间结果出现 | 无 | ~300ms（边说话边出字） |
| 最终结果返回 | 2-5s | <300ms（说话结束即返回） |
| + DeepSeek 解析 | 1-2s | 1-2s |
| **总延迟（用户感知）** | **4-7s** | **~1.5s** |

如果利用 Deepgram 的流式中间结果，在用户说话过程中就把 partial transcript 喂给 DeepSeek 预热分析，总延迟还能进一步压缩到 1 秒以内。

---

## 实施计划

### 代码改动范围

```text
backend/app/services/
  deepgram.py         ← 新增：Deepgram WebSocket 客户端（~120 行）
  voice_stream.py     ← 改动：import 替换 + 参数适配（~5 行）
  iflytek.py          ← 保留：兼容回退或直接删除

backend/.env.example  ← 改动：新增 Deepgram 配置项
backend/.env          ← 改动：填写 Deepgram API Key
```

### Deepgram 协议适配

讯飞和 Deepgram 的核心差异：

| | 讯飞 | Deepgram |
|---|---|---|
| 连接方式 | wss + HMAC-SHA256 签名 URL | wss + API Key header |
| 音频格式 | 1280B/40ms 固定帧 | 任意 chunk，直接转发 |
| 协议帧 | JSON frame（含 base64 音频） | 二进制音频 + JSON 控制消息 |
| 结果格式 | `{code, data: {result, status}}` | `{type: "Results", is_final: bool, channel: {alternatives}}` |
| 连接成功信号 | 自定义 ready | Deepgram 连接即 ready |

需要新写的 `DeepgramSession` 接口保持一致：

```python
class DeepgramSession:
    async def send_pcm(self, chunk: bytes) -> None: ...
    async def finish(self) -> None: ...
    async def recognition_events(self) -> AsyncIterator[RecognitionEvent]: ...
```

`voice_stream.py` 中 `transcribe_pcm_stream` 只需改 `IflytekIatClient → DeepgramClient`，其余编排逻辑不变。

### 需要新增的配置项

```bash
# .env
DEEPGRAM_API_KEY=xxx
DEEPGRAM_MODEL=nova-3            # 可选
DEEPGRAM_LANGUAGE=zh-CN          # 可选，中文优化
```

### 实施步骤

1. **注册 Deepgram**：https://deepgram.com，获取 API Key，领取 $200 免费额度
2. **编写 `deepgram.py`**：实现 Deepgram WebSocket 协议封装，接口对齐 `iflytek.py`
3. **修改 `voice_stream.py`**：替换 import，适配参数
4. **本地测试**：用测试音频验证链路
5. **部署上线**：更新 `.env` 配置，重启服务
6. **观察**：保留讯飞代码和配置项，通过环境变量切换，便于回退

### 回退方案

在 `config.py` 中新增 `ASR_PROVIDER` 配置项：

```bash
ASR_PROVIDER=deepgram  # 可选 iflytek / deepgram
```

`voice_stream.py` 根据配置动态选择 provider，万一 Deepgram 出问题，切回讯飞只需要改一个环境变量重启。

---

## 成本核算

### 当前（讯飞免费）

- 免费，但延迟 2-5 秒
- 超过免费额度后：2-4.95 元/小时 ≈ 每次 0.03-0.07 元（按 5 秒语音）

### 优化后（Deepgram）

- 单次 5 秒语音：~0.0004 元
- 每天 200 次：~0.08 元
- 每月：~2.5 元
- $200 免费额度下：等于免费

### 为什么不做本地部署

| 方案 | 月成本 | 延迟 |
|---|---|---|
| SenseVoice + 一台 2C4G VPS | ~50 元 | <200ms |
| 升级到 4C8G VPS 跑模型+后端 | ~100 元 | <200ms |
| **Deepgram 云 API** | **<3 元** | **<300ms** |

在 MustDo 这个体量下，多花 50 元/月来省 100ms 延迟的性价比极低。200ms vs 300ms 的端到端延迟差异在用户体验上是不可感知的。

---

## 其他优化建议

### 1. 利用流式中间结果预热 AI

当前架构是拿到 final transcript 之后再调 DeepSeek。Deepgram 可以在用户说话过程中持续返回 interim results：

```text
Time ──────────────────────────────────────────>
用户:     [明天] [下午] [三点] [提醒] [我] [开会]
Deepgram:   [明天] [明天下午] [明天下午三点]...
DeepSeek:              [预热分析中...]
说话结束:                                        [final: "明天下午三点提醒我开会"]
DeepSeek:                                        [确认，0.3s 出结果]
```

前端 UI 可以在用户松手前就展示 "正在分析…"，松手后几乎即时出结果。这个优化只需要在 `voice_stream.py` 中加入 DeepSeek 预热逻辑，前端不需要改。

### 2. 10 秒限制收紧

当前 `MAX_AUDIO_SECONDS=30`，可以收紧到 10 秒。待办语音不需要 30 秒那么长。更短的超时也意味着更短的 DeepSeek prompt，解析速度更快。

### 3. 超时兜底逻辑保留

当前 `voice_stream.py` 中已有的超时兜底逻辑（final 超时降级使用 partial）体现了很好的容错意识，替换 Deepgram 后保留。

---

## 总结

- **不需要小模型，也不需要加服务器**
- **换 Deepgram API**：改动 ~150 行代码，延迟从 2-5s 降到 <300ms，月成本 <3 元
- **代码结构天然支持替换**：iflytek.py → deepgram.py，接口不变，架构不动，前端无感
- **$200 免费额度**：在 MustDo 的量级下，几乎等于终身免费
