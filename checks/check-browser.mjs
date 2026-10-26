#!/usr/bin/env node
/**
 * 浏览器能力检查：DSH 是否挂了 browser-use 提供方（Playwright / Chrome DevTools / Cua）。
 *
 * 用法：node checks/check-browser.mjs [--json]
 * 退出码：0 = 已配置；1 = 未配置。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
const PATCH = join(HOME, 'cordis.patch.yml')
const KEYS = ['playwright', 'browser-use', 'browser_use', 'chrome-devtools', 'cua', 'browser']

const text = await readFile(PATCH, 'utf8').catch(() => '')
const hits = KEYS.filter((k) => text.toLowerCase().includes(k))
const ok = hits.length > 0

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ patch: PATCH, configured: ok, hits }, null, 2))
} else {
  console.log('\n浏览器能力检查\n')
  console.log(`  配置        ${PATCH}`)
  console.log(`  browser-use ${ok ? '已配置' : '未配置'}`)
  if (ok) console.log(`  命中        ${hits.join(', ')}`)
  else console.log('  下一步      在 cordis.patch.yml 挂 Playwright MCP，并给 preset 开 browser 工具')
  console.log('')
}

process.exit(ok ? 0 : 1)
