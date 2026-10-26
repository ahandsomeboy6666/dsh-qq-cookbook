# 任务总览

流程见 [AGENTS.md](../AGENTS.md)：先跑红，再写绿。每张卡的五段见 [任务卡模板](../docs/templates/task-card.md)。

## 状态

| # | 任务 | 里程碑 | 依赖 | 验收命令 | 状态 |
|---|---|---|---|---|---|
| 01 | [DSH 环境探针](01-probe-dsh.md) | M0 | 无 | `node checks/probe-dsh.mjs --json` | 📋 待做 |
| 02 | [最小收发回环](02-minimal-loop.md) | M0 | 01 | `npm run test:e2e` | 📋 待做 |
| 03 | [OneBot 通道接入](03-qq-channel.md) | M0 | 01 | `node checks/probe-onebot.mjs` | 📋 待做 |
| 04 | [会话映射持久化](04-session-mapping.md) | M2 | 02 | `npm test -- mapping` | 📋 待做 |
| 05 | [安全基线与交互转发](05-security-baseline.md) | M1 | 02 | `node checks/attack-drill.mjs` | 📋 待做 |
| 06 | [人格两层与热生效](06-persona-layers.md) | M2 | 04 | `node checks/check-persona.mjs` | 📋 待做 |
| 07 | [首条早发与分条](07-ux-streaming.md) | M3 | 02 | `npm run test:ux-split` | 📋 待做 |
| 08 | [打断、补充与并发](08-interrupt.md) | M3 | 02、05 | `npm run test:ux-interrupt` | 📋 待做 |
| 09 | [图片入站与媒体上限](09-multimodal.md) | M4 | 02、05 | `npm run test:vision` | 📋 待做 |

## 建议顺序

```
01 探针 ──► 03 通道 ──► 02 回环 ──► 05 安全 ──► 04 会话 ──► 06 人格
                                                    │
                                                    ├──► 07 分条 ──► 08 打断
                                                    └──► 09 多模态
```

01 先做：不确认版本与鉴权就写代码，等于赌 DSH 协议没变。
03 第二：先能把 QQ 事件稳定收进来，与 DSH 解耦。
02 第三：第一个完整往返，项目的 hello world。
05 第四：在扩大使用范围之前立边界。
04、06：会话与人格建立在稳定回环之上。
07、08、09：体验三件套，按 [UX 规格](../docs/07-ux-spec.md) 的指标验收。

## 已定的背景

- 本机 DSH `0.2.0-rc.2`，profile 仅 `web` / `desktop`。
- 协议端默认 NapCat（本机已有），SnowLuma 备选。
- 参考实现 qq-bridge 的结论见 [qq-bridge 基线](../docs/references/qq-bridge-baseline.md)。
- 决策未拍板前不写对应实现，见 [决策台账](../docs/decisions/README.md)。
- 体验目标与指标见 [UX 规格](../docs/07-ux-spec.md)：**功能实现但指标不达标，不算做完。**
