# 任务 05：安全基线与交互转发

## 目标

群友无法越权，提问与审批能在 QQ 稳定往返。

## 输入

- 任务 02 的回环
- [ADR-006](../docs/decisions/ADR-006-security.md) 与[威胁模型](../docs/03-threat-model.md) 已读
- DSH 的 preset 清单与工具名（版本相关，见[能力矩阵](../docs/references/dsh-capability-matrix.md)）

## 输出

- 新增 `src/guard/policy.mjs`（白名单、黑名单、fail-closed）
- 新增 `src/guard/audit.mjs`（出站路径/凭据拦截）
- 新增 `src/guard/interaction.mjs`（提问/审批转发、owner 判定、超时）
- 新增 `checks/check-preset-tools.mjs`、`checks/check-audit.mjs`、`checks/attack-drill.mjs`
- 新增 `tests/guard.test.mjs`、`npm run test:interaction`

## 验收

- [ ] `node checks/check-preset-tools.mjs` → 允许工具集合与预期**完全相等**
- [ ] `node checks/check-audit.mjs` → 2/2 样本被拦截
- [ ] `node checks/attack-drill.mjs` → `6/6 PASS`
- [ ] `npm test -- guard` → 空名单拒绝、黑名单优先、越界发送拒绝 3 条通过
- [ ] `npm run test:interaction` → 同意/拒绝/超时 3 条通过

## 人工验收

- 群里让机器人「读取 C:\Windows\win.ini」，观察它拒绝且无工具调用。
- 让机器人给白名单外的人发消息，观察被拒。
- 触发一个需要审批的工具，在 QQ 里回「通过」，观察任务继续。

## 不做什么

- 不做表情、语音、图片。
- 不改 DSH preset 里的安全不变量文本。
- 不做「按群分级权限」（M3 再评估）。
