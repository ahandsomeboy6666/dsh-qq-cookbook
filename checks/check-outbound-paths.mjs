#!/usr/bin/env node
/**
 * 出站路径覆盖：
 *   1. 所有 request('send_msg') 调用必须在 flushOutbox 函数体内（唯一出站入口）。
 *   2. flushOutbox 内 scanOutgoing 必须在 send_msg 之前。
 *   3. 运行时插桩：scanOutgoing 通过后必须给 job 打 auditedAt，send_msg 前断言存在。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = dirname(import.meta.dirname);
const INDEX = join(ROOT, 'vendor', 'dsh-im-bridge', 'index.js');
if (!existsSync(INDEX)) {
  console.log('[SKIP] vendor 不存在（CI），跳过出站路径检查');
  process.exit(2);
}
const src = readFileSync(INDEX, 'utf8');
const fails = [];
const pass = [];

// 定位 flushOutbox 函数范围（从函数头到下一个顶层 function）
const flushStart = src.indexOf('async function flushOutbox');
if (flushStart < 0) {
  fails.push('找不到 flushOutbox');
} else {
  const nextFn = src.indexOf('\n  function ', flushStart + 10);
  const flushEnd = nextFn > 0 ? nextFn : src.length;
  const flushBody = src.slice(flushStart, flushEnd);

  // 1. 所有 send_msg 调用点
  const allCalls = [...src.matchAll(/request\(['"]send_msg['"]/g)].map((m) => m.index);
  const outside = allCalls.filter((i) => i < flushStart || i > flushEnd);
  if (outside.length) fails.push(`有 ${outside.length} 处 send_msg 在 flushOutbox 之外（可能绕过审计）`);
  else pass.push(`send_msg 调用全部在 flushOutbox 内（${allCalls.length} 处）`);

  // 2. scanOutgoing 在 send_msg 之前
  const scanIdx = flushBody.indexOf('scanOutgoing(');
  const sendIdx = flushBody.indexOf("request('send_msg'");
  if (scanIdx < 0) fails.push('flushOutbox 内没有 scanOutgoing 调用');
  else if (sendIdx < 0) fails.push('flushOutbox 内没有 send_msg 调用');
  else if (scanIdx > sendIdx) fails.push('scanOutgoing 在 send_msg 之后（顺序错误）');
  else pass.push('scanOutgoing 在 send_msg 之前');

  // 3. 运行时插桩
  if (!/job\.auditedAt\s*=/.test(flushBody)) fails.push('缺少运行时插桩（job.auditedAt 未打标）');
  else pass.push('scanOutgoing 通过后打标 job.auditedAt');
  if (!/auditedAt/.test(flushBody.slice(sendIdx - 400, sendIdx))) fails.push('send_msg 前没有 auditedAt 断言');
  else pass.push('send_msg 前断言 auditedAt');
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(fails.length === 0 ? 0 : 1);
