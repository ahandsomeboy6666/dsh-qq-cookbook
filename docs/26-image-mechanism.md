# 26. 生图机制（私聊 / 群聊双轨）

> **定位**：本文只讲**机制**（怎么接、怎么发、怎么防泄漏），不含任何模型文件或本地部署步骤。
> 模型选型见 [23-local-ai-selection.md](23-local-ai-selection.md)，工作流参数见 `ComfyUI/models/loras/README.md`。

## 1. 总览

```
QQ 消息
  ↓
NapCat（OneBot）
  ↓
DSH 桥接（cheems）
  ↓
DSH 会话（模型 + 工具）
  ↓
comfyui_workflow（生成）
  ↓
ComfyUI/output/*.png
  ↓
[群聊] auto-send-image.cjs（独立脚本）→ NapCat HTTP API → 群
[私聊] 桥接直接发送（owner 有 read 权限）
```

## 2. 私聊 vs 群聊的能力差异

| 能力 | 私聊 | 群聊 |
|---|---|---|
| web_search / web_fetch | ✅ | ✅ |
| comfyui_workflow / comfyui_run（生图） | ✅ | ✅（需加白名单） |
| read（读本地文件） | ✅（owner） | ❌（DSH 侧不给） |
| 发图 | ✅ 桥接读文件后发 | ⚠️ 需外部脚本代发 |

**结论**：群聊里她**没有**读取本地文件的工具，所以图虽然生成了、却拿不到；
群聊发图只能由外部（脚本）代发。

## 3. 群聊工具白名单（桥接改动）

`vendor/dsh-im-bridge/index.js`：

```js
// 群聊 guard：只放行这几类工具
if (/^(web_search|web_fetch|websearch|webfetch|comfyui_workflow|comfyui_run)$/i.test(toolName)) return undefined;
// 其他一律拒绝
```

同时 `approval/request` 里的群聊放行名单要一起加，否则生图会被审批环节拒。

## 4. 双轨工作流与命名约定

| 场景 | 工作流 | 输出前缀 |
|---|---|---|
| 私聊（默认） | MOSS 鲸鱼娘（年轻·默认） | `feiyu-whalegirl` |
| 群聊 | MOSS 鲸鱼娘（群聊专用） | `feiyu-group-<群号>` |

**图名自带群号**（如 `feiyu-group-834195405_00012_.png`），脚本据此判断发往哪个群。

## 5. 群聊发图脚本（tools/auto-send-image.cjs）

```
每 4 秒扫 ComfyUI/output
  → 匹配 ^feiyu-group-<群号>
  → 未发过（.sent-images.json 去重）
  → 未在发送中（processing 锁，防并发重复）
  → NapCat HTTP API：POST http://127.0.0.1:6700/send_group_msg
  → 成功则记入已发
```

关键细节：

| 点 | 说明 |
|---|---|
| 去重文件 | `tools/.sent-images.json` |
| 处理锁 | `processing` Set，防止同图发两次 |
| 并发保护 | `scanning` 标志，防 scan 重叠 |
| 历史跳过 | 启动时把 5 分钟前的图标记为已发，避免一启动刷屏 |
| 只发一个群 | `GROUP_ID` 参数（默认 834195405） |

## 6. 内部提示泄漏的防护

背景提示（群聊说话者、附件提示、记忆、时间等）是拼进 **user content** 的，模型有概率把它们复述出去。

两层防护：

| 层 | 做法 |
|---|---|
| 声明 | content 最前面加「【】内是系统后台信息，不要复述」 |
| **发送前过滤** | `sendSegments` / `queueOutgoing` 里正则删除【】段落，日志 `[leak-filter] stripped N chars` |

过滤覆盖的段落名：

```
本轮群聊说话者 / 已收到可供识别的图片附件 / 本轮自主分享 /
角色模拟生活回忆 / 当前角色与桥接能力 / 当前对话表达偏好
```

变体句式可能漏，需按实际泄漏补正则。

## 7. 部署检查清单

| 项 | 检查 |
|---|---|
| 群聊工具白名单 | guard + approval 两处都加了 comfyui |
| 群专用工作流 | 前缀带群号 |
| 脚本运行 | `node tools/auto-send-image.cjs <群号>` |
| 去重文件 | `.sent-images.json` 存在且能写 |
| 过滤生效 | 日志出现 `[leak-filter]` |

## 8. 已知限制

| 限制 | 说明 |
|---|---|
| 群聊不能读文件 | DSH 权限模型决定（安全设计），改不动 |
| 脚本只发一个群 | 多群需多实例或改前缀映射 |
| 过滤是正则 | 完全不带【】的复述拦不住（只能靠声明） |
| 私聊画图 | 若用群前缀也会被脚本发群；私聊请用私聊工作流 |
