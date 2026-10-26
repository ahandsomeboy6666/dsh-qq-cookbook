# dsh-qq-cookbook

把 **DeepSeek Harness（DSH）接入 QQ** 的配方书：选哪条路、怎么验收、哪些坑已经有人踩过。

**唯一标准：在 QQ 里用起来像个人。** 不是「功能接通」，是「发一句，几秒内有回应、能打断、群里不刷屏、出错说人话」。指标见 [UX 规格](docs/07-ux-spec.md)。

> 当前阶段：**决策与资产沉淀**。不含可运行桥接代码；代码从 [M0 任务卡](tasks/02-minimal-loop.md) 开始按里程碑长出来。
>
> 本仓库与 [qq-bridge](../qq-bridge/)（上一轮 agent 产出的参考实现）**无代码关系**，只引用其已验证结论作为事实基线。

## 一分钟选型

| 你的目标 | 选这条路 | 一句话理由 |
|---|---|---|
| **当前方案：私聊陪伴 + 群聊好玩 + 能办事** | **cheems135/dsh-qq-bridge 插件 + NapCat** | 分条 0.6–2.8s、情绪、记忆、主动；小号隔离 |
| 要合规、按钮审批、扫码零配置 | 腾讯官方 / xcisxc29（官方 Bot） | 无封号；审批是内联按钮 |
| 群聊最强（审批放行/禁言/表情包） | zaofan/dsh-qqbot（官方 Bot） | 群管与主动开口 |
| 已有 qq-bridge、想换 NapCat | qq-bridge + NapCat 魔改 | 保留全部功能，6–9 人日 |

**当前方案见 [docs/10-current-plan.md](docs/10-current-plan.md)**；体验评分见 [评分卡](docs/references/experience-scorecard.md)。

## 30 分钟最小回环（M0）

目标：QQ 里发一条消息，DSH agent 回一条。

```powershell
# 1. 环境探针（不启动任何服务）
node checks/probe-dsh.mjs --json

# 2. 资产检查（文档与任务卡是否齐）
node checks/check-assets.mjs

# 3. 起协议端：NapCat（已在本机跑，WebUI 6099）或 SnowLuma
#    确认 OneBot v11 的 WS 与 HTTP 端口

# 4. 起桥接（M0 代码产出后）
npm start
```

前置条件、失败排查、每步期望输出见 [docs/04-acceptance.md](docs/04-acceptance.md)。

## 目录

```
docs/            提案、选型、架构、安全、UX 规格、验收、路线、方法论
docs/decisions/  ADR（每个技术决策一篇，含风险与验证方式）
docs/references/ 外部事实基线（版本、出处、可复用度）
docs/templates/  可复制到其他项目的模板
tasks/           任务卡：五段 + 可执行验收
checks/          检查脚本（资产检查、环境探针）
```

文档索引：[docs/README.md](docs/README.md)。

## 版本基线

| 组件 | 版本 | 来源 |
|---|---|---|
| 本机 DSH | `0.2.0-rc.2` | 实测 `dsh --version`（2026-10-26） |
| DSH 源码（工作区内） | `0.1.7-rc.2` | `deepseek-harness/package.json` |
| 本机 profile | `web` / `desktop` | `~/.dsh/profiles` |
| 参考实现 | qq-bridge `v0.2.1-r1` | 其 README 声明适配 `0.2.1-rc.2` |

**版本是结论的一部分。** 任何「DSH 支持 X」的说法都必须带上版本，见 [AGENTS.md](AGENTS.md) 第三节。

## 安全默认

QQ 群消息是**不可信输入**。默认配置遵循 fail-closed：

- 白名单为空 = 不响应任何人（不是放行所有人）。
- QQ 会话的 preset 不挂载 bash / 文件读写 / 子代理。
- 发送工具的目标必须命中白名单，桥接侧再校验一次。
- 审批超时默认拒绝。

红线与对策见 [docs/03-threat-model.md](docs/03-threat-model.md)。

## 状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| D0 | 环境就绪：NapCat 扫码、DSH 版本、插件未装清单 | 📋 待做 |
| D1 | 装 cheems，私聊/群聊打通 | 📋 待做 |
| D2 | 私聊/群聊两套人设 | 📋 待做 |
| D3 | 浏览器能力 + 30 元零花钱授权 | 📋 待做 |
