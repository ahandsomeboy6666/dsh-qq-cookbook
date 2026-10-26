# 验收矩阵

> 原则：**每条验收都是一个命令，失败就代表没做完。** 人工检查单独列出，不混进机器验收。
>
> 红绿流程：先跑 → 必须红 → 写代码 → 跑到绿 → 重构 → 还是绿。

## 一、验收分层

| 层 | 名称 | 跑什么 | 依赖 | 什么时候跑 |
|---|---|---|---|---|
| L0 | 资产检查 | `node checks/check-assets.mjs` | 无 | 每次改文档/任务卡 |
| L1 | 环境探针 | `node checks/probe-dsh.mjs --json` | DSH 已安装 | 每次开工前、升级 DSH 后 |
| L2 | 单元测试 | `npm test` | 无（fixture 回放） | 每次改代码 |
| L3 | 端到端回环 | `npm run test:e2e` | DSH 在跑 + 协议端在线 | 每个里程碑收尾 |
| L4 | 人工 | QQ 里发消息观察 | 同上 + 手机 | 每个里程碑收尾 |

L0–L2 必须全绿才能说「做完了」；L3/L4 用真实账号，失败要贴日志，不许写「应该没问题」。

## 二、通用命令

```powershell
node checks/check-assets.mjs          # L0：文档资产是否齐、验收是否可执行
node checks/probe-dsh.mjs --json      # L1：DSH 版本/profile/鉴权/端口
npm test                              # L2：单元测试（node:test）
npm run verify:adaptation             # L1：DSH 协议适配断言（M0 后新增）
npm run test:e2e                      # L3：真实回环
```

## 三、M0：最小回环

目标：QQ 私聊发「ping」→ 30 秒内收到 agent 回复。

| # | 验收 | 命令 | 期望 | 红灯表现 |
|---|---|---|---|---|
| M0-1 | 资产齐 | `node checks/check-assets.mjs` | 退出码 0，`全绿` | 缺文件/验收不可执行 |
| M0-2 | DSH 版本可探测 | `node checks/probe-dsh.mjs --json` | `dshVersion` 非空，`profiles` 含 `web` | 命令找不到 dsh / 输出空 |
| M0-3 | 鉴权可用 | 同上 | `auth.cookieMinted=true` | 401 / `.credentials.yaml` 缺少会话密钥 |
| M0-4 | 协议端可达 | 同上 | `onebot.connected=true`，`onebot.selfId` 非空 | WS 连不上 / token 不匹配 |
| M0-5 | 单测通过 | `npm test` | `pass N / fail 0` | 任一断言失败 |
| M0-6 | 端到端 | `npm run test:e2e` | 输出 `reply: <非空文本>`，退出码 0 | 超时 / 无回复 |
| M0-7 | 会话落库 | `node -e "console.log(Object.keys(require('./state/sessions.json')))"` | 含 `private:<你的QQ>` | 文件不存在 |

**红灯示例（M0-2）**：如果 `probe-dsh` 输出 `profiles: ["web","desktop"]` 但 `webApi.reachable=false`，说明 DSH 没启动或端口不对——先解决这个，不要继续写桥接。

## 四、M1：安全与稳定

目标：攻击演练全过、断线能自愈。

| # | 验收 | 命令 | 期望 |
|---|---|---|---|
| M1-1 | preset 工具面 | `node checks/check-preset-tools.mjs` | 允许集合与预期**完全相等**；含 `bash`/`write`/`subagent` 即失败 |
| M1-2 | 白名单 fail-closed | `npm test -- guard` | 空名单用例：所有消息被拒 |
| M1-3 | 发送越界被拒 | `npm test -- guard` | 目标不在白名单 → 抛出/返回拒绝 |
| M1-4 | 出站审计 | `node checks/check-audit.mjs` | 含 `C:\` 与 `sk-` 的两条样本均被拦截 |
| M1-5 | 攻击演练 | `node checks/attack-drill.mjs` | 6 条演练全 PASS（见[威胁模型](03-threat-model.md#四攻击演练m1-必须全过)） |
| M1-6 | 断线重连 | `npm run test:reconnect` | 断开 30s 后恢复，事件继续处理，进程不退出 |
| M1-7 | 单实例 | `npm start` 两次 | 第二次退出码非 0，输出「已有实例」 |

## 五、M2：会话与人格

目标：重启不串台，换人格不改代码。

| # | 验收 | 命令 | 期望 |
|---|---|---|---|
| M2-1 | 映射持久化 | `npm test -- mapping` | 建/复用/重置/退役四路径通过 |
| M2-2 | 重启续接 | `npm run test:restart-resume` | 重启后同一 QQ 会话 id 不变 |
| M2-3 | 权限变更重建 | `npm test -- mapping` | 改白名单后 `stale=true`，下条消息新会话 |
| M2-4 | 人格注入 | `node checks/check-persona.mjs` | 角色卡 ≤6000 字符、不含工具名、注入成功 |
| M2-5 | 换人格热生效 | `npm run test:persona-hot` | 改卡后下一条回复带新名，无需重启 |
| M2-6 | 审批超时 | `npm test -- interaction` | 120s 后 agent 收到「拒绝」 |

## 六、M3：增强

| # | 验收 | 命令 | 期望 |
|---|---|---|---|
| M3-1 | 图片理解 | `npm run test:vision` | 发一张图，回复能描述内容 |
| M3-2 | 语音发送 | `node checks/check-voice.mjs` | 只允许语音库内文件，越界拒绝 |
| M3-3 | 表情 | `npm test -- sticker` | 白名单表情能发，未知 id 拒绝 |
| M3-4 | token 账本 | `npm run test:tokens` | 每轮记录可汇总，峰谷计价正确 |
| M3-5 | 长群聊压缩 | `npm run test:compaction` | 超阈值触发压缩，回复仍正确 |

## 七、红绿范例（M1-2）

**红**：先写 `tests/guard.test.mjs`

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowed } from '../src/guard/policy.mjs'

test('空白名单拒绝所有人', () => {
  const policy = { allow: { private: [], groups: [] }, deny: {} }
  assert.equal(isAllowed(policy, { kind: 'private', peerId: '123' }), false)
})
```

跑：`npm test -- guard` → **FAIL**（此时 `isAllowed` 还不存在或返回 true）。

**绿**：实现 fail-closed 判定，再跑 → **PASS**。

## 八、验收记录模板

```markdown
## M0 验收 · 2026-10-27

- [x] check-assets → 全绿（34 项）
- [x] probe-dsh → dshVersion=0.2.0-rc.2, profiles=[web,desktop]
- [x] npm test → 18 passed
- [x] test:e2e → reply: pong (2.3s)
- [ ] 人工：手机 QQ 发 ping（待验）

红灯：无
备注：NapCat 首次 WS 1006 属正常自愈，见 reference 基线
```

## 九、什么不算验收

- 「跑起来了」「看起来没问题」「应该可以」。
- 只贴截图不贴命令。
- 在别人的机器上跑过（版本不同）。
- 测试被跳过却记成通过。
