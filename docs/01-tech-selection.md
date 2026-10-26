# 技术选型

> 状态：**草案**，待确认。逐条决策见 [决策台账](decisions/README.md)，本文只给对比与推荐。
>
> 事实标记：✅ 本机实测 · 🟡 引用已有文档/参考实现 · ❓ 待探针验证

## 一、版本基线

选型结论只在这个基线上成立：

| 组件 | 版本 | 来源 |
|---|---|---|
| 本机 DSH（实际运行） | `0.2.0-rc.2` | ✅ 实测 `dsh --version`（2026-10-26） |
| DSH 源码（工作区内，用于读能力边界） | `0.1.7-rc.2` | ✅ `deepseek-harness/package.json` |
| 本机 profile | `web`、`desktop` | ✅ 实测 `~/.dsh/profiles` 只有这两个 |
| Node | `22.22.0` | ✅ 实测 `node --version` |
| 参考实现 | qq-bridge `v0.2.1-r1` | 🟡 其 README 声明适配 DSH `0.2.1-rc.2` |

**重要差异**：本机是 `0.2.0-rc.2`，源码是 `0.1.7-rc.2`，参考实现适配的是 `0.2.1-rc.2`。三者不能混为一谈；凡涉及协议细节的结论都以 [tasks/01-probe-dsh.md](../tasks/01-probe-dsh.md) 的实测为准。

## 二、接入问题拆解

「DSH 接入 QQ」不是一条通道能全包的，它要同时满足五个能力：

| # | 能力 | 说明 | 缺失后果 |
|---|---|---|---|
| C1 | 入站投递 | 把 QQ 消息作为 user message 送进指定 DSH 会话 | 无法聊天 |
| C2 | 出站回传 | 拿到 agent 的最终回复（或流式增量）发回 QQ | 发了没人回 |
| C3 | 交互转发 | 转发 `ask_user_question` 与工具审批，并把答复回填 | 长任务卡死 |
| C4 | 会话生命周期 | 恢复/重置/退役会话，持久化映射 | 重启后上下文串台 |
| C5 | 工具面控制 | 限定 QQ 会话能用哪些工具 | 群友可触达本地文件 |

不同通道在这五项上的覆盖**并不相同**，这是选型的核心。

## 三、DSH 侧五条接入通道

### 3.1 能力对照

| 通道 | C1 入站 | C2 出站 | C3 交互 | C4 会话 | C5 工具面 | 版本敏感度 | 证据 |
|---|---|---|---|---|---|---|---|
| **A. Web `/api` Remote** | `agent.followup` 类 RPC | `remote.mux` 事件流 | ✅ 提问 + 审批 | ✅ 已有会话可复用 | preset 决定 | **高**（随 Web BFF 演进） | 🟡 qq-bridge 实测；DSH `docs/api-gateway.zh.md` |
| **B. ACP profile** | `session/prompt` | `session/update` | 仅权限（`session/request_permission`），**无提问** | ✅ `session/resume`、`list`、`close` | preset 决定 | 低（标准 ACP v1） | 🟡 DSH `packages/acp/acp/README.zh.md` |
| **C. SDK profile** | `prompt()` | 通知流 `assistant/message` | **无**（协议未实现双向请求） | ✅ `session(id)` 打开具名会话 | preset 决定 | 低（公开 SDK） | 🟡 DSH `packages/sdk/client/README.zh.md` |
| **D. webhook** | 规则回调 | 无 | 无 | ❌ 只创建新会话 | 规则指定 | 中 | 🟡 DSH `packages/webhook/webhook/README.zh.md` |
| **E. 进程内插件** | 直接调 `ctx.agents` | 订阅事件 | ✅ 全都能拿 | ✅ 同进程 | 插件可改 | 中（内部 API） | 🟡 DSH `docs/cookbook/extension-cookbook.zh.md` |

### 3.2 逐条判断

**A. Web `/api`（推荐默认）**

- 唯一同时覆盖 C1–C5 的通道。qq-bridge 已用它跑通「消息投递 → 回复 → 提问 → 审批」全链路。
- 代价：协议属于 Web BFF 面，随 GUI 迭代。已知的坑：`0.1.7` 起进程 token 只存内存（需用 `~/.dsh/.credentials.yaml` 离线铸造 Cookie）；`0.2.0` 的 `settings/update` 是多参数 RPC；`0.2.1` 删了 persona 的 `{{cwd}}` 变量。这些都已由参考实现踩过并记录。
- **结论**：作为默认，但把全部协议细节收敛进一个 `dsh/web-adapter` 模块；升级 DSH 先跑探针与验收矩阵，不直接改业务代码。

