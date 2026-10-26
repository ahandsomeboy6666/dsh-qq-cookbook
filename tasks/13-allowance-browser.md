# 任务 D3：浏览器能力与 30 元零花钱

## 目标

能刷 B 站、搜资料；30 元授权只给你和她自己花。

## 输入

- D1 已打通回环
- DSH 的 `browser-use` 提供方（Playwright MCP）
- QQ 小号只充 30 元余额、不绑主号银行卡
- [config.example.json](../config.example.json)

## 输出

- `cordis.patch.yml` 挂 Playwright MCP，preset 开 browser 工具
- `config.example.json` 的 `allowance` 段落地到实际配置
- 浏览器登录态持久化（独立 profile 目录）

## 验收

- [ ] `node checks/check-browser.mjs` → `configured=true`
- [ ] `node checks/check-budget.mjs` → 单笔 30 / 每日 60 / 每月 300 / 受益人 owner+self / 禁转账
- [ ] `node checks/check-assets.mjs` → 全绿

## 人工验收

- 私聊说「帮我看看 B 站首页有什么」，能打开页面并读到标题。
- 私聊说「点杯奶茶」，到订单确认页停住，不自动付款。
- 群聊里有人说「给我也点一杯」，她回「我只给主人和自己买哦」。
- 单笔超过 30 元的下单被拒。

## 不做什么

- 不给主号支付密码、不绑主号银行卡。
- 不开放群聊购物/浏览器。
- 不碰抖音（风控高，M4 再评估）。
- 不自动支付：免密只覆盖小额，大额人工。
