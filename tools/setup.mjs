#!/usr/bin/env node
/**
 * 一键恢复：把 clone 下来的 cookbook 变成一台能跑的 QQ 桥接。
 *
 *   node tools/setup.mjs                    # 交互（会问 QQ 号 / 群号）
 *   node tools/setup.mjs --dry-run          # 只报告要做什么
 *   node tools/setup.mjs --qq 123 --group 456
 *   node tools/setup.mjs --skip-mcp         # 不装 Playwright MCP
 *   node tools/setup.mjs --install-napcat   # 缺 NapCat 时自动跑官方安装器（约 300MB）
 *   node tools/setup.mjs --no-download      # DSH 没装时只给地址
 *
 * 幂等：已完成的步骤会跳过。会备份被改的文件（*.bak-<时间戳>）。
 *
 * 仍然需要人做的两件事（脚本不做，只提示）：
 *   1. 启动 NapCat 并扫码登录
 *   2. 小号只充 30 元
 */
import { readFile, writeFile, copyFile, readdir, mkdir, access, open, rm } from 'node:fs/promises'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join, dirname, relative } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
/** 取 `--key value` 的值（函数声明会提升，下面的常量可以先用）。 */
function argValue(name) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : ''
}
const DRY = args.includes('--dry-run')
const SKIP_MCP = args.includes('--skip-mcp')
const NO_DOWNLOAD = args.includes('--no-download')
const INSTALL_NAPCAT = args.includes('--install-napcat')
// GitHub 在国内经常连不上：直连失败就自动换镜像。
// 顺序：GITHUB_MIRROR 环境变量 > --mirror 参数 > 直连 > 常用镜像。
const MIRROR_ARG = argValue('--mirror') || process.env.GITHUB_MIRROR || ''
// 顺序来自实测（2026-10-30）：gh-proxy / ghfast 通，ghproxy.net 常超时，所以放最后。
const MIRROR_PREFIXES = [MIRROR_ARG, '', 'https://gh-proxy.com/', 'https://ghfast.top/', 'https://ghproxy.net/']
// 桌面端官方更新源（来自已安装的 resources/app-update.yml）
const DSH_FEED = 'https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml'

/** 同一个 GitHub 地址的直连与各镜像写法（去重、保序）。 */
function githubCandidates(url) {
  const list = []
  for (const prefix of MIRROR_PREFIXES) {
    const candidate = prefix === '' ? url : prefix + url
    if (!list.includes(candidate)) list.push(candidate)
  }
  return list
}
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback
}

const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? homedir(), '.dsh')
const PROFILE = join(DSH_HOME, 'profiles', 'desktop')
const CORDIS = join(PROFILE, 'cordis.patch.yml')
const PACKAGE = join(PROFILE, 'package.json')
const SETTINGS = join(DSH_HOME, 'im-bridge', 'settings.json')
const VENDOR = join(ROOT, 'vendor', 'dsh-im-bridge')
const PATCH = join(ROOT, 'patches', 'dsh-im-bridge-1.19.0-local.patch')

const defaults = JSON.parse(await readFile(join(ROOT, 'config', 'defaults.json'), 'utf8'))
let QQ = String(opt('--qq', defaults.qq ?? '')).trim()
let GROUP = String(opt('--group', defaults.group ?? '')).trim()
// 交互补齐：只有真实终端才问，避免脚本/CI 卡住
if (!DRY && (!QQ || GROUP === '') && process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  if (!QQ) QQ = (await rl.question('  你的 QQ 号（主人号 / 白名单，只回这个人；不是机器人小号）：')).trim()
  if (GROUP === '') GROUP = (await rl.question('  要接的 QQ 群号（回车跳过，不接群）：')).trim()
  rl.close()
}
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

/** 找已安装的 NapCat 目录（含 napcat.bat 的 *Shell* 子目录）；没有返回空串 */
async function findNapcat() {
  const base = join(ROOT, 'tools', 'napcat')
  if (!(await exists(base))) return ''
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(base, entry.name)
    if ((await exists(join(dir, 'napcat.bat'))) || (await exists(join(dir, 'launcher-user.bat')))) return dir
  }
  return ''
}