**B. ACP profile（推荐作为第二通道）**

- 标准 ACP v1，`pnpm dsh --profile acp` 启动 stdio 服务器；能力：`session/new|list|resume|close|prompt|cancel`、`session/update`、`session/request_permission`。
- **限制**：刻意只提供标准协议，没有 elicitation（`ask_user_question` 无处承载）、没有 DSH 专用卡片、没有 fork/delete/transcript 回放。
- **结论**：适合「agent 自己跑长任务、偶尔要权限」的场景（例如定时巡检、CI 修复），不适合「群聊里问一句答一句」的默认形态。

**C. SDK profile（推荐作为程序化嵌入）**

- `@deepseek-ai/dsh-sdk` 的 TS/Python 客户端，能 `session(id)` 打开已有会话、订阅事件、等到 idle 取 `finalResponse`。
- **限制**：协议两端都没有「服务端向客户端发请求」的通道，所以**审批无法转发**；也没有轮次中取消；客户端只解析同版本 `dsh` 包。
- **结论**：适合「我自己的脚本要驱动 DSH」；不适合作为 QQ 桥接主通道（审批断链）。

**D. webhook（不选为主通道）**

- 只做「事件 → 新建会话 + 投一条 prompt」，fire-and-forget：无队列、无重试、无去重、不报告完成。
- **结论**：适合 GitHub PR 之类「一次性任务」；QQ 聊天需要长期会话，直接排除。可作为 M3 的「通知类事件」补充。

**E. 进程内插件（不选为 MVP）**

- 能力最全，但 QQ 连接、协议端异常、内存泄漏都和 DSH host 同生共死；调试要重启整个 DSH。
- **结论**：定位为「未来的设置卡/控制台增强」，不作为主通道。

### 3.3 通道结论

```
默认：Web /api（功能全）
第二：ACP（无人值守、权限提示）
第三：SDK（脚本嵌入）
不选：webhook（单向）、进程内插件（耦合）
```

三条可用通道共用一套 `DshAdapter` 接口（`openSession / prompt / onEvent / answerInteraction / dispose`），场景切换时只换实现，不换业务代码。

## 四、QQ 侧协议端

| 方案 | 接入方式 | 优点 | 代价 / 风险 | 结论 |
|---|---|---|---|---|
| **NapCat** | OneBot v11 WS + HTTP | ✅ 本机已在跑（WebUI 6099、反向 WS 6199）；开源、Windows 友好、社区大 | 官方风控/封号风险；需小号 | **默认** |
| **SnowLuma** | OneBot v11 WS + HTTP | 🟡 qq-bridge 实测跑通；事件覆盖全（心跳 `status.good`、`bot_status`） | 原生 hook 注入；EULA 限制自动化部署与分发；不透明 | **备选适配** |
| **QQ 官方 Bot API** | 官方开放平台 | 合规、稳定、可上架 | 需认证；群场景受限；消息类型与主动推送受限 | 未来合规路线 |
| **AstrBot** | 平台 + 插件 | 生态成熟、开箱即用 | 它是另一个「大脑」，与 DSH 竞争；不适合作为纯通道 | **对照，不采用** |

选型原则：**桥接只依赖 OneBot v11 契约，不绑定具体协议端**。默认 NapCat 是因为它在本机已经跑着、且不需要注入 QQ 客户端；SnowLuma 作为兼容目标保留，但不作为分发默认（EULA 与可复现性）。

## 五、推荐堆栈

```
┌──────────────┐   OneBot v11    ┌──────────────────┐   Web /api    ┌─────────────┐
│ QQ 客户端     │ ──────────────► │ 桥接进程（Node）  │ ────────────► │ DSH Web     │
│ + NapCat     │ ◄────────────── │ onebot / dsh /   │ ◄──────────── │ profile     │
└──────────────┘   WS + HTTP     │ mapping / guard  │   RPC + mux   └─────────────┘
                                 └──────────────────┘
```

