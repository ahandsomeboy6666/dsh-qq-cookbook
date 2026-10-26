# 决策台账

每条决策都有独立的 ADR。**状态不是「已接受」之前，代码不落地对应实现。**

## 台账

| ID | 主题 | 推荐值 | 备选 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D1 | QQ 协议端 | OneBot v11 + NapCat 默认 | SnowLuma / 官方 Bot / AstrBot | 连接层、事件解析 | 待确认 |
| D2 | DSH 接入通道 | Web `/api` + Adapter 抽象 | ACP / SDK / webhook / 插件 | 桥接核心、升级适配 | 待确认 |
| D3 | 进程形态 | 独立进程 | 进程内插件 | 部署、故障隔离 | 待确认 |
| D4 | 会话映射 | 1 QQ 会话 = 1 DSH 会话 | 每条消息新会话 | 成本、上下文、安全指纹 | 待确认 |
| D5 | 人格分层 | preset + roles 两层 | 单层 prompt | 人格维护、成本 | 待确认 |
| D6 | 安全模型 | fail-closed + 工具裁剪 | 事后审计 | 全部出站路径 | 待确认 |
| D7 | 回复节奏 | 首条早发 + 分条 + 进度占位 | 整轮一次性发 | 首条延迟、可读性 | 待确认 |
| D8 | 打断 | cancel / steer / 排队 三路 | 全部排队 | 控制感 | 待确认 |
| D9 | 模型路由 | flash 默认、复杂升 pro、图片 M1 | 固定 pro | 延迟、质量、成本 | 待确认 |
| D10 | 群聊 | 触发式参与 + 短条 + 冷却 | 每条都回 | 刷屏、token | 待确认 |
| D11 | 部署 | 向导 + 控制台 + 统一文案 | 手改配置 | 上手时间、排错 | 待确认 |

## ADR 索引

| ADR | 决策 | 状态 |
|---|---|---|
| [ADR-001-qq-endpoint.md](ADR-001-qq-endpoint.md) | QQ 协议端选 OneBot v11，NapCat 默认 | 待确认 |
| [ADR-002-dsh-access.md](ADR-002-dsh-access.md) | DSH 接入默认 Web `/api`，ACP/SDK 备选 | 待确认 |
| [ADR-003-process-shape.md](ADR-003-process-shape.md) | 桥接作为独立进程 | 待确认 |
| [ADR-004-session-mapping.md](ADR-004-session-mapping.md) | 1:1 会话映射并持久化 | 待确认 |
| [ADR-005-persona-layers.md](ADR-005-persona-layers.md) | 人格两层：行为与人设分离 | 待确认 |
| [ADR-006-security.md](ADR-006-security.md) | fail-closed 安全模型 | 待确认 |
| [ADR-007-streaming.md](ADR-007-streaming.md) | 首条早发 + 长回复分条 | 待确认 |
| [ADR-008-interrupt.md](ADR-008-interrupt.md) | 忙时三路：cancel / steer / 排队 | 待确认 |
| [ADR-009-model-routing.md](ADR-009-model-routing.md) | flash 默认、复杂升 pro、图片 M1 | 待确认 |
| [ADR-010-group-chat.md](ADR-010-group-chat.md) | 群聊触发式参与 | 待确认 |
| [ADR-011-onboarding.md](ADR-011-onboarding.md) | 向导 + 控制台 + 失败文案 | 待确认 |

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

## 待用户拍板的清单

| # | 问题 | 选项 | 默认建议 |
|---|---|---|---|
| Q1 | 用哪个 QQ 协议端做 M0？ | NapCat（本机已有）/ SnowLuma | NapCat |
| Q2 | 主通道接受 Web `/api` 的版本敏感吗？ | 接受 + 适配层 / 改用 ACP 牺牲审批 | 接受 |
| Q3 | 回复节奏？ | 首条早发 + 分条 / 整轮一次发 | 首条早发 |
| Q4 | 打断策略？ | 三路（停/改/问）/ 一律排队 | 三路 |
| Q5 | 模型默认？ | flash（快）/ pro（稳） | flash，复杂升 pro |
| Q6 | 群聊默认？ | 只在被 @ 时参与 / 每条都回 | 只在触发时 |
| Q7 | 部署形态？ | 向导 + 控制台 / 只给配置文件 | 向导 |
| Q8 | 本轮节奏？ | 先出 UX 规格与任务卡，再写代码 | 先规格 |
| Q9 | 许可证与语言？ | MIT + 中文为主 | MIT |
