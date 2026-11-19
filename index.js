'use strict';
// Sustituto de 'socket.io' SOLO PARA PRUEBAS sin red: deja intacto el HTTP real de server.js y
// sirve en /socket.io/socket.io.js un cliente en memoria (test/harness.bundle.js) con motor + salas reales.
const fs = require('fs'), path = require('path');
class Server {
  constructor(httpServer) {
    const prev = httpServer.listeners('request'); httpServer.removeAllListeners('request');
    httpServer.on('request', (req, res) => {
      if (req.url.startsWith('/socket.io/socket.io.js')) {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(path.join(__dirname, '..', '..', 'harness.bundle.js')));
      }
      prev.forEach(l => l.call(httpServer, req, res));
    });
  }
  on() {} close(cb) { if (cb) cb(); }
}
module.exports = { Server };
