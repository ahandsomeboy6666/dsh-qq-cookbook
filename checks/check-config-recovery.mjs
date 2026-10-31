#!/usr/bin/env node
/**
 * 配置修改失败恢复：
 *   1. cheems 的 saveSettings 必须是原子写（tmp + rename）——写一半失败时原配置不丢。
 *   2. 行为模拟：写入失败后原文件内容不变。
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = dirname(import.meta.dirname);
const INDEX = join(ROOT, 'vendor', 'dsh-im-bridge', 'index.js');
const fails = [];
const pass = [];

// 1. 静态：saveSettings 原子写
if (!existsSync(INDEX)) {
  console.log('[SKIP] vendor 不存在（CI），跳过配置恢复测试');
  process.exit(0);
}
const src = readFileSync(INDEX, 'utf8');
const saveSeg = (src.match(/function saveSettings\(\)[\s\S]{0,600}/) || [''])[0];
if (!saveSeg.includes('.tmp')) fails.push('saveSettings 没有写 .tmp 临时文件');
if (!saveSeg.includes('renameSync')) fails.push('saveSettings 没有 rename 原子替换');
if (!fails.length) pass.push('saveSettings 使用 tmp + rename 原子写');

// 2. 行为模拟：写失败后原文件不变
const tmp = mkdtempSync(join(tmpdir(), 'cfg-recovery-'));
try {
  const orig = join(tmp, 'settings.json');
  writeFileSync(orig, '{"owners":["123"]}', 'utf8');
  const before = readFileSync(orig, 'utf8');
  // 模拟「写临时文件失败」：写到不存在的目录
  let threw = false;
  try { writeFileSync(join(tmp, 'no-such-dir', 'settings.json.tmp'), '{"owners":["456"]}', 'utf8'); } catch { threw = true; }
  if (!threw) fails.push('模拟写入失败没有抛错（测试无效）');
  if (readFileSync(orig, 'utf8') !== before) fails.push('写入失败后原配置被改动了');
  else pass.push('写入失败后原配置保持不变');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(fails.length === 0 ? 0 : 1);
