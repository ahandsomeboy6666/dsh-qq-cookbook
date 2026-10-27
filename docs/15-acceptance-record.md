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

---

## 2026-10-27 22:40 · 语音 + 人设（第二轮）

### 环境增量

| 项 | 值 |
|---|---|
| 语音引擎 | `minimax`（克隆音色 `c4clone001`） |
| Python | DSH 内置 3.12.14（`resources/runtime/primary-runtime/dependencies/python`） |
| edge-tts | 装在 `~/.dsh/im-bridge/pylib`（备用引擎） |
| 群聊人设 | 贴吧毒舌风（阴阳怪气，不含脏话） |

### 验收

| 项 | 命令 | 结果 |
|---|---|---|
| 仓库门禁 | `node cli.mjs check` | ✅ PASS 75 / FAIL 0 |
| 本地补丁 | `node checks/check-patches.mjs` | ✅ 11/11（新增 P6/P7） |
| 人设 | `node checks/check-persona.mjs` | ✅ 309 / 397 字 |
| 额度 | `node checks/check-budget.mjs` | ✅ 8 项 OK，人设无额度条款 |
| 浏览器 | `node checks/check-browser.mjs` | ✅ 命中 playwright |
| 桥接 | `/im-bridge/status` | ✅ connected，preset `feiyu` |
| 语音配置 | `settings.voice` | ✅ engine=minimax，voiceId=`c4clone001`，key 126 字符，`lastError` 空 |
| MCP | 进程检查 | ✅ Playwright PID 运行中 |
| 一键恢复 | `node tools/setup.mjs --dry-run` | ✅ 全 SKIP（幂等），含语音步骤 |
| 行为回归 | `node checks/check-behavior.mjs` | ✅ 5 项 PASS（语音/提示/标签/连接/唤醒占比） |

### 行为证据（`bridge.log` 当日累计）

| 日志 | 次数 | 说明 |
|---|---|---|
| `wake: at` | 1 | @ 唤醒 |
| `wake: nickname` | 10 | 叫名字 |
| `wake: follow` | 38 | 跟随对话（多数在「窗口自我续命」修复前） |
| `wake: probability` | 1 | 概率唤醒 |
| `ambient: buffered` | 19 | 只记录不调模型 |
| `voice tag at head` | 4 | 语音标签在开头 |
| `voice tag moved to head` | 1 | 标签在段落中间，被纠正后发成语音 |
| `stripped unhandled` | 0 | 兜底未触发（说明都识别成功了） |
| `voice failed` | 2 | 均在修复前：情境判断非 JSON、克隆音色无权限 |

### 本轮修掉的问题

| 现象 | 根因 | 修复 |
|---|---|---|
| 发出 `[发送:QQ\|语音\|内容]` 原文 | 模型自创不存在的标签格式 | 归一化成 `[语音] 内容`（P6） |
| 语音退化成文字 | 情境判断返回非纯 JSON，解析抛错中断合成 | 从文本里抠 JSON 再解析（P7） |
| 段落中间的 `[语音:难过]` 没被识别 | 原逻辑只匹配开头 | 挪到开头 + 兜底剥离未消费标签 |
| 克隆音色报 `you don't have access to this voice_id` | `voiceId` 写成 `clonezh001`（不存在） | 改 `c4clone001`（`get_voice` 查得） |
| 群聊她追着所有人接话 | 跟随窗口被 follow 自我续命 | follow 不续期、窗口绑定对话人、表情包不接 |

### 遗留

| 项 | 性质 | 处理 |
|---|---|---|
| 每条语音多一次模型调用（情境判断） | 体验 | 可接受；嫌慢可关「情绪自动判断」 |
| 群聊 `wake: follow` 历史计数偏高 | 数据 | 修复前的累计，观察新日志即可 |
| 小号余额 30 元 | 人工 | 仍需本人确认 |

---

## 2026-10-27 23:15 · 陌生人可用性改造

### 改了什么

