#!/usr/bin/env node
/**
 * cheems 安装检查：确认 dsh-qq-bridge 插件是否已进入 profile。
 *
 * 用法：
 *   node checks/check-install.mjs
 *   node checks/check-install.mjs --json
 *   node checks/check-install.mjs --profile web
 *
 * 退出码：0 = 检查完成；1 = 参数错误。
 * 未安装不是错误——它输出一份 TODO 清单。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
const JSON_MODE = args.includes('--json')
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
const PROFILE = opt('--profile') ?? 'web'
const PKG = join(DSH_HOME, 'profiles', PROFILE, 'package.json')
const PATCH = join(DSH_HOME, 'cordis.patch.yml')

async function read(p) {
  try { return await readFile(p, 'utf8') } catch { return null }
}

const pkgText = await read(PKG)
const patchText = (await read(PATCH)) ?? ''

const candidates = ['dsh-qq-bridge', 'dsh-im-bridge', 'qq-bridge', 'cheems']
const inPkg = candidates.filter((n) => pkgText?.includes(n))
const inPatch = candidates.filter((n) => patchText.includes(n))

const installed = inPkg.length > 0 || inPatch.length > 0

const todo = installed
  ? []
  : [
      `把 cheems 仓库挂到 profile：dsh plugin --profile ${PROFILE} add <cheems 仓库路径>`,
      `重启 DSH，打开 设置 → QQ 桥接`,
      `填 wsUrl（NapCat WebSocket，默认 ws://127.0.0.1:3001）与 accessToken`,
      `白名单加自己的 QQ 号，设为号主`
    ]

const out = {
  generatedAt: new Date().toISOString(),
  profile: PROFILE,
  dshHome: DSH_HOME,
  packageJson: PKG,
  packageJsonExists: Boolean(pkgText),
  installed,
  evidence: { inPackageJson: inPkg, inCordisPatch: inPatch },
  todo
}

if (JSON_MODE) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log('\ncheems 安装检查\n')
  console.log(`  profile    ${PROFILE}`)
  console.log(`  package    ${PKG}（${pkgText ? '存在' : '不存在'}）`)
  console.log(`  插件       ${installed ? '已注册' : '未注册'}`)
  if (installed) console.log(`  证据       ${[...inPkg, ...inPatch].join(', ')}`)
  if (todo.length) {
    console.log('\n  下一步：')
    todo.forEach((t, i) => console.log(`    ${i + 1}. ${t}`))
  }
  console.log('')
}

process.exit(0)
