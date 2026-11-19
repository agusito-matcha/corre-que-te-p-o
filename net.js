'use strict';
// Prueba de integración multijugador (sin Socket.IO real). Uso: node test/net.js
const { createRooms } = require('../src/multiplayer/rooms');
const { createFakeNet } = require('./fake-net');
const { CARDS } = require('../src/game/cards');

const clock = { t: 1_000_000 };
const rooms = createRooms({ now: () => clock.t, clock: () => clock.t });
const net = createFakeNet(rooms);
const tick = () => new Promise(r => setImmediate(r));
const flush = async () => { for (let i = 0; i < 4; i++) await tick(); };
const rnd = n => Math.floor(Math.random() * n);
const ok = (c, m) => { if (!c) { console.error('  ✘ ' + m); process.exit(1); } else console.log('  ✔ ' + m); };

function bot(name, avatar) {
  const c = net.connect();
  c.name = name; c.avatar = avatar; c.tried = new Set(); c.updates = 0; c.peeks = []; c.chat = []; c.leaks = 0;
  c.on('room:state', s => { c.room = s; });
  c.on('game:update', ({ state }) => {
    c.updates++; c.state = state;
    // privacidad: las manos ajenas jamás viajan; las nuestras solo incluyen uid/id
    if (state.players.some(p => 'hand' in p)) c.leaks++;
    if (state.hand.some(h => Object.keys(h).sort().join() !== 'id,uid')) c.leaks++;
  });
  c.on('game:peek', p => c.peeks.push(p));
  c.on('chat:msg', m => c.chat.push(m));
  c.on('chat:history', h => { c.history = h; });
  return c;
}

async function botStep(c) {
  const s = c.state; if (!s || !c.connected || !c.me) return;
  if (s.phase === 'intro') { if (!s.ready.includes(c.me)) await c.call('game:ready'); return; }
  if (s.phase === 'reaction' && s.reaction && s.reaction.mine && !s.reaction.passed) {
    if (Math.random() < 0.5) {
      for (const h of s.hand.filter(h => CARDS[h.id].timing === 'react')) {
        const others = s.players.filter(p => p.id !== c.me).map(p => p.id);
        const r = await c.call('game:react', { uid: h.uid, target: others[rnd(others.length)] });
        if (r.ok) return;
      }
    }
    await c.call('game:pass'); return;
  }
  if (s.phase === 'play' && s.turn === c.me) {
    if (s.actions > 0 && Math.random() > 0.08) {
      const opts = s.hand.filter(h => CARDS[h.id].timing !== 'react' && !c.tried.has(h.uid + ':' + s.turn));
      if (opts.length) {
        const h = opts[rnd(opts.length)], others = s.players.filter(p => p.id !== c.me && !p.gone).map(p => p.id);
        const r = await c.call('game:play', { uid: h.uid, target: others[rnd(others.length)] });
        if (!r.ok) c.tried.add(h.uid + ':' + s.turn);
        return;
      }
    }
    c.tried.clear(); await c.call('game:end');
  }
}

async function runUntil(clients, cond, max = 30000) {
  for (let i = 0; i < max; i++) {
    for (const c of clients) await botStep(c);
    clock.t += 400; rooms.tick(); await flush();
    if (cond()) return i;
  }
  throw new Error('Tiempo de simulación agotado');
}

