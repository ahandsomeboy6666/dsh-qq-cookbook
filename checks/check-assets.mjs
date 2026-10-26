#!/usr/bin/env node
/**
 * 资产完整性检查：把「这个仓库的文档资产是否可开发、可验收」变成一条命令。
 *
 * 用法：
 *   node checks/check-assets.mjs            # 全量检查
 *   node checks/check-assets.mjs --json     # 机器可读输出
 *
 * 退出码：0 = 全绿；1 = 有红项。
 *
 * 检查的不是「文档写得好不好」，而是「文档是否具备开工条件」：
 *   - 必备文件是否齐（缺一篇就是红）
 *   - 任务卡五段是否齐、验收项是否带可执行命令
 *   - ADR 是否齐六段、状态是否在枚举里
 *   - 本地链接是否断、文档索引是否漏
 *   - 决策台账是否覆盖全部 ADR
 */
import { readFile, stat } from 'node:fs/promises'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const JSON_MODE = process.argv.includes('--json')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
}
function read(rel) {
  return readFile(join(ROOT, rel), 'utf8')
}
async function exists(rel) {
  try {
    await stat(join(ROOT, rel))
    return true
  } catch {
    return false
  }
}

/** 去掉代码块，避免把示例里的标题/链接当成真结构 */
function stripFences(md) {
  return md.replace(/```[\s\S]*?```/g, '')
}

// ---------------------------------------------------------------- 1. 必备文件
const REQUIRED = [
  'AGENTS.md',
  'README.md',
  'package.json',
  '.gitignore',
  '.gitmessage',
  'cli.mjs',
  'docs/templates/ci-check.yml',
  '.githooks/pre-commit',
  '.githooks/commit-msg',
  'docs/README.md',
  'docs/FACTS.md',
  'docs/00-proposal.md',
  'docs/01-tech-selection.md',
  'docs/02-architecture.md',
  'docs/03-threat-model.md',
  'docs/04-acceptance.md',
  'docs/05-roadmap.md',
  'docs/06-methodology.md',
  'docs/07-ux-spec.md',
  'docs/10-current-plan.md',
  'docs/decisions/README.md',
  'docs/decisions/ADR-001-qq-endpoint.md',
  'docs/decisions/ADR-002-dsh-access.md',
  'docs/decisions/ADR-003-process-shape.md',
  'docs/decisions/ADR-004-session-mapping.md',
  'docs/decisions/ADR-005-persona-layers.md',
  'docs/decisions/ADR-006-security.md',
  'docs/decisions/ADR-007-streaming.md',
  'docs/decisions/ADR-008-interrupt.md',
  'docs/decisions/ADR-009-model-routing.md',
  'docs/decisions/ADR-010-group-chat.md',
  'docs/decisions/ADR-011-onboarding.md',
  'docs/references/dsh-capability-matrix.md',
  'docs/references/prior-art.md',
  'docs/references/experience-scorecard.md',
  'docs/references/qq-bridge-baseline.md',
  'docs/templates/task-card.md',
  'docs/templates/proposal.md',
  'docs/templates/adr.md',
  'docs/templates/AGENTS.skeleton.md',
  'tasks/README.md',
  'tasks/01-probe-dsh.md',
  'tasks/02-minimal-loop.md',
  'tasks/03-qq-channel.md',
  'tasks/04-session-mapping.md',
  'tasks/05-security-baseline.md',
  'tasks/06-persona-layers.md',
  'tasks/07-ux-streaming.md',
  'tasks/08-interrupt.md',
  'tasks/09-multimodal.md',
  'tasks/10-onboard-env.md',
  'tasks/11-install-cheems.md',
  'tasks/12-persona.md',
  'tasks/13-allowance-browser.md',
  'checks/check-assets.mjs',
  'checks/check-consistency.mjs',
  'checks/probe-dsh.mjs',
  'checks/probe-onebot.mjs',
  'checks/check-install.mjs',
  'checks/check-persona.mjs',
  'checks/check-budget.mjs',
  'checks/check-browser.mjs',
  'config.example.json'
]

const missing = []
for (const rel of REQUIRED) {
  if (!(await exists(rel))) missing.push(rel)
}
check(
  `必备文件 ${REQUIRED.length} 个`,
  missing.length === 0,
  missing.length ? `缺：${missing.join('、')}` : ''
)

