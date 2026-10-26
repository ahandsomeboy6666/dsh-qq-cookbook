# 文档索引

每篇一句话说明 + 状态。状态含义：**已定**（已拍板）、**参考**（外部事实基线）、**草案**（待确认）。

## 入口

| 文件 | 一句话 | 状态 |
|---|---|---|
| [README.md](../README.md) | 全貌、一分钟选型、最小回环 | 已定 |
| [AGENTS.md](../AGENTS.md) | AI 执行者规范：事实纪律、红绿流程、任务卡 | 已定 |

## 提案与选型

| 文件 | 一句话 | 状态 |
|---|---|---|
| [docs/00-proposal.md](00-proposal.md) | 为什么做、做到什么程度、不做什么、成功标准 | 已定 |
| [docs/01-tech-selection.md](01-tech-selection.md) | 五条 DSH 接入通道、四类 QQ 协议端、推荐堆栈 | 已定 |
| [docs/02-architecture.md](02-architecture.md) | 组件、入站/出站数据流、会话映射、失败模式 | 已定 |
| [docs/03-threat-model.md](03-threat-model.md) | 信任边界、攻击面、六条红线与对策 | 已定 |
| [docs/07-ux-spec.md](07-ux-spec.md) | 体验目标、11 个场景、U1–U10 指标、文案与群聊礼仪 | 已定 |
| [docs/10-current-plan.md](10-current-plan.md) | **当前方案一页纸**：cheems + NapCat + 30 元授权 + 两套人设 | 已拍板 |

## 事实台账

| 文件 | 一句话 | 状态 |
|---|---|---|
| [docs/FACTS.md](FACTS.md) | 当前事实的单一真源、引用点与检查规则（F1–F6） | 已定 |

## 执行

| 文件 | 一句话 | 状态 |
|---|---|---|
| [docs/04-acceptance.md](04-acceptance.md) | 每个里程碑的验收命令、期望输出、红灯示例 | 已定 |
| [docs/05-roadmap.md](05-roadmap.md) | D0–D3 部署（主线）+ M0–M4 自建（已归档） | 已定 |
| [docs/06-methodology.md](06-methodology.md) | 可复用的 AI 开发范式（回答「其他项目也类似？」） | 已定 |

## 决策记录（ADR）

| 文件 | 一句话 | 状态 |
|---|---|---|
| [docs/decisions/README.md](decisions/README.md) | 决策台账：每条推荐值、备选、影响、状态 | 已定 |
| [docs/decisions/ADR-001-qq-endpoint.md](decisions/ADR-001-qq-endpoint.md) | QQ 协议端：官方 Bot 默认 + NapCat 群友路线 | 待确认 |
| [docs/decisions/ADR-002-dsh-access.md](decisions/ADR-002-dsh-access.md) | DSH 接入默认 Web `/api`，ACP/SDK 作为可选自动化通道 | 待确认 |
| [docs/decisions/ADR-003-process-shape.md](decisions/ADR-003-process-shape.md) | 独立桥接进程，不做进程内插件 | 待确认 |
| [docs/decisions/ADR-004-session-mapping.md](decisions/ADR-004-session-mapping.md) | 1 个 QQ 会话 = 1 个 DSH 会话，映射持久化 | 待确认 |
| [docs/decisions/ADR-005-persona-layers.md](decisions/ADR-005-persona-layers.md) | 人格两层：preset 管行为，roles 管人设 | 待确认 |
| [docs/decisions/ADR-006-security.md](decisions/ADR-006-security.md) | fail-closed 白名单 + preset 工具裁剪 + 发送审计 | 待确认 |
| [docs/decisions/ADR-007-streaming.md](decisions/ADR-007-streaming.md) | 首条早发 + 长回复分条 + 进度占位 | 待确认 |
| [docs/decisions/ADR-008-interrupt.md](decisions/ADR-008-interrupt.md) | 忙时三路：cancel / steer / 排队 | 待确认 |
| [docs/decisions/ADR-009-model-routing.md](decisions/ADR-009-model-routing.md) | flash 默认、复杂任务升 pro、图片 M1 | 待确认 |
| [docs/decisions/ADR-010-group-chat.md](decisions/ADR-010-group-chat.md) | 群聊只在触发时参与，短、分条、引用、冷却 | 待确认 |
| [docs/decisions/ADR-011-onboarding.md](decisions/ADR-011-onboarding.md) | 一键向导 + 控制台 + 统一失败文案 | 待确认 |

## 外部事实基线

| 文件 | 一句话 | 状态 |
|---|---|---|
| [docs/references/dsh-capability-matrix.md](references/dsh-capability-matrix.md) | DSH 五条接入面的能力对照，每条标版本与出处 | 参考 |
| [docs/references/prior-art.md](references/prior-art.md) | 6 个已有实现、两条路线、可吸收设计与选型修正 | 参考 |
| [docs/references/experience-scorecard.md](references/experience-scorecard.md) | 7 个方案的 6 维体验评分与分场景推荐 | 参考 |
| [docs/references/qq-bridge-baseline.md](references/qq-bridge-baseline.md) | qq-bridge 的实测结论：哪些可复用、哪些需复核 | 参考 |

## 可复制模板

| 文件 | 一句话 | 状态 |
|---|---|---|
| [docs/templates/task-card.md](templates/task-card.md) | 任务卡模板（五段 + 可执行验收） | 参考 |
| [docs/templates/proposal.md](templates/proposal.md) | 提案模板（目标/非目标/成功标准/假设/风险） | 参考 |
| [docs/templates/adr.md](templates/adr.md) | ADR 模板（六段 + 状态机） | 参考 |
| [docs/templates/AGENTS.skeleton.md](templates/AGENTS.skeleton.md) | 新项目 AGENTS.md 骨架（30 分钟初始化） | 参考 |
| [docs/templates/ci-check.yml](templates/ci-check.yml) | GitHub Actions 门禁模板（复制到 `.github/workflows/`） | 参考 |
