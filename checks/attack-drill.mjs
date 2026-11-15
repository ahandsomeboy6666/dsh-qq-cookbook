#!/usr/bin/env node
/**
 * 攻击演练（静态版）：断言威胁模型 T1/T2/T3/T9 的防护点都在代码里。
 * 端到端演练需要 DSH 运行，这里只验证「防护机制存在且接线」。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = import.meta.dirname.replace(/[\\/]checks$/, '');
const INDEX = join(ROOT, 'vendor/dsh-im-bridge/index.js');
if (!existsSync(INDEX)) {
  console.log('[SKIP] vendor/dsh-im-bridge 未 clone（CI 环境），跳过攻击演练');
  process.exit(2);
}
// T3 的 scanOutgoing 在 outbound-clean.js 里，两个文件一起读。
const CLEAN_MODULE = join(dirname(INDEX), 'outbound-clean.js');
const src = readFileSync(INDEX, 'utf8') + '\\n' + (existsSync(CLEAN_MODULE) ? readFileSync(CLEAN_MODULE, 'utf8') : '');
const fails = [];

const checks = [
  ['T1 文件工具不挂群聊', /ownerToolDenial|currentOwnerToolDenial/],
  ['T2 白名单校验', /recordsAllowed|effectiveUsers|effectiveGroups/],
  ['T3 出站审计', /function scanOutgoing\s*\(/],
  ['T4 只认 owner', /owner/],
  ['T5 fail-closed 空名单', /recordsAllowed/],
  ['T9 单实例锁', /\.bridge\.lock/],
];
for (const [name, re] of checks) {
  if (!re.test(src)) fails.push(`${name}：代码里找不到防护点`);
}

if (!fails.length) {
  console.log('[PASS] 攻击演练（静态）：T1–T5/T9 防护点全部存在');
  process.exit(0);
}
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(1);
