// Tutorial guiado por el pollito: burbujas animadas, foco sobre la interfaz real y cartas de ejemplo.
import { chickSVG } from './mascot.js';
import { makeCard, esc } from './cards-ui.js';
import { sfx } from './audio.js';

const STEPS = [
  { key: 'me', emo: 'excited', title: 'El objetivo', pos: 'top',
    text: (c) => `¡Pío, pío! Aquí gana quien llene antes su nido: <b>${c.target} huevos</b> (5 si sois hasta 5 jugadores, 6 si sois más). Este es tu nido. Los huevos se ponen con cartas de <b>Huevo</b>… y se pueden robar.` },
  { key: 'me', emo: 'explaining', title: 'Cómo va un turno', pos: 'top',
    text: () => 'Al empezar tu turno robas <b>1 carta</b> y tienes <b>2 acciones</b> (los rayos amarillos). Cada carta que juegas gasta 1. No hay reloj: piensa lo que quieras. Cuando no te queden acciones el turno acaba solo, o pulsa <b>«Terminar turno»</b> antes.' },
  { key: 'hand', emo: 'explaining', title: 'Jugar una carta', pos: 'top',
    text: () => 'Estas son tus cartas, solo las ves tú. <b>Toca una</b> para verla en grande y pulsa <b>«Jugar»</b> (o haz doble clic). Si necesita objetivo, te pedirá que toques al jugador al que apuntas.' },
  { key: null, emo: 'explaining', title: 'Cinco tipos de cartas', pos: 'bottom', cards: ['huevo_fresco', 'zarpazo', 'trueque', 'nope', 'gallina_oro'],
    text: () => '<b>Estrategia</b> (amarillo): huevos y cartas. <b>Sabotaje</b> (naranja): fastidiar a los demás. <b>Manipulación</b> (celeste): cambiar cartas, turnos y reglas. <b>Defensa</b> (azul): protegerte. <b>Especial</b> (brillante): locuras que lo cambian todo.' },
  { key: 'seats', emo: 'laughing', title: 'Sabotaje', pos: 'bottom',
    text: () => 'Con los <b>Sabotajes</b> apuntas a otro jugador: robar huevos o cartas, romper nidos, hacerle perder el turno… Alrededor de la mesa están tus rivales con sus huevos y su número de cartas. Ojo: ellos también te apuntarán a ti.' },
  { key: 'play', emo: 'warning', title: 'Reacciones', pos: 'bottom', demo: 'reaction',
    text: () => 'Cuando alguien juega una carta se abre una <b>ventana de unos segundos</b> y ¡todos pueden reaccionar, aunque no sea su turno! Una carta de Defensa puede <b>cancelarla</b>, <b>devolverla</b> a su autor, <b>desviarla</b> o <b>protegerte</b>. Pulsa «Paso» si no quieres reaccionar.' },
  { key: 'play', emo: 'explaining', title: 'Cadenas y contraataques', pos: 'bottom', demo: 'reaction',
    text: () => 'Las reacciones se encadenan: un <b>¡Ni Hablar!</b> puede cancelarse con otro ¡Ni Hablar!. Cuando nadie más reacciona, se resuelve todo de la última carta a la primera. El <b>Sello Dorado</b> es la única cancelación que no se puede cancelar.' },
  { key: 'table', emo: 'surprised', title: 'Cartas que cambian la partida', pos: 'bottom',
    text: () => 'Algunas cartas Especiales crean <b>efectos globales</b> durante una ronda (Luna Llena, Veda de Caza, Fiesta en el Corral, Silencio de Gallinero). Los verás arriba, en la mesa, mientras duren. También hay alianzas… y traiciones.' },
  { key: 'goal', emo: 'victory', title: '¡Eso es todo!', pos: 'top', last: true,
    text: (c) => `Llena tu nido con <b>${c.target} huevos</b> antes que nadie. Roba, defiéndete y… ¡corre que te pío! Puedes repasar las reglas con el botón 📖 y volver a ver este tutorial desde el menú o los ajustes.` },
];

export function startTutorial({ table, context, onStep, onDone }) {
  let i = 0, spot, root, chickHost, resizeH;
  spot = document.createElement('div'); spot.id = 'spot';
  root = document.createElement('div'); root.id = 'tut';
  root.innerHTML = '<div class="tut-chick"></div><div class="tut-card" role="dialog" aria-live="polite"></div>';
  chickHost = root.querySelector('.tut-chick');
  document.body.append(spot, root);

  const union = els => {
    const rs = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
    if (!rs.length) return null;
    const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), rr = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
    return { left: l, top: t, width: rr - l, height: b - t };
  };
  function place(step) {
    let r = null;
    if (step.key === 'seats') r = union([...table.getEl('seats').children]);
    else if (step.key) { const e = table.getEl(step.key); if (e) r = union([e]); }
    if (r) {
      const pad = 10; Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px', opacity: 1 });
    } else Object.assign(spot.style, { left: '50%', top: '50%', width: '0px', height: '0px', opacity: 1 });
    spot.classList.toggle('none', !r);
    root.classList.toggle('top', step.pos === 'top');
  }
  function show() {
    const st = STEPS[i]; if (onStep) onStep(i, st);
    chickHost.innerHTML = chickSVG('e-' + st.emo); chickHost.firstElementChild.setAttribute('class', 'chick e-' + st.emo);
    const card = root.querySelector('.tut-card');
    card.innerHTML = `<h4>${esc(st.title)}</h4><p>${st.text(context())}</p><div class="cardlist"></div><div class="tut-foot"><button class="btn small" data-a="skip">Saltar</button><div class="dots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div style="display:flex;gap:6px"><button class="btn small" data-a="prev" ${i === 0 ? 'disabled' : ''}>Atrás</button><button class="btn small primary" data-a="next">${st.last ? '¡A jugar!' : 'Siguiente'}</button></div></div>`;
    const list = card.querySelector('.cardlist');
    if (st.cards) st.cards.forEach(id => list.appendChild(makeCard(id, { mini: true })));
    else list.remove();
    card.querySelectorAll('button').forEach(b => b.onclick = () => act(b.dataset.a));
    sfx('select'); requestAnimationFrame(() => place(st));
  }
  function act(a) {
    if (a === 'next') { if (i === STEPS.length - 1) return end(true); i++; show(); }
    else if (a === 'prev') { i = Math.max(0, i - 1); show(); }
    else end(false);
  }
  function end(completed) {
    window.removeEventListener('resize', resizeH); document.removeEventListener('keydown', keyH);
    spot.remove(); root.remove(); onDone(completed);
  }
  const keyH = e => { if (e.key === 'ArrowRight') act('next'); else if (e.key === 'ArrowLeft') act('prev'); else if (e.key === 'Escape') act('skip'); };
  resizeH = () => place(STEPS[i]);
  window.addEventListener('resize', resizeH); document.addEventListener('keydown', keyH);
  show();
  return { stop: () => end(false) };
}
