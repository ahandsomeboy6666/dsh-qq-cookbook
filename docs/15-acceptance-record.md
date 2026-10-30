# 验收记录

> 注意：本文件记录的是**本机实例**（具体 QQ 号、群号、端口、音色 ID），供追溯，**不是通用配置**。部署时请用 `config.example.json` 的占位符。

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

---

## 2026-10-28 00:35 · 搜索 402 → 改用 API key

### 现象

群聊里让她查实时信息，报：

```
DeepSeek API error (HTTP 402): Insufficient Balance
endpoint: https://api.deepseek.com/anthropic/v1/messages
```

但 DeepSeek 平台显示**余额 ¥17.86**，且 30 天消费 ¥474，账户正常。

### 排查

| 步骤 | 结果 |
|---|---|
| 核对账号 | 平台手机号 `173*****53` = DSH 登录手机号，**同一个账号** |
| 清点凭据 | `~/.dsh/.credentials.yaml` 里是 `deepseek-account-platform/*`（账号登录态） |
| API key 直调（不带工具） | **200** |
| API key 直调（带 `web_search` 工具） | **200**，返回 `server_tool_use: web_search` |

结论：**账号登录态 token 不能用于搜索端点**（会 402），API key 可以。余额没问题。

### 修复

`~/.dsh/profiles/desktop/cordis.patch.yml` 给搜索提供方配字面值 key：

```yaml
- id: web-search-deepseek
  name: '@deepseek-ai/dsh-web-search-deepseek'
  config:
    apiKey: 'sk-...'        # 只存本机，不入库
```

热重载后，DSH 内 `web_search` 返回真实结果，验证通过。

### 注意

- **key 只写在 `~/.dsh` 的本地配置里**，不进仓库、不进文档
- 插件文档说「账号 token 优先于 apiKey」，但实测配了 `apiKey` 后搜索恢复正常；说明该端点解析账号 token 失败时会回退到 key
- 平台上那条横幅写明：搜索按次收费将于 **2026-11-01** 开始，目前只计模型 token

---

## 2026-10-28 23:35 · 群聊体验第二轮（角色卡 + 节奏 + 等回答）

### 本轮改动（8 个 commit）

| commit | 内容 |
|---|---|
| `3389cc3` | 群聊卡从贴吧风改为「开朗活泼的小可爱」，参考 V2 卡 / PList / Ali:Chat |
| `a403c90` | 加「安慰三不」，并替换掉一个**教坏她的示例**（原示例在引导追问） |
| `e869a97` | 加「不评价自己说得对不对，也不声明自己是真心」 |
| `4dff1fa` | 加「口语化 + 反面句式」（不写「敲了两句」这类） |
| `8ebad5c` | （同日早前）群聊卡贴吧风 212 字版 |
| `8804f96` | 发话节奏按文本长度：每字 38ms，上限 2.4s |
| `36f7dcd` | 她问过问题后的「等回答」窗口（5 分钟），补丁 P13 |
| — | 群绑定从 `feiyu` 改回 `feiyu-group` |

### 角色卡演进

```
18 字  →  212 字（贴吧风）→  271 字（小可爱）→  332 字（+不评论自己）
       →  386 字（+口语化）
```

每加一条都对应一次真实问题：

| 规则 | 治的症状 |
|---|---|
| 安慰三不 | 「从拆电箱到调试……先喝口水」 |
| 不评论自己 | 「这次总算没跑偏」「不是顺嘴客气」 |
| 口语化 + 反面句 | 「敲了两句阴阳怪气的回复，写完自己都乐了」 |

### 验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 78 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 17/17（P1–P13 + 4 项配置） |
| `node checks/check-behavior.mjs` | ✅ 5/5，follow 占比 40%（≤60%） |
| 人设 | ✅ 私聊 234 字 / 群聊 386 字（面板） |
| 绑定 | ✅ `private→feiyu`、`group→feiyu-group` |

### 效果证据（用户实时反馈）

| 轮次 | 表现 | 判断 |
|---|---|---|
| 安慰豆豆 | 复述细节 + 给建议 | ❌ 改卡 |
| 二次安慰 | 一句认错 + 「我在旁边待着」 | ✅ 好转 |
| 「高冷大肥鱼」 | 又写澄清声明（盖标签、尾巴晃） | ❌ 书面腔 |
| 「你一点都不可爱」 | 自嘲 + 「嘴角是不是翘起来了」 | ✅ 最好的一次 |
| 「你在干嘛」 | 生活线连续（面吃一半 → 推开碗去洗澡）+ 看穿意图 | ✅ 满意 |

