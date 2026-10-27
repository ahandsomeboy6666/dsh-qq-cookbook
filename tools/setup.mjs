#!/usr/bin/env node
/**
 * 一键恢复：把 clone 下来的 cookbook 变成一台能跑的 QQ 桥接。
 *
 *   node tools/setup.mjs              # 执行
 *   node tools/setup.mjs --dry-run    # 只报告要做什么
 *   node tools/setup.mjs --qq 123 --group 456
 *   node tools/setup.mjs --skip-mcp   # 不装 Playwright MCP
 *
 * 幂等：已完成的步骤会跳过。会备份被改的文件（*.bak-<时间戳>）。
 *
 * 仍然需要人做的三件事（脚本不做，只提示）：
 *   1. 启动 NapCat 并扫码登录
 *   2. 把 QQ 号填进白名单（默认值已写，改人/换号时才需要）
 *   3. 小号只充 30 元
 */
import { readFile, writeFile, copyFile, readdir, mkdir, access, open } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join, dirname, relative } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const SKIP_MCP = args.includes('--skip-mcp')
const NO_DOWNLOAD = args.includes('--no-download')
// 桌面端官方更新源（来自已安装的 resources/app-update.yml）
const DSH_FEED = 'https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml'
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}

const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? homedir(), '.dsh')
const PROFILE = join(DSH_HOME, 'profiles', 'desktop')
const CORDIS = join(PROFILE, 'cordis.patch.yml')
const PACKAGE = join(PROFILE, 'package.json')
const SETTINGS = join(DSH_HOME, 'im-bridge', 'settings.json')
const VENDOR = join(ROOT, 'vendor', 'dsh-im-bridge')
const PATCH = join(ROOT, 'patches', 'dsh-im-bridge-1.19.0-local.patch')

const defaults = JSON.parse(await readFile(join(ROOT, 'config', 'defaults.json'), 'utf8'))
const QQ = String(opt('--qq', defaults.qq))
const GROUP = String(opt('--group', defaults.group))
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

const steps = []
function step(name, status, detail = '') {
  steps.push({ name, status, detail })
  console.log(`  [${status}] ${name}${detail ? '  ' + detail : ''}`)
}
async function exists(p) { try { await access(p); return true } catch { return false } }

// 设了 DSH_DESKTOP_DIR 就只认它（方便多安装路径 / 测试未安装分支）
const DSH_CANDIDATES = process.env.DSH_DESKTOP_DIR
  ? [process.env.DSH_DESKTOP_DIR]
  : [
      'E:\\dsh桌面端',
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness') : '',
      process.env.ProgramFiles ? join(process.env.ProgramFiles, 'DeepSeek Harness') : '',
      process.env['ProgramFiles(x86)'] ? join(process.env['ProgramFiles(x86)'], 'DeepSeek Harness') : '',
    ].filter(Boolean)

/** 找已安装的桌面端目录；找不到返回空串 */
async function findDsh() {
  for (const dir of DSH_CANDIDATES) {
    if (await exists(join(dir, 'DeepSeek Harness.exe'))) return dir
    if (await exists(join(dir, 'resources', 'app-update.yml'))) return dir
  }
  return ''
}

