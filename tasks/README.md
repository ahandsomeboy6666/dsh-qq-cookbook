# 任务总览

> **主线已切换**：当前方案是 **cheems135/dsh-qq-bridge 插件 + NapCat**（见 [当前方案](../docs/10-current-plan.md)）。
>
> `01-09` 是「自建桥接」路线，已**归档**，只作参考，不再推进。主线是 `10-13` 的部署与验收。

## 主线（D 系列）

| # | 任务 | 阶段 | 依赖 | 验收命令 | 状态 |
|---|---|---|---|---|---|
| 10 | [环境就绪](10-onboard-env.md) | D0 | 无 | `node checks/probe-onebot.mjs --json` | ✅ 完成（6700/6701，selfId 3866560965） |
| 11 | [安装 cheems 并打通回环](11-install-cheems.md) | D1 | 10 | `node checks/check-install.mjs --json` | ✅ 完成（微信私聊已通，owner=632207916） |
| 12 | [私聊/群聊两套人设](12-persona.md) | D2 | 11 | `node checks/check-persona.mjs` | ✅ 完成（`feiyu` / `feiyu-group`，preset=standard） |
| 13 | [浏览器能力与 30 元零花钱](13-allowance-browser.md) | D3 | 11 | `node checks/check-budget.mjs` | 🟡 部分（额度在示例配置，浏览器未挂） |

> 群聊行为不只靠人设：唤醒层（@ / 昵称 / 跟随窗口 / 概率 / 缓冲）是本地补丁，见
> [本地补丁清单](../docs/12-bridge-patches.md)，升级插件后要重打。

## 建议顺序

```
10 环境 ──► 11 安装 ──► 12 人设 ──► 13 能力与零花钱
```

- 10 先做：NapCat 扫码、DSH 版本、插件未装清单，一次确认。
- 11：装插件、填 wsUrl/token、私聊发 ping。
- 12：私聊「活泼热情可爱温柔关心」，群聊「好玩会玩梗」。
- 13：Playwright + 30 元授权（受益人只有 owner 和 self）。

## 已归档（自建路线，只作参考）

| # | 任务 | 为什么归档 |
|---|---|---|
| 01 | DSH 环境探针 | 探针仍有用，已并入 `checks/probe-dsh.mjs` |
| 02 | 最小收发回环 | 自建 transport，已被 cheems 取代 |
| 03 | OneBot 通道接入 | 同上 |
| 04 | 会话映射持久化 | cheems 自带 |
| 05 | 安全基线与交互转发 | cheems 自带（文字审批） |
| 06 | 人格两层 | cheems 面板人设取代 |
| 07 | 首条早发与分条 | cheems 的 `|||` 分条取代 |
| 08 | 打断、补充与并发 | cheems 的 `/cancel` 取代 |
| 09 | 图片入站与媒体上限 | cheems 多模态取代 |

这些卡保留是为了：如果 cheems 路线走不通，可以按它们自建；不要主动推进。

## 已定的背景

- 本机 DSH `0.2.0-rc.2`，profile 仅 `web` / `desktop`。
- 协议端 **NapCat**（QQ 小号，只加 owner 好友，只进群）。
- 接入 **cheems135/dsh-qq-bridge**（官方仓库，MIT）。
- 零花钱：小号只充 30 元余额、受益人只有 owner/self、禁转账（见 [config.example.json](../config.example.json)）。
