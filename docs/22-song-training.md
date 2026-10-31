# 唱歌训练：训练集 + GPU 步骤

> 目标：用肥鱼的音色唱一首歌。2026-10-31 起。

## 一、训练集（本地生成）

- 位置：`E:/workspace/so-vits-svc-directml/dataset_raw/c4/`
- 内容：火山 TTS（`S_DfDMiwMj2`）生成的 60 条中性语句（约 25 分钟）
- 格式：mp3，24kHz
- 打包：`c4-dataset.zip`（上传 GPU 用）

## 二、租 GPU

| 平台 | 地址 | 推荐 |
|---|---|---|
| 恒源云 | https://www.gpushare.com | RTX 4090 / 48GB（¥3/h） |
| AutoDL | https://www.autodl.com | 有货时 4090 |
| 矩池云 | https://www.matpool.com | 备选 |

镜像：**PyTorch 2.x + CUDA 12.x**。

## 三、上传 + 训练

```bash
# 1. 传代码 + 训练集
#    用 JupyterLab 上传 c4-dataset.zip，解压到 dataset_raw/c4/

# 2. 装依赖
pip install -r requirements.txt

# 3. 预处理
python resample.py
python preprocess_flist_config.py
python preprocess_hubert_f0.py

# 4. 训练（3090/4090 约 1-2 小时）
python train.py -c configs/config.json -m 32k

# 5. 下载模型
#    logs/32k/G_*.pth（约 100-200MB）
```

## 四、本地推理（9070XT DirectML）

```powershell
python inference_main.py `
  -m "logs/32k/G_xxx.pth" `
  -c "configs/config.json" `
  -n "songs/pingyong-vocals.wav" `
  -t 0 -s c4 -f0p "rmvpe"
```

## 五、混音

```powershell
ffmpeg -i converted.wav -i no_vocals.wav -filter_complex amix=inputs=2 out.mp3
```

## 六、坑

- DirectML **只能推理，不能训练**（README 明确）
- 训练集要中性（情绪污染音色）
- so-vits 32k 模型推理更快、显存更小

## 七、2026-11-01 实测结论（重要）

### so-vits 路线：效果不达标（已停）

- 训练：200 条 TTS 语音（火山 24k）→ 13000 步（G_13000），云 GPU 约 3 小时
- 推理：本地 CPU 6 秒/25 秒音频（可接受）
- **效果**：吐字不清（转换源 + 模型失真）、音色偏亮（质心 1613 vs IndexTTS 1325）
- EQ 补偿（bass +4 / 1k-2k +3 / 4k-8k -5）能把质心压到 1373，但吐字问题改不了
- **结论**：so-vits 不适合「TTS 合成音训练 + 唱歌转换」

### RVC 路线：环境冲突（未跑通）

- 云服务器（py3.11 + cu121）与 RVC 依赖（py312 + cu118）冲突：torch 被升级、fairseq 缺失
- **正确环境**：Python 3.10 + CUDA 11.8 镜像（RVC 兼容）
- 9070XT 只能推理（DirectML），训练必须 NVIDIA GPU

### 教训

1. 训练数据用 TTS 合成音（24k 上采样 32k）会引入高频伪影
2. 训练前先确认镜像版本（RVC 对 py/cu 版本敏感）
3. 云 GPU 按小时计费，环境折腾的成本比训练本身高
