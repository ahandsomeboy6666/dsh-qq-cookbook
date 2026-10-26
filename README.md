# dsh-qq-cookbook

把 **DeepSeek Harness（DSH）接入 QQ** 的配方书：选哪条路、怎么验收、哪些坑已经有人踩过。

**唯一标准：在 QQ 里用起来像个人。** 不是「功能接通」，是「发一句，几秒内有回应、能打断、群里不刷屏、出错说人话」。指标见 [UX 规格](docs/07-ux-spec.md)。

> 当前阶段：**决策与资产沉淀**。不含可运行桥接代码；代码从 [M0 任务卡](tasks/02-minimal-loop.md) 开始按里程碑长出来。
>
> 本仓库与 [qq-bridge](../qq-bridge/)（上一轮 agent 产出的参考实现）**无代码关系**，只引用其已验证结论作为事实基线。

## 一分钟选型

| 你的目标 | 选这条路 | 一句话理由 |
|---|---|---|
| 日常聊天、要转发提问/审批 | **Web profile + `/api` RPC**（推荐默认） | 唯一能同时拿到「投消息 + assistant 事件 + 交互事件」的通道 |
| 无人值守自动化、脚本驱动 | **ACP profile**（JSON-RPC stdio） | 官方自动化面，有 `session/resume` 与权限应答，但**没有**提问转发 |
| 嵌入自己的 TS/Python 程序 | **SDK profile**（`@deepseek-ai/dsh-sdk`） | 能用 `session(id)` 打开已有会话、收通知，但**没有**审批请求通道 |
| 外部事件触发一次性任务 | **webhook** | 只创建新会话、fire-and-forget，不适合双向聊天 |
| 想少一个进程 | **进程内插件** | 与 DSH 同生共死，QQ 崩了会拖垮 host，不推荐 MVP |

详细对比与证据见 [docs/01-tech-selection.md](docs/01-tech-selection.md)。

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

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 环境探针 + 最小收发回环 | 📋 未开始 |
| M1 | 白名单、preset 裁剪、审批转发、重连 | 📋 未开始 |
| M2 | 会话映射持久化、人格分层、重置/斜杠命令 | 📋 未开始 |
| M3 | 首条早发、分条、打断、群聊拟人、模型路由 | 📋 未开始 |
| M4 | 图片入站、语音/表情、部署向导、控制台 | 📋 未开始 |
