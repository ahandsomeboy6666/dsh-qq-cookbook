# 唱歌功能：技术选型

> 状态：**选型中**（2026-10-28）。只做结论与路线，不写实现。
> 目标：让肥鱼用自己的声音唱一段歌，发到 QQ 里。

## 一、需求拆解

```
一首歌（原曲 mp3）
  → ① 分离：拆成人声 + 伴奏
  → ② 转换：把人声换成肥鱼的音色
  → ③ 混音：新的人声 + 原伴奏
  → ④ 发送：mp3 → QQ 语音/文件
```

## 二、现实约束（决定了路线）

| 约束 | 事实 | 影响 |
|---|---|---|
| **无 NVIDIA GPU** | 本机是 AMD RX 9070 XT + 无 CUDA | 训练模型基本不可行；推理只能 CPU 或 DirectML |
| **音色在云上** | MiniMax 克隆音色 `c4clone001` 是云服务，**不能导出模型权重** | 不能用它直接训 RVC |
| **QQ 语音时长** | 语音消息一般 ≤60 秒 | 不需要整首歌，30–60 秒片段就够 |
| **CPU 算力** | Ryzen 7 9700X + 31GB | 处理 30 秒片段可以接受；整首歌会很慢 |
| ffmpeg | 已有 `~/.pyffmpeg/bin/ffmpeg.exe` | 混音/转码不用另装 |

## 三、候选方案对比

| 方案 | 要训练吗 | 音色从哪来 | CPU 可行 | 相似度 | 备注 |
|---|---|---|---|---|---|
| **Seed-VC（零样本）** | ❌ 不用 | 一段 10–30 秒参考音频 | ✅ 待实测 | 中 | 支持 **singing voice conversion**，PyPI 有包（0.4.3） |
| **RVC v2（训练）** | ✅ 需要 GPU 训练 | 自训模型 | 推理可 | 高 | 训练要租云 GPU；本机训不动 |
| **So-VITS-SVC** | ✅ 同上 | 自训模型 | 推理可 | 高 | 生态较旧 |
| **云 API 翻唱** | ❌ | 上传音频 | — | 中 | 音频要上传第三方，隐私风险 |
| **不做** | — | — | — | — | 现有 TTS 只能说话，唱不了 |

**关键判断**：`Seed-VC` 是唯一同时满足「免训练 + 能用云 TTS 音色」的路线——因为零样本只要参考音频，而参考音频可以直接用 MiniMax 合成。

## 四、推荐路线（两阶段）

### 阶段 1：30 秒片段（先证明能跑通）

```powershell
# 1. 取 30 秒伴奏 + 原唱
ffmpeg -i song.mp3 -ss 60 -t 30 clip.mp3

# 2. 分离（CPU，约 1-3 分钟）
demucs --two-stems=vocals clip.mp3
#   → separated/htdemucs/clip/vocals.wav + no_vocals.wav

# 3. 生成参考音频（用现有 MiniMax 音色说一段独白，10-30 秒）
#    已有能力：POST /im-bridge/voice/preview 或让她说一段

# 4. 零样本转换
seed-vc --source vocals.wav --reference ref.wav --output converted.wav

# 5. 混音
ffmpeg -i converted.wav -i no_vocals.wav -filter_complex amix=inputs=2 -t 30 out.mp3
```

验收：人耳判断「像不像肥鱼在唱」，不是「有没有声音」。

### 阶段 2：整首歌（看阶段 1 的效果与耗时再定）

- 若 CPU 太慢 → 租云 GPU（按小时，几块钱）批量处理
- 若相似度不够 → 走 RVC：用 MiniMax 合成的 20–30 分钟语音训练，本地 CPU 推理

## 五、为什么阶段 1 值得先做

1. **验证相似度**：零样本能不能听出是肥鱼，决定要不要走训练路线
2. **验证耗时**：CPU 跑 30 秒要多久，决定整首歌是否现实
3. **验证链路**：分离/转换/混音/发送四步能不能串起来
4. **成本可控**：只装两个 Python 包，不租 GPU

## 六、风险

| 风险 | 说明 |
|---|---|
| **CPU 太慢** | Seed-VC 在 CPU 上的实时率未知，30 秒可能要几分钟 |
| **相似度不够** | 零样本对参考音频质量敏感；用 TTS 合成的声音作参考，可能带「机器味」 |
| **AMD 显卡用不上** | PyTorch 默认 CUDA；DirectML 对这类模型支持不保证 |
| **版权** | 翻唱分发的版权问题，自己听/群里玩与公开传播是两回事 |
| **QQ 语音格式** | 输出要转成 QQ 能播的格式（mp3 由 NapCat 转 silk） |

## 七、待验证（动手前先测）

| # | 问题 | 怎么测 |
|---|---|---|
| V1 | Seed-VC 在 CPU 上 30 秒音频要多久 | 装包后跑一次，计时 |
| V2 | TTS 合成的参考音频够不够干净 | 转一段出来听，有没有气口/断续 |
| V3 | Demucs CPU 分离 30 秒要多久 | 跑一次计时 |
| V4 | 转换后是否还像原曲的调 | 听是否跑调/走音 |
| V5 | 输出能否被 NapCat 当语音发出去 | 手工发一次 |

## 八、不做什么

- 不做整首歌的实时流式演唱（CPU 算力不够）
- 不把音频上传到第三方翻唱平台（隐私）
- 不用 RVC 训练除非阶段 1 证明相似度不够
- 不自动在群里发翻唱（做成她收到请求才唱）

## 九、装什么（阶段 1 需要的依赖）

```powershell
# 用 DSH 内置 Python
& 'E:\dsh桌面端\resources\runtime\primary-runtime\dependencies\python\python.exe' -m pip install `
  demucs seed-vc ffmpeg-python `
  -i https://pypi.tuna.tsinghua.edu.cn/simple
```

> 注意：`seed-vc` 会拉 torch。默认装的是 CPU 版；AMD 显卡用不上 CUDA，
> 若想试 DirectML，需要另装 `torch-directml`，且 Seed-VC 未必兼容——**作为可选实验，不阻塞阶段 1**。
