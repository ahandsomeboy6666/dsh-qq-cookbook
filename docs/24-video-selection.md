# 24. 本地视频生成选型（2026-11）

> **定位**：同 [23](23-local-ai-selection.md)——本仓库不含模型/工作流/部署脚本。本文只给选型判断与实测结论。

## 1. 2026 年可用模型全景

| 模型 | 参数量 | 16GB 可行性 | 特点 |
|---|---|---|---|
| **LTX-2.5**（distilled） | ~13B | ✅ 量化后可跑 | 秒级、音视同步（LTX-2 起） |
| Wan 2.2 14B T2V | 14B | ⚠️ offload（慢） | 质量最高，分钟级 |
| MiniMax H3 | 20B + 32B 编码器 | ⚠️ 仅 GGUF Q4/Q6 | 官方路线 16GB 不友好 |
| CogVideoX-5B | 5B | ✅ 轻松 | 老一代，图生视频 |

## 2. LTX-2.5（首选）

社区量化仓库：`joeygambino/LTX-2.5-Quantized`（8081 下载）

| 文件 | 大小档 | 建议 |
|---|---|---|
| LTX25-distilled-DiT-Q4_K_M.gguf | ~8GB | 16GB 推荐 |
| LTX25-distilled-DiT-Q5_K_M.gguf | ~10GB | 留余量 |
| LTX25-distilled-DiT-Q6_K.gguf | ~12GB | 质量优先 |
| ltX25-distilled-DiT-comfy-int8.safetensors | ~13GB | safetensors 路线 |
| LTX25-distilled-DiT-comfy-w4a4.safetensors | ~7GB | 极致省显存 |

要点：
- 需要 **ComfyUI-GGUF** 节点（GGUF 路线）
- distilled 版步数少（4-8 步），配 turbo 更快
- 分辨率别拉满（768p 起）

## 3. Wan 2.2 14B

| 项 | 说明 |
|---|---|
| 官方量化 | `wan2.2_t2v_14B_fp8_scaled`（Comfy-Org/Wan_2.2_ComfyUI_Repackaged） |
| 加速 LoRA | lightx2v 的 4-step LoRA（high/low noise 两份） |
| 实测 | 9070XT 上 14B T2V 可跑（5B TI2V 有输出损坏 bug，见 ComfyUI issue #11574） |
| 速度 | 分钟级/秒视频 |

## 4. MiniMax H3

| 项 | 说明 |
|---|---|
| 官方量化 | `pruned_w6a8`（14.9GB）、`pruned_int8`（19.5GB） |
| 编码器 | Qwen3VL **32B**（int8 也 ~32GB）——16GB 必须 offload |
| 9070XT 实测 | Civitai 有 AMD（rx9070/R9700/rx7900）跑 MMH3 的文章 |
| 已知坑 | Comfy-Org issue #17：9070XT 加载 MiniMaxH3VideoVAE 报 CUDA invalid argument |
| 社区方案 | GGUF Q4/Q6（Abiray/MiniMax-H3-Pruned-GGUF）+ B 站整合包（8G/12G 可跑） |

## 5. 9070XT + 9700X 的推荐路径

| 优先级 | 方案 | 理由 |
|---|---|---|
| **1** | **LTX-2.5 Q4/Q5 GGUF** | 显存友好、秒级、生态在 ComfyUI 里 |
| 2 | Wan 2.2 14B fp8 + 4-step LoRA | 质量最好，接受慢 |
| 3 | MiniMax H3 GGUF Q4/Q6 | 尝鲜，坑多（VAE/编码器） |

通用优化：
- `--disable-smart-memory`（模型常驻，实测提速明显）
- ComfyUI 长跑 20h+ 会 ROCm 卡死——定时重启（wmic 杀进程）
- 分辨率 768p 起，别直接 1080p

## 6. 结论

- 想「本地出片」：**LTX-2.5（Q4/Q5 GGUF）+ ComfyUI-GGUF 节点**
- 想「最高质量」：Wan 2.2 14B + 4-step LoRA（愿意等）
- MiniMax H3 目前对 16GB 不友好（编码器 32B 是硬伤），非必要不首选
- 所有模型请自行下载部署，本仓库不提供二进制资产