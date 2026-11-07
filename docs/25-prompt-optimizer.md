# 25. 提示词优化器（独立工具，按需使用）

> **定位：独立工具，不在肥鱼日常生图流程里。**
> 只在需要「把一段需求打磨成最佳提示词」时手动跑一次。
> 平时生图直接用 `models/loras/README.md` 里的配方。

## 它是什么

`ComfyUI-PromptOptimizer`（本地 Web 工具，端口 8091）

```
你给一句话需求
  → LLM（DeepSeek）写「设计稿」
  → 按 Qwen 官方 8 步 observer 散文规范成稿
  → ComfyUI 渲染（Qwen Image 2.1）
  → 视觉 LLM 按「优化目标」逐维度打分
  → 依分数局部重写（爬山）
  → 反复直到分数不再提升
  → 输出「被打分验证过」的最优提示词
```

**唯一变量是提示词**（模型/采样/种子全程固定）——所以分数变化等于提示词质量变化。

## 何时用

| 场景 | 用不用 |
|---|---|
| 日常给肥鱼生图 | ❌ 不用（走配方） |
| **要一个可复用的高质量 prompt** | ✅ 用（跑一次，拿走 prompt） |
| 调试「为什么这张不够好」 | ✅ 用（看低分维度） |
| 批量生图 | ❌ 不用（太慢，每轮都要渲染） |

## 启动 / 停止

```powershell
# 启动（ComfyUI 必须先在跑）
cd E:\workspace\comfyui\ComfyUI_windows_portable\ComfyUI\custom_nodes\ComfyUI-PromptOptimizer
E:\workspace\comfyui\ComfyUI_windows_portable\python_embeded\python.exe -u server.py
# 打开 http://127.0.0.1:8091/
```

## 首页要填的

| 字段 | 说明 |
|---|---|
| 任务名 | 便于在历史里认出来 |
| 画面诉求（brief） | 一句话即可（会扩写成 4000+ 字） |
| 优化目标 | 重点要达成的质量点（如「五官自然、皮肤真实、光影层次」） |
| LLM 地址 | `https://api.deepseek.com/v1` |
| LLM 模型 | `deepseek-chat` |
| API Key | DeepSeek 的 key |
| ComfyUI | `http://127.0.0.1:8188` |

## 看分数（页面不显示，用脚本）

```powershell
node E:\workspace\dsh-qq-cookbook\tools\show-prompt-scores.cjs
node E:\workspace\dsh-qq-cookbook\tools\show-prompt-scores.cjs <任务ID>
```

输出示例：

```
任务 184a1aa920
最优: hill02 = 6.5
轮次      分数   判定     类型
admit01     5.5  fail    admission_rewrite
hill01      5.5  fail    hill_child
hill02      6.5  fail    hill_child      ★
hill03      5.5  fail    hill_child
hill04      6.5  fail    hill_child
hill05      5.5  fail    hill_child
走势: 5.5 → 5.5 → 6.5 → 5.5 → 6.5 → 5.5  (最高 6.5)
```

## 数据在哪

| 内容 | 路径 |
|---|---|
| 每轮分数/判定 | `ComfyUI-PromptOptimizer/outputs/<任务ID>/optimizer_history.json` |
| 每轮提示词 | `.../outputs/<任务ID>/<轮次>/prompt.txt` |
| 每轮出图 | `.../outputs/<任务ID>/<轮次>/qwen21/<轮次>/img_*.png` |

## 已知问题

| 问题 | 现状 |
|---|---|
| 页面「结果」区分数显示为「—」 | server.py 读 history 的逻辑有 bug（数据是好的） |
| 绕过方式 | 用 `show-prompt-scores.cjs` 读 JSON |

## 实测记录（2026-11-07）

| 任务 | 需求 | 最优分 | 轮数 |
|---|---|---|---|
| 184a1aa920 | 肥鱼 2.5D（窗边/蓝发/女仆/柔光） | **6.5**（hill02） | 6 |

> 评分尺度参考：准入线 5.0；6.5 以上属于「较好」；不同 prompt 之间可比，跨任务不完全可比。
