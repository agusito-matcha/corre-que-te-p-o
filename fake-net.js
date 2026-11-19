'use strict';
// Red falsa en memoria con la misma forma que Socket.IO (emit/on/ack). Solo para pruebas.
function createFakeNet(rooms) {
  let seq = 0;
  const later = fn => setImmediate(fn);
  function connect() {
    const id = 'sock' + (++seq);
    const sh = {}, ch = {};
    const server = {
      id, on: (e, f) => { sh[e] = f; },
      emit: (e, d) => later(() => { if (client.connected && ch[e]) ch[e].forEach(f => f(JSON.parse(JSON.stringify(d === undefined ? null : d)))); }),
    };
    const client = {
      id, connected: true, state: null, listeners: ch,
      on: (e, f) => { (ch[e] = ch[e] || []).push(f); return client; },
      emit(e, d, cb) {
        if (typeof d === 'function') { cb = d; d = {}; }
        later(() => {
          if (!client.connected || !sh[e]) return;
          sh[e](JSON.parse(JSON.stringify(d === undefined ? {} : d)), r => { if (cb) later(() => cb(JSON.parse(JSON.stringify(r)))); });
        });
      },
      call: (e, d) => new Promise(res => client.emit(e, d, res)),
      disconnect() { if (!client.connected) return; client.connected = false; later(() => sh.disconnect && sh.disconnect()); },
    };
    rooms.onConnect(server);
    return client;
  }
  return { connect };
}
module.exports = { createFakeNet };
