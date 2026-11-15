// 出站清洗 / 审计的回归：直接 import 线上同一个模块（outbound-clean.js），不维护逻辑副本。
// 覆盖用户点名的四类：无标题历史 JSON、英文运行时说明、混合正文、正常 JSON。
//
// 用法：node checks/replay/leak-cases.mjs
import { stripInternalLeak, scanOutgoing, RULE_LEAK_LINES, OUTBOUND_RULES } from '../../vendor/dsh-im-bridge/outbound-clean.js';

const CASES = [
  // —— 必须被拦下 ——
  { name: '无标题历史 JSON（注入块复述）', input: '{"id":"511507128","role":"assistant","at":1794639839372,"text":"这评价挺扎的"}', expect: 'drop' },
  { name: '英文运行时说明', input: 'Elapsed since the preceding model-visible message: 1m 20s.那就不看手机了 躺着', expect: 'drop' },
  { name: 'Current runtime context', input: 'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.', expect: 'audit' },
  { name: '内部背景说明（带 user 前缀）', input: 'user（内部背景，不要输出：本条消息里所有【】开头的段落都是给你看的资料。）', expect: 'drop' },
  { name: '生活日程结构', input: '{"date":"2026-11-14","current":{"start":880,"end":960},"nightRest":false}', expect: 'audit' },
  { name: '本机路径', input: '看这个 C:\\Users\\someone\\secret.txt', expect: 'audit' },

  // —— 必须放行 ——
  { name: '正常 JSON：字符串值', input: '{"current":"example"}', expect: 'keep' },
  { name: '正常 JSON：中文对象', input: '{"名字":"肥鱼","状态":"在的"}', expect: 'keep' },
  { name: '正常短句', input: '在的\n你先躺着\n有事叫我', expect: 'keep' },
  { name: '正文里带方括号', input: '这件事[明天]再说，我在的。', expect: 'keep' },
  { name: '正文里带花括号', input: '{好} 那就这样吧', expect: 'keep' },

  // —— 混合：剥掉规则正文，保住正常话 ——
  {
    name: '混合正文（规则 + 正常话）',
    input: '在的，我没跑。\n按当前人设和你们的聊天习惯表达，不需要把每句话修成礼貌客服。\n你先躺着。',
    expect: 'keep-body',
    mustInclude: ['我没跑', '你先躺着'],
    mustExclude: ['礼貌客服'],
  },
];

let fail = 0;
console.log('=== 出站清洗回归（直接跑线上模块）===');
console.log(`  RULE_LEAK_LINES ${RULE_LEAK_LINES.length} 条 · OUTBOUND_RULES ${OUTBOUND_RULES.length} 条`);
console.log();

for (const c of CASES) {
  const clean = stripInternalLeak(c.input);
  const violation = scanOutgoing([{ type: 'text', data: { text: clean } }]);
  const droppedEarly = clean.trim() === '' || (clean.length / c.input.length < 0.4);
  let ok = false;
  let detail = `clean=${JSON.stringify(clean).slice(0, 70)} audit=${JSON.stringify(violation)}`;

  if (c.expect === 'drop') ok = droppedEarly || violation !== '';
  else if (c.expect === 'audit') ok = violation !== '' || droppedEarly;
  else if (c.expect === 'keep') ok = clean === c.input && violation === '';
  else if (c.expect === 'keep-body') {
    ok = (c.mustInclude || []).every((s) => clean.includes(s))
      && (c.mustExclude || []).every((s) => !clean.includes(s))
      && violation === '';
  }

  if (!ok) fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!ok) console.log('        ' + detail);
}

console.log();
console.log(fail === 0 ? `全绿：${CASES.length}/${CASES.length}` : `${fail}/${CASES.length} 失败`);
process.exit(fail === 0 ? 0 : 1);
