# 语音情绪：技术选型

> 状态：**选型中**（2026-10-30）。只做结论与路线，不写实现。
> 目标：让肥鱼说话有情绪起伏，不是"念稿"。

## 一、现象与根因

用户反馈：MiniMax 克隆音色接进来了，但**听起来像机器人在念**。

查代码发现根因：

```js
// voice-studio.js
const payload = {
  model, text, stream: false,
  voice_setting: {
    voice_id, speed: mini.speed, vol: 1, pitch: 0,
    ...(requested === 'auto' ? {} : { emotion }),   // ← auto 时根本不传 emotion
  },
}
```

而当前配置是 `emotion: auto`。

**所以每次合成请求里都没有 emotion 字段。** MiniMax 收到的是「念这段字」，
不是「用某种情绪说这段话」。

第二个问题：`speed` 固定 1.0、`pitch` 固定 0、文本里没有任何停顿或语气标记。
即使传了 emotion，这三个也让它听起来平。

## 二、MiniMax 实际支持什么

来自第三方整理的 API 参数表（[uclouddoc 的 minimax-speech](https://github.com/uclouddoc-team/modelverse/blob/main/api_doc/audio_api/minimax-speech.md)）：

| 能力 | 参数 | 范围 |
|---|---|---|
| **情绪** | `voice_setting.emotion` | `happy` `sad` `angry` `fearful` `disgusted` `surprised` `calm` `fluent` `whisper`（9 种；whisper 仅 2.6 系列） |
| **语速** | `voice_setting.speed` | 0.5 – 2.0，默认 1.0 |
| **语调** | `voice_setting.pitch` | -12 – 12，默认 0 |
| **音量** | `voice_setting.vol` | (0, 10]，默认 1.0 |
| **停顿** | 文本内 `<#x#>` | x = 秒，0.01–99.99，最多两位小数；不能连续用 |
| **语气词** | 文本内 `(laughs)` `(sighs)` `(emm)` `(breath)` `(gasps)` `(sniffs)` 等 20 种 | 仅 `speech-2.8-hd` / `speech-2.8-turbo` |

**当前用的模型正好是 `speech-2.8-hd`**，语气词标签可用。

## 三、方案对比

| 方案 | 情绪粒度 | 音色 | 成本 | 本机可行 |
|---|---|---|---|---|
| **MiniMax 2.8-hd**（现在） | 9 档 + 20 种语气词 + 停顿 | 已克隆 `c4clone001` | 已有 key，按量 | ✅ |
| **Fish Audio S2** | **64+ 种**，文本标记 `[happy]` `[sad]` `[excited]`，含强度修饰、情绪过渡、11 种音效 | 要重新克隆 | 新账号 + 按量 | ✅ |
| **IndexTTS-2**（B 站开源） | 情绪混合（emotion blending） | 本地零样本克隆 | 免费 | 🟡 可经 audio.cpp Vulkan（见 [20-tts-selection](20-tts-selection.md)） |
| **CosyVoice / GPT-SoVITS** | 中等 | 本地训练 | 免费 | 🟡 CosyVoice 可经 Vulkan；GPT-SoVITS 无正式路径 |

Fish Audio 的情绪表达明显更细（[官方文档](https://docs.fish.audio/developer-guide/core-features/emotions)：24 种基础 + 25 种高级 + 语气/音效标记），
但代价是**重新克隆音色 + 换一家付费**。

## 四、推荐路线：三层递进

### L1：先把参数传对（10 分钟）

```
emotion: auto  →  按心情映射到具体值
speed:   1.0   →  随情绪 ±（happy 快、sad 慢）
pitch:   0     →  随情绪微调（happy +2、sad -3）
```

当前映射有个明显 bug：

```js
{natural:'calm', happy:'happy', gentle:'calm', sad:'sad', surprised:'surprised', serious:'calm'}
```

**`gentle`（安慰场景）被映射成 `calm`**——安慰时最该有温度，结果给了最平的档。

### L2：给文本加标记（半天）

```
她：你真的很辛苦，先歇着。
→ 写成：「(sighs)你真的很辛苦，<#0.4#>先歇着。」
```

- 停顿 `<#x#>`：让句子有呼吸感
- 语气词 `(sighs)` `(emm)` `(laughs)`：这是"像人"和"像机器"的关键区别

实现方式：在 `burstSegments` 之后、送 TTS 之前，按句末标点和情绪自动插标记。

### L3：换方案（几天）

只有 L1+L2 做完还是平，才考虑换 Fish Audio S2。

**不建议先换**，因为：
1. 现在的平淡是**配置问题**，不是模型上限
2. 换方案要重新克隆音色（现在的 `c4clone001` 已经像了）
3. 换一家要重新验证延迟、稳定性、计费

## 五、待验证

| # | 问题 | 怎么测 |
|---|---|---|
| V1 | 传了 emotion 后差异有多大 | 同一句文本，9 种 emotion 各合成一次，人耳排序 |
| V2 | `speech-2.8-hd` 的 `(sighs)` 效果是否自然 | 同一句加/不加语气词，对比 |
| V3 | `<#0.3#>` 停顿会不会被读出来 | 合成后听有没有"井号"的读音 |
| V4 | 情绪与克隆音色是否冲突 | 克隆音色可能不吃 emotion（要看实测） |
| V5 | 延迟是否可接受 | 现有延迟约几秒，加标记后是否变慢 |

> V4 是关键风险：**克隆音色的情感跟随度通常低于官方音色**。
> 如果测出来克隆音色对 emotion 不敏感，L1/L2 的收益会打折，那时才该考虑换方案。

## 六、不做什么

- 不做本地训练（无 GPU）
- 不换音色（现在的克隆已经像）
- 不为了"有情感"牺牲延迟（语音要几秒内出来）
- 不自动给所有句子加语气词（会变成"啊啊啊"的噪音）

## 七、参考

- [MiniMax 同步语音合成文档](https://platform.minimax.cn/docs/api-reference/speech-t2a-http)
- [MiniMax 参数表（第三方整理）](https://github.com/uclouddoc-team/modelverse/blob/main/api_doc/audio_api/minimax-speech.md)
- [Fish Audio 情绪控制](https://docs.fish.audio/developer-guide/core-features/emotions)
- [IndexTTS-2（B 站开源）](https://github.com/tabortao/index-tts2)