// ---------------------------------------------------------------- 2. 任务卡五段
const TASK_HEADINGS = ['目标', '输入', '输出', '验收', '不做什么']
const EXECUTABLE = /`(node|npm|npx|pwsh|powershell|python|git|dsh|curl|Invoke-WebRequest)\b/
let taskFiles = []
try {
  const { readdir } = await import('node:fs/promises')
  const files = await readdir(join(ROOT, 'tasks'))
  taskFiles = files.filter(f => /^\d{2}-.+\.md$/.test(f)).sort()
} catch {}

if (taskFiles.length === 0) {
  check('任务卡存在', false, 'tasks/ 下没有 NN-*.md')
} else {
  check(`任务卡数量 ${taskFiles.length} 张`, taskFiles.length >= 6, taskFiles.length < 6 ? `只有 ${taskFiles.length} 张，至少 6 张` : '')
}

for (const file of taskFiles) {
  const md = stripFences(await read(`tasks/${file}`))
  const missingHeads = TASK_HEADINGS.filter(h => !new RegExp(`^##\\s+${h}\\s*$`, 'm').test(md))
  check(`tasks/${file} 五段`, missingHeads.length === 0, missingHeads.length ? `缺：${missingHeads.join('、')}` : '')

  const acceptBlock = md.split(/^##\s+验收\s*$/m)[1]?.split(/^##\s+/m)[0] ?? ''
  const items = acceptBlock.split('\n').filter(l => /^\s*-\s*\[[ x]\]/.test(l))
  const runnable = items.filter(l => EXECUTABLE.test(l))
  check(
    `tasks/${file} 验收可执行`,
    items.length >= 1 && runnable.length === items.length,
    items.length === 0
      ? '验收段没有 - [ ] 条目'
      : runnable.length !== items.length
        ? `${items.length} 条验收里 ${items.length - runnable.length} 条没有可执行命令`
        : ''
  )

  const goal = md.match(/^##\s+目标\s*\n+([^\n]+)/m)?.[1]?.trim() ?? ''
  check(
    `tasks/${file} 目标一句话`,
    goal.length > 0 && goal.length <= 60,
    goal.length === 0 ? '目标为空' : goal.length > 60 ? `目标 ${goal.length} 字，超过 60` : ''
  )
}

// ---------------------------------------------------------------- 3. ADR 结构
const ADR_STATES = ['待确认', '已接受', '已验证', '已否决', '已取代']
const ADR_SECTIONS = ['状态', '背景', '决策', '理由', '风险与缓解', '验证']
let adrFiles = []
try {
  const { readdir } = await import('node:fs/promises')
  const files = await readdir(join(ROOT, 'docs/decisions'))
  adrFiles = files.filter(f => /^ADR-\d{3}-.+\.md$/.test(f)).sort()
} catch {}

if (adrFiles.length === 0) {
  check('ADR 存在', false, 'docs/decisions/ 下没有 ADR-NNN-*.md')
}
for (const file of adrFiles) {
  const md = stripFences(await read(`docs/decisions/${file}`))
  const missingSec = ADR_SECTIONS.filter(s => !new RegExp(`^##\\s+${s}`, 'm').test(md))
  check(`decisions/${file} 六段`, missingSec.length === 0, missingSec.length ? `缺：${missingSec.join('、')}` : '')

  const state = md.match(/^##\s+状态\s*\n+([^\n]+)/m)?.[1]?.trim() ?? ''
  const hit = ADR_STATES.find(s => state.startsWith(s))
  check(`decisions/${file} 状态合法`, Boolean(hit), hit ? '' : `状态是「${state}」，不在 ${ADR_STATES.join('/')} 里`)
}

// ---------------------------------------------------------------- 4. 本地链接
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const mdFiles = [...REQUIRED.filter(f => f.endsWith('.md')), ...taskFiles.map(f => `tasks/${f}`)]
let broken = []
for (const file of mdFiles) {
  if (!(await exists(file))) continue
  const md = stripFences(await read(file))
  for (const match of md.matchAll(LINK_RE)) {
    const target = match[1]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const clean = target.split('#')[0]
    if (!clean) continue
    const abs = resolve(dirname(join(ROOT, file)), clean)
    if (!(await exists(relative(ROOT, abs)))) {
      broken.push(`${file} → ${target}`)
    }
  }
}
check('本地 Markdown 链接', broken.length === 0, broken.length ? broken.slice(0, 8).join('；') : '')

// ---------------------------------------------------------------- 5. 文档索引覆盖
try {
  const { readdir } = await import('node:fs/promises')
  const index = await read('docs/README.md')
  const topDocs = (await readdir(join(ROOT, 'docs'), { withFileTypes: true }))
    .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map(e => `docs/${e.name}`)
  const uncovered = topDocs.filter(p => !index.includes(p))
  check('docs/README.md 索引覆盖', uncovered.length === 0, uncovered.length ? `漏：${uncovered.join('、')}` : '')

  const decisions = (await readdir(join(ROOT, 'docs/decisions')))
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(f => `docs/decisions/${f}`)
  const uncoveredAdr = decisions.filter(p => !index.includes(p))
  check('docs/README.md 覆盖 ADR', uncoveredAdr.length === 0, uncoveredAdr.length ? `漏：${uncoveredAdr.join('、')}` : '')
} catch (err) {
  check('docs/README.md 索引覆盖', false, String(err.message))
}

// ---------------------------------------------------------------- 6. 决策台账覆盖
try {
  const ledger = await read('docs/decisions/README.md')
  const uncovered = adrFiles.filter(f => !ledger.includes(f.replace(/\.md$/, '')) && !ledger.includes(f))
  check('决策台账覆盖全部 ADR', uncovered.length === 0, uncovered.length ? `台账没登记：${uncovered.join('、')}` : '')
} catch (err) {
  check('决策台账覆盖全部 ADR', false, String(err.message))
}

// ---------------------------------------------------------------- 7. 版本基线
try {
  const ts = await read('docs/01-tech-selection.md')
  const hasInstalled = ts.includes('0.2.0-rc.2')
  const hasSource = ts.includes('0.1.7-rc.2')
  check('选型标注版本基线', hasInstalled && hasSource, `本机 0.2.0-rc.2=${hasInstalled}，源码 0.1.7-rc.2=${hasSource}`)
} catch (err) {
  check('选型标注版本基线', false, String(err.message))
}

// ---------------------------------------------------------------- 8. AGENTS.md 必读表
try {
  const agents = await read('AGENTS.md')
  const section = agents.split(/^##\s+二、开工前必读\s*$/m)[1]?.split(/^##\s+/m)[0] ?? ''
  const tableRows = section
    .split('\n')
    .filter(l => /^\|\s*(\[[^\]]+\]\([^)]+\)|`[^`]+`)\s*\|/.test(l))
  const paths = tableRows
    .map(l => l.match(/^\|\s*\[[^\]]+\]\(([^)]+)\)/)?.[1] ?? l.match(/^\|\s*`([^`]+)`/)?.[1])
    .filter(p => p && !/^https?:/.test(p))
  const notExist = []
  for (const p of paths) {
    if (!(await exists(p))) notExist.push(p)
  }
  check('AGENTS.md 必读表路径存在', paths.length >= 4 && notExist.length === 0, notExist.length ? `不存在：${notExist.join('、')}` : paths.length === 0 ? '表里没有路径' : '')
} catch (err) {
  check('AGENTS.md 必读表路径存在', false, String(err.message))
}

// ---------------------------------------------------------------- 9. README 脚本数量
try {
  const { readdir } = await import('node:fs/promises')
  const scripts = (await readdir(join(ROOT, 'checks'))).filter(f => f.endsWith('.mjs'))
  const readme = await read('README.md')
  const declared = Number(readme.match(/检查脚本（(\d+) 个）/)?.[1] ?? NaN)
  check('README 检查脚本数量', declared === scripts.length, `README 写 ${Number.isNaN(declared) ? '未写' : declared}，实际 ${scripts.length}`)
} catch (err) {
  check('README 检查脚本数量', false, String(err.message))
}

// ---------------------------------------------------------------- 10. 事实台账
try {
  const facts = await read('docs/FACTS.md')
  const missing = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].filter((id) => !facts.includes(`| ${id} |`))
  check('FACTS.md 覆盖 F1–F6', missing.length === 0, missing.length ? `缺：${missing.join('、')}` : '')
} catch (err) {
  check('FACTS.md 覆盖 F1–F6', false, String(err.message))
}

// ---------------------------------------------------------------- 11. ADR ↔ 台账
try {
  const ledger = await read('docs/decisions/README.md')
  const rows = ledger.split('\n').filter(l => /^\|\s*\[ADR-\d{3}-[^\]]+\]\([^)]+\)/.test(l))
  const mismatches = []
  for (const row of rows) {
    const cells = row.split('|').map(s => s.trim())
    const file = (cells[1] ?? '').match(/\(([^)]+)\)/)?.[1]
    const ledgerState = cells[cells.length - 2] ?? ''
    if (!file?.endsWith('.md')) continue
    const md = await read(`docs/decisions/${file}`).catch(() => '')
    const state = md.match(/^##\s+状态\s*\n+([^\n]+)/m)?.[1]?.trim() ?? ''
    const first = state.match(/^(待确认|已接受|已验证|已否决|已取代)/)?.[1]
    if (!first || !ledgerState.includes(first)) {
      mismatches.push(`${file}: 台账「${ledgerState}」vs ADR「${first ?? '无'}」`)
    }
  }
  check('ADR 状态与台账一致', mismatches.length === 0, mismatches.join('；'))
} catch (err) {
  check('ADR 状态与台账一致', false, String(err.message))
}

