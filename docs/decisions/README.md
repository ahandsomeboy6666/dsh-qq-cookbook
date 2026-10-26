# 决策台账

每条决策都有独立的 ADR。**状态不是「已接受」之前，代码不落地对应实现。**

| ID | 主题 | 推荐值 | 备选 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D1 | QQ 协议端 | OneBot v11 + NapCat 默认 | SnowLuma / 官方 Bot / AstrBot | 连接层、事件解析 | 待确认 |
| D2 | DSH 接入通道 | Web `/api` + Adapter 抽象 | ACP / SDK / webhook / 插件 | 桥接核心、升级适配 | 待确认 |
| D3 | 进程形态 | 独立进程 | 进程内插件 | 部署、故障隔离 | 待确认 |
| D4 | 会话映射 | 1 QQ 会话 = 1 DSH 会话 | 每条消息新会话 | 成本、上下文、安全指纹 | 待确认 |
| D5 | 人格分层 | preset + roles 两层 | 单层 prompt | 人格维护、成本 | 待确认 |
| D6 | 安全模型 | fail-closed + 工具裁剪 | 事后审计 | 全部出站路径 | 待确认 |

## ADR 索引

| ADR | 决策 | 状态 |
|---|---|---|
| [ADR-001-qq-endpoint.md](ADR-001-qq-endpoint.md) | QQ 协议端选 OneBot v11，NapCat 默认 | 待确认 |
| [ADR-002-dsh-access.md](ADR-002-dsh-access.md) | DSH 接入默认 Web `/api`，ACP/SDK 备选 | 待确认 |
| [ADR-003-process-shape.md](ADR-003-process-shape.md) | 桥接作为独立进程 | 待确认 |
| [ADR-004-session-mapping.md](ADR-004-session-mapping.md) | 1:1 会话映射并持久化 | 待确认 |
| [ADR-005-persona-layers.md](ADR-005-persona-layers.md) | 人格两层：行为与人设分离 | 待确认 |
| [ADR-006-security.md](ADR-006-security.md) | fail-closed 安全模型 | 待确认 |

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

## 待用户拍板的清单

| # | 问题 | 选项 | 默认建议 |
|---|---|---|---|
| Q1 | 用哪个 QQ 协议端做 M0？ | NapCat（本机已有）/ SnowLuma | NapCat |
| Q2 | 主通道接受 Web `/api` 的版本敏感吗？ | 接受 + 适配层 / 改用 ACP 牺牲审批 | 接受 |
| Q3 | M0 的出站模式？ | relay（桥接转发）/ tools（agent 主动发） | relay |
| Q4 | 本轮是否只出文档 + 检查脚本？ | 是 / 同时出最小可跑代码 | 是 |
| Q5 | 许可证与文档语言？ | MIT + 中文为主 | MIT |
| Q6 | 是否要支持与 AstrBot 共存？ | 独立小号、不共享账号 / 接管 | 独立小号 |
