---
title: "待办事项识别的小参数模型部署与微调（Qwen3-4B）"
date: 2026-08-06
summary: "以 mustdo 抽取规则为需求，用 unsloth QLoRA 微调 Qwen3-4B 并打包 GGUF 供 Ollama 使用的完整练手闭环"
---


以 mustdo 的抽取规则为假想需求，走一遍「下载 HF 权重 → LoRA 微调 → 打包 GGUF → Ollama 使用」的练手闭环。不接生产、不改 backend 代码。

**流程总览**：

```
① 下载 HF 权重（训练素材） → ② 微调（unsloth QLoRA） → ③ 打包 GGUF → ④ Ollama 使用
```

**环境**：RTX 4070 12GB / WSL2 / Ollama / unsloth + TRL SFTTrainer / 训练目标 Qwen3-4B

## 任务定义（mustdo 解析规则摘要）

输出严格为 JSON：`{"items": [{"content", "due_date", "due_time"}]}`：

| 维度 | 规则 |
|------|------|
| 日期 | 无日期/「有空」→ 今天；今天/明天/后天 → 对应日；「周X」→ 最近周X；「下周X」→ 下个自然周；「月底」→ 当月最后一天；过去日期 → 归正今天 |
| 时间 | 具体（下午三点、9:30）→ HH:MM；模糊（上午/有空）→ `null` |
| 结构 | 同一地点/平台多个动作合并一条；不同场景拆分；content 1-200 字，≤20 条 |
| 无待办 | 闲聊、已完成、修改/删除类指令 → `items: []` |

---

## 第 1 步：下载 HF 权重

微调必须用 **HF 格式**（PyTorch 可加载训练；`ollama pull` 的 GGUF 只能推理不能训练）。下载 `unsloth/Qwen3-4B-bnb-4bit`——Qwen3-4B 的 **4-bit 预量化版**（约 3GB），加载快、显存省：

```bash
# 方式 A：显式下载（推荐，可先确认文件完整）
pip install -U "huggingface_hub[cli]"
hf download unsloth/Qwen3-4B-bnb-4bit --local-dir models/qwen3-4b-hf

# 方式 B：不手动下载——训练脚本运行时 unsloth 首次调用会自动拉取
#（缓存到 ~/.cache/huggingface，之后复用）
```

## 第 2 步：微调（unsloth QLoRA）

### 合成训练数据

没有真实数据，用规则生成器造：模板库随机组合 + 每次随机一个「今天」日期，生成器与推理端用**同源日期计算逻辑**算出期望日期。

- 训练 1500 条 + 评估 200 条（**独立 seed**，防评估失真）
- 负样本（闲聊/已完成/修改类 → `items: []`）占 10-15%
- 覆盖：日期全维度、时间具体/模糊、合并/拆分、条数 1-5、content 边界
- system prompt 定义在 `prompts.py` 单点，生成器与推理共用；训练数据用 `apply_chat_template(..., enable_thinking=False)` 构造（**训练侧彻底关思考**）

