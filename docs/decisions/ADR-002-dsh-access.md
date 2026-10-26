# ADR-002：DSH 接入走进程内插件适配层

## 状态

已接受（2026-10-27，形式变化）。最终采用 cheems 插件：插件形态成立，但适配层由 cheems 自带，不自写。见 [当前方案](../10-current-plan.md)。

## 背景

原结论是「Web `/api` + Cookie 离线铸造」，理由是唯一能同时拿投递、回复、提问、审批。调研后这个理由站不住了：

- DSH `0.1.1-rc.2` 起 `/api/*` **强制浏览器 Cookie**，本机回环也不例外（`banana770` README 明确记录，裸 HTTP 401）。
- 4/6 个实现选择 **DSH 插件**形态：进程内直接拿 `agents`、`agentPresets.mount`、`session/event`，不需要鉴权，也能拿审批按钮（`988hj7tczd-oss/dsh-im-qq` 的 ✅⭐❌ 内联按钮）。
- 独立进程为了用 `/api`，得自己搭一个免认证适配层（`banana770` 的 `/qqbapi/*`），本质还是插件。

## 决策

1. 主路径：**DSH 插件（cordis bundle）**，进程内调用：
   - `agentPresets.mount()` 挂 preset；
   - `agent.followup()` 投递；
   - `session/event` 订阅出站与交互；
   - `settings` 注册配置卡。
2. 插件向本机暴露**带 token 的本地路由**（`/qqbapi/*`），供独立的 QQ 连接进程调用；路由只监听 `127.0.0.1`。
3. Web `/api` 保留为**旧版 DSH 与外部脚本**的兼容路径，不作为主路径。
4. 所有 DSH 版本差异收敛在插件里，QQ 连接进程只依赖 `Transport` 与本地路由。

## 理由

- 免 Cookie：插件在进程内，绕开 `/api` 的浏览器鉴权与 token 轮换。
- 拿得全：`session/event` 有完整事件流与交互，审批可以直接出按钮（官方 Bot 路线）。
- 生态验证：4/6 实现走插件，且 `banana770` 的「独立进程 + 插件适配层」混合已跑通 0.2.1-rc.2。
- 版本适配集中：插件与 DSH 同进程，版本不匹配时启动即报错，不会「静默失效」。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 插件 API 是内部接口，随版本变 | 适配层单点；启动校验 `agents`/`agentPresets`/`settings` 三项；不兼容拒绝启动 |
| 插件加载失败导致无响应 | 安装脚本自检 + `dsh --dump-config` 验证插件行 |
| 本地免认证路由被滥用 | 只绑 127.0.0.1 + 每次启动生成随机 token；不暴露到局域网 |
| 插件崩溃影响 DSH | QQ transport 在独立进程，插件只做适配，崩溃面小；必要时降级到 `/api` |

## 验证

- 最小插件冒烟：`npm run test:plugin-smoke` → 插件加载、`/qqbapi/health` 返回版本。
- 版本门禁：`npm run test:version-gate` → 不兼容的 DSH 版本拒绝启动并提示。
- 兼容回退：`npm run test:web-api-fallback` → 插件不可用时走 `/api` 仍能收发。
- 安全：`node checks/check-local-route.mjs` → 非 127.0.0.1 访问被拒、无 token 401。
