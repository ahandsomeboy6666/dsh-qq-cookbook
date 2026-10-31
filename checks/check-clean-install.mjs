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
const tmpBase = 'E:/workspace/.tmp-clean-install';
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
  // 隔离 DSH_HOME + 空 desktop profile
  const dshHome = join(tmp, 'dsh-home');
  mkdirSync(join(dshHome, 'profiles', 'desktop'), { recursive: true });
  // 注册步骤需要读 profile 的 package.json
  writeFileSync(join(dshHome, 'profiles', 'desktop', 'package.json'), JSON.stringify({ name: 'desktop-profile', private: true }, null, 2) + '\n', 'utf8');
  // 假完整 NapCat（五个关键文件齐全）→ setup 跳过下载
  const fakeNapcat = join(tmp, 'tools', 'napcat', 'NapCat.52892.Shell');
  mkdirSync(fakeNapcat, { recursive: true });
  for (const f of ['napcat.mjs', 'NapCatWinBootMain.exe', 'NapCatWinBootHook.dll', 'loadNapCat.js', 'QQ.exe']) {
    writeFileSync(join(fakeNapcat, f), '', 'utf8');
  }

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
    env: { ...process.env, DSH_HOME: dshHome },
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  const lines = out.split(/\r?\n/).filter((l) => /\[\w+\]/.test(l));

  const has = (re) => re.test(out);
  if (!has(/\[OK\]\s+clone 插件/)) fails.push('clone 插件 未成功：\n' + lines.filter(l => /clone|FAIL/.test(l)).join('\n'));
  else pass.push('clone 插件 OK');

  if (has(/\[OK\]\s+应用本地补丁/)) pass.push('应用本地补丁 OK');
  else if (has(/\[SKIP\]\s+应用本地补丁/)) fails.push('应用本地补丁 被跳过（应在干净 vendor 上应用）');
  else fails.push('应用本地补丁 未成功：\n' + lines.filter(l => /补丁|FAIL/.test(l)).join('\n'));

  if (has(/\[OK\]\s+注册到 desktop profile/)) pass.push('注册到 profile OK');
  else fails.push('注册到 profile 未成功：\n' + lines.filter(l => /注册|FAIL/.test(l)).join('\n'));

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
