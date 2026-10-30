# 事实台账

> 每条「当前事实」只有一个真源。改它之前，先看「引用点」，逐个更新或标归档，再跑 `cli.mjs check`。
>
> 规则：新增事实必须登记；改名/改值 = 改真源 + 改引用点 + 跑检查 + commit 写「事实变更：F-ID 旧 → 新」。

| ID | 事实 | 当前值 | 真源 | 引用点 | 关键词 | 检查 |
|---|---|---|---|---|---|---|
| F1 | 接入方案 | `cheems135/dsh-qq-bridge` 插件 + NapCat | [10-current-plan.md](10-current-plan.md) | `README.md`、`docs/00-proposal.md`、`docs/01-tech-selection.md`、`docs/decisions/ADR-001-qq-endpoint.md`、`tasks/10-onboard-env.md`、`tasks/11-install-cheems.md` | `cheems` | `check-consistency`: transport |
| F2 | 桌面端版本 | `0.2.1-rc.3`（CLI `0.2.0-rc.2`） | `checks/probe-dsh.mjs` | `README.md`、`AGENTS.md`、`docs/01-tech-selection.md`、`docs/references/dsh-capability-matrix.md` | `0.2.1-rc.3` | `check-consistency`: desktop-version |
| F3 | 装插件的 profile | `desktop` | [10-current-plan.md](10-current-plan.md) | `README.md`、`tasks/11-install-cheems.md` | `desktop` | `check-consistency`: profile-web |
| F4 | 阶段 | D0–D3（M0–M4 已归档） | [tasks/README.md](../tasks/README.md) | `README.md`、`docs/05-roadmap.md`、`docs/04-acceptance.md`、`docs/00-proposal.md` | `D0` | 人工 |
| F5 | 零花钱授权 | 30/60/300、受益人 owner+self、禁转账 | [config.example.json](../config.example.json) | `docs/10-current-plan.md`、`tasks/13-allowance-browser.md`、`README.md` | `30` | `check-budget` |
| F6 | 本机 Web 端口 | 桌面端随机（本次 `53800`） | `checks/probe-dsh.mjs` | `AGENTS.md` | `53800` | 探针 |
| F7 | 语音（TTS）方案 | 本地 Breeze-TTS-2 q8_0（Vulkan）+ C4 克隆 + 情绪 instruct | [20-tts-selection.md](20-tts-selection.md) | `README.md`、`AGENTS.md`、`docs/17-voice.md` | `Breeze` | `check-assets`: FACTS 引用点 |

## 维护流程

1. **改真源**：只改「真源」那一列的文件。
2. **扫引用点**：按表里「引用点」逐个检查；旧值保留的地方标「归档 / 已取代 / 历史」。
3. **跑检查**：
   ```powershell
   node cli.mjs check
   ```
4. **提交**：commit message 写 `事实变更：F1 cheems → 官方 Bot`（没有变更写「无」）。

## 为什么需要这张表

本项目选型改过 4 次（Web `/api` → 插件适配 → 官方 Bot → cheems），每次都只改主文档，旧命令/旧版本散落在 ADR、任务卡、基线里，直到用户指出才补。根因是**事实没有单一真源、没有引用点清单、没有可执行断言**。这张表 + `check-consistency` + `check-assets` 的引用点校验，就是补这三个缺口。
