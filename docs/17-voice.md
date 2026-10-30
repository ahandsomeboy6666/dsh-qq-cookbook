# 语音（TTS）怎么开

> 状态：**可选，默认不接入**（2026-10-31）。不接入 = 没有语音功能，她只发文字。
> 本机实测方案：火山引擎复刻音色（`custom` 引擎 + `gateway-volc.mjs`），详见 [20-tts-selection](20-tts-selection.md)。

## 一、五个引擎

| 引擎 | 依赖 | 音色 | 成本 |
|---|---|---|---|
| **sweet**（推荐） | Python + `edge-tts` 包 + 联网 | 晓伊 / 晓晓，轻快女声 | 免费 |
| `sapi` | Windows 自带 | Microsoft Huihui，机械 | 免费离线 |
| `minimax` | MiniMax API Key | 可定制，情绪强 | 付费 |
| `breeze` | Breeze API Key 或自建 vLLM | 可定制 | 付费/自建 |
| **custom（火山）** | 本地网关 `gateway-volc.mjs` + 火山 API Key | `S_DfDMiwMj2` 复刻音色 + emotion | ≈¥10/万字 |

`sweet` 内部就是调 Edge TTS（微软在线语音），音质明显好于 SAPI，所以默认用它。

## 二、开启（示例：火山复刻音色）

`~/.dsh/im-bridge/settings.json`：

```json
"voice": {
  "enabled": true,
  "engine": "custom",
  "customUrl": "http://127.0.0.1:8090/tts?text={text}"
}
```

也可以走 API（面板同款）：

```powershell
POST /im-bridge/settings
{"voice":{"enabled":true,"engine":"sweet","pythonPath":"...","pythonLib":"..."}}
```

## 三、三个坑（都踩过）

1. **`edge-tts exit 9009`**
   9009 = Windows 找不到命令。系统 PATH 里的 `python` 指向
   `C:\Users\...\AppData\Local\Microsoft\WindowsApps\python.exe`，那是商店 stub，不是真 Python。
   → 用真 Python：DSH 内置的在
   `E:\dsh桌面端\resources\runtime\primary-runtime\dependencies\python\python.exe`。

2. **`pylib` 不存在**
   插件用 `PYTHONPATH=<dataDir>/pylib` 调 Python，不装包就 `import edge_tts` 失败。
   → `python -m pip install --target <dataDir>/pylib edge-tts`

3. **改完不重试**
   配好 `pythonPath`/`pythonLib` 后不需要重启插件，下一次合成直接生效（配置走 settings.json）。

## 四、验收

```powershell
# 合成一句，返回 ok 与文件名即成功
POST /im-bridge/voice/preview  {"text":"在呢，怎么啦？","engine":"sweet"}
```

成功响应：

```json
{"ok":true,"name":"sweet-<hash>.mp3","engine":"sweet","label":"轻甜 · 晓伊","mood":"gentle"}
```

文件落在 `~/.dsh/im-bridge/voice/`。

发到 QQ 走 OneBot 的 `record` 段：

```js
sendSegments(chat, [{ type: 'record', data: { file: 'C:/Users/.../voice/xxx.mp3' } }])
```

NapCat 负责转成 QQ 语音消息。

## 五、什么时候会发语音

- 你明确要求（「发条语音」「用语音说」）
- 模型判断适合（受 `mediaSharing` 的语音频率限制）
- 群聊里默认不主动发语音（群友干扰大）

## 六、克隆音色（MiniMax）

`voice_id` 必须是**这个 key 所属账号下真实存在的**音色，否则 MiniMax 直接回：

```
you don't have access to this voice_id
```

查账号下有哪些音色：

```powershell
POST https://api.minimax.cn/v1/get_voice
{"voice_type":"all"}
# 返回 system_voice（303 个系统音色）+ voice_cloning（你自己的克隆音色）
```

2026-10-27 实测：本机 key 下 `voice_cloning` 只有 **`c4clone001`**，
之前配置里写的 `clonezh001` 不存在，所以一直报无权限。改成 `c4clone001` 后试听成功
（42.6KB mp3，`engine: minimax`，`capability: emotion`）。

常见系统音色（免克隆）：

```
female-tianmei   甜美女性
female-shaonv    少女
female-yujie     御姐
female-chengshu  成熟女性
```

## 七、注意

- 语音是**在线合成**，断网就退回 SAPI 或失败；失败会走文字
- 缓存按文本+音色哈希，同一句不重复合成
- 音色文件在 `assets/voice-pack/*.mp3`，只用于面板试听
- MiniMax 每句会先做一次「情境判断」拿语气指令，失败会降级成文字（`lastError` 里有原因）
