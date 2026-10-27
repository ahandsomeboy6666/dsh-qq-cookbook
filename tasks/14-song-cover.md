# 任务 14：唱歌（30 秒片段验证）

## 目标

让肥鱼用自己的音色唱 30 秒歌，发到 QQ。

## 输入

- 一首歌的 30 秒片段（mp3/wav）
- 肥鱼的参考音频：10–30 秒干净独白（用现有 MiniMax 音色合成）
- 本机 Python：`E:\dsh桌面端\resources\runtime\primary-runtime\dependencies\python\python.exe`
- ffmpeg：`~/.pyffmpeg/bin/ffmpeg.exe`
- 选型依据：[docs/18](../docs/18-song-cover.md)

## 输出

- `output/ref.wav`：参考音频
- `output/vocals.wav` / `no_vocals.wav`：分离结果
- `output/converted.wav`：转换后的人声
- `output/cover.mp3`：混音成品（30 秒）

## 验收

- [ ] `ffmpeg -i output/cover.mp3 -f null -` 无报错（文件可解码）
- [ ] `ffprobe -v error -show_entries format=duration -of csv=p=0 output/cover.mp3` 输出在 25–35 之间
- [ ] `ffprobe -v error -show_entries format=size -of csv=p=0 output/cover.mp3` 小于 8388608（8MB）
- [ ] `ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 output/cover.mp3` 输出 ≥ 44100

## 人工验收

- [ ] 听得出是肥鱼的音色，而不是原唱
- [ ] 没有明显跑调、断句错位
- [ ] 能通过 QQ 发出去并正常播放

## 不做什么

- 不做整首歌（等阶段 1 通过再评估）
- 不训练 RVC（本机无 CUDA）
- 不上传第三方平台
- 不自动在群里发（要人请求）

## 依赖安装

```powershell
& 'E:\dsh桌面端\resources\runtime\primary-runtime\dependencies\python\python.exe' -m pip install `
  demucs seed-vc -i https://pypi.tuna.tsinghua.edu.cn/simple
```

## 卡点记录（执行时填）

| 步骤 | 耗时 | 结果 | 问题 |
|---|---|---|---|
| 分离 | | | |
| 转换 | | | |
| 混音 | | | |
| 发送 | | | |
