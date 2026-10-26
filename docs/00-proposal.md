# 提案：DSH 接入 QQ

> 状态：**草案**，待用户确认。确认后本文件的「待确认决策」清单转为对应 ADR 的状态。
>
> 相关：[技术选型](01-tech-selection.md) · [架构](02-architecture.md) · [威胁模型](03-threat-model.md) · [验收](04-acceptance.md)

## 一、背景

DSH 是本地优先的 coding agent，入口是 Web GUI / 桌面端。QQ 是国内最高频的「随时说一句」入口，把 DSH 接进 QQ 后，同一个 agent 可以在手机上继续干活、回答问题、发通知。

这件事已经被证明可行，而且**不止一条路**。生态里已有 6 个实现（见 [prior art](references/prior-art.md)），分成两条路线：

- **NapCat / OneBot 11**（`cheems135/dsh-qq-bridge`、`sj244/dsh-qq-bridge`、`Derpyu520/qq-bridge` 的 SnowLuma 变体）——自由、多模态强、有封号风险。
- **QQ 官方 Bot**（`988hj7tczd-oss/dsh-im-qq`、`banana770/dsh-qq-bridge`）——合规、稳定，审批是**内联按钮**，但有审核与配额。

它们共同留下了三个问题：

1. **大多是一个参考实现单点演化**，没有横向对比，版本适配债集中在少数人手里。
2. **体验参差**：有的整轮一次发、有的 `|||` 分条；有的文字审批、有的按钮审批。
3. **没有资产沉淀**：为什么选这条路线、安全边界在哪、下一版 DSH 怎么快速验证，都只存在于代码和聊天记录里。

本仓库要解决的不是「再写一个桥接」，而是把「怎么接、为什么这么接、怎么验收」变成可复制的资产。

## 二、问题陈述

| # | 问题 | 表现 | 本轮是否解决 |
|---|---|---|---|
| P1 | 接入通道对 DSH 版本敏感 | 升级后静默失效，日志里只有一行警告 | 用版本探针 + 适配层单点 + 验收矩阵解决 |
| P2 | QQ 是不可信输入，agent 是执行者 | 群友一句话可能诱导 agent 读本地文件 | 用 preset 工具裁剪 + fail-closed 白名单 + 发送审计解决 |
| P3 | 复现成本高 | 新机器要读 10k 行代码才知道每步该验什么 | 用任务卡 + 检查脚本 + 参考基线解决 |

## 三、目标（可验收）

**唯一标准：在 QQ 里用起来像个人。** 具体拆成七条：

