// CORRE QUE TE PÍO — cliente. Orquesta pantallas, conexión, chat, tutorial y modales.
import { store, settings, saveSettings, applySettings, motionOff } from './store.js';
import { sfx, unlock, refreshVolume } from './audio.js';
import { mascot, chickSVG, EMOTIONS } from './mascot.js';
import { setData, DEFS, CATS, CAT_ORDER, makeCard, esc } from './cards-ui.js';
import { createTable } from './table.js';
import { startTutorial } from './tutorial.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const AVATARS = ['🐔', '🦊', '🐷', '🐮', '🐸', '🐙', '🦆', '🐢', '🐝', '🐺', '🦉', '🐰'];
const EMOJIS = ['😂', '🐔', '🥚', '😈', '🙏', '😱', '🔥', '👏'];

applySettings();
let socket = null, table = null;
let session = store.get('session', null);          // { code, id, token }
let myId = session ? session.id : null;
let room = null, gstate = null, demo = false, lastRoomPhase = null;
let introMode = null, readySent = false, tutorialHandle = null, unread = 0, winShown = false, quickBusy = false;
const profile = Object.assign({ name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)] }, store.get('profile', {}));

/* ───────────── utilidades de interfaz ───────────── */
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500); if (kind === 'bad') sfx('nope');
}
function show(name) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name)); document.body.dataset.screen = name; }
function send(evt, data = {}) {
  if (demo) return Promise.resolve({ ok: false });
  return new Promise(res => {
    if (!socket || !socket.connected) return res({ ok: false, error: 'Sin conexión con el servidor. Reintentando…' });
    socket.emit(evt, data, r => res(r || { ok: false }));
  });
}
function openModal(html, { onClose, wide } = {}) {
  closeModal();
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  if (wide) $('.modal', ov).style.width = 'min(900px, 100%)';
  $('#modal-root').appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc_); if (onClose) onClose(); };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc_);
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  ov._close = close; setTimeout(() => { const b = $('.btn.primary', ov) || $('[data-close]', ov); if (b) b.focus({ preventScroll: true }); }, 30);
  $$('[data-close]', ov).forEach(b => b.addEventListener('click', close));
  return ov;
}
function closeModal() { $$('#modal-root .overlay').forEach(o => o._close && o._close()); }
function copy(text, ok) {
  const done = () => toast(ok);
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (_) { toast('No se pudo copiar. Cópialo a mano: ' + text); } t.remove(); }
}
const inviteLink = code => `${location.origin}${location.pathname}?sala=${code}`;

/* ───────────── conexión ───────────── */
function setConn(state, text) { const c = $('#conn'); c.className = 'conn ' + state; $('span', c).textContent = text; }
function connect() {
  if (typeof io !== 'function') { setConn('', 'Sin conexión'); toast('No se pudo cargar la conexión en tiempo real. Recarga la página.', 'bad'); return; }
  socket = io({ reconnectionDelay: 700, reconnectionDelayMax: 4000 });
  socket.on('connect', () => {
    setConn('ok', 'Conectado');
    if (session) socket.emit('room:resume', session, r => {
      if (r && r.ok) { myId = r.id; return; }
      session = null; store.del('session'); myId = null;
      if (document.body.dataset.screen !== 'menu') { goMenu(); toast((r && r.error) || 'La sala ya no existe.', 'bad'); }
    });
  });
  socket.on('disconnect', () => setConn('wait', 'Reconectando…'));
  socket.on('connect_error', () => setConn('wait', 'Reconectando…'));
  socket.on('room:state', onRoomState);
  socket.on('game:update', ({ state, events }) => onGameUpdate(state, events));
  socket.on('game:peek', onPeek);
  socket.on('chat:msg', addChat);
  socket.on('chat:history', h => { $('#lb-chat').innerHTML = ''; $('#g-chat').innerHTML = ''; (h || []).forEach(m => addChat(m, true)); });
  socket.on('room:kicked', d => { session = null; store.del('session'); goMenu(); toast(d.reason || 'Te han desconectado de la sala.', 'bad'); });
}
function saveSession(r) { session = { code: r.code, id: r.id, token: r.token }; myId = r.id; store.set('session', session); }
function goMenu() {
  closeModal(); if (tutorialHandle) tutorialHandle.stop(); table.reset(); room = null; gstate = null; lastRoomPhase = null; introMode = null; $('#intro').classList.add('hidden'); winShown = false;
  show('menu'); refreshPublic();
}

