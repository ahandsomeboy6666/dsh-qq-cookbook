# 验收矩阵

> 原则：**每条验收都是一个命令，失败就代表没做完。** 人工检查单独列出，不混进机器验收。
>
> 红绿流程：先跑 → 必须红 → 写代码 → 跑到绿 → 重构 → 还是绿。
>
> 体验类指标（U1–U10）见 [UX 规格](07-ux-spec.md#三指标可验收)，本文只定义怎么跑。

## 一、验收分层

| 层 | 名称 | 跑什么 | 依赖 | 什么时候跑 |
|---|---|---|---|---|
| L0 | 资产检查 | `node checks/check-assets.mjs` | 无 | 每次改文档/任务卡 |
| L1 | 环境探针 | `node checks/probe-dsh.mjs --json` | DSH 已安装 | 每次开工前、升级 DSH 后 |
| L2 | 单元测试 | `npm test` | 无（fixture 回放） | 每次改代码 |
| L3 | 端到端回环 | `npm run test:e2e` | DSH 在跑 + 协议端在线 | 每个里程碑收尾 |
| L4 | 体验指标 | `npm run test:ux-*` | L3 环境 + 计时 | M3 起每个里程碑 |
| L5 | 人工 | QQ 里发消息观察 | 同上 + 手机 | 每个里程碑收尾 |

L0–L2 必须全绿才能说「做完了」；L3–L5 用真实账号，失败要贴日志，不许写「应该没问题」。

## 二、通用命令

```powershell
node checks/check-assets.mjs          # L0：文档资产是否齐、验收是否可执行
node checks/probe-dsh.mjs --json      # L1：DSH 版本/profile/鉴权/端口
npm test                              # L2：单元测试（node:test）
npm run verify:adaptation             # L1：DSH 协议适配断言（M0 后新增）
npm run test:e2e                      # L3：真实回环
npm run test:ux-latency               # L4：首条延迟
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
| M0-8 | 延迟基线 | `npm run test:ux-latency -- baseline` | 记录 P50/P95（不设门槛） | 无数据 |

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

## 六、M3：体验核心

目标：回复快、能分条、能打断、群聊不刷屏。

| # | 验收 | 命令 | 期望 |
|---|---|---|---|
| M3-1 | 首条延迟 | `npm run test:ux-latency` | P50 ≤3s，P95 ≤8s |
| M3-2 | 长任务首反馈 | `npm run test:ux-latency -- task` | ≤2s 出现回执或进度 |
| M3-3 | 分条 | `npm run test:ux-split` | >200 字分 2–4 条，间隔 400–900ms，顺序正确 |
| M3-4 | 打断 | `npm run test:ux-interrupt` | 发「停」≤2s 停止，无后续消息 |
| M3-5 | 补充 | `npm run test:steer` | 「用中文」在回合中生效（或走排队降级） |
| M3-6 | 群聊静默 | `npm run test:ux-quiet` | 10 条无 @ 闲聊，0 回复、0 模型调用 |
| M3-7 | 群聊回复 | `npm run test:group-reply` | @ 一句，1–3 条、≤400 字、引用正确 |
| M3-8 | 模型路由 | `npm run test:model-route` | 短文本 flash、堆栈 pro、带图 flash |
| M3-9 | 失败文案 | `npm run test:ux-failure` | 5 类故障 5s 内给出对应人话 |

## 七、M4：多模态与打磨

目标：发图能懂、部署 15 分钟、控制台可用。

| # | 验收 | 命令 | 期望 |
|---|---|---|---|
| M4-1 | 图片理解 | `npm run test:vision` | 3 张测试图答对 |
| M4-2 | 图片上限 | `npm test -- media` | 超 8MB/64MP/5 张被拒并给人话 |
| M4-3 | 语音入站 | `npm run test:voice` | 语音转写进上下文（或诚实提示） |
| M4-4 | 语音出站 | `node checks/check-voice.mjs` | 只允许语音库内文件，越界拒绝 |
| M4-5 | 表情 | `npm test -- sticker` | 白名单表情能发，未知 id 拒绝 |
| M4-6 | 向导 | `npm run test:setup-idempotent` | 跑两次配置无重复项 |
| M4-7 | 版本门禁 | `npm run test:version-gate` | 不兼容版本拒绝启动并提示区间 |
| M4-8 | 控制台 | `npm run test:console` | 状态/会话/模式/人格/花费五页可读 |
| M4-9 | 全部 UX 指标 | `npm run test:ux-all` | U1–U9 全达标（U10 见 M4-1） |

## 八、UX 指标总表

与 [UX 规格](07-ux-spec.md#三指标可验收) 一一对应，任何一条不达标都不算 M3/M4 完成。

| # | 指标 | 目标 |
|---|---|---|
| U1 | 短问答首条延迟 | P50 ≤3s，P95 ≤8s |
| U2 | 长任务首个反馈 | ≤2s |
| U3 | 长回复分条 | >200 字 ≥2 条，间隔 400–900ms |
| U4 | 打断响应 | ≤2s |
| U5 | 失败可见 | ≤5s 人话 |
| U6 | 重启恢复 | ≤10s |
| U7 | 群聊不刷屏 | 10 条闲聊 0 回复 |
| U8 | 配置到首条回复 | ≤15 分钟（人工） |
| U9 | 审批往返 | 1 条消息 |
| U10 | 图片理解 | 3 张测试图答对 |

## 九、红绿范例（M1-2）

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

## 十、验收记录模板

```markdown
## M0 验收 · 2026-10-27

- [x] check-assets → 全绿（34 项）
- [x] probe-dsh → dshVersion=0.2.0-rc.2, profiles=[web,desktop]
- [x] npm test → 18 passed
- [x] test:e2e → reply: pong (2.3s)
- [x] test:ux-latency → P50 2.1s / P95 6.4s
- [ ] 人工：手机 QQ 发 ping（待验）

红灯：无
备注：NapCat 首次 WS 1006 属正常自愈，见 reference 基线
```

## 十一、什么不算验收

- 「跑起来了」「看起来没问题」「应该可以」。
- 只贴截图不贴命令。
- 在别人的机器上跑过（版本不同）。
- 测试被跳过却记成通过。
- 功能实现了但 UX 指标没达标（例如「分条已实现」但延迟 30s）。