// ---------------------------------------------------------------- 12. 任务卡脚本存在
try {
  const pkg = JSON.parse(await read('package.json'))
  const scripts = new Set(Object.keys(pkg.scripts ?? {}))
  const missing = []
  const activeTasks = taskFiles.filter(f => Number.parseInt(f.slice(0, 2), 10) >= 10)
  for (const file of activeTasks) {
    const md = await read(`tasks/${file}`)
    const accept = md.split(/^##\s+验收\s*$/m)[1]?.split(/^##\s+/m)[0] ?? ''
    for (const m of accept.matchAll(/`([^`]+)`/g)) {
      const cmd = m[1].trim()
      const nodeHit = cmd.match(/^node\s+([^\s]+)/)
      if (nodeHit && !nodeHit[1].startsWith('-')) {
        const p = nodeHit[1].replace(/^\.\//, '')
        if (!(await exists(p))) missing.push(`${file}: ${p}`)
      }
      const npmHit = cmd.match(/^npm run\s+([^\s]+)/)
      if (npmHit && !scripts.has(npmHit[1])) missing.push(`${file}: npm run ${npmHit[1]}`)
    }
  }
  check('任务卡引用的脚本存在', missing.length === 0, missing.join('；'))
} catch (err) {
  check('任务卡引用的脚本存在', false, String(err.message))
}

// ---------------------------------------------------------------- 13. FACTS 真源存在
try {
  const facts = await read('docs/FACTS.md')
  const rows = facts.split('\n').filter(l => /^\|\s*F\d+\s*\|/.test(l))
  const missing = []
  for (const row of rows) {
    const cells = row.split('|').map(s => s.trim())
    const sourceCell = cells[4] ?? ''
    const paths = [
      ...[...sourceCell.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]),
      ...[...sourceCell.matchAll(/`([^`]+)`/g)].map(m => m[1])
    ]
    for (const p of paths) {
      if (/^https?:/.test(p)) continue
      const ok = (await exists(p)) || (await exists(join('docs', p)))
      if (!ok) missing.push(p)
    }
  }
  check('FACTS 真源存在', missing.length === 0, [...new Set(missing)].join('、'))
} catch (err) {
  check('FACTS 真源存在', false, String(err.message))
}