关键结论：**规则清掉默认路径后，她才有了"玩"的空间**。卡写得越细，发挥空间越小——所以后续只在反复犯同一错时才加规则。

### 未验证

| 项 | 说明 |
|---|---|
| 「冲完回来接着陪你聊」 | 她不会真的定时回来；要看 proactive / silence nudge 是否兑现 |
| 表情图语境 | 说「想你了」时抽到 DeepSeek 宣传图，语境不搭 |
| 等回答窗口 | P13 已生效但还没有真实触发样本 |

### 教学

**坏示例比没示例更糟。** 第一版角色卡里的示例「今天好累 → 诶？怎么啦。是活儿太多，还是人太烦」本身就在教她追问——用户吐槽的正是这个行为。写卡时示例必须先自查。

---

## 2026-10-28 23:50 · 唤醒判断补三轮（提到 / 呼叫 / 等回答）

### 三次真实漏接

| 用户发的 | 她的反应 | 漏在哪 |
|---|---|---|
| 「大肥鱼又不说话了」→「你能上网吗」 | 不接 | 后一句没称呼、没 @ |
| 「喂，肥鱼在嘛」 | 不接 | 只认「在吗」不认「在嘛」；「喂」无人处理 |
| 她问「是有事找我？」→ 吴睿森答一句 | 不接 | 等回答被「同一个人」条件卡死 |

### 三处改动

| # | 改动 |
|---|---|
| P15 | 入站消息提到昵称 → 记 `groupMentionedAt`（60 秒），期间问句算在问她 |
| P16 | 呼语加「在嘛」；问句正则加「嘛」；新增 `looksSummon`（≤8 字含喂/嘿/哎/诶/人呢/在吗） |
| P13 修 | `awaitingAnswer` 不再要求 `sameSpeaker`——她问的是群里所有人 |

### 模拟验证（8 句）

```
[无提到] 喂，肥鱼在嘛        =>  nickname
[无提到] 喂~肥鱼在嘛         =>  nickname
[刚提到] 你能上网吗          =>  mentioned
[刚提到] 喂                  =>  mentioned
[无提到] 喂                  =>  不接
[刚提到] 这肥鱼真有意思      =>  不接
[刚提到] 今天天气不错        =>  不接
```

### 验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 78 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 20/20（P1–P16 + 4 项配置） |
| `node checks/check-behavior.mjs` | ✅ 5/5，follow 占比 33% |
| 实际唤醒分布（近 1 小时） | mentioned 2 / follow 1 / buffered 6 |

### 观察

今晚一共调了 **6 次**唤醒判断，全部由真实漏接驱动：

```
at → nickname（收窄）→ atOthers（拦）→ mentioned（补）→ summon（补）→ awaitingAnswer（修）
```

这套是**场景覆盖**，不是统一模型——所以还会有新的漏接场景。

排查方法固定：看到没回 → 查 `bridge.log` 的 `ambient: buffered` → 对照哪条规则没过。

---

## 2026-10-29 23:55 · 模型兜底判断 + 安慰规则定稿

### 本轮改动（6 个 commit）

| commit | 内容 |
|---|---|
| `6062a6c` | 「等回答」识别不带问号的问句（吧/吗/嘛结尾） |
| `9ecc34f` | **P17：规则拿不准时让模型判断「是不是在跟她说话」** |
| `6fddd75` | **P18：以「你」开头的短句直接接**（模型会被上下文带偏） |
| `9968eba` | 安慰规则改成「跟着难受两句」 |
| `9462555` | 安慰提为独立小节，并给反例 |
| `d34b358` | 安慰禁评价本人（「你厉害」有歧义），改骂事情 |

### 架构变化：规则优先 + 模型兜底

```
① @她  ② 叫她名字  ③ @别人(拦)  ④ 纯图(拦)
⑤ 以「你」开头的短句            ← P18，零延迟
⑥ 刚被提到 + 问句/呼叫          ← P15/P16
⑦ 等她回答（含吧/吗/嘛结尾）     ← P13
⑧ 30 秒对话窗口  ⑨ 10% 概率
⑩ 以上都不中 → 调模型判断（40 tokens / 8 秒）  ← P17
```

