// 最小 harness：把 DSH 那层剥掉，直接调插件的 apply，看它到底在哪一步抛错。
// 只做加载验证，不连 QQ、不发消息、不调模型。
// 用法：node checks/replay/load-check.mjs
// 账号从环境变量读（REPLAY_PROD_USER / REPLAY_PROD_GROUP），缺失时用占位符；
// 这样脚本可以公开，实际使用时不把真实号写进仓库。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

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
const ENTRY = pathToFileURL(path.join(VENDOR, 'index.js')).href;

// 尽量接近 cordis Context 的最小实现
function makeCtx() {
  const handlers = new Map();
  const services = new Map();
  const ctx = {
    logger: {
      info: (...a) => console.log('[info]', ...a),
      warn: (...a) => console.log('[warn]', ...a),
      error: (...a) => console.log('[error]', ...a),
      debug: () => {},
    },
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
      return () => {};
    },
    emit(event, ...args) {
      for (const fn of handlers.get(event) || []) {
        try { fn(...args); } catch (e) { console.log('[emit error]', event, e.message); }
      }
    },
    get(name) { return services.get(name); },
    set(name, value) { services.set(name, value); },
    provide(name, value) { services.set(name, value); return value; },
    effect(fn) { try { fn(); } catch (e) { console.log('[effect error]', e.message); } },
  };
  // 插件 inject 了 sessionController
  services.set('sessionController', {
    async create() { throw new Error('harness: 不建会话'); },
    async prompt() { throw new Error('harness: 不提交 prompt'); },
    async archiveSession() {},
  });
  return ctx;
}

const cfg = {
  wsUrl: 'ws://127.0.0.1:6701',
  accessToken: '',
  allowUsers: [(process.env.REPLAY_PROD_USER || '000000000')],
  allowGroups: [(process.env.REPLAY_PROD_GROUP || '000000000')],
  // 默认用独立目录；加 --real-data 用真实目录（用来验证单实例锁会不会挡住新实例）
  dataDir: process.argv.includes('--real-data')
    ? path.join(os.homedir(), '.dsh', 'im-bridge')
    : path.join(os.tmpdir(), 'bridge-load-check'),
};

console.log('=== 插件加载自检（不含 QQ / 模型）===');
console.log('入口:', ENTRY);
console.log('数据目录:', cfg.dataDir);
fs.mkdirSync(cfg.dataDir, { recursive: true });

let mod;
try {
  mod = await import(ENTRY);
  console.log('PASS  import 成功');
} catch (e) {
  console.log('FAIL  import 失败:', e.message.split('\n')[0]);
  process.exit(1);
}

console.log('  导出:', Object.keys(mod).join(', '));
if (typeof mod.apply !== 'function') {
  console.log('FAIL  没有导出 apply 函数');
  process.exit(1);
}

const ctx = makeCtx();
let applyError = null;
try {
  mod.apply(ctx, cfg);
  console.log('PASS  apply 执行完成（没抛错）');
} catch (e) {
  applyError = e;
  console.log('FAIL  apply 抛错:', e.message.split('\n')[0]);
  console.log('      堆栈首行:', (e.stack || '').split('\n')[1]?.trim());
}

// apply 之后：dispose 能否干净走完
try {
  ctx.emit('dispose');
  console.log('PASS  dispose 执行完成');
} catch (e) {
  console.log('FAIL  dispose 抛错:', e.message.split('\n')[0]);
}

process.exit(applyError ? 1 : 0);
