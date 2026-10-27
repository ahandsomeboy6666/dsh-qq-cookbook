#!/usr/bin/env node
/**
 * 零花钱授权检查。
 *
 * 两件事要分开看：
 *   1. 示例配置（config.example.json）——是「想怎么花」的模板，不是生效配置
 *   2. 生效人设（~/.dsh/im-bridge/settings.json 的 personae）——插件没有额度字段，
 *      真正约束模型的是人设里的文字
 *
 * 用法：node checks/check-budget.mjs [--json]
 * 退出码：0 = 两边都齐；1 = 有缺项。
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

let personae = []
try {
  const settings = JSON.parse(await readFile(SETTINGS, 'utf8'))
  personae = Array.isArray(settings.personae) ? settings.personae : []
} catch { /* 插件没装或没配 */ }

const prompt = personae.map((p) => String(p.prompt ?? '')).join('\n')

/** 示例配置：额度与边界模板 */
const template = {
  perOrder: a.perOrder === 30,
  perDay: a.perDay === 60,
  perMonth: a.perMonth === 300,
  beneficiaries: Array.isArray(a.beneficiaries) && a.beneficiaries.includes('owner') && a.beneficiaries.includes('self'),
  transferDisabled: a.transfer === false,
  maxOrdersPerDay: Number.isInteger(a.maxOrdersPerDay) && a.maxOrdersPerDay > 0,
}

/** 生效约束：插件没有额度字段，靠人设文字 */
const effective = {
  hasPersonae: personae.length > 0,
  singleOrderLimit: /30\s*(块|元)/.test(prompt),
  transferRefused: /转账|红包|代付/.test(prompt),
  groupRefused: /群里不买|只给主人和自己买/.test(prompt),
}

const ok = Object.values(template).every(Boolean) && Object.values(effective).every(Boolean)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ config: CONFIG, settings: SETTINGS, template, effective, ok }, null, 2))
} else {
  console.log('\n零花钱授权检查\n')
  console.log(`  示例配置    ${CONFIG}`)
  console.log(`  生效人设    ${SETTINGS}（${personae.length} 条）`)
  console.log('')
  const mark = (v) => (v ? 'OK' : 'MISSING')
  console.log(`  [模板] 单笔 ≤30    ${mark(template.perOrder)}`)
  console.log(`  [模板] 每日 ≤60    ${mark(template.perDay)}`)
  console.log(`  [模板] 每月 ≤300   ${mark(template.perMonth)}`)
  console.log(`  [模板] 受益人      ${mark(template.beneficiaries)}  owner + self`)
  console.log(`  [模板] 禁转账      ${mark(template.transferDisabled)}`)
  console.log(`  [模板] 日笔数上限  ${mark(template.maxOrdersPerDay)}`)
  console.log('')
  console.log(`  [生效] 人设存在        ${mark(effective.hasPersonae)}`)
  console.log(`  [生效] 单笔 30 块上限  ${mark(effective.singleOrderLimit)}`)
  console.log(`  [生效] 拒绝转账/红包   ${mark(effective.transferRefused)}`)
  console.log(`  [生效] 群聊不购物      ${mark(effective.groupRefused)}`)
  console.log('')
  if (!ok) console.log('  插件没有额度字段：真正生效的是人设文字 + 小号只充 30 元的物理上限。\n')
}
process.exit(ok ? 0 : 1)
