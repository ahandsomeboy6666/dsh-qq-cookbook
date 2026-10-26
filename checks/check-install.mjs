#!/usr/bin/env node
/**
 * cheems 安装检查：确认 dsh-qq-bridge 插件是否已进入 profile。
 *
 * 用法：
 *   node checks/check-install.mjs                    # 扫描所有 profile
 *   node checks/check-install.mjs --profile desktop  # 只看一个
 *   node checks/check-install.mjs --json
 *
 * 退出码：0 = 检查完成；1 = 参数错误。
 * 未安装不是错误——它输出一份 TODO 清单。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
const JSON_MODE = args.includes('--json')
const REQUIRE = args.includes('--require')
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
const PROFILES_DIR = join(DSH_HOME, 'profiles')
const ONLY = opt('--profile')

const CANDIDATES = ['dsh-qq-bridge', 'dsh-im-bridge', 'qq-bridge', 'cheems']

async function read(p) {
  try { return await readFile(p, 'utf8') } catch { return null }
}

let names = []
try {
  names = (await readdir(PROFILES_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => e.name)
} catch {}

if (ONLY) names = names.filter((n) => n === ONLY)

const profiles = []
for (const name of names) {
  const pkgPath = join(PROFILES_DIR, name, 'package.json')
  const text = (await read(pkgPath)) ?? ''
  const hits = CANDIDATES.filter((c) => text.includes(c))
  profiles.push({ name, packageJson: pkgPath, exists: Boolean(text), installed: hits.length > 0, evidence: hits })
}

const installed = profiles.some((p) => p.installed)
const target = ONLY ?? 'desktop'

const todo = installed
  ? []
  : [
      `把 cheems 仓库挂到 profile：dsh plugin --profile ${target} add <cheems 仓库路径>`,
      `重启 DSH，打开 设置 → QQ 桥接`,
      `填 wsUrl（NapCat WebSocket，默认 ws://127.0.0.1:3001）与 accessToken`,
      `白名单加自己的 QQ 号，设为号主`
    ]

const out = {
  generatedAt: new Date().toISOString(),
  dshHome: DSH_HOME,
  profiles,
  installed,
  todo
}

if (JSON_MODE) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log('\ncheems 安装检查\n')
  console.log(`  DSH_HOME   ${DSH_HOME}`)
  console.log(`  profile    ${names.join(', ') || '（没有）'}`)
  for (const p of profiles) {
    console.log(`  - ${p.name}  ${p.installed ? `已注册（${p.evidence.join(', ')}）` : '未注册'}`)
  }
  if (todo.length) {
    console.log('\n  下一步：')
    todo.forEach((t, i) => console.log(`    ${i + 1}. ${t}`))
  }
  console.log('')
}

process.exit(REQUIRE && !installed ? 1 : 0)
