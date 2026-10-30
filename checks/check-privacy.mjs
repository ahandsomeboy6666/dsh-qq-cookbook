#!/usr/bin/env node
/**
 * 个人配置泄漏检查：通用文档/模板里不应出现真实 QQ 号、群号、随机端口、音色 ID。
 * 历史记录（15-acceptance-record / FACTS / 20-tts-selection）已标注「本机实例/示例」，不扫。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname.replace(/[\\/]checks$/, '');

// 只扫「通用」文件：模板 + 对外文档
const TARGETS = [
  'config.example.json',
  'README.md',
  'AGENTS.md',
  'BOOTSTRAP.md',
  'docs/12-bridge-patches.md',
  'docs/13-browser-mcp.md',
];

const RULES = [
  { re: /(?<!\d)\d{11}(?!\d)/, name: '真实 QQ 号' },
  { re: /53800|51047/, name: '桌面端随机端口' },
  { re: /S_[A-Za-z0-9]{8}/, name: '音色 ID' },
  { re: /c4clone\d+/, name: 'MiniMax 克隆音色 ID' },
];

let bad = 0;
for (const rel of TARGETS) {
  const f = join(ROOT, rel);
  if (!existsSync(f)) continue;
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    // 占位符行豁免
    if (line.includes('<你的') || line.includes('<群号') || line.includes('<桌面端端口')) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        console.log(`[FAIL] ${rel}:${i + 1} 出现${rule.name}: ${line.trim().slice(0, 80)}`);
        bad++;
      }
    }
  });
}

if (bad === 0) {
  console.log('[PASS] 通用文件无个人配置泄漏');
  process.exit(0);
}
console.log(`\n汇总：${bad} 处个人配置泄漏（应改用占位符，见 config.example.json）`);
process.exit(1);
