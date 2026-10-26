# 任务 03：OneBot 通道接入

## 目标

把 OneBot v11 事件稳定收进来并归一化，不依赖 DSH。

## 输入

- 协议端 WS 地址与 token（NapCat 或 SnowLuma）
- [ADR-001](../docs/decisions/ADR-001-qq-endpoint.md) 已接受
- 两份脱敏事件样本（私聊、群聊）作为 fixture 的起点

## 输出

- 新增 `src/onebot/client.mjs`（WS 连接、心跳、重连、token 处理）
- 新增 `src/onebot/normalize.mjs`（事件 → `InboundMessage`）
- 新增 `tests/fixtures/*.json` 与 `tests/onebot.test.mjs`
- 新增 `checks/probe-onebot.mjs`

## 验收

- [ ] `node checks/probe-onebot.mjs` → 打印 `selfId`，且私聊、群聊两类事件计数各 ≥1
- [ ] `npm test -- onebot` → 归一化断言全过（文本、@、引用、空消息、非文本）
- [ ] `npm test` → 全绿

## 人工验收

- 在群里 @ 机器人发一条，桥接日志出现 `message/group` 且 `mentioned=true`。
- 私聊发一条，日志出现 `message/private`。
- 拔网线 30 秒再插回，日志出现「重连成功」。

## 不做什么

- 不接 DSH、不建会话（那是 02）。
- 不做媒体下载、不做发送动作。
- 不为 SnowLuma 写第二套解析：只依赖 OneBot v11 必选字段。
