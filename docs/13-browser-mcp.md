# 浏览器能力（Playwright MCP）

> 状态：**已生效**（2026-10-27）。实测 `browser_navigate https://example.com` 返回
> `Example Domain`，工具以 `mcp__browser__*` 注册。

## 一、它不属于 QQ 桥接

qqbridge 只负责把 QQ 消息转给 DSH；「刷 B 站、点外卖」要 DSH 侧有浏览器工具。
DSH 通过 `@deepseek-ai/dsh-mcp-client` 挂 MCP server，Playwright 是其中一种提供方。

链路：

```
QQ → cheems 插件 → DSH agent → mcp-client → Playwright MCP → 浏览器
```

## 二、安装

```powershell
npm i -g @playwright/mcp --registry=https://registry.npmmirror.com
# 实测版本 0.0.83（2026-10-27）

# 握手自测：应返回 serverInfo.name = Playwright
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}' |
  node 'E:/nvm/nodejs/node_modules/@playwright/mcp/cli.js' --headless
```

## 三、配置（`~/.dsh/profiles/desktop/cordis.patch.yml`）

```yaml
- insert:
    - id: mcp-browser
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: browser
        transport: stdio
        command: 'E:/nvm/nodejs/node.exe'
        args:
          - 'E:/nvm/nodejs/node_modules/@playwright/mcp/cli.js'
          - '--headless'
        toolCallTimeoutMs: 60000
        failOnStartupError: false
```

## 四、四个坑（都踩过）

1. **新增条目必须用 `- insert:`**。直接写 `- id: xxx` 是「覆盖已挂载条目」，没有同名条目就什么也不发生——表现为「配置写了但没生效」，且不报错。
2. **热重载会失效**。连续改 `cordis.patch.yml` 六次之后，watch 不再响应（日志停在最后一次 `apply`）。确认方法：改一行注释，等 15 秒看 `bridge.log` 有没有新的 `plugin disposed → apply`。没有就得重启桌面端。
3. **`command` 用绝对路径 `node.exe`**，不要写 `npx`：Windows 下 stdio spawn 不解析 `PATHEXT`，`npx` 会找不到。
4. **DSH 重启会把 NapCat 一起带下去**。重启后 `bridge.log` 持续 `ECONNREFUSED 127.0.0.1:6701`，
   插件只会重连、不会自动拉起（日志：`napcat automatic restart skipped: account is unconfirmed or remote`）。
   要手动跑 `tools/napcat/NapCat.52892.Shell/napcat.quick.bat`。

## 五、验收

```powershell
node checks/check-browser.mjs
# 扫描 profiles/*/cordis.patch.yml，命中 playwright → 已配置

# 进程在跑（MCP server 是常驻 stdio 子进程）
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'playwright' } |
  Select-Object ProcessId, CommandLine

# 真调用一次（在 DSH 会话里）
browser_navigate https://example.com
```

> `check-browser.mjs` 只做**静态**判断（配置里有没有 playwright）。
> 真正的证据是「MCP 子进程存在」+「工具能调通」，两项都要看。

## 六、安全边界

- 群聊不开放浏览器与购物（见 [当前方案](10-current-plan.md) 第五节）；只有私聊 owner 能用
- `--headless`：不弹窗，避免误操作桌面
- Playwright MCP 默认把文件访问限制在 workspace 根内，`file://` 也受限
- 登录态：浏览器数据落在 Playwright 的独立 profile 目录，不与系统浏览器共用

## 七、不做什么

- 不装 Chrome DevTools / Cua 作为替代（Playwright 已验证够用）
- 不让群友触发浏览器（越权）
- 不自动付款：点外卖只到订单确认页，付款要人工（见 [ADR-006](decisions/ADR-006-security.md)）
