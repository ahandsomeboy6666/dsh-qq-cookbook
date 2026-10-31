#!/usr/bin/env node
/**
 * 陌生人无 DSH 场景：setup 必须给出明确指引（不是崩溃），并阻断后续步骤。
 */
import { existsSync, mkdtempSync, mkdirSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') {
  console.log('[SKIP] 非 Windows，跳过');
  process.exit(2);
}

const ROOT = dirname(import.meta.dirname);
const tmpBase = join(dirname(ROOT), '.tmp-no-dsh');
mkdirSync(tmpBase, { recursive: true });
const tmp = mkdtempSync(join(tmpBase, 'run-'));
const fails = [];
const pass = [];

try {
  const emptyDsh = join(tmp, 'empty-dsh');
  mkdirSync(emptyDsh, { recursive: true });
  cpSync(join(ROOT, 'config'), join(tmp, 'config'), { recursive: true });
  mkdirSync(join(tmp, 'tools'), { recursive: true });
  cpSync(join(ROOT, 'tools', 'setup.mjs'), join(tmp, 'tools', 'setup.mjs'));
  // 完全独立：复制 package.json/lock 并安装依赖
  for (const name of ['package.json', 'package-lock.json']) {
    if (existsSync(join(ROOT, name))) cpSync(join(ROOT, name), join(tmp, name));
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npm, ['install', '--no-audit', '--no-fund'], {
    cwd: tmp,
    encoding: 'utf8',
    timeout: 300000,
    shell: process.platform === 'win32',
  });
  if (install.status !== 0) fails.push('临时环境 npm install 失败：' + String(install.stderr ?? '').slice(0, 160));

  const r = spawnSync(process.execPath, [
    join(tmp, 'tools', 'setup.mjs'),
    '--no-download',
    '--qq', '000000000',
  ], {
    cwd: tmp,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, DSH_HOME: join(tmp, 'dsh-home'), DSH_DESKTOP_DIR: emptyDsh },
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  if (process.env.DEBUG_NODSH) console.log('[debug out]\n' + out.slice(0, 1200));

  if (/\[FAIL\]\s+DSH 桌面端/.test(out)) pass.push('明确报告 DSH 未安装（FAIL）');
  else fails.push('没有明确报告 DSH 未安装');

  if (/装好 DSH 并启动一次/.test(out)) pass.push('给出「装好 DSH 后重跑」指引');
  else fails.push('缺少安装指引');

  if (r.status !== 0) pass.push('退出码非 0（阻断后续）');
  else fails.push('无 DSH 时退出码仍为 0（未阻断）');

  if (!/\[OK\]\s+clone 插件/.test(out)) pass.push('没有继续 clone 插件');
  else fails.push('无 DSH 仍执行了 clone 插件（越权继续）');
} catch (e) {
  fails.push('无 DSH 场景异常：' + String(e?.message ?? e).slice(0, 150));
} finally {
  try { rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* ignore */ }
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(fails.length === 0 ? 0 : 1);
