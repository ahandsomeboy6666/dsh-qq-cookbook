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

补丁 4 新增的符号（重打时一并复制）：

- `normalizeGroupWake(value)`：解析 `groupWake` 配置
- `groupBuffers` / `groupFollowUntil` / `groupLastWake`：三个 Map
- `bufferGroupMessage(groupId, text, payload)`：未唤醒消息进缓冲（上限 `bufferSize`）
- `takeGroupContext(groupId)`：取出最近 `recentLimit` 条拼成 `[群里最近的消息] … [记录结束]`

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
      followMinutes: 5      # 唤醒后 5 分钟内继续接
      bufferSize: 200
      recentLimit: 8
      nicknames: ['肥鱼', '大肥鱼']
```

两个坑：

- `napcat.dir` 不配 → 插件按 `~/NapCat` 找启动器，看门狗报「找不到 NapCat 启动器」
- 目录里只有 `napcat.bat` / `napcat.quick.bat`，没有 `launcher.bat` → 必须显式给 `launcher`，否则自动恢复永远失败

## 三、数据侧（`~/.dsh/im-bridge/settings.json`，通过面板/API 写入）

| 项 | 值 | 说明 |
|---|---|---|
| `personae` | `feiyu`（私聊）、`feiyu-group`（群聊） | `preset` 必须是 `standard`，不能是 `whale` |
| `activePersonaId` | `feiyu` | 全局默认 |
| `contactProfiles['private:632207916'].personaId` | `feiyu` | 私聊绑定 |
| `contactProfiles['group:834195405'].personaId` | `feiyu-group` | 群聊绑定 |

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
