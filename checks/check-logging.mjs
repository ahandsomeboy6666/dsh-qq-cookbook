#!/usr/bin/env node
/**
 * T10 日志泄露：bridge.log 默认只记元数据，不应出现密钥或完整消息正文。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = import.meta.dirname.replace(/[\\/]checks$/, '');
const candidates = [
  join(homedir(), '.dsh/im-bridge/bridge.log'),
  join(ROOT, '..', '.dsh/im-bridge/bridge.log'),
].filter((p) => existsSync(p));

if (!candidates.length) {
  console.log('[PASS] 没有 bridge.log，跳过（无日志可泄露）');
  process.exit(0);
}

const SECRET = /(?:sk-[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|[A-Za-z0-9_-]{20,}\.(?:api|key|token))/;
const fails = [];
for (const f of candidates) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/).slice(-3000);
  lines.forEach((line, i) => {
    if (SECRET.test(line)) fails.push(`${join(f)}:${i + 1} 出现疑似密钥`);
  });
}
if (!fails.length) {
  console.log(`[PASS] bridge.log 最近 3000 行无密钥模式（${candidates.length} 个文件）`);
  process.exit(0);
}
for (const f of fails.slice(0, 10)) console.log('[FAIL] ' + f);
process.exit(1);
