# BOOTSTRAP · 给 AI 的执行手册

> 你是被用户丢进这个仓库的 agent。目标：**把 QQ 桥接装到能用**。
> 读到这里就不要自己发明流程，按下面顺序做，卡住的地方明确停下等人。

## 零、先搞清楚你能做什么

| 能 | 不能 |
|---|---|
| 跑 `node tools/setup.mjs` | 替用户扫码登录 QQ |
| `git clone` / `npm i -g` / `pip install` | 往小号里充钱 |
| 改 `~/.dsh` 下的配置 | 绕过 DSH 的登录 |
| 读 `~/.dsh/im-bridge/bridge.log` 排障 | 猜用户的 QQ 号 |

**三条硬边界**：扫码、充值、DSH 登录，都必须人做。遇到就停。

## 一、先问，再动手

问两个问题（不要猜、不要用仓库里的示例号）：

```
1. 你要接入的 QQ 号是？（这是白名单，机器人只回这个人）
2. 有要接的群吗？群号多少？（没有就说没有）
```

顺手确认：

- 用户机器上装了 DSH 桌面端吗？装过并登录过吗？
- 有 QQ 小号吗？（没有的话提醒：别用主号）

## 二、检查前置

```powershell
node --version                      # 需要 >= 22
Test-Path "$env:USERPROFILE\.dsh\profiles\desktop"   # 有才算登录过
```

- 有 Node 22+、有 `profiles/desktop` → 继续
- 没有 `profiles/desktop` → **停下**，说：「先安装并启动一次 DSH 桌面端，登录后告诉我」

## 三、跑安装

```powershell
node tools/setup.mjs --qq <用户的QQ> --group <群号或省略> --install-napcat
```

- `--install-napcat` 会下 300MB 的 QQ，可能跑 5–10 分钟，**不要中途打断**
- 加 `--skip-mcp` 可以跳过 Playwright（浏览器能力，非必需）
- 不确定会做什么时先用 `--dry-run` 看一遍

### 读输出

每行是 `[OK] / [SKIP] / [TODO] / [FAIL]`：

| 状态 | 含义 | 你的动作 |
|---|---|---|
| `OK` | 刚做完 | 继续 |
| `SKIP` | 已经存在，跳过 | 继续 |
| `TODO` | dry-run 或需要人 | 看具体是哪步 |
| `FAIL` | 出错了 | 按第七节排查，别硬跑下一步 |

## 四、停下，让用户扫码

```powershell
# 启动 NapCat（路径以 setup 输出为准，一般在 tools/napcat/*Shell*/napcat.quick.bat）
Start-Process -FilePath "<那个目录>\napcat.quick.bat" -WorkingDirectory "<那个目录>"
```

然后告诉用户：

> NapCat 已启动，请在 QQ 桥接面板的「连接」页，或 `http://127.0.0.1:6099` 扫码登录小号。
> 扫好后跟我说一声。

**停在这里等。** 不要自己点、不要假装完成了。

## 五、用户说扫好了之后，验证

```powershell
node cli.mjs status                  # 看 OneBot 是否可达、账号是否对上
node checks/check-patches.mjs        # 本地补丁在不在
node checks/check-persona.mjs        # 两套人设
node checks/check-behavior.mjs       # 运行时有没有退化
node cli.mjs check                   # 仓库门禁
```

全绿还不够，再确认业务链路：

```powershell
# 让用户在 QQ 私聊发一句，比如「在吗」
Get-Content "$env:USERPROFILE\.dsh\im-bridge\bridge.log" -Tail 20
```

看到 `admitted prompt for private:<QQ号>` 就说明消息进来了。

## 六、告诉用户完成了什么

总结要说清：

```
已完成：插件 + 补丁 + 配置 + 人设 + 语音依赖
需要你确认：小号余额是不是只 30 元
日常启动：双击 tools\一键启动肥鱼.bat
出问题看：docs/16-one-command.md 第七节
```

## 七、出错了怎么查

| 现象 | 去哪看 |
|---|---|
| 消息没人回 | `bridge.log` 有没有 `denied` / 白名单对不对 |
| 回「这边出错了」 | `bridge.log` 搜 `prompt failed` |
| 语音没声音 | `bridge.log` 搜 `voice failed`；配置在 `settings.json` 的 `voice` |
| 群聊不理人 | 群里要 @，或配置了 `groupWake` 概率唤醒 |
| NapCat 连不上 | 6700/6701 端口在不在；`napcat.quick.bat` 启动没 |
| 补丁丢了 | `node checks/check-patches.mjs` 会指出是哪一条 |

详细排查见 [docs/16](docs/16-one-command.md)、[docs/12](docs/12-bridge-patches.md)、[docs/17](docs/17-voice.md)。

## 八、绝对不要做

- 不要用仓库里示例的 QQ 号（`config/defaults.json` 里是空的，别自己编）
- 不要跳过扫码然后说「装好了」
- 不要为了让它更快而删掉 `patches/` 里的补丁
- 不要把 `vendor/` 提交进 git（它 21MB 且自带 .git）
- 不要在没有用户确认时改人设文案

## 九、常用命令速查

```powershell
node tools/setup.mjs --dry-run                     # 看要做什么
node tools/setup.mjs --qq 123 --group 456          # 安装
node cli.mjs status                                # 环境 + 桥接状态
node cli.mjs check                                 # 仓库门禁
node checks/check-patches.mjs                      # 补丁是否还在
node checks/check-behavior.mjs                     # 运行时是否健康
node checks/check-persona.mjs                      # 人设文件
node checks/check-browser.mjs                      # 浏览器能力
```