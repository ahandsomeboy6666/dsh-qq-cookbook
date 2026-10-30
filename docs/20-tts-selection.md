# 20 · 语音（TTS）选型

> 状态：补充选型（2026-10-30）。[01-tech-selection](01-tech-selection.md) 只覆盖了 QQ 接入通道，**没有覆盖 TTS**，这是之前的缺口。
>
> 与已有文档的关系：[17-voice](17-voice.md) 是「怎么开」（四引擎、edge-tts 装法）；[19-voice-emotion](19-voice-emotion.md) 是「情绪怎么调」。本文补的是**跨平台本地开源自部署**这一层（AMD/Vulkan），并修正 19 里「无 NVIDIA 跑不了本地 TTS」的过时结论。
>
> 场景：肥鱼在 QQ 里私聊/群聊，需要**中文、可爱/温柔、有情绪、低延迟、本机可跑**。本机是 Windows + AMD Radeon RX 9070 XT（16 GB），**没有 CUDA**。

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

### 克隆效果（同一句，C4 参考）

| 指标 | MiniMax 原声 | Ming 克隆 | Breeze 克隆 |
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
| MiniMax 原声 | 58.1 Hz | 245.6 Hz |

网关已把该 instruct 设为默认，可用 `?instruct=...` 覆盖。