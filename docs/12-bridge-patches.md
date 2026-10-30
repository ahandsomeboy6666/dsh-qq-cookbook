# 桥接本地补丁清单

> 状态：**已生效**（2026-10-27）。对应插件版本 `dsh-im-bridge@1.19.0`（`vendor/dsh-im-bridge`，本地 git 仓库 `03afb9c`）。

## 为什么要有这篇

`vendor/dsh-im-bridge/` 在 `.gitignore` 里（11MB 本地安装，不进主仓库），它是**本地 fork**：
主仓库 clone 下来拿不到这些改动，插件升级一次就全丢。

本文是这些补丁的**唯一说明书**。升级后照第 5 节重打，或跑第 4 节的检查脚本确认还在不在。

## 一、代码补丁（`vendor/dsh-im-bridge/index.js`）

| # | 位置（搜关键字） | 症状 | 改法 |
|---|---|---|---|
| 1 | `extractIncoming(payload.message, selfId).text` 之后 | 群里只 @ 不说话 → 插件静默丢弃，连日志都没有 | 空文本且 `mentionsSelf` 为真时，补 `'（只 @ 了你，没说话）'` 再进模型 |
| 2 | `request.agentPreset = persona.preset` | 群消息报 `Unknown agent preset: whale` → 回「（这边出错了）」 | 跳过 `whale`（它是内置角色 id，不是 DSH preset） |
| 3 | `create({cwd, agentPreset:'whale'})`（学习检索会话） | 学习/检索建会话失败 | 改成 `'standard'` |
| 4 | `if (cfg.groupRequireAt && !mentionsSelf(...)) return` | 群里只有 @ 才回，像客服 | 换成唤醒层：@/昵称/跟随窗口/概率，其余进缓冲不调模型 |
| 5 | `if (chat.kind === 'group' && chat.userId) segments.push({type:'at'...})` | 每条群回复都带 `@某人`，很假 | 加开关 `groupReplyAt`（默认 false），并剥掉模型自己写的 `@昵称 ` |
| 6 | `const voiceMark=chunk.match(...)` 之前 | 模型自创 `[发送:QQ\|语音\|内容]`，标签原样发给用户 | 归一化成 `[语音] 内容`；`[语音]` 不在开头就挪到开头；burstSegments 兜底剥离未消费标签 |
| 7 | `parseOperationReview`（`operation-context.js`） | 模型返回非纯 JSON → 语音合成中断，退化成文字 | 整体解析失败时从文本里抠第一个 `{...}` 再试 |
| 8 | 群唤醒判断 `if (atMe) ... else if (nickHit)` | 你 @ 别人说话，她也插嘴 | 加 `atOthers`：@ 了别人（含 @全体）就不唤醒 |
| 9 | 同上，`nickHit` 的判定 | 句子里出现「肥鱼」就接（「本地肥鱼接入qq」也接） | 只认「像在叫她」：句首称呼，或紧跟「在吗/在不在/你说」 |
| 10 | `ctx.on('approval/request')` | 群聊所有工具审批一律 rejected | 群聊只放行 `web_search` / `web_fetch` |
| 11 | `installAgentContext` 的 `tools.guard` | 真凶：`ownerToolDenial` 对 `kind !== 'private'` 直接返回「没有全局操作权限」，模型连调用机会都没有 | 群聊注册专用 guard：放行只读联网，其余仍拒 |
| 12 | text 计算之后（群分支内） | `@别人` 只有 QQ 号，她只能反问「@1619919517 是谁」 | `resolveMemberName` 查 `get_group_member_info`，换成群名片/昵称，缓存 6 小时 |
| 13 | `const followed = sameSpeaker &&` | 她问「你呢」你三分钟后答，消息进 buffered 不接 | 她最后一条是问句 → `groupAwaitingAnswer` 记 5 分钟；**不限定同一人**（她问的是群里所有人） |
| 14 | `const pause = 600 + Math.random() * 2200` | 条间延迟与长短无关：短句等 2 秒、长段 0.6 秒 | 按上一条字数算打字时间：每字 38ms，上限 2.4s，加 0.45s 思考 |
| 15 | 唤醒判断 `nickHit` 之后 | 「大肥鱼又不说话了」→「你能上网吗」，后一句没称呼，不接 | 入站消息提到昵称记 `groupMentionedAt`（60 秒），期间问句算在问她 |
| 16 | 同上 | 「喂，肥鱼在嘛」整句不命中：只认「在吗」、问句正则没有「嘛」、短呼叫无人处理 | 呼语加「在嘛」；问句正则加「嘛」；新增 `looksSummon`（≤8 字含喂/嘿/哎/诶/人呢/在吗） |
| 17 | 唤醒判断末尾（`reason === ''` 后） | 规则全不命中时永远不接：隔一会儿再说一句就断 | 新增 `groupIntentToMe`：边缘消息调一次小模型（40 tokens、8 秒超时）判断「是不是在跟她说话」；失败当否 |
| 18 | 唤醒判断 `atOthers` 之后 | 「你在干嘛」被模型判成 not-me（被上一句「现在我没@你」带偏） | 加 `directYou`：以「你」开头（排除「你们」）且 ≤12 字直接接，不问模型 |
| 19 | `extractIncoming` 的类型映射表 | 群友发表情包，她只看到「（没说话）」，图完全不存在 | 映射表补 `image:'[图片]'`；`onlyImage` 改成剥掉 `[图片]` 后为空才算纯图 |
| 20 | `takeGroupContext` / `bufferGroupMessage` | 图在缓冲里丢了，唤醒时她不知道有人发过图 | 缓冲时存图片 URL；唤醒时取最近 3 张挂 `payload._bridgeContextImages`，`buildContent` 末尾转 image block |
| 21 | `takeGroupContext` 的空缓冲分支 | **空缓冲时 `return ''`（字符串）**，新代码读 `.images.length` → `undefined.length` → **整个 DSH 主进程崩溃** | 统一返回 `{ text: '', images: [] }`；调用处再做字符串/对象双兼容 |
| 22 | `handlePayload` / `drainInbox` | 插件任何 `await` 抛错都变成未捕获 rejection，Node 24 直接终止进程 | fire-and-forget 调用全部加 `.catch()`，只记日志不终止进程 |

