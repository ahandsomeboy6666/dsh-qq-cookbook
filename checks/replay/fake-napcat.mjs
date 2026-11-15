// 假 NapCat：只在本机 127.0.0.1 上监听，绝不连真实 QQ。
// 桥接把它当作 NapCat（WS 服务端 + OneBot action 应答），这里记录它发出的每一条消息。
//
// 为什么手写 WebSocket：cookbook 只依赖 yaml，没有 ws 包；桥接自己另有 MiniWebSocket 客户端。
// 这里只实现回放需要的最小子集：握手、文本帧收发、掩码解码、16/64 位长度。
import http from 'node:http';
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeFrame(payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function decodeFrames(buf) {
  const out = [];
  let off = 0;
  while (off + 2 <= buf.length) {
    const b1 = buf[off + 1];
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = off + 2;
    if (len === 126) { if (p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (p + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    const maskLen = masked ? 4 : 0;
    if (p + maskLen + len > buf.length) break;
    let data;
    if (masked) {
      const mask = buf.subarray(p, p + 4);
      p += 4;
      data = Buffer.alloc(len);
      for (let i = 0; i < len; i += 1) data[i] = buf[p + i] ^ mask[i % 4];
    } else {
      data = buf.subarray(p, p + len);
    }
    const opcode = buf[off] & 0x0f;
    out.push({ opcode, data });
    off = p + len;
  }
  return { frames: out, rest: buf.subarray(off) };
}

export function createFakeNapCat({ port = 6701, selfId = '3866560965', nickname = '大肥鱼', log = () => {} } = {}) {
  const state = {
    clients: new Set(),
    sent: [],        // 桥接真正发出去的消息（记录，不真发）
    actions: [],     // 收到的所有 action
    startedAt: 0,
  };

  const server = http.createServer((req, res) => {
    // 桥接的 request() 走 WS，这里只留一个健康检查
    if (req.url === '/get_status') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: { online: true, good: true }, retcode: 0, status: 'ok' }));
      return;
    }
    res.writeHead(404); res.end('fake napcat: only ws on ' + port);
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    log('client connected');
    state.clients.add(socket);
    let buf = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { frames, rest } = decodeFrames(buf);
      buf = rest;
      for (const f of frames) {
        if (f.opcode === 0x8) { socket.end(); state.clients.delete(socket); continue; }
        if (f.opcode === 0x9) { socket.write(Buffer.from([0x8a, 0x00])); continue; }
        if (f.opcode !== 0x1) continue;
        let msg;
        try { msg = JSON.parse(f.data.toString('utf8')); } catch { continue; }
        if (msg.action) {
          state.actions.push({ at: Date.now(), action: msg.action, params: msg.params });
          const reply = respondTo(msg);
          try { socket.write(encodeFrame(JSON.stringify(reply))); } catch { /* ignore */ }
        }
      }
    });

    socket.on('close', () => { state.clients.delete(socket); log('client disconnected'); });
    socket.on('error', () => { state.clients.delete(socket); });
  });

  function respondTo(msg) {
    const { action, params = {}, echo } = msg;
    const ok = (data) => ({ status: 'ok', retcode: 0, data, echo });
    switch (action) {
      case 'send_private_msg':
      case 'send_msg':
      case 'send_group_msg': {
        const text = Array.isArray(params.message)
          ? params.message.map((m) => (m.type === 'text' ? m.data?.text ?? '' : `[${m.type}]`)).join('')
          : String(params.message ?? '');
        state.sent.push({
          at: Date.now(),
          action,
          target: String(params.user_id ?? params.group_id ?? ''),
          messageType: params.message_type ?? (action === 'send_group_msg' ? 'group' : 'private'),
          text,
          raw: params.message,
        });
        return ok({ message_id: state.sent.length + 1000 });
      }
      case 'get_login_info':
        return ok({ user_id: Number(selfId), nickname });
      case 'get_status':
        return ok({ online: true, good: true });
      case 'get_version_info':
        return ok({ app_name: 'fake-napcat', app_version: '0.0.0' });
      default:
        return ok({});
    }
  }

  return {
    state,
    start() {
      return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
        state.startedAt = Date.now();
        log(`listening ws://127.0.0.1:${port}`);
        resolve();
      }));
    },
    stop() {
      for (const c of state.clients) { try { c.destroy(); } catch { /* ignore */ } }
      state.clients.clear();
      return new Promise((resolve) => server.close(() => resolve()));
    },
    connected() { return state.clients.size > 0; },
    /** 推一条用户私聊消息（模拟 NapCat 上报） */
    pushPrivate(userId, text, { msgId } = {}) {
      const payload = {
        post_type: 'message',
        message_type: 'private',
        sub_type: 'friend',
        self_id: Number(selfId),
        user_id: Number(userId),
        time: Math.floor(Date.now() / 1000),
        message_id: msgId ?? Math.floor(Math.random() * 1e9),
        raw_message: text,
        font: 14,
        sender: { user_id: Number(userId), nickname: '回放用户', card: '' },
        message: [{ type: 'text', data: { text } }],
      };
      const frame = encodeFrame(JSON.stringify(payload));
      let n = 0;
      for (const c of state.clients) { try { c.write(frame); n += 1; } catch { /* ignore */ } }
      return n;
    },
    /** 一次回放开始前清空记录 */
    reset() { state.sent.length = 0; state.actions.length = 0; },
  };
}
