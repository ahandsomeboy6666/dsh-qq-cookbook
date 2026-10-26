# ADR-001：QQ 协议端选 OneBot v11

## 状态

待确认。推荐值：**OneBot v11 契约，默认实现 NapCat，SnowLuma 作为兼容目标**。

## 背景

桥接需要一个能收发 QQ 消息的协议端。候选：NapCat、SnowLuma、QQ 官方 Bot API、AstrBot。

本机现状：NapCat 已随 `D:\qqaibot` 运行（WebUI 6099、OneBot 反向 WS 6199），且已在工作区根 `AGENTS.md` 登记；SnowLuma 未安装。qq-bridge 的实测路线是 SnowLuma。

## 决策

1. 桥接只依赖 **OneBot v11 标准事件与 API**，不 import 任何协议端 SDK。
2. 默认实现指向本机 **NapCat**（WS 客户端 + HTTP API）。
3. **SnowLuma** 作为第二个适配目标，通过配置切换，不写第二套桥接。
4. 官方 Bot API 与 AstrBot 不进入 M0–M3。

## 理由

- OneBot v11 是事实标准，换协议端只改连接参数，不改业务代码。
- NapCat 在本机已跑，零新增安装；不需要向 QQ 客户端注入原生组件（SnowLuma 需要），合规与可复现性更好。
- 不 import 协议端 SDK 可以避免重蹈 `@snowluma/sdk` 的 ESM 打包 bug 与版本锁定（qq-bridge 需要 postinstall 打补丁）。
- SnowLuma 保留为兼容目标，是因为它的事件覆盖更全（心跳 `status.good`、`bot_status`），适合诊断「连上了但收不到」。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| NapCat 被官方风控/封号 | 只用小号；限制发送频率；不在群里刷屏；文档明示风险 |
| 两个协议端事件字段不一致 | 适配层只依赖 v11 必选字段；可选字段缺省不报错；用回放 fixture 测 |
| NapCat 与现有 AstrBot 抢同一个 QQ 账号 | 桥接用独立小号；不接管 `D:\qqaibot` 的账号与端口 |
| 协议端升级破坏事件形状 | 探针记录协议端版本与 `get_version_info` 输出，进版本台账 |

## 验证

- [tasks/01-probe-dsh.md](../../tasks/01-probe-dsh.md)：探针输出 `onebot.version` 与 `onebot.selfId`。
- [tasks/03-qq-channel.md](../../tasks/03-qq-channel.md)：`node checks/probe-onebot.mjs` 能收到 `message/private` 与 `message/group` 两类事件。
- 回放测试：`npm test` 里用两份 fixture（NapCat / SnowLuma 各一份）跑同一套解析断言。
