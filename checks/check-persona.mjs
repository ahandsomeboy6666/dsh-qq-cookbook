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
const failed = results.filter((r) => r.tooLong || r.toolHits.length > 0)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ files: results, hasPrivate, hasGroup, ok: hasPrivate && hasGroup && failed.length === 0 }, null, 2))
} else {
  console.log('\n人设检查\n')
  console.log(`  文件        ${files.length} 个`)
  console.log(`  私聊人设    ${hasPrivate ? '有' : '缺'}`)
  console.log(`  群聊人设    ${hasGroup ? '有' : '缺'}`)
  for (const r of results) {
    console.log(`  - ${r.file}  ${r.chars} 字${r.tooLong ? '  ⚠ 超上限' : ''}${r.toolHits.length ? `  ⚠ 含工具词：${r.toolHits.join(', ')}` : ''}`)
  }
  console.log('')
}

process.exit(hasPrivate && hasGroup && failed.length === 0 ? 0 : 1)
