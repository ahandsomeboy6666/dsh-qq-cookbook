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
