#!/usr/bin/env node
/**
 * 浏览器能力检查：DSH 是否挂了 browser-use 提供方（Playwright / Chrome DevTools / Cua）。
 *
 * 实际生效的配置在 profiles/<name>/cordis.patch.yml，不在 ~/.dsh 根下；
 * 两处都扫，避免「配了但脚本看不见」。
 *
 * 用法：node checks/check-browser.mjs [--json]
 * 退出码：0 = 已配置；1 = 未配置。
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
const KEYS = ['playwright', 'browser-use', 'browser_use', 'chrome-devtools', 'cua']

const candidates = [join(HOME, 'cordis.patch.yml')]
try {
  const profiles = await readdir(join(HOME, 'profiles'), { withFileTypes: true })
  for (const entry of profiles) {
    if (entry.isDirectory()) candidates.push(join(HOME, 'profiles', entry.name, 'cordis.patch.yml'))
  }
} catch { /* 没有 profiles 目录 */ }

const scanned = []
const hits = []
for (const file of candidates) {
  const text = await readFile(file, 'utf8').catch(() => null)
  if (text === null) continue
  scanned.push(file)
  for (const key of KEYS) {
    if (text.toLowerCase().includes(key) && !hits.includes(key)) hits.push(key)
  }
}
const ok = hits.length > 0

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned, configured: ok, hits }, null, 2))
} else {
  console.log('\n浏览器能力检查\n')
  for (const file of scanned) console.log(`  扫描        ${file}`)
  if (scanned.length === 0) console.log('  扫描        (没有找到 cordis.patch.yml)')
  console.log(`  browser-use ${ok ? '已配置' : '未配置'}`)
  if (ok) console.log(`  命中        ${hits.join(', ')}`)
  else console.log('  下一步      在 profiles/<name>/cordis.patch.yml 挂 @deepseek-ai/dsh-mcp-client + @playwright/mcp')
  console.log('')
}

process.exit(ok ? 0 : 1)
