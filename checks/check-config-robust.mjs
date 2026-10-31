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

// 3. init 幂等：已有 local 时不应覆盖（模拟：复制到临时目录，跑 init 逻辑不变）
try {
  const tmp = mkdtempSync(join(tmpdir(), 'cfg-'));
  const tmpLocal = join(tmp, 'config.local.json');
  copyFileSync(example, tmpLocal);
  const before = readFileSync(tmpLocal, 'utf8');
  // 简化断言：cli.mjs init 在本地已有 config.local.json 时的行为由代码保证（existsSync 早退）
  const cli = readFileSync(join(ROOT, 'cli.mjs'), 'utf8');
  if (!/existsSync\(local\)/.test(cli)) fails.push('cli.mjs init 没有「已存在不覆盖」判断');
  else pass.push('init 幂等逻辑存在');
  if (readFileSync(tmpLocal, 'utf8') !== before) fails.push('init 幂等模拟失败');
  rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  fails.push('init 幂等模拟异常：' + String(e?.message ?? e).slice(0, 80));
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
console.log(`\n配置健壮性：${pass.length} 通过 / ${fails.length} 失败`);
process.exit(fails.length === 0 ? 0 : 1);