/* ───────────── menú ───────────── */
function initMenu() {
  $('#in-name').value = profile.name;
  const av = $('#avatars');
  AVATARS.forEach(a => { const b = document.createElement('button'); b.className = 'avatar-btn'; b.textContent = a; b.type = 'button'; b.setAttribute('aria-label', 'Avatar ' + a); b.setAttribute('aria-pressed', a === profile.avatar); b.onclick = () => { profile.avatar = a; saveProfile(); $$('.avatar-btn').forEach(x => x.setAttribute('aria-pressed', x === b)); sfx('select'); }; av.appendChild(b); });
  const prof = () => { profile.name = $('#in-name').value.trim().slice(0, 16); saveProfile(); return { name: profile.name || 'Pollito', avatar: profile.avatar }; };
  $('#in-name').addEventListener('input', () => { profile.name = $('#in-name').value.trim().slice(0, 16); saveProfile(); });
  $('#btn-create').onclick = async () => { const r = await send('room:create', Object.assign(prof(), { isPublic: false })); if (r.ok) saveSession(r); else toast(r.error || 'No se pudo crear la sala.', 'bad'); };
  $('#btn-quick').onclick = async () => { if (quickBusy) return; quickBusy = true; const r = await send('room:quick', prof()); quickBusy = false; if (r.ok) saveSession(r); else toast(r.error || 'No se pudo encontrar partida.', 'bad'); };
  const join = async code => { code = String(code || '').trim().toUpperCase(); if (code.length < 4) return toast('Escribe el código de la sala (5 caracteres).', 'bad'); const r = await send('room:join', Object.assign(prof(), { code })); if (r.ok) saveSession(r); else toast(r.error || 'No se pudo entrar.', 'bad'); };
  $('#btn-join').onclick = () => join($('#in-code').value);
  $('#in-code').addEventListener('keydown', e => { if (e.key === 'Enter') join(e.target.value); });
  $('#btn-rules').onclick = openRules; $('#btn-hud-rules').onclick = openRules;
  $('#btn-settings').onclick = openSettings; $('#btn-hud-settings').onclick = openSettings;
  $('#btn-cards').onclick = openCatalog;
  $('#btn-tutorial').onclick = () => runDemoTutorial();
  // mascota del menú
  const mc = $('#menu-chick'); mc.innerHTML = chickSVG(); const msvg = mc.firstElementChild; msvg.style.cursor = 'pointer';
  const wiggle = () => { if (document.body.dataset.screen !== 'menu') return; const e = ['excited', 'laughing', 'surprised', 'explaining', 'celebrate'][Math.floor(Math.random() * 5)]; msvg.setAttribute('class', 'chick e-' + e); setTimeout(() => msvg.setAttribute('class', 'chick e-idle'), 1600); };
  setInterval(wiggle, 6000);
  msvg.addEventListener('click', () => { sfx('chick'); msvg.setAttribute('class', 'chick e-surprised'); setTimeout(() => msvg.setAttribute('class', 'chick e-laughing'), 500); setTimeout(() => msvg.setAttribute('class', 'chick e-idle'), 2000); });
  // invitación por enlace
  const q = new URLSearchParams(location.search).get('sala');
  if (q) { $('#in-code').value = q.toUpperCase().slice(0, 5); history.replaceState(null, '', location.pathname); setTimeout(() => toast(`Te han invitado a la sala ${q.toUpperCase().slice(0, 5)}. Pon tu nombre y pulsa «Unirme».`), 500); $('#in-name').focus(); }
}
const saveProfile = () => store.set('profile', profile);
function refreshPublic() {
  if (!socket || !socket.connected || document.body.dataset.screen !== 'menu') return;
  socket.emit('room:list', {}, r => {
    const box = $('#pub-list'); if (!r || !r.ok) return; box.innerHTML = '';
    if (!r.rooms.length) { box.innerHTML = '<div class="hint" style="text-align:center">No hay salas públicas abiertas. ¡Crea la primera con «Partida rápida»!</div>'; return; }
    r.rooms.forEach(x => { const d = document.createElement('div'); d.className = 'pub-item'; d.innerHTML = `<span>${esc(x.host)} · ${x.count}/${x.max}</span>`; const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Entrar'; b.onclick = () => { $('#in-code').value = x.code; $('#btn-join').click(); }; d.appendChild(b); box.appendChild(d); });
  });
}
setInterval(refreshPublic, 5000);

/* ───────────── sala / lobby ───────────── */
function onRoomState(r) {
  room = r; myId = r.you; if (session) { session.id = r.you; }
  $('#room-chip b').textContent = r.code;
  if (r.phase === 'lobby') {
    if (lastRoomPhase !== 'lobby') { table.reset(); gstate = null; winShown = false; introMode = null; closeModal(); }
    show('lobby'); renderLobby();
  } else if (!demo) {
    if (lastRoomPhase === 'lobby' || lastRoomPhase === 'ended' || lastRoomPhase === null) { if (r.phase === 'game') enterGame(); else if (lastRoomPhase === null) show('game'); }
    if (r.phase === 'ended' && lastRoomPhase !== 'ended') { /* el overlay llega con el evento win */ }
  }
  lastRoomPhase = r.phase;
}
function renderLobby() {
  $('#lb-code').textContent = room.code;
  const host = room.hostId === myId;
  const box = $('#lb-members'); box.innerHTML = '';
  room.members.forEach(m => {
    const d = document.createElement('div'); d.className = 'member' + (m.connected ? '' : ' off');
    d.innerHTML = `<span class="av">${m.avatar}</span><div><b>${esc(m.name)}</b><small>${m.id === room.hostId ? 'Anfitrión' : m.connected ? 'Listo' : 'Desconectado'}${m.id === myId ? ' · tú' : ''}</small></div>`; box.appendChild(d);
  });
  const n = room.members.filter(m => m.connected).length;
  $('#lb-info').textContent = n < room.min ? `Hacen falta al menos ${room.min} jugadores. Comparte el código o el enlace.` : `${n} jugadores. Gana quien llene antes su nido: ${n <= 5 ? 5 : 6} huevos.`;
  $('#btn-start').classList.toggle('hidden', !host); $('#btn-start').disabled = n < room.min;
  $('#lb-public-row').classList.toggle('hidden', !host); $('#lb-public').checked = room.isPublic;
  if (!host) $('#lb-info').textContent += ' Esperando a que el anfitrión empiece.';
}
function initLobby() {
  $('#btn-copy-code').onclick = () => copy(room.code, 'Código copiado');
  $('#btn-copy-link').onclick = () => copy(inviteLink(room.code), 'Enlace de invitación copiado');
  $('#btn-lb-leave').onclick = leaveRoom;
  $('#btn-start').onclick = async () => { const r = await send('room:start'); if (!r.ok) toast(r.error, 'bad'); };
  $('#lb-public').onchange = e => send('room:settings', { isPublic: e.target.checked });
}
async function leaveRoom() { await send('room:leave'); session = null; store.del('session'); goMenu(); }

/* ───────────── chat ───────────── */
function addChat(m, silent) {
  [$('#lb-chat'), $('#g-chat')].forEach(list => {
    const d = document.createElement('div'); d.className = 'msg' + (m.id === myId ? ' me' : ''); const b = document.createElement('b'); b.textContent = `${m.avatar} ${m.name}`; d.append(b, document.createTextNode(m.text)); list.appendChild(d); list.scrollTop = list.scrollHeight;
  });
  if (!silent && m.id !== myId) {
    sfx('chat');
    const open = $('#side').classList.contains('open') || matchMedia('(min-width:1100px)').matches;
    if (!open || $('.tab[aria-selected="true"]').dataset.tab !== 'chat') { unread++; $('#chat-dot').textContent = unread; $('#chat-dot').classList.remove('hidden'); $('#tab-dot').textContent = unread; $('#tab-dot').classList.remove('hidden'); }
  }
}
function initChat() {
  [['#lb-emojis', '#lb-chat-form'], ['#g-emojis', '#g-chat-form']].forEach(([eb, fm]) => {
    const bar = $(eb); EMOJIS.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.setAttribute('aria-label', 'Enviar ' + e); b.onclick = () => send('chat:send', { text: e }).then(r => { if (r.error) toast(r.error, 'bad'); }); bar.appendChild(b); });
    const form = $(fm), input = $('input', form);
    form.onsubmit = async e => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; const r = await send('chat:send', { text: t }); if (r.error) toast(r.error, 'bad'); };
  });
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.setAttribute('aria-selected', x === t)); const chat = t.dataset.tab === 'chat';
    $('#tab-chat').classList.toggle('hidden', !chat); $('#log').classList.toggle('hidden', chat);
    if (chat) clearUnread();
  });
  $('#side-toggle').onclick = () => { $('#side').classList.toggle('open'); if ($('#side').classList.contains('open')) clearUnread(); };
}
function clearUnread() { unread = 0; $('#chat-dot').classList.add('hidden'); $('#tab-dot').classList.add('hidden'); }

