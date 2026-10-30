# ADR-012：语音（TTS）方案

## 状态

已取代（2026-10-31，改用火山引擎豆包语音，见 [ADR-013](ADR-013-volc-tts.md)）。

## 背景

[01-tech-selection](../01-tech-selection.md) 只覆盖 QQ 接入通道，没有 TTS 选型；肥鱼需要中文、可爱、有情绪、低延迟的语音，且本机是 Windows + AMD RX 9070 XT（无 CUDA）。

## 决策

采用**本地 Breeze-TTS-2**：

- 运行时 audio.cpp v0.9.3（Vulkan 预编译），模型 `breeze-tts-2-q8_0.gguf`（5.08 GB）
- 用 C4 参考音频（`ref-c4.wav`）+ ASR 文本做 voice clone
- `options.instruct` 控制情绪与语速（默认「活泼、爱笑、带点撒娇」）
- 网关 8090 做 GET→POST 转换与后处理（剪开头 + 音量 ×2.5 + 结尾 0.4s 空白）
- cheems `voice.engine=custom` 指向网关

## 理由

| 方案 | 对比结论 |
|---|---|
| Breeze-TTS-2（本地） | 中文强、情绪可控、Vulkan 可跑，音色/语速最接近 C4 |
| Ming-3.0-TTS 0.5B | 已跑通，但克隆后音高波动只有 30 Hz，情绪平 |
| Kokoro 82M | 轻量，但中文自然度一般、情绪弱 |
| 线上 BreezeBlue API | 可用，但按量付费且不满足「本地部署」目标 |
| MiniMax API | 音色最还原（C4 原始来源），但按量付费 |
| CosyVoice 3 / IndexTTS 2 | 未实测，留作后续 |

## 风险与缓解

- **音高起伏未完全还原**（43 vs 58 Hz）：换更长/多句参考音频，或调 instruct。
- **Vulkan 兼容性**：驱动更新可能影响；保留 CPU 兜底。
- **显存占用约 6 GB**：`max_loaded_models=1`，空闲卸载。
- **模型非商用许可**：个人使用可以，产出不能商用。
- **网关与 server 进程**：已写进 `tools/start-feiyu.ps1` 一键启动。

## 验证

```powershell
node cli.mjs all                              # 8/8
node checks/probe-onebot.mjs --json           # connected
curl.exe -X POST http://127.0.0.1:49997/im-bridge/voice/preview -d '{"text":"验收","engine":"custom"}'
# → {"ok":true,"engine":"custom"}
```

实测数据见 [20-tts-selection](../20-tts-selection.md) 第六节。