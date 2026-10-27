# 任务 D1：安装 cheems 并打通回环

## 目标

cheems 插件加载，QQ 私聊发消息能收到回复。

## 输入

- D0 的探针结果
- cheems135/dsh-qq-bridge 仓库（包名 `dsh-im-bridge`）
- NapCat 的 WS 地址与 token
- [当前方案](../docs/10-current-plan.md) 与 [安装指南](../docs/guides/install-cheems.md)

## 输出

- 桌面端「设置 → 插件 → 添加插件」填 `E:\workspace\dsh-qq-cookbook\vendor\dsh-im-bridge`
- 设置页出现「QQ 桥接」
- `~/.dsh/profiles/desktop/settings.json` 的 `im-bridge` 段填好 `wsUrl` / `accessToken` / `allowUsers` / `allowGroups`

## 验收

- [ ] `node checks/check-install.mjs --json` → `installed=true`
- [ ] `node checks/probe-onebot.mjs --json` → `connected=true`
- [ ] `node cli.mjs doctor` → NapCat 与插件都 PASS
- [ ] `node checks/check-assets.mjs` → 全绿

## 人工验收

- QQ 私聊小号发「ping」，30 秒内收到回复。
- 设置页能看到连接状态、人设、白名单。
- 群聊 @ 小号发一句，收到回复。

## 不做什么

- 不写人设（D2）。
- 不配浏览器与零花钱（D3）。
- 不开主动行为、不发说说。