补丁 4 新增的符号（重打时一并复制）：

- `normalizeGroupWake(value)`：解析 `groupWake` 配置
- `groupBuffers` / `groupFollowUntil` / `groupLastWake` / `groupWakeSender`：四个 Map
- `bufferGroupMessage(groupId, text, payload)`：未唤醒消息进缓冲（上限 `bufferSize`）
- `takeGroupContext(groupId)`：取出最近 `recentLimit` 条拼成 `[群里最近的消息] … [记录结束]`
- `resolveMemberName(groupId, qq)`（补丁 12）：群成员昵称缓存

## 二、配置（`~/.dsh/profiles/desktop/cordis.patch.yml`）

```yaml
- id: im-bridge
  config:
    napcat:
      dir: 'E:/workspace/dsh-qq-cookbook/tools/napcat/NapCat.52892.Shell'
      launcher: 'E:/.../launcher-user.bat'   # 走无 UAC 的 cmd 分支
    groupReplyAt: true      # 省略 = false（群回复不 @ 人）
    groupWake:
      enabled: true
      probability: 0.1      # 未 @ 时的唤醒概率
      followMinutes: 0.5    # 跟随窗口，单位分钟；0.5 = 30 秒，0 = 关闭
      bufferSize: 200
      recentLimit: 8
      nicknames: ['肥鱼', '大肥鱼']
```

> **`followMinutes` 默认 0.5（30 秒）**。非 0 时，她开口后这段时间内「同一个人」继续发消息都会唤醒她。
> 5 分钟那种长窗口等于「你连发三句她接三句」，是话多最主要的来源；0 则完全跟不上追问。
> 30 秒只覆盖「她回完你马上接一句」的节奏；觉得还吵就调 0，觉得跟不上就调 1。

两个坑：

- `napcat.dir` 不配 → 插件按 `~/NapCat` 找启动器，看门狗报「找不到 NapCat 启动器」
- 目录里只有 `napcat.bat` / `napcat.quick.bat`，没有 `launcher.bat` → 必须显式给 `launcher`，否则自动恢复永远失败

## 三、数据侧（`~/.dsh/im-bridge/settings.json`，通过面板/API 写入）

| 项 | 值 | 说明 |
|---|---|---|
| `personae` | `feiyu`（私聊）、`feiyu-group`（群聊） | `preset` 必须是 `standard`，不能是 `whale` |
| `activePersonaId` | `feiyu` | 全局默认 |
| `contactProfiles['private:<你的QQ号>'].personaId` | `feiyu` | 私聊绑定 |
| `contactProfiles['group:<群号>'].personaId` | `feiyu-group` | 群聊绑定 |

人设文本与 [roles/](../roles/) 下两个文件保持一致；改面板要同步文件，反之亦然。

## 四、怎么确认补丁还在

```powershell
node checks/check-patches.mjs
```

- `vendor/` 不存在（CI、别人 clone）→ 输出 SKIP，不判失败
- 任何一处补丁缺失 → 退出码 1，并指出是哪一条
- 同时校验 `cordis.patch.yml`：`groupWake` 是否存在、概率是否在 (0,1]、`napcat.dir` 是否指向真实目录

## 五、插件升级后怎么重打

1. `git -C vendor/dsh-im-bridge log --oneline -3` 记下升级前后的 commit
2. `node checks/check-patches.mjs` 看丢了哪几条
3. 按第 1 节的关键字搜到位置，照改法重新应用
4. `node --check vendor/dsh-im-bridge/index.js`
5. 碰一下 `cordis.patch.yml`（改一行注释即可）触发热重载
6. 跑一遍验收（第 6 节）

## 六、验收命令

```powershell
node checks/check-patches.mjs                    # 五处代码补丁 + 唤醒配置
node --check vendor/dsh-im-bridge/index.js       # 语法
node checks/check-persona.mjs                    # 两套人设与文件一致
node cli.mjs check                               # 仓库门禁全绿
```

行为侧（人工，看 `~/.dsh/im-bridge/bridge.log`）：

| 场景 | 期望日志 |
|---|---|
| 群里 @ 她 | `wake: at` |
| 群里提「肥鱼」但不 @ | `wake: nickname` |
| 她刚说完，继续聊 | `wake: follow` |
| 什么都没命中 | `ambient: buffered N` |
| 群回复正文 | 不带 `@` 前缀 |

## 不做什么

- 不改插件上游仓库（`cheems135/dsh-qq-bridge`），只在本地 fork 上打补丁
- 不把 `vendor/` 提交进主仓库（体积；且它自己带 `.git`）
- 不为了「像人」引入逐字流式（QQ 消息不能编辑，会变刷屏）
