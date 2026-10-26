# 任务 08：打断、补充与并发

## 目标

忙时消息分三路：停 ≤2s、补充生效、其余排队。

## 输入

- 任务 02 的回环、任务 05 的 owner 判定
- [ADR-008](../docs/decisions/ADR-008-interrupt.md) 已接受
- 探针确认：Web `/api` 是否有 cancel / steer 能力（❓）

## 输出

- 新增 `src/interrupt/intent.mjs`（停/改/问 规则分类）
- 新增 `src/interrupt/cancel.mjs`（取消信号、残留清理）
- 新增 `tests/interrupt.test.mjs`、`tests/queue.test.mjs`
- 新增 `npm run test:ux-interrupt`、`npm run test:steer`

## 验收

- [ ] `npm run test:ux-interrupt` → 发「停」≤2s 停止，之后无该回合消息
- [ ] `npm run test:steer` → 回合中「用中文」生效（无 steer 时断言排队降级）
- [ ] `npm test -- queue` → 单会话串行、双会话并行不乱序
- [ ] `npm test` → 全绿

## 人工验收

- agent 跑长任务时发「算了」，观察立刻停、回一句「好，停了。」。
- 跑任务时发「用中文说」，观察后续输出变中文且任务没重来。

## 不做什么

- 不做语音打断、不做多 owner 并发。
- 不改 DSH 内部取消机制（只调它暴露的接口）。
- 不做「非 owner 也能停」（只提示，不执行）。
