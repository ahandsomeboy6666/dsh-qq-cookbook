// 离线合并测试：在独立 Node 进程里 apply 插件，用临时数据目录 + 专用端口 + 假账号，
// 走真实的「接收 → 合并 → 提交 → 发送」路径，验证两条 QQ 消息按序合并。
//
// 隔离保证：
//   - 数据目录 = os.tmpdir()/bridge-offline-<随机>（会话/历史/状态/锁全部落这里）
//   - 假 NapCat 端口 = 16701（不碰真实 6701，真 NapCat 可以一直开着）
//   - 账号 = 900000001（假账号）
//   - 模型 = 假 sessionController（返回固定答案，不消耗额度）
//
// 用法：
//   node checks/replay/merge-offline.mjs              # 正常跑，应 exit 0
//   node checks/replay/merge-offline.mjs --invert     # 故意把预期顺序写反，应 exit 1
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createFakeNapCat } from './fake-napcat.mjs';

const INVERT = process.argv.includes('--invert');
const PORT = 16701;                 // 专用端口，不碰真实 6701
const USER = '900000001';           // 假账号
const FIXED_REPLY = '离线测试固定回复';
// 默认验证实际安装的插件；--plugin <dir> 可指向干净目录重建出来的那份。
const pluginArg = (() => { const i = process.argv.indexOf('--plugin'); return i >= 0 ? process.argv[i + 1] : null; })();
// 默认顺序：--plugin > 仓库内 vendor > 本机 DSH profile。
// 干净环境（CI/新机器）没有本机 profile，只要仓库里 vendor 在就能跑。
const REPO_VENDOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'dsh-im-bridge');
const VENDOR = pluginArg
  ? path.resolve(pluginArg)
  : (fs.existsSync(path.join(REPO_VENDOR, 'index.js'))
      ? REPO_VENDOR
      : path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-im-bridge'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 假的 cordis Context：只提供插件实际用到的那些接口 */
function makeCtx(prompts) {
  const handlers = new Map();
  const services = new Map();
  let sessionSeq = 0;
  const ctx = {
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
      return () => {};
    },
    emit(event, ...args) {
      for (const fn of handlers.get(event) || []) {
        try { fn(...args); } catch { /* 测试里吞掉，靠断言判断 */ }
      }
    },
    get(name) { return services.get(name); },
    set(name, v) { services.set(name, v); return v; },
    provide(name, v) { services.set(name, v); return v; },
    effect(fn) { try { fn(); } catch { /* ignore */ } },
  };
  // 假模型：记录每次提交的用户正文，并回一条固定答案。
  // 注意：插件是 export const inject = ['sessionController']，cordis 会把服务注入成
  // ctx 的属性（不是 ctx.get），所以这里必须同时挂属性。
  const sessionStub = {
    async create() {
      sessionSeq += 1;
      return { sessionId: 'session-offline-' + sessionSeq };
    },
    async prompt(req) {
      prompts.push({
        at: Date.now(),
        sessionId: req.sessionId,
        // 只保留用户正文（插件把注入和用户文本都塞在 content 里）
        texts: (req.content || []).filter((p) => p && p.type === 'text').map((p) => String(p.text ?? '')),
      });
      const turn = prompts.length;
      // 走插件正常监听的会话事件，把固定答案送回去
      setTimeout(() => {
        ctx.emit('session/event', { id: req.sessionId }, { type: 'turn/start', data: { turn } });
        ctx.emit('session/event', { id: req.sessionId }, {
          type: 'assistant/message',
          data: { turn, message: { content: [{ type: 'text', text: FIXED_REPLY }] } },
        });
        ctx.emit('session/event', { id: req.sessionId }, { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
      }, 30);
      return undefined;
    },
    async archiveSession() {},
  };
  services.set('sessionController', sessionStub);
  ctx.sessionController = sessionStub;
  return ctx;
}

/** 跑一轮：注入两条消息，返回观测结果 */
const REAL_DATA = path.join(os.homedir(), '.dsh', 'im-bridge');
const WATCHED = ['messages.json', 'features.json', 'state.json', 'settings.json'];

/** 真实桥接目录里几个关键文件的指纹（大小 + 前 64KB 的 sha1）。只读。 */
function fingerprintReal() {
  const out = {};
  for (const f of WATCHED) {
    const p = path.join(REAL_DATA, f);
    if (!fs.existsSync(p)) { out[f] = '(missing)'; continue; }
    const st = fs.statSync(p);
    const buf = fs.readFileSync(p).subarray(0, 65536);
    out[f] = st.size + ':' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  }
  return out;
}
function diffFingerprint(a, b) {
  const changed = [];
  for (const k of WATCHED) if (a[k] !== b[k]) changed.push(k + ': ' + a[k] + ' → ' + b[k]);
  return changed;
}

async function runOnce(order) {
  const dataDir = path.join(os.tmpdir(), 'bridge-offline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
  fs.mkdirSync(dataDir, { recursive: true });
  // 关掉贴纸和随机补话：它们会让「假QQ收到几条」跨次不稳定，
  // 而这条测试只关心「合并 + 一次提交 + 一次固定回复」。
  fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({
    stickers: { enabled: false },
    afterthought: { enabled: false, chance: 0 },
  }), 'utf8');
  // 固定前文只写进测试目录：桥接启动时从自己的 dataDir 读 history。
  // 这样「上一轮说了什么」是夹具决定，不是模型临场生成。
  const now = Date.now();
  const fixtureRow = (i, dir, text, mid) => {
    const r = { time: now - (4 - i) * 60000, accountId: '', personaId: 'feiyu', dir, chat: 'private:' + USER, text };
    if (dir === 'in') r.speakerId = USER, r.speakerName = '回放用户', r.userText = text, r.messageId = mid, r.image = false;
    else r.delivery = 'sent', r.messageId = mid, r.error = '', r.files = [];
    return r;
  };
  fs.writeFileSync(path.join(dataDir, 'messages.json'), JSON.stringify([
    fixtureRow(0, 'in', '宝宝', '980000001'),
    fixtureRow(1, 'in', '宝宝', '980000002'),
    fixtureRow(2, 'in', '现在在干嘛', '980000003'),
    fixtureRow(3, 'out', '在听歌 一首老歌循环好几遍了', '980000004'),
  ]), 'utf8');

  const napcat = createFakeNapCat({ port: PORT, log: () => {} });
  await napcat.start();

  const prompts = [];
  const ctx = makeCtx(prompts);
  const mod = await import(pathToFileURL(path.join(VENDOR, 'index.js')).href);

  mod.apply(ctx, {
    wsUrl: 'ws://127.0.0.1:' + PORT,
    accessToken: '',
    allowUsers: [USER],
    allowGroups: [],
    dataDir,
  });

  // 等桥接连上假 NapCat
  for (let i = 0; i < 60 && !napcat.connected(); i += 1) await sleep(100);

  const filesBefore = fs.readdirSync(dataDir).sort();

  // 注入两条，间隔 200ms（小于 mergeMs 650，应进同一批）
  napcat.pushPrivate(USER, order[0]);
  await sleep(200);
  napcat.pushPrivate(USER, order[1]);

  // 等提交 + 发送
  let waited = 0;
  while (prompts.length === 0 && waited < 15000) { await sleep(100); waited += 100; }
  await sleep(1500);

  // 回读测试目录里的 history，证明固定前文真的落在隔离目录里
  let fixtureInTestDir = [];
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(dataDir, 'messages.json'), 'utf8'));
    fixtureInTestDir = rows.filter((r) => String(r.chat) === 'private:' + USER).map((r) => r.dir + ':' + String(r.text).slice(0, 24));
  } catch { /* ignore */ }

  const result = {
    dataDir,
    fixtureInTestDir,
    filesCreated: filesBefore,
    promptCount: prompts.length,
    submittedTexts: prompts.map((p) => p.texts),
    sentCount: napcat.state.sent.length,
    sentTexts: napcat.state.sent.map((s) => s.text),
  };

  ctx.emit('dispose');
  await sleep(300);
  await napcat.stop();
  return result;
}

