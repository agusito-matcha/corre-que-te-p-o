'use strict';
// Prueba extremo a extremo en Chromium real (Playwright). Uso: node test/browser.js
// Arranca el server.js real con un socket.io de pruebas y un cliente en memoria con bots.
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
let GROOT = ''; try { GROOT = execSync('cd / && npm root -g', { encoding: 'utf8' }).trim(); } catch (_) { /* usa NODE_PATH */ }
const { chromium } = require(GROOT ? path.join(GROOT, 'playwright') : 'playwright');
execSync('node ' + path.join(__dirname, 'build-harness.js'), { stdio: 'ignore' });

const PORT = 8124, URL = `http://localhost:${PORT}/`, SHOTS = process.env.SHOTS || '/tmp/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const ok = (c, m) => { if (!c) { console.error('  ✘ ' + m); failed.push(m); } else console.log('  ✔ ' + m); };
const failed = [], errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const closeModals = pg => pg.evaluate(() => document.querySelectorAll('#modal-root .overlay').forEach(o => o._close && o._close()));

async function newPage(browser, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await pg.goto(URL); await pg.waitForFunction(() => document.querySelector('#conn').classList.contains('ok'));
  return pg;
}
const shot = (pg, n) => pg.screenshot({ path: path.join(SHOTS, n + '.png') });
async function makeRoom(pg, name, bots, speed) {
  await pg.fill('#in-name', name); await pg.click('#btn-create');
  await pg.waitForSelector('#screen-lobby.active'); const code = (await pg.textContent('#lb-code')).trim();
  if (bots) await pg.evaluate(([c, n, s]) => __harness.addBots(c, n, s), [code, bots, speed || 500]);
  await pg.waitForFunction(n => document.querySelectorAll('#lb-members .member').length === n + 1, bots);
  return code;
}
const myTurn = pg => pg.waitForFunction(() => { const s = __cqtp.state; return s && s.phase === 'play' && s.turn === __cqtp.room.you; }, null, { timeout: 90000 });

