// 迁移场景验证：5 个场景，全部跑真实的 tools/setup.mjs（带 --skip-napcat，不受下载源影响）。
// 断言真实退出码 + 文件状态，不解析日志文字。
//
// 用法：node checks/replay/patch-upgrade.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve('.');
const NEW_PATCH = path.join(ROOT, 'patches', 'dsh-im-bridge-1.19.0-private-chat.patch');
const OLD_PATCH = path.join(ROOT, 'patches', 'dsh-im-bridge-1.19.0-local.patch');
const UPSTREAM = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-im-bridge');
const NODE = process.execPath;
const BASELINE = (() => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'defaults.json'), 'utf8'));
    return String(d.pluginBaseline || 'HEAD');
  } catch { return 'HEAD'; }
})();

const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { code: r.status ?? -1, out: (r.stdout || '') + (r.stderr || '') };
};

/** 造临时仓库：上游 vendor + setup 所需最小集 */
function makeRepo(tag) {
  const dir = path.join(os.tmpdir(), 'mig-' + tag + '-' + Date.now().toString(36));
  fs.mkdirSync(dir, { recursive: true });
  for (const rel of ['tools', 'config', 'patches', 'checks', 'docs']) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(dir, rel), {
      recursive: true,
      filter: (s) => !/\.bak-|node_modules|NapCat\.52892/.test(s),
    });
  }
  // 必须克隆真实历史再 checkout 到基线：安装器会比对 vendor 的 HEAD hash，
  // 用 git archive + git init 重建出来的 hash 必然不同，会被判成「版本不符」。
  const vend = path.join(dir, 'vendor', 'dsh-im-bridge');
  execFileSync('git', ['clone', '-q', UPSTREAM, vend], { stdio: 'ignore' });
  execFileSync('git', ['-c', 'advice.detachedHead=false', 'checkout', '-q', BASELINE], { cwd: vend }, { stdio: 'ignore' });
  execFileSync('git', ['clean', '-qfd'], { cwd: vend }, { stdio: 'ignore' });
  // setup.mjs 用 yaml；临时仓库没有 node_modules 时它会去 npm install 并失败。
  // 用 junction 而不是复制：yaml 目录里有符号链接，cpSync 会报 EIO。
  const yamlSrc = path.join(ROOT, 'node_modules', 'yaml');
  if (fs.existsSync(yamlSrc)) {
    const nm = path.join(dir, 'node_modules');
    fs.mkdirSync(nm, { recursive: true });
    const link = path.join(nm, 'yaml');
    try {
      execFileSync('cmd', ['/c', 'mklink', '/J', link, yamlSrc], { stdio: 'ignore' });
    } catch {
      try { fs.symlinkSync(yamlSrc, link, 'junction'); } catch { /* 复制也失败就放弃，让测试报缺依赖 */ }
    }
  }
  return { dir, vend };
}

const SKIP = '--skip-napcat';

/** 跑安装器，返回真实退出码 */
function runSetup(dir, tag, extraEnv = {}) {
  const home = path.join(os.tmpdir(), 'mighome-' + tag + '-' + Date.now().toString(36));
  fs.mkdirSync(path.join(home, 'profiles', 'desktop'), { recursive: true });
  fs.writeFileSync(path.join(home, 'profiles', 'desktop', 'package.json'),
    JSON.stringify({ name: 'desktop', private: true }, null, 2));
  const r = spawnSync(NODE, ['tools/setup.mjs', '--qq', '000000000', '--group', '111111111', SKIP], {
    cwd: dir, encoding: 'utf8', timeout: 240000,
    env: { ...process.env, DSH_HOME: home, ...extraEnv },
  });
  const out = (r.stdout || '') + (r.stderr || '');
  return {
    exit: r.status ?? -1,
    patchLine: (out.split('\n').find((l) => l.includes('应用本地补丁')) || '').trim(),
    out,
  };
}

/** 新版是否到位：outbound-clean.js 存在且被 index.js 引用 */
function newPatchInPlace(vend) {
  const clean = path.join(vend, 'outbound-clean.js');
  if (!fs.existsSync(clean)) return false;
  const idx = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  return /outbound-clean\.js/.test(idx);
}