// ---------------------------------------------------------------- 14. FACTS 引用点内容
try {
  const facts = await read('docs/FACTS.md')
  const rows = facts.split('\n').filter(l => /^\|\s*F\d+\s*\|/.test(l))
  const problems = []
  for (const row of rows) {
    const cells = row.split('|').map(s => s.trim())
    const id = cells[1]
    const sourceCell = cells[4] ?? ''
    const refCell = cells[5] ?? ''
    const keyword = (cells[6] ?? '').replace(/`/g, '')
    const sourcePath = sourceCell.match(/\]\(([^)]+)\)/)?.[1] ?? sourceCell.match(/`([^`]+)`/)?.[1] ?? ''
    const sourceNeedle = sourcePath.split('/').slice(-2).join('/')
    const refs = [...refCell.matchAll(/`([^`]+)`/g)].map(m => m[1])
    for (const ref of refs) {
      const text = await read(ref).catch(() => null)
      if (text === null) {
        problems.push(`${id}: 引用点不存在 ${ref}`)
        continue
      }
      if (keyword && text.includes(keyword)) continue
      if (sourceNeedle && text.includes(sourceNeedle)) continue
      problems.push(`${id}: ${ref} 既没有「${keyword}」也没有真源「${sourceNeedle}」`)
    }
  }
  check('FACTS 引用点真实引用', problems.length === 0, problems.join('；'))
} catch (err) {
  check('FACTS 引用点真实引用', false, String(err.message))
}

// ---------------------------------------------------------------- 输出
const passed = results.filter(r => r.ok).length
const failed = results.length - passed

if (JSON_MODE) {
  console.log(JSON.stringify({ passed, failed, results }, null, 2))
} else {
  const C = process.stdout.isTTY ? { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', x: '\x1b[0m' } : { g: '', r: '', d: '', x: '' }
  console.log(`\n${C.d}dsh-qq-cookbook 资产检查${C.x}\n`)
  for (const r of results) {
    const mark = r.ok ? `${C.g}PASS${C.x}` : `${C.r}FAIL${C.x}`
    console.log(`  [${mark}] ${r.name}${r.detail ? `\n         ${C.d}${r.detail}${C.x}` : ''}`)
  }
  const verdict = failed === 0 ? `${C.g}全绿${C.x}` : `${C.r}红：${failed} 项不合格${C.x}`
  console.log(`\n汇总：PASS ${passed} / FAIL ${failed} → ${verdict}\n`)
}

process.exit(failed === 0 ? 0 : 1)
