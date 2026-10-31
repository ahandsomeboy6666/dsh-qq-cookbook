#!/usr/bin/env node
/**
 * 部署后冒烟测试：验证「装完之后，真的能用」。
 *
 * 用法：
 *   node checks/smoke.mjs
 *   node checks/smoke.mjs --url http://127.0.0.1:<桌面端端口> --voice
 *
 * 检查：
 *   1. OneBot 可达（NapCat 6700）
 *   2. DSH 可达（status）
 *   3. 配置：config.local.json 存在且 JSON 有效（或 example 可解析）
 *   4. 发送链路：往 owner 发一条测试消息，观察 bridge.log 出现 sent/cancelled
 *   5. 语音（--voice）：preview 返回 ok
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const ROOT = dirname(import.meta.dirname);
const args = process.argv.slice(2);
function arg(name, fallback = '') {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const DSH_URL = arg('--url', process.env.DSH_URL || 'http://127.0.0.1:55069').replace(/\/+$/, '');
const WITH_VOICE = args.includes('--voice');
const results = [];
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`[PASS] ${name}${detail ? '  ' + detail : ''}`); };
const fail = (name, detail = '') => { results.push({ name, ok: false, detail }); console.log(`[FAIL] ${name}${detail ? '  ' + detail : ''}`); };

async function getJson(url, timeout = 5000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  const text = await res.text();
  return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

// 1. OneBot
try {
  const r = await getJson('http://127.0.0.1:6700/get_status', 5000);
  const ok = r.json && (r.json.status === 'ok' || r.json.retcode === 0);
  ok ? pass('OneBot 可达', `online=${r.json?.data?.online ?? '?'}`) : fail('OneBot 可达', `HTTP ${r.status}`);
} catch (e) { fail('OneBot 可达', String(e?.message ?? e).slice(0, 80)); }

// 2. DSH
let status = null;
try {
  const r = await getJson(`${DSH_URL}/im-bridge/status`, 8000);
  status = r.json;
  (r.status === 200 && r.json) ? pass('DSH 桥接接口', DSH_URL) : fail('DSH 桥接接口', `HTTP ${r.status}`);
} catch (e) { fail('DSH 桥接接口', String(e?.message ?? e).slice(0, 80)); }

// 3. 配置
const localCfg = join(ROOT, 'config.local.json');
const exampleCfg = join(ROOT, 'config.example.json');
let cfgPath = '';
let cfg = null;
try {
  if (existsSync(localCfg)) { cfgPath = localCfg; cfg = JSON.parse(readFileSync(localCfg, 'utf8')); }
  else { cfgPath = exampleCfg; cfg = JSON.parse(readFileSync(exampleCfg, 'utf8')); }
  pass('配置可解析', cfgPath.split(/[\\/]/).pop());
  const flat = JSON.stringify(cfg);
  if (cfgPath === localCfg && flat.includes('<你的')) pass('配置已填写', '模板状态（部署时用 cheems settings）');
  else pass('配置已填写', cfgPath === localCfg ? '' : '用模板');
} catch (e) {
  fail('配置可解析', String(e?.message ?? e).slice(0, 100));
}

// 4. 发送链路：给 owner 发一条测试消息
let owner = String(cfg?.access?.owner ?? '').trim();
try {
  const st = JSON.parse(readFileSync(join(homedir(), '.dsh/im-bridge/settings.json'), 'utf8'));
  owner = String((st.owners || [])[0] ?? st.owner ?? owner).trim();
} catch {}
if (owner && !owner.includes('<')) {
  try {
    const before = existsSync(join(homedir(), '.dsh/im-bridge/bridge.log'))
      ? readFileSync(join(homedir(), '.dsh/im-bridge/bridge.log'), 'utf8').length : 0;
    const res = await fetch(`${DSH_URL}/im-bridge/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: `private:${owner}`, text: `[冒烟测试] ${new Date().toISOString()}` }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text();
    if (res.status !== 200) { fail('发送链路', `HTTP ${res.status}: ${body.slice(0, 100)}`); }
    else {
      await new Promise(r => setTimeout(r, 2500));
      const logPath = join(homedir(), '.dsh/im-bridge/bridge.log');
      const after = existsSync(logPath) ? readFileSync(logPath, 'utf8').slice(before) : '';
      const delivered = /outbox|sent|manual send/i.test(after);
      delivered ? pass('发送链路', '日志出现发送记录') : fail('发送链路', '日志没有发送记录');
    }
  } catch (e) { fail('发送链路', String(e?.message ?? e).slice(0, 100)); }
} else {
  fail('发送链路', '没有可用的 owner（配置未填）');
}

// 5. 语音（可选）
if (WITH_VOICE) {
  try {
    const res = await fetch(`${DSH_URL}/im-bridge/voice/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '冒烟测试', engine: 'custom' }),
      signal: AbortSignal.timeout(120000),
    });
    const body = await res.text();
    const json = (() => { try { return JSON.parse(body); } catch { return null; } })();
    (res.status === 200 && json?.ok) ? pass('语音链路', json.name) : fail('语音链路', `HTTP ${res.status}: ${body.slice(0, 100)}`);
  } catch (e) { fail('语音链路', String(e?.message ?? e).slice(0, 100)); }
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n冒烟结果：${results.length - failed}/${results.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