(async () => {
  console.log('Test de red multijugador (6 jugadores)');
  // — sala privada y unión
  const host = bot('Ana', '🐔'); const r1 = await host.call('room:create', { name: 'Ana', avatar: '🐔', isPublic: false });
  ok(r1.ok && /^[A-Z2-9]{5}$/.test(r1.code), `sala creada con código ${r1.code}`);
  host.me = r1.id; host.token = r1.token;
  const guests = [];
  for (const n of ['Beni', 'Carla', 'Dani', 'Eva']) {
    const g = bot(n, '🦊'); const r = await g.call('room:join', { code: r1.code.toLowerCase(), name: n, avatar: '🦊' });
    if (!r.ok) throw new Error(r.error); g.me = r.id; g.token = r.token; guests.push(g);
  }
  const bad = bot('X'); ok(!(await bad.call('room:join', { code: 'ZZZZZ', name: 'X' })).ok, 'código inexistente rechazado');
  const dup = bot('Ana'); const rd = await dup.call('room:join', { code: r1.code, name: 'Ana' }); dup.me = rd.id;
  await flush(); ok(host.room.members.length === 6 && new Set(host.room.members.map(m => m.name)).size === 6, 'nombres duplicados se desambiguan (6 jugadores)');
  const all = [host, ...guests, dup];

  // — chat
  await host.call('chat:send', { text: '<b>hola</b> 🐔🥚' }); await flush();
  ok(all.every(c => c.chat.length === 1) && !/[<>]/.test(host.chat[0].text), 'chat llega a todos y se sanea');
  ok(!(await host.call('chat:send', { text: 'spam' })).ok, 'antispam de chat');

  // — solo el anfitrión empieza
  ok(!(await guests[0].call('room:start')).ok, 'un invitado no puede empezar');
  const noMin = bot('Solo'); const rs = await noMin.call('room:create', { name: 'Solo' }); ok(!(await noMin.call('room:start')).ok, 'no se empieza con 1 jugador');
  ok((await host.call('room:start')).ok, 'el anfitrión empieza la partida');
  await flush();
  ok(all.every(c => c.state && c.state.players.length === 6), 'todos reciben el estado de 6 jugadores');
  ok(!(await bot('Tarde').call('room:join', { code: r1.code, name: 'T' })).ok, 'no se puede entrar en una partida empezada');

  // — juego con desconexión + reconexión a mitad
  const victim = guests[1];
  await runUntil(all, () => victim.state.phase === 'play' && victim.state.turn !== null && victim.state.log.length > 6);
  victim.disconnect(); await flush();
  const gm = rooms.rooms.get(r1.code).game;
  ok(gm.get(victim.me).connected === false, 'desconexión detectada por el servidor');
  for (let i = 0; i < 40; i++) { for (const c of all) if (c !== victim) await botStep(c); clock.t += 400; rooms.tick(); await flush(); }
  const back = bot('Beni-bis'); back.me = victim.me;
  ok(!(await back.call('room:resume', { code: r1.code, id: victim.me, token: 'mal' })).ok, 'token falso rechazado');
  const rr = await back.call('room:resume', { code: r1.code, id: victim.me, token: victim.token });
  await flush(); ok(rr.ok && back.state && back.state.hand.length >= 0 && back.state.players.length === 6, 'reconexión con token restaura la mano y el estado');
  const idx = all.indexOf(victim); all[idx] = back;

  await runUntil(all, () => gm.phase === 'ended');
  ok(gm.winner && gm.get(gm.winner).eggs >= gm.target, `partida completada, gana ${gm.get(gm.winner).name} con ${gm.get(gm.winner).eggs} huevos`);
  ok(all.every(c => c.leaks === 0), 'ningún cliente recibió manos ajenas ni campos privados');
  ok(all.every(c => c.state && c.state.phase === 'ended' && c.state.winner === gm.winner), 'todos ven el final de la partida');
  const total = gm.deck.length + gm.discard.length + gm.players.reduce((s, p) => s + p.hand.length, 0);
  ok(total > 0, 'cartas conservadas tras la partida');

  // — revancha
  ok(!(await guests[0].call('room:start')).ok, 'revancha: solo el anfitrión');
  ok((await host.call('room:start')).ok, 'revancha iniciada por el anfitrión');
  await flush(); ok(host.state.phase === 'intro' && host.state.winner === null, 'nueva partida con los mismos jugadores');

  // — salida voluntaria durante partida
  await dup.call('room:leave'); await flush();
  ok(host.room.members.length === 5 && host.state.players.find(p => p.id === dup.me).gone, 'abandonar marca al jugador como ausente');

  // — matchmaking público
  const q1 = bot('Q1'); const a = await q1.call('room:quick', { name: 'Q1' });
  const q2 = bot('Q2'); const b = await q2.call('room:quick', { name: 'Q2' });
  ok(a.ok && b.ok && a.code === b.code, 'matchmaking público junta a los jugadores en la misma sala');
  const lst = await bot('L').call('room:list'); ok(lst.rooms.some(x => x.code === a.code && x.count === 2), 'la lista pública muestra la sala');

  // — sala llena (10)
  const h2 = bot('H'); const rh = await h2.call('room:create', { name: 'H' }); let fullOk = true;
  for (let i = 1; i < 10; i++) { const x = bot('P' + i); const r = await x.call('room:join', { code: rh.code, name: 'P' + i }); fullOk = fullOk && r.ok; }
  ok(fullOk, '10 jugadores caben en una sala');
  ok(!(await bot('P11').call('room:join', { code: rh.code, name: 'P11' })).ok, 'el jugador 11 es rechazado');
  ok((await h2.call('room:start')).ok, 'partida de 10 jugadores iniciada');
  await flush(); const gm10 = rooms.rooms.get(rh.code).game; ok(gm10.players.length === 10 && gm10.target === 6, 'objetivo de 6 huevos con 10 jugadores');

  // — varias salas simultáneas
  ok(rooms.stats().rooms >= 4, `varias salas simultáneas activas (${rooms.stats().rooms})`);
  console.log('\nTodo correcto ✔');
  process.exit(0);
})().catch(e => { console.error('✘', e); process.exit(1); });