| 层 | 选择 | 理由 |
|---|---|---|
| 语言/运行时 | Node ≥ 22，ESM | 与 DSH 同引擎；OneBot 生态成熟；参考实现同栈，结论可直接复用 |
| 桥接结构 | 单进程 + 多模块（≤ 8 个文件，每个 ≤ 600 行） | 避免 qq-bridge 的 10k 单文件债 |
| DSH 通道 | Web `/api`，适配层单点 | 唯一覆盖提问/审批 |
| 协议端 | OneBot v11，NapCat 默认 | 本机已有、不注入 |
| 会话 | 1 QQ 会话 = 1 DSH 会话，JSON 持久化 | 上下文自然、可恢复 |
| 人格 | preset persona + `roles/*.md` 两层 | 行为与人设分离，换人格不改代码 |
| 存储 | JSON / JSONL，不上数据库 | 单机个人量级；需要统计再上 SQLite |
| 测试 | `node:test` + `node:assert`，不引框架 | 与 DSH/参考实现一致，零依赖 |
| 配置 | `config.json`（不入库）+ 环境变量覆盖 | 密钥不落库 |
| 可观测 | JSONL 事件日志 + 人读日志 + `/status` 探针 | 出问题能定位到「哪个通道断了」 |

## 六、被否决的方案

| 方案 | 否决理由 |
|---|---|
| 直接 fork qq-bridge 改 | 10k 单文件的结构债会原样继承；目标是沉淀资产，不是维护遗产 |
| 只用 ACP/SDK 一条通道 | 审批/提问断链，QQ 上跑长任务会静默卡死 |
| 只用 webhook | 只能新建会话，无法维持上下文 |
| 把桥接写成 DSH 插件 | QQ 侧故障会拖垮 host；调试要重启 DSH |
| 用 AstrBot 做中间层 | 多一层平台、多一套配置，且 AstrBot 自己也调模型，职责重叠 |
| 用 Python 写桥接 | DSH SDK 有 Python，但 OneBot 生态与参考实现都在 Node；跨语言增加部署面 |
| 上数据库/消息队列 | 单机单账号，JSON + 内存队列足够；引入后运维成本大于收益 |

## 七、演进路径

| 阶段 | 通道 | 目的 |
|---|---|---|
| M0–M1 | Web `/api` 单通道 | 先跑通、先守住安全 |
| M2 | `DshAdapter` 接口抽象 | 为 ACP/SDK 留位，不提前实现 |
| M3 | 按场景加 ACP | 「无人值守任务」用 ACP，「聊天」继续 Web |
| 未来 | 官方 QQ Bot API | 需要合规分发时切换协议端，桥接层不动 |

## 八、待验证假设

| # | 假设 | 验证任务 |
|---|---|---|
| V1 | `0.2.0-rc.2` 的 Web `/api` 仍支持会话投递 + mux 事件流 | [tasks/01-probe-dsh.md](../tasks/01-probe-dsh.md) |
| V2 | NapCat 与 SnowLuma 的 OneBot 事件字段足够一致 | [tasks/03-qq-channel.md](../tasks/03-qq-channel.md) |
| V3 | 提问/审批可在 QQ 侧稳定往返 | [tasks/05-security-baseline.md](../tasks/05-security-baseline.md) 的交互用例 |
| V4 | ACP profile 可在本机初始化并启动 | 探针的 `--try-acp` 选项 |

## 九、决策摘要

| ID | 决策 | 推荐 | 状态 |
|---|---|---|---|
| D1 | QQ 协议端 | OneBot v11 + NapCat | 待确认 → [ADR-001](decisions/ADR-001-qq-endpoint.md) |
| D2 | DSH 通道 | Web `/api` 默认 + Adapter 抽象 | 待确认 → [ADR-002](decisions/ADR-002-dsh-access.md) |
| D3 | 进程形态 | 独立进程 | 待确认 → [ADR-003](decisions/ADR-003-process-shape.md) |
| D4 | 会话映射 | 1:1 持久化 | 待确认 → [ADR-004](decisions/ADR-004-session-mapping.md) |
| D5 | 人格分层 | preset + roles | 待确认 → [ADR-005](decisions/ADR-005-persona-layers.md) |
| D6 | 安全模型 | fail-closed + 裁剪 | 待确认 → [ADR-006](decisions/ADR-006-security.md) |