(async () => {
  const srv = spawn('node', ['server.js'], { cwd: root, env: Object.assign({}, process.env, { PORT, NODE_PATH: path.join(__dirname, 'stub_modules') }), stdio: 'ignore' });
  await sleep(1200);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    /* ── 1 · Escritorio: lobby → primera partida con tutorial ── */
    console.log('Escritorio 1280×800 — 4 jugadores, primera partida');
    const pg = await newPage(browser, { width: 1280, height: 800 });
    ok((await pg.textContent('#screen-menu .tagline')).length > 5, 'menú cargado en español');
    const code = await makeRoom(pg, 'Lola', 3);
    ok(/^[A-Z2-9]{5}$/.test(code), `sala creada (${code}) y 4 jugadores en el lobby`);
    await shot(pg, '02-lobby');
    await pg.click('#btn-start'); await pg.waitForSelector('#screen-game.active');
    await pg.waitForSelector('#i-teach');
    ok((await pg.textContent('#i-teach')) === '¡Enséñame a jugar!' && (await pg.textContent('#i-skip')) === 'Ya sé jugar, ¡vamos!', 'tutorial automático con los dos botones exactos');
    await shot(pg, '03-intro-first-game');
    await pg.click('#i-teach'); await pg.waitForSelector('#tut'); await sleep(600);
    for (let i = 0; i < 9; i++) {
      if (i === 0 || i === 2 || i === 3 || i === 5) { await sleep(450); await shot(pg, `04-tutorial-${i + 1}`); }
      const lbl = (await pg.textContent('#tut [data-a="next"]')).trim();
      if (i === 8) ok(lbl === '¡A jugar!', 'el tutorial termina con «¡A jugar!»');
      await pg.click('#tut [data-a="next"]'); await sleep(120);
    }
    ok(await pg.evaluate(() => !document.querySelector('#tut')), 'tutorial cerrado');
    ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('cqtp.tutorialDone')) === true), 'tutorial marcado como visto (no volverá a salir solo)');
    await pg.waitForFunction(() => __cqtp.state && __cqtp.state.phase !== 'intro', null, { timeout: 20000 });
    ok(true, 'la partida empieza al terminar el tutorial');

    /* ── 2 · Turno propio: seleccionar, apuntar, reaccionar ── */
    console.log('Turno propio y reacciones');
    await myTurn(pg); await sleep(900);
    ok((await pg.textContent('#turn-label')).includes('tu turno'), 'el HUD indica «¡Es tu turno!»');
    ok(await pg.evaluate(() => document.querySelector('#timer') === null && __cqtp.state.deadline === null), 'sin barra ni plazo de turno');
    await shot(pg, '05-game-my-turn');
    const cards = pg.locator('#hand .card'); const n0 = await cards.count();
    await cards.nth(Math.floor(n0 / 2)).click(); await sleep(400);
    ok(await pg.isVisible('#preview'), 'al tocar una carta aparece la vista previa grande');
    await shot(pg, '06-card-preview');
    const info = await pg.evaluate(() => { const s = __cqtp.state, h = s.hand; return { eggs: h.find(c => c.id === 'huevo_fresco') }; });
    // jugamos un Sabotaje con objetivo si lo hay, o un Huevo
    await pg.keyboard.press('Escape');
    const target = await pg.evaluate(() => { const s = __cqtp.state, d = window.__defs; return s.hand.map(c => c.id); });
    const pick = await pg.evaluate(async () => { const s = __cqtp.state; const defs = await (await fetch('/cards.json')).json(); const D = Object.fromEntries(defs.cards.map(c => [c.id, c])); const c = s.hand.find(h => D[h.id].target === 'enemy' && D[h.id].timing === 'turn') || s.hand.find(h => h.id === 'huevo_fresco') || s.hand.find(h => D[h.id].timing === 'turn'); return c ? { uid: c.uid, id: c.id, enemy: D[c.id].target === 'enemy' } : null; });
    if (pick) {
      await pg.locator(`#hand .card[data-uid="${pick.uid}"]`).click(); await sleep(300);
      await pg.click('#preview .btn.primary');
      if (pick.enemy) { await sleep(300); ok(await pg.locator('.seat.pickable').count() > 0, 'al jugar un Sabotaje se resaltan los jugadores objetivo'); await shot(pg, '07-pick-target'); await pg.locator('.seat.pickable').first().click(); }
      await pg.waitForFunction(() => __cqtp.state.stack.length > 0 || __cqtp.state.phase !== 'reaction', null, { timeout: 8000 }).catch(() => {});
      await sleep(600); await shot(pg, '08-play-animation');
    }
    await pg.waitForFunction(() => __cqtp.state.phase === 'play' || __cqtp.state.phase === 'reaction', null, { timeout: 20000 });
    await sleep(1500);
    // reacción: pausamos bots, forzamos una situación y comprobamos la UI de reacción de la persona
    ok(await pg.evaluate(() => document.querySelectorAll('#seats .seat').length === 3), '3 asientos rivales alrededor de la mesa');

    /* ── 3 · Chat, registro, ajustes, reglas ── */
    console.log('Chat, ajustes, reglas, catálogo');
    await pg.click('#tab-chat form button, #g-chat-form button').catch(() => {});
    await pg.fill('#g-chat-form input', 'Hola 🐔<b>x</b>'); await pg.press('#g-chat-form input', 'Enter'); await sleep(500);
    ok(await pg.evaluate(() => [...document.querySelectorAll('#g-chat .msg')].some(m => m.textContent.includes('Hola 🐔') && !m.innerHTML.includes('<b>x'))), 'chat con emojis y sin HTML inyectado');
    await closeModals(pg); await pg.click('#btn-hud-settings'); await sleep(300); await shot(pg, '09-settings');
    await pg.fill('#s-vol', '0.3').catch(() => {}); await pg.selectOption('#s-motion', 'off');
    ok(await pg.evaluate(() => document.documentElement.dataset.rm === '1'), 'ajuste de animaciones reducidas aplicado');
    await pg.selectOption('#s-motion', 'on'); await closeModals(pg);
    await pg.click('#btn-hud-rules'); await sleep(300); await shot(pg, '10-rules'); await closeModals(pg);

    /* ── 3b · Reacción humana desde la interfaz ── */
    console.log('Reacción humana (¡Ni Hablar! y «Paso»)');
    await pg.evaluate(() => { __harness.pauseBots = true; });
    await pg.waitForFunction(() => __harness.game(__cqtp.room.code).phase === 'play', null, { timeout: 30000 }); await sleep(800);
    await pg.waitForFunction(() => __harness.game(__cqtp.room.code).phase === 'play', null, { timeout: 30000 });
    const setup = () => pg.evaluate(() => {
      const g = __harness.game(__cqtp.room.code), meId = __cqtp.room.you, me = g.get(meId), bot = g.players.find(p => p.id !== meId);
      g.turn = g.players.indexOf(bot); g.actions = 2; g.deadline = null;
      g.players.forEach(p => { p.hand = [g.mk('huevo_fresco')]; p.st.ghost = false; p.eggs = 0; p.st.hideout = false; p.st.lostEggs = 0; });
      me.hand = [g.mk('nope'), g.mk('huevo_fresco')]; me.eggs = 2;
      const z = g.mk('zarpazo'); bot.hand = [z];
      const r = g.play(bot.id, z.uid, meId); return { ok: r.ok, phase: g.phase, meId, botId: bot.id };
    });
    const s1 = await setup(); ok(s1.ok && s1.phase === 'reaction', 'un rival juega Zarpazo del Zorro contra mí y se abre la ventana de reacción');
    await pg.waitForSelector('#react-box:not(.hidden)'); await sleep(900);
    ok((await pg.textContent('#react-box')).includes('¡Puedes reaccionar!'), 'la interfaz me avisa: «¡Puedes reaccionar!» con cuenta atrás');
    ok(await pg.locator('#hand .card.react-ok').count() === 1, 'solo la carta de reacción (¡Ni Hablar!) se resalta como utilizable');
    await shot(pg, '09b-reaction-window');
    await pg.locator('#hand .card.react-ok').click(); await sleep(250);
    await pg.click('#preview .btn.primary'); // «Reaccionar»
    await pg.waitForFunction(() => __cqtp.state.phase === 'play' && __cqtp.state.stack.length === 0, null, { timeout: 12000 });
    const r1 = await pg.evaluate(() => { const g = __harness.game(__cqtp.room.code); return { me: g.get(__cqtp.room.you).eggs, bot: g.players.find(p => p.id !== __cqtp.room.you).eggs }; });
    ok(r1.me === 2 && r1.bot === 0, `¡Ni Hablar! cancela el robo: mis huevos siguen en ${r1.me} (el rival tiene ${r1.bot})`);
    const s2 = await pg.evaluate(() => { const g = __harness.game(__cqtp.room.code), meId = __cqtp.room.you, me = g.get(meId), bot = g.players.find(p => p.id !== meId); me.hand = [g.mk('nope')]; g.actions = 2; const z = g.mk('zarpazo'); bot.hand = [z]; return g.play(bot.id, z.uid, meId).ok; });
    ok(s2, 'segundo Zarpazo contra mí'); await pg.waitForSelector('#btn-pass'); await pg.click('#btn-pass');
    await pg.waitForFunction(() => __cqtp.state.phase === 'play' && __cqtp.state.stack.length === 0, null, { timeout: 8000 });
    const r2 = await pg.evaluate(() => { const g = __harness.game(__cqtp.room.code); return { me: g.get(__cqtp.room.you).eggs, bot: g.players.find(p => p.id !== __cqtp.room.you).eggs }; });
    ok(r2.me === 1 && r2.bot === 1, `al pulsar «Paso» el Zarpazo se ejecuta y se resuelve al instante (yo ${r2.me}, rival ${r2.bot})`);

    /* ── 4 · Victoria ── */
    console.log('Pantalla de victoria y revancha');
    const win = await pg.evaluate(() => { const g = __harness.game(__cqtp.room.code); const me = g.get(__cqtp.room.you); me.eggs = g.target; g.checkWin(); return g.winner === me.id; });
    ok(win, 'victoria forzada en el servidor');
    await pg.waitForSelector('#end-chick', { timeout: 20000 });
    ok(await pg.isVisible('#end-chick'), 'aparece la pantalla de victoria con el pollito'); await sleep(600);
    await shot(pg, '11-victory');
    ok((await pg.textContent('.modal h2')).includes('¡Has ganado!'), 'mensaje «¡Has ganado!»');
    await pg.click('#e-rematch'); await pg.waitForFunction(() => __cqtp.state && __cqtp.state.phase !== 'ended' && !document.querySelector('.modal'), null, { timeout: 10000 });
    await sleep(1800);
    ok(await pg.evaluate(() => !document.querySelector('#i-teach')), 'la revancha NO vuelve a mostrar el tutorial');
    await pg.close();

    /* ── 5 · 10 jugadores en escritorio ── */
    console.log('Mesa de 10 jugadores (escritorio)');
    const p10 = await newPage(browser, { width: 1280, height: 800 });
    await p10.evaluate(() => localStorage.setItem('cqtp.tutorialDone', 'true')); await p10.reload(); await p10.waitForFunction(() => document.querySelector('#conn').classList.contains('ok'));
    await makeRoom(p10, 'Mario', 9, 900); await shot(p10, '12-lobby-10');
    await p10.click('#btn-start'); await p10.waitForSelector('#screen-game.active');
    await p10.waitForFunction(() => __cqtp.state && __cqtp.state.phase === 'play', null, { timeout: 20000 }); await sleep(1500);
    ok(await p10.evaluate(() => document.querySelectorAll('#seats .seat').length === 9), '9 rivales sentados + tú = 10 jugadores');
    const overlap = await p10.evaluate(() => { const r = [...document.querySelectorAll('#seats .seat')].map(e => e.getBoundingClientRect()); let o = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.left < b.right - 4 && b.left < a.right - 4 && a.top < b.bottom - 4 && b.top < a.bottom - 4) o++; } return o; });
    ok(overlap === 0, `ningún asiento se solapa con otro (solapes: ${overlap})`);
    await shot(p10, '13-table-10-desktop');
    ok(await p10.evaluate(() => __cqtp.state.target === 6), 'objetivo de 6 huevos con 10 jugadores');
    await p10.close();

    /* ── 6 · Móvil ── */
    console.log('Móvil 390×844 — 6 jugadores');
    const mb = await newPage(browser, { width: 390, height: 844 }, true);
    await mb.evaluate(() => localStorage.setItem('cqtp.tutorialDone', 'true')); await mb.reload(); await mb.waitForFunction(() => document.querySelector('#conn').classList.contains('ok'));
    await shot(mb, '14-menu-mobile');
    await makeRoom(mb, 'Movil', 5, 800); await shot(mb, '15-lobby-mobile');
    await mb.click('#btn-start'); await mb.waitForSelector('#screen-game.active');
    await mb.waitForFunction(() => __cqtp.state && __cqtp.state.phase === 'play', null, { timeout: 20000 }); await sleep(1500);
    await shot(mb, '16-table-mobile');
    const off = await mb.evaluate(() => { const W = innerWidth, bad = [...document.querySelectorAll('#seats .seat, #hand .card')].filter(e => { const r = e.getBoundingClientRect(); return r.left < -2 || r.right > W + 2; }); return bad.length; });
    ok(off === 0, 'en móvil nada se sale por los lados de la pantalla');
    await mb.click('#side-toggle'); await sleep(400); await shot(mb, '17-drawer-mobile');
    await mb.close();
  } catch (e) {
    console.error('✘ EXCEPCIÓN DEL TEST:', e.message); failed.push(e.message);
  }
  await browser.close(); srv.kill();
  const real = errors.filter(e => !/favicon/i.test(e));
  ok(real.length === 0, `sin errores de JavaScript ni de consola${real.length ? ': ' + real.slice(0, 4).join(' | ') : ''}`);
  console.log(failed.length ? `\n✘ ${failed.length} fallo(s)` : '\nTodo correcto ✔'); process.exit(failed.length ? 1 : 0);
})();
