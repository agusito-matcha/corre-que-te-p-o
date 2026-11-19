// La mesa: asientos dinámicos (2–10), mano en abanico, pila de reacciones y coreografía de animaciones.
import { DEFS, CATS, CAT_ORDER, MODS, makeCard, esc } from './cards-ui.js';
import { sfx } from './audio.js';
import { mascot } from './mascot.js';
import { motionOff } from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cardRect = (cx, cy, w) => ({ left: cx - w / 2, top: cy - w * 0.7, width: w, height: w * 1.4 });
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const CAT_SFX = { sabotaje: 'sabotage', defensa: 'defense', manipulacion: 'manip', estrategia: 'strategy', especial: 'special' };
const STATUS = [
  ['ghost', '👻', 'Fantasma: nadie puede apuntarle'], ['skip', '💤', 'Perderá su próximo turno'], ['trap', '🕸️', 'Cepo: su próximo huevo se rompe'],
  ['hideout', '🧺', 'Escondrijo: protege un huevo'], ['pact', '🤝', 'Pacto de plumas'], ['noSabotage', '🤐', 'Sin Sabotajes en su turno'],
  ['noDraw', '🚫', 'No robará carta'], ['incubating', '🔥', 'Incubadora'],
];

export function createTable(api) {
  const E = {
    table: $('#table'), center: $('#center'), seats: $('#seats'), hand: $('#hand'), meBar: $('#me-bar'), deck: $('#deck'), discard: $('#discard'), zone: $('#play-zone'),
    react: $('#react-box'), mods: $('#mods'), dir: $('#dir'), banner: $('#banner'), preview: $('#preview'), endTurn: $('#end-turn'),
    turn: $('#turn-label'), goal: $('#goal-chip b'), log: $('#log'), deckLabel: $('#deck-label'), discardLabel: $('#discard-label'),
  };
  let s = null, off = 0, sel = null, pick = null, chain = Promise.resolve(), pending = 0, lastPlay = null, seatKey = '', logKey = '', ticker = 0;
  const me = () => api.me();
  const meP = () => (s ? s.players.find(p => p.id === me()) : null);
  const pl = id => (s ? s.players.find(p => p.id === id) : null);
  const now = () => Date.now() + off;
  const fast = () => motionOff() || pending > 26;

  /* ───────── utilidades visuales ───────── */
  const seatEl = id => (id === me() ? $('.me-chip .av', E.meBar) : $(`.seat[data-id="${id}"] .av`, E.seats));
  const seatPoint = id => { const e = seatEl(id); return e ? center(e.getBoundingClientRect()) : center(E.table.getBoundingClientRect()); };
  const zoneRect = () => E.zone.getBoundingClientRect();
  const deckPoint = () => center(E.deck.getBoundingClientRect());
  const discardPoint = () => center(E.discard.getBoundingClientRect());

  function fly(from, to, node, { dur = 520, delay = 0, rot = 0, arc = 40 } = {}) {
    if (fast()) return Promise.resolve();
    const el = document.createElement('div'); el.className = 'fly';
    Object.assign(el.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    node.style.setProperty('--cw', from.width + 'px'); el.appendChild(node); document.body.appendChild(el);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2), sc = to.width / from.width;
    const a = el.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)' },
      { transform: `translate(${dx * .5}px,${dy * .5 - arc}px) scale(${((1 + sc) / 2) * 1.12}) rotate(${rot / 2}deg)`, offset: .55 },
      { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(${rot}deg)` },
    ], { duration: dur, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    return a.finished.catch(() => {}).then(() => el.remove());
  }
  const mkfx = (cls, css) => { const n = document.createElement('div'); n.className = 'fx ' + cls; Object.assign(n.style, css); document.body.appendChild(n); return n; };
  const runfx = (n, frames, opt) => n.animate(frames, opt).finished.catch(() => {}).then(() => n.remove());

  /** Partículas distintas por categoría. */
  function burst(x, y, cat) {
    if (fast()) return;
    if (cat === 'defensa') {
      for (let i = 0; i < 2; i++) runfx(mkfx('ring', { left: x - 20 + 'px', top: y - 20 + 'px', width: '40px', height: '40px', borderColor: i ? '#fff' : '#9fd0ff' }),
        [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(4.2)', opacity: 0 }], { duration: 650, delay: i * 120, easing: 'ease-out' });
    } else if (cat === 'manipulacion') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = 70 + (i % 3) * 14, n = mkfx('p', { left: x + 'px', top: y + 'px', background: i % 2 ? '#9fd0ff' : '#fff' });
        runfx(n, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a + 1.6) * r}px,${Math.sin(a + 1.6) * r}px) scale(.2)`, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.5,0,.8,.6)' });
      }
    } else if (cat === 'sabotaje') {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 90, n = mkfx('p', { left: x + 'px', top: y + 'px', background: ['#ff6b3d', '#ffb13d', '#fff3b0'][i % 3], width: '7px', height: '7px' });
        runfx(n, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r + 20}px) scale(.3)`, opacity: 0 }], { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.1,.8,.3,1)' });
      }
    } else if (cat === 'estrategia') {
      for (let i = 0; i < 14; i++) {
        const n = mkfx('p', { left: x + (Math.random() - .5) * 90 + 'px', top: y + 'px', background: i % 2 ? '#ffd23f' : '#fff3b0', width: '8px', height: '8px', borderRadius: '2px' });
        runfx(n, [{ transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 }, { transform: `translateY(${-60 - Math.random() * 70}px) rotate(180deg) scale(.2)`, opacity: 0 }], { duration: 750, delay: Math.random() * 150, easing: 'ease-out' });
      }
    } else {
      flash();
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 150, n = mkfx('p', { left: x + 'px', top: y + 'px', background: ['#ffd23f', '#ff9bd0', '#7fd3ff', '#fff', '#b5f3c3'][i % 5], width: '9px', height: '13px', borderRadius: '2px' });
        runfx(n, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r + 50}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.1,.8,.3,1)' });
      }
    }
  }
  function flash() { if (fast()) return; const f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 600); }
  function pop(text, x, y, cls = '') {
    const n = document.createElement('div'); n.className = 'pop ' + cls; n.textContent = text; n.style.left = x + 'px'; n.style.top = y + 'px'; document.body.appendChild(n);
    const frames = motionOff() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: .22 }, { transform: 'translate(-50%,-190%) scale(1)', opacity: 0 }];
    n.animate(frames, { duration: 1300, easing: 'ease-out' }).finished.catch(() => {}).then(() => n.remove());
  }
  function banner(html, cls = '', ms = 2000) {
    E.banner.innerHTML = `<div class="bn ${cls}">${html}</div>`;
    clearTimeout(banner.t); banner.t = setTimeout(() => { E.banner.innerHTML = ''; }, ms);
  }
  const hit = id => { const e = id === me() ? $('.me-chip', E.meBar) : $(`.seat[data-id="${id}"]`, E.seats); if (e && !fast()) { e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); } };

  /* ───────── asientos ───────── */
  const seatH = w => clamp(w * 0.5, 36, 58) + 54;
  function layoutSeats() {
    const ps = s.players, myI = ps.findIndex(p => p.id === me()), others = [];
    for (let k = myI < 0 ? 0 : 1; k < ps.length; k++) others.push(ps[(Math.max(myI, 0) + k) % ps.length]);
    const W = E.table.clientWidth, H = E.table.clientHeight;
    const key = others.map(p => p.id).join(',') + '|' + W + 'x' + H;
    const known = new Set(others.map(p => p.id));
    for (const n of [...E.seats.children]) if (!known.has(n.dataset.id)) n.remove();
    const m = others.length; if (!m) return;
    if (key !== seatKey) {
      seatKey = key;
      const narrow = W < 640; E.table.classList.toggle('narrow', narrow);
      let pts = [], sw;
      if (narrow) {
        // Pantallas estrechas: los rivales en filas ordenadas sobre el centro (una elipse no cabe).
        const rows = m <= 5 ? 1 : 2, cols = Math.ceil(m / rows);
        sw = clamp(Math.floor((W - 8) / cols) - 4, 56, 104);
        const h = seatH(sw) + 4;
        others.forEach((_, i) => {
          const r = Math.floor(i / cols), inRow = r === rows - 1 ? m - cols * (rows - 1) : cols, c = i - r * cols;
          pts.push({ x: W / 2 + (c - (inRow - 1) / 2) * (sw + 4), y: 6 + h / 2 + r * h });
        });
        const bottom = 6 + rows * h;
        E.center.style.top = bottom + 18 + 64 + 'px'; E.mods.style.top = bottom + 2 + 'px';
      } else {
        // Elipse con asientos a distancias iguales (longitud de arco) y el mayor tamaño que no solape.
        E.center.style.top = ''; E.mods.style.top = '';
        const ex = m >= 7 ? 22 : m >= 5 ? 12 : 0, spread = Math.min(80 + ex, 40 * (m - 1)), cy = H * 0.5, ry = H * 0.4;
        for (sw = 114; sw >= 54; sw -= 4) {
          const rx = W / 2 - sw / 2 - 6, N = 240, a0 = 270 - spread, a1 = 270 + spread, smp = [];
          let L = 0;
          for (let k = 0; k <= N; k++) {
            const t = (a0 + ((a1 - a0) * k) / N) * Math.PI / 180, x = W / 2 + rx * Math.cos(t), y = cy + ry * Math.sin(t);
            if (k) L += Math.hypot(x - smp[k - 1].x, y - smp[k - 1].y);
            smp.push({ x, y, L });
          }
          pts = others.map((_, i) => { const want = m === 1 ? L / 2 : (L * i) / (m - 1); let k = 0; while (k < N && smp[k].L < want) k++; return smp[k]; });
          let clash = false;
          for (let i = 0; i < m && !clash; i++) for (let j = i + 1; j < m; j++) if (Math.abs(pts[i].x - pts[j].x) < sw + 4 && Math.abs(pts[i].y - pts[j].y) < seatH(sw) + 2) { clash = true; break; }
          if (!clash) break;
        }
        sw = Math.max(sw, 54);
      }
      E.table.style.setProperty('--seatw', sw + 'px');
      others.forEach((p, i) => { const e = ensureSeat(p); e.style.left = pts[i].x + 'px'; e.style.top = pts[i].y + 'px'; });
    }
    others.forEach(p => updateSeat(ensureSeat(p), p));
  }
  function ensureSeat(p) {
    let e = $(`.seat[data-id="${p.id}"]`, E.seats);
    if (!e) {
      e = document.createElement('div'); e.className = 'seat'; e.dataset.id = p.id;
      e.innerHTML = '<div class="av"><span class="emo"></span><span class="hc"></span></div><div class="nm"></div><div class="nest"></div><div class="st"></div>';
      e.addEventListener('click', () => onSeat(p.id)); E.seats.appendChild(e);
    }
    return e;
  }
  function nestHTML(eggs) { let h = ''; for (let i = 0; i < s.target; i++) h += `<i class="${i < eggs ? 'on' : ''}"></i>`; return h; }
  function statusText(p) {
    return STATUS.map(([k, ic, t]) => { const v = p[k]; if (!v) return ''; return `<span title="${esc(t)}">${ic}${k === 'incubating' && v > 1 ? v : ''}</span>`; }).join('') + (!p.connected && !p.gone ? '<span title="Desconectado">🔌</span>' : '');
  }
  function updateSeat(e, p) {
    e.querySelector('.emo').textContent = p.avatar; e.querySelector('.hc').textContent = p.handCount; e.querySelector('.nm').textContent = p.name;
    const nest = e.querySelector('.nest'), want = nestHTML(p.eggs); if (nest.dataset.k !== want) { nest.innerHTML = want; nest.dataset.k = want; }
    e.querySelector('.st').innerHTML = statusText(p);
    e.classList.toggle('turn', s.turn === p.id && s.phase !== 'ended'); e.classList.toggle('away', !p.connected && !p.gone); e.classList.toggle('gone', p.gone);
    e.classList.toggle('pickable', !!pick && pickable(p)); e.title = `${p.name}: ${p.eggs} huevos, ${p.handCount} cartas`;
  }
  const pickable = p => p.id !== me() && !p.gone && !p.ghost;

  function renderMeBar() {
    const p = meP(); if (!p) { E.meBar.innerHTML = ''; return; }
    let chip = $('.me-chip', E.meBar);
    if (!chip) {
      E.meBar.innerHTML = '<div class="me-chip"><div class="av"></div><div><div class="nmx"></div><div class="nest"></div></div><div class="st"></div></div><div id="acts" title="Acciones que te quedan este turno"></div>';
      chip = $('.me-chip', E.meBar);
    }
    $('.av', chip).textContent = p.avatar; $('.nmx', chip).textContent = p.name + ' (tú)';
    $('.nest', chip).innerHTML = nestHTML(p.eggs); $('.st', chip).innerHTML = statusText(p);
    chip.classList.toggle('turn', s.turn === p.id && s.phase !== 'ended');
    const acts = $('#acts', E.meBar), mine = s.turn === p.id && s.phase !== 'ended' && s.phase !== 'intro';
    acts.classList.toggle('hidden', !mine);
    if (mine) { let h = '<span>Acciones</span>'; const total = Math.max(s.actions, 2); for (let i = 0; i < total; i++) h += `<i class="${i < s.actions ? '' : 'off'}"></i>`; acts.innerHTML = h; }
  }

  /* ───────── centro ───────── */
  function renderCenter() {
    E.deckLabel.textContent = `Mazo · ${s.deckCount}`; E.discardLabel.textContent = `Descarte · ${s.discardCount}`;
    const lbl = E.discard.querySelector('.card'); if (lbl) lbl.remove();
    if (s.discardTop) { const c = makeCard(s.discardTop, { mini: true }); c.style.position = 'absolute'; c.style.inset = '0'; E.discard.insertBefore(c, E.discardLabel); }
    // pila de jugadas en curso
    const have = new Map([...E.zone.querySelectorAll('.card')].map(c => [c.dataset.eid, c]));
    s.stack.forEach((en, i) => {
      let c = have.get(String(en.eid));
      if (!c) { c = makeCard(en.id, { mini: true }); c.dataset.eid = en.eid; c.dataset.hold = '1'; c.style.visibility = 'hidden'; setTimeout(() => { c.style.visibility = ''; }, 1400); E.zone.appendChild(c); }
      have.delete(String(en.eid));
      c.style.transform = `translate(calc(-50% + ${i * 26}px), ${i * 5}px) rotate(${(i - (s.stack.length - 1) / 2) * 5}deg)`; c.style.zIndex = i + 1;
      c.classList.toggle('reaction', !!en.reaction);
    });
    have.forEach(c => c.remove());
    const top = s.stack[s.stack.length - 1];
    let tag = E.zone.querySelector('.pz-tag');
    if (top) { if (!tag) { tag = document.createElement('div'); tag.className = 'pz-tag'; E.zone.appendChild(tag); } const by = pl(top.by), tg = top.target ? pl(top.target) : null; tag.textContent = `${by ? by.name : '?'}${tg ? ' → ' + tg.name : ''}`; } else if (tag) tag.remove();
    E.mods.innerHTML = Object.keys(s.mods).map(k => `<span class="mod">${esc(MODS[k] || k)}</span>`).join('');
    const arrow = s.dir === 1 ? '↻' : '↺'; if (E.dir.textContent !== arrow) { E.dir.textContent = arrow; }
    renderReactBox();
  }
  function renderReactBox() {
    const r = s.reaction;
    if (!r || s.phase !== 'reaction') { E.react.classList.add('hidden'); E.react.innerHTML = ''; return; }
    const top = s.stack[s.stack.length - 1], d = top ? DEFS[top.id] : null;
    let msg;
    if (r.mine && !r.passed) msg = '<b>¡Puedes reaccionar!</b> Elige una carta de Defensa';
    else if (r.passed) msg = 'Has pasado. Esperando…';
    else msg = 'Esperando reacciones…';
    E.react.classList.remove('hidden');
    E.react.innerHTML = `<div class="ring"><span>${msg}</span><span class="cd">·</span>${r.mine && !r.passed ? '<button class="btn small" id="btn-pass">Paso</button>' : ''}</div>`;
    const b = $('#btn-pass', E.react); if (b) b.onclick = () => { api.send('game:pass').then(() => {}); };
    updateCountdown();
  }
  function updateCountdown() {
    const cd = $('.cd', E.react); if (!cd || !s || !s.reaction) return;
    const left = Math.max(0, Math.ceil((s.deadline - now()) / 1000)); const prev = cd.textContent; cd.textContent = left;
    if (s.reaction.mine && !s.reaction.passed && left <= 3 && prev !== String(left) && left > 0) sfx('tick');
  }

  /* ───────── mano ───────── */
  const catIdx = id => CAT_ORDER.indexOf((DEFS[id] || {}).cat);
  function renderHand() {
    const hand = [...s.hand].sort((a, b) => catIdx(a.id) - catIdx(b.id) || a.id.localeCompare(b.id) || a.uid - b.uid);
    const have = new Map([...E.hand.children].map(c => [c.dataset.uid, c]));
    hand.forEach((c, i) => {
      let el = have.get(String(c.uid));
      if (!el) { el = makeCard(c.id, { uid: c.uid, mini: true }); el.setAttribute('role', 'listitem'); el.tabIndex = 0; el.classList.add('deal-in'); el.style.animationDelay = i * 70 + 'ms'; bindCard(el); }
      have.delete(String(c.uid));
      if (E.hand.children[i] !== el) E.hand.insertBefore(el, E.hand.children[i] || null);
    });
    have.forEach(c => c.remove());
    const n = hand.length;
    const cw = n ? parseFloat(getComputedStyle(E.hand.children[0]).width) : 100, avail = E.hand.clientWidth - 44;
    const ov = n > 1 ? Math.max(n > 5 ? cw * .08 : 0, (n * cw - avail) / (n - 1)) : 0, step = Math.min(4.2, 24 / Math.max(n, 1));
    [...E.hand.children].forEach((el, i) => {
      const o = i - (n - 1) / 2;
      el.style.setProperty('--ov', ov + 'px'); el.style.setProperty('--rot', o * step + 'deg'); el.style.setProperty('--lift', Math.abs(o) ** 2 * 1.3 + 'px'); el.style.zIndex = i + 1;
      const id = el.dataset.id, d = DEFS[id], why = whyNot(d), ok = !why;
      el.classList.toggle('dim', !ok); el.classList.toggle('playable', ok);
      el.classList.toggle('react-ok', ok && d.timing === 'react'); el.classList.toggle('sel', sel === Number(el.dataset.uid));
    });
    if (sel != null && !s.hand.some(c => c.uid === sel)) clearSel();
  }
  function bindCard(el) {
    const uid = () => Number(el.dataset.uid);
    el.addEventListener('click', () => { sfx('select'); if (sel === uid()) { clearSel(); } else { sel = uid(); pick = null; renderHand(); renderPreview(); } });
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } });
    el.addEventListener('dblclick', () => { sel = uid(); doPlay(); });
  }
  function whyNot(d) {
    if (!s || !meP()) return 'No estás en la partida.';
    const mine = s.turn === me();
    if (s.phase === 'ended') return 'La partida ha terminado.';
    if (s.phase === 'intro') return 'La partida aún no ha empezado.';
    if (d.timing === 'react') {
      if (s.phase === 'reaction' && s.reaction && s.reaction.mine && !s.reaction.passed) return null;
      if (s.phase === 'reaction') return 'Ahora no puedes reaccionar (o ya has pasado).';
      return 'Es una reacción: guárdala para cuando alguien juegue algo.';
    }
    if (s.phase === 'reaction') return 'Hay una jugada en marcha: espera a que se resuelva.';
    if (!mine) return 'Aún no es tu turno.';
    if (s.actions < 1) return 'No te quedan acciones: termina el turno.';
    if (d.cat === 'sabotaje' && meP().noSabotage) return 'La mordaza te impide jugar Sabotajes este turno.';
    return null;
  }
  function clearSel() { sel = null; pick = null; renderPreview(); if (s) { renderHand(); [...E.seats.children].forEach(e => updateSeat(e, pl(e.dataset.id))); } }

  /* ───────── vista previa y acción ───────── */
  function renderPreview() {
    const c = s && sel != null ? s.hand.find(h => h.uid === sel) : null;
    if (!c) { E.preview.classList.add('hidden'); E.preview.innerHTML = ''; return; }
    const d = DEFS[c.id], why = whyNot(d), react = d.timing === 'react';
    E.preview.classList.remove('hidden'); E.preview.innerHTML = '';
    const big = makeCard(c.id, { cw: 128 }); E.preview.appendChild(big);
    const box = document.createElement('div');
    let hint = pick ? '👆 Toca al jugador que será el objetivo.' : (why ? why : (d.target === 'enemy' ? 'Al jugarla elegirás un objetivo.' : d.target === 'leader' ? 'Apunta sola al jugador con más huevos.' : d.target === 'revenge' ? 'Apunta sola a quien te atacó por última vez.' : ''));
    box.innerHTML = `<h3>${d.icon} ${esc(d.name)}</h3><p>${esc(d.desc)}</p><div class="why">${esc(hint)}</div><div class="row"></div>`;
    const row = $('.row', box);
    const go = document.createElement('button'); go.className = 'btn primary small'; go.textContent = react ? 'Reaccionar' : 'Jugar'; go.disabled = !!why || !!pick; go.onclick = doPlay; row.appendChild(go);
    const cancel = document.createElement('button'); cancel.className = 'btn small'; cancel.textContent = pick ? 'Cambiar de carta' : 'Cerrar'; cancel.onclick = clearSel; row.appendChild(cancel);
    E.preview.appendChild(box);
    if (!why && !pick && matchMedia('(hover:hover)').matches) setTimeout(() => go.focus({ preventScroll: true }), 0);
  }
  function doPlay() {
    const c = s && s.hand.find(h => h.uid === sel); if (!c) return;
    const d = DEFS[c.id], why = whyNot(d); if (why) { api.toast(why, 'bad'); return; }
    if (d.target === 'enemy') {
      if (!s.players.some(pickable)) { api.toast('No hay ningún jugador al que puedas apuntar ahora mismo.', 'bad'); return; }
      pick = { uid: c.uid, reaction: d.timing === 'react' }; renderPreview(); [...E.seats.children].forEach(e => updateSeat(e, pl(e.dataset.id))); return;
    }
    send(c.uid, d.timing === 'react', null);
  }
  function onSeat(id) {
    if (!pick) return; const p = pl(id); if (!p || !pickable(p)) { api.toast(p && p.ghost ? `${p.name} es un fantasma: no se le puede apuntar.` : 'Elige a otro jugador.', 'bad'); return; }
    send(pick.uid, pick.reaction, id);
  }
  function send(uid, reaction, target) {
    const el = E.hand.querySelector(`[data-uid="${uid}"]`);
    if (el) lastPlay = { t: Date.now(), rect: el.getBoundingClientRect(), uid };
    sel = null; pick = null; renderPreview();
    api.send(reaction ? 'game:react' : 'game:play', { uid, target }).then(r => { if (r && !r.ok && r.error) { api.toast(r.error, 'bad'); lastPlay = null; } });
  }
  E.endTurn.onclick = () => { sfx('select'); api.send('game:end').then(r => { if (r && !r.ok && r.error) api.toast(r.error, 'bad'); }); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel != null) clearSel(); });

  /* ───────── HUD, registro ───────── */
  function renderHud() {
    const cur = s.turn ? pl(s.turn) : null, mine = s.turn === me();
    let t = 'Preparando la partida…';
    if (s.phase === 'ended') t = 'Fin de la partida';
    else if (s.phase === 'reaction') t = 'Reacciones en juego…';
    else if (cur) t = mine ? '¡Es tu turno!' : `Turno de ${cur.name}`;
    E.turn.textContent = t; E.turn.classList.toggle('mine', mine && s.phase !== 'ended');
    E.goal.textContent = s.target;
    const canEnd = mine && s.phase === 'play';
    E.endTurn.classList.toggle('hidden', !canEnd); E.endTurn.classList.toggle('nudge', canEnd && s.actions < 1);
    const k = s.log.join('\n'); if (k !== logKey) { logKey = k; E.log.innerHTML = s.log.map(l => `<div>${esc(l)}</div>`).join(''); E.log.scrollTop = E.log.scrollHeight; }
  }

  /* ───────── actualización principal ───────── */
  function update(state, events = []) {
    s = state; off = state.now - Date.now();
    layoutSeats(); renderMeBar(); renderCenter(); renderHand(); renderHud(); renderPreview();
    clearInterval(ticker); if (s.phase === 'reaction') ticker = setInterval(updateCountdown, 250);
    if (events.length) { pending += events.length; chain = chain.then(() => runEvents(events)); }
  }
  async function runEvents(evs) {
    for (const e of evs) { try { await handle(e); } catch (err) { console.warn('evento', e.type, err); } pending = Math.max(0, pending - 1); }
  }

  /* ───────── coreografía de eventos ───────── */
  async function handle(e) {
    const W = ms => (fast() ? Promise.resolve() : wait(ms));
    switch (e.type) {
      case 'start': sfx('chick'); mascot.quip('start', { prio: 3 }); break;
      case 'turn':
        if (e.pid === me()) { sfx('notify'); banner('¡Tu turno!', '', 1100); mascot.quip('myTurn'); await W(300); }
        break;
      case 'play': {
        const d = DEFS[e.card]; if (!d) break;
        const mineLocal = e.pid === me() && lastPlay && Date.now() - lastPlay.t < 5000;
        const from = mineLocal ? lastPlay.rect : cardRect(...Object.values(seatPoint(e.pid)), 58);
        const zc = E.zone.querySelector(`[data-eid="${e.eid}"]`), to = zc ? zc.getBoundingClientRect() : zoneRect();
        sfx('select');
        await fly(from, to, makeCard(e.card, { mini: true }), { dur: 480, rot: (Math.random() - .5) * 14 });
        if (zc) { zc.style.visibility = ''; zc.dataset.hold = ''; }
        const c = center(to); sfx(CAT_SFX[d.cat] || 'play'); burst(c.x, c.y, d.cat);
        if (d.cat === 'especial') banner(`${d.icon} ${esc(d.name)}`, '', 1500);
        if (e.target) hit(e.target);
        if (d.hostile && e.target === me() && e.pid !== me()) mascot.quip('stolenFromMe', { prio: 3 });
        else if (d.cat === 'sabotaje') mascot.quip('sabotage');
        else if (d.cat === 'defensa') mascot.quip('defense');
        else if (d.cat === 'especial') mascot.quip('power', { prio: 2 });
        await W(260); break;
      }
      case 'draw': {
        sfx('draw');
        if (e.pid !== me()) { const dp = deckPoint(), sp = seatPoint(e.pid); for (let k = 0; k < Math.min(e.n, 3); k++) { fly(cardRect(dp.x, dp.y, 50), cardRect(sp.x, sp.y, 34), makeCard('huevo_fresco', { flipped: true, mini: true }), { dur: 420, delay: k * 110, rot: 12 }); } await W(140); }
        break;
      }
      case 'discard': {
        const sp = seatPoint(e.pid), dp = discardPoint(); sfx('play');
        e.cards.forEach((id, k) => fly(cardRect(sp.x, sp.y, 40), cardRect(dp.x, dp.y, 60), makeCard(id, { mini: true }), { dur: 480, delay: k * 130, rot: -10 }));
        hit(e.pid); await W(300 + e.cards.length * 100); break;
      }
      case 'steal': {
        const a = seatPoint(e.from), b = seatPoint(e.to); sfx('steal'); hit(e.from);
        const node = e.kind === 'egg' ? (() => { const d = document.createElement('div'); d.textContent = '🥚'; d.style.cssText = 'font-size:34px;line-height:48px;text-align:center'; return d; })() : makeCard('huevo_fresco', { flipped: true, mini: true });
        await fly(cardRect(a.x, a.y, e.kind === 'egg' ? 30 : 38), cardRect(b.x, b.y, e.kind === 'egg' ? 30 : 38), node, { dur: 560, arc: 70, rot: 25 });
        if (e.to !== me() && e.from === me()) mascot.quip('stolenFromMe', { prio: 3 }); else mascot.quip('steal', { prio: 2 });
        break;
      }
      case 'egg': {
        const p = seatPoint(e.pid);
        if (e.delta > 0) { pop(`+${e.delta} 🥚`, p.x, p.y - 20); sfx('egg'); if (e.pid === me() && Math.random() < .5) mascot.quip('egg'); await W(220); }
        else if (e.delta < 0) { pop(`${e.delta} 🥚`, p.x, p.y - 20, 'neg'); sfx('eggLost'); hit(e.pid); if (e.pid === me()) mascot.quip('eggLost', { prio: 2 }); await W(220); }
        else pop('⚖️', p.x, p.y - 20);
        break;
      }
      case 'shuffle': sfx('shuffle'); E.deck.classList.remove('shuffle'); void E.deck.offsetWidth; E.deck.classList.add('shuffle'); await W(350); break;
      case 'negate': { const c = center(zoneRect()); pop('¡CANCELADA!', c.x, c.y - 40, 'neg'); sfx('nope'); burst(c.x, c.y, 'defensa'); mascot.quip('defense', { prio: 2 }); await W(450); break; }
      case 'bounce': { const c = center(zoneRect()); pop('↩️ ¡REBOTE!', c.x, c.y - 40); sfx('defense'); burst(c.x, c.y, 'defensa'); await W(450); break; }
      case 'shield': { const p = seatPoint(e.pid); pop('🛡️', p.x, p.y - 10); sfx('defense'); burst(p.x, p.y, 'defensa'); break; }
      case 'trap': { const p = seatPoint(e.pid); pop('💥 ¡Cepo!', p.x, p.y - 20, 'neg'); sfx('eggLost'); hit(e.pid); break; }
      case 'skip': { const p = seatPoint(e.pid); pop('💤 pierde el turno', p.x, p.y - 30); mascot.quip('skip'); await W(250); break; }
      case 'coin': { const p = seatPoint(e.pid); pop(e.cara ? '🪙 ¡Cara!' : '🪙 ¡Cruz!', p.x, p.y - 30); sfx('coin'); await W(500); break; }
      case 'duel': banner('🥊 ¡Pelea de gallos!', 'coral', 1300); sfx('sabotage'); await W(500); break;
      case 'betrayal': banner('¡TRAICIÓN!', 'coral', 1800); sfx('sabotage'); mascot.quip('betrayal', { prio: 3 }); await W(600); break;
      case 'caos': banner(`🎰 ¡Caos!<small>${esc((DEFS[e.card] || {}).name || '')}</small>`, 'blue', 1800); sfx('special'); mascot.quip('chaos', { prio: 2 }); await W(700); break;
      case 'mod': banner(`${esc(e.name)}`, 'blue', 2100); sfx('special'); flash(); mascot.quip('mod', { prio: 3 }); await W(500); break;
      case 'modEnd': api.toast(`Termina: ${MODS[e.mod] || e.mod}`); break;
      case 'dir': sfx('manip'); E.dir.style.transform = 'translateX(-50%) rotate(360deg) scale(1.6)'; setTimeout(() => { E.dir.style.transform = ''; }, 500); await W(200); break;
      case 'rotate': case 'swap': { const c = center(E.table.getBoundingClientRect()); sfx('manip'); burst(c.x, c.y, 'manipulacion'); await W(300); break; }
      case 'resolved': {
        const dp = discardPoint(), zr = zoneRect(), z = center(zr);
        e.cards.forEach((id, k) => fly(cardRect(z.x, z.y, 70), cardRect(dp.x, dp.y, 50), makeCard(id, { mini: true }), { dur: 420, delay: k * 90, arc: 20, rot: 14 }));
        await W(180 + e.cards.length * 60); break;
      }
      case 'left': api.toast('Un jugador ha abandonado la partida.'); break;
      case 'win': api.onWin(e.pid, !!e.abandon); break;
      default: break;
    }
  }

  window.addEventListener('resize', () => { if (s) { seatKey = ''; layoutSeats(); renderHand(); } });
  return {
    update, getEl: k => ({ hand: E.hand, deck: E.deck, discard: E.discard, play: E.zone.parentElement, me: E.meBar, seats: E.seats, goal: $('#goal-chip'), endTurn: E.endTurn, log: $('#side'), table: E.table, react: E.react, mods: E.mods }[k]),
    reset() { s = null; seatKey = ''; logKey = ''; sel = null; pick = null; E.seats.innerHTML = ''; E.hand.innerHTML = ''; E.zone.innerHTML = ''; E.meBar.innerHTML = ''; E.banner.innerHTML = ''; E.preview.classList.add('hidden'); clearInterval(ticker); pending = 0; },
    relayout() { if (s) { seatKey = ''; layoutSeats(); renderHand(); } },
    state: () => s,
  };
}
