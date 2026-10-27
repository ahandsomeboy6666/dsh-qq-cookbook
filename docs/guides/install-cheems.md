# 安装 cheems（dsh-im-bridge）

> 目标：把 `cheems135/dsh-qq-bridge` 装进 DSH 桌面端，连上 NapCat，私聊/群聊能收发。
>
> 插件包名是 **`dsh-im-bridge`**（不是 `dsh-qq-bridge`，那是仓库名）。

## 前置（只有人能做的部分）

1. 装 NapCat，扫码登录 QQ 小号。
2. NapCat 里开启 **WebSocket 服务端**（默认端口 `6701`），记下 token（没设就留空）。
3. 确认 `ws://127.0.0.1:6701` 能被本机访问。

## 安装

> 桌面端 profile 由 Electron 独占，CLI 会报 `profile "desktop" is managed exclusively by the Electron application`。必须用**桌面端界面**安装。

1. 打开 DSH 桌面端 → **设置 → 插件 → 添加插件**
2. 填本地路径：`E:\workspace\dsh-qq-cookbook\vendor\dsh-im-bridge`（或 GitHub URL `https://github.com/cheems135/dsh-qq-bridge`）
3. 确认安装，然后**重启 DSH 桌面端**（插件与设置页只在启动时加载）。

## 配置

打开 **设置 → 插件 → QQ 桥接**，或直接改 `~/.dsh/profiles/desktop/settings.json` 里的 `im-bridge` 段：

| 字段 | 值 | 说明 |
|---|---|---|
| `wsUrl` | `ws://127.0.0.1:6701` | NapCat 的 WS 服务端，不是 HTTP |
| `accessToken` | NapCat 里设的 token | 没设就留空 |
| `allowUsers` | `["你的QQ号"]` | 留空 = 谁都不理 |
| `allowGroups` | `["群号"]` | 留空 = 不响应群 |
| `groupRequireAt` | `true` | 群里必须 @ |
| `agentPreset` | `whale` | 人设 preset |
| `presetRev` | 改人设后 +1 | 换新会话才生效 |
| `maxReplyChars` | `1500` | 超长拆条 |

## 人设

面板「角色与互动 → 人设」：

- 私聊：粘贴 [roles/肥鱼-私聊.md](../../roles/肥鱼-私聊.md) 的内容。
- 群聊：粘贴 [roles/肥鱼-群聊.md](../../roles/肥鱼-群聊.md) 的内容。
- 保存后把 `presetRev` +1，或在面板里点「换新会话」。

## 验证

```powershell
node checks/check-install.mjs        # 期望 desktop 已注册（dsh-im-bridge）
node checks/probe-onebot.mjs --json  # 期望 connected=true
node cli.mjs doctor                  # NapCat / 插件 都 PASS
```

人工：QQ 私聊小号发「ping」，30 秒内有回复；群里 @ 一句也能回。

## 排错

| 现象 | 先看 |
|---|---|
| 设置页没有「QQ 桥接」 | DSH 是否重启；`check-install` 是否 `installed=true` |
| 有面板但收不到消息 | `wsUrl` 是否填成了 HTTP 端口；NapCat 是否开了 WS 服务端 |
| 收到但不回 | `allowUsers` 是否含你的号；模型/凭据是否可用 |
| 群聊不回 | 是否 @；`allowGroups` 是否含该群；`groupRequireAt` |
| 人设不生效 | `presetRev` 是否 +1，或是否换了新会话 |
