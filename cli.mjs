#!/usr/bin/env node
/**
 * dsh-qq 流水线 CLI：把零散的检查脚本串成一条命令。
 *
 * 用法：
 *   node cli.mjs check      # 静态门禁：资产 + 事实一致性（CI 用这个）
 *   node cli.mjs doctor     # 环境事实：DSH 版本 / NapCat / 插件
 *   node cli.mjs status     # 全状态：doctor + 人设 + 额度 + 浏览器
 *   node cli.mjs all        # check + status
 *
 * 退出码：check 全过才 0；status 有未就绪项返回 1（诊断用，不阻断 CI）。
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = import.meta.dirname

import { copyFileSync, existsSync } from 'node:fs'

// init：从模板生成个人配置（不覆盖已有）
if (process.argv[2] === 'init') {
  const example = join(ROOT, 'config.example.json')
  const local = join(ROOT, 'config.local.json')
  if (existsSync(local)) {
    console.log('config.local.json 已存在，未覆盖')
    process.exit(0)
  }
  copyFileSync(example, local)
  console.log('已从模板生成 config.local.json')
  console.log('请把 <...> 占位符替换成你的值（QQ 号 / 群号 / NapCat 路径 / 音色 ID）')
  console.log('该文件已在 .gitignore 中，不会提交')
  process.exit(0)
}

const SCRIPTS = {
  assets: 'checks/check-assets.mjs',
  consistency: 'checks/check-consistency.mjs',
  privacy: 'checks/check-privacy.mjs',
  configRobust: 'checks/check-config-robust.mjs',
  audit: 'checks/check-audit.mjs',
  logging: 'checks/check-logging.mjs',
  drill: 'checks/attack-drill.mjs',
  probeDsh: 'checks/probe-dsh.mjs',
  probeOnebot: 'checks/probe-onebot.mjs',
  install: 'checks/check-install.mjs',
  persona: 'checks/check-persona.mjs',
  budget: 'checks/check-budget.mjs',
  browser: 'checks/check-browser.mjs'
}

const GROUPS = {
  check: {
    title: '静态门禁',
    items: ['assets', 'consistency', 'privacy', 'configRobust', 'audit', 'logging', 'drill'],
    gate: true
  },
  doctor: {
    title: '环境事实',
    items: ['probeDsh', 'probeOnebot', 'install'],
    gate: false
  },
  status: {
    title: '全状态',
    items: ['probeDsh', 'probeOnebot', 'install', 'persona', 'budget', 'browser'],
    gate: false
  }
}

const LABELS = {
  assets: '资产完整',
  consistency: '事实一致',
  probeDsh: 'DSH 版本',
  probeOnebot: 'NapCat',
  install: 'cheems 插件',
  persona: '两套人设',
  budget: '零花钱授权',
  browser: '浏览器能力',
  privacy: '无个人配置泄漏',
  configRobust: '配置健壮性',
  audit: '出站审计',
  logging: '日志无密钥',
  drill: '攻击演练（静态）'
}

function run(item) {
  const script = join(ROOT, SCRIPTS[item])
  const extra = item === 'probeOnebot' || item === 'install' ? ['--require'] : []
  const r = spawnSync(process.execPath, [script, ...extra], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true
  })
  return r.status === 0
}

function runGroup(name) {
  const group = GROUPS[name]
  console.log(`\n━━━ ${group.title}（${name}）━━━`)
  const results = []
  for (const item of group.items) {
    const ok = run(item)
    results.push({ item, ok })
  }
  return { group, results }
}

function summarize(sections) {
  const all = sections.flatMap((s) => s.results)
  const passed = all.filter((r) => r.ok).length
  const failed = all.length - passed
  console.log('\n━━━ 汇总 ━━━')
  for (const s of sections) {
    for (const r of s.results) {
      console.log(`  ${r.ok ? '[PASS]' : '[FAIL]'}  ${LABELS[r.item]}`)
    }
  }
  console.log(`\n  ${passed}/${all.length} 通过${failed ? `，${failed} 项未就绪` : ''}\n`)
  return failed
}

const cmd = process.argv[2] ?? 'status'

if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
  console.log(`
dsh-qq 流水线

  node cli.mjs check    静态门禁：资产 + 事实一致性（CI 用）
  node cli.mjs doctor   环境事实：DSH / NapCat / 插件
  node cli.mjs status   全状态：doctor + 人设 + 额度 + 浏览器
  node cli.mjs all      check + status

退出码：check 全过才 0；status 有未就绪项返回 1。
`)
  process.exit(0)
}

let sections = []
if (cmd === 'check') {
  sections = [runGroup('check')]
} else if (cmd === 'doctor') {
  sections = [runGroup('doctor')]
} else if (cmd === 'status') {
  sections = [runGroup('status')]
} else if (cmd === 'all') {
  sections = [runGroup('check'), runGroup('status')]
} else {
  console.error(`未知命令：${cmd}\n运行 node cli.mjs --help 查看用法`)
  process.exit(2)
}

const failed = summarize(sections)
const allPassed = sections.flatMap((s) => s.results).every((r) => r.ok)

process.exit(allPassed ? 0 : 1)
