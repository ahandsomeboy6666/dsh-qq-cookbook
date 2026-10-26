# ADR-002：DSH 接入默认走 Web `/api`

## 状态

待确认。推荐值：**Web `/api` 为默认通道；ACP、SDK 作为 `DshAdapter` 的第二实现，M2 之后按场景启用**。

## 背景

DSH `0.2.0-rc.2`（本机）提供五种外部接入面：Web `/api` Remote、ACP profile、SDK profile、webhook、进程内插件。QQ 聊天需要同时满足：投递消息、拿回复、转发提问与审批、复用会话、限制工具面。

关键差异在「交互」：Web 有 `ask_user_question` 与工具审批事件；ACP 只有权限提示（无提问）；SDK 协议两端都没有服务端→客户端请求；webhook 与插件不适用。

## 决策

1. 主通道用 **Web profile 的 `/api`**：`POST /api/<namespace>/<method>` 做一元调用，`/api/remote.mux` + `session/follow` 拿事件流。
2. 协议细节全部收敛在 `dsh/web-adapter` 单模块，业务代码只依赖 `DshAdapter` 接口。
3. 不在 M0–M1 实现 ACP/SDK；M2 只定义接口，M3 按「无人值守任务」场景接 ACP。
4. 鉴权用 `~/.dsh/.credentials.yaml` 里的持久签名密钥**离线铸造 Cookie**，不读进程日志里的 token（`0.1.7` 起 token 只存在内存，读到的是陈旧值）。

## 理由

- 只有 Web 通道能覆盖 C1–C5（见 [技术选型 3.1](../01-tech-selection.md#31-能力对照)），而 QQ 场景里「agent 反问一句」是常态，断链代价高。
- qq-bridge 已在 `0.2.1-rc.2` 上逐项实测这条路，踩过的坑有记录（见 [qq-bridge 基线](../references/qq-bridge-baseline.md)），复用成本最低。
- 把版本敏感面集中到一个模块，升级 DSH 时只改一处；这是「版本敏感」不等于「不能选」的关键设计。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| DSH 升级改协议，静默失效 | 适配层单点 + 探针 + 每个里程碑的验收矩阵；升级先跑 `npm run verify:adaptation` |
| Cookie 铸造依赖 `~/.dsh` 结构 | 探针检测 `.credentials.yaml` 是否存在 `client-connection/browser-session`；缺失时回退到显式 token 并明确报错 |
| `/api` 是 Web BFF，非稳定公开 API | 文档明确「非稳定」；适配层保留版本分支；M3 评估迁移 ACP |
| ACP/SDK 不支持审批，切换场景时行为不一致 | 在 `DshAdapter` 上标注能力位（`supportsInteraction`），业务层按能力降级并提示 |

## 验证

- 探针：`node checks/probe-dsh.mjs --json` 输出 `webApi.reachable=true`、`auth.cookieMinted=true`。
- 端到端：[tasks/02-minimal-loop.md](../../tasks/02-minimal-loop.md) 的 `npm run test:e2e` 断言「投递 → 回复」。
- 交互：[tasks/05-security-baseline.md](../../tasks/05-security-baseline.md) 的审批往返用例（同意/拒绝/超时三条）。
