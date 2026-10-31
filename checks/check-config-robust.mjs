#!/usr/bin/env node
/**
 * 配置健壮性：模板/个人配置的 JSON 有效性、占位符状态、init 幂等。
 */
import { readFileSync, existsSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = dirname(import.meta.dirname);
const fails = [];
const pass = [];
const example = join(ROOT, 'config.example.json');
const local = join(ROOT, 'config.local.json');
const Q = '<你的';

// 1. 模板必须存在且可解析
if (!existsSync(example)) fails.push('config.example.json 不存在');
else {
  try { JSON.parse(readFileSync(example, 'utf8')); pass.push('模板 JSON 有效'); }
  catch (e) { fails.push('config.example.json 解析失败：' + e.message); }
}

// 2. 个人配置（若存在）必须可解析
if (existsSync(local)) {
  try {
    const cfg = JSON.parse(readFileSync(local, 'utf8'));
    pass.push('个人配置 JSON 有效');
    if (JSON.stringify(cfg).includes(Q)) pass.push('个人配置仍是模板（未填写，指向 config.local.json）');
    else pass.push('个人配置已填写');
  } catch (e) {
    fails.push('config.local.json 解析失败（请删除后重跑 node cli.mjs init）：' + e.message);
  }
} else {
  pass.push('个人配置不存在（未部署，用模板）');
}

// 3. init 幂等：子进程真测（复制 cli.mjs + 模板到临时目录）
try {
  const { copyFileSync, mkdtempSync, readFileSync, rmSync, existsSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const cliSrc = join(ROOT, 'cli.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'cfg-init-'));
  copyFileSync(cliSrc, join(tmp, 'cli.mjs'));
  copyFileSync(example, join(tmp, 'config.example.json'));

  const r1 = spawnSync(process.execPath, [join(tmp, 'cli.mjs'), 'init'], { cwd: tmp, encoding: 'utf8', timeout: 30000 });
  const firstFile = join(tmp, 'config.local.json');
  if (r1.status !== 0) fails.push('首次 init 失败：' + String(r1.stderr ?? '').slice(0, 120));
  else if (!existsSync(firstFile)) fails.push('首次 init 没有生成 config.local.json');
  else pass.push('首次 init 生成配置');

  const before = existsSync(firstFile) ? readFileSync(firstFile, 'utf8') : '';
  const r2 = spawnSync(process.execPath, [join(tmp, 'cli.mjs'), 'init'], { cwd: tmp, encoding: 'utf8', timeout: 30000 });
  const after = existsSync(firstFile) ? readFileSync(firstFile, 'utf8') : '';
  if (r2.status !== 0) fails.push('第二次 init 失败：' + String(r2.stderr ?? '').slice(0, 120));
  else if (after !== before) fails.push('第二次 init 覆盖了已有配置');
  else pass.push('第二次 init 未覆盖（幂等）');
  if (!/已存在/.test(String(r2.stdout ?? ''))) fails.push('第二次 init 没有提示「已存在」');
  else pass.push('第二次 init 明确提示已存在');
  rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  fails.push('init 子进程测试异常：' + String(e?.message ?? e).slice(0, 100));
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
console.log(`\n配置健壮性：${pass.length} 通过 / ${fails.length} 失败`);
process.exit(fails.length === 0 ? 0 : 1);