/* ───────────── partida ───────────── */
function enterGame() {
  table.reset(); gstate = null; winShown = false; introMode = null; readySent = false; closeModal(); $('#intro').classList.add('hidden');
  show('game'); mascot.setEnabled(settings.mascot);
}
function onGameUpdate(state, events) {
  if (demo) return;
  gstate = state;
  if (document.body.dataset.screen !== 'game') show('game');
  table.update(state, events);
  if (state.phase === 'intro') handleIntro(state); else if (introMode) { $('#intro').classList.add('hidden'); introMode = null; }
  if (state.phase === 'ended' && state.winner && !winShown && !events.some(e => e.type === 'win')) onWin(state.winner, false, true);
}
function handleIntro(st) {
  const intro = $('#intro'), iAmReady = st.ready.includes(myId);
  const waiting = () => { const names = st.players.filter(p => !st.ready.includes(p.id) && p.connected && !p.gone).map(p => p.name); intro.classList.remove('hidden'); intro.innerHTML = `<div class="panel"><h3>¡Preparados!</h3><p class="hint">Esperando a: ${esc(names.join(', ') || '…')}</p></div>`; introMode = 'waiting'; };
  if (iAmReady) { if (introMode !== 'tutorial') waiting(); return; }
  if (introMode === 'tutorial') return;
  if (store.get('tutorialDone', false)) {
    if (!readySent) { readySent = true; setTimeout(() => send('game:ready'), 1300); }
    waiting(); return;
  }
  if (introMode === 'ask') return;
  introMode = 'ask'; intro.classList.remove('hidden');
  intro.innerHTML = `<div class="panel"><h3>¡Pío, pío! Parece que es tu primera partida</h3><p class="hint">¿Quieres que te explique cómo se juega? Dura un minuto y la partida espera a que termines.</p><div class="btns"><button class="btn primary" id="i-teach">¡Enséñame a jugar!</button><button class="btn" id="i-skip">Ya sé jugar, ¡vamos!</button></div></div>`;
  mascot.say('¡Hola! Soy Pío, tu guía por el corral.', 'excited', { sticky: false, ms: 5000, prio: 4 });
  $('#i-skip').onclick = () => { store.set('tutorialDone', true); readySent = true; send('game:ready'); introMode = null; handleIntro(gstate); };
  $('#i-teach').onclick = () => {
    introMode = 'tutorial'; intro.classList.add('hidden'); $('#mascot').classList.add('hidden');
    tutorialHandle = startTutorial({ table, context: () => ({ target: (gstate || { target: 5 }).target }), onStep: () => {}, onDone: () => { tutorialHandle = null; store.set('tutorialDone', true); $('#mascot').classList.remove('hidden'); readySent = true; send('game:ready'); introMode = null; if (gstate) handleIntro(gstate); } });
  };
}
function onPeek(p) {
  const ov = openModal(`<h2>${esc(p.title)}</h2><p class="hint">Solo lo ves tú.</p><div class="peek"></div><div class="foot"><button class="btn primary" data-close>Entendido</button></div>`);
  const box = $('.peek', ov); if (!p.cards.length) box.innerHTML = '<p>No hay cartas que mostrar.</p>'; p.cards.forEach(id => box.appendChild(makeCard(id, { cw: 96 })));
  sfx('manip');
}
function confetti() {
  if (motionOff()) return;
  const cols = ['#ffd23f', '#fff', '#5ec3ff', '#2f6bff', '#ff6b3d', '#ff9bd0'];
  for (let i = 0; i < 90; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};--dx:${(Math.random() - .5) * 240}px;--rot:${Math.random() * 900}deg;animation-duration:${2.4 + Math.random() * 2.2}s;animation-delay:${Math.random() * .8}s;border-radius:${Math.random() > .5 ? '50%' : '2px'}`; document.body.appendChild(c); setTimeout(() => c.remove(), 6000); }
}
function onWin(pid, abandon, immediate) {
  if (winShown) return; winShown = true;
  setTimeout(() => showEnd(pid, abandon), immediate ? 0 : 1300);
}
function showEnd(pid, abandon) {
  const st = gstate; if (!st) return;
  const won = pid === myId, w = st.players.find(p => p.id === pid);
  sfx(won ? 'win' : 'lose'); if (won) confetti();
  const rows = [...st.players].sort((a, b) => (b.id === pid) - (a.id === pid) || b.eggs - a.eggs).map(p => `<div class="stand ${p.id === pid ? 'win' : ''}"><span style="font-size:1.4rem">${p.avatar}</span><b>${esc(p.name)}${p.id === myId ? ' (tú)' : ''}</b>${p.gone ? '<small>(se fue)</small>' : ''}<span class="eg">${p.eggs} 🥚</span></div>`).join('');
  const host = room && room.hostId === myId;
  const ov = openModal(`<div id="end-chick"></div><h2 style="text-align:center">${won ? '¡Has ganado!' : `Ha ganado ${esc(w ? w.name : '?')}`}</h2>
    <p style="text-align:center;margin:0">${abandon ? 'La partida ha terminado porque no quedaban suficientes jugadores.' : won ? '¡Campeón del corral! Tu nido es el más grande.' : 'Otra vez será… ¡la próxima te pillo yo!'}</p>
    <div class="standings">${rows}</div><div class="foot"><button class="btn" id="e-leave">Salir al menú</button><button class="btn" data-close>Ver mesa</button>${host ? '<button class="btn primary" id="e-rematch">Revancha</button>' : '<span class="hint" style="align-self:center">El anfitrión puede pedir revancha.</span>'}</div>`);
  const ch = $('#end-chick', ov); ch.innerHTML = chickSVG(); ch.firstElementChild.setAttribute('class', 'chick e-' + (won ? 'victory' : 'sad'));
  $('#e-leave', ov).onclick = leaveRoom;
  const rm = $('#e-rematch', ov); if (rm) rm.onclick = async () => { const r = await send('room:start'); if (!r.ok) toast(r.error, 'bad'); };
  mascot.quip(won ? 'win' : 'lose', { prio: 5 });
}

/* ───────────── modales ───────────── */
function openRules() {
  const cats = CAT_ORDER.map(k => `<div class="rule-cat" style="--cc:${CATS[k].color}"><b>${CATS[k].name}</b>${{
    estrategia: 'Huevos, robar cartas y apuestas.', sabotaje: 'Robar, destruir y fastidiar a un rival.', manipulacion: 'Cambiar turnos, manos y reglas.',
    defensa: 'Cancelar, devolver, desviar y protegerte.', especial: 'Efectos raros, globales y alianzas.' }[k]}</div>`).join('');
  openModal(`<h2>Cómo se juega</h2>
    <h3>Objetivo</h3><p>Llena tu nido antes que nadie: <b>5 huevos</b> si sois de 2 a 5 jugadores, <b>6 huevos</b> si sois de 6 a 10.</p>
    <h3>Tu turno</h3><ol><li>Robas <b>1 carta</b>.</li><li>Tienes <b>2 acciones</b>: cada carta que juegas gasta una. Algunas cartas dan acciones extra.</li><li>Cuando no te queden acciones el turno termina solo, o pulsa <b>«Terminar turno»</b> antes. No hay reloj de turno: tómate tu tiempo.</li></ol>
    <h3>Reacciones</h3><p>Cuando alguien juega una carta, durante unos segundos <b>cualquiera puede reaccionar</b> con una carta de Defensa marcada con ⚡. Se pueden encadenar: un <b>¡Ni Hablar!</b> se cancela con otro, y se resuelve de la última carta a la primera. Si nadie puede reaccionar, la ventana es muy corta.</p>
    <h3>Tipos de carta</h3><div class="rules-cats">${cats}</div>
    <h3>Detalles que conviene saber</h3><ul><li>Los jugadores con <b>Pollito Fantasma</b> no pueden ser objetivo de nada.</li><li>Las cartas de efecto global (Luna Llena, Veda de Caza, Fiesta, Silencio) duran una ronda.</li><li>Si el mazo se agota, se baraja el descarte.</li><li>Si alguien se desconecta, se le pasa el turno; puede volver con el mismo navegador.</li></ul>
    <div class="foot"><button class="btn" id="r-cards">Ver todas las cartas</button><button class="btn" id="r-tut">Ver tutorial</button><button class="btn primary" data-close>Entendido</button></div>`, { wide: false })
    .addEventListener('click', e => { if (e.target.id === 'r-cards') { closeModal(); openCatalog(); } if (e.target.id === 'r-tut') { closeModal(); runDemoTutorial(); } });
}
function openCatalog() {
  const ov = openModal(`<h2>Todas las cartas</h2><p class="hint">${Object.keys(DEFS).length} cartas distintas. Toca el icono ⚡ para reconocer las reacciones.</p><div id="catalog"></div><div class="foot"><button class="btn primary" data-close>Cerrar</button></div>`, { wide: true });
  const box = $('#catalog', ov);
  CAT_ORDER.forEach(k => {
    const h = document.createElement('h3'); h.textContent = CATS[k].name; box.appendChild(h);
    const list = document.createElement('div'); list.className = 'cardlist'; Object.values(DEFS).filter(d => d.cat === k).forEach(d => { const c = makeCard(d.id, { cw: 132 }); list.appendChild(c); }); box.appendChild(list);
  });
}
function openSettings() {
  const ov = openModal(`<h2>Ajustes</h2>
    <label class="field"><span>Volumen: <b id="s-vol-v">${Math.round(settings.volume * 100)}%</b></span><input class="range" id="s-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="s-mute" ${settings.muted ? 'checked' : ''}> Silenciar todo el sonido</label>
    <label class="field"><span>Animaciones</span><select class="input" id="s-motion"><option value="auto">Según mi sistema</option><option value="off">Reducidas (sin movimiento)</option><option value="on">Completas</option></select></label>
    <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="s-mascot" ${settings.mascot ? 'checked' : ''}> Mostrar a Pío durante la partida</label>
    <div class="foot" style="justify-content:space-between"><button class="btn" id="s-tut">Ver el tutorial otra vez</button><button class="btn primary" data-close>Hecho</button></div>`);
  $('#s-motion', ov).value = settings.reducedMotion === null ? 'auto' : settings.reducedMotion ? 'off' : 'on';
  $('#s-vol', ov).oninput = e => { settings.volume = Number(e.target.value); $('#s-vol-v', ov).textContent = Math.round(settings.volume * 100) + '%'; saveSettings(); refreshVolume(); };
  $('#s-vol', ov).onchange = () => sfx('egg');
  $('#s-mute', ov).onchange = e => { settings.muted = e.target.checked; saveSettings(); refreshVolume(); };
  $('#s-motion', ov).onchange = e => { settings.reducedMotion = e.target.value === 'auto' ? null : e.target.value === 'off'; saveSettings(); };
  $('#s-mascot', ov).onchange = e => { settings.mascot = e.target.checked; saveSettings(); mascot.setEnabled(settings.mascot); $('#mascot').classList.toggle('hidden', !settings.mascot); };
  $('#s-tut', ov).onclick = () => { closeModal(); runDemoTutorial(); };
}

/* ───────────── tutorial a demanda (mesa de práctica) ───────────── */
function demoState(mode) {
  const you = { id: 'you', name: profile.name || 'Tú', avatar: profile.avatar };
  const P = [[you, 1], [{ id: 'a', name: 'Ana', avatar: '🦊' }, 2], [{ id: 'b', name: 'Beni', avatar: '🐷' }, 0], [{ id: 'c', name: 'Carla', avatar: '🐸' }, 3], [{ id: 'd', name: 'Dani', avatar: '🐙' }, 1]];
  const base = {
    now: Date.now(), phase: 'play', deadline: null, target: 5, dir: 1, turn: 'you', actions: 2, deckCount: 84, discardCount: 7, discardTop: 'rapina', mods: { luna: 3 }, winner: null,
    players: P.map(([p, e], i) => Object.assign({ eggs: e, handCount: 4 + (i % 3), connected: true, gone: false, ghost: i === 2, skip: false, trap: false, hideout: false, incubating: i === 3 ? 1 : 0, pact: null, noSabotage: false, noDraw: 0 }, p)),
    hand: ['huevo_fresco', 'zarpazo', 'trueque', 'nope', 'escudo', 'maiz', 'gallina_oro'].map((id, i) => ({ uid: i + 1, id })),
    stack: [], reaction: null, log: ['Ana juega Zarpazo del Zorro sobre ti.', 'Tú reaccionas con Escudo de Paja.', 'Beni termina su turno.'],
  };
  if (mode === 'reaction') Object.assign(base, { phase: 'reaction', turn: 'a', deadline: Date.now() + 5000, stack: [{ eid: 1, id: 'zarpazo', by: 'a', target: 'you', reaction: false }, { eid: 2, id: 'nope', by: 'b', target: null, reaction: true }], reaction: { eid: 2, mine: true, passed: false } });
  return base;
}
function runDemoTutorial() {
  if (!DEFS.nope) return;
  demo = true; closeModal(); table.reset(); show('game'); mascot.setEnabled(false); $('#mascot').classList.add('hidden'); $('#intro').classList.add('hidden');
  table.update(demoState('play'), []);
  tutorialHandle = startTutorial({
    table, context: () => ({ target: 5 }),
    onStep: (i, st) => table.update(demoState(st.demo || 'play'), []),
    onDone: () => { tutorialHandle = null; store.set('tutorialDone', true); demo = false; table.reset(); $('#mascot').classList.remove('hidden'); mascot.setEnabled(settings.mascot); room ? (room.phase === 'lobby' ? show('lobby') : (show('game'), gstate && table.update(gstate, []))) : show('menu'); refreshPublic(); },
  });
}

/* ───────────── arranque ───────────── */
async function boot() {
  try { setData(await (await fetch('/cards.json')).json()); } catch (e) { toast('No se pudieron cargar las cartas. Recarga la página.', 'bad'); return; }
  mascot.mount($('#mascot'));
  table = createTable({ me: () => (demo ? 'you' : myId), send, toast, onWin });
  initMenu(); initLobby(); initChat();
  $('#btn-menu').onclick = () => {
    if (demo) return;
    const ov = openModal(`<h2>¿Salir de la partida?</h2><p>Si sales, tu sitio quedará vacío y no podrás volver a esta partida.</p><div class="foot"><button class="btn" data-close>Seguir jugando</button><button class="btn primary" id="x-leave">Salir</button></div>`);
    $('#x-leave', ov).onclick = () => { closeModal(); leaveRoom(); };
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  connect();
  window.__cqtp = { get state() { return gstate; }, get room() { return room; }, table, mascot, runDemoTutorial, EMOTIONS };
}
boot();
