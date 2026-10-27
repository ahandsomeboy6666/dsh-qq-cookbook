# 一个命令恢复（给别人用版）

> 目标：`git clone` 之后一条命令，恢复到能聊天的状态。
> 现实：软件与配置全自动，**安装 DSH、NapCat 扫码、充钱这三件只能人做**。

## 一、别人拉下来要过几关

| # | 关卡 | 谁来做 | 说明 |
|---|---|---|---|
| 1 | 装 DSH 桌面端并**登录一次** | 人 | 脚本能下载安装包，但双击安装 + 登录必须人做 |
| 2 | 填自己的 QQ 号/群号 | **脚本会问** | 白名单，不填就"她不回我" |
| 3 | NapCat（约 300MB，含 QQ） | 脚本下载 + 人点安装器 | `--install-napcat` 可全自动跑 |
| 4 | QQ 小号扫码登录 | 人 | 登录态绑设备，无法脚本化 |
| 5 | 网络 | — | GitHub / npm / PyPI / 官网，任一不通会卡住 |
| 6 | 语音 Key（可选） | 人 | 不配就用免费甜妹，不阻塞 |

## 二、命令

```powershell
git clone https://github.com/ahandsomeboy6666/dsh-qq-cookbook.git
cd dsh-qq-cookbook
node tools/setup.mjs
```

首次运行会问两句：

```
  你的 QQ 号（白名单，只回这个人）：123456789
  要接的 QQ 群号（回车跳过，不接群）：987654321
```

也可以非交互：

```powershell
node tools/setup.mjs --qq 123456789 --group 987654321
```

## 三、它做了什么（10 步）

| # | 步骤 | 细节 |
|---|---|---|
| 1 | 检查 Node ≥ 22 | 低版本直接失败 |
| 2 | 检查 DSH 桌面端 | 常见路径找不到 → 从官方源下载安装包（校验 sha512），提示双击安装 |
| 3 | 检查 desktop profile | 不存在就停：「先启动一次 DSH 再重跑」 |
| 4 | NapCat | 找 `tools/napcat/*Shell*`；没有就下 OneKey（约 1MB），`--install-napcat` 时再跑官方安装器（约 300MB） |
| 5 | clone 插件 | `cheems135/dsh-qq-bridge` → `vendor/dsh-im-bridge`，检出基线 `03afb9c` |
| 6 | 打本地补丁 | `patches/*.patch`，12 处改动（P1–P12） |
| 7 | 注册到 profile | `package.json` 加 `link:` 依赖 + `dsh.profile.bundles` |
| 8 | 写 `cordis.patch.yml` | `im-bridge`（含 `napcat.dir`、`groupWake`）+ `mcp-browser`（`insert`） |
| 9 | 写人设 + 绑定会话 | 从 `roles/*.md` 抽正文写进 `personae`，并把 `private:<QQ>` / `group:<群>` 绑到对应角色 |
| 10 | **首次安装写面板参数** | `companion.maxBubbles=2`、`memory`、`proactiveCfg`（已配置的机器不覆盖） |
| 11 | Playwright MCP / 语音 / 启动器 | 装 MCP；装 `edge-tts` 并配 Python 路径；补 `launcher-user.bat` |

> **不会复制的**：QQ 号/群号（必须自己填）、语音 Key 与克隆音色、记忆/表情包/会话历史、NapCat 登录态。
> 这些要么是隐私，要么只能人做。

## 四、参数

| 参数 | 作用 |
|---|---|
| `--qq <号>` | 必填（非交互时），白名单 |
| `--group <号>` | 可选，不填 = 不接群 |
| `--dry-run` | 只报告，不写文件；缺 QQ 时用占位号展示 |
| `--skip-mcp` | 不装 Playwright MCP |
| `--install-napcat` | 缺 NapCat 时自动跑官方安装器（约 300MB） |
| `--no-download` | DSH 没装时只给地址，不下载 |

**幂等**：重复执行只跳过；改文件前备份 `*.bak-<时间戳>`。
**不覆盖已有语音配置**：已经配了 MiniMax/Breeze 的，只补 Python 路径，不改引擎。

## 五、做不到的三件

| 事 | 为什么 |
|---|---|
| 装 DSH + 登录 | Electron 安装包要 UAC 确认；登录态在账号 |
| NapCat 扫码 | 登录态绑手机/设备 |
| 小号只充 30 元 | 钱的事，也是整套额度的唯一真实约束 |

## 六、陌生人场景实测（2026-10-27）

| 场景 | 结果 |
|---|---|
| 空 `DSH_HOME` | `[FAIL] DSH desktop profile 找不到 ... 先启动一次 DSH 再重跑` |
| 不给 `--qq` | 非 dry-run 直接报错并给用法；dry-run 用占位号 |
| 全新 clone（无 vendor） | `[TODO] clone 插件`，后续步骤正确等待 |
| 本机已配好 | 全 SKIP，幂等 |

## 七、排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 她不回我 | 白名单里是别人的号 | 重跑 `--qq 你的号` |
| `apply --check` 失败 | 上游更新，补丁基线不匹配 | 看 [12](12-bridge-patches.md) 手动重打 |
| 人设没写进去 | `settings.json` 不存在（插件没启动过） | 先启动 DSH 一次再重跑 |
| 群里用私聊性格 | 群没绑人设 | 重跑 setup（会自动绑 `group:<群>`） |
| MCP 没起来 | 全局装失败 | `npm i -g @playwright/mcp`，或 `--skip-mcp` |
| NapCat 起不来 | 没装或没扫码 | `tools/napcat` 下跑 `NapCatInstaller.exe`，再 `napcat.quick.bat` |
| **双击 bat 闪退/没反应** | bat 是 UTF-8 但 cmd 按 GBK 读，中文行语法错；或 ps1 丢了 BOM | bat 用纯 ASCII；ps1 必须 UTF-8 **带 BOM**；双击日志在 `%TEMP%\feiyu-start.log` |
| 启动脚本报 `Unexpected token '{'` | ps1 被编辑器改成无 BOM，PowerShell 按 GBK 解码中文 | 重新以 UTF-8 with BOM 保存 ps1 |
