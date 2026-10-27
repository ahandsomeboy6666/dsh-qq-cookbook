#!/usr/bin/env node
/**
 * 零花钱授权检查。
 *
 * 事实前提：cheems 插件没有额度字段，额度不靠软件配置，靠**小号只充 30 元的物理上限**。
 * 本脚本检查能自动验的部分：
 *   1. 示例配置（config.example.json）里的额度模板是否齐全
 *   2. 插件生效配置（settings.json）可读、wallet 段存在
 * 物理上限需要人工确认，脚本只能提示。
 *
 * 用法：node checks/check-budget.mjs [--json]
 * 退出码：0 = 模板齐全且配置可读；1 = 缺项。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const ROOT = join(import.meta.dirname, '..')
const CONFIG = join(ROOT, 'config.example.json')
const HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
const SETTINGS = join(HOME, 'im-bridge', 'settings.json')

let example = null
try { example = JSON.parse(await readFile(CONFIG, 'utf8')) } catch { /* 没有示例 */ }
const a = example?.allowance ?? {}

let settingsOk = false
let wallet = null
let personae = []
try {
  const settings = JSON.parse(await readFile(SETTINGS, 'utf8'))
  settingsOk = true
  wallet = settings.wallet ?? null
  personae = Array.isArray(settings.personae) ? settings.personae : []
} catch { /* 插件没装或没配 */ }

const prompt = personae.map((p) => String(p.prompt ?? '')).join('\n')
const personaHasMoneyRule = /30\s*(块|元)|转账|红包|代付/.test(prompt)

const checks = {
  hasConfig: Boolean(example),
  perOrder: a.perOrder === 30,
  perDay: a.perDay === 60,
  perMonth: a.perMonth === 300,
  beneficiaries: Array.isArray(a.beneficiaries) && a.beneficiaries.includes('owner') && a.beneficiaries.includes('self'),
  transferDisabled: a.transfer === false,
  maxOrdersPerDay: Number.isInteger(a.maxOrdersPerDay) && a.maxOrdersPerDay > 0,
  settingsReadable: settingsOk,
  walletPresent: wallet !== null,
}

const ok = Object.values(checks).every(Boolean)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ config: CONFIG, settings: SETTINGS, checks, wallet, personaHasMoneyRule, ok }, null, 2))
} else {
  console.log('\n零花钱授权检查\n')
  console.log(`  示例配置    ${CONFIG}`)
  console.log(`  生效配置    ${SETTINGS}`)
  const mark = (v) => (v ? 'OK' : 'MISSING')
  console.log('')
  console.log(`  单笔 ≤30    ${mark(checks.perOrder)}`)
  console.log(`  每日 ≤60    ${mark(checks.perDay)}`)
  console.log(`  每月 ≤300   ${mark(checks.perMonth)}`)
  console.log(`  受益人      ${mark(checks.beneficiaries)}  owner + self`)
  console.log(`  禁转账      ${mark(checks.transferDisabled)}`)
  console.log(`  日笔数上限  ${mark(checks.maxOrdersPerDay)}`)
  console.log(`  生效配置可读 ${mark(checks.settingsReadable)}`)
  console.log(`  wallet 段   ${mark(checks.walletPresent)}${wallet ? `  lowMoney=${wallet.lowMoney ?? '-'}` : ''}`)
  console.log('')
  console.log(`  [人工] 物理上限：小号只充 30 元、不绑卡 —— 脚本无法验证，要你自己确认`)
  console.log(`  [提示] 人设里含额度条款：${personaHasMoneyRule ? '有（已改成只靠物理上限，建议清掉）' : '没有（符合当前策略）'}`)
  console.log('')
}
process.exit(ok ? 0 : 1)