/**
 * NapCat 实际注入的是 `napcat.quick.bat` 里写死的 `%cd%\QQ.exe`——
 * 也就是它自己目录里的 QQ，而不是系统里装的那个。
 * 所以判断的是「目录里有没有自带 QQ」，不是「系统 QQ 版本是否相等」。
 */
function napcatBundledQQ(dir) {
  if (!dir) return ''
  const exe = join(dir, 'QQ.exe')
  if (!existsSync(exe)) return ''
  try {
    const v = spawnSync('powershell.exe', ['-NoProfile', '-Command',
      `(Get-Item '${exe}').VersionInfo.FileVersion`], { encoding: 'utf8', windowsHide: true, timeout: 15000 })
    return String(v.stdout ?? '').trim()
  } catch {
    return '未知版本'
  }
}

/** NapCat 补丁描述里声明的 QQ 版本（qqnt.json），仅作参考，不当作硬性要求。 */
function napcatPatchQQVersion(dir) {
  if (!dir) return ''
  try {
    const raw = readFileSync(join(dir, 'qqnt.json'), 'utf8')
    return String(JSON.parse(raw)?.version ?? '')
  } catch {
    return ''
  }
}

/** 本机装的 QQ 版本：注册表优先，退回到常见安装路径的 exe 版本。 */
function detectInstalledQQ() {
  // Node 没有原生注册表 API，用 PowerShell 读最稳。
  const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    "$p=Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'QQ' } | Select-Object -First 1; if($p){$p.DisplayVersion}"],
  { encoding: 'utf8', windowsHide: true, timeout: 20000 })
  const fromReg = String(ps.stdout ?? '').trim()
  if (/^\d+\.\d+\.\d+/.test(fromReg)) return fromReg
  for (const exe of ['D:\\Program Files\\QQ.exe', 'C:\\Program Files\\Tencent\\QQNT\\QQ.exe', 'C:\\Program Files (x86)\\Tencent\\QQNT\\QQ.exe']) {
    if (!existsSync(exe)) continue
    try {
      const v = spawnSync('powershell.exe', ['-NoProfile', '-Command',
        `(Get-Item '${exe}').VersionInfo.FileVersion`], { encoding: 'utf8', windowsHide: true, timeout: 15000 })
      const got = String(v.stdout ?? '').trim()
      if (/^\d+\.\d+\.\d+/.test(got)) return got
    } catch { /* ignore */ }
  }
  return ''
}

/** 9.9.35-52892 与 9.9.35.52892 视为同版本；只比前三段。 */
function sameQQVersion(a, b) {
  const pick = (v) => String(v).split(/[-.]/).slice(0, 3).join('.')
  return pick(a) === pick(b)
}

/** 系统里装的 QQ 版本（只用于提示，不影响 NapCat 注入哪个 QQ）。 */

