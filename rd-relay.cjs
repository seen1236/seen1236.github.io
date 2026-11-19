'use strict';

const crypto = require('node:crypto');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 8 * 1024 * 1024;

class WsPeer {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.closed = false;
    this.onmessage = null;
    this.onclose = null;
    socket.setNoDelay(true);
    socket.on('data', chunk => this._data(chunk));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }

  _closed() {
    if (this.closed) return;
    this.closed = true;
    try { this.socket.destroy(); } catch {}
    if (this.onclose) { const fn = this.onclose; this.onclose = null; fn(); }
  }

  _frame(opcode, payload) {
    if (this.closed) return;
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try { this.socket.write(Buffer.concat([header, payload])); } catch { this._closed(); }
  }

  send(data, binary) {
    if (this.closed) return;
    this._frame(binary ? 0x2 : 0x1, Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8'));
  }

  close(code, reason) {
    if (this.closed) return;
    const text = Buffer.from(String(reason || ''), 'utf8');
    const payload = Buffer.alloc(2 + text.length);
    payload.writeUInt16BE(code || 1000, 0);
    text.copy(payload, 2);
    this._frame(0x8, payload);
    try { this.socket.end(); } catch { this._closed(); return; }
    const timer = setTimeout(() => this._closed(), 200);
    timer.unref?.();
  }

  _data(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (true) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        len = Number(b.readBigUInt64BE(2));
        off = 10;
      }
      if (len > MAX_FRAME) { this.close(1009, 'too large'); return; }
      const maskOff = off;
      if (masked) off += 4;
      if (b.length < off + len) return;
      let payload = b.subarray(off, off + len);
      if (masked) {
        const mask = b.subarray(maskOff, maskOff + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = b.subarray(off + len);
      if (!fin) continue;
      if (opcode === 0x8) { this._closed(); return; }
      if (opcode === 0x9) { this._frame(0xA, payload); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x2) {
        if (this.onmessage) this.onmessage(payload, opcode === 0x2);
      }
    }
  }
}

function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { try { socket.destroy(); } catch {} return null; }
  const digest = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + digest + '\r\n\r\n');
  return new WsPeer(socket);
}

function encodeData(kind, cid, payload) {
  const id = Buffer.from(String(cid), 'utf8');
  return Buffer.concat([Buffer.from([kind, id.length]), id, payload]);
}

function decodeData(buf) {
  if (!buf || buf.length < 2) return null;
  const kind = buf[0];
  const len = buf[1];
  if (!len || buf.length < 2 + len) return null;
  return { kind, cid: buf.subarray(2, 2 + len).toString('utf8'), payload: buf.subarray(2 + len) };
}

