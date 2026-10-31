#!/usr/bin/env node
/**
 * 从零安装（隔离）：临时目录 + 独立 DSH_HOME，验证 clone → checkout → patch → 注册。
 *
 * 用法：node checks/check-clean-install.mjs [--skip]   （--skip 跳过真实 clone）
 * 说明：会真实 clone 一次插件（约 30MB，走镜像），约 1–3 分钟。
 */
import { existsSync, mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') {
  console.log('[SKIP] 非 Windows（setup.mjs 依赖 PowerShell），跳过');
  process.exit(2);
}
if (process.argv.includes('--skip')) {
  console.log('[SKIP] 指定了 --skip，跳过真实 clone');
  process.exit(2);
}

const ROOT = dirname(import.meta.dirname);
// 网络预检：真实上游 clone 依赖网络；不可达时明确 SKIP 而不是报失败/假绿
async function networkOk() {
  for (const url of ['https://github.com', 'https://gh-proxy.com']) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
      if (res.ok || res.status < 500) return true;
    } catch { /* 换下一个 */ }
  }
  return false;
}
if (!(await networkOk())) {
  console.log('[SKIP] GitHub 与镜像均不可达，跳过从零安装（请检查网络后再跑）');
  process.exit(2);
}

const tmpBase = join(dirname(ROOT), '.tmp-clean-install');
mkdirSync(tmpBase, { recursive: true });
const tmp = mkdtempSync(join(tmpBase, 'run-'));
const fails = [];
const pass = [];

