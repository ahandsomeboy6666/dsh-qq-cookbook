# DSH 接入面能力矩阵

> 用途：选型的证据表。**每条都标版本与出处**；本机未复验的标 🟡。
>
> 基线：本机 `dsh 0.2.0-rc.2`；能力细节读自工作区源码 `deepseek-harness`（`0.1.7-rc.2`）。两者可能有差异，差异由 [探针任务](../../tasks/01-probe-dsh.md) 收敛。

## 一、本机实测（2026-10-26）

| 事实 | 命令 | 输出 |
|---|---|---|
| DSH 版本（CLI） | `dsh --version` | `0.2.0-rc.2` |
| DSH 版本（桌面端） | 读 `runtime.json` | `0.2.1-rc.3`（内置 Node 24.21，2026-10-26 升级） |
| Node 版本（系统） | `node --version` | `v22.22.0` |
| 可用 profile | `ls ~/.dsh/profiles` | `web`、`desktop`（**没有** `acp`/`sdk`/`headless`） |
| DSH 家目录 | `ls ~/.dsh` | 含 `.credentials.yaml`、`profiles/`、`sessions/`、`skills/` 等 |
| CLI 能力 | `dsh --help` | `dsh [--profile] <name>`；`--dump-config`；`dsh headless "task"` 为示例 |

**推论**：本机默认只有 Web/桌面 profile；ACP/SDK 需要显式初始化 profile 才能用（`--from-default-profile`），属于 ❓ 待验证。

## 二、五条接入面

### 2.1 Web `/api` Remote

| 能力 | 支持 | 说明 | 出处 |
|---|---|---|---|
| 一元 RPC | ✅ | `POST /api/<namespace>/<method>`，payload `{ args }` | `docs/api-gateway.zh.md`（0.1.7-rc.2） |
| 流式事件 | ✅ | `/api/remote.mux` WS；`session/follow` | 同上；qq-bridge README |
| 鉴权 | Cookie | 用 `~/.dsh/.credentials.yaml` 的 `client-connection/browser-session` 离线铸造 | 🟡 qq-bridge DSH_SETUP FAQ |
| 会话投递 | ✅ | `agent.followup` 类 RPC（qq-bridge 实测） | 🟡 qq-bridge |
| 交互（提问/审批） | ✅ | qq-bridge 转发 `ask_user_question` 与工具审批 | 🟡 qq-bridge README |
| 版本稳定性 | **低** | 随 Web BFF 演进；已知 0.1.7/0.2.0/0.2.1 三处破坏性变化 | 🟡 qq-bridge README |

### 2.2 ACP profile

| 能力 | 支持 | 说明 | 出处 |
|---|---|---|---|
| 启动 | `dsh --profile acp` | stdio JSON-RPC | `packages/acp/acp/README.zh.md` |
| 建会话 | `session/new` | 校验工作区与 MCP | 同上 |
| 列/恢复/关闭 | `session/list` / `resume` / `close` | 持久化跨进程 | 同上 |
| 投提示词 | `session/prompt` | 每会话一次一个 | 同上 |
| 取消 | `session/cancel` | 无进行中提示词时取消自主工作 | 同上 |
| 事件 | `session/update` | 提交的 assistant 消息、thought、工具生命周期、上下文用量 | 同上 |
| 权限提示 | `session/request_permission` | 一次性允许/拒绝 | 同上 |
| 提问（elicitation） | ❌ | 明确不支持 | 同上 |
| 其他缺失 | — | `session/load`、fork、delete、transcript 回放、附加目录、SSE | 同上 |

### 2.3 SDK profile

| 能力 | 支持 | 说明 | 出处 |
|---|---|---|---|
| 启动 | `dsh --profile sdk` | 由 client spawn 子进程 | `packages/sdk/client/README.zh.md` |
| 打开会话 | `session(id?)` | 具名或新建 | 同上 |
| 投提示词 | `prompt()` / `run()` | `run` 等到 idle 取 `finalResponse` | 同上 |
| 通知 | `subscribe()` | 会话事件、agent 状态、subagent 完成 | 同上 |
| 审批转发 | ❌ | 「客户端→服务端通知与服务端→客户端请求在协议两端都未实现」 | 同上 |
| 轮次中取消 | ❌ | 协议层无取消方法 | 同上 |
| 语言 | TS / Python | 同一协议 | `packages/sdk/README.zh.md` |

### 2.4 webhook

| 能力 | 支持 | 说明 | 出处 |
|---|---|---|---|
| 注册规则 | `ctx.webhookRuntime.register(rule)` | 进程内 | `packages/webhook/webhook/README.zh.md` |
| 动作 | 新建 Workspace 根会话 + 投 prompt | 唯一内置动作 | 同上 |
| 完成结果 | ❌ | 不报告成功/idle/输出 | 同上 |
| 重试/去重/队列 | ❌ | fire-and-forget | 同上 |
| 投递到已有会话 | ❌ | 只能新建 | 同上 |

### 2.5 进程内插件

| 能力 | 支持 | 说明 | 出处 |
|---|---|---|---|
| 工具注册 | `ctx.tools.register` | 可注册 MCP 来源工具 | `docs/cookbook/extension-cookbook.zh.md` |
| 钩子 | `tools/pre-execute`、`tools/execute`、`tools/post-execute`、`tools/result` | 权限门禁示例 | 同上 |
| UI 事件 | `session/event`、`agent/assistant-stream` | 可直接驱动 `followup`/`steer` | 同上 |
| 协议驱动 | `ctx.agents` + followup | ACP 包即此模式 | 同上 |
| 部署 | 随 DSH host 加载 | 崩溃互相影响 | — |

## 三、能力 × 需求矩阵

| 需求 | Web | ACP | SDK | webhook | 插件 |
|---|---|---|---|---|---|
| 投递到已有会话 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 拿最终回复 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 转发提问 | ✅ | ❌ | ❌ | ❌ | ✅ |
| 转发审批 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 会话持久化恢复 | ✅ | ✅ | ✅ | — | ✅ |
| 故障隔离 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 协议稳定性 | 低 | 高 | 高 | 中 | 中 |

## 四、复核计划

本表在以下时机必须重跑：

1. DSH 升级（任何 `0.x` 变化）。
2. 新增通道实现前。
3. 发现「静默失效」时。

复核方式：[tasks/01-probe-dsh.md](../../tasks/01-probe-dsh.md) 的探针 + 必要时手工调用 `dsh --profile acp --dump-config`。
