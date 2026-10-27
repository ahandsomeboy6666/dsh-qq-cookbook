# 验收记录

> 每次验收追加一节：日期、命令、结果、遗留。要能照着重跑。

## 2026-10-27 · 项目 + 资产验收

### 环境

| 组件 | 版本 / 值 |
|---|---|
| DSH 桌面端 | `0.2.1-rc.3`（内置 Node 24.21） |
| 全局 CLI | `0.2.0-rc.2` |
| 系统 Node | `v22.22.0` |
| 桥接插件 | `dsh-im-bridge@1.19.0`（本地 fork，5 处补丁见 [12](12-bridge-patches.md)） |
| NapCat | 6700 HTTP / 6701 WS / 6099 WebUI |
| 机器人账号 | 大肥鱼 `3866560965` |
| 白名单 | 私聊 `632207916`；群 `834195405` |

### 项目验收

| 阶段 | 结果 | 证据 |
|---|---|---|
| D0 环境就绪 | ✅ | 6700/6701 监听，selfId 3866560965 |
| D1 私聊/群聊打通 | ✅ | 私聊真实对话；群聊含「只 @ 不说话」 |
| D2 两套人设 | ✅ | `feiyu`（私聊）/ `feiyu-group`（群），preset=standard，文件与面板一致 |
| D3 浏览器 | ✅ | Playwright MCP 进程常驻，`browser_navigate` 实测 B 站 |
| D3 额度 | ✅ | 只靠小号 30 元物理上限；人设无额度条款，代码无闸门（[14](14-allowance.md)） |

行为证据（`~/.dsh/im-bridge/bridge.log`，当日）：

| 日志 | 次数 | 含义 |
|---|---|---|
| `wake: at` | 1 | @ 唤醒 |
| `wake: nickname` | 5 | 提到「肥鱼/大肥鱼」 |
| `wake: follow` | 5 | 跟随窗口内继续接 |
| `wake: probability` | 1 | 概率唤醒 |
| `ambient: buffered` | 6 | 未唤醒，只记录不调模型 |

群回复最近 8 条中带 `@` 的：**0 条**。

### 资产验收

| 项 | 命令 | 结果 |
|---|---|---|
| 仓库门禁 | `node cli.mjs check` | ✅ PASS 75 / FAIL 0 |
| 事实一致性 | 同上（扫描 54 文件） | ✅ 一致 |
| 检查脚本 | 9 个逐个执行 | ✅ 9/9 PASS |
| 文档 | 35 篇 | ✅ 索引覆盖、ADR 台账一致、FACTS F1–F6 |
| 任务卡 | 13 张 + README | ✅ 引用脚本存在 |
| 人设文件 | 2 份 | ✅ 与面板一致（309 / 373 字，含说明） |
| 受控文件 | 73 个 | ✅ `git status` 干净 |
| 外部资产 | `vendor/` 236 文件 21MB；`tools/napcat/` 3333 文件 1.4GB | ✅ 均被 `.gitignore` 正确排除 |
| 本地补丁 | `node checks/check-patches.mjs` | ✅ 5 补丁 + 4 配置全 OK |

### 复现命令

```powershell
cd E:\workspace\dsh-qq-cookbook
node cli.mjs check
node cli.mjs status
node checks/check-assets.mjs
node checks/check-consistency.mjs
node checks/probe-dsh.mjs
node checks/probe-onebot.mjs
node checks/check-install.mjs
node checks/check-persona.mjs
node checks/check-budget.mjs
node checks/check-browser.mjs
node checks/check-patches.mjs
```

### 遗留

| 项 | 性质 | 处理 |
|---|---|---|
| 小号余额是否真的只有 30 元 | 人工 | 要本人确认，脚本验不了 |
| 长任务输出像周报（>200 字整段） | 体验 | 待做：人设收敛 + 插件兜底拆条 |
| DSH 重启后不自动拉起 NapCat | 运维 | 用 `tools\一键启动肥鱼.bat` 规避 |
| `vendor/` 补丁不在版本控制 | 设计 | 靠 `check-patches` + [12](12-bridge-patches.md) 兜底 |

### 本次验收中修掉的问题

- `probe-dsh` 写死历史端口（3080/50460），桌面端重启后端口变化会误报「Web API 不可达」→ 改为自动发现本机监听端口（commit `f5742a5`）
- `check-browser` 只扫 `~/.dsh/cordis.patch.yml`，漏掉实际生效的 `profiles/*/cordis.patch.yml`
- `check-budget` 只读示例配置，属假绿 → 改为同时校验生效配置与「人设不含额度条款」