| 项 | 之前 | 现在 |
|---|---|---|
| QQ / 群号 | `config/defaults.json` 写死作者号 | 空，必须 `--qq` 或交互输入 |
| 首次运行 | 无交互 | 会问「你的 QQ 号」「要接的群号（可空）」 |
| NapCat | 只提示"自己下载" | 自动下 OneKey（1MB）；`--install-napcat` 跑官方安装器（300MB） |
| 会话绑定 | setup 不写 | 写 `private:<QQ>`、`group:<群>` |
| 语音配置 | 强制改 sweet | 已有引擎（MiniMax）不被覆盖，只补 Python 路径 |

### 实测（陌生人视角）

| 场景 | 结果 |
|---|---|
| 空 `DSH_HOME` | `[FAIL] DSH desktop profile ... 先启动一次 DSH 再重跑` |
| 不给 `--qq` | 非 dry-run 报错并给用法；dry-run 用占位号 |
| 全新 clone（无 vendor） | `[TODO] clone 插件` / `[TODO] NapCat 本体` / `[TODO] 绑定 1 个`，顺序正确 |
| 本机已配好 | 全 SKIP，幂等 |

### 仍然要人做的（不可自动化）

1. 装 DSH 桌面端并登录一次（UAC + 账号）
2. NapCat 扫码（登录态绑设备）
3. 小号只充 30 元

---

## 2026-10-27 23:25 · 给 AI 的安装手册

### 新增

`BOOTSTRAP.md`（仓库根目录）：写给被丢进仓库的 agent，九节：

| 节 | 内容 |
|---|---|
| 零 | 能做什么 / 不能做什么（扫码、充值、登录是硬边界） |
| 一 | 先问再动手：QQ 号、群号（禁止猜、禁用示例号） |
| 二 | 前置检查：Node ≥ 22、`profiles/desktop` 存在 |
| 三 | 跑 `setup.mjs --install-napcat`，并解释输出里的 OK/SKIP/TODO/FAIL |
| 四 | **停下等扫码**（明确写「停在这里等」） |
| 五 | 扫完后的验证：status / 4 个 checks / 日志确认 `admitted prompt` |
| 六 | 告诉用户完成了什么、余额要自己确认 |
| 七 | 六类常见错误的排查入口 |
| 八 | 绝对不要做的五件事 |
| 九 | 命令速查 |

README 顶部加入口：

> 把这个仓库丢给 AI 安装？让它先读 BOOTSTRAP.md。

### 验证

```powershell
node cli.mjs check   # PASS 75 / FAIL 0（本地链接、索引覆盖均通过）
```

### 边界声明

这份手册能保证「AI 照着做不会跑偏」，但不能让扫码变自动。手册里把这一步写成**必须停下等人的节点**，而不是含糊带过。

---

## 2026-10-27 23:58 · 群聊行为收紧 + 联网 + @昵称

### 本轮改动（7 个 commit）

| commit | 内容 |
|---|---|
| `8e64aae` | @别人时不插嘴 |
| `7610f71` | 昵称命中收窄（只认「像在叫她」） |
| `451bbba` | 关闭跟随窗口（话多主因） |
| `de81ffc` | 跟随窗口回到 30 秒 |
| `99fdfe5` + `9ae5edd` | 群聊联网：审批层不够，真正拦在 guard 层 |
| `eb2c669` | 人设加「被指出问题别演一整套」 |
| `4068ea1` | @别人还原昵称；`maxBubbles` 3 → 2 |

### 验收

| 项 | 命令 | 结果 |
|---|---|---|
| 仓库门禁 | `node cli.mjs check` | ✅ PASS 75 / FAIL 0 |
| 本地补丁 | `node checks/check-patches.mjs` | ✅ 16/16（P1–P12 + 4 项配置） |
| 行为回归 | `node checks/check-behavior.mjs` | ✅ 5/5，follow 占比 15% |
| 人设 | `node checks/check-persona.mjs` | ✅ 234 / 293 字 |

### 当前群聊参数