### 实测（今晚唤醒分布）

| 触发 | 次数 |
|---|---|
| `nickname` | 4 |
| `follow` | 5 |
| `at` | 1 |
| `you` | 1 |
| `mentioned` | 1 |
| `model` | 1 |
| `buffered` | 5 |

intent 判断明细：

```
intent: to-me  <- 你咋不回我      ✅
intent: not-me <- 你在干嘛        ❌（被上一句「现在我没@你」带偏，已由 P18 兜住）
```

### 安慰规则：第 6 版才成

| 版本 | 她的典型回复 | 问题 |
|---|---|---|
| v1 | 从拆电箱到调试……先喝口水 | 复述 + 建议 |
| v2 | 别硬撑着，先把身子往椅背上放一放 | 祈使句指挥 |
| v3 | 熬到这个份上你厉害 | 「你厉害」被听成反讽 |
| **v4** | **啊~又是这个点，这公司真不拿人当人** | ✅ 跟着难受 + 骂事情 |

关键教训：**只写「不要什么」不够，要给正面形态**（短、碎、带语气词、跟着难受）。

### 验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 78 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 23/23（P1–P18 + 5 项配置） |
| `node checks/check-behavior.mjs` | ✅ 5/5，follow 33% |
| 人设 | 私聊 234 字 / 群聊 524 字（面板） |

### 成本

模型兜底只对边缘消息调用，一天约几十次 × 40 tokens ≈ 几千 tokens，可忽略。

### 遗留

| 项 | 说明 |
|---|---|
| 编造生活细节 | 「换了个新头像」是即兴编的，没有一致时间线，说两次会露馅 |
| 问句判断「吧」结尾 | 「行吧。」也会被判成在等回答，属可接受误判 |
| 私聊人设仍是 49 字 | 没有安慰规则、没有口语化约束 |

---

## 2026-10-30 00:20 · 看图能力 + 一次把 DSH 带崩的补丁

### 一、她本来就能看图，断在缓冲

官方文档确认 `deepseek-flash` 支持图片输入（每张 ≤1024 tokens），插件里也早有 `imagePart()`。断点在**群聊缓冲**：

```
群友发表情包（没叫她）
  → 进缓冲，只存文字
  → 文字是「[图片]」，图本身丢了
  → 你 @ 她时，payload 是文字消息，不含图
  → 她只能看到「[图片]」占位
```

两处修复：

| # | 改动 |
|---|---|
| P19 | `extractIncoming` 的映射表补 `image:'[图片]'`，不再兜底成空串 |
| P20 | 缓冲存图片 URL；唤醒时取最近 3 张挂 `payload._bridgeContextImages`，`buildContent` 转 image block |

### 二、验证记录

```
你：肥鱼你看到我发的图了吗
她：看到啦，是个趴着不动的小娃娃，底下一行字：姐妹们我活不久了。
她：……这不就是你现在嘛，别摆了，看着心疼。
```

三层都对：**识别画面 + 读出图内文字 + 结合「加班」上下文接梗**。

后续又发同一张：

```
她：第三回还是它。
她：我眼睛都好使了，换个新的来考我吧。
```

记住发过三次同一张图——不是"识别成功"，是"聊起来了"。

### 三、崩溃：一个 `.length` 干掉整个 DSH

**现象**：发图 → 她回复 → 用户再发一句 → DSH 弹出「应用意外停止」。

崩溃日志（`%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*.log`）：

```
TypeError: Cannot read properties of undefined (reading 'length')
    at handlePayloadCore (index.js:5061)
    at handlePayload (index.js:6036)
    at MiniWebSocket.onMessage (index.js:4534)
```

**根因链**：

```js
if (list.length === 0) return '';   // 空缓冲返回字符串
...
const taken = takeGroupContext(groupId);
taken.images.length                 // ''.images === undefined → 崩
```

触发序列正好是「发图 → 她回复（缓冲被清空）→ 再发一句」。

**三层修复**：

