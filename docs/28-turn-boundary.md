# 本轮改造交付（回合边界 / 输入缩减 / 出站保护）

> 2026-11-14。目标：降低对话负担——可以连发短句、随时插话或收尾、不接下一句也不出事。

## 一、改前基线（可重建）

| 项 | 值 |
|---|---|
| 实际加载路径 | `~/.dsh/profiles/desktop/node_modules/dsh-im-bridge` → Junction → `vendor/dsh-im-bridge` |
| 版本 | `dsh-im-bridge@1.19.0`，上游 `03afb9c` |
| 改前快照 | `snapshots/dsh-im-bridge-before-turnbound/`（207 文件） |
| 改前 diff | `patches/local-before-turnbound-20261114.patch`（1342 行） |
| 改后 diff | `patches/local-after-turnbound-20261114.patch`（1391 行） |
| 历史数据统计 | `checks/replay-baseline.txt` |

改前历史里：236 段对话中 167 段发送 0 条（71%），取消全部是「出站审计拦截内部注入/本机路径」。

## 二、离线回放（不碰真 QQ）

回放用**独立端口 + 临时数据目录 + 假账号**，不需要停真 NapCat，也不读写真实会话。

```powershell
# 合并链路回归（16801 号测试接口，假 QQ 只收一条固定回复）
node checks\replay\merge-offline.mjs

# 插件可加载（默认验证仓库里的 vendor；可加 --plugin <目录> 指向重建出来的那份）
node checks\replay\load-check.mjs

# 补丁迁移的五个场景（自带临时目录，不受 NapCat 下载影响）
node checks\replay\patch-upgrade.mjs
```

- `checks/replay/fake-napcat.mjs`：手写最小 WebSocket 服务端，监听测试端口（16701–16705），桥接发出的所有消息落在内存 `state.sent`，**不会到达 QQ**。
- `checks/replay/merge-offline.mjs`：在独立进程里 apply 插件，注入两条消息，断言「只提交一次、正文含两条且顺序正确、假 QQ 恰好收到一条固定回复」。
- `checks/replay/patch-upgrade.mjs`：干净安装 / 旧版升级 / 重跑幂等 / 有改动拒绝 / 补丁损坏回滚，断言真实退出码与文件状态。
- 本机另有写真实数据目录的旧回放脚本（`run.mjs` 等），**没有纳入发布**，只在本地用于端到端体验验收。

## 三、改前 / 改后结果

| case | 改前 | 改后 |
|---|---|---|
| 心累 → 不知道干啥 | 回合1 泡1 PASS | 回合1 泡1 PASS |
| asas | 回合1 **泡4** FAIL | 回合1 泡1 PASS |
| 收尾后「嗯」 | 回合2 **泡7** FAIL | 回合2 泡2 PASS |
| 你在干嘛呢 | 回合1 泡2 FAIL | 回合1 泡1 PASS |
| 生成中插话 | 回合1 泡2 FAIL | 回合1 泡1 PASS |
| 别问了 | 回合1 泡2 FAIL | 回合1 泡1 PASS |
| 我不想聊了 | 回合1 泡2 FAIL | 回合1 泡1 PASS |
| 不是这个… | 回合1 泡2 FAIL | 回合1 泡1 PASS |
| 长回答（213 字） | 回合1 泡2 PASS | 回合1 泡1 PASS（完整送达） |

**总计：改前 2/9 → 改后 10/10**

- 出站泄漏：改前 5 处（工具说明正文、`Elapsed since the preceding model-visible message`、`user（内部背景…`）→ **改后 0 处**
- 首条延迟均值：5.3s → 4.5s

### 插话的触发方式（2026-11-14 晚修正）

不用固定延时，等**数据信号**：`features.json` 里出现新 audit（= 这批消息已进入回合、模型在生成），
再等 500ms 让 prompt 真正提交，然后注入新消息。

> 日志信号不可靠：`turn/start` 在 DSH 里不产生；日志是流式写，实时读会受缓冲影响，两次都漏捕。

断言方式：旧回合回复里含夹具标记词「苹果香蕉」，插话后断言发送内容中**不出现**该词，
同时断言新回合正常回复。

### 已知瑕疵（本轮未修）

1. 「收尾后嗯」偶尔多出一条孤立的 `.`（分条残留），还没根治。
2. 「你在干嘛呢」回答完会把旧话题拉回来（"你不是刚说睡"）——机制合格，措辞未达减负目标。


## 四、改了什么

| # | 改动 | 位置 |
|---|---|---|
| 1 | 新消息入站即 `supersedingVersion = inboundVersion`；合并窗口内多条用批次最后一条的版本提交，不会互相取消 | `index.js` 入站段 |
| 2 | 普通私聊 `maxBubbles: 2 → 1`；`afterthought.enabled: false`（关随机补话） | `settings.json` |
| 3 | 新增 `stop-topic` 意图（“别问了”只停追问、不暂停主动）；`closing` 补口语（“那我先睡了”“我不想聊了”）；`support` 补“心累/好累/累了”，改成“一句短的接住，别展开” | `conversation-care.js` |
| 4 | `operationContextHint` 只在命中工具/操作意图时注入，日常文字不再拼 8 条 JSON | `index.js` `enrichConversation` |
| 5 | 出站泄漏特征补 6 条 | `index.js` `RULE_LEAK_LINES` |
| 6 | 剥除超过 60% 视为边界不明，整段丢弃并记 `[leak-drop]` | `index.js` `flushOutbox` |
| 7 | 人设删掉“他一来先分享一件事再问他”的固定动作 | `settings.json` + `roles/` |

## 五、回退

```powershell
# 方案 A：整目录回滚（最快）
Copy-Item snapshots\dsh-im-bridge-before-turnbound\* vendor\dsh-im-bridge\ -Recurse -Force

# 方案 B：按文件回滚（本轮所有 .bak-turnbound-* / .bak-intent-* / .bak-leakdrop-* 都在 vendor 里）
Copy-Item vendor\dsh-im-bridge\index.js.bak-turnbound-<时间> vendor\dsh-im-bridge\index.js
```

settings 的备份：`~/.dsh/im-bridge/settings.json.bak-turnbound-<时间>`。
回滚后要重启 DSH 才生效（改文件不会热重载——日志里只有 `plugin disposed` / `apply` 时才真正换代码）。

## 六、没验证的地方（如实标注）

1. **语气没有自动化**：回放只测回合数、发送条数、取消行为。像不像人由你读实际对话判断。
2. **没有用真实 QQ 验证**：所有结论来自假 NapCat 回放。真实号上的表现（尤其延迟、合并窗口手感）需要你亲自聊。
3. **回放污染**：回放用真实私聊 key（`private:<你的QQ号>`），那 9 段测试对话进了她的真实历史与记忆，会影响之后接话的上下文。想清掉可以删 `~/.dsh/im-bridge/messages.json` 里最近若干条，但会连带丢真实记录。
4. **`BUILD_TAG` 没更新**（仍是 `leak-strip-2026-11-08`），所以 `bridge.log` 的 apply 行看不出这一轮版本。要辨认只能看 `plugin disposed` 的时间点。
5. **生图/语音/群聊未纳入验证**：只确认共享发送路径（`sendSegments` → `queueOutgoing` → `flushOutbox`）未被改坏——`flushOutbox` 的改动只对 text 段生效，图片/语音段原样透传。
