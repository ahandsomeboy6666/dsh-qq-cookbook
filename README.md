# dsh-qq-cookbook

把 **DeepSeek Harness（DSH）接入 QQ** 的选型与部署资产：选哪条路、怎么验收、哪些坑已经有人踩过。

**唯一标准：在 QQ 里用起来像个人。** 不是「功能接通」，是「发一句，几秒内有回应、能打断、群里不刷屏、出错说人话」。指标见 [UX 规格](docs/07-ux-spec.md)。

> **当前方案（已拍板）**：`cheems135/dsh-qq-bridge` 插件 + NapCat 小号。本仓库负责**选型、配置、验收**，不自己写桥接。见 [当前方案](docs/10-current-plan.md)。
>
> 与 [qq-bridge](https://github.com/Derpyu520/qq-bridge) 无代码关系，只引用其已验证结论作为事实基线。

> **把这个仓库丢给 AI 安装？** 让它先读 [BOOTSTRAP.md](BOOTSTRAP.md)——那是给 agent 的分步手册，写明哪一步必须停下来等人。

> **国内网络注意**：`setup.mjs` 要从 GitHub 克隆插件、下 NapCat，直连经常超时。
> 脚本会**自动换镜像**（gh-proxy → ghfast → ghproxy），也可以自己指定：
>
> ```powershell
> node tools/setup.mjs --mirror https://gh-proxy.com/      # 或设 GITHUB_MIRROR
> ```
>
> 镜像只影响**下载源**，装完的东西和直连一样。

## 一分钟选型

| 你的目标 | 选这条路 | 一句话理由 |
|---|---|---|
| **当前方案：私聊陪伴 + 群聊好玩 + 能办事** | **cheems135/dsh-qq-bridge 插件 + NapCat** | 分条 0.6–2.8s、情绪、记忆、主动；小号隔离 |
| 要合规、按钮审批、扫码零配置 | 腾讯官方 / xcisxc29（官方 Bot） | 无封号；审批是内联按钮 |
| 群聊最强（审批放行/禁言/表情包） | zaofan/dsh-qqbot（官方 Bot） | 群管与主动开口 |
| 已有 qq-bridge、想换 NapCat | qq-bridge + NapCat 魔改 | 保留全部功能，6–9 人日 |

体验评分见 [评分卡](docs/references/experience-scorecard.md)，生态调研见 [prior art](docs/references/prior-art.md)。

## 从零恢复（一条命令）

```powershell
git clone https://github.com/ahandsomeboy6666/dsh-qq-cookbook.git
cd dsh-qq-cookbook
node tools/setup.mjs      # 会问你 QQ 号 / 群号
```

> **两种号别搞混**：`setup.mjs` 问的是**主人号**（白名单——谁能命令机器人）；
> **NapCat 扫码用的是另一个小号**（机器人对外说话的身份）。脚本不碰扫码，也不会把主人号写进 NapCat。
> 只有一个号的话，先去注册个小号——用主号当机器人有风控风险。

自动完成：检测 DSH（缺则下载安装包）→ NapCat（缺则下 OneKey，`--install-napcat` 可自动装）→ clone 插件并打补丁 → 注册到 profile → 写 `cordis.patch.yml` → 写两套人设并**绑定会话** → 装 Playwright MCP → 装语音依赖。

之后只剩人工：**装 DSH 并登录、NapCat 扫码、小号只充 30 元**。

细节与陌生人实测见 [一个命令恢复](docs/16-one-command.md)。

## 一键启动（日常）

双击 `tools\一键启动肥鱼.bat`：自动检查并启动 NapCat、DSH，再验证桥接是否连上。

`
[1/3] NapCat（6700）... 已在运行
[2/3] DSH 桌面端 ... 已在运行
[3/3] 桥接状态 ... ok 已连接
  实测 probe-onebot ... ok connected，selfId=3866560965
`

首次部署（还没装插件）才需要下面的 D0–D3。
## 快速开始（D0–D3）

```powershell
# D0 环境（NapCat 未启动时 connected=false，是正常的）
node checks/probe-dsh.mjs --json --dsh-url http://127.0.0.1:<桌面端端口>
node checks/probe-onebot.mjs --json
node checks/check-install.mjs --json          # 未装插件时会给 TODO

# D1 安装（装完重启 DSH，设置 → QQ 桥接 → 填 wsUrl/token/白名单）
dsh plugin --profile desktop add <cheems 仓库路径>

# D2 人设（私聊/群聊两套）
node checks/check-persona.mjs

# 本地补丁（插件是 fork，升级后确认改动还在）
node checks/check-patches.mjs

# D3 能力与零花钱
node checks/check-browser.mjs
node checks/check-budget.mjs

# 随时：静态门禁 / 环境事实 / 全状态
node cli.mjs check
node cli.mjs doctor
node cli.mjs status
```

前置条件、失败排查、每步期望输出见 [验收矩阵](docs/04-acceptance.md)。任务卡见 [tasks/README.md](tasks/README.md)。

> CI 模板在 [docs/templates/ci-check.yml](docs/templates/ci-check.yml)：复制到 `.github/workflows/` 即可启用；push 时 token 需要 `workflow` 权限。

## 目录

```
docs/            提案、选型、架构、安全、UX 规格、验收、路线、方法论、本地补丁
docs/decisions/  ADR（每个技术决策一篇，含风险与验证方式）
docs/references/ 外部事实基线（版本、出处、体验评分）
docs/templates/  可复制到其他项目的模板
tasks/           任务卡：D0–D3 部署（主线）+ 01–09 自建（已归档）
checks/          检查脚本（资产、一致性、DSH、OneBot、安装、人设、补丁、额度、浏览器）
```

文档索引：[docs/README.md](docs/README.md)。

## 版本基线

| 组件 | 版本 | 来源 |
|---|---|---|
| 本机桌面端 | `0.2.1-rc.3`（内置 Node 24.21） | `resources/runtime/primary-runtime/runtime.json`（2026-10-26 升级） |
| 全局 CLI | `0.2.0-rc.2` | 实测 `dsh --version` |
| 系统 Node | `22.22.0` | 实测 `node --version` |
| DSH 源码（工作区内） | `0.1.7-rc.2` | `deepseek-harness/package.json` |
| 本机 profile | `web` / `desktop` | `~/.dsh/profiles` |
| 参考实现 | qq-bridge `v0.2.1-r1` | 其 README 声明适配 `0.2.1-rc.2` |

> 桌面端与 CLI 版本可能不一致：桌面端走内置 runtime，CLI 走全局 npm 包。cheems 是插件，跟随**桌面端**版本，验证时以 `desktop` 字段为准。

**版本是结论的一部分。** 任何「DSH 支持 X」的说法都必须带上版本，见 [AGENTS.md](AGENTS.md) 第三节。

## 安全默认

QQ 群消息是**不可信输入**。默认遵循 fail-closed：

- 白名单为空 = 不响应任何人（不是放行所有人）。
- 群聊不开放浏览器、购物、本地文件。
- 购物受益人只有「你」和「肥鱼自己」；转账/红包永远拒绝。
- 小号只充余额、不绑主卡；每笔记账。
- 支付确认走小额免密或人工，不给主号密码。

红线与对策见 [docs/03-threat-model.md](docs/03-threat-model.md)，授权模型见 [当前方案](docs/10-current-plan.md)。

## 资产完成度

| 资产 | 状态 |
|---|---|
| 技术选型（7 个方案、6 维评分） | ✅ 已完成 |
| 生态调研（6 个实现、两条路线） | ✅ 已完成 |
| 当前方案（一页纸） | ✅ 已拍板 |
| 安全与零花钱授权模型 | ✅ 已定 |
| 部署任务卡 D0–D3 | ✅ 已写 |
| 检查脚本（10 个） | ✅ 可运行 |
| 环境（NapCat / cheems / 人设） | ✅ 已就绪（2026-10-27） |
| 本地补丁（群聊唤醒层等） | ✅ 已生效，见 [补丁清单](docs/12-bridge-patches.md) |
| 浏览器能力（Playwright MCP） | ✅ 已生效，见 [浏览器能力](docs/13-browser-mcp.md) |
| 语音（MiniMax 克隆音色 / edge-tts 备用） | ✅ 已生效，见 [语音](docs/17-voice.md) |

## 状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| D0 | 环境就绪：NapCat 扫码、DSH 版本、插件未装清单 | ✅ 完成（6700/6701，selfId 3866560965） |
| D1 | 装 cheems，私聊/群聊打通 | ✅ 完成（私聊 + 群聊均通，含空 @） |
| D2 | 私聊/群聊两套人设 | ✅ 完成（`feiyu` / `feiyu-group`，preset=standard） |
| D3 | 浏览器能力 + 30 元零花钱授权 | ✅ 浏览器已通；额度只靠「小号只充 30 元」的物理上限，不写人设、不做代码闸门（见 [说明](docs/14-allowance.md)） |
| 附加 | 语音（MiniMax 克隆音色）、群聊唤醒层、贴吧风群聊人设 | ✅ 已生效，见 [语音](docs/17-voice.md) / [补丁清单](docs/12-bridge-patches.md) |
