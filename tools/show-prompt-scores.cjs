#!/usr/bin/env node
/**
 * 查看提示词优化器（ComfyUI-PromptOptimizer）的每轮评分
 *
 * 用法：node tools/show-prompt-scores.cjs [任务ID]
 *   不带参数 → 列出所有任务的最新评分表
 *   带任务ID → 只看该任务
 *
 * 数据来源：ComfyUI/custom_nodes/ComfyUI-PromptOptimizer/outputs/<id>/optimizer_history.json
 */
const fs = require('fs');
const path = require('path');

const BASE = 'E:/workspace/comfyui/ComfyUI_windows_portable/ComfyUI/custom_nodes/ComfyUI-PromptOptimizer/outputs';
const wantId = process.argv[2];

if (!fs.existsSync(BASE)) {
  console.log('未找到优化器输出目录：' + BASE);
  process.exit(1);
}

const ids = fs.readdirSync(BASE).filter(d => fs.statSync(path.join(BASE, d)).isDirectory());
const targets = wantId ? [wantId] : ids;

for (const id of targets) {
  const hp = path.join(BASE, id, 'optimizer_history.json');
  if (!fs.existsSync(hp)) { console.log(`[${id}] 无 optimizer_history.json`); continue; }

  let hist;
  try {
    // 文件可能是 UTF-8，也兼容 BOM
    let raw = fs.readFileSync(hp, 'utf8');
    raw = raw.replace(/^\uFEFF/, '');
    hist = JSON.parse(raw);
  } catch (e) {
    console.log(`[${id}] JSON 解析失败: ${e.message}`);
    continue;
  }

  const champ = hist.champion || {};
  const attempts = hist.attempts || [];
  console.log('='.repeat(60));
  console.log(`任务 ${id}`);
  console.log(`流程: ${hist.flow || '?'} | 种子: ${hist.seed ?? '?'} | 停止: ${hist.stop_reason || '-'}`);
  console.log(`最优: ${champ.label || '-'} = ${champ.score ?? '-'}`);
  console.log('-'.repeat(60));
  console.log('轮次      分数   判定     类型            提示词长度');
  for (const a of attempts) {
    const mark = a.label === champ.label ? ' ★' : '';
    console.log(
      `${String(a.label || '').padEnd(9)} ${String(a.score ?? '-').padStart(5)}  ${String(a.verdict || '').padEnd(7)} ${String(a.kind || '').padEnd(15)} ${a.prompt_len ?? ''}${mark}`
    );
  }
  // 分数走势
  const scores = attempts.map(a => a.score).filter(s => typeof s === 'number');
  if (scores.length) {
    console.log('-'.repeat(60));
    console.log('走势: ' + scores.join(' → ') + `  (最高 ${Math.max(...scores)})`);
  }
  // 最优提示词位置
  if (champ.label) {
    const pp = path.join(BASE, id, champ.label, 'prompt.txt');
    if (fs.existsSync(pp)) console.log(`最优提示词: ${pp}`);
  }
  console.log('');
}
