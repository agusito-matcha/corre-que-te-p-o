'use strict';
// Simulación masiva con bots aleatorios. Uso: node test/sim.js [partidas_por_tamaño]
const { Game } = require('../src/game/engine');
const { CARDS, LIST, buildDeck } = require('../src/game/cards');

const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const PER = Number(process.argv[2] || 150);
const SIZES = [2, 3, 4, 5, 6, 8, 10];

const stats = { played: {}, reacted: {}, errors: {}, turns: [], timeouts: 0, abandon: 0, leaks: 0, invariant: 0, exceptions: 0, wins: 0, games: 0 };
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };

function totalCards(g) {
  return g.deck.length + g.discard.length + g.players.reduce((s, p) => s + p.hand.length, 0) + g.stack.length;
}

function checkInvariants(g, expected) {
  if (totalCards(g) !== expected) { stats.invariant++; throw new Error(`Conservación de cartas rota: ${totalCards(g)} ≠ ${expected}`); }
  for (const p of g.players) {
    if (p.eggs < 0) throw new Error('Huevos negativos');
    if (!Number.isInteger(p.eggs)) throw new Error('Huevos no enteros');
  }
  // La vista de un jugador no debe contener cartas de otros.
  for (const p of g.players) {
    const v = g.view(p.id);
    const mine = new Set(v.hand.map(c => c.uid));
    const others = new Set(g.players.filter(q => q !== p).flatMap(q => q.hand.map(c => c.uid)));
    const raw = JSON.stringify(v);
    for (const uid of others) if (mine.has(uid)) { stats.leaks++; throw new Error('Carta ajena en mi mano'); }
    if (/"hand":\[/.test(raw.replace(/"hand":\[[^\]]*\]/, ''))) { stats.leaks++; throw new Error('Segunda mano en la vista'); }
    if (v.players.some(q => 'hand' in q)) { stats.leaks++; throw new Error('Mano pública'); }
    if ('deck' in v) { stats.leaks++; throw new Error('Mazo expuesto'); }
  }
}

function botAct(g, clock) {
  if (g.phase === 'intro') { for (const p of g.players) g.setReady(p.id); return; }
  if (g.phase === 'reaction') {
    const ids = [...g.eligible].filter(id => !g.passed.has(id));
    if (!ids.length) { clock.t += 2000; g.tick(); return; }
    const id = ids[rnd(ids.length)], p = g.get(id);
    if (Math.random() < 0.55) {
      for (const c of shuffle(p.hand.filter(c => CARDS[c.id].timing === 'react'))) {
        const foes = shuffle(g.players.filter(q => q !== p).map(q => q.id));
        for (const t of (c.id === 'desvio' ? foes : [null])) {
          const r = g.react(id, c.uid, t);
          if (r.ok) { inc(stats.reacted, c.id); return; }
          inc(stats.errors, r.error);
        }
      }
    }
    g.pass(id); return;
  }
  if (g.phase === 'play') {
    const p = g.cur();
    if (Math.random() < 0.06 || !p.hand.length) { if (g.endTurn(p.id).ok) return; }
    for (const c of shuffle(p.hand.slice())) {
      if (CARDS[c.id].timing === 'react') continue;
      const foes = shuffle(g.players.filter(q => q !== p).map(q => q.id));
      for (const t of (CARDS[c.id].target === 'enemy' ? foes : [null])) {
        const r = g.play(p.id, c.uid, t);
        if (r.ok) { inc(stats.played, c.id); return; }
        inc(stats.errors, r.error);
      }
    }
    g.endTurn(p.id); return;
  }
}

function runGame(n) {
  const clock = { t: 1000 };
  const infos = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, avatar: '🐔' }));
  const g = new Game(infos, { clock: () => clock.t });
  const expected = buildDeck(n).length;
  let steps = 0, turns = 0, lastTurn = null;
  while (g.phase !== 'ended') {
    if (++steps > 20000) throw new Error('La partida no termina (20000 pasos)');
    botAct(g, clock);
    clock.t += 50;
    if (g.turn !== lastTurn && g.phase !== 'intro') { lastTurn = g.turn; turns++; }
    g.drainEvents(); g.drainPrivate();
    checkInvariants(g, expected);
  }
  if (!g.winner) throw new Error('Sin ganador');
  const w = g.get(g.winner);
  if (w.eggs < g.target) throw new Error('Ganador sin huevos suficientes');
  stats.turns.push(turns); stats.wins++;
}

