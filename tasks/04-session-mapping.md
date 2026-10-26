# 任务 04：会话映射持久化

## 目标

1 个 QQ 会话映射 1 个 DSH 会话并持久化，重启不串台。

## 输入

- 任务 02 的会话创建路径
- [ADR-004](../docs/decisions/ADR-004-session-mapping.md) 已接受
- `state/` 目录约定（见[架构](../docs/02-architecture.md#五状态与持久化)）

## 输出

- 新增 `src/mapping/registry.mjs`（建/复用/重置/退役）
- 新增 `src/mapping/store.mjs`（原子写、`.bak`、损坏恢复）
- 新增 `tests/mapping.test.mjs`
- 新增 `npm run test:restart-resume`

## 验收

- [ ] `npm test -- mapping` → 建/复用/重置/退役 4 条全过
- [ ] `npm run test:restart-resume` → 两次运行输出同一 `dshSessionId`
- [ ] `node -e "const s=require('./state/sessions.json');console.log(Object.keys(s).length>0)"` → `true`
- [ ] `npm test` → 全绿

## 人工验收

- 重启桥接进程，在同一个 QQ 会话里继续说话，agent 能接上上文。
- 手动删除 `state/sessions.json` 后重启，桥接不崩，自动重建映射。

## 不做什么

- 不做人格注入（那是 06）。
- 不做多账号隔离、不做跨机器同步。
- 不改 `state/` 已有字段的语义，只加字段。