async function main() {
  console.log('=== 离线合并测试（独立进程 / 临时目录 / 假端口 / 假模型）===');
  console.log('  端口:', PORT, ' 账号:', USER, ' 模式:', INVERT ? '反向预期（应失败）' : '正常');
  console.log();

  const A = '想你呀，虽然说过了';
  const B = '但是我还想说';

  const fpBefore = fingerprintReal();
  console.log('  真实目录指纹（运行前）:', JSON.stringify(fpBefore).slice(0, 140));
  console.log();

  // ① 正序
  const r1 = await runOnce([A, B]);
  console.log('[正序] 注入: ' + A + '  →  ' + B);
  console.log('  数据目录:', r1.dataDir);
  console.log('  目录内文件:', r1.filesCreated.join(', ') || '(空)');
  console.log('  模型提交次数:', r1.promptCount);
  const submit1 = (r1.submittedTexts[0] || []).find((t) => t.includes(A) && t.includes(B)) || '';
  console.log('  提交正文（含用户两条的那一段）:', JSON.stringify(submit1).slice(0, 160));
  console.log('  假QQ收到:', r1.sentCount, '条 →', JSON.stringify(r1.sentTexts).slice(0, 120));
  console.log();

  // ② 交换顺序
  const r2 = await runOnce([B, A]);
  console.log('[反序] 注入: ' + B + '  →  ' + A);
  console.log('  模型提交次数:', r2.promptCount);
  const submit2 = (r2.submittedTexts[0] || []).find((t) => t.includes(A) && t.includes(B)) || '';
  console.log('  提交正文:', JSON.stringify(submit2).slice(0, 160));
  console.log('  假QQ收到:', r2.sentCount, '条');
  console.log();

  const fpAfter = fingerprintReal();
  const changed = diffFingerprint(fpBefore, fpAfter);
  console.log('=== 真实目录是否被写 ===');
  console.log(changed.length === 0 ? '  未变化 ✓' : '  发生变化 ✗ ' + changed.join(' | '));
  console.log();
  console.log('=== 测试目录里的固定前文 ===');
  console.log('  ', r1.fixtureInTestDir.join(' | ') || '(空)');
  console.log();

  // ── 断言 ──
  const fails = [];
  const expectFirst = INVERT ? B : A;
  const expectSecond = INVERT ? A : B;

  if (r1.promptCount !== 1) fails.push(`正序：模型提交 ${r1.promptCount} 次，应为 1 次`);
  if (!submit1) fails.push('正序：提交正文里没找到包含两条消息的那一段');
  else {
    const i1 = submit1.indexOf(expectFirst);
    const i2 = submit1.indexOf(expectSecond);
    if (i1 < 0) fails.push(`正序：提交正文缺少「${expectFirst}」`);
    if (i2 < 0) fails.push(`正序：提交正文缺少「${expectSecond}」`);
    if (i1 >= 0 && i2 >= 0 && i1 > i2) fails.push(`正序：顺序错误（${expectFirst} 应在 ${expectSecond} 之前）`);
  }
  // 严格断言：假 QQ 总共只收到 1 条，且正文就是固定回复
  if (r1.sentCount !== 1) {
    fails.push(`正序：假 QQ 总共收到 ${r1.sentCount} 条，应恰好 1 条（实际：${JSON.stringify(r1.sentTexts).slice(0, 100)}）`);
  } else if (r1.sentTexts[0] !== FIXED_REPLY) {
    fails.push(`正序：唯一那条不是固定回复（实际：${JSON.stringify(r1.sentTexts[0])}）`);
  }
  if (r2.sentCount !== 1) {
    fails.push(`反序：假 QQ 总共收到 ${r2.sentCount} 条，应恰好 1 条`);
  } else if (r2.sentTexts[0] !== FIXED_REPLY) {
    fails.push('反序：唯一那条不是固定回复');
  }

  if (r2.promptCount !== 1) fails.push(`反序：模型提交 ${r2.promptCount} 次，应为 1 次`);
  if (submit2) {
    const j1 = submit2.indexOf(B);
    const j2 = submit2.indexOf(A);
    if (j1 < 0 || j2 < 0) fails.push('反序：提交正文缺少某一条');
    else if (j1 > j2) fails.push('反序：顺序没有随输入改变');
  } else fails.push('反序：提交正文里没找到包含两条消息的那一段');

  // 隔离：数据目录必须是临时的，且真目录没被写
  const realDir = path.join(os.homedir(), '.dsh', 'im-bridge');
  for (const r of [r1, r2]) {
    if (path.resolve(r.dataDir).startsWith(path.resolve(realDir))) fails.push('数据目录落到了真实目录：' + r.dataDir);
  }

  if (changed.length) fails.push('真实数据目录被写入：' + changed.join(' | '));
  if (!(r1.fixtureInTestDir || []).some((x) => x.includes('宝宝'))) fails.push('测试目录里没有预置的「宝宝」前文');
  if (!(r1.fixtureInTestDir || []).some((x) => x.includes('听歌'))) fails.push('测试目录里没有预置的「听歌」前文');

  if (fails.length === 0) {
    console.log('=== PASS（4 项断言全绿）===');
    process.exit(0);
  }
  console.log('=== FAIL ===');
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}

main().catch((e) => { console.error('测试出错:', e.message); process.exit(1); });
