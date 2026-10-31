#!/usr/bin/env node
/**
 * 补丁部分失败：某个补丁缺失时，check-patches 必须逐条列出 MISS 并以非 0 退出。
 * 用临时副本模拟「只应用了一半」。
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(import.meta.dirname);
const VENDOR = join(ROOT, 'vendor', 'dsh-im-bridge', 'index.js');
const fails = [];

if (!existsSync(VENDOR)) {
  console.log('[SKIP] vendor 不存在（CI），跳过补丁部分失败测试');
  process.exit(0);
}

// 复制 index.js 到临时目录，删掉一个补丁的标记（模拟只应用一半）
const tmp = mkdtempSync(join(tmpdir(), 'patch-partial-'));
try {
  const src = readFileSync(VENDOR, 'utf8');
  // 删掉 P1 的标记（群聊空 @ 占位）
  const broken = src.replace('（只 @ 了你，没说话）', '');
  if (broken === src) fails.push('找不到 P1 标记，测试无效');
  const brokenFile = join(tmp, 'index.js');
  writeFileSync(brokenFile, broken, 'utf8');

  const r = spawnSync(process.execPath, [join(ROOT, 'checks', 'check-patches.mjs'), '--vendor', brokenFile], { encoding: 'utf8', timeout: 60000 });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  if (!/MISS/.test(out)) fails.push('部分失败时没有输出 MISS');
  if (r.status === 0) fails.push('部分失败时退出码仍为 0（应非 0）');
  if (!/P1/.test(out)) fails.push('输出里没有指出缺失的 P1');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (!fails.length) {
  console.log('[PASS] 补丁部分失败：逐条 MISS + 非 0 退出');
  process.exit(0);
}
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(1);
