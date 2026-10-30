# 20 · 语音（TTS）选型

> 状态：补充选型（2026-10-30）。[01-tech-selection](01-tech-selection.md) 只覆盖了 QQ 接入通道，**没有覆盖 TTS**，这是之前的缺口。
>
> 与已有文档的关系：[17-voice](17-voice.md) 是「怎么开」（四引擎、edge-tts 装法）；[19-voice-emotion](19-voice-emotion.md) 是「情绪怎么调」。本文补的是**跨平台本地开源自部署**这一层（AMD/Vulkan），并修正 19 里「无 NVIDIA 跑不了本地 TTS」的过时结论。
>
> 场景：肥鱼在 QQ 里私聊/群聊，需要**中文、可爱/温柔、有情绪、低延迟、本机可跑**。本机是 Windows + AMD Radeon RX 9070 XT（16 GB），**没有 CUDA**。

## 零、部署者怎么选（先看这里）

按你的情况挑一行，不用全读。

> **默认不接入语音**（oice.enabled=false）。语音是可选能力，不装也能纯文字聊天；需要时从下表选一个方案接入，各方案互不影响。

| 方案 | 效果（音色/情绪） | 成本 | 硬件 | 部署耗时 | 适合谁 |
|---|---|---|---|---|---|
| **不接入**（纯文字） | 无语音 | 0 | 无 | 0 | 只要文字、不想折腾 |
| **Edge TTS**（cheems `sweet`） | 中文自然、无情绪起伏 | 免费（联网） | 无 | 5 分钟 | 想立刻有声音、能接受念稿 |
| Windows SAPI | 机械、离线 | 免费 | 无 | 0（自带） | 断网兜底 |
| **MiniMax API** | 情绪强、可克隆（账号内已有音色可直接用） | 按量付费 | 无 | 10 分钟 + key | 要最像、愿付费 |
| **BreezeBlue API** | 质量高、可克隆 | 约 $34 / 1M 字符 | 无 | 10 分钟 + key | 不想装显卡 |
| **本地 Breeze-TTS-2** | 中文自然、情绪可控、可克隆（用一段 3–5 秒参考音频） | 免费（电费） | AMD/NVIDIA GPU ≥6 GB | 2–3 小时 | 有显卡、要隐私/零月费 |
| 本地 Ming-3.0 0.5B | 中文好、情绪偏平 | 免费 | GPU ≥4 GB | 1 小时 | 轻量本地 |
| 本地 Kokoro 82M | 轻快、情绪弱 | 免费 | CPU 即可 | 30 分钟 | 低配机器 |

### 一句话决策

- **不想折腾** → 不接入，或 Edge TTS（5 分钟）
- **要最好效果（音色 + 情绪）** → **火山引擎豆包语音**（本仓库实测最好，付费）
- **要情绪、要像人但想少花钱** → MiniMax API 或本地 Breeze（有显卡）
- **没显卡** → BreezeBlue / MiniMax API
- **有 AMD/NVIDIA 显卡、要免费 + 隐私** → 本地 Breeze-TTS-2（本文主推）
- **只想先跑通** → Kokoro 82M（CPU 都能跑）

### 成本口径

- 本地：一次 5 GB 模型 + 约 6 GB 显存常驻；电费按 GPU 功耗算，长期接近免费。
- 线上：按字符计费，BreezeBlue ≈ $34/1M 字符、Fish ≈ $15/1M；日常聊天量小，月成本通常几元到几十元。
- Edge TTS：完全免费，但音色/情绪上限低。
- 火山引擎：≈¥10/万字，注册送免费额度；只对合成成语音的文字计费。
## 一、候选与约束

### 本机约束（✅ 实测）

| 项 | 值 |
|---|---|
| GPU | AMD Radeon RX 9070 XT（RDNA4，16 GB，无 CUDA） |
| 系统 | Windows |
| 可跑路径 | **Vulkan**（audio.cpp 预编译）/ CPU；ROCm 仅实验 |

结论：所有本地方案必须能走 **Vulkan 或 CPU**，CUDA-only 的直接排除。

