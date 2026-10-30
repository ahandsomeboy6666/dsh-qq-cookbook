#!/usr/bin/env node
/**
 * 人设检查：私聊/群聊两套人设是否存在、长度是否越界、有没有写工具用法。
 *
 * 用法：node checks/check-persona.mjs [--json]
 * 退出码：0 = 全过；1 = 有不合格项。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const ROLES = join(ROOT, 'roles')
const MAX = 6000
const TOOL_WORDS = ['qq_send_', 'bash', 'read_file', 'write_file', 'browser_', 'mcp__', 'subagent']

const files = (await readdir(ROLES).catch(() => [])).filter((f) => f.endsWith('.md'))
const results = []
for (const f of files) {
  const text = await readFile(join(ROLES, f), 'utf8')
  const hits = TOOL_WORDS.filter((w) => text.includes(w))
  results.push({
    file: f,
    chars: [...text].length,
    tooLong: [...text].length > MAX,
    toolHits: hits
  })
}

const hasPrivate = files.some((f) => f.includes('私聊') || f.includes('private'))
const hasGroup = files.some((f) => f.includes('群聊') || f.includes('group'))
// 文件只是「源」，面板 settings.json 里的才是真正生效的文本。
// 两者不一致时，改文件没用、改面板也会被下次 setup 覆盖——必须报出来。
const SETTINGS = join(process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? '', '.dsh'), 'im-bridge', 'settings.json')
const DEFAULTS = join(ROOT, 'config', 'defaults.json')
let panelChecks = []
try {
  const settings = JSON.parse(await readFile(SETTINGS, 'utf8'))
  const defaults = JSON.parse(await readFile(DEFAULTS, 'utf8'))
  const norm = (s) => String(s ?? '').replace(/\s+/g, '').trim()
  for (const [slot, map] of Object.entries(defaults.personae ?? {})) {
    const panel = (settings.personae ?? []).find((p) => p.id === map.id)
    const file = files.find((f) => f === map.file.split(/[\\/]/).pop())
    if (!panel || !file) {
      panelChecks.push({ slot, id: map.id, status: 'missing', detail: panel ? `缺文件 ${map.file}` : `面板里没有 ${map.id}` })
      continue
    }
    const body = (await readFile(join(ROLES, file), 'utf8'))
      .split(/\r?\n/).filter((l) => !l.startsWith('#') && !l.startsWith('>')).join('\n').trim()
    const same = norm(panel.prompt) === norm(body)
    panelChecks.push({
      slot, id: map.id, status: same ? 'same' : 'differs',
      detail: same ? `${[...String(panel.prompt)].length} 字` : `面板 ${[...String(panel.prompt)].length} 字 / 文件 ${[...body].length} 字`,
    })
  }
} catch (error) {
  panelChecks = [{ slot: '-', id: '-', status: 'skipped', detail: '没有 settings.json（插件还没跑过）' }]
}
const panelBad = panelChecks.filter((c) => c.status === 'missing' || c.status === 'differs')

const failed = results.filter((r) => r.tooLong || r.toolHits.length > 0)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ files: results, hasPrivate, hasGroup, panel: panelChecks, ok: hasPrivate && hasGroup && failed.length === 0 && panelBad.length === 0 }, null, 2))
} else {
  console.log('\n人设检查\n')
  console.log(`  文件        ${files.length} 个`)
  console.log(`  私聊人设    ${hasPrivate ? '有' : '缺'}`)
  console.log(`  群聊人设    ${hasGroup ? '有' : '缺'}`)
  for (const r of results) {
    console.log(`  - ${r.file}  ${r.chars} 字${r.tooLong ? '  ⚠ 超上限' : ''}${r.toolHits.length ? `  ⚠ 含工具词：${r.toolHits.join(', ')}` : ''}`)
  }
  console.log('')
  console.log('  面板一致性（settings.json 里真正生效的文本）')
  for (const c of panelChecks) {
    const mark = c.status === 'same' ? '✓' : c.status === 'skipped' ? '-' : '✗'
    console.log(`  ${mark} ${c.slot.padEnd(8)} ${c.id.padEnd(12)} ${c.detail}`)
  }
  if (panelBad.length > 0 && panelChecks[0]?.status !== 'skipped') {
    console.log('')
    console.log('  ⚠ 面板与文件不一致：改 roles/ 不会自动同步到面板。')
    console.log('    要么在面板里改，要么重跑 setup.mjs 用文件覆盖面板。')
  }
  console.log('')
}

process.exit(hasPrivate && hasGroup && failed.length === 0 && panelBad.length === 0 ? 0 : 1)