// Casos de prueba dirigidos de las reglas más delicadas
function directed() {
  const mk = (n = 3) => {
    const clock = { t: 0 };
    const g = new Game(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'J' + i, avatar: '🐔' })), { clock: () => clock.t });
    g.beginPlay(); g.turn = 0; g.phase = 'play'; g.actions = 2;
    for (const p of g.players) p.hand = []; g.stack = [];
    return { g, clock };
  };
  const give = (g, p, id) => { const c = g.mk(id); p.hand.push(c); return c; };
  const ok = (cond, msg) => { if (!cond) throw new Error('FALLA dirigido: ' + msg); };

  { // Zarpazo + Ni Hablar
    const { g, clock } = mk(); const [a, b, c] = g.players;
    b.eggs = 2; const z = give(g, a, 'zarpazo'); const n = give(g, c, 'nope');
    ok(g.play('p0', z.uid, 'p1').ok, 'play zarpazo');
    ok(g.phase === 'reaction', 'abre ventana');
    ok(g.react('p2', n.uid).ok, 'nope');
    clock.t += 99999; g.tick();
    ok(b.eggs === 2 && a.eggs === 0, 'el Ni Hablar cancela el zarpazo');
  }
  { // Doble Ni Hablar (se cancela el cancelar)
    const { g, clock } = mk(); const [a, b, c] = g.players;
    b.eggs = 2; const z = give(g, a, 'zarpazo'); const n1 = give(g, b, 'nope'); const n2 = give(g, a, 'nope');
    g.play('p0', z.uid, 'p1'); g.react('p1', n1.uid); const r = g.react('p0', n2.uid);
    ok(r.ok, 'nope sobre nope'); g.resolveStack();
    ok(a.eggs === 1 && b.eggs === 1, 'doble nope: el zarpazo se ejecuta');
  }
  { // Sello Dorado no se puede cancelar
    const { g } = mk(4); const [a, b, c, d] = g.players;
    b.eggs = 2; const z = give(g, a, 'zarpazo'); const n1 = give(g, b, 'nope'); const s = give(g, a, 'sello'); const n2 = give(g, c, 'nope');
    g.play('p0', z.uid, 'p1'); g.react('p1', n1.uid);
    ok(g.react('p0', s.uid).ok, 'sello sobre nope');
    ok(!g.react('p2', n2.uid).ok, 'no se puede cancelar el sello');
    g.resolveStack(); ok(a.eggs === 1 && b.eggs === 1, 'sello: zarpazo se ejecuta');
  }
  { // Rebote invierte los papeles
    const { g } = mk(); const [a, b] = g.players;
    b.eggs = 1; a.eggs = 0; const z = give(g, a, 'zarpazo'); a.eggs = 2; const r = give(g, b, 'rebote');
    g.play('p0', z.uid, 'p1'); ok(g.react('p1', r.uid).ok, 'rebote'); g.resolveStack();
    ok(a.eggs === 1 && b.eggs === 2, 'rebote: el zorro pierde el huevo a favor del que rebota');
  }
  { // Desvío
    const { g } = mk(); const [a, b, c] = g.players;
    c.eggs = 2; const z = give(g, a, 'zarpazo'); const d = give(g, b, 'desvio');
    g.play('p0', z.uid, 'p1');
    ok(!g.react('p1', d.uid, 'p0').ok, 'no se puede desviar al autor');
    ok(g.react('p1', d.uid, 'p2').ok, 'desvío a tercero'); g.resolveStack();
    ok(c.eggs === 1 && a.eggs === 1, 'desvío: roban a otro');
  }
  { // Escudo solo protege a quien lo usa
    const { g } = mk(4); const [a, b, c, d] = g.players;
    b.hand = []; c.eggs = 1; d.eggs = 1;
    const gz = give(g, a, 'gran_zorro'); const e = give(g, c, 'escudo');
    g.play('p0', gz.uid, null); ok(g.react('p2', e.uid).ok, 'escudo'); g.resolveStack();
    ok(c.eggs === 1 && d.eggs === 0 && a.eggs === 1, 'escudo: c se salva, d no');
  }
  { // Fantasma no puede ser objetivo
    const { g } = mk(); const [a, b] = g.players;
    b.st.ghost = true; const z = give(g, a, 'zarpazo');
    ok(!g.play('p0', z.uid, 'p1').ok, 'fantasma intocable');
  }
  { // Veda impide robar
    const { g } = mk(); const [a, b] = g.players;
    g.mods.veda = 3; b.eggs = 2; const z = give(g, a, 'zarpazo'); g.play('p0', z.uid, 'p1'); g.resolveStack();
    ok(b.eggs === 2 && a.eggs === 0, 'veda');
  }
  { // Silencio: sin ventana de reacción
    const { g } = mk(); const [a, b] = g.players;
    g.mods.silencio = 3; b.eggs = 2; const z = give(g, a, 'zarpazo'); g.play('p0', z.uid, 'p1');
    ok(g.phase === 'play' && b.eggs === 1, 'silencio resuelve al instante');
  }
  { // Traición al aliado
    const { g } = mk(); const [a, b] = g.players;
    const p1 = give(g, a, 'pacto'); g.play('p0', p1.uid, 'p1'); g.resolveStack();
    ok(a.eggs === 1 && b.eggs === 1 && a.st.pactWith === 'p1', 'pacto');
    b.hand = [g.mk('rapina2')].map(() => g.mk('huevo_fresco')); const z = give(g, a, 'zarpazo');
    g.play('p0', z.uid, 'p1'); g.resolveStack();
    ok(a.st.pactWith === null && a.eggs === 2 && a.hand.length === 1, 'traición: roba huevo y carta extra');
  }
  { // Cuarentena + incubadora + doble turno
    const { g } = mk(); const [a, b, c] = g.players;
    const q = give(g, a, 'cuarentena'); g.play('p0', q.uid, 'p1'); g.resolveStack();
    g.endTurn('p0'); ok(g.cur().id === 'p2', 'cuarentena: se salta a p1');
  }
  { // Seguro del nido
    const { g } = mk(); const [a, b] = g.players;
    b.eggs = 3; const h = give(g, a, 'huevo_roto'); const s = give(g, b, 'seguro_nido');
    g.play('p0', h.uid, 'p1'); g.react('p1', s.uid); g.resolveStack(); ok(b.eggs === 3, 'seguro del nido');
  }
  { // Ventana expira por reloj y pass de todos los elegibles
    const { g, clock } = mk(); const [a, b] = g.players;
    const r = give(g, a, 'rapina'); b.hand = [g.mk('huevo_fresco')]; g.play('p0', r.uid, 'p1');
    ok(g.phase === 'reaction' && g.eligible.size === 0, 'ventana sin elegibles');
    clock.t += 1800; g.tick(); ok(g.phase === 'play' && a.hand.length === 1, 'resuelve al expirar');
  }
  { // Sin temporizador de turno: por mucho que pase el tiempo, el turno no cambia
    const { g, clock } = mk(); clock.t += 60 * 60000; const before = g.cur().id; g.tick();
    ok(g.cur().id === before && g.phase === 'play', 'no hay reloj de turno (1 hora después sigue siendo su turno)');
    ok(g.view('p0').deadline === null, 'la vista no expone ningún plazo durante el turno');
  }
  { // Jugador desconectado: se le pasa el turno; si vuelve a tiempo, lo conserva
    const { g, clock } = mk(); g.setConnected('p0', false); clock.t += 3500; g.tick();
    ok(g.cur().id !== 'p0', 'el turno de un desconectado se pasa');
    const m = mk(); m.g.setConnected('p0', false); m.clock.t += 1000; m.g.setConnected('p0', true); m.clock.t += 9000; m.g.tick();
    ok(m.g.cur().id === 'p0', 'si reconecta a tiempo conserva su turno');
  }
  { // Sin acciones: el turno se cierra solo tras una breve pausa
    const { g, clock } = mk(); g.actions = 1; const h = give(g, g.players[0], 'gallina_clueca'); g.play('p0', h.uid, null);
    ok(g.cur().id === 'p0' && g.actions === 0, 'sin acciones, aún no ha cambiado de golpe');
    clock.t += 1500; g.tick(); ok(g.cur().id !== 'p0', 'sin acciones el turno termina solo');
  }
  { // Abandono en partida de 2
    const { g } = mk(2); g.removePlayer('p1'); ok(g.phase === 'ended' && g.winner === 'p0', 'abandono termina');
  }
}

