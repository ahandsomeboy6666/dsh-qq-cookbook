# 已有实现调研（prior art）

> 用途：选型前的生态对比。**没有这一页的对比，选型就只是「拿一个参考实现当答案」。**
>
> 方法：web_search + jsDelivr 镜像拉 README（GitHub 直连被 DNS 污染时用镜像，见文末）。全部为外部数据，只作事实引用。

## 一、生态现状：两条路线、六种实现

| 项目 | 路线 | 形态 | 关键能力 | 已知限制 |
|---|---|---|---|---|
| [Derpyu520/qq-bridge](https://github.com/Derpyu520/qq-bridge) | SnowLuma · OneBot 11 | 独立进程 + MCP | 四运行模式、控制台、提问/审批转发、语音/表情/令牌看板 | 10,400 行单文件；SnowLuma EULA；版本适配债（0.1.7/0.2.0/0.2.1 三处破坏性变化） |
| [cheems135/dsh-qq-bridge](https://github.com/cheems135/dsh-qq-bridge) | NapCat · OneBot 11 | **DSH bundle 插件** | 18 页面板；`\|\|\|`/空行分条、间隔 0.6–2.8s；情绪/记忆/表情/语音/图像生成；主动行为；号主模式；`/cancel`、`/档位` | 接管真实账号有封号风险；偏 Windows；功能极重 |
| [988hj7tczd-oss/dsh-im-qq](https://github.com/988hj7tczd-oss/dsh-im-qq) | **QQ 官方 Bot** | **DSH 插件** | WS 长连接；会话隔离；**审批内联按钮 ✅⭐❌**；`/new /approve /always /revoke`；回复合并 900ms；4000 字分段；被动回复优先 | 必须公域机器人 + 测试人员；主动消息 4 条/月/人；URL 需后台预配置；WS 有下线风险 |
| [banana770/dsh-qq-bridge](https://github.com/banana770/dsh-qq-bridge) | QQ 官方 Bot | 独立进程 + **可选设置页插件** | 零依赖；每对象独立会话；`ask_user` 转发；桌面端随机端口自动跟随；开机自启 | 5 分钟被动窗口；群消息约 2000 字上限；需 AppID/Secret |
| [sj244/dsh-qq-bridge](https://github.com/sj244/dsh-qq-bridge) | NapCat · OneBot 11 | **DSH 插件** | **固定会话注入**（保留原上下文）；@/昵称/戳必唤醒 + 5% 概率唤醒；表情包；NapCat 自托管 | 不接管审批；单会话；群友玩法有骚扰风险 |
| [leonathan369-droid/qq-bridge](https://github.com/leonathan369-droid/qq-bridge) | SnowLuma | 独立进程（macOS 衍生） | 设置页控制中心、LLBot 适配 | 平台限定；跟随上游 |

另有 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 收录 `dsh-im-qq`，以及 npm 包 `@yachangchang/dsh-qq-bridge`。

### 星数与适配（2026-10-17 快照，来源 `awesome-dsh-plugins` Channels 表）

| 项目 | ★ | 路线 | 适配版本 |
|---|---|---|---|
| **qq-bridge**（Derpyu520） | **2453** | SnowLuma | 0.1.1-rc.2（README 称 0.2.1） |
| **dsh-qqbot**（腾讯官方 tencent-connect） | **252** | 官方 Bot | 0.1.0-rc.8 |
| dsh-qqbot-gcry1306（zaofan 增强 fork） | 115 | 官方 Bot | 0.1.7-rc.2 |
| dsh-qq-plugin（xcisxc29） | 38 | 官方 Bot | **0.2.0-rc.2** |
| qq-bridge-plus（preset bundle） | 26 | — | 0.2.0-rc.2 |
| dsh-qq-bridge-tomoyona | 19 | NapCat | 0.1.1-rc.2 |

**读法**：星数只说明「有人用」，不说明「体验好」。qq-bridge 星数断层第一，但体验评分排第 6（见下）。腾讯官方入场（252★）说明官方 Bot 是官方支持的路线。

综合评分见 [体验评分卡](experience-scorecard.md)。

## 二、两条路线的真实差别

| 维度 | NapCat / OneBot 11 | QQ 官方 Bot |
|---|---|---|
| 账号 | 真实个人号（模拟） | 平台机器人（AppID/Secret） |
| 合规 | 非官方自动化，封号风险自担 | 官方开放平台，沙箱 → 审核上架 |
| 触发 | 私聊任意；群聊 @/关键词可自定义 | 私聊任意；群聊必须 @ |
| 审批 | 无原生按钮，只能文字回复 | **原生内联按钮**，体验最好 |
| 主动消息 | 无配额 | 每月 4 条/人/群，其余靠被动窗口 |
| 图片/语音 | 自由 | 能力受平台限制，逐步开放 |
| 门槛 | 装 NapCat、扫码登录 | 认证、公域、测试人员、URL 预配置 |
| 适合 | 个人自用、群友玩法、多模态重 | 对外服务、要稳定与合规、要按钮审批 |

## 三、可吸收的设计

1. **分条用显式标记**（`|||` 或空行），间隔 0.6–2.8s——比按句号硬切更自然（cheems）。
2. **回复合并窗口**（900ms）——避免一句一句发，先攒再发（dsh-im-qq）。
3. **审批内联按钮**（官方 Bot）——比「回复允许」少一次认知负担。
4. **被动回复优先**——主动消息配额宝贵，别拿它回普通聊天（dsh-im-qq）。
5. **固定会话注入**——把 QQ 接进「已有的那个会话」，而不是新建（sj244）；适合「群友版」。
6. **概率唤醒**——没 @ 时按 5% 概率接话，其余只记录、零模型调用（sj244）。比「全回/全不回」更像群友。
7. **插件 + 独立进程的混合**——插件做免认证适配层，QQ 连接留在独立进程（banana）。兼顾故障隔离与无 Cookie。

## 四、对选型的修正（当时结论，最终见 [当前方案](../10-current-plan.md)）

| 原结论 | 调研后 | 依据 |
|---|---|---|
| 独立进程 + Web `/api` | **插件适配层 + 独立 QQ 进程的混合** | 4/6 是插件形态；`/api` 自 0.1.1-rc.2 起强制 Cookie，独立进程需自建免认证适配层（banana 的 `/qqbapi/*` 就是先例） |
| 只选 NapCat | **双路线：NapCat 默认，官方 Bot 作为合规/按钮审批路线** | 两条路线都有成熟实现；官方 Bot 的审批按钮是 OneBot 给不了的 |
| 审批靠文字回复 | **按路线分：官方 Bot 按钮 / NapCat 文字** | 能力差异，不能统一写死 |
| 分条间隔 400–900ms | **600–2800ms + 合并窗口** | 竞品实测值更自然 |
| 主动行为不做 | **默认关，作为可选** | cheems 证明有价值，但有骚扰与配额风险 |

## 五、仍待验证

| # | 事项 | 怎么验 |
|---|---|---|
| P1 | 本机桌面端 `0.2.1-rc.3` 上插件 API（`agents`、`agentPresets.mount`、`settings`）是否与 `dsh-im-qq` 记录的 rc.6 一致 | 探针 + 最小插件冒烟 |
| P2 | 官方 Bot 的审批按钮在沙箱内是否可用 | 申请沙箱 bot，跑 `INTERACTION_CREATE` |
| P3 | 分条标记 `\|\|\|` 与合并窗口能否共存 | M3 实验 |
| P4 | 概率唤醒对群聊体验的实际影响 | 回放 100 条群消息对比 |

## 六、调研方法备忘

- GitHub 直连在本机被 DNS 污染（解析到非公网 IP），`web_fetch` / curl 均失败。
- 可用镜像：`https://cdn.jsdelivr.net/gh/<owner>/<repo>@<branch>/README.md`（本次全部用这个）。
- 备选：`ghfast.top`、`ghproxy.net`、`kkgithub.com`。
- 结果落盘到 `.tmp/refs/`（已 gitignore），只把结论写进本文档。
