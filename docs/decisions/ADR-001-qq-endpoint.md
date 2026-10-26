# ADR-001：QQ 协议端双路线

## 状态

待确认。推荐值：**NapCat（OneBot 11）默认，QQ 官方 Bot 作为第二路线；两者共享上层，只换 transport**。

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
2. **默认实现 NapCat**：本机已有、零审核、多模态自由，适合个人自用。
3. **第二实现官方 Bot**：M4 评估，优先服务「需要按钮审批 / 对外稳定」的场景。
4. 两条路线共享 `guard / mapping / persona / outbound`，禁止在业务层写 `if (napcat)`。
5. 官方 Bot 的配额与被动窗口写进 `outbound` 的发送预算，不散落在业务代码。

## 理由

- 两条路线都有真实用户与成熟代码，单选一条会丢掉另一条的体验优势（尤其是按钮审批）。
- `Transport` 抽象的成本可控（两个实现，各 ~500 行），而收益是「同一套体验跑两种账号」。
- 默认 NapCat 是因为它无审核门槛、本机已在跑；官方 Bot 作为合规升级路径，不阻塞 M0。

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
