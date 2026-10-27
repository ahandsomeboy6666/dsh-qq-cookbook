# 一个命令恢复

> 目标：`git clone` 之后一条命令，恢复到能聊天的状态。
> 现实：软件层能全自动，**登录态和钱这两件事只能人来**。

## 一、命令

```powershell
git clone https://github.com/ahandsomeboy6666/dsh-qq-cookbook.git
cd dsh-qq-cookbook
node tools/setup.mjs
```

加参数：

```powershell
node tools/setup.mjs --dry-run           # 只报告要做什么，不写文件
node tools/setup.mjs --qq 123456 --group 789012
node tools/setup.mjs --skip-mcp          # 不装 Playwright MCP
```

**幂等**：重复执行只会跳过已完成项。改动前会备份成 `*.bak-<时间戳>`。

## 二、它做了什么（9 步）

| # | 步骤 | 细节 |
|---|---|---|
| 1 | 检查 Node ≥ 22 | 低版本直接失败 |
| 2 | 检查 desktop profile | `~/.dsh/profiles/desktop` 不存在就停（先装 DSH） |
| 3 | clone 插件 | `cheems135/dsh-qq-bridge` → `vendor/dsh-im-bridge`，检出基线 `03afb9c` |
| 4 | 打本地补丁 | `patches/dsh-im-bridge-1.19.0-local.patch`（5 处改动，含群聊唤醒层） |
| 5 | 注册到 profile | `package.json` 加 `link:` 依赖 + `dsh.profile.bundles` |
| 6 | 写 `cordis.patch.yml` | `im-bridge` 配置（含 `napcat.dir`、`groupWake`）+ `mcp-browser`（`insert`） |
| 7 | 写人设 | 从 `roles/*.md` 抽正文，写进 `settings.json` 的 `personae` |
| 8 | 装 Playwright MCP | `npm i -g @playwright/mcp` |
| 9 | 建 NapCat 启动器 | 有 `tools/napcat` 时补 `launcher-user.bat`（走无 UAC 分支） |

## 三、它不做什么（三条人工）

| 事 | 为什么不能自动 |
|---|---|
| **NapCat 扫码登录** | 登录态在 QQ 客户端，无法脚本化；`tools/napcat/` 1.4GB 也不进仓库 |
| **白名单** | 默认值已写（`config/defaults.json`），换人/换群时才要改 |
| **小号只充 30 元** | 钱的事脚本管不了，这是整套额度的唯一真实约束 |

做完人工三步后：

```powershell
node cli.mjs status
node checks/check-patches.mjs
```

## 四、仓库里现在有哪些可复现资产

```
patches/dsh-im-bridge-1.19.0-local.patch   插件 5 处改动，git apply 即可
config/defaults.json                       账号、端口、唤醒参数的默认值
tools/setup.mjs                            一键安装（幂等）
tools/一键启动肥鱼.bat                     日常启动（NapCat + DSH + 自检）
roles/*.md                                 两套人设的唯一真源
docs/12-bridge-patches.md                  补丁说明书（升级后重打）
```

## 五、为什么不能做到 100%

- **NapCat 1.4GB**：GitHub 单个文件上限 100MB，放不进仓库
- **QQ 登录态**：必须扫码，且和手机/设备绑定
- **DSH 桌面端**：是 Electron 安装包，脚本最多检查它在不在
- **模型凭据**：`~/.dsh/.credentials.yaml` 依赖 DSH 登录

所以「一个命令」的边界是：**软件与配置全自动，登录与资金人工一次**。

## 六、排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `apply --check` 失败 | 上游更新了，补丁基线不再匹配 | 看 [12](12-bridge-patches.md) 第五节手动重打 |
| 人设没写进去 | `settings.json` 不存在（插件没启动过） | 先启动 DSH 一次，再重跑脚本 |
| 端口不对 | NapCat 不在默认 6700/6701 | `--qq` 之外，改 `config/defaults.json` 的 `wsUrl` |
| MCP 没起来 | 全局装失败 / 路径不对 | `npm i -g @playwright/mcp`，或 `--skip-mcp` 后手动配 |
