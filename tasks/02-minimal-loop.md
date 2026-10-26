# 任务 02：最小收发回环

## 目标

QQ 私聊发「ping」，30 秒内收到 agent 回复「pong」。

## 输入

- 任务 01 的探针输出（版本、profile、鉴权、协议端）
- DSH Web 在跑，且有一个可用模型
- 协议端在线，白名单只填自己的 QQ 号
- [ADR-002](../docs/decisions/ADR-002-dsh-access.md) 已接受

## 输出

- 新增 `src/main.mjs`（启动、装配、单实例锁）
- 新增 `src/transport/onebot.mjs`（连接、事件、发送）
- 新增 `src/dsh/plugin-adapter/`（插件侧：免认证本地路由、preset 挂载、事件与交互回调）
- 新增 `src/dsh/web-adapter.mjs`（standalone 兼容路径，M2 才启用）
- 新增 `tests/e2e.test.mjs` 与 `npm run test:e2e`
- `package.json` 增加 `start`、`test`、`test:e2e`

## 验收

- [ ] `npm test` → `pass` 且 `fail 0`
- [ ] `node checks/probe-dsh.mjs --json` → `onebot.connected` 为 `true`
- [ ] `npm run test:e2e` → 输出含 `reply:` 且非空，退出码 0
- [ ] `node checks/check-assets.mjs` → 全绿

## 人工验收

- 手机 QQ 私聊机器人发「ping」，30 秒内看到回复。
- 同时在 DSH Web 的会话里能看到这条用户消息。

## 不做什么

- 不做白名单细化（只支持单号）、不做人格、不做媒体、不做审批。
- 不做流式逐字转发，按轮次整段发。
- 不改 `D:\qqaibot` 的任何账号与端口。
