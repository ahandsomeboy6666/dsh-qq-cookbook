#!/usr/bin/env node
/**
 * 行为回归检查：读 ~/.dsh/im-bridge/bridge.log，断言「当前状态」没退化。
 *
 * 静态检查（check-patches / check-persona）看的是文件；这个看的是**真实跑出来的日志**。
 * 每条断言都来自一次真实事故，见 docs/15-acceptance-record.md。
 *
 * 用法：
 *   node checks/check-behavior.mjs                 # 默认看最近 6 小时
 *   node checks/check-behavior.mjs --hours 24
 *   node checks/check-behavior.mjs --json
 *
 * 日志不存在（CI / 没跑过）→ SKIP，退出码 0。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const json = args.includes('--json')
const hoursArg = args.indexOf('--hours')
// 默认只看最近 30 分钟：这个脚本要回答「现在健康吗」，不是「今天发生过什么」。
const HOURS = hoursArg >= 0 ? Number(args[hoursArg + 1]) : 0.5
const MAX_FOLLOW_RATIO = 0.6

const HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? homedir(), '.dsh')
const LOG = join(HOME, 'im-bridge', 'bridge.log')

let raw = null
try { raw = await readFile(LOG, 'utf8') } catch { /* 没日志 */ }

if (raw === null) {
  if (json) console.log(JSON.stringify({ skipped: true, reason: 'bridge.log 不存在' }, null, 2))
  else console.log('\n行为回归\n\n  SKIP  bridge.log 不存在（CI 或还没跑过）\n')
  process.exit(2)
}

const entries = []
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (!m) continue
  const t = Date.parse(m[1])
  if (!Number.isFinite(t)) continue
  entries.push({ t, text: m[2] })
}

const cutoff = Date.now() - HOURS * 3600 * 1000
const win = entries.filter((e) => e.t >= cutoff)
const lastOf = (re) => [...entries].reverse().find((e) => re.test(e.text))
const countOf = (list, re) => list.filter((e) => re.test(e.text)).length

const checks = []

// 1. 语音：最后一次失败不晚于最后一次成功
{
  const lastFail = lastOf(/voice failed/)
  const lastOk = lastOf(/voice tag (?:at|moved to) head|voice tag detected/)
  const ok = !lastFail || (lastOk && lastOk.t > lastFail.t)
  checks.push({
    name: '语音：失败已被后续成功覆盖',
    ok,
    detail: lastFail ? `${new Date(lastFail.t).toLocaleTimeString()} 失败；${lastOk ? `${new Date(lastOk.t).toLocaleTimeString()} 成功` : '无成功记录'}` : '无失败',
  })
}

// 2. 提示：最后一次 prompt failed 不晚于最后一次 admitted
{
  const lastFail = lastOf(/prompt failed/)
  const lastOk = lastOf(/admitted prompt/)
  const ok = !lastFail || (lastOk && lastOk.t > lastFail.t)
  checks.push({
    name: '提示：失败已被后续成功覆盖',
    ok,
    detail: lastFail ? `${new Date(lastFail.t).toLocaleTimeString()} 失败；${lastOk ? `${new Date(lastOk.t).toLocaleTimeString()} 成功` : '无成功记录'}` : '无失败',
  })
}

// 3. 未识别的指令标签：窗口内应为 0
{
  const n = countOf(win, /stripped unhandled/)
  checks.push({ name: `指令标签：${HOURS}h 内被兜底剥掉`, ok: n === 0, detail: `${n} 次` })
}

// 4. 连接：最后一条连接类日志应是 connected
{
  const lastClose = lastOf(/onebot websocket closed/)
  const lastOpen = lastOf(/onebot websocket connected/)
  const ok = !lastClose || (lastOpen && lastOpen.t > lastClose.t)
  checks.push({
    name: '连接：最后一次是连上而非断开',
    ok,
    detail: !lastClose ? '无断开' : lastOpen ? `最近连上 ${new Date(lastOpen.t).toLocaleTimeString()}` : '从未连上',
  })
}

// 5. 群聊跟随窗口占比：看「窗口自我续命」有没有复发
{
  const wake = win.filter((e) => /wake: (at|nickname|follow|probability)/.test(e.text))
  const follow = wake.filter((e) => /wake: follow/.test(e.text)).length
  const ratio = wake.length === 0 ? 0 : follow / wake.length
  checks.push({
    name: `群聊唤醒：follow 占比 ≤ ${Math.round(MAX_FOLLOW_RATIO * 100)}%`,
    ok: wake.length === 0 || ratio <= MAX_FOLLOW_RATIO,
    detail: wake.length === 0 ? '无唤醒记录' : `${follow}/${wake.length} = ${Math.round(ratio * 100)}%`,
  })
}

const ok = checks.every((c) => c.ok)

if (json) {
  console.log(JSON.stringify({ log: LOG, hours: HOURS, totalEntries: entries.length, windowEntries: win.length, checks, ok }, null, 2))
} else {
  console.log('\n行为回归检查\n')
  console.log(`  日志      ${LOG}`)
  console.log(`  窗口      最近 ${HOURS} 小时（${win.length} 行）`)
  console.log('')
  for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  ${c.detail}`)
  console.log('')
  if (!ok) console.log('  失败项对应真实事故，见 docs/15-acceptance-record.md。\n')
}
process.exit(ok ? 0 : 1)
