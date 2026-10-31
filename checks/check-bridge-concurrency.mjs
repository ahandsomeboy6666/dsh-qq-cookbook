#!/usr/bin/env node
/**
 * 桥接并发与去重：
 *   静态：cheems 必须有「消息去重」和「按会话隔离队列」。
 *   --live：并发向 owner 发两条消息，断言 outbox 里两条独立入队、互不覆盖。
 *
 * 用法：
 *   node checks/check-bridge-concurrency.mjs            # 静态
 *   node checks/check-bridge-concurrency.mjs --live --url http://127.0.0.1:<端口>
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const ROOT = dirname(import.meta.dirname);
const INDEX = join(ROOT, 'vendor', 'dsh-im-bridge', 'index.js');
const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const urlIdx = args.indexOf('--url');
const DSH_URL = (urlIdx >= 0 ? args[urlIdx + 1] : process.env.DSH_URL || 'http://127.0.0.1:55069').replace(/\/+$/, '');
const fails = [];
const pass = [];

if (!existsSync(INDEX)) {
  console.log('[SKIP] vendor 不存在（CI），跳过桥接并发测试');
  process.exit(0);
}
const src = readFileSync(INDEX, 'utf8');

// 1. 接收侧去重
if (!/const seen = new Set\(\)/.test(src) || !/seen\.has\(fingerprint\)/.test(src)) {
  fails.push('接收侧没有消息去重（seen + fingerprint）');
} else pass.push('接收侧消息去重存在');

// 2. 按会话隔离
if (!/inboxTimers\s*=\s*new Map\(\)/.test(src)) fails.push('没有按会话的 inbox 队列（inboxTimers）');
else pass.push('按会话 inbox 队列存在');
if (!/chatKeyValid/.test(src)) fails.push('没有会话标识校验（chatKeyValid）');
else pass.push('会话标识校验存在');
if (!/queueOutgoing/.test(src)) fails.push('没有发送队列（queueOutgoing）');
else pass.push('发送队列存在');

// 3. --live：并发发送
if (LIVE) {
  try {
    const owner = (() => {
      try { return String((JSON.parse(readFileSync(join(homedir(), '.dsh/im-bridge/settings.json'), 'utf8')).owners || [])[0] ?? ''); } catch { return ''; }
    })();
    if (!owner) throw new Error('settings.json 里没有 owner');
    const mk = (i) => fetch(`${DSH_URL}/im-bridge/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: `private:${owner}`, text: `[并发测试 ${i}] ${Date.now()}` }),
      signal: AbortSignal.timeout(15000),
    });
    const logPath = join(homedir(), '.dsh/im-bridge/bridge.log');
    const before = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    const [a, b] = await Promise.all([mk(1), mk(2)]);
    const [ja, jb] = [await a.text(), await b.text()];
    if (a.status !== 200 || b.status !== 200) fails.push(`并发发送失败：${a.status}/${b.status} ${ja.slice(0, 60)} ${jb.slice(0, 60)}`);
    else {
      await new Promise(r => setTimeout(r, 2500));
      const after = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
      const delta = after.slice(before.length);
      const sends = (delta.match(/manual send/g) || []).length;
      sends >= 2 ? pass.push(`并发两条各自入队（日志 manual send × ${sends}）`) : fails.push(`并发消息没有各自入队（日志 manual send × ${sends}）`);
    }
  } catch (e) {
    fails.push('并发实测异常：' + String(e?.message ?? e).slice(0, 100));
  }
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
if (!LIVE) console.log('（加 --live --url <DSH端口> 可做并发实测）');
process.exit(fails.length === 0 ? 0 : 1);