| # | 改动 | 作用 |
|---|---|---|
| P21 | 空缓冲返回 `{ text: '', images: [] }` | 统一返回形状 |
| P21 | 调用处做字符串/对象双兼容 | 热重载期间新旧混跑也不崩 |
| P22 | `handlePayloadCore` / `drainInbox` 的 fire-and-forget 加 `.catch` | **任何未捕获 rejection 只记日志，不再终止进程** |

P22 才是真正堵漏的：插件里 `return void handlePayloadCore(payload)` 既没 await 也没 catch，Node 24 默认会把未捕获 rejection 升级成进程终止——所以一个 `.length` 就能带走整个桌面端。

### 四、整轮验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 78 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 27/27（P1–P22 + 5 项配置） |
| `node checks/check-behavior.mjs` | ✅ 5/5，follow 43% |
| 人设 | 私聊 234 字 / 群聊 524 字（面板） |

### 五、今晚唤醒分布（23:14 之后）

| 触发 | 次数 |
|---|---|
| `nickname` | 8 |
| `follow` | 6 |
| `model`（模型兜底） | 3 |
| `mentioned` | 2 |
| `at` | 1 |
| `you` | 1 |
| `buffered` | 12 |
| `intent` 判断 | 5 |

七条唤醒路径全部有真实样本。

### 六、NapCat 掉线的真因

那次「重启后没反应」不是插件问题：

```
websocketClients: ws://127.0.0.1:6199/ws  enable=True   ← AstrBot 的旧端口
```

NapCat 一直尝试连这个死地址，刷错误把 OneBot 服务拖挂。关掉后 6700/6701 稳定监听。

### 遗留

| 项 | 说明 |
|---|---|
| 私聊人设 49 字 | 图能看、安慰规则没有 |
| 编造生活细节 | 「换了个新头像」是即兴编的 |
| 群聊图最多带 3 张 | 防 token 超支，超出的只看得到 `[图片]` |

---

## 2026-10-30 20:30 · 陌生人一键部署实测

### 测法

不看自己这台「已经配好」的机器，而是造一个陌生人的环境：

```
临时目录
  .dsh/profiles/desktop/   ← 只放一份 package.json（模拟 DSH 已登录）
  cookbook/                ← git clone 本仓库
DSH_HOME 指向临时目录，本机 ~/.dsh 完全不动
```

### 第一次跑：2 个 FAIL

| 步骤 | 结果 |
|---|---|
| clone 插件 | ✅ 03afb9c |
| 应用本地补丁 | ✅ 但报「5 处改动」（实际已 22+） |
| 下载 NapCat | ❌ `The operation was aborted due to timeout` |
| 写 cordis.patch.yml | ❌ `读不到 ...\cordis.patch.yml` |
| 写入人设 | SKIP（正常，要 DSH 先跑一次） |

耗时 101 秒。

### 修的三个 bug

| # | 现象 | 根因 | 改法 |
|---|---|---|---|
| 1 | 「5 处改动」 | 文案硬编码，从只有 5 处补丁时留下的 | 从补丁里数 `diff --git` 与 `@@` |
| 2 | cordis 写入直接 FAIL | 新机器上文件不存在，代码**只会读不会建** | 不存在就新建，输出标「（新建文件）」 |
| 3 | NapCat 下载全超时 | 每源只给 20 秒，1MB 的包不够 | 提到 60 秒，失败时报「试过 N 个源」 |

顺带：summary 加一句「重启 DSH 后**再跑一次**脚本」，因为人设要等插件初始化。

### 第二次跑：全过

```
[OK] clone 插件  03afb9c
[OK] 应用本地补丁  3 个文件 / 28 处改动
[OK] 下载 NapCat 安装包  971KB
[OK] 写 cordis.patch.yml  2 个条目（新建文件）
[SKIP] 写入人设  settings.json 不存在：先启动 DSH 让插件初始化，再重跑本脚本
```

耗时 **142 秒**（`--skip-mcp`，不装 300MB QQ）。

产物抽查全部正确：

| 检查 | 结果 |
|---|---|
| vendor/index.js 含 `groupIntentToMe` / `directYou` / `_bridgeContextImages` | ✅ |
| cordis 有 `im-bridge` + `mcp-browser` | ✅ |
| cordis 的 `allowGroups` 用的是传入的测试群号 | ✅ |
| NapCat 解压出 `NapCatInstaller.exe` | ✅ |

### 国内网络

GitHub 直连常超时，setup 现在会自动换镜像：