/** 插件能否加载（node --check + 实际 import apply） */
function canLoad(vend) {
  const chk = sh(NODE, ['--check', path.join(vend, 'index.js')], vend);
  if (chk.code !== 0) return { ok: false, why: 'node --check 失败：' + chk.out.slice(0, 120) };
  const probe = `import('${'file:///' + path.join(vend, 'index.js').replace(/\\/g, '/')}').then(m => {
    if (typeof m.apply !== 'function') { console.log('NO_APPLY'); process.exit(1); }
    console.log('OK');
  }).catch(e => { console.log('ERR:' + e.message); process.exit(1); });`;
  const r = sh(NODE, ['-e', probe], vend);
  return { ok: r.code === 0 && r.out.includes('OK'), why: r.out.trim().slice(0, 120) };
}

const results = [];

// ── 1 干净上游 → 安装 ──
{
  const { dir, vend } = makeRepo('1');
  const r = runSetup(dir, '1');
  const inPlace = newPatchInPlace(vend);
  const load = canLoad(vend);
  results.push({
    name: '1 干净上游安装',
    expect: 'exit 0 + 新版到位 + 可加载',
    exit: r.exit, inPlace, load: load.ok, loadWhy: load.why,
    ok: r.exit === 0 && inPlace && load.ok,
  });
}

// ── 2 只有旧补丁 → 升级 ──
{
  const { dir, vend } = makeRepo('2');
  sh('git', ['apply', OLD_PATCH], vend);
  const oldBefore = fs.readFileSync(path.join(vend, 'index.js'), 'utf8').includes('normalizeGroupWake');
  const r = runSetup(dir, '2');
  const inPlace = newPatchInPlace(vend);
  const load = canLoad(vend);
  results.push({
    name: '2 旧补丁安装 → 升级',
    expect: 'exit 0 + 新版到位 + 可加载',
    exit: r.exit, oldBefore, inPlace, load: load.ok, loadWhy: load.why,
    ok: oldBefore && r.exit === 0 && inPlace && load.ok,
  });
}

// ── 3 新版重复运行 → 不重复应用、内容不变 ──
{
  const { dir, vend } = makeRepo('3');
  sh('git', ['apply', NEW_PATCH], vend);
  const before = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  const r = runSetup(dir, '3');
  const after = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  results.push({
    name: '3 新版重跑',
    expect: 'exit 0 + 不重复应用 + 内容不变',
    exit: r.exit, identical: before === after, patchLine: r.patchLine,
    ok: r.exit === 0 && before === after,
  });
}

// ── 4 旧版 + 本机修改 + 未跟踪备份 → 非零退出、原样保留 ──
{
  const { dir, vend } = makeRepo('4');
  sh('git', ['apply', OLD_PATCH], vend);
  // 本机已跟踪文件改动 + 未跟踪备份
  const bfPath = path.join(vend, 'bridge-features.js');
  fs.appendFileSync(bfPath, '\n// 本机手改：不要覆盖\n', 'utf8');
  const bakPath = path.join(vend, 'index.js.local-backup');
  fs.writeFileSync(bakPath, '// 我的备份，别删\n', 'utf8');
  const bakBefore = fs.readFileSync(bakPath, 'utf8');
  const r = runSetup(dir, '4');
  const bfAfter = fs.readFileSync(bfPath, 'utf8');
  const bakExists = fs.existsSync(bakPath);
  // 本机改动是否还在：查我写进去的那行注释
  const noteKept = bfAfter.includes('本机手改：不要覆盖');
  results.push({
    name: '4 旧版+本机改动 → 拒绝并保留',
    expect: 'exit≠0 + 本机改动与未跟踪备份原样',
    exit: r.exit,
    trackedKept: noteKept,
    untrackedKept: bakExists && fs.readFileSync(bakPath, 'utf8') === bakBefore,
    patchLine: r.patchLine,
    ok: r.exit !== 0 && noteKept && bakExists,
  });
}