### 本地候选（audio.cpp Vulkan 一个运行时跑多个模型）

[audio.cpp](https://github.com/0xShug0/audio.cpp) 的 [GGUF 仓库](https://hf-mirror.com/audio-cpp/audio.cpp-gguf) 已收录下列 TTS，均可走 Vulkan：

| 模型 | 参数 | Elo（AA） | 中文 | 情绪 | 许可 | 备注 |
|---|---|---|---|---|---|---|
| **Ming-3.0-TTS 0.5B** | 0.5B | 1187 | ✅ 强 | ✅ 自然语言控制 | 待确认 | 2026-10 新，小模型里最强之一 |
| **CosyVoice 3** | — | — | ✅ 强（18+ 方言） | ✅ 150ms 流式 | Apache-2.0（🟡） | 实时交互首选 |
| **Breeze TTS 2** | 3B | 1228 | ✅ 强 | ✅ `[笑]` 等事件 | **研究/非商用** | 质量最好之一，5 GB q8_0 |
| **IndexTTS 2** | — | — | ✅ 强 | ✅ 情感 | 待确认 | B 站系，中文情感强 |
| **Chatterbox** | — | 1024 | 一般 | ✅ 对话感 | 待确认 | 对话 Agent 向 |
| **Kokoro 82M** | 82M | 1062 | 一般 | 弱 | Apache-2.0 | 极轻，CPU 可跑，兜底 |

### 线上候选

| 服务 | 价格 | 中文 | 情绪 | 延迟 | 许可 |
|---|---|---|---|---|---|
| **BreezeBlue API** | $34 / 1M chars（🟡 AA） | ✅ | ✅ | 低（H100） | 订阅覆盖托管产出 |
| Fish Audio Drama 3 | $15 / 1M chars | ✅ | ✅ | 低 | 商用可用 |
| MiniMax Speech | 按量 | ✅ | ✅ | 低 | 商用 |
| 火山/豆包 TTS | 按量 | ✅ | ✅ | 低 | 商用 |
| Azure TTS | 按量 | ✅ | ✅ | 低 | 商用 |
| Edge TTS | 免费 | ✅ 一般 | 弱 | 低 | 微软服务条款 |

> Elo 数据来自 [Artificial Analysis open-weights leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice/open-weights)（🟡 引用，2026-10）。

## 二、按场景评分

权重：中文 30%、情绪 20%、延迟 20%、成本 15%、AMD 可跑 15%。

| 方案 | 中文 | 情绪 | 延迟 | 成本 | AMD | 加权 | 结论 |
|---|---|---|---|---|---|---|---|
| **Ming-3.0-TTS 0.5B（本地）** | 5 | 4 | 4 | 5 | 5 | **4.7** | 首选 |
| **CosyVoice 3（本地）** | 5 | 4 | 5 | 5 | 5 | **4.75** | 首选（流式） |
| Breeze TTS 2（本地） | 5 | 5 | 3 | 4 | 5 | 4.35 | 高质量备选（非商用） |
| IndexTTS 2（本地） | 4.5 | 5 | 3 | 5 | 5 | 4.3 | 备选 |
| Kokoro 82M（本地） | 3 | 2 | 5 | 5 | 5 | 3.6 | 兜底/快速原型 |
| BreezeBlue API | 5 | 5 | 5 | 2 | — | 4.15 | 不想本地跑时 |
| Edge TTS | 3.5 | 2 | 5 | 5 | — | 3.6 | 零成本兜底 |

## 三、结论

1. **本地优先实测 Ming-3.0-TTS 0.5B 与 CosyVoice 3**：都走 audio.cpp Vulkan，中文强、小、免费；先各跑一句对比音色与延迟。
2. **Breeze TTS 2 作为高质量备选**：Elo 最高之一、情绪事件丰富，但**权重非商用**，且 5 GB 模型 + 推理更慢。
3. **线上 BreezeBlue API** 作为「不想维护显卡」的退路；按 $34/1M 字符计费。
4. **Kokoro / Edge TTS** 作为兜底：Kokoro 82M 可 CPU 跑；Edge TTS 免费但情绪弱。
5. **不推荐**：GPT-SoVITS（部署重、无 Vulkan 正式路径）、Qwen3-TTS（暂无 audio.cpp GGUF，待上游支持）、Fish S2 Pro（官方建议 24 GB 显存，且商用需付费）。

## 四、待验证（❓）

- [ ] 9070 XT Vulkan 下 Ming-3.0 / CosyVoice 3 的**首包延迟**（目标 < 1s，QQ 对话可接受）
- [ ] 中文音色的「可爱/温柔」听感（品味类，需样本排序）
- [ ] `[笑]` / `[叹气]` 等事件是否被模型支持（Breeze 支持；其余待测）
- [ ] 长时间运行稳定性（内存泄漏、显存占用）

## 五、接入方式

- 本地：`audiocpp_server` 起 HTTP 服务 → cheems 面板 TTS 的 **customUrl** 引擎。
- 线上：cheems 内置 `breeze` 引擎，填 API key 即可。
- 兜底：Edge TTS（系统自带，零配置）。

验证命令（本地跑通后）：

```powershell
cd E:\workspace\audio.cpp
.\audiocpp_server.exe --list-devices   # 应看到 Vulkan0: Radeon RX 9070 XT
```

## 六、已跑通记录（2026-10-30）

### 实测环境

| 项 | 值 |
|---|---|
| GPU | AMD Radeon RX 9070 XT（Vulkan，fp16/bf16，KHR_coopmat） |
| 运行时 | audio.cpp v0.9.3（windows-x64-vulkan） |
| 模型 | Breeze-TTS-2 q8_0（5.08 GB，audio-cpp 官方 GGUF） |
| ASR（参考文本） | Fun-ASR-Nano 2512 q8_0（1 GB） |
| 服务 | `audiocpp_server` :8080 + `gateway.mjs` :8090 |
| 接入 | cheems `voice.engine=custom`，`customUrl=http://127.0.0.1:8090/tts?text={text}` |

### 延迟实测

- Kokoro 82M：1.42 s 生成约 3.6 s 音频
- Ming 0.5B：1.93 s 生成约 4.5 s 音频
- Breeze 3B：首请求含加载约 4–6 s，之后约 2–4 s/句（Vulkan）

### 克隆效果（同一句，示例参考音频）

| 指标 | 示例原声（女声） | Ming 克隆 | Breeze 克隆 |
|---|---|---|---|
| 音高均值 | 245.6 Hz | 231.5 Hz | 227.0 Hz |
| 音高波动 | 58.1 Hz | 30.5 Hz | 28.2 Hz |
| 频谱质心 | 1353 Hz | 3886 Hz | 1571 Hz |
| 语速 | 2.38 音节/s | 4.77 | 2.27 |

Breeze 的音色厚度与语速已接近原声；音高起伏仍偏平（参考音频仅 3.9 s 单句）。

### 后处理（网关内置）

```
silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,
volume=2.5,
apad=pad_dur=0.4
```

剪掉开头静音、音量 ×2.5、结尾留 0.4 s 空白（否则 QQ 语音播放器会截掉最后一个字）。

### 踩过的坑

1. **HoppouAI 的 GGUF 不能给 audio.cpp 用**（`packed GGUF namespace does not exist: model`），必须用 `audio-cpp/audio.cpp-gguf` 的官方包。
2. **hf-mirror 对 audio-cpp 仓库限速**约 62 KB/s；换 **ModelScope**（`modelscope.cn/models/audio-cpp/audio.cpp-gguf`）单连接约 1 MB/s。
3. **Breeze 需要配套文件**：`config.json`、`audio_tokenizer/config.json` 等，缺失会报 `missing model package file`。
4. **Breeze 克隆必须给 `reference_text`**（参考音频的准确文本），否则 500；用 Fun-ASR 转写得到。
5. **PowerShell 的 `>>` 不能追加二进制**（会编码转换损坏文件），合并分片用 `cmd /c copy /b`。
6. **`[IO.File]::WriteAllText` 用相对路径**会解析到进程 cwd 而非 `cd` 的目录，必须绝对路径。
### 情绪指令（关键）

Breeze 默认克隆出来很平（音高波动 28 Hz）。加上 `options.instruct` 后明显改善：

```
用活泼、爱笑、带点撒娇的语气说，音调有自然的起伏，语速稍快，句尾上扬，像一个开心的小女生在回应喜欢的人。
```

实测同一句：

| 配置 | 音高波动 | 音高均值 |
|---|---|---|
| 无 instruct | 33.6 Hz | 230.3 Hz |
| **有 instruct** | **43.1 Hz** | **246.8 Hz** |
| 示例原声 | 58.1 Hz | 245.6 Hz |

网关已把该 instruct 设为默认，可用 `?instruct=...` 覆盖。
### 参考音频长度（2026-10-31）

短参考（3.9 秒、单句）换文本时音色偏移明显；改用 15 秒、多句参考（用 MiniMax 原音色生成 + Fun-ASR 转写文本）后更稳：

| 版本 | 质心 | 说明 |
|---|---|---|
| 短参考原声 | 1428 Hz | 基准 |
| 短参考·同句 | 1503–1592 Hz | 差 5–11% |
| 长参考原声 | 1318 Hz | 基准 |
| 长参考·同句 | 1514 Hz | 差 15% |
| 长参考·换句 | 1211 Hz | **差 8%** |

结论：长参考在多句/换文本时更稳。网关最终配置：

- `REF_AUDIO = E:/workspace/audio.cpp/ref-long.wav`（15 秒）
- `REF_TEXT = ` 15 秒音频的 ASR 转写
- 情绪走 `mood` → 固定模板（每个模板以「用参考音色」开头）
### 最终配置（2026-10-31，以听感为准）

经过多轮 A/B，回退到**最早那套简单组合**效果最好：

| 项 | 值 |
|---|---|
| 参考音频 | `ref-c4.wav`（3.9 秒、单句） |
| 指令 | **cheems 每句动态生成的 `direction` 原文直传**（不锚定、不套固定模板） |
| temperature | `0.6`（默认 0.9 波动太大，好听与否靠运气） |
| 后处理 | 剪开头 + 音量 ×2.5 + 结尾 0.4 秒空白 |

实测：质心 1559 Hz（对照 00:49 的满意样本 1611，差 3%），语速 2.36 音节/秒。

### 教训（重要）

1. **自动情绪（mood → 固定模板）会让所有句子一个味道**，效果反而差。
2. **锚定「用参考音色」也会让语气变平**——direction 直传最自然。
3. **temperature 0.9 是随机性来源**：同一配置每次输出不同，「好听」是碰运气；固定 0.6 后稳定。
4. **参考音频短（3.9s）在换文本时会飘**，但长参考（15s）反而「太稳、不像」——最终选了短的。
### 最终配置 v2（2026-10-31，direction 清洗）

在 v1 基础上，网关对 `direction` 做清洗：**删除含音色词的片段**（音色/声音/偏低/放轻/轻声/音量/压低…），只保留情绪/语速/停顿。

实测三句（悲伤/生气/平静）质心 1578–1832，漂移收窄到约 16%，比直传稳定。

| 项 | 值 |
|---|---|
| 参考 | `ref-c4.wav`（3.9 秒） |
| 指令 | `direction` 清洗后直传 |
| temperature | `0.6` |
| 后处理 | 剪开头 + 音量×2.5 + 结尾 0.4s |

清洗代码在网关 `sanitizeDirection()`：按标点切句，过滤含音色词的片段。
### 最终配置 v3（2026-10-31，清洗音色 + 语速词）

`direction` 清洗规则扩展：除了音色词，再过滤「语速/放慢/放缓/稍快/快一点/慢一点」等语速词，让语速更统一。

| 项 | 值 |
|---|---|
| 参考 | `ref-c4.wav`（3.9 秒） |
| 指令 | `direction` 清洗（音色词 + 语速词）后，前面加「用参考音色」 |
| temperature | 0.6 |
| 后处理 | 剪开头 + 音量×2.5 + 结尾 0.4s |

实测三句：质心 1436–1649（24k，接近参考）、语速 1.96–3.14（比未清洗时 1.24–3.93 收窄）。

### 测量注意

体检脚本必须统一重采样到 16 kHz 再比较质心——16k 与 24k 的频率上限不同，直接比会误判为「偏亮 25%」。
## 七、2026-10-31 最终结论：本地开源 vs 商业 API

### 本地实测（同一参考音频、同一句）

| 模型 | 质心（参考 1428） | 语速（参考 2.09） | 音高波动（参考 34.5） | 结论 |
|---|---|---|---|---|
| Breeze q8_0 | 1344 | 2.21 | 32.9 | 音色近，细节差 |
| Breeze bf16 | 1385 | 1.99 | 44.5 | 更好，但仍不够像 |
| CosyVoice 3 | 1499 | 1.59 | 37.7 | 音色近，节奏拖 |
| **IndexTTS 2** | **1394** | 1.89 | 34.6 | **音色最接近（2.4%）** |
| MiniMax（原版） | 1349 | 2.23 | 48.3 | 基准 |

### 本地模型的硬伤

1. **语速固定**：靠 `duration_scale` 一刀切，不会按内容/情绪自适应。
2. **情绪控制不可靠**：IndexTTS 2 的 `emotion_text` 方向反了（"sad" 反而升调），`emotion_vector` 第 6 位才对应低落。
3. **细节丢失**：量化 + 3B 级别模型，气声、咬字、高频泛音不如商业模型。

### 最终选择

**默认用 MiniMax**（`engine=minimax`，voiceId `c4clone001`）：原版音色 + 9 档情绪 + 语速/停顿控制。

本地保留（`engine=custom` 可切回）：IndexTTS 2 + 网关（`gateway.mjs`），适合断网/不想付费时。

### 如果以后想回本地

```powershell
# 切回本地 IndexTTS 2
curl -X POST http://127.0.0.1:<DSH端口>/im-bridge/settings -H "Content-Type: application/json" -d '{"voice":{"engine":"custom","customUrl":"http://127.0.0.1:8090/tts?text={text}"}}'
```
## 八、2026-10-31 最终定稿：火山引擎豆包语音（复刻音色）

经过本地模型（Breeze / CosyVoice 3 / IndexTTS 2）与 MiniMax 的多轮对比，最终选择**火山引擎豆包语音**：

| 项 | 值 |
|---|---|
| 产品 | 豆包语音合成 2.0（复刻音色） |
| ResourceId | `seed-icl-2.0` |
| 音色 | `S_DfDMiwMj2`（「肥鱼音色」，用 C4 音频复刻） |
| 鉴权 | `X-Api-Key`（控制台 API Key） |
| 协议 | WebSocket `wss://openspeech.bytedance.com/api/v3/tts/bidirection`（V3 二进制帧） |
| 情绪 | `emotion` 参数：happy/sad/angry/fear/hate/surprise/neutral |
| 价格 | ≈ ¥10 / 万字符，有免费额度 |

### 实现

- `E:\workspace\audio.cpp\volc-tts.mjs`：协议客户端（帧构造/解析、事件机）
- `E:\workspace\audio.cpp\gateway-volc.mjs`：GET → WS 网关，`direction` 关键词映射 emotion，**原样返回 mp3（不加工、不重编码）**
- cheems：`engine=custom`，`customUrl=http://127.0.0.1:8090/tts?text={text}`

### 实测

- 时长 3.86s（参考 C4 3.88s）
- 音高 228.5（参考 223.7）
- 质心 1400（参考 1428，-2%）
- 7 种语气样本全部生成成功，用户确认「很满意」

### 关键坑

1. **复刻音色必须用 `seed-icl-2.0`**，`seed-tts-2.0` 会报「resource ID mismatched」。
2. 协议帧：4 字节 header + event(4) + session_id 长度+字节 + payload 长度+JSON。
3. `buildPayload` 不能引用外层闭包变量（作用域错误）。
4. QQ 语音会被 NapCat 转成 silk（低码率），音色必然有损；网页版是原始 mp3。