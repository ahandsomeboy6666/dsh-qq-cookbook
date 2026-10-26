# 架构

> ⚠️ **本文是自建桥接路线的架构（已归档）**。当前方案是 cheems 插件 + NapCat，见 [当前方案](10-current-plan.md)。
>
> 只有 cheems 走不通、需要自建时，才按本文实现。

## 一、组件

```
┌────────────┐  OneBot v11 WS/HTTP  ┌──────────────────────────────┐  Web /api RPC  ┌──────────────┐
│ QQ 客户端   │ ◄──────────────────► │ 桥接进程 src/                 │ ◄────────────► │ DSH Web      │
│ + NapCat   │                      │                              │  + remote.mux  │ profile      │
└────────────┘                      │ onebot/  dsh/  mapping/      │                └──────────────┘
                                    │ guard/   persona/  store/    │
                                    │ observability/  main.mjs     │
                                    └──────────────────────────────┘
                                              │
                                              ▼
                                    state/（sessions.json、日志、token 账本）
```

| 模块 | 职责 | 不该做什么 |
|---|---|---|
| `src/main.mjs` | 启动、单实例锁、信号处理、装配 | 业务判断 |
| `src/onebot/` | 连接协议端、解析事件、发送动作 | 决定「这条要不要进 agent」 |
| `src/dsh/` | `DshAdapter` 接口 + Web 实现（鉴权、RPC、mux、会话） | QQ 字段解析 |
| `src/mapping/` | QQ 会话 ↔ DSH 会话，建/复用/重置/退役 | 网络调用 |
| `src/guard/` | 白名单、工具面断言、发送审计、审批超时 | 拼 prompt |
| `src/persona/` | 角色卡解析、按场景筛小节、截断、注入 | 存业务状态 |
| `src/store/` | JSON/JSONL 原子读写、备份 | 业务规则 |
| `src/observability/` | 结构化日志、token 记账、`/status` 探针 | 改业务状态 |

**单文件上限 600 行**，超过就拆。这是对 qq-bridge 10,400 行单文件的直接纠正。

## 二、入站（QQ → agent）

```
1. NapCat 推 message/private 或 message/group
2. onebot/ 归一化成 InboundMessage { kind, peerId, senderId, text, media[], raw }
3. guard/ 判定：
   a. 白名单/黑名单 → 不在名单，写日志「已忽略」，结束
   b. 群消息未 @ 自己且未命中关键词 → 只入库，不进 agent
   c. 命中管理命令（/reset 等）→ 桥接直接执行，不进模型
4. mapping/ 取或建 DSH 会话（preset 由配置固定）
5. dsh/ 投递：followup(user message)，带上人格注入
6. DSH agent 开始跑
```

**管理命令在桥接层执行，不经过模型**——这是为了防止「群友发 `/role` 把人格改掉」。

## 三、出站（agent → QQ）

两种模式，配置切换：

**relay（默认）**

```
1. dsh/ 订阅 session 事件流，收集本轮 assistant 文本
2. 回合结束（idle）→ guard/ 审计出站文本
3. 通过 → onebot/ 发送；被拦截 → 发安全提示，记审计日志
4. 长文本按句读/URL 边界分段，段间有发送间隔
```

**tools（增强，M3）**

```
1. agent 通过 MCP 工具 qq_send_message 主动发送
2. guard/ 校验目标白名单与频率
3. onebot/ 发送
```

> relay 的优点是不依赖模型「记得发消息」；tools 的优点是 AI 可以自己决定分条、引用、潜水。两者不要同时开，否则会重复发送——由配置里的 `outbound.mode` 二选一。

## 四、交互（提问与审批）

```
agent 发起 ask_user_question / 工具审批
        │
        ▼
dsh/ 收到 interaction 事件
        │
        ▼
guard/ 校验：只转发给 owner（私聊或群内 @owner）
        │
        ▼
onebot/ 发到 QQ，记录 pendingInteraction { id, expiresAt }
        │
        ▼
owner 回复「通过/拒绝/选项」→ guard/ 匹配 → dsh/ 回填
超时（默认 120s）→ 自动按拒绝处理
```

群友的回复**不能**应答审批；只认 owner 的答复。

## 五、状态与持久化

| 文件 | 内容 | 写入方式 |
|---|---|---|
| `state/sessions.json` | QQ 会话 ↔ DSH 会话映射 | 临时文件 + 原子 rename，保留 `.bak` |
| `state/mode.json` | 当前运行模式（chat / closed-agent 等） | 同上 |
| `state/token-usage.jsonl` | 每轮 token 与费用 | 追加写 |
| `state/audit.jsonl` | 被拦截的出站消息、审批决策 | 追加写 |
| `state/bridge.log` | 人读日志，按天轮转 | 追加写 |
| `config.json` | 真实配置（密钥） | 手工编辑，**不入库** |

**状态文件是用户数据**：只加字段不删字段；迁移要写脚本并备份。

## 六、失败模式

| 故障 | 表现 | 架构上的处理 |
|---|---|---|
| DSH 重启 | 会话 id 失效、投递 404 | 适配层识别「会话不存在」→ 重建一次 → 打日志；期间消息进内存队列（上限 50/会话） |
| DSH 升级改协议 | 静默失效 / 401 | 探针先跑；适配层单点；失败信息带版本号与检查项 |
| 协议端断线 | 收不到消息 | WS 自动重连；`/status` 显示 `onebot.connected=false`；重连后补发未确认消息 |
| 协议端「连上但收不到」 | 无事件 | 心跳/`get_status` 探活；`/status` 报 `degraded` 并给排查提示 |
| 会话映射损坏 | 全部重建 | 原子写 + `.bak`；启动时校验 JSON，坏文件改名保留 |
| 审批无人应答 | agent 卡住 | 超时默认拒绝，并在 QQ 告知「已按拒绝处理」 |
| 消息洪峰 | 发送被限流 | 每会话队列 + 发送间隔 + 合并短时间多段 |

## 七、扩展点

| 想加什么 | 在哪加 | 不改什么 |
|---|---|---|
| 人格 | `roles/*.md` | 代码 |
| 行为协议（分条、潜水） | preset persona | 桥接业务代码 |
| 新工具（搜索、表情） | `guard/` 的工具白名单 + MCP server | 入站/出站主流程 |
| 新的 DSH 通道 | `dsh/` 新增一个 Adapter 实现 | mapping/guard/persona |
| 新的协议端 | `onebot/` 的连接层适配 | 事件归一化之后的全部逻辑 |

## 八、明确不做

- 不做流式逐字转发（QQ 侧体验差且易触发限流），按轮次发送。
- 不做多账号/多租户。
- 不做「桥接替 AI 决定说什么」——relay 只转发，tools 由 AI 主动。
- 不在桥接里存全量聊天记录（只存映射与审计，正文在 DSH 会话里）。
