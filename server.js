'use strict';
/**
 * CORRE QUE TE PÍO — servidor.
 * Un único proceso sirve: frontend estático, /healthz, /cards.json y los WebSockets (Socket.IO).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Server } = require('socket.io');
const { createRooms } = require('./src/multiplayer/rooms');
const { CAT, LIST, MODS } = require('./src/game/cards');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const TEXTUAL = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest']);
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; media-src 'self' data: blob:; base-uri 'none'; form-action 'none'",
};

const rooms = createRooms();
const cardsJson = JSON.stringify({ cats: CAT, cards: LIST, mods: MODS });
const cache = new Map();          // ruta → { mtime, body, gz, type }

function send(req, res, status, body, type, extra = {}) {
  const headers = Object.assign({ 'Content-Type': type }, SEC, extra);
  const enc = String(req.headers['accept-encoding'] || '');
  if (body.length > 1024 && /^(text\/|application\/json|image\/svg)/.test(type) && enc.includes('gzip') && !extra.__gz) {
    body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(req, res, 403, Buffer.from('Prohibido'), 'text/plain; charset=utf-8');
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) return send(req, res, 404, Buffer.from('No encontrado: este pollito se ha escapado.'), 'text/plain; charset=utf-8');
    const ext = path.extname(file).toLowerCase(), type = MIME[ext] || 'application/octet-stream';
    const hit = cache.get(file);
    const cc = ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=86400';
    const etag = `"${st.size}-${Math.floor(st.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, Object.assign({ ETag: etag, 'Cache-Control': cc }, SEC)); return res.end(); }
    const respond = body => send(req, res, 200, body, type, { ETag: etag, 'Cache-Control': cc });
    if (hit && hit.mtime === st.mtimeMs) return respond(hit.body);
    fs.readFile(file, (err, body) => {
      if (err) return send(req, res, 500, Buffer.from('Error del servidor'), 'text/plain; charset=utf-8');
      if (TEXTUAL.has(ext)) cache.set(file, { mtime: st.mtimeMs, body });
      respond(body);
    });
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, Buffer.from('Método no permitido'), 'text/plain; charset=utf-8');
    if (url.pathname === '/healthz') return send(req, res, 200, Buffer.from(JSON.stringify(Object.assign({ ok: true, uptime: Math.round(process.uptime()) }, rooms.stats()))), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
    if (url.pathname === '/cards.json') return send(req, res, 200, Buffer.from(cardsJson), 'application/json; charset=utf-8', { 'Cache-Control': 'no-cache' });
    serveStatic(req, res, url.pathname);
  } catch (e) {
    send(req, res, 400, Buffer.from('Petición no válida'), 'text/plain; charset=utf-8');
  }
});

const io = new Server(server, {
  cors: ALLOWED.length ? { origin: ALLOWED } : undefined,
  maxHttpBufferSize: 20_000,
  pingInterval: 20000,
  pingTimeout: 25000,
});
io.on('connection', socket => rooms.onConnect(socket));
const timer = setInterval(rooms.tick, 250);

server.listen(PORT, '0.0.0.0', () => console.log(`🐥 CORRE QUE TE PÍO escuchando en el puerto ${PORT}`));

function shutdown() {
  clearInterval(timer);
  io.close(() => server.close(() => process.exit(0)));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));
process.on('uncaughtException', e => console.error('[uncaughtException]', e));
