# 任务 06：人格两层与热生效

## 目标

人格分两层，换角色卡后下一条消息生效，不改代码不重启。

## 输入

- 任务 04 的会话注入点
- [ADR-005](../docs/decisions/ADR-005-persona-layers.md) 已接受
- 现有 DSH preset 的 persona 段（只读，不改）

## 输出

- 新增 `src/persona/load.mjs`（解析角色卡、按场景筛小节）
- 新增 `src/persona/inject.mjs`（拼装顺序、截断、过滤工具指令）
- 新增 `roles/README.md`（角色卡规范：只写人设）
- 新增 `checks/check-persona.mjs`、`npm run test:persona-hot`
- 新增 `tests/persona.test.mjs`

## 验收

- [ ] `node checks/check-persona.mjs` → 长度 ≤ 上限、不含工具名、注入成功 3 项通过
- [ ] `npm run test:persona-hot` → 修改角色卡后回复带新名字
- [ ] `npm test -- persona` → 解析/截断/场景筛选/工具指令过滤 4 条通过
- [ ] `npm test` → 全绿

## 人工验收

- 改 `roles/测试.md` 的名字与语气，在 QQ 里发一句，观察变化且无需重启桥接。
- 在角色卡里写一行 `用 qq_send_message 发送`，观察被过滤并在日志提示。

## 不做什么

- 不改 preset 的行为协议与安全不变量。
- 不做多人格切换 UI、不做群内 `/role` 命令（M3 再评估）。
- 不把角色卡存进 `state/`（它是仓库资产，不是运行时状态）。