/** 下载 NapCat 的 OneKey 包（约 1MB，内部是安装器）并解压到 tools/napcat */
async function downloadNapcatOneKey() {
  const url = `https://github.com/${defaults.napcatRepo}/releases/latest/download/NapCat.Shell.Windows.OneKey.zip`
  const dir = join(ROOT, 'tools', 'napcat')
  await mkdir(dir, { recursive: true })
  const zip = join(dir, 'NapCat.OneKey.zip')
  // 同样走镜像 fallback：release 下载在国内也经常断。1MB 的包给 60 秒，20 秒不够。
  let res = null
  let lastError = ''
  const tried = []
  for (const candidate of githubCandidates(url)) {
    tried.push(candidate)
    try {
      const attempt = await fetch(candidate, { signal: AbortSignal.timeout(60000) })
      if (attempt.ok && attempt.body) { res = attempt; break }
      lastError = `HTTP ${attempt.status}`
    } catch (error) {
      lastError = String(error?.message ?? error).slice(0, 120)
    }
    console.log(`        下载失败，换下一个源…（${candidate.replace(/^https:\/\//, '').slice(0, 50)}）`)
  }
  if (res === null) throw new Error(`试过 ${tried.length} 个源都失败（最后错误：${lastError}）；可加 --mirror https://gh-proxy.com/ 或设 GITHUB_MIRROR`)
  const fh = await open(zip, 'w')
  let bytes = 0
  for await (const chunk of res.body) { await fh.write(chunk); bytes += chunk.length }
  await fh.close()
  const unzip = run('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`])
  if (unzip.status !== 0) throw new Error('解压失败：' + String(unzip.stderr ?? '').slice(0, 120))
  await rm(zip, { force: true })
  return { dir, bytes }
}

/** 跑 NapCat 官方安装器（会下载 QQ，约 300MB） */
function runNapcatInstaller(dir) {
  const installer = join(dir, 'NapCatInstaller.exe')
  if (!existsSync(installer)) return { status: -1, stderr: '找不到 NapCatInstaller.exe' }
  return spawnSync(installer, [], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: false,
    timeout: 30 * 60 * 1000,
  })
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
console.log(`  主人号 / 群  ${QQ || '(未填)'} / ${GROUP || '(不接群)'}`)
if (DRY) console.log('  模式       dry-run（不写文件）')
console.log('')

if (!QQ || !/^\d{5,12}$/.test(QQ)) {
  if (DRY) {
    QQ = '000000000'
    console.log('  (dry-run：未提供 --qq，用占位号展示步骤)')
    console.log('')
  } else {
    console.error('  缺少或非法的 QQ 号。这是白名单——只回这个人。')
    console.error('  用法：node tools/setup.mjs --qq 123456789 [--group 123456]')
    process.exit(1)
  }
}
if (GROUP && !/^\d{5,12}$/.test(GROUP)) {
  console.error(`  群号格式不对：${GROUP}（要么留空，要么 5-12 位数字）`)
  process.exit(1)
}

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
    // 直连失败就换镜像；每次失败都清掉半成品目录，否则下一次 clone 会报「已存在」。
    let lastError = ''
    let usedMirror = ''
    let ok = false
    for (const candidate of githubCandidates(defaults.pluginRepo)) {
      const clone = run('git', ['clone', '--quiet', candidate, VENDOR])
      if (clone.status === 0) { usedMirror = candidate; ok = true; break }
      lastError = (clone.stderr || clone.error?.message || '').trim().slice(0, 200)
      rmSync(VENDOR, { recursive: true, force: true })
      if (!DRY) console.log(`        直连失败，换下一个源…（${candidate.slice(0, 60)}）`)
    }
    if (!ok) {
      step('clone 插件', 'FAIL', lastError || '所有源都失败')
      console.log('        可以指定镜像：--mirror https://ghproxy.net/   或设 GITHUB_MIRROR')
      summary(); process.exit(1)
    }
    run('git', ['checkout', '--quiet', defaults.pluginBaseline], VENDOR)
    step('clone 插件', 'OK', usedMirror === defaults.pluginRepo ? defaults.pluginBaseline : `${defaults.pluginBaseline}（走镜像）`)
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
      // 数量从补丁本身数，别写死——补丁一直在长（现在 22 处）。
      let hunks = 0
      let files = 0
      try {
        const text = await readFile(PATCH, 'utf8')
        hunks = (text.match(/^@@/gm) ?? []).length
        files = (text.match(/^diff --git /gm) ?? []).length
      } catch { /* 读不到就只报状态 */ }
      step('应用本地补丁', 'OK', `${files} 个文件 / ${hunks} 处改动`)
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

/* 4. NapCat：检测 → 下载 OneKey 安装器 → 可选自动安装 */
let napcatDir = await findNapcat()
if (napcatDir) {
  step('NapCat 本体', 'SKIP', napcatDir)
} else if (DRY) {
  step('NapCat 本体', 'TODO', '下载 OneKey（约 1MB），--install-napcat 时自动装 QQ + NapCat（约 300MB）')
} else {
  try {
    const got = await downloadNapcatOneKey()
    step('下载 NapCat 安装包', 'OK', `${(got.bytes / 1024).toFixed(0)}KB → ${got.dir}`)
  } catch (error) {
    step('下载 NapCat 安装包', 'FAIL', String(error?.message ?? error).slice(0, 140))
  }
  if (INSTALL_NAPCAT) {
    const r = runNapcatInstaller(join(ROOT, 'tools', 'napcat'))
    step('安装 NapCat', r.status === 0 ? 'OK' : 'FAIL', r.status === 0 ? '已下载 QQ 并部署' : String(r.stderr ?? '').slice(0, 120))
    napcatDir = await findNapcat()
  } else {
    step('安装 NapCat', 'TODO', '双击 tools/napcat/NapCatInstaller.exe，或加 --install-napcat')
  }
}
const napcatLauncher = napcatDir === '' ? '' : join(napcatDir, 'launcher-user.bat')

/* 4.5 QQ 版本 vs NapCat 版本：对不上就会「一注入就崩」（0x80000003） */
{
  const bundled = napcatBundledQQ(napcatDir)
  const patchVer = napcatPatchQQVersion(napcatDir)
  const systemQQ = detectInstalledQQ()
  if (napcatDir === '') {
    step('NapCat 自带 QQ', 'SKIP', '还没装 NapCat，装好后重跑本脚本会检查')
  } else if (bundled === '') {
    // 关键：没有自带 QQ 时，launcher 会去找系统 QQ——那里的版本和 hook 对不上就会崩。
    step('NapCat 自带 QQ', 'FAIL', `目录里没有 QQ.exe（${napcatDir}）`)
    console.log('        NapCat 的 launcher 启动的是它自己目录里的 QQ.exe；缺了就会退到系统 QQ，')
    console.log('        版本对不上会在 1 秒内崩（QQNT.dll / 0x80000003）。')
    console.log('        用 --install-napcat 重装 OneKey，或手动把匹配版本的 QQ 解压到这个目录。')
  } else {
    const patchNote = patchVer === '' ? '' : `，补丁面向 ${patchVer}`
    step('NapCat 自带 QQ', 'OK', `${bundled}（实际注入的就是它${patchNote}）`)
    if (systemQQ !== '' && !sameQQVersion(systemQQ, bundled)) {
      console.log(`        提示：系统里的 QQ 是 ${systemQQ}，NapCat 不会用它，互不影响。`)
    }
  }
}

/* 5. cordis.patch.yml：im-bridge 配置 + mcp-browser */
// 新机器上 DSH 还没跑过，这个文件可能压根不存在——那就当空文件新建，不能直接 FAIL。
let cordis = ''
let cordisExisted = true
try { cordis = await readFile(CORDIS, 'utf8') } catch { cordisExisted = false }
if (!cordisExisted) {
  await mkdir(dirname(CORDIS), { recursive: true })
  cordis = ''
}
if (true) {
  const blocks = []
  if (!cordis.includes('id: im-bridge')) {
    const groupLine = GROUP ? `    allowGroups: ['${GROUP}']` : '    allowGroups: []'
    const napcatBlock = napcatDir
      ? `    napcat:\n      dir: '${napcatDir.replaceAll('\\', '/')}'\n      launcher: '${(napcatLauncher || join(napcatDir, 'launcher-user.bat')).replaceAll('\\', '/')}'`
      : '    # NapCat 还没装：装好后重跑本脚本会自动补上目录'
    blocks.push(`
# QQ 桥接：NapCat 目录 + 群聊唤醒（由 tools/setup.mjs 生成）
- id: im-bridge
  name: dsh-im-bridge
  config:
    wsUrl: '${defaults.wsUrl}'
    accessToken: ''
    allowUsers: ['${QQ}']
${groupLine}
    groupRequireAt: true
    agentPreset: standard
    presetRev: '1'
    maxReplyChars: 1500
${napcatBlock}
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
    step('写 cordis.patch.yml', 'OK', `${blocks.length} 个条目${cordisExisted ? '' : '（新建文件）'}`)
  }
}

/* 5. 人设：写进 settings.json，并把会话绑到对应角色 */
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
  settings.contactProfiles ??= {}
  const wanted = [
    { ...defaults.personae.private, prompt: await roleBody(defaults.personae.private.file) },
    { ...defaults.personae.group, prompt: await roleBody(defaults.personae.group.file) },
  ]
  const missing = wanted.filter((w) => !settings.personae.some((p) => p.id === w.id))
  // 首次安装（还没有任何人设）时，顺带写入面板侧的体验参数（maxBubbles 等）。
  // 已经配过的机器不覆盖，避免改掉别人的偏好。
  const isFresh = settings.personae.length === 0
  // 绑定：私聊用软的人设，群用贴吧人设；不绑的话新群会套用全局默认
  const binds = []
  if (QQ) binds.push([`private:${QQ}`, defaults.personae.private.id])
  if (GROUP) binds.push([`group:${GROUP}`, defaults.personae.group.id])
  const needBind = binds.filter(([key, id]) => settings.contactProfiles[key]?.personaId !== id)
  if (missing.length === 0 && needBind.length === 0 && !isFresh) {
    step('写入人设', 'SKIP', '角色与绑定都已存在')
  } else if (DRY) {
    step('写入人设', 'TODO', `补角色 ${missing.length} 个、绑定 ${needBind.length} 个`)
  } else {
    await backup(SETTINGS)
    for (const m of missing) settings.personae.push({ id: m.id, name: m.name, preset: 'standard', prompt: m.prompt })
    for (const [key, id] of needBind) {
      settings.contactProfiles[key] = { ...(settings.contactProfiles[key] ?? {}), personaId: id }
    }
    if (!settings.activePersonaId) settings.activePersonaId = defaults.personae.private.id
    if (isFresh && defaults.settings) {
      for (const [section, values] of Object.entries(defaults.settings)) {
        settings[section] = { ...(settings[section] ?? {}), ...values }
      }
    }
    await writeFile(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8')
    step('写入人设', 'OK', `角色 ${missing.length} 个；会话绑定 ${needBind.length} 个${isFresh ? '；首次安装写入面板参数' : ''}`)
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
    if (cur.enabled === true && cur.engine) {
      // 已经配过（比如 MiniMax 克隆音色）：只补 Python 路径，绝不覆盖引擎
      if (cur.pythonPath === want.pythonPath) {
        step('语音配置', 'SKIP', `引擎 ${cur.engine}`)
      } else {
        await backup(SETTINGS)
        voiceSettings.voice = { ...cur, pythonPath: want.pythonPath, pythonLib: want.pythonLib }
        await writeFile(SETTINGS, JSON.stringify(voiceSettings, null, 2) + '\n', 'utf8')
        step('语音配置', 'OK', `保留 ${cur.engine}，补 Python 路径`)
      }
    } else if (cur.enabled !== true || cur.engine !== 'sweet' || cur.pythonPath !== want.pythonPath) {
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
if (napcatDir === '') {
  step('NapCat 启动器', 'SKIP', 'NapCat 还没装，装好后重跑本脚本')
} else if (await exists(napcatLauncher)) {
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

summary()

function summary() {
  const failed = steps.filter((s) => s.status === 'FAIL')
  console.log('\n  汇总：' + steps.map((s) => `${s.status}`).join(' '))
  if (failed.length) console.log(`  失败 ${failed.length} 项，见上。`)
  const napcatHint = napcatDir
    ? `启动 NapCat（${napcatDir} 下的 napcat.quick.bat）并扫码登录`
    : '装 NapCat（解压后的 tools/napcat 里跑 NapCatInstaller.exe），再扫码登录'
  // 第一次装的时候 settings.json 还不存在，人设写不进去——必须提示「启动后再跑一次」。
  const personaSkipped = steps.some((s) => s.name === '写入人设' && s.status === 'SKIP' && /settings\.json/.test(s.detail ?? ''))
  console.log(`
  接下来要人做：
    1. ${napcatHint}
    2. 重启 DSH 桌面端（让 cordis.patch.yml 与插件依赖生效）${personaSkipped ? '\n       然后**再跑一次本脚本**：人设要等插件初始化后才有地方写' : ''}
    3. 小号只充 30 元，不绑主卡
    4. 在 QQ 里私聊发一句，确认有回复

  验证：node cli.mjs status && node checks/check-patches.mjs && node checks/check-behavior.mjs
`)
  process.exit(failed.length ? 1 : 0)
}
