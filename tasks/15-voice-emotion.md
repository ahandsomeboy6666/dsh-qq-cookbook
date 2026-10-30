# 任务 15：语音情绪（L1 参数 + L2 文本标记）

## 目标

同一句话，听起来有情绪，不像念稿。

## 输入

- 选型依据：[docs/19](../docs/19-voice-emotion.md)
- 现有实现：`vendor/dsh-im-bridge/voice-studio.js`
- 当前配置：`engine=minimax`、`model=speech-2.8-hd`、`emotion=auto`、`voiceId=c4clone001`
- MiniMax 参数：emotion 9 档 / speed 0.5–2 / pitch -12–12 / 文本 `<#x#>` 停顿 / `(sighs)` 等语气词

## 输出

- 改 `voice-studio.js`：auto 时按心情推导 emotion，speed/pitch 随情绪微调
- 改 `voice-studio.js`：送 TTS 前按句末标点插停顿标记
- 新增 `patches/` 补丁条目 + `check-patches` 断言

## 验收

- [ ] `node checks/check-patches.mjs` 里的情绪断言显示 OK
- [ ] `node -e "const s=require('fs').readFileSync('vendor/dsh-im-bridge/voice-studio.js','utf8'); if(!/gentle.*happy|happy.*gentle/.test(s)) throw new Error('gentle 仍映射成 calm'); console.log('ok')"`
- [ ] `node -e "const s=require('fs').readFileSync('vendor/dsh-im-bridge/voice-studio.js','utf8'); if(!/<\#/.test(s)) throw new Error('没有停顿标记'); console.log('ok')"`

## 人工验收

- [ ] 同一句文本，4 种情绪各合成一次，听感有明显差异（排序即可，不要求"哪种更好"）
- [ ] 安慰场景（gentle）不再是平调
- [ ] `(sighs)` 之类的语气词没有变成噪音
- [ ] `<#0.3#>` 停顿没有被读成"井号"

## 不做什么

- 不换 TTS 供应商（Fish Audio 只作为 L3 备选）
- 不重新克隆音色
- 不给每句话都加语气词（只按情绪选择性加）
- 不动播放链路（发送、格式转换）

## 卡点记录（执行时填）

| 步骤 | 结果 | 说明 |
|---|---|---|
| L1 emotion 映射 | | |
| L1 speed/pitch 联动 | | |
| L2 停顿插入 | | |
| L2 语气词 | | |
| 人工听感 | | |
