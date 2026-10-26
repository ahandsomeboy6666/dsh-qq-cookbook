#!/usr/bin/env node
/**
 * 零花钱授权检查：额度、受益人、禁转账三项。
 *
 * 用法：node checks/check-budget.mjs [--json]
 * 退出码：0 = 配置齐全；1 = 缺项。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const CONFIG = join(ROOT, 'config.example.json')

const text = await readFile(CONFIG, 'utf8').catch(() => null)
let cfg = null
try { cfg = text ? JSON.parse(text) : null } catch { cfg = null }

const a = cfg?.allowance ?? {}
const checks = {
  hasConfig: Boolean(cfg),
  perOrder: a.perOrder === 30,
  perDay: a.perDay === 60,
  perMonth: a.perMonth === 300,
  beneficiaries: Array.isArray(a.beneficiaries)
    && a.beneficiaries.includes('owner')
    && a.beneficiaries.includes('self'),
  transferDisabled: a.transfer === false,
  maxOrdersPerDay: Number.isInteger(a.maxOrdersPerDay) && a.maxOrdersPerDay > 0
}
const ok = Object.values(checks).every(Boolean)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ config: CONFIG, checks, ok }, null, 2))
} else {
  console.log('\n零花钱授权检查\n')
  const mark = (v) => (v ? 'OK' : 'MISSING')
  console.log(`  配置        ${mark(checks.hasConfig)}  ${CONFIG}`)
  console.log(`  单笔 ≤30    ${mark(checks.perOrder)}`)
  console.log(`  每日 ≤60    ${mark(checks.perDay)}`)
  console.log(`  每月 ≤300   ${mark(checks.perMonth)}`)
  console.log(`  受益人      ${mark(checks.beneficiaries)}  owner + self`)
  console.log(`  禁转账      ${mark(checks.transferDisabled)}`)
  console.log(`  日笔数上限  ${mark(checks.maxOrdersPerDay)}`)
  console.log('')
}

process.exit(ok ? 0 : 1)