// ── 5 新版补丁故意损坏 → 非零退出、旧版安装完整 ──
{
  const { dir, vend } = makeRepo('5');
  sh('git', ['apply', OLD_PATCH], vend);
  const idxBefore = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  // 把临时仓库里的新补丁改坏（只改副本，不动仓库里的）
  const badPatch = path.join(dir, 'patches', 'dsh-im-bridge-1.19.0-private-chat.patch');
  const orig = fs.readFileSync(badPatch, 'utf8');
  fs.writeFileSync(badPatch, orig.slice(0, Math.floor(orig.length / 2)) + '\n@@ 坏掉的 hunk @@\n', 'utf8');
  const r = runSetup(dir, '5');
  const idxAfter = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  results.push({
    name: '5 补丁损坏',
    expect: 'exit≠0 + 旧版安装保留',
    exit: r.exit,
    oldIntact: idxBefore === idxAfter,
    patchLine: r.patchLine,
    ok: r.exit !== 0 && idxBefore === idxAfter,
  });
}

// ── 6 演练通过但正式应用失败 → 旧版内容必须还在 ──
{
  const { dir, vend } = makeRepo('6');
  sh('git', ['apply', OLD_PATCH], vend);
  const idxBefore = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  const bfBefore = fs.readFileSync(path.join(vend, 'bridge-features.js'), 'utf8');

  // 用 setup.mjs 的测试注入钩子精确模拟「演练通过、正式应用失败」。
  // 文件系统层伪造（attrib/只读/ACL）要么拦不住 git apply，要么连带破坏 git 状态，
  // 会让流程在更早的检查就退出，测不到真正要测的分支。
  const r = runSetup(dir, '6', { BRIDGE_SETUP_TEST_FAIL_APPLY: '1' });

  const idxAfter = fs.readFileSync(path.join(vend, 'index.js'), 'utf8');
  const bfAfter = fs.readFileSync(path.join(vend, 'bridge-features.js'), 'utf8');
  const oldKept = idxAfter.includes('normalizeGroupWake') && !fs.existsSync(path.join(vend, 'outbound-clean.js'));
  results.push({
    name: '6 演练通过但正式应用失败',
    expect: 'exit≠0 + 旧版文件仍在',
    exit: r.exit,
    oldKept,
    idxSame: idxBefore === idxAfter,
    bfSame: bfBefore === bfAfter,
    patchLine: r.patchLine,
    ok: r.exit !== 0 && oldKept,
  });
}

console.log('=== 迁移 6 场景（真实 setup.mjs + --skip-napcat）===\n');
let bad = 0;
for (const c of results) {
  console.log(`── ${c.name}`);
  console.log(`   期望: ${c.expect}`);
  console.log(`   退出码: ${c.exit}`);
  if (c.oldBefore !== undefined) console.log(`   升级前有旧版标记: ${c.oldBefore ? '是' : '否'}`);
  if (c.inPlace !== undefined) console.log(`   新版文件到位: ${c.inPlace ? '是' : '否'}`);
  if (c.load !== undefined) console.log(`   插件可加载: ${c.load ? '是' : '否'}  ${c.load ? '' : c.loadWhy}`);
  if (c.identical !== undefined) console.log(`   index.js 未变: ${c.identical ? '是' : '否'}`);
  if (c.trackedKept !== undefined) console.log(`   已跟踪改动保留: ${c.trackedKept ? '是' : '否'}`);
  if (c.untrackedKept !== undefined) console.log(`   未跟踪备份保留: ${c.untrackedKept ? '是' : '否'}`);
  if (c.oldIntact !== undefined) console.log(`   旧版安装保留: ${c.oldIntact ? '是' : '否'}`);
  if (c.oldKept !== undefined) console.log(`   旧版标记仍在: ${c.oldKept ? '是' : '否'}`);
  if (c.idxSame !== undefined) console.log(`   index.js 未变: ${c.idxSame ? '是' : '否'} | bridge-features.js 未变: ${c.bfSame ? '是' : '否'}`);
  if (c.patchLine) console.log(`   补丁行: ${c.patchLine}`);
  console.log(`   判定: ${c.ok ? 'PASS' : 'FAIL'}`);
  console.log();
  if (!c.ok) bad += 1;
}
console.log(bad === 0 ? '=== 6/6 PASS ===' : `=== ${bad} 项 FAIL ===`);
process.exit(bad === 0 ? 0 : 1);
