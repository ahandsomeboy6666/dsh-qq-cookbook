# ADR-013：语音最终方案（火山引擎豆包语音）

## 状态

已接受（2026-10-31，火山引擎复刻音色跑通，用户确认满意）。

## 背景

[ADR-012](ADR-012-tts.md) 选择本地 Breeze-TTS-2，但实测发现：本地开源模型（Breeze q8/bf16、CosyVoice 3、IndexTTS 2）音色只能「接近」，语速固定、情绪参数不可靠，无法满足「克隆音色 + 情绪变化但不改音色」的需求。

## 决策

改用**火山引擎豆包语音**：

- 产品：豆包语音合成 2.0（复刻音色）
- ResourceId：`seed-icl-2.0`
- 音色：`S_DfDMiwMj2`（用 C4 音频复刻）
- 鉴权：`X-Api-Key`
- 协议：WebSocket `wss://openspeech.bytedance.com/api/v3/tts/bidirection`（V3 二进制帧）
- 情绪：`emotion` 参数（happy/sad/angry/fear/hate/surprise/neutral）
- 接入：`gateway-volc.mjs`（GET→WS，原样返回 mp3）+ cheems `engine=custom`

## 理由

| 方案 | 音色 | 情绪 | 语速自适应 |
|---|---|---|---|
| **火山豆包语音** | 复刻 C4，用户确认满意 | 7 种 emotion | 是 |
| 本地 Breeze/IndexTTS | 接近但细节差 | 参数不可靠 | 否（固定） |
| MiniMax | 原厂最像 | 9 档但会改音色 | 是 |

火山在「音色固定 + 情绪可调」上最符合需求，且价格可接受（≈¥10/万字，免费额度充足）。

## 风险与缓解

- **QQ 语音转码**：NapCat 转 silk 有损，音色略变；可改为发文件保留音质。
- **情绪改音色**：happy 模式会抬音调；已支持按 direction 关键词映射，可按需关闭。
- **API Key 权限**：复刻音色必须用 `seed-icl-2.0`，其他 resource 会 403 或报 mismatch。
- **成本**：按字符计费，免费额度用完后按量付费。

## 验证

```powershell
node volc-tts.mjs "在的在的，怎么啦，肥鱼在呢，你说嘛。" out.mp3
# → ok N bytes
curl -X POST http://127.0.0.1:<DSH端口>/im-bridge/voice/preview -d '{"text":"验收","engine":"custom"}'
# → {"ok":true,"engine":"custom"}
```

实测：时长 3.86s（参考 3.88s）、质心 1400（参考 1428）、音高 228.5（参考 223.7），7 种语气样本全部通过。