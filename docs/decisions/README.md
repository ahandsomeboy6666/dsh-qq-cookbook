# 决策台账

每条决策都有独立的 ADR。**状态不是「已接受」之前，代码不落地对应实现。**

## 台账

| ID | 主题 | 最终结论 | 备选 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D1 | QQ 协议端 | cheems 插件 + NapCat（小号） | 官方 Bot / SnowLuma | 连接层、事件解析 | 已接受 |
| D2 | DSH 接入 | cheems 插件（进程内），适配层自带 | Web `/api` / ACP / SDK | 桥接核心 | 已接受 |
| D3 | 进程形态 | 纯插件（cheems） | 独立 transport / 混合 | 部署、故障隔离 | 已取代 |
| D4 | 会话映射 | 1 QQ 会话 = 1 DSH 会话（cheems 自带） | 每条消息新会话 | 上下文、成本 | 已接受 |
| D5 | 人格分层 | cheems 面板两套人设（私聊/群聊） | preset + roles 自管 | 人设维护 | 已接受 |
| D6 | 安全模型 | fail-closed + 受益人白名单 + 禁转账 | 事后审计 | 全部出站路径 | 已接受 |
| D7 | 回复节奏 | cheems `\|\|\|` 分条 0.6–2.8s + 主动 | 整轮一次性发 | 首条延迟、可读性 | 已接受 |
| D8 | 打断 | cheems `/cancel` | steer / 三路 | 控制感 | 已接受 |
| D9 | 模型 | cheems 智力档位（省/标准/高/最高） | 固定模型 | 延迟、质量 | 已接受 |
| D10 | 群聊 | 被 @ 才回，短、有梗、不刷屏 | 每条都回 | 刷屏、token | 已接受 |
| D11 | 部署 | cheems 18 页面板 | 自建向导/控制台 | 上手时间 | 已接受 |

## ADR 索引

| ADR | 决策 | 状态 |
|---|---|---|
| [ADR-001-qq-endpoint.md](ADR-001-qq-endpoint.md) | cheems（NapCat）默认，官方 Bot 备选 | 已接受 |
| [ADR-002-dsh-access.md](ADR-002-dsh-access.md) | cheems 插件形态成立，适配层自带 | 已接受 |
| [ADR-003-process-shape.md](ADR-003-process-shape.md) | 混合形态（独立 transport + 插件） | 已取代 |
| [ADR-004-session-mapping.md](ADR-004-session-mapping.md) | 1:1 会话映射（cheems 自带） | 已接受 |
| [ADR-005-persona-layers.md](ADR-005-persona-layers.md) | 人格分层（cheems 面板两套） | 已接受 |
| [ADR-006-security.md](ADR-006-security.md) | fail-closed + 受益人白名单 | 已接受 |
| [ADR-007-streaming.md](ADR-007-streaming.md) | 分条 0.6–2.8s（cheems 实现） | 已接受 |
| [ADR-008-interrupt.md](ADR-008-interrupt.md) | `/cancel` 打断 | 已接受 |
| [ADR-009-model-routing.md](ADR-009-model-routing.md) | 智力档位切模型 | 已接受 |
| [ADR-010-group-chat.md](ADR-010-group-chat.md) | 群聊被 @ 才回 | 已接受 |
| [ADR-011-onboarding.md](ADR-011-onboarding.md) | 面板配置代替向导 | 已接受 |

## 最终拍板记录

**2026-10-27**，用户确认：

1. 接入 **cheems135/dsh-qq-bridge**（NapCat 插件）。
2. 私聊人设：活泼、热情、可爱、温柔、关心。
3. 群聊：只要好玩（玩梗、表情、斗图），不需要情绪氛围。
4. 零花钱：小号、只充余额、受益人只有 owner 与 self、禁转账。
5. 小号只加 owner 好友，只进群。

方案定稿见 [当前方案](../10-current-plan.md)。

## 状态机

```
待确认 ──用户拍板──► 已接受 ──实现并跑通验收──► 已验证
   │                    │
   └──否决──► 已否决    └──新证据推翻──► 已取代（链接新 ADR）
```

## 变更规则

1. 改推荐值 = 新开一篇 ADR 并把旧篇标「已取代」，不直接改旧文。
2. 「已验证」必须附验收命令与输出摘要（版本、日期）。
3. 用户否决的决策保留原文与理由，不删除——下一个人需要知道为什么没走那条路。
4. **不因「已经写过」「已经有实现」保留低体验方案**；旧结论可以被新目标推翻，推翻时留痕。

## 待办

- D0–D3 部署任务见 [tasks/README.md](../../tasks/README.md)。
- 环境未就绪：NapCat 未启动、cheems 未安装。
