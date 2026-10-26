# 任务 07：首条早发与长回复分条

## 目标

短问答首条 ≤3s，长回复自动分条，间隔像真人。

## 输入

- 任务 02 的回环与事件流
- [ADR-007](../docs/decisions/ADR-007-streaming.md) 已接受
- [UX 规格](../docs/07-ux-spec.md) 的场景 S1/S2
- 探针确认：`/api` 是否能拿到 assistant 文本增量（❓）

## 输出

- 新增 `src/outbound/timeline.mjs`（回执、进度、首段、补发的时间线）
- 新增 `src/outbound/split.mjs`（按段落 → 句号 → 逗号切分）
- 新增 `tests/ux-split.test.mjs`
- 新增 `npm run test:ux-latency`、`npm run test:ux-split`

## 验收

- [ ] `npm run test:ux-latency` → P50 ≤3s，P95 ≤8s
- [ ] `npm run test:ux-latency -- task` → 首个可见反馈 ≤2s
- [ ] `npm run test:ux-split` → 1000 字回复切 2–4 条，间隔 400–900ms，顺序正确
- [ ] `npm test` → 全绿

## 人工验收

- 私聊问一个长问题，观察：是否有「在弄了」、首条是否几秒内到、后续条是否有节奏感。
- 群里发一条 500 字的回复请求，确认不会一口气砸出来。

## 不做什么

- 不做逐字流式（QQ 不能编辑）。
- 不做群聊进度消息（只在私聊开）。
- 不改模型或 prompt（那是 09）。