| # | 目标 | 验收方式 |
|---|---|---|
| G1 | 新机器 15 分钟内收到第一条回复 | 向导 + 探针 + 人工计时（[UX U8](07-ux-spec.md#三指标可验收)） |
| G2 | 短问答 P50 ≤3s、P95 ≤8s；长任务首个反馈 ≤2s | `npm run test:ux-latency`、`test:ux-latency -- task` |
| G3 | 等待可打断、可补充 | `npm run test:ux-interrupt`、`test:steer` |
| G4 | 私聊不沉默、群聊不刷屏 | `npm run test:ux-quiet`、`test:group-reply` |
| G5 | 发图能懂；语音有诚实提示 | `npm run test:vision`、`test:voice` |
| G6 | 失败 5s 内人话 + 可重试 | `npm run test:ux-failure` |
| G7 | 换人格、改白名单不重启 | `npm run test:persona-hot`、`test:guid` |

细节与场景见 [UX 规格](07-ux-spec.md)。

## 四、非目标

- **不自建桥接**：直接部署 `cheems135/dsh-qq-bridge` 插件 + NapCat；自建路线（`tasks/01-09`）已归档，只作参考。
- **不重写 qq-bridge**，也不复制它的单文件结构。它只作为事实基线与功能参照。
- **不做 QQ 协议逆向**：只消费 OneBot v11 标准事件，不碰客户端注入。
- **不做多租户 / 多账号 SaaS**：单机、单账号、个人使用优先。
- **不做插件市场 / 通用 bot 平台**：不与 AstrBot 竞争，只在「DSH 是大脑」这件事上做到最好。
- **不承诺语音/视频/表情全支持**：图片 M1、语音与表情 M2，视频不做。
- **不做逐字流式**：QQ 消息不能编辑，逐字等于刷屏（[ADR-007](decisions/ADR-007-streaming.md)）。
- **不做假「正在输入」状态**：OneBot 无此能力，不假装。
- **不为节省 token 牺牲首条延迟**：默认 flash，复杂任务自动升 pro；成本可见但不作为路由限制。这是「只考虑体验」的直接含义。

## 五、成功标准

M0 完成时同时满足：

1. `node checks/check-assets.mjs` 全绿。
2. `node checks/probe-dsh.mjs --json` 能报出 `dshVersion`、`profiles`、`OneBot` 可达性，退出码 0。
3. QQ 私聊发「ping」，30 秒内收到 agent 回复；对应 DSH 会话里能看到这条用户消息。
4. 白名单外的 QQ 号发消息，桥接日志记录「已忽略」且不建会话。

M3/M4 完成时追加 UX 指标（[UX 规格第三节](07-ux-spec.md#三指标可验收)）：首条延迟、分条、打断、群聊静默、失败文案、发图理解。**指标不达标不算做完**，不允许用「功能已实现」替代。

## 六、关键假设（待验证）

| # | 假设 | 验证方式 | 失败后果 |
|---|---|---|---|
| A1 | cheems 插件与 NapCat 在本机 `0.2.0-rc.2` 上可加载、可收发 | [tasks/10-onboard-env.md](../tasks/10-onboard-env.md)、[11](../tasks/11-install-cheems.md) | 需要换官方 Bot 路线或自建 |
| A2 | NapCat 的 OneBot v11 事件形状与 SnowLuma 足够一致，桥接不需要为协议端写两套 | [tasks/03-qq-channel.md](../tasks/03-qq-channel.md) | 需要协议端适配层，工作量 +2 人日 |
| A3 | `ask_user_question` 与工具审批可以稳定转发到 QQ 并回填 | M1 验收脚本 | 交互断链，agent 长任务会卡住 |
| A4 | 单条 QQ 消息 + 历史注入不超过模型上下文，长群聊需要压缩 | token 记账脚本 | 成本失控 |

## 七、风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| DSH 协议再次变更导致静默失效 | 高 | 高 | 适配层单点 + 探针 + 版本台账；升级先跑验收矩阵 |
| QQ 账号被风控/封禁 | 中 | 高 | 只用小号；控制发送频率；不在群里刷屏；协议端只做正常消息 |
| prompt injection 诱导越权 | 高 | 高 | preset 不挂本地工具；发送白名单双重校验；敏感信息审计 |
| token 成本随群聊增长 | 中 | 中 | 上下文压缩、人格注入上限、按会话记账与告警；**不通过降级模型省钱** |
| 分条过快触发限流 | 中 | 中 | 段间隔 400–900ms、群内冷却、每轮最多 4 条 |
| 向导写入 `~/.dsh` 权限过大 | 中 | 中 | 每步展示将写什么、先备份、失败可回滚 |
| 协议端 EULA / 合规风险 | 中 | 中 | 只做本地个人使用；不打包分发协议端；文档明示风险 |

## 八、待确认决策

以下每条都需要你拍板，详细取舍见 [决策台账](decisions/README.md)：

| # | 决策 | 推荐 | 备选 |
|---|---|---|---|
| D1 | QQ 协议端 | cheems 插件 + NapCat（小号） | 官方 Bot / SnowLuma |
| D2 | DSH 接入通道 | Web `/api`（功能最全） | ACP / SDK（更正式，但不支持审批转发） |
| D3 | 进程形态 | 独立桥接进程 | DSH 进程内插件 |
| D4 | 会话映射 | 1 QQ 会话 = 1 DSH 会话，持久化 | 每条消息新会话（丢弃上下文） |
| D5 | 人格分层 | preset 管行为 + roles 管人设 | 单层 prompt |
| D6 | 安全模型 | fail-closed 白名单 + preset 裁剪 | 事后审计 |
| D7 | 实现节奏 | 按任务卡逐个里程碑，先红后绿 | 一次性大改 |
| D8 | 许可证与语言 | MIT，中文为主 + 英文 README 后补 | 其他 |
| D9 | 回复节奏 | 首条早发 + 长回复分条（[ADR-007](decisions/ADR-007-streaming.md)） | 整轮一次性发 |
| D10 | 打断 | 意图分类：cancel / steer / 排队（[ADR-008](decisions/ADR-008-interrupt.md)） | 全部排队 |
| D11 | 模型路由 | flash 默认、复杂任务升 pro、图片 M1（[ADR-009](decisions/ADR-009-model-routing.md)） | 固定 pro |
| D12 | 群聊 | 只在触发时参与，短、分条、引用、冷却（[ADR-010](decisions/ADR-010-group-chat.md)） | 每条都回 |
| D13 | 部署 | 一键向导 + 控制台 + 统一失败文案（[ADR-011](decisions/ADR-011-onboarding.md)） | 手改 12 处配置 |