```
--mirror / GITHUB_MIRROR  →  直连  →  gh-proxy.com  →  ghfast.top  →  ghproxy.net
```

实测（2026-10-30）：

| 源 | 结果 |
|---|---|
| 直连 | 200（本机有代理） |
| gh-proxy.com | 200 |
| ghfast.top | 200 |
| ghproxy.net | **超时**（已降到列表最后） |

镜像 clone 上游插件实测成功（70 秒）。

### 整轮验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 78 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 27/27 |
| `node checks/check-behavior.mjs` | ✅ 5/5 |
| 补丁与工作区一致性 | ✅ `git apply --check --reverse` 通过 |
| 仓库 | 83 文件 / 18 篇文档 / 10 个检查脚本 / 14 张任务卡 |

### 结论

**「拉下来一键部署」是通的**，卡点都在预期内的人工步骤：

```
装 DSH → 扫码登录 → 小号充 30 元
```

第一次装会跑两遍（settings.json 要等插件初始化），这是 DSH 的初始化顺序，不是 bug。

---

## 2026-10-30 20:45 · 同事实测暴露的两个真问题

同事实跑了一遍，卡在两处。两处都不是代码 bug，是**我的概念没讲清 / 判断错了**。

### 一、把「主人号」当成「机器人小号」

他填的 `1241415554` 是主人号（白名单），但 BOOTSTRAP 只问一个 QQ 号，
agent 自然把它当成 NapCat 要扫码登录的号——差点用主号当机器人。

| 号 | 干什么 |
|---|---|
| 主人号 | 白名单，只有它能命令机器人 |
| 机器人小号 | NapCat 扫码登录，对外说话的身份 |

修复：BOOTSTRAP 第一节改成先给对照表，再问三个号；代码输出从「QQ / 群」改成「主人号 / 群」。

### 二、QQ 一启动就崩（0x80000003）

```
出错模块: QQNT.dll
异常代码: 0x80000003   ← int3，QQ 自检发现被篡改后主动退出
```

**根因：NapCat 只认自己目录里的 `QQ.exe`。**

`napcat.quick.bat` 最后一行写死：

```bat
NapCatWinBootMain.exe "%cd%\QQ.exe" ... -q <QQ号>
```

本机能跑，是因为 `tools/napcat/NapCat.52892.Shell/QQ.exe` 在（9.9.33.52230）；
他那边 QQ 落到了 `D:\Program Files`，目录里没有 → launcher 退到系统 QQ → 版本与 hook 对不上 → 崩。

### 判断错的三次（值得记）

| 版本 | 判断 | 结果 |
|---|---|---|
| v1 | 比较「系统 QQ 版本」vs「NapCat 版本」 | ❌ 误报：本机 9.9.19 闲置，实际跑的是目录里的 9.9.33 |
| v2 | 检查目录里有没有 `QQ.exe` | ✅ 对 |
| v3 | 缺了就**从系统 QQ 复制**进来 | ❌ 掩盖问题：拷进来的版本照样和 hook 对不上 |
| **v4** | 缺了就报 FAIL + 指引重跑 `--install-napcat` | ✅ 对 |

共同毛病：**每次都想「自动修好」，但修的是症状不是原因。**

两条原则是用户点出来的：
1. 仓库里不含 NapCat 是对的（1.37GB，GitHub 放不下，且含 QQ 本体）
2. **不能拿系统 QQ 去凑**——版本与 hook 对不上照样崩，还掩盖真问题

### 三、安装器退出码 0 不等于装对了地方

`NapCatInstaller.exe` 是 GUI，可能被改到别的路径。原来只看退出码，0 就报 OK。

现在装完再跑一次 `findNapcat()`：

```
找到   → [OK] 已部署到 tools/napcat/NapCat.xxxxx.Shell
没找到 → [FAIL] 装完了，但 <路径> 下还是找不到 NapCat（安装器可能装到了别的路径）
```

### 目录锁定

四个环节都锁在同一个目录，任何一环偏了都会被下一个抓住：

| 环节 | 目标 |
|---|---|
| 下载 zip | `tools/napcat/` |
| 解压 | `tools/napcat/` |
| 安装器 cwd | `tools/napcat/` |
| 装完验证 | `findNapcat()` 只搜 `tools/napcat/` |
| QQ 检查 | 只认 `tools/napcat/<版本>/QQ.exe` |

