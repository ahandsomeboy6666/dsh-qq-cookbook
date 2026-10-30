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
const startup = []   // 配置里指向的可执行路径，逐个验是否真的存在
for (const file of candidates) {
  const text = await readFile(file, 'utf8').catch(() => null)
  if (text === null) continue
  scanned.push(file)
  for (const key of KEYS) {
    if (text.toLowerCase().includes(key) && !hits.includes(key)) hits.push(key)
  }
  // 「配置里有 playwright 这个词」不代表能启动——要看它指向的文件在不在。
  for (const m of text.matchAll(/^\s*-\s*'([^']*\.(?:js|exe|cmd))'/gm)) {
    const target = m[1]
    if (!/playwright|mcp|browser/i.test(target)) continue
    const absolute = /^[A-Za-z]:[\\/]/.test(target) ? target : join(HOME, target)
    startup.push({ target, exists: await readFile(absolute, 'utf8').then(() => true).catch(() => false) })
  }
}
const configured = hits.length > 0
// 只在「配了」的前提下检查文件；路径是相对的就当没法定论，不误报
const brokenStartup = startup.filter((s) => /^[A-Za-z]:[\\/]/.test(s.target) && !s.exists)
const ok = configured && brokenStartup.length === 0

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned, configured, hits, startup, ok }, null, 2))
} else {
  console.log('\n浏览器能力检查\n')
  for (const file of scanned) console.log(`  扫描        ${file}`)
  if (scanned.length === 0) console.log('  扫描        (没有找到 cordis.patch.yml)')
  console.log(`  browser-use ${configured ? '已配置' : '未配置'}`)
  if (configured) console.log(`  命中        ${hits.join(', ')}`)
  else console.log('  下一步      在 profiles/<name>/cordis.patch.yml 挂 @deepseek-ai/dsh-mcp-client + @playwright/mcp')
  for (const s of startup) {
    console.log(`  启动文件    ${s.exists ? '✓' : '✗'} ${s.target.slice(0, 70)}`)
  }
  if (brokenStartup.length > 0) {
    console.log('')
    console.log('  ⚠ 配置里指向的启动文件不存在——「配了」不等于「能起来」。')
    console.log('    重跑 node tools/setup.mjs --skip-mcp 之外的方式修，或手动装 @playwright/mcp。')
  }
  console.log('')
}

process.exit(ok ? 0 : 1)
