#!/usr/bin/env node
/**
 * 注入块泄漏防线（prompt leakage）
 *
 * 背景：上下文里的【...】段落是给模型看的内部背景，不是要说的话。
 * 2026-11-08 实测出现整块被复述并随 QQ 消息发出（含 `user 【本轮自主分享】…` 和原文 JSON）。
 *
 * 三道防线，缺一条就红：
 *   1. 注入侧：content 里必须有"这些是内部背景、不要复述"的约束。
 *   2. 清洗侧：stripInternalLeak 必须真的被调用（只定义不调用 = 死代码）。
 *   3. 出站侧：OUTBOUND_RULES 必须覆盖内部注入标签，strip 漏网时整条拦截。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = dirname(import.meta.dirname);
const INDEX = join(ROOT, 'vendor', 'dsh-im-bridge', 'index.js');
const CLEAN = join(ROOT, 'vendor', 'dsh-im-bridge', 'outbound-clean.js');
if (!existsSync(INDEX)) {
  console.log('[SKIP] vendor 不存在（CI），跳过注入泄漏检查');
  process.exit(2);
}
// 2026-11-14：清洗名单和出站规则已迁到 outbound-clean.js，两个文件一起读，
// 否则这里会因为「在主入口找不到 INTERNAL_TAGS」而假红。
const cleanSrc = existsSync(CLEAN) ? readFileSync(CLEAN, 'utf8') : '';
const src = readFileSync(INDEX, 'utf8') + '\n' + cleanSrc;
const fails = [];
const pass = [];

// ---- 1. 注入侧：要有反复述约束 ----
// 注意：不能只搜"不要复述"——basePersona 里"不要复述图里的文字"会假绿。
// 必须是针对【】内部段落的那一句。
const hasGuardHint =
  /内部背景|不是要你说出来的内容|不要把【[^】]*】|不要输出【[^】]*】/.test(src);
if (!hasGuardHint) fails.push('注入批次里没有"【】段落是内部背景、不要复述"的约束（模型没有任何理由不照抄）');
else pass.push('注入侧有反复述约束');

// ---- 2. 清洗侧：stripInternalLeak 必须被调用 ----
const defs = (src.match(/function stripInternalLeak\s*\(/g) || []).length;
const calls = (src.match(/stripInternalLeak\s*\(/g) || []).length - defs;
if (defs === 0) fails.push('没有 stripInternalLeak 定义');
else if (calls === 0) fails.push('stripInternalLeak 只有定义、零调用（死代码，剥不掉任何东西）');
else pass.push(`stripInternalLeak 有 ${calls} 处调用`);

// ---- 3. 出站侧：OUTBOUND_RULES 要覆盖内部标签 ----
const rulesStart = src.indexOf('const OUTBOUND_RULES');
if (rulesStart < 0) fails.push('找不到 OUTBOUND_RULES');
else {
  const rulesEnd = src.indexOf('];', rulesStart);
  const body = src.slice(rulesStart, rulesEnd > 0 ? rulesEnd : rulesStart + 3000);
  const ruleCount = (body.match(/name:\s*'/g) || []).length;
  // 规则体里要出现"内部标签"语义：要么匹配【，要么提到注入/记忆/本轮
  const coversInternal = /\\u3010|【|内部|注入|记忆|本轮/.test(body);
  if (!coversInternal) fails.push(`OUTBOUND_RULES 只有 ${ruleCount} 条且不覆盖内部注入标签（路径/凭据/私钥之外全放行）`);
  else pass.push(`OUTBOUND_RULES 覆盖内部注入标签（共 ${ruleCount} 条）`);
}

// ---- 4. 覆盖检查：三个真实泄漏标签都要在清洗名单里 ----
const TAG_SAMPLES = [
  '本轮自主分享',
  '本对话近期已回复',
  '角色模拟生活',
  '已查询的账户余额',
  '本对话日历记忆'
];
// 标签名单在 INTERNAL_TAGS 常量里，函数体在其后，所以从常量处开始取
const tagsIdx = (cleanSrc || src).indexOf('INTERNAL_TAGS');
const stripStart = tagsIdx >= 0 ? tagsIdx : src.indexOf('function stripInternalLeak');
const stripBody = stripStart >= 0 ? (cleanSrc || src).slice(stripStart, stripStart + 4000) : '';
const missing = TAG_SAMPLES.filter((t) => stripBody && !stripBody.includes(t));
if (!stripBody) fails.push('取不到清洗名单（INTERNAL_TAGS / stripInternalLeak）');
else if (missing.length) fails.push(`清洗名单缺标签：${missing.join('、')}`);
else pass.push(`清洗名单覆盖 ${TAG_SAMPLES.length} 个已知标签`);

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
process.exit(fails.length === 0 ? 0 : 1);
