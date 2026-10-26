#!/usr/bin/env node
/**
 * 事实一致性检查：防止「选型/入口改了，关联文档没改」。
 *
 * 背景：本项目选型改过 4 次（Web /api → 插件适配 → 官方 Bot → cheems），
 * 每次只改主文档，残留的旧命令/旧结论散落在 ADR、任务卡、参考基线里。
 *
 * 规则：
 *   - 活跃文档（ACTIVE）出现旧事实 → 报错。
 *   - 历史文档（HISTORY）允许旧事实，但必须带「归档/已取代/历史」标记。
 *   - 其他文档：命中旧事实且无标记 → 报错。
 *
 * 用法：node checks/check-consistency.mjs [--json]
 * 退出码：0 = 一致；1 = 有冲突。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const JSON_MODE = process.argv.includes('--json')

const ACTIVE = new Set([
  'README.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/00-proposal.md',
  'docs/01-tech-selection.md',
  'docs/07-ux-spec.md',
  'docs/10-current-plan.md',
  'tasks/README.md',
  'tasks/10-onboard-env.md',
  'tasks/11-install-cheems.md',
  'tasks/12-persona.md',
  'tasks/13-allowance-browser.md',
  'config.example.json'
])

const HISTORY_MARK = /归档|历史|已取代|已否决|被推翻|旧结论|当时|修正记录/

const RULES = [
  {
    id: 'profile-web',
    re: /--profile\s+web/,
    msg: '装插件用 --profile desktop（桌面端）'
  },
  {
    id: 'npm-start',
    re: /npm\s+start/,
    msg: '当前方案不自己起桥接（npm start 是自建路线）'
  },
  {
    id: 'transport',
    re: /独立\s*transport|QQ\s*transport|插件适配层/,
    msg: '当前是 cheems 纯插件，没有独立 transport/适配层'
  },
  {
    id: 'desktop-version',
    re: /本机(实际)?是?\s*`?0\.2\.0-rc\.2`?/,
    msg: '本机桌面端已是 0.2.1-rc.3（CLI 才是 0.2.0-rc.2）'
  }
]

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', '.git', '.tmp'].includes(e.name)) continue
      out.push(...(await walk(p)))
    } else if (e.name.endsWith('.md')) {
      out.push(p)
    }
  }
  return out
}

const files = await walk(ROOT)
const conflicts = []
const missingMarks = []

for (const abs of files) {
  const rel = relative(ROOT, abs).replaceAll('\\', '/')
  if (rel.startsWith('.tmp/')) continue
  const text = await readFile(abs, 'utf8')
  const lines = text.split('\n')

  for (const rule of RULES) {
    const hits = []
    lines.forEach((line, i) => {
      if (rule.re.test(line)) hits.push({ line: i + 1, text: line.trim().slice(0, 100) })
    })
    if (hits.length === 0) continue

    if (ACTIVE.has(rel)) {
      // 活跃文档里的「历史修正记录」允许保留：命中行 ±3 行内有归档/历史标记则放行
      const contextual = hits.filter((h) => {
        const ctx = lines.slice(Math.max(0, h.line - 6), h.line + 3).join('\n')
        return !HISTORY_MARK.test(ctx)
      })
      if (contextual.length > 0) {
        conflicts.push({ file: rel, rule: rule.id, msg: rule.msg, hits: contextual })
      }
    } else if (!HISTORY_MARK.test(text)) {
      missingMarks.push({ file: rel, rule: rule.id, msg: '含旧事实但缺「归档/已取代」标记', hits })
    }
  }
}

const ok = conflicts.length === 0 && missingMarks.length === 0

if (JSON_MODE) {
  console.log(JSON.stringify({ ok, conflicts, missingMarks, files: files.length }, null, 2))
} else {
  console.log('\n事实一致性检查\n')
  console.log(`  扫描文件  ${files.length - 1} 个（不含 .tmp）`)
  if (conflicts.length === 0 && missingMarks.length === 0) {
    console.log('  结果      一致')
  }
  for (const c of conflicts) {
    console.log(`  ✗ ${c.file}:${c.hits[0].line}  ${c.msg}`)
    console.log(`      ${c.hits[0].text}`)
  }
  for (const m of missingMarks) {
    console.log(`  ? ${m.file}:${m.hits[0].line}  ${m.msg}`)
    console.log(`      ${m.hits[0].text}`)
  }
  console.log('')
}

process.exit(ok ? 0 : 1)