/** 从官方 feed 下载安装包并校验 sha512；已下载过则直接复用 */
async function downloadDshInstaller() {
  const res = await fetch(DSH_FEED, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error('更新源不可用 HTTP ' + res.status)
  const text = await res.text()
  const url = (text.match(/https:\/\/\S+\.exe/) ?? [])[0]
  const sha = (text.match(/sha512:\s*>?-\s*\n\s*([A-Za-z0-9+/=]+)/) ?? text.match(/sha512:\s*([A-Za-z0-9+/=]+)/) ?? [])[1]
  const version = (text.match(/^version:\s*(\S+)/m) ?? [])[1] ?? 'latest'
  if (!url) throw new Error('清单里没有安装包地址')
  const name = url.split('/').pop()
  const dir = join(ROOT, 'tools', 'downloads')
  await mkdir(dir, { recursive: true })
  const dest = join(dir, name)
  if (await exists(dest)) return { dest, version, cached: true, verified: Boolean(sha) }
  const file = await fetch(url)
  if (!file.ok || !file.body) throw new Error('下载失败 HTTP ' + file.status)
  const fh = await open(dest, 'w')
  const hash = createHash('sha512')
  let bytes = 0
  for await (const chunk of file.body) { hash.update(chunk); await fh.write(chunk); bytes += chunk.length }
  await fh.close()
  const actual = hash.digest('base64')
  return { dest, version, bytes, verified: Boolean(sha) && actual === sha, shaMismatch: Boolean(sha) && actual !== sha }
}

function run(cmd, argv, cwd) {
  // Windows 下 npm/npx 是 .cmd，spawnSync 必须走 shell 才能执行
  return spawnSync(cmd, argv, { cwd, encoding: 'utf8', windowsHide: true, timeout: 180000, shell: process.platform === 'win32' })
}
async function backup(file) {
  if (DRY || !(await exists(file))) return
  await copyFile(file, `${file}.bak-${stamp}`)
}

console.log('\n一键恢复 QQ 桥接\n')
console.log(`  项目目录   ${ROOT}`)
console.log(`  DSH_HOME   ${DSH_HOME}`)
console.log(`  QQ / 群    ${QQ} / ${GROUP}`)
if (DRY) console.log('  模式       dry-run（不写文件）')
console.log('')

/* 1. 前置检查 */
const nodeMajor = Number(process.versions.node.split('.')[0])
step('Node ≥ 22', nodeMajor >= 22 ? 'OK' : 'FAIL', `v${process.versions.node}`)

const dshDir = await findDsh()
if (dshDir) {
  step('DSH 桌面端', 'OK', dshDir)
} else {
  step('DSH 桌面端', 'FAIL', '未安装')
  if (NO_DOWNLOAD) {
    console.log(`\n  官方安装包：${DSH_FEED}（清单里的 exe 链接可直接下）`)
  } else {
    try {
      console.log('\n  正在从官方源下载安装包（约 290MB，可能较慢）…')
      const got = await downloadDshInstaller()
      step('下载 DSH 安装包', got.shaMismatch ? 'FAIL' : 'OK',
        `${got.dest}${got.verified ? '（sha512 校验通过）' : got.cached ? '（已存在）' : '（未校验）'}`)
    } catch (error) {
      step('下载 DSH 安装包', 'FAIL', String(error?.message ?? error).slice(0, 160))
    }
  }
  console.log('\n  装好 DSH 并启动一次，然后重跑：node tools/setup.mjs\n')
  summary(); process.exit(1)
}

if (!(await exists(PROFILE))) {
  step('DSH desktop profile', 'FAIL', `找不到 ${PROFILE}，先启动一次 DSH 再重跑`)
  summary(); process.exit(1)
}
step('DSH desktop profile', 'OK', PROFILE)

/* 2. 插件：clone + 打补丁 */
if (!(await exists(VENDOR))) {
  if (DRY) {
    step('clone 插件', 'TODO', `${defaults.pluginRepo} → ${VENDOR}`)
  } else {
    await mkdir(dirname(VENDOR), { recursive: true })
    const clone = run('git', ['clone', defaults.pluginRepo, VENDOR])
    if (clone.status !== 0) { step('clone 插件', 'FAIL', (clone.stderr || '').trim().slice(0, 200)); summary(); process.exit(1) }
    run('git', ['checkout', '--quiet', defaults.pluginBaseline], VENDOR)
    step('clone 插件', 'OK', defaults.pluginBaseline)
  }
} else {
  step('clone 插件', 'SKIP', '已存在')
}

const indexFile = join(VENDOR, 'index.js')
if (await exists(indexFile)) {
  const code = await readFile(indexFile, 'utf8')
  if (code.includes('normalizeGroupWake')) {
    step('应用本地补丁', 'SKIP', '已有 normalizeGroupWake')
  } else if (DRY) {
    step('应用本地补丁', 'TODO', relative(ROOT, PATCH))
  } else {
    const check = run('git', ['apply', '--check', PATCH], VENDOR)
    if (check.status !== 0) {
      step('应用本地补丁', 'FAIL', (check.stderr || '补丁与当前上游不兼容').trim().slice(0, 200))
    } else {
      run('git', ['apply', PATCH], VENDOR)
      step('应用本地补丁', 'OK', '5 处改动')
    }
  }
} else {
  step('应用本地补丁', 'SKIP', '插件未就绪')
}

/* 3. profile 依赖 + bundle（幂等 JSON 编辑） */
const linkPath = VENDOR.replaceAll('\\', '/')
let pkg = null
try { pkg = JSON.parse(await readFile(PACKAGE, 'utf8')) } catch { /* 无 package.json */ }
if (!pkg) {
  step('注册到 desktop profile', 'FAIL', `读不到 ${PACKAGE}`)
} else {
  pkg.dependencies ??= {}
  pkg.dsh ??= {}
  pkg.dsh.profile ??= {}
  pkg.dsh.profile.bundles ??= []
  const needDep = pkg.dependencies['dsh-im-bridge'] !== `link:${linkPath}`
  const needBundle = !pkg.dsh.profile.bundles.includes('dsh-im-bridge')
  if (!needDep && !needBundle) {
    step('注册到 desktop profile', 'SKIP', '依赖与 bundle 都已存在')
  } else if (DRY) {
    step('注册到 desktop profile', 'TODO', needDep ? '加 link 依赖' : '补 bundles')
  } else {
    await backup(PACKAGE)
    pkg.dependencies['dsh-im-bridge'] = `link:${linkPath}`
    if (needBundle) pkg.dsh.profile.bundles.push('dsh-im-bridge')
    await writeFile(PACKAGE, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
    step('注册到 desktop profile', 'OK', '需重启桌面端生效')
  }
}

/* 4. cordis.patch.yml：im-bridge 配置 + mcp-browser */
const napcatDir = join(ROOT, 'tools', 'napcat', 'NapCat.52892.Shell')
const napcatLauncher = join(napcatDir, 'launcher-user.bat')
let cordis = ''
try { cordis = await readFile(CORDIS, 'utf8') } catch { /* 无配置文件 */ }
if (!cordis) {
  step('写 cordis.patch.yml', 'FAIL', `读不到 ${CORDIS}`)
} else {
  const blocks = []
  if (!cordis.includes('id: im-bridge')) {
    blocks.push(`
# QQ 桥接：NapCat 目录 + 群聊唤醒（由 tools/setup.mjs 生成）
- id: im-bridge
  name: dsh-im-bridge
  config:
    wsUrl: '${defaults.wsUrl}'
    accessToken: ''
    allowUsers: ['${QQ}']
    allowGroups: ['${GROUP}']
    groupRequireAt: true
    agentPreset: standard
    presetRev: '1'
    maxReplyChars: 1500
    napcat:
      dir: '${napcatDir.replaceAll('\\', '/')}'
      launcher: '${napcatLauncher.replaceAll('\\', '/')}'
    groupReplyAt: false
    groupWake:
      enabled: true
      probability: ${defaults.groupWake.probability}
      followMinutes: ${defaults.groupWake.followMinutes}
      bufferSize: ${defaults.groupWake.bufferSize}
      recentLimit: ${defaults.groupWake.recentLimit}
      nicknames: [${defaults.groupWake.nicknames.map((n) => `'${n}'`).join(', ')}]
`)
  }
  if (!cordis.includes('id: mcp-browser')) {
    const nodeExe = process.execPath.replaceAll('\\', '/')
    const mcpCli = (process.env.PLAYWRIGHT_MCP_CLI ?? join(dirname(nodeExe), 'node_modules', '@playwright', 'mcp', 'cli.js')).replaceAll('\\', '/')
    blocks.push(`
# 浏览器能力：Playwright MCP（insert 才是新增条目）
- insert:
    - id: mcp-browser
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: browser
        transport: stdio
        command: '${nodeExe}'
        args:
          - '${mcpCli}'
          - '--headless'
        toolCallTimeoutMs: 60000
        failOnStartupError: false
`)
  }
  if (blocks.length === 0) {
    step('写 cordis.patch.yml', 'SKIP', 'im-bridge 与 mcp-browser 都已存在')
  } else if (DRY) {
    step('写 cordis.patch.yml', 'TODO', `${blocks.length} 个条目`)
  } else {
    await backup(CORDIS)
    await writeFile(CORDIS, cordis.replace(/\s*$/, '') + '\n' + blocks.join(''), 'utf8')
    step('写 cordis.patch.yml', 'OK', `${blocks.length} 个条目`)
  }
}

/* 5. 人设：写进 settings.json（面板生效的那份） */
async function roleBody(file) {
  const text = await readFile(join(ROOT, file), 'utf8')
  return text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && !line.startsWith('>'))
    .join('\n')
    .trim()
}
let settings = null
try { settings = JSON.parse(await readFile(SETTINGS, 'utf8')) } catch { /* 插件还没跑过 */ }
if (!settings) {
  step('写入人设', 'SKIP', 'settings.json 不存在：先启动 DSH 让插件初始化，再重跑本脚本')
} else {
  settings.personae ??= []
  const wanted = [
    { ...defaults.personae.private, prompt: await roleBody(defaults.personae.private.file) },
    { ...defaults.personae.group, prompt: await roleBody(defaults.personae.group.file) },
  ]
  const missing = wanted.filter((w) => !settings.personae.some((p) => p.id === w.id))
  if (missing.length === 0) {
    step('写入人设', 'SKIP', '两份都已存在')
  } else if (DRY) {
    step('写入人设', 'TODO', missing.map((m) => m.id).join(', '))
  } else {
    await backup(SETTINGS)
    for (const m of missing) settings.personae.push({ id: m.id, name: m.name, preset: 'standard', prompt: m.prompt })
    if (!settings.activePersonaId) settings.activePersonaId = defaults.personae.private.id
    await writeFile(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8')
    step('写入人设', 'OK', missing.map((m) => m.id).join(', '))
  }
}

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

/* 6. Playwright MCP */
if (SKIP_MCP) {
  step('安装 Playwright MCP', 'SKIP', '--skip-mcp')
} else {
  const globalRoot = run(NPM, ['root', '-g'])
  const mcpDir = globalRoot.status === 0 ? join(globalRoot.stdout.trim(), '@playwright', 'mcp') : ''
  if (mcpDir && (await exists(mcpDir))) {
    step('安装 Playwright MCP', 'SKIP', '已安装')
  } else if (DRY) {
    step('安装 Playwright MCP', 'TODO', 'npm i -g @playwright/mcp')
  } else {
    const install = run(NPM, ['i', '-g', '@playwright/mcp'])
    step('安装 Playwright MCP', install.status === 0 ? 'OK' : 'FAIL', install.status === 0 ? '' : (install.stderr || '').slice(0, 160))
  }
}

/* 7. 语音：装 edge-tts 并开启 sweet 引擎（免费、在线合成） */
const PYLIB = join(DSH_HOME, 'im-bridge', 'pylib')
const DSH_PY = join(dshDir, 'resources', 'runtime', 'primary-runtime', 'dependencies', 'python', 'python.exe')
let voiceSettings = null
try { voiceSettings = JSON.parse(await readFile(SETTINGS, 'utf8')) } catch { /* 插件没跑过 */ }
let pythonPath = ''
for (const cand of [voiceSettings?.voice?.pythonPath, DSH_PY].filter(Boolean)) {
  if (await exists(cand)) { pythonPath = cand; break }
}
if (!pythonPath) {
  step('语音（edge-tts）', 'SKIP', '没找到 Python，跳过（可改用 sapi）')
} else {
  const hasEdge = await exists(join(PYLIB, 'edge_tts'))
  if (hasEdge) {
    step('语音（edge-tts）', 'SKIP', '已安装')
  } else if (DRY) {
    step('语音（edge-tts）', 'TODO', 'pip install --target pylib edge-tts')
  } else {
    const pip = run(pythonPath, ['-m', 'pip', 'install', '--target', PYLIB, 'edge-tts', '-q', '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple'])
    step('语音（edge-tts）', pip.status === 0 ? 'OK' : 'FAIL', pip.status === 0 ? '已安装' : (pip.stderr || '').slice(0, 140))
  }
  if (voiceSettings && !DRY) {
    const want = {
      enabled: true,
      engine: 'sweet',
      sweetPreset: 'sweet-girl',
      pythonPath: pythonPath.replaceAll('\\', '/'),
      pythonLib: PYLIB.replaceAll('\\', '/'),
    }
    const cur = voiceSettings.voice ?? {}
    if (cur.enabled !== true || cur.engine !== 'sweet' || cur.pythonPath !== want.pythonPath) {
      await backup(SETTINGS)
      voiceSettings.voice = { ...cur, ...want }
      await writeFile(SETTINGS, JSON.stringify(voiceSettings, null, 2) + '\n', 'utf8')
      step('开启语音', 'OK', 'sweet / 晓伊')
    } else {
      step('开启语音', 'SKIP', '已开启')
    }
  }
}

/* 8. NapCat 启动器 */
if (await exists(napcatDir)) {
  if (await exists(napcatLauncher)) {
    step('NapCat 启动器', 'SKIP', 'launcher-user.bat 已存在')
  } else if (DRY) {
    step('NapCat 启动器', 'TODO', napcatLauncher)
  } else {
    await writeFile(napcatLauncher, [
      '@echo off',
      'chcp 65001 >nul',
      'cd /d "%~dp0"',
      'set "NAPCAT_PATCH_PACKAGE=%cd%\\qqnt.json"',
      'set "NAPCAT_LOAD_PATH=%cd%\\loadNapCat.js"',
      'set "NAPCAT_INJECT_PATH=%cd%\\NapCatWinBootHook.dll"',
      'set "NAPCAT_LAUNCHER_PATH=%cd%\\NapCatWinBootMain.exe"',
      'set "NAPCAT_MAIN_PATH=%cd%\\napcat.mjs"',
      '"%NAPCAT_LAUNCHER_PATH%" "%cd%\\QQ.exe" "%NAPCAT_INJECT_PATH%" %*',
      'exit /b %ERRORLEVEL%',
      '',
    ].join('\r\n'), 'utf8')
    step('NapCat 启动器', 'OK', 'launcher-user.bat')
  }
} else {
  step('NapCat 启动器', 'SKIP', 'tools/napcat 不存在：NapCat 需单独下载')
}

summary()

function summary() {
  const failed = steps.filter((s) => s.status === 'FAIL')
  const todo = steps.filter((s) => s.status === 'TODO' || s.status === 'SKIP')
  console.log('\n  汇总：' + steps.map((s) => `${s.status}`).join(' '))
  if (failed.length) console.log(`  失败 ${failed.length} 项，见上。`)
  console.log(`
  接下来要人做：
    1. 启动 NapCat（tools\\napcat\\NapCat.52892.Shell\\napcat.quick.bat）并扫码登录
    2. 重启 DSH 桌面端（让 cordis.patch.yml 与插件依赖生效）
    3. 小号只充 30 元，不绑主卡
    4. 在 QQ 里私聊发一句，确认有回复

  验证：node cli.mjs status && node checks/check-patches.mjs
`)
  process.exit(failed.length ? 1 : 0)
}
