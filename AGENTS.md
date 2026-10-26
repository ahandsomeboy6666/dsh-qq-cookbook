# dsh-qq-cookbook 工作规范

本文件给 AI 执行者看。开工前必读，按本文执行。人读的入口是 [README.md](README.md)。

## 一、这个仓库是什么

把 **DeepSeek Harness（DSH）接入 QQ** 的选型与部署资产：路线对比、体验评分、安全边界、部署任务卡，以及能真跑的检查脚本。

**唯一标准：在 QQ 里用起来像个人。** 功能实现但 UX 指标不达标，不算做完（见 [docs/07-ux-spec.md](docs/07-ux-spec.md)）。

**当前方案（已拍板）**：`cheems135/dsh-qq-bridge` 插件 + NapCat，主线是**部署与验收**，不是自己写桥接。见 [docs/10-current-plan.md](docs/10-current-plan.md)。

```
QQ 客户端 ──► OneBot v11 协议端 ──► 桥接进程 ──► DSH（Web / ACP / SDK）
   ▲                                    │                │
   └────────── 回复 / 提问 / 审批 ◄──────┴────────────────┘
```

**当前不自己写桥接**：用 [cheems135/dsh-qq-bridge](https://github.com/cheems135/dsh-qq-bridge) 插件 + NapCat。自建路线（`tasks/01-09`）已归档，只作参考；主线是 `tasks/10-13` 的部署与验收。

**它不是** [qq-bridge](../qq-bridge/) 的 fork 或续作。qq-bridge 是上一轮 agent 给出的参考实现，本仓库把它当**已验证的事实基线**引用（见 [docs/references/qq-bridge-baseline.md](docs/references/qq-bridge-baseline.md)），不复制其 10,400 行单文件结构。

## 二、开工前必读

| 文件 | 讲什么 |
|---|---|
| [README.md](README.md) | 全貌、一分钟选型、最小回环步骤 |
| [docs/00-proposal.md](docs/00-proposal.md) | 提案：目标、非目标、成功标准、待确认决策 |
| [docs/01-tech-selection.md](docs/01-tech-selection.md) | 技术选型：五条接入通道对比与推荐 |
| [docs/03-threat-model.md](docs/03-threat-model.md) | 安全边界：QQ 消息是不可信输入 |
| [docs/07-ux-spec.md](docs/07-ux-spec.md) | 体验标准：场景、U1–U10 指标、失败文案 |
| [docs/10-current-plan.md](docs/10-current-plan.md) | **当前方案一页纸**：cheems + NapCat + 30 元授权 |
| [docs/04-acceptance.md](docs/04-acceptance.md) | 验收矩阵：每个里程碑跑什么命令 |
| [tasks/README.md](tasks/README.md) | 任务卡索引与依赖关系 |

## 三、事实纪律（本仓库最重要的规则）

本仓库产出的每条技术结论都必须能回答三个问题：

1. **在哪个版本上成立？** 写成 `dsh 0.2.0-rc.2` 这种可复现的版本号，不写「最新版」。
2. **怎么验证的？** 写命令或文件路径，例如 `dsh --version`、`~/.dsh/profiles`、DSH 源码 `packages/acp/acp/README.zh.md`。
3. **是谁的结论？** 区分三种来源，不许混写：

| 标记 | 含义 | 写法 |
|---|---|---|
| ✅ 实测 | 本机跑过命令看到输出 | 「实测 `dsh --version` → `0.2.0-rc.2`（2026-10-26）」 |
| 🟡 引用 | 来自已有文档/参考实现，未在本机复验 | 「qq-bridge README 记录（适配 0.2.1-rc.2）」 |
| ❓ 待验证 | 推断，必须由探针任务卡确认 | 「假设，见 tasks/01-probe-dsh.md」 |

4. **做过外部调研吗？** 选型类结论必须对比**至少 2 个已有实现**，写进 [docs/references/prior-art.md](docs/references/prior-art.md)。只拿一个参考实现当答案是已经踩过的坑（见 5.3 修正）。

**禁止**把 🟡 写成 ✅，禁止把 ❓ 写成结论。写不准就标 ❓。

## 三之二、事实变更协议（改一处，必须查全链）

改一个事实（选型、入口命令、版本、阶段名、profile）时，按顺序做：

1. 先改**单一真源**（选型事实的真源是 [docs/10-current-plan.md](docs/10-current-plan.md)）。
2. 跑 `node checks/check-consistency.mjs`，它会列出所有仍含旧事实的文件。
3. 逐个处理：改掉，或标注「归档 / 已取代 / 历史」。
4. 再跑一次，必须绿。
5. commit message 写清「事实变更：X → Y」。

**不允许只改主文档就宣布完成。** 这是本项目已经踩过的坑：选型改了 4 次（Web `/api` → 插件适配 → 官方 Bot → cheems），旧命令和旧结论散落在 ADR、任务卡、参考基线里，直到用户指出才补。

## 三之三、开发实践规范（每轮收尾）

1. **新增文档** → 登记 [docs/README.md](docs/README.md)；涉及当前事实 → 登记 [docs/FACTS.md](docs/FACTS.md)。
2. **改事实** → 按 FACTS.md 的「引用点」逐个更新；旧值所在文档标「归档 / 已取代 / 历史」。
3. **跑检查**：

   ```powershell
   node cli.mjs check      # 静态门禁：资产 + 事实一致性
   node cli.mjs doctor     # 环境事实：DSH / NapCat / 插件
   node cli.mjs status     # 全状态：+ 人设 / 额度 / 浏览器
   ```

   `check` 必须全绿才允许汇报；`doctor`/`status` 的 FAIL 表示“未就绪”，照实写。
4. **commit 用模板**：首次克隆执行 `git config commit.template .gitmessage`。
5. **commit message 必须写事实变更**：`事实变更：F1 cheems → 官方 Bot`；没有变更写「无」。

违反任一条 = 没做完，不许用「应该没问题」代替。

## 四、红绿流程

```
1. 先写检查/测试 → 跑一次 → 必须红（证明现在做不到）
2. 写代码 → 跑到绿
3. 全绿后再重构
4. 再跑一次 → 还是绿
```

本仓库当前的「红」是资产检查：

```powershell
node checks/check-assets.mjs     # 缺文档/缺验收 → 红
```

代码阶段的「红」是任务卡验收里的命令（`npm test`、`node checks/probe-dsh.mjs`、`npm run test:e2e`）。

**一上来就是绿的验收等于没验收**，重写验收。

## 五、任务卡规范

开工前写到 `tasks/NN-短名.md`，五段：目标 / 输入 / 输出 / 验收 / 不做什么。

- **目标**：一句话，≤ 60 字。
- **验收**：每条都是可执行命令，带期望输出。人工检查另设「人工验收」小节，不混进验收清单。
- **不做什么**：明确边界，防止顺手扩大范围。

模板见 [docs/templates/task-card.md](docs/templates/task-card.md)。`checks/check-assets.mjs` 会强制检查五段齐全、验收项带可执行命令。

## 六、文档分层（一篇事实只有一个家）

| 文件 | 唯一职责 | 不写什么 |
|---|---|---|
| `README.md` | 全貌、选型速查、最小回环 | 详细论证 |
| `docs/00-proposal.md` | 为什么做、做到什么程度、不做什么 | 实现细节 |
| `docs/01-tech-selection.md` | 选项对比与推荐 | 架构图、任务拆分 |
| `docs/decisions/ADR-*.md` | 单个决策的取舍与风险 | 全局背景（链接提案） |
| `docs/02-architecture.md` | 组件、数据流、失败模式 | 选型理由（链接 ADR） |
| `docs/03-threat-model.md` | 信任边界与对策 | 实现代码 |
| `docs/07-ux-spec.md` | 体验目标、场景、U1–U10 指标、失败文案 | 实现细节 |
| `docs/04-acceptance.md` | 每个里程碑的验收命令与期望 | 产品目标 |
| `docs/05-roadmap.md` | 里程碑顺序、依赖、任务卡索引 | 重复验收细节（链接 acceptance） |
| `docs/06-methodology.md` | 可复用的开发范式 | 本项目的具体选型 |
| `docs/references/` | 外部事实基线（版本、出处） | 本项目决策 |

同一句话不要在两处各写一遍；写第二遍的地方换成链接。

## 七、禁止事项

| 禁止 | 原因 |
|---|---|
| 没写验收就开工 | 做完发现方向错，返工 |
| 验收标准是「效果良好」 | 无法判定，来回扯 |
| 把 🟡/❓ 写成 ✅ | 下一个人会当真，踩同一个坑 |
| 引用不存在的命令或文件路径 | `check-assets` 会红 |
| 一次改多个无关模块 | 出问题无法定位 |
| 动工作区外的 `D:\qqaibot` | 那是另一套在跑的服务，会打断现有机器人 |
| 用「应该可以了」代替实际运行 | 最常见 |

## 八、汇报格式

```markdown
## 任务 03：QQ 通道接入

验收：
- [x] node checks/probe-qq.mjs → connected=true
- [x] npm test → 12 passed
- [ ] 人工：QQ 里发「ping」（待你验）

改动：
- src/onebot/client.mjs：新增
- checks/probe-qq.mjs：新增

未做：
- 没动 D:\qqaibot
```

绿了几条写几条，红着的照实写。

## 九、环境与部署

- 本仓库只在工作区内（`C:\Users\麾\Desktop\qinyaohui1\dsh-qq-cookbook`）。
- 本机桌面端：`0.2.1-rc.3`（内置 Node 24.21）；全局 CLI：`0.2.0-rc.2`（`dsh --version`）。两者可能不一致，插件跟随桌面端。
- profile 目录 `~/.dsh/profiles` 当前只有 `web` / `desktop`。
- 桌面端 Web 端口每次随机（本次 `53800`），探针用 `--dsh-url` 指定。
- 已有在跑的服务：AstrBot 6185、OneBot 反向 WS 6199、NapCat 6099（见工作区根 `AGENTS.md`）。
- 写 `D:\qqaibot` 或启动/停止现有服务前先问用户，不要自行操作。
