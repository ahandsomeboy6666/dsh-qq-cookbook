#!/usr/bin/env node
/**
 * T3 出站审计：cheems 发送前必须扫描路径/凭据特征，命中即拦截。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname.replace(/[\\/]checks$/, '');
const INDEX = join(ROOT, 'vendor/dsh-im-bridge/index.js');
const src = readFileSync(INDEX, 'utf8');
const fails = [];

if (!/function scanOutgoing\s*\(/.test(src)) fails.push('缺少 scanOutgoing 函数（出站审计未实现）');

const flushIdx = src.indexOf('async function flushOutbox');
const sendIdx = src.indexOf("request('send_msg'", flushIdx);
const scanCallIdx = src.indexOf('scanOutgoing(', flushIdx);
if (flushIdx < 0) fails.push('找不到 flushOutbox');
if (sendIdx < 0) fails.push('找不到 send_msg 调用');
if (flushIdx >= 0 && sendIdx >= 0 && (scanCallIdx < 0 || scanCallIdx > sendIdx)) {
  fails.push('flushOutbox 在 send_msg 前没有调用 scanOutgoing');
}

const has = (needle) => src.includes(needle);
if (!has('本机路径') || !has('[A-Za-z]:')) fails.push('scanOutgoing 未覆盖规则：本机路径');
if (!has('凭据') || !has('api[_-]?key')) fails.push('scanOutgoing 未覆盖规则：凭据词');
if (!has('私钥') || !has('PRIVATE KEY')) fails.push('scanOutgoing 未覆盖规则：私钥');

if (!fails.length) {
  console.log('[PASS] 出站审计已实现（scanOutgoing + 发送前调用 + 规则覆盖）');
  process.exit(0);
}
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(1);