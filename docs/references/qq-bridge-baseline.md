# qq-bridge 基线

> 用途：**不重复踩坑**。qq-bridge 是上一轮 agent 产出的参考实现，本文只摘录它的实测结论与本项目的复用边界。
>
> 来源：工作区 `qq-bridge/`（`v0.2.1-r1`，其 README 声明适配 DSH `0.2.1-rc.2`）。本机实际是 `0.2.0-rc.2`，凡标「需复核」的结论都要在 M0 探针里确认。

## 一、身份

| 项 | 值 |
|---|---|
| 位置 | `C:\Users\麾\Desktop\qinyaohui1\qq-bridge` |
| 版本 | `v0.2.1-r1` |
| 主程序 | `src/bridge.js`（约 10,400 行，单文件） |
| 协议端 | SnowLuma（OneBot v11 WS + HTTP） |
| 运行模式 | `chat` / `closed-agent` / `reserved` / `reserved2` |
| 测试 | 几十个 `scripts/test-*.mjs`，`node:assert` 手写断言 |

## 二、可直接复用的结论

| # | 结论 | 出处 | 对本项目的意义 |
|---|---|---|---|
| B1 | DSH `0.1.7` 起进程 token 只存内存，必须用 `~/.dsh/.credentials.yaml` 的签名密钥离线铸造 Cookie | DSH_SETUP FAQ「401」 | 鉴权直接用这套，不读日志 token |
| B2 | `0.2.0` 的 `settings/update` 是**多参数** RPC（`{ ns, patch, expectedRevision }` 平铺），传 `{request}` 会被拒 | DSH_SETUP FAQ「模式回滚」 | 适配层按版本分支 |
| B3 | `0.2.1` 删除了 persona 的 `{{cwd}}` 变量，导致每回合在系统提示词装配阶段报错 | README「v0.2.1-r1 主要改动」 | 人格/preset 不许用未文档化的提示词变量 |
| B4 | SnowLuma 的 HTTP token 与 WS token 是**两个值**，首次 WS 1006 后自愈属正常 | README「已知行为」 | 协议端探针要区分两种 token |
| B5 | SnowLuma `[Hook]` 会退化：进程与 WS 都活着但收不到数据，靠心跳 `status.good` 判断 | README「连上了 ≠ 收得到」 | 探针要有「连接 vs 可接收」两级判断 |
| B6 | DSH `0.1.7` 起 preset 不再是 `~/.dsh/.agent-presets/<名>/` 目录，而是 profile 里一条 `@deepseek-ai/dsh-agent-preset` 行 | DSH_SETUP「preset 没出现」 | preset 安装方式照此实现 |
| B7 | preset 缺失时**拒绝建会话**，不回退默认 preset（否则群友可触达 bash/文件） | DSH_SETUP FAQ「QQ preset 挂载失败」 | 直接采纳为安全条款 |
| B8 | QQ 安全守卫的工具名单必须随 DSH 版本对账（`0.2.0` 新增 15 个必须隐藏的工具名） | README「v0.2.0-r1」 | 工具面断言要版本化，不能写死 |
| B9 | 会话退役前要清 DSH 侧未跑的队列，否则旧任务继续跑 | README「v0.2.0 修复」 | M2 退役逻辑必须包含队列清理 |
| B10 | 交互可转发：`ask_user_question` 与工具审批都能发到 QQ 并回填 | README「交互增强」 | 这是选 Web 通道的核心理由 |

## 三、需复核（版本差异）

| # | 结论 | 为什么要复核 |
|---|---|---|
| R1 | `settings/update` 参数形状 | 记录于 `0.2.0`，本机 `0.2.0-rc.2` 可能不同 |
| R2 | `session/projections` 与 `session/control` 的 `projections[<id>].values.inbox` | `0.2.0` 修复后的形状 |
| R3 | `agentPresets/list` 的返回结构 | `0.2.1` 有变化 |
| R4 | `/api/remote.mux` 的帧格式与 `$events` ready 帧 | 协议细节，升级易变 |
| R5 | 群聊引用/回复的字段名 | 协议端差异（SnowLuma vs NapCat） |

## 四、不复用的部分

| 部分 | 原因 |
|---|---|
| 10,400 行单文件 `bridge.js` | 结构债；本项目要求模块化、单文件 ≤600 行 |
| 四个运行模式 | 复杂度高；本项目 M0–M2 只做 `chat` + `closed-agent` 两个 |
| `reserved`/`reserved2` 仿真群友 | 非核心路径，M3 之后按需 |
| 黑话学习、表情包、语音 | M3 增强，不在基础资产内 |
| SnowLuma 专属诊断 | 本项目默认 NapCat，诊断逻辑要重写为协议端无关 |
| `postinstall` 补丁 `@snowluma/sdk` | 本项目不依赖该 SDK（只用原始 WS/HTTP），从根上避免 |

## 五、可复用的测试思路

- **fixture 回放**：把真实 OneBot 事件脱敏后存 `tests/fixtures/`，离线跑解析。
- **反面断言**：qq-bridge 用「`get_login_info` 不含 `good`，所以判空是死代码」这类断言钉住错误实现，值得学。
- **幂等测试**：安装脚本重复跑不改变配置，用临时目录 + 假 `DSH_HOME`。
- **单实例锁测试**：双开必须失败。

## 六、差异声明

本仓库**不是** qq-bridge 的 fork，不承担其历史兼容；只在上述结论上复用。若未来两者行为不一致，以本仓库的 ADR 与验收为准，并回写本文的「需复核」表。
