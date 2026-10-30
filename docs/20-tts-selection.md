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
