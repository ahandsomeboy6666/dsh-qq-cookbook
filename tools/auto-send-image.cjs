#!/usr/bin/env node
/**
 * 肥鱼生图自动发群（独立脚本，不依赖桥接内部逻辑）
 *
 * 原理：
 *   监听 ComfyUI output 目录（feiyu* 新图）
 *   → 通过 NapCat HTTP API（127.0.0.1:6700）发送到指定群
 *
 * 用法：node tools/auto-send-image.cjs [groupId]
 *   默认 groupId = 834195405
 *
 * 去重：已发过的文件名记录在 E:/workspace/dsh-qq-cookbook/tools/.sent-images.json
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUTPUT_DIR = 'E:\\workspace\\comfyui\\ComfyUI_windows_portable\\ComfyUI\\output';
const NAPCAT_API = { host: '127.0.0.1', port: 6700 };
const GROUP_ID = process.argv[2] || '834195405';
const STATE_FILE = path.join(__dirname, '.sent-images.json');

// 读取已发记录
let sent = new Set();
const processing = new Set(); // 正在发送中的文件（防并发重复）
try {
  if (fs.existsSync(STATE_FILE)) {
    const j = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    sent = new Set(Array.isArray(j) ? j : []);
  }
} catch {}

function saveSent() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify([...sent].slice(-500)), 'utf8'); } catch {}
}

function log(msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${msg}`);
}

/** 调 NapCat HTTP API */
function napcat(pathname, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: NAPCAT_API.host,
      port: NAPCAT_API.port,
      path: pathname,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      timeout: 15000,
    }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf.slice(0, 300) }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

async function sendImage(filePath, name) {
  // NapCat 支持 file:// 绝对路径
  const fileUri = 'file:///' + filePath.replace(/\\/g, '/');
  const res = await napcat('/send_group_msg', {
    group_id: Number(GROUP_ID),
    message: [{ type: 'image', data: { file: fileUri } }],
  });
  log(`send ${name} -> ${res.status} ${res.body.slice(0, 120)}`);
  return res.status === 200 && res.body.includes('"status":"ok"');
}

let lastScan = Date.now();
let scanning = false;

async function scan() {
  if (scanning) return;
  scanning = true;
  try {
  let files = [];
  try { files = fs.readdirSync(OUTPUT_DIR); } catch { return; }
  const now = Date.now();
  const fresh = [];
  for (const name of files) {
    if (!/^feiyu-group.*\.(png|jpe?g|webp)$/i.test(name)) continue;
    if (sent.has(name) || processing.has(name)) continue;
    const p = path.join(OUTPUT_DIR, name);
    try {
      const st = fs.statSync(p);
      // 只处理最近 15 分钟内、且比上次扫描新的图
      if (st.size > 50 * 1024 && now - st.mtimeMs < 15 * 60 * 1000) {
        fresh.push({ name, p, mtime: st.mtimeMs });
      }
    } catch {}
  }
  if (!fresh.length) return;
  fresh.sort((a, b) => a.mtime - b.mtime); // 按时间顺序发
  for (const f of fresh) {
    if (sent.has(f.name) || processing.has(f.name)) continue;
    processing.add(f.name);
    try {
      await new Promise(r => setTimeout(r, 1200));
      const ok = await sendImage(f.p, f.name);
      if (ok) { sent.add(f.name); saveSent(); }
    } finally {
      processing.delete(f.name);
    }
  }
  } finally { scanning = false; }
}

(async () => {
  log(`auto-send-image 启动：group=${GROUP_ID}，output=${OUTPUT_DIR}`);
  log(`已发记录 ${sent.size} 条`);
  // 首次把已有旧图标记为已发（避免启动就发一堆历史图）
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const name of files) {
      if (!/^feiyu-group.*\.(png|jpe?g|webp)$/i.test(name)) continue;
      const st = fs.statSync(path.join(OUTPUT_DIR, name));
      if (st.mtimeMs < Date.now() - 5 * 60 * 1000) { sent.add(name); }
    }
    saveSent();
    log(`历史图已跳过 ${sent.size} 条`);
  } catch {}

  setInterval(() => { scan().catch(e => log('scan err: ' + e.message)); }, 4000);
  // 立即扫一次
  scan().catch(() => {});
})();