console.log(`Pruebas dirigidas...`);
directed();
console.log('  ✔ reglas clave (nope, sello, rebote, desvío, escudo, veda, silencio, traición, seguro, timers, abandono)');

console.log(`Simulación: ${PER} partidas × tamaños ${SIZES.join(', ')} ...`);
for (const n of SIZES) {
  const before = stats.turns.length;
  for (let i = 0; i < PER; i++) {
    stats.games++;
    try { runGame(n); } catch (e) { stats.exceptions++; console.error(`  ✘ n=${n}:`, e.message); if (stats.exceptions > 5) process.exit(1); }
  }
  const t = stats.turns.slice(before);
  const avg = t.reduce((a, b) => a + b, 0) / (t.length || 1);
  console.log(`  n=${String(n).padStart(2)}  partidas OK: ${t.length}/${PER}   turnos medios: ${avg.toFixed(1)}   (objetivo: ${n <= 5 ? 5 : 6} huevos)`);
}
const never = LIST.filter(d => d.timing === 'turn' && !stats.played[d.id]).map(d => d.id);
const neverR = LIST.filter(d => d.timing === 'react' && !stats.reacted[d.id]).map(d => d.id);
console.log(`\nCartas distintas jugadas en turno: ${Object.keys(stats.played).length}/${LIST.filter(d => d.timing === 'turn').length}  | reacciones usadas: ${Object.keys(stats.reacted).length}/${LIST.filter(d => d.timing === 'react').length}`);
if (never.length) console.log('  Sin jugar nunca:', never.join(', '));
if (neverR.length) console.log('  Reacciones sin usar:', neverR.join(', '));
console.log(`Fugas de información: ${stats.leaks} | Invariantes rotos: ${stats.invariant} | Excepciones: ${stats.exceptions} | Partidas terminadas: ${stats.wins}/${stats.games}`);
if (stats.exceptions || stats.leaks || stats.invariant || stats.wins !== stats.games) process.exit(1);
