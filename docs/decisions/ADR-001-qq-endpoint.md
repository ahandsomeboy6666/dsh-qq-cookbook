# ADR-001：QQ 协议端双路线

## 状态

已接受（2026-10-27）。最终：**cheems135/dsh-qq-bridge（NapCat）为默认，QQ 官方 Bot 为备选**。见 [当前方案](../10-current-plan.md)。

## 背景

调研了 6 个已有实现（见 [prior art](../references/prior-art.md)），生态明确分成两条路线：

- **NapCat / OneBot 11**：`cheems135/dsh-qq-bridge`、`sj244/dsh-qq-bridge`、`Derpyu520/qq-bridge`（SnowLuma，同属 OneBot）。
- **QQ 官方 Bot**：`988hj7tczd-oss/dsh-im-qq`、`banana770/dsh-qq-bridge`。

原结论「只选 NapCat」只覆盖了第一条。两条路线各有成熟实现，且能力不同：

| 能力 | NapCat | 官方 Bot |
|---|---|---|
| 审批 | 文字回复 | **原生内联按钮** |
| 群聊触发 | 自定义（@/关键词/概率） | 只能 @ |
| 主动消息 | 无限制 | 4 条/月/人/群 |
| 门槛 | 扫码登录 | 认证 + 公域 + 测试人员 |
| 封号风险 | 有 | 无（合规） |

## 决策

1. 定义 `Transport` 接口（收事件、发消息、发按钮），上层只依赖它。
2. **默认实现：cheems135/dsh-qq-bridge（NapCat 插件）**。理由：聊天体感最好（`|||` 分条 0.6–2.8s、情绪、记忆、主动），私聊陪伴评分 5，用户拍板（见 [当前方案](../10-current-plan.md)）。
3. **官方 Bot 作为备选**：合规、按钮审批、扫码零配置；适合「支付确认要按钮 / 对外稳定」的场景。
4. 两条路线共享 `guard / mapping / persona / outbound`，禁止在业务层写 `if (napcat)`。
5. 官方 Bot 的配额与被动窗口写进 `outbound` 的发送预算；NapCat 的发送频率写进限流。

## 理由

- 两条路线都有真实用户与成熟代码，单选一条会丢掉另一条的体验优势（尤其是按钮审批）。
- `Transport` 抽象的成本可控（两个实现，各 ~500 行），而收益是「同一套体验跑两种账号」。
- 默认 cheems 是因为用户偏好「私聊陪伴 + 群聊好玩」，而它的分条/情绪/记忆/主动最贴合；代价是 NapCat 封号风险（小号隔离）。
- 官方 Bot 作为备选：支付确认要按钮、或需要合规对外时切换。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| NapCat 封号 | 小号、频率限制、文档明示、不自动加好友/改资料 |
| 官方 Bot 审核失败/配额 | 沙箱先用；主动消息全部走被动窗口；配额计入发送预算 |
| 两套 transport 维护成本 | 接口窄（4 个方法）；契约测试同一套用例跑两个实现 |
| 事件字段差异 | 只依赖必选字段；差异在 transport 内归一化，不进业务层 |

## 验证

- 契约测试：`npm run test:transport-contract` → 两个实现跑同一套 12 条用例。
- NapCat：[tasks/03-qq-channel.md](../../tasks/03-qq-channel.md) 的 `node checks/probe-onebot.mjs`。
- 官方 Bot：`node checks/probe-official.mjs` → 沙箱内收到一条 `C2C_MESSAGE_CREATE`。
- 审批差异：[tasks/05-security-baseline.md](../../tasks/05-security-baseline.md) 的文字审批 + [tasks/09](../../tasks/09-multimodal.md) 之后的按钮审批。
