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
node tools/setup.mjs --no-download       # DSH 没装时只给地址，不下载
```

**幂等**：重复执行只会跳过已完成项。改动前会备份成 `*.bak-<时间戳>`。

## 二、它做了什么（10 步）

| # | 步骤 | 细节 |
|---|---|---|
| 1 | 检查 Node ≥ 22 | 低版本直接失败 |
| 2 | 检查 DSH 桌面端 | 常见路径找 `DeepSeek Harness.exe`；**找不到就去官方源下载安装包** |
| 3 | 检查 desktop profile | `~/.dsh/profiles/desktop` 不存在就停（装完 DSH 要启动一次） |
| 4 | clone 插件 | `cheems135/dsh-qq-bridge` → `vendor/dsh-im-bridge`，检出基线 `03afb9c` |
| 5 | 打本地补丁 | `patches/dsh-im-bridge-1.19.0-local.patch`（5 处改动，含群聊唤醒层） |
| 6 | 注册到 profile | `package.json` 加 `link:` 依赖 + `dsh.profile.bundles` |
| 7 | 写 `cordis.patch.yml` | `im-bridge` 配置（含 `napcat.dir`、`groupWake`）+ `mcp-browser`（`insert`） |
| 8 | 写人设 | 从 `roles/*.md` 抽正文，写进 `settings.json` 的 `personae` |
| 9 | 装 Playwright MCP | `npm i -g @playwright/mcp` |
| 10 | 建 NapCat 启动器 | 有 `tools/napcat` 时补 `launcher-user.bat`（走无 UAC 分支） |

### 关于 DSH 下载

检测顺序：`DSH_DESKTOP_DIR` → `E:\dsh桌面端` → `%LOCALAPPDATA%\Programs\DeepSeek Harness` → `%ProgramFiles%\DeepSeek Harness`。

找不到时读官方更新源（来自已安装端的 `resources/app-update.yml`）：

```
清单  https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml
安装包 https://download.deepseek.com/dsh-desk/bin/win-x64/deepseek-harness-<版本>-win-x64.exe
```

下载到 `tools/downloads/`（约 290MB，已 gitignore），**校验 sha512** 后打印路径，然后退出。
脚本不静默安装（避免 UAC/杀软拦截），你双击装完再重跑一次即可。

`--no-download` 只打印清单地址，不下载。

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
- **DSH 安装**：安装包能自动下载，但**双击安装要人点**（UAC + 首次登录）
- **模型凭据**：`~/.dsh/.credentials.yaml` 依赖 DSH 登录

所以「一个命令」的边界是：**下载、软件配置、补丁、人设全自动；安装、扫码、资金人工各一次**。

## 六、排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `apply --check` 失败 | 上游更新了，补丁基线不再匹配 | 看 [12](12-bridge-patches.md) 第五节手动重打 |
| 人设没写进去 | `settings.json` 不存在（插件没启动过） | 先启动 DSH 一次，再重跑脚本 |
| 端口不对 | NapCat 不在默认 6700/6701 | `--qq` 之外，改 `config/defaults.json` 的 `wsUrl` |
| MCP 没起来 | 全局装失败 / 路径不对 | `npm i -g @playwright/mcp`，或 `--skip-mcp` 后手动配 |
| 下载 DSH 失败 | 网络到 `download.deepseek.com` 不通 | 加 `--no-download` 拿地址，手动下 |