### 训练脚本（`train_unsloth.py`）

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    "unsloth/Qwen3-4B-bnb-4bit",   # 第 1 步：HF 下载在这里发生（4-bit 预量化版）
    max_seq_length=1024,
    load_in_4bit=True,             # QLoRA：4-bit 加载
)
model = FastLanguageModel.get_peft_model(
    model,
    r=16, lora_alpha=16, lora_dropout=0, bias="none",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

trainer = SFTTrainer(
    model, tokenizer,
    train_dataset=dataset, eval_dataset=eval_dataset,
    dataset_text_field="text", max_seq_length=1024, packing=True,
    args=SFTConfig(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,   # 等效 batch 8
        num_train_epochs=3,
        learning_rate=2e-4, warmup_ratio=0.05,
        lr_scheduler_type="linear",
        optim="adamw_8bit", bf16=True,
        eval_strategy="steps", eval_steps=100,
        logging_steps=10, report_to="none",
        output_dir="runs/qwen3-4b-parse",
    ),
)
trainer.train()
```

- 显存：~4GB（12GB 卡余量充足）；时长：3 epochs ≈ 30-40 分钟
- 建议参数化 CLI（`--epochs N --rank R`）方便做对比实验；OOM 降级：batch=1 / max_seq=768 / accum=8

## 第 3 步：打包 GGUF

```python
# 自动完成：合并 LoRA 回原权重 → 量化 Q4_K_M → 导出 GGUF
model.save_pretrained_gguf("export", tokenizer, quantization_method="q4_k_m")
```

产物：`export/model-Q4_K_M.gguf`（可能分片）。

## 第 4 步：Ollama 使用

```bash
cd finetune/export
printf 'FROM ./model-Q4_K_M.gguf\n' > Modelfile
ollama create ft-4b-e3 -f Modelfile
```

**验证**（think:false + format 组合，确认直接输出 JSON、无 `<think>` 块）：

```bash
curl -s localhost:11434/api/chat -d '{
  "model": "ft-4b-e3",
  "think": false,
  "stream": false,
  "format": {"type":"object","properties":{"items":{"type":"array","items":{"type":"object",
    "properties":{"content":{"type":"string"},"due_date":{"type":"string"},
    "due_time":{"type":["string","null"]}},"required":["content","due_date","due_time"]}}},
    "required":["items"]},
  "messages": [
    {"role": "system", "content": "你是待办事项解析器。今天是 2026-08-06（周四）。只输出 JSON。"},
    {"role": "user", "content": "下周五下午两点开会，明天交房租"}
  ]
}'
```

期望输出：`{"items":[{"content":"开会","due_date":"2026-08-14","due_time":"14:00"},{"content":"交房租","due_date":"2026-08-07","due_time":null}]}`

---

## 评估对比

先拉零样本基线模型（GGUF 推理版，Q4_K_M ~2.5GB）：

```bash
ollama pull qwen3:4b
```

`eval.py` 对评估集（手写 20 条 + 合成 200 条）输出指标并打印失败样本：

| 指标 | 参考阈值 |
|------|----------|
| JSON 合法率 | ≥ 98% |
| exact-match（按日期+内容排序逐条全等） | ≥ 95%（宽松口径） |
| 字段级准确率（due_date / due_time / content） | ≥ 95% |
| no-todo 正确率（负样本判空） | ≥ 90% |

```bash
for m in qwen3:4b ft-4b-e3 ft-4b-e1 ft-4b-e3-r8; do
  python eval.py --model "$m"
done
```

主实验：`ft-4b-e3`（3ep, r=16）。可选对比：`ft-4b-e1`（epochs 对比）、`ft-4b-e3-r8`（r 对比，判断过拟合）。**核心问题：微调比零样本基线（`qwen3:4b`）提升多少**——提升明显即闭环成功。

## 踩坑必读（2026-08 验证）

1. **Qwen3 思考模式必须关**：`/api/chat` 请求体**顶层** `"think": false` 是唯一可靠方式（放 options 被忽略；Modelfile PARAMETER 不支持；`enable_thinking` Ollama 忽略；`/no_think` 部分生效）
2. **带 `format` 必须同时 `think: false`**（GBNF 语法与思考模式不兼容，Ollama issue #11691）
3. **`format` 必须传手写扁平 JSON Schema**：Pydantic `model_json_schema()` 的 `$defs`/`$ref` 有顺序 bug（issue #8444），可能产生非法 GBNF。schema 只声明 `type`+`required`，字段合法性交给代码校验兜底（完整 schema 见上文 curl）
4. **训练数据同样关思考**：`apply_chat_template(..., enable_thinking=False)`

## 常见问题

| 问题 | 解法 |
|------|------|
| 输出带 `<think>` 块 | 请求体顶层 `think: false`；微调模型检查训练数据 enable_thinking=False |
| 输出 JSON 结构非法 | `format` 用手写扁平 schema（无 `$ref`/`$defs`） |
| 训练 OOM | batch=1 / max_seq=768 / accum=8；`nvidia-smi` 查显存占用 |
| 微调后反而变差 | 检查训练/评估集是否同源（同源会虚高）；负样本占比是否过低；epochs 是否过多 |
| GGUF 导出为多个分片 | Modelfile `FROM` 写 `./model-Q4_K_M*.gguf` 或逐个指定 |

## 参考链接

- [Ollama 结构化输出文档](https://docs.ollama.com/capabilities/structured-outputs)
- [Ollama issue #11691：GBNF 与思考模式不兼容](https://github.com/ollama/ollama/issues/11691)
- [Ollama issue #8444：Pydantic $defs schema 顺序 bug](https://github.com/ollama/ollama/issues/8444)
- [Qwen3 unsloth 训练文档](https://qwen.readthedocs.io/en/latest/training/unsloth.html)
- [Unsloth：Qwen3 How to Run & Fine-tune](https://unsloth.ai/docs/models/tutorials/qwen3-how-to-run-and-fine-tune)
- 相关：本机 `qwen3-14b-ollama-deploy.md`（同环境 Ollama 部署细节）
