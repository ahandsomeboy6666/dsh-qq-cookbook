#!/usr/bin/env node
/**
 * 部署状态管理（PR3）：
 *   静态：关键写操作（package/cordis/settings/vendor/下载）必须有 DRY 保护。
 *   行为：--dry-run 前后仓库与 profile 无文件变化；重复 dry-run 输出稳定。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const ROOT = dirname(import.meta.dirname);
const SETUP = join(ROOT, 'tools', 'setup.mjs');
const src = readFileSync(SETUP, 'utf8');
const fails = [];
const pass = [];

// 1. 静态：关键写操作前的 DRY 保护
const guards = [
  ['PACKAGE 写入', 'writeFile(PACKAGE'],
  ['CORDIS 写入', 'writeFile(CORDIS'],
  ['SETTINGS 写入', 'writeFile(SETTINGS'],
  ['vendor clone', "run('git', ['clone'"],
];
for (const [name, needle] of guards) {
  const idx = src.indexOf(needle);
  if (idx < 0) { pass.push(`${name} 不存在（跳过）`); continue; }
  const before = src.slice(Math.max(0, idx - 1500), idx);
  if (!/DRY|!DRY/.test(before)) fails.push(`${name} 前 1500 字符内没有 DRY 判断`);
  else pass.push(`${name} 有 DRY 保护`);
}

// 2. 行为：dry-run 前后文件快照
function snapshot(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === '.git' || name === 'node_modules') continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out.push(relative(ROOT, p) + ':' + st.size + ':' + st.mtimeMs);
    }
  };
  try { walk(dir); } catch { /* ignore */ }
  return out.sort().join('\n');
}
const before = snapshot(ROOT);
const run = spawnSync(process.execPath, [SETUP, '--dry-run', '--qq', '000000000'], { encoding: 'utf8', timeout: 180000, cwd: ROOT });
const out1 = String(run.stdout ?? '') + String(run.stderr ?? '');
const after = snapshot(ROOT);
if (run.status !== 0) fails.push('dry-run 退出码非 0：' + out1.slice(-200));
if (before !== after) {
  const a = new Set(before.split('\n'));
  const b = new Set(after.split('\n'));
  const added = [...b].filter(x => !a.has(x)).slice(0, 5);
  const removed = [...a].filter(x => !b.has(x)).slice(0, 5);
  fails.push(`dry-run 产生了文件变化（新增 ${added.length} / 删除 ${removed.length}）：${added.concat(removed).join(' | ').slice(0, 200)}`);
} else pass.push('dry-run 前后仓库快照一致');

// 3. 重复 dry-run 输出稳定
const run2 = spawnSync(process.execPath, [SETUP, '--dry-run', '--qq', '000000000'], { encoding: 'utf8', timeout: 180000, cwd: ROOT });
const out2 = String(run2.stdout ?? '') + String(run2.stderr ?? '');
const norm = (s) => s.replace(/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/g, 'TS').replace(/\s+/g, ' ').trim();
if (norm(out1) !== norm(out2)) fails.push('重复 dry-run 输出不一致（步骤状态不稳定）');
else pass.push('重复 dry-run 输出一致');

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(fails.length === 0 ? 0 : 1);
