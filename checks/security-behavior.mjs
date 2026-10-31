#!/usr/bin/env node
/**
 * 安全行为测试（PR2）：静态与行为分开报告。
 *
 * 用法：
 *   node checks/security-behavior.mjs                        # 只跑静态
 *   node checks/security-behavior.mjs --live --url http://127.0.0.1:<端口>  # 加行为测试
 *
 * 行为（--live，会真的调桥接接口）：
 *   B1 非白名单目标发送 → 拒绝
 *   B2 含本机路径的消息 → 出站审计拦截（job cancelled）
 *   B3 单实例锁文件存在且 pid 存活
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

const staticPass = [];
const staticFail = [];
const behaviorPass = [];
const behaviorFail = [];

// ---------- 静态 ----------
if (!existsSync(INDEX)) {
  console.log('[SKIP] vendor 不存在（CI），跳过安全行为测试');
  process.exit(2);
}
const src = readFileSync(INDEX, 'utf8');
const s = (name, ok, detail = '') => (ok ? staticPass : staticFail).push(name + (detail ? `（${detail}）` : ''));

s('出站审计函数存在', /function scanOutgoing\s*\(/.test(src));
s('白名单校验存在', /recordsAllowed/.test(src));
s('单实例锁实现存在', /\.bridge\.lock/.test(src));
s('send 接口白名单校验', /请先将发送对象加入白名单/.test(src));

// ---------- 行为 ----------
if (LIVE) {
  try {
    // B1：非白名单目标
    const r1 = await fetch(`${DSH_URL}/im-bridge/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'private:999999999', text: '白名单测试' }),
      signal: AbortSignal.timeout(10000),
    });
    const b1 = await r1.text();
    (r1.status !== 200 || /白名单/.test(b1))
      ? behaviorPass.push(`B1 非白名单目标被拒绝（HTTP ${r1.status}）`)
      : behaviorFail.push(`B1 非白名单目标未被拒绝（HTTP ${r1.status}）`);

    // B2：含路径消息 → 出站审计
    const owner = (() => {
      try { return String((JSON.parse(readFileSync(join(homedir(), '.dsh/im-bridge/settings.json'), 'utf8')).owners || [])[0] ?? ''); } catch { return ''; }
    })();
    if (owner) {
      const r2 = await fetch(`${DSH_URL}/im-bridge/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: `private:${owner}`, text: '路径审计测试 C:\\Users\\test\\.dsh\\settings.json' }),
        signal: AbortSignal.timeout(10000),
      });
      await r2.text();
      await new Promise(r => setTimeout(r, 2000));
      const st = await (await fetch(`${DSH_URL}/im-bridge/features`, { signal: AbortSignal.timeout(8000) })).text();
      const jobs = (() => { try { return JSON.parse(st).outbox || []; } catch { return []; } })();
      const blocked = jobs.some(j => /出站审计拦截/.test(String(j.error || '')));
      blocked ? behaviorPass.push('B2 含路径消息被出站审计拦截') : behaviorFail.push('B2 含路径消息未被拦截');
    } else behaviorFail.push('B2 找不到 owner（settings.json）');

    // B4：正常消息必须仍能发出（证明审计不误杀；状态查 features 的 outbox）
    if (owner) {
      const r4 = await fetch(`${DSH_URL}/im-bridge/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: `private:${owner}`, text: '行为测试正常消息 ' + Date.now() }),
        signal: AbortSignal.timeout(10000),
      });
      await r4.text();
      await new Promise(r => setTimeout(r, 3000));
      const st4 = await (await fetch(`${DSH_URL}/im-bridge/features`, { signal: AbortSignal.timeout(8000) })).text();
      const jobs4 = (() => { try { return JSON.parse(st4).outbox || []; } catch { return []; } })();
      const sent = jobs4.slice(-3).some(j => j.status === 'sent');
      const blocked = jobs4.slice(-3).some(j => /出站审计拦截/.test(String(j.error || '')));
      sent ? behaviorPass.push('B4 正常消息发出（审计未误杀）') : behaviorFail.push(`B4 正常消息没有 sent 状态（最近：${jobs4.slice(-3).map(j => j.status).join(',')}）`);
      if (blocked) behaviorPass.push('B4 最近仍有审计拦截记录（证明拦截生效）');
    }

    // B3：单实例锁
    const lock = join(homedir(), '.dsh/im-bridge/.bridge.lock');
    if (existsSync(lock)) {
      const pid = Number(String(readFileSync(lock, 'utf8')).trim());
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
      alive ? behaviorPass.push(`B3 单实例锁存在且进程存活（pid ${pid}）`) : behaviorFail.push(`B3 锁文件存在但 pid ${pid} 不存活`);
    } else behaviorFail.push('B3 没有 .bridge.lock');
  } catch (e) {
    behaviorFail.push('行为测试异常：' + String(e?.message ?? e).slice(0, 100));
  }
}

// ---------- 报告 ----------
console.log('== 静态 ==');
for (const p of staticPass) console.log('  [PASS] ' + p);
for (const f of staticFail) console.log('  [FAIL] ' + f);
if (LIVE) {
  console.log('== 行为 ==');
  for (const p of behaviorPass) console.log('  [PASS] ' + p);
  for (const f of behaviorFail) console.log('  [FAIL] ' + f);
} else {
  console.log('（加 --live --url <DSH端口> 跑行为测试）');
}
const fail = staticFail.length + behaviorFail.length;
process.exit(fail === 0 ? 0 : 1);
