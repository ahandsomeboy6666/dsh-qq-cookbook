#!/usr/bin/env node
/**
 * 命令构造安全：
 *   静态：setup.mjs 不得把路径/URL 插进 PowerShell -Command 字符串。
 *   行为：特殊字符路径经 psQuote 传入 PowerShell 后，取回值应与原文一致。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const ROOT = dirname(import.meta.dirname);
const SETUP = join(ROOT, 'tools', 'setup.mjs');
const src = readFileSync(SETUP, 'utf8');
if (process.platform !== 'win32') {
  console.log('[SKIP] 非 Windows 环境，跳过命令构造安全测试');
  process.exit(2);
}

const fails = [];
const pass = [];

// 1. 静态：-Command 行不能含插值路径
const commandLines = src.split(/\r?\n/).filter(l => l.includes('-Command'));
for (const line of commandLines) {
  if (/\$\{/.test(line)) fails.push('仍存在 -Command 字符串插值：' + line.trim().slice(0, 80));
}
if (!commandLines.some(l => /\$\{/.test(l))) pass.push('没有 -Command 路径插值');

// 2. 静态：存在 psRun/psQuote
if (!/function psQuote\s*\(/.test(src) || !/function psRun\s*\(/.test(src)) fails.push('缺少 psRun/psQuote 参数化辅助');
else pass.push('psRun/psQuote 存在');

// 3. 静态：run() 按需 shell
if (!/needsShell/.test(src)) fails.push('run() 没有按需 shell 判断');
else pass.push('run() 按需 shell');

// 4. 行为：特殊字符路径经 psQuote → PowerShell 往返一致
function psQuote(value) { return "'" + String(value).replace(/'/g, "''") + "'" }
const samples = [
  'C:\\Users\\a b\\带 空格\\napcat',
  "C:\\it's\\quote\\dir",
  'C:\\中文\\路径\\&符号$变量',
  'C:\\a;b|c\\d>e<f',
];
try {
  const file = join(tmpdir(), `psq-${randomUUID()}.ps1`);
  const vars = samples.map((s, i) => `$P${i} = ${psQuote(s)}`);
  const body = samples.map((_, i) => `Write-Output $P${i}`).join('\n');
  writeFileSync(file, '\uFEFF' + "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n" + vars.join('\n') + '\n' + body, 'utf8');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  rmSync(file, { force: true });
  const out = String(r.stdout ?? '').replace(/\r/g, '').split('\n').filter(Boolean);
  if (r.status !== 0) fails.push('特殊字符往返测试执行失败：' + String(r.stderr ?? '').slice(0, 120));
  else {
    let ok = true;
    samples.forEach((s, i) => { if (out[i] !== s) { ok = false; fails.push(`往返不一致：${JSON.stringify(s)} → ${JSON.stringify(out[i])}`); } });
    if (ok) pass.push('特殊字符路径往返一致（空格/单引号/中文/符号）');
  }
} catch (e) {
  fails.push('特殊字符测试异常：' + String(e?.message ?? e).slice(0, 100));
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(fails.length === 0 ? 0 : 1);