### 验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 78 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 27/27 |
| `node checks/check-behavior.mjs` | ✅ 5/5 |
| 补丁与工作区一致性 | ✅ 通过 |
| `setup.mjs --dry-run` | ✅ 13 个检查项，输出正确 |

---

## 2026-10-30 22:30 · NapCat 只装了一半（朋友实测）

朋友的部署卡了 40 分钟。他那边 QQ 能启动、hook 注入成功
（日志有 `preload succeeded` + `register done`），但 **6099/6700/6701 都不监听**，
`logs/` 是空的。

### 真因：目录里缺四个文件

他那个 `NapCat.52230.Shell` 只有 3 项：`versions/`、`msvcp140.dll`、`QQ.exe`。
我这边能跑的有 70+ 项。

| 文件 | 我这边 | 他那边 |
|---|---|---|
| `napcat.mjs` | ✅ 2.99MB | ❌ |
| `NapCatWinBootMain.exe` | ✅ | ❌ |
| `NapCatWinBootHook.dll` | ✅ | ❌ |
| `loadNapCat.js` | ✅ | ❌ |
| `QQ.exe` | ✅ 1.64MB | ✅ 1.63MB |

**hook 能注入是因为 QQ.exe 在；JS 主程序不在，所以没人去开端口。**

### 为什么会只装一半

NapCat 的发布包结构：

| 包 | 大小 | 是什么 |
|---|---|---|
| `NapCat.Shell.Windows.OneKey.zip` | **971KB** | **只是下载器** |
| `NapCat.Shell.zip` | **35MB** | 真正的 JS 层 |
| `NapCat.Shell.Windows.Node.zip` | 121MB | 带 Node 运行时 |

OneKey 运行时去下 35MB Shell + 1.2GB QQ。**他那边网络断了**（agent 自己写着
「GitHub / npm registry 全部 TLS 连不上」），35MB 那个失败，1.2GB 的下完了，
**而 OneKey 部分失败照样弹「完成」**。

### 他的 agent 走错的方向

它花了 30 分钟研究「QQ 9.9.33 会校验 `package.json` 的 sha256」，
还试着改 `package.json` 让 QQ 指向 NapCat loader → QQ 直接不启动。

**但 NapCat 根本不改 `package.json`**，它靠 `napcat.quick.bat` 里的五个环境变量注入：

```bat
set "NAPCAT_PATCH_PACKAGE=%cd%\qqnt.json"
set "NAPCAT_LOAD_PATH=%cd%\loadNapCat.js"
set "NAPCAT_INJECT_PATH=%cd%\NapCatWinBootHook.dll"
set "NAPCAT_LAUNCHER_PATH=%cd%\NapCatWinBootMain.exe"
set "NAPCAT_MAIN_PATH=%cd%\napcat.mjs"
"%NAPCAT_LAUNCHER_PATH%" "%cd%\QQ.exe" "%NAPCAT_INJECT_PATH%" -q <QQ号>
```

这些文件他一个都没有——所以改 `package.json` 是拿错工具修错东西。

### 修复：检查 + 自动补齐

| # | 改动 |
|---|---|
| 1 | `NAPCAT_REQUIRED` 五个文件，`findNapcat` 只认齐全的目录 |
| 2 | partial 检查提到 DRY 之前（否则 dry-run 只会说"去下载"，把真问题藏起来） |
| 3 | `repairNapcatShell`：自动下 35MB 的 `NapCat.Shell.zip` 解压进现有目录 |

隔离环境实测（只放 `QQ.exe` + `versions`）：

```
[FAIL] NapCat 本体  目录不完整，缺 napcat.mjs、NapCatWinBootMain.exe、...
[OK]   补全 NapCat  34.3MB 已解压，五个文件齐全     ← 10.9 秒
```

该 zip 不含 `QQ.exe`，解压不会覆盖宿主。

### 一个重要的环境事实

补包第一次失败，超时 180 秒。查下来是 **Node 的 `fetch` 不读系统代理**：

| 下载方式 | 速度 | 35MB 需要 |
|---|---|---|
| PowerShell（走系统代理 7890） | **1.6 MB/s** | **22 秒** |
| node fetch · gh-proxy | 70 KB/s | 8 分钟 |
| node fetch · 直连 | 7 KB/s | 80 分钟 |