function createRdRelay(options = {}) {
  const log = options.log || (message => console.log(message));
  const rooms = new Map();
  let nextCid = 1;

  function roomFor(pin) {
    let room = rooms.get(pin);
    if (!room) {
      room = { pin, key: '', size: 0, open: false, host: null, clients: new Map() };
      rooms.set(pin, room);
    }
    return room;
  }

  function validPin(pin) {
    return typeof pin === 'string' && pin.length >= 4 && pin.length <= 32;
  }

  function sendJson(peer, value) {
    try { peer.send(JSON.stringify(value), false); } catch {}
  }

  function dropHost(room) {
    room.host = null;
    room.key = '';
    room.size = 0;
    room.open = false;
    for (const client of room.clients.values()) {
      sendJson(client, { t: 'error', message: 'คอมพิวเตอร์ตัดการเชื่อมต่อ' });
      client.close(4004, 'host offline');
    }
    room.clients.clear();
  }

  function hostJoin(req, socket, url) {
    const pin = url.searchParams.get('pin') || '';
    const name = (url.searchParams.get('name') || '').slice(0, 80);
    if (!validPin(pin)) {
      try { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); } catch {}
      return;
    }
    const peer = accept(req, socket);
    if (!peer) return;
    const room = roomFor(pin);
    if (room.host && !room.host.closed) room.host.close(4001, 'replaced');
    room.host = peer;
    room.key = '';
    room.open = false;
    log(`[RELAY] host join pin=${pin}${name ? ' name=' + name : ''}`);

    peer.onmessage = (payload, isBinary) => {
      if (isBinary) {
        const msg = decodeData(payload);
        if (!msg) return;
        const client = room.clients.get(msg.cid);
        if (client && !client.closed) client.send(msg.payload, msg.kind === 2);
        return;
      }
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch { return; }
      if (msg.type === 'key' && msg.key) {
        room.key = String(msg.key);
        room.size = Number(msg.size) || 0;
        log(`[RELAY] host key registered pin=${pin}`);
      } else if (msg.type === 'state') {
        room.open = !!msg.open;
        log(`[RELAY] host ${room.open ? 'accepting' : 'closed'} pin=${pin}`);
        if (!room.open) {
          for (const [cid, client] of room.clients) {
            room.clients.delete(cid);
            sendJson(client, { t: 'error', message: 'คอมพิวเตอร์หยุดรับการเชื่อมต่อ' });
            client.close(4005, 'host not ready');
          }
        }
      } else if (msg.type === 'client-gone') {
        const cid = String(msg.cid);
        const client = room.clients.get(cid);
        if (client) {
          room.clients.delete(cid);
          client.close(Number(msg.code) || 1000, 'host closed');
        }
      } else if (msg.type === 'ping') {
        sendJson(peer, { type: 'pong' });
      }
    };
    peer.onclose = () => {
      if (room.host !== peer) return;
      log(`[RELAY] host left pin=${pin}`);
      dropHost(room);
    };
  }

  function clientJoin(req, socket, url) {
    const pin = url.searchParams.get('pin') || '';
    if (!validPin(pin)) {
      try { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); } catch {}
      return;
    }
    const room = rooms.get(pin);
    const peer = accept(req, socket);
    if (!peer) return;
    if (!room || !room.host || !room.key) {
      sendJson(peer, { t: 'error', message: 'คอมพิวเตอร์ออฟไลน์ กรุณาเปิด RemoteDesk' });
      peer.close(4004, 'host offline');
      return;
    }
    if (!room.open) {
      sendJson(peer, { t: 'error', message: 'คอมพิวเตอร์ยังไม่เปิดรับการเชื่อมต่อ กรุณากดสตาร์ทบน RemoteDesk' });
      peer.close(4005, 'host not ready');
      return;
    }
    const cid = String(nextCid++);
    room.clients.set(cid, peer);
    const query = url.search || '';
    log(`[RELAY] client join pin=${pin} cid=${cid} (${room.clients.size} viewer)`);
    sendJson(room.host, { type: 'client', cid, query });

    peer.onmessage = (payload, isBinary) => {
      if (!room.host || room.host.closed) return;
      room.host.send(encodeData(isBinary ? 2 : 1, cid, payload), true);
    };
    peer.onclose = () => {
      if (room.clients.get(cid) === peer) room.clients.delete(cid);
      if (room.host && !room.host.closed) sendJson(room.host, { type: 'client-gone', cid });
      log(`[RELAY] client left pin=${pin} cid=${cid} (${room.clients.size} viewer)`);
    };
  }

  function handleHttp(req, res) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch {
      res.writeHead(400).end();
      return true;
    }
    if (url.pathname === '/api/key') {
      const pin = url.searchParams.get('pin') || '';
      let room = rooms.get(pin);
      if (!room && !pin) {
        for (const candidate of rooms.values()) { if (candidate.key) { room = candidate; break; } }
      }
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('cache-control', 'no-store');
      if (!room || !room.key) {
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'host offline' }));
        return true;
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ alg: 'RSA-OAEP-256', key: room.key, size: room.size }));
      return true;
    }
    if (url.pathname === '/rd/health') {
      const list = [...rooms.values()].map(room => ({
        pin: room.pin,
        host: !!room.host,
        key: !!room.key,
        open: !!room.open,
        viewers: room.clients.size,
      }));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: list }));
      return true;
    }
    return false;
  }

  function handleUpgrade(req, socket) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch {
      try { socket.destroy(); } catch {}
      return false;
    }
    if (url.pathname === '/rd/host') { hostJoin(req, socket, url); return true; }
    if (url.pathname === '/rd/client') { clientJoin(req, socket, url); return true; }
    return false;
  }

  return { handleHttp, handleUpgrade };
}

module.exports = { createRdRelay };