try {
  // 1. 复制仓库骨架（不含 vendor / node_modules / .git）
  const need = ['config', 'patches', 'roles'];
  for (const dir of need) {
    if (existsSync(join(ROOT, dir))) cpSync(join(ROOT, dir), join(tmp, dir), { recursive: true });
  }
  mkdirSync(join(tmp, 'tools'), { recursive: true });
  // setup.mjs 依赖 yaml（根 node_modules）：用 junction 挂过去
  if (existsSync(join(ROOT, 'node_modules'))) {
    try { symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'), 'junction'); } catch { /* 已存在 */ }
  }
  if (existsSync(join(ROOT, 'package.json'))) cpSync(join(ROOT, 'package.json'), join(tmp, 'package.json'));
  cpSync(join(ROOT, 'tools', 'setup.mjs'), join(tmp, 'tools', 'setup.mjs'));
  // 真实上游 clone（不依赖本机 vendor）
  if (existsSync(join(ROOT, 'tools', '一键启动肥鱼.bat'))) cpSync(join(ROOT, 'tools', '一键启动肥鱼.bat'), join(tmp, 'tools', '一键启动肥鱼.bat'));
  // 假 DSH 桌面端（只做安装检测）：DSH_DESKTOP_DIR 设了之后就只认它
  const fakeDsh = join(tmp, 'fake-dsh');
  mkdirSync(join(fakeDsh, 'resources'), { recursive: true });
  writeFileSync(join(fakeDsh, 'DeepSeek Harness.exe'), '', 'utf8');
  writeFileSync(join(fakeDsh, 'resources', 'app-update.yml'), 'version: 0.0.0\n', 'utf8');

  // 隔离 DSH_HOME + 空 desktop profile
  const dshHome = join(tmp, 'dsh-home');
  mkdirSync(join(dshHome, 'profiles', 'desktop'), { recursive: true });
  // 注册步骤需要读 profile 的 package.json
  writeFileSync(join(dshHome, 'profiles', 'desktop', 'package.json'), JSON.stringify({ name: 'desktop-profile', private: true }, null, 2) + '\n', 'utf8');
  // 不完整 NapCat（只放一个文件）→ 触发 setup 下载 Shell 包 + digest 校验 + 解压
  const partialNapcat = join(tmp, 'tools', 'napcat', 'NapCat.52892.Shell');
  mkdirSync(partialNapcat, { recursive: true });
  writeFileSync(join(partialNapcat, 'napcat.mjs'), '', 'utf8');

  // 2. 跑 setup（真实 clone；跳过 MCP/下载）
  const r = spawnSync(process.execPath, [
    join(tmp, 'tools', 'setup.mjs'),
    '--qq', '000000000',
    '--skip-mcp',
    '--no-download',
    '--mirror', process.env.CLEAN_INSTALL_MIRROR || 'https://gh-proxy.com/',
  ], {
    cwd: tmp,
    encoding: 'utf8',
    timeout: 600000,
    env: { ...process.env, DSH_HOME: dshHome, DSH_DESKTOP_DIR: fakeDsh },
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  const lines = out.split(/\r?\n/).filter((l) => /\[\w+\]/.test(l));

  // 解析每个 step 的状态
  const stepRe = /\[(OK|SKIP|TODO|FAIL)\]\s+([^\s].*?)(?:\s{2,}|$)/;
  const steps = lines.map((l) => { const m = l.match(stepRe); return m ? { status: m[1], name: m[2].trim() } : null; }).filter(Boolean);
  const statusOf = (name) => (steps.find((s) => s.name === name) ?? {}).status ?? '';
  const failNames = steps.filter((s) => s.status === 'FAIL').map((s) => s.name);

  // 必需步骤：缺失或非 OK 都算失败
  const REQUIRED = ['clone 插件', '应用本地补丁', '注册到 desktop profile'];
  for (const name of REQUIRED) {
    const st = statusOf(name);
    if (st === 'OK') pass.push(name + ' OK');
    else fails.push(name + ' 状态=' + (st || '缺失'));
  }

  // 可选步骤：环境相关，允许失败，但必须出现在白名单里
  const OPTIONAL_ALLOW_FAIL = new Set([
    'NapCat 本体', '补全 NapCat', 'NapCat 自带 QQ', '安装 NapCat',
    '写入人设', '语音（edge-tts）', '语音配置', '开启语音', 'NapCat 启动器',
    '安装 Playwright MCP', '写 cordis.patch.yml',
  ]);
  const unexpected = failNames.filter((n) => !OPTIONAL_ALLOW_FAIL.has(n) && !REQUIRED.includes(n));
  if (unexpected.length) fails.push('出现了白名单外的失败步骤：' + unexpected.join('、'));
  else pass.push('失败步骤均在可选白名单内（' + (failNames.join('、') || '无') + '）');

  // NapCat：Shell 包真实下载 + 解压（4 个 Shell 文件；QQ.exe 不在 Shell 包里，靠 OneKey/自带）
  const napcatDir = join(tmp, 'tools', 'napcat', 'NapCat.52892.Shell');
  const shellFiles = ['napcat.mjs', 'NapCatWinBootMain.exe', 'NapCatWinBootHook.dll', 'loadNapCat.js'];
  const missingShell = shellFiles.filter((n) => !existsSync(join(napcatDir, n)));
  if (missingShell.length === 0) pass.push('NapCat Shell 包解压成功（4 个文件齐全）');
  else fails.push('NapCat Shell 不完整，缺 ' + missingShell.join('、'));
  // digest：校验通过 或 明确降级警告（二者都是可接受路径）
  if (/NapCat 包 sha256 校验通过/.test(out)) pass.push('NapCat 包 sha256 校验通过');
  else if (/无法获取 GitHub digest[^\n]*降级为结构校验/.test(out)) pass.push('NapCat 摘要不可得 → 明确降级警告（结构校验）');
  else fails.push('既没有 sha256 校验也没有降级警告');
  // QQ.exe：Shell 包不含，setup 必须给出明确指引
  if (!existsSync(join(napcatDir, 'QQ.exe'))) {
    if (/QQ\.exe/.test(out)) pass.push('缺 QQ.exe 时输出中提及 QQ.exe（指引）');
    else fails.push('缺 QQ.exe 但 setup 没有明确提示');
  } else {
    pass.push('NapCat 自带 QQ.exe');
  }

  // 安装产物必须含出站审计（patch 真的生效）
  const installedIndex = join(tmp, 'vendor', 'dsh-im-bridge', 'index.js');
  if (existsSync(installedIndex)) {
    const installedSrc = readFileSync(installedIndex, 'utf8');
    if (installedSrc.includes('scanOutgoing')) pass.push('安装产物含 scanOutgoing');
    else fails.push('安装产物缺少 scanOutgoing（patch 未包含审计改动）');
    if (installedSrc.includes('auditedAt')) pass.push('安装产物含 auditedAt');
    else fails.push('安装产物缺少 auditedAt');
  } else {
    fails.push('安装后找不到 vendor/dsh-im-bridge/index.js');
  }

  // 版本校验：vendor HEAD 应等于固定 SHA
  const vendor = join(tmp, 'vendor', 'dsh-im-bridge');
  if (existsSync(join(vendor, '.git'))) {
    const head = spawnSync('git', ['-C', vendor, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    const defaults = JSON.parse(readFileSync(join(tmp, 'config', 'defaults.json'), 'utf8'));
    const got = String(head.stdout ?? '').trim();
    if (got === defaults.pluginBaseline) pass.push('vendor HEAD = pluginBaseline');
    else fails.push(`vendor HEAD ${got.slice(0, 7)} ≠ ${defaults.pluginBaseline.slice(0, 7)}`);
  } else {
    fails.push('vendor 目录没有 .git（clone 失败）');
  }

  // setup 退出码不作为断言：NapCat 版本/语音等环境步骤可能 FAIL，本次只验 clone→patch→注册
} catch (e) {
  fails.push('从零安装测试异常：' + String(e?.message ?? e).slice(0, 200));
} finally {
  try { rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* 清理失败不影响结果 */ }
}

for (const p of pass) console.log('[PASS] ' + p);
for (const f of fails) console.log('[FAIL] ' + f);
if (!fails.length) console.log('\n从零安装：全绿');
process.exit(fails.length === 0 ? 0 : 1);
