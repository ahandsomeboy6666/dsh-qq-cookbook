#!/usr/bin/env node
/**
 * DSH 环境探针：把「我这台机器上 DSH 是什么版本、能不能连、协议端通不通」变成一次命令。
 *
 * 用法：
 *   node checks/probe-dsh.mjs                    # 人读摘要
 *   node checks/probe-dsh.mjs --json             # 机读 JSON
 *   node checks/probe-dsh.mjs --dsh-url http://127.0.0.1:3080
 *   node checks/probe-dsh.mjs --onebot-url http://127.0.0.1:3000
 *
 * 退出码：0 = 关键项可判定；1 = 脚本自身失败。
 * 注意：连不上不是脚本失败——它只负责「报告事实」。
 */
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const JSON_MODE = args.includes('--json')
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const DSH_URL_ARG = opt('--dsh-url') ?? process.env.DSH_URL
const DSH_URLS = DSH_URL_ARG
  ? [DSH_URL_ARG]
  : ['http://127.0.0.1:3080', 'http://127.0.0.1:50460']
const ONEBOT_URL = opt('--onebot-url') ?? process.env.ONEBOT_URL ?? 'http://127.0.0.1:3000'
const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')

async function safeStat(p) {
  try { return await stat(p) } catch { return null }
}

async function readJson(p) {
  try { return JSON.parse(await readFile(p, 'utf8')) } catch { return null }
}

/** 读全局 npm 包里的 dsh 版本；不 spawn，避免沙箱 pipe 限制 */
async function dshVersionFromPackage() {
  const roots = []
  if (process.env.npm_config_prefix) roots.push(join(process.env.npm_config_prefix, 'node_modules'))
  if (process.env.APPDATA) roots.push(join(process.env.APPDATA, 'npm', 'node_modules'))
  roots.push(join(process.env.ProgramFiles ?? '', 'nodejs', 'node_modules'))
  if (process.env.NVM_SYMLINK) roots.push(join(process.env.NVM_SYMLINK, 'node_modules'))
  for (const root of roots) {
    const pkg = await readJson(join(root, '@deepseek-ai', 'dsh', 'package.json'))
    if (pkg?.version) return { version: pkg.version, source: join(root, '@deepseek-ai', 'dsh', 'package.json') }
  }
  return null
}

/** 回退：spawn 到临时文件再读（沙箱下 stdio: 'ignore' 可用） */
async function dshVersionFromCli() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-probe-'))
  const out = join(dir, 'version.txt')
  try {
    const isWin = process.platform === 'win32'
    const cmd = isWin ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh'
    const argv = isWin
      ? ['/d', '/s', '/c', `dsh --version > "${out}" 2>&1`]
      : ['-c', `dsh --version > "${out}" 2>&1`]
    const r = spawnSync(cmd, argv, { stdio: 'ignore', windowsHide: true, timeout: 10_000 })
    if (r.error || (r.status !== 0 && r.status !== null)) return null
    const text = (await readFile(out, 'utf8')).trim().split('\n').pop()?.trim()
    return text ? { version: text, source: 'dsh --version' } : null
  } catch {
    return null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function profiles() {
  const dir = join(DSH_HOME, 'profiles')
  const s = await safeStat(dir)
  if (!s?.isDirectory()) return { path: dir, exists: false, list: [] }
  try {
    const { readdir } = await import('node:fs/promises')
    const list = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name)
      .sort()
    return { path: dir, exists: true, list }
  } catch {
    return { path: dir, exists: true, list: [] }
  }
}

async function credentials() {
  const p = join(DSH_HOME, '.credentials.yaml')
  const s = await safeStat(p)
  if (!s?.isFile()) return { path: p, exists: false, hasBrowserSessionKey: false }
  try {
    const text = await readFile(p, 'utf8')
    // 只判「有没有这个键」，绝不输出值
    return { path: p, exists: true, hasBrowserSessionKey: text.includes('client-connection/browser-session') }
  } catch {
    return { path: p, exists: true, hasBrowserSessionKey: false }
  }
}

async function probeHttp(url, path = '/') {
  const target = url.replace(/\/+$/, '') + path
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(2000), redirect: 'manual' })
    return { url: target, reachable: true, status: res.status }
  } catch (err) {
    return { url: target, reachable: false, status: null, error: err.cause?.code ?? err.name }
  }
}

const webTries = []
for (const u of DSH_URLS) webTries.push(await probeHttp(u, '/'))
const webHit = webTries.find((t) => t.reachable) ?? webTries[webTries.length - 1]

const out = {
  ok: true,
  generatedAt: new Date().toISOString(),
  node: { version: process.version, platform: process.platform },
  dsh: null,
  profiles: await profiles(),
  dshHome: {
    path: DSH_HOME,
    exists: Boolean(await safeStat(DSH_HOME))
  },
  auth: await credentials(),
  webApi: { ...webHit, tries: webTries.map((t) => ({ url: t.url, reachable: t.reachable, status: t.status })) },
  onebot: await probeHttp(ONEBOT_URL, '/get_status'),
  warnings: []
}

out.dsh = (await dshVersionFromPackage()) ?? (await dshVersionFromCli())
if (!out.dsh) {
  out.warnings.push('未能读取 dsh 版本：既没找到全局 @deepseek-ai/dsh/package.json，也没跑通 dsh --version')
}
if (!out.profiles.list.includes('web')) {
  out.warnings.push('profiles 里没有 web：DSH Web profile 可能未安装，或 DSH_HOME 不对')
}
if (!out.auth.exists) {
  out.warnings.push(`找不到 ${join(DSH_HOME, '.credentials.yaml')}：Cookie 铸造会失败，需要先启动一次 DSH`)
} else if (!out.auth.hasBrowserSessionKey) {
  out.warnings.push('.credentials.yaml 里没有 client-connection/browser-session：无法离线铸造 Cookie')
}
if (!out.webApi.reachable) {
  out.warnings.push(`DSH Web 不可达（${out.webApi.url}）：先启动 DSH，或用 --dsh-url 指定实际端口`)
}
if (!out.onebot.reachable) {
  out.warnings.push(`OneBot HTTP 不可达（${out.onebot.url}）：协议端没启动，或端口/token 不对`)
}
out.ok = Boolean(out.dsh) && out.profiles.list.includes('web')

if (JSON_MODE) {
  console.log(JSON.stringify(out, null, 2))
} else {
  const line = (k, v) => console.log(`  ${k.padEnd(22)} ${v}`)
  console.log('\nDSH 环境探针\n')
  line('node', out.node.version)
  line('dsh', out.dsh ? `${out.dsh.version}  (${out.dsh.source})` : '未探测到')
  line('profiles', out.profiles.exists ? out.profiles.list.join(', ') : '目录不存在')
  line('DSH_HOME', out.dshHome.path)
  line('.credentials.yaml', out.auth.exists ? `存在（browser-session 键=${out.auth.hasBrowserSessionKey}）` : '不存在')
  line('Web API', `${out.webApi.url} → ${out.webApi.reachable ? `可达 ${out.webApi.status}` : '不可达'}`)
  line('OneBot', `${out.onebot.url} → ${out.onebot.reachable ? `可达 ${out.onebot.status}` : '不可达'}`)
  console.log(`\n  结论：${out.ok ? '关键项齐备' : '关键项缺失（见下）'}`)
  for (const w of out.warnings) console.log(`  ! ${w}`)
  console.log('')
}

process.exit(0)