```json
{
  "groupWake": { "probability": 0.1, "followMinutes": 0.5, "nicknames": ["肥鱼","大肥鱼"] },
  "groupReplyAt": false,
  "maxBubbles": 2,
  "persona": "feiyu"
}
```

### 行为证据（近 2 小时）

| 日志 | 次数 |
|---|---|
| `wake: at` | 1 |
| `wake: nickname` | 14 |
| `wake: follow` | 42（多数在关闭窗口前） |
| `wake: probability` | 1 |
| `ambient: buffered` | 25 |
| `voice tag at head` | 6 |
| `group allowed read-only web tool` | 0（guard 放行不打日志） |
| `member name lookup failed` | 0 |

### 未验证 / 待观察

| 项 | 说明 |
|---|---|
| 群聊搜索 | 用户口头确认「搜索好了」（23:43 她引用了网上内容），但 guard 放行不留日志，无法用命令复验 |
| @昵称还原 | 改动后还没出现真实的 @别人 消息，未触发 |
| 「别演一整套」 | 人设已改，需真实群聊观察 |

### 遗留

| 项 | 性质 |
|---|---|
| 群聊人设仍是 `feiyu`（私聊版，含「爱我」） | 建议换回 `feiyu-group`，否则群里会说出不合群的话 |
| 长任务输出仍可能写成科普 | 人设只有「别演一整套」，未约束长度 |
| 画面感比喻（尾巴、窝）密度偏高 | 风格问题，暂不动 |

---

## 2026-10-28 00:40 · 启动脚本编码 + 配置复现

### 1. 双击 bat「没反应」——两个编码坑叠加

| 文件 | 问题 | 现象 |
|---|---|---|
| `tools/一键启动肥鱼.bat` | UTF-8 无 BOM，CMD 按 GBK 解析中文行 | 窗口闪退，什么都没执行 |
| `tools/start-feiyu.ps1` | 被编辑器保存后**丢了 BOM**，PowerShell 按 GBK 解码中文 | `Unexpected token '{'`，脚本根本没跑起来 |

修复：

- bat 改**纯 ASCII**，输出重定向到 `%TEMP%\feiyu-start.log` 再 `type` 出来
- ps1 重新以 **UTF-8 with BOM** 保存
- `Test-Port` 从 `Test-NetConnection`（每次 1–2 秒）换成 `TcpClient`（300ms）
- 等 NapCat 的循环加进度点

验收：

```powershell
powershell -File tools/start-feiyu.ps1   # 正常输出，probe ok connected
cmd /c "tools\一键启动肥鱼.bat"           # exit 0，生成日志
```

### 2. setup 补上面板参数（复现缺口）

之前 `maxBubbles=2` 只在面板手改过，`setup.mjs` 不知道，别人装会回到默认 3（刷屏）。

`config/defaults.json` 新增 `settings` 段：

```json
"settings": {
  "companion": { "maxBubbles": 2 },
  "memory": { "everyTurns": 40, "maxChars": 1200 },
  "proactiveCfg": { "startHour": 9, "endHour": 23, "maxPerDay": 3 }
}
```

写入规则：**只在首次安装**（`personae` 为空）时写；已配置的机器不覆盖。

### 3. 复制边界（用户确认）

| 会跟着仓库走 | 不会跟（也不该跟） |
|---|---|
| 12 处补丁、唤醒参数、人设文本、会话绑定、`maxBubbles`、语音依赖、MCP | QQ/群号、MiniMax Key 与克隆音色、记忆/表情包/会话、NapCat 登录态 |

### 验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 75 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 16/16 |
| 启动脚本 | ✅ 直接运行与 bat 双击均正常 |

### 教训

Windows 上带中文的 `.bat` / `.ps1` 是**编码雷区**：

- `.bat` 用纯 ASCII 最稳（cmd 的代码页行为和文件编码容易不一致）
- `.ps1` 必须 UTF-8 **with BOM**，否则 PowerShell 会按系统代码页解码
- 这两条已写进 [docs/16](16-one-command.md) 的排查表
