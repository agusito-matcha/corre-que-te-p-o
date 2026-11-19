// Datos de cartas (descargados del servidor) y constructor de cartas en el DOM.
export let DEFS = {}, CATS = {}, MODS = {};
export const CAT_ORDER = ['estrategia', 'sabotaje', 'manipulacion', 'defensa', 'especial'];

export function setData(d) {
  DEFS = Object.fromEntries(d.cards.map(c => [c.id, c]));
  CATS = d.cats; MODS = d.mods;
}
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Crea una carta. opts: uid, mini (sin descripción), flipped (boca abajo), cw (ancho en px). */
export function makeCard(id, opts = {}) {
  const d = DEFS[id] || { name: '?', cat: 'estrategia', icon: '❓', desc: '' };
  const el = document.createElement('div');
  el.className = `card cat-${d.cat}${opts.mini ? ' mini' : ''}${opts.flipped ? ' flipped' : ''}`;
  if (opts.uid != null) el.dataset.uid = opts.uid;
  el.dataset.id = id;
  if (opts.cw) el.style.setProperty('--cw', opts.cw + 'px');
  const cat = CATS[d.cat] ? CATS[d.cat].name : d.cat;
  const react = d.timing === 'react';
  el.innerHTML =
    `<div class="face front"><div class="c-top"><span>${esc(cat)}</span><span>${react ? '⚡ Reacción' : ''}</span></div>` +
    `<div class="c-art"><span class="ic">${d.icon}</span></div><div class="c-name">${esc(d.name)}</div><div class="c-desc">${esc(d.desc)}</div></div>` +
    `<div class="face back"><span>🥚</span></div>`;
  el.setAttribute('aria-label', `${d.name}. ${cat}. ${d.desc}`);
  return el;
}
export const cardBack = (cw) => makeCard('huevo_fresco', { flipped: true, cw, mini: true });