所以补包改用 PowerShell 的 `Invoke-WebRequest`，镜像优先。
**这条对所有 GitHub 大文件下载都成立**——以后加下载逻辑要记住。

### 第三次「检查写了但不完整」

| 次数 | 检查了什么 | 漏了什么 | 后果 |
|---|---|---|---|
| 1 | 补丁文件存在 | 补丁是否最新 | 换机器打老补丁 |
| 2 | NapCat 目录存在 | 有没有 `QQ.exe` | 注入即崩 |
| 3 | 有 `napcat.bat` | 有没有 `napcat.mjs` 和 launcher | **hook 成功但端口不监听** |

共同点：**只验证"有没有东西"，不验证"能不能跑"。**
而且第 3 次修的时候，我第一版把检查放在 `DRY` 分支之后，dry-run 根本走不到——
**验证本身也需要被验证**。

### 验收

| 项 | 结果 |
|---|---|
| `node cli.mjs check` | ✅ PASS 81 / FAIL 0 |
| `node checks/check-patches.mjs` | ✅ 27/27 |
| `node checks/check-behavior.mjs` | ✅ 5/5 |
| 补丁与工作区一致性 | ✅ 通过 |
| 本机完整目录 | ✅ `[SKIP]` + `[OK] NapCat 自带 QQ 9.9.33.52230` |
| 隔离不完整目录 | ✅ 报缺 4 个文件，自动补 34.3MB 后齐全 |

### 给同样卡住的人的结论

```
不用装旧版 QQ
不用改 package.json
不用管 qqnt.json 的 verHash
更新仓库 → 重跑 node tools/setup.mjs → 它会自己补上缺的 35MB
```

### 入口加固：让 agent 先读手册

朋友那次暴露的不只是代码问题——**agent 从头到尾没读 `BOOTSTRAP.md`**。
它读的是 `AGENTS.md` + `setup.mjs`，而 `AGENTS.md` 里一个字都没提部署手册，
于是它自己摸索，走偏到 `package.json` 的 sha256 上。

两处加固：

| 位置 | 加什么 |
|---|---|
| `AGENTS.md` 第二节顶部 | 「要部署这个仓库？先读 BOOTSTRAP.md」+ 附上「有个 agent 花了 40 分钟」的具体教训 |
| `BOOTSTRAP.md` 排查表 | 新增一行：**NapCat 起来了但端口不监听 = 目录缺文件**，重跑 setup 自动补；明确写「不要改 `package.json`、不要换 QQ 版本、不要装旧版 QQ」 |

为什么写在 `AGENTS.md`：那是 agent 开工前必读的文件，把指引放在它真正会看的地方，而不是
指望它主动去找一份没被引用的文档。

## 2026-10-30/31 · 语音（本地 Breeze）验收

### 环境

| 组件 | 版本 / 值 |
|---|---|
| GPU | AMD Radeon RX 9070 XT（Vulkan，fp16/bf16 + KHR_coopmat） |
| 运行时 | audio.cpp v0.9.3（windows-x64-vulkan） |
| TTS 模型 | Breeze-TTS-2 q8_0（5.08 GB，audio-cpp 官方 GGUF） |
| ASR | Fun-ASR-Nano 2512 q8_0（1 GB，用于参考文本） |
| 服务 | audiocpp_server :8080 + gateway :8090 |

### 验收

| 项 | 结果 | 证据 |
|---|---|---|
| 静态门禁 | ✅ | `node cli.mjs check` → 2/2 |
| 全量 | ✅ | `node cli.mjs all` → 8/8 |
| OneBot | ✅ | `probe-onebot` → connected, selfId 3866560965 |
| 语音链路 | ✅ | cheems `engine=custom` → 网关 → Breeze，`ok:true` |
| 克隆相似度 | ✅ | 质心 1571 vs 原声 1353；语速 2.27 vs 2.38 |
| 情绪起伏 | ✅ | instruct 后音高波动 43.1 Hz（原声 58.1） |

### 遗留

- 音高波动仍未完全还原（43 vs 58），可换更长参考音频。
- 群聊语音未实测。
- 参考音频 `ref-c4.wav` 在 `audio.cpp` 根目录，建议移到 `voices/`。