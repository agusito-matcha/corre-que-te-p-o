// Pío, el pollito chibi: dibujo SVG + 10 emociones + frases contextuales en español.
let uid = 0;
export const EMOTIONS = ['idle', 'excited', 'surprised', 'confused', 'sad', 'celebrate', 'warning', 'laughing', 'explaining', 'victory'];

export function chickSVG(cls = '') {
  const k = 'c' + (++uid);
  return `<svg class="chick e-idle ${cls}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pío, el pollito">
<defs>
  <radialGradient id="${k}y" cx="42%" cy="30%" r="80%"><stop offset="0" stop-color="#fff08a"/><stop offset=".55" stop-color="#ffd23f"/><stop offset="1" stop-color="#f0b10f"/></radialGradient>
  <linearGradient id="${k}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84f"/><stop offset="1" stop-color="#eaa90c"/></linearGradient>
</defs>
<ellipse cx="100" cy="192" rx="56" ry="7" fill="#040b24" opacity=".28"/>
<g class="body-g">
  <g fill="#ff8a1f" stroke="#d96d0a" stroke-width="2.5" stroke-linejoin="round">
    <path d="M60 178 q4 -9 17 -7 q13 2 13 9 q-2 7 -14 7 q-14 0 -16 -9z"/><path d="M110 180 q0 -7 13 -9 q13 -2 17 7 q-2 9 -16 9 q-12 0 -14 -7z"/>
  </g>
  <ellipse cx="100" cy="134" rx="58" ry="50" fill="url(#${k}y)"/>
  <ellipse cx="100" cy="148" rx="33" ry="29" fill="#fff4b0" opacity=".85"/>
  <g class="wing-l"><ellipse cx="44" cy="136" rx="15" ry="27" transform="rotate(16 44 136)" fill="url(#${k}w)" stroke="#d99a08" stroke-width="2"/></g>
  <g class="wing-r"><ellipse cx="156" cy="136" rx="15" ry="27" transform="rotate(-16 156 136)" fill="url(#${k}w)" stroke="#d99a08" stroke-width="2"/></g>
  <circle cx="100" cy="84" r="54" fill="url(#${k}y)"/>
  <path d="M90 34 q-8 -16 4 -22 M101 31 q0 -18 11 -18 M111 35 q9 -12 18 -6" stroke="#f0b10f" stroke-width="7" fill="none" stroke-linecap="round"/>
  <ellipse cx="61" cy="101" rx="12" ry="7.5" fill="#ff7a4d" opacity=".5"/><ellipse cx="139" cy="101" rx="12" ry="7.5" fill="#ff7a4d" opacity=".5"/>

  <g class="blink on-eyes-open"><ellipse cx="76" cy="84" rx="9" ry="12.5" fill="#0a1640"/><ellipse cx="124" cy="84" rx="9" ry="12.5" fill="#0a1640"/>
    <circle cx="79.5" cy="78.5" r="3.6" fill="#fff"/><circle cx="127.5" cy="78.5" r="3.6" fill="#fff"/><circle cx="73" cy="90" r="1.9" fill="#fff"/><circle cx="121" cy="90" r="1.9" fill="#fff"/></g>
  <g class="on-eyes-happy" stroke="#0a1640" stroke-width="6" fill="none" stroke-linecap="round"><path d="M65 90 q11 -19 22 0"/><path d="M113 90 q11 -19 22 0"/></g>
  <g class="on-eyes-wide"><ellipse cx="75" cy="83" rx="13" ry="16" fill="#fff" stroke="#0a1640" stroke-width="3"/><ellipse cx="125" cy="83" rx="13" ry="16" fill="#fff" stroke="#0a1640" stroke-width="3"/>
    <circle cx="76" cy="84" r="7" fill="#0a1640"/><circle cx="124" cy="84" r="7" fill="#0a1640"/><circle cx="78.5" cy="81" r="2.6" fill="#fff"/><circle cx="126.5" cy="81" r="2.6" fill="#fff"/></g>
  <g class="on-eyes-sad"><ellipse cx="76" cy="88" rx="9.5" ry="12" fill="#0a1640"/><ellipse cx="124" cy="88" rx="9.5" ry="12" fill="#0a1640"/>
    <circle cx="79" cy="83" r="5" fill="#fff"/><circle cx="127" cy="83" r="5" fill="#fff"/><circle cx="73" cy="93" r="2.2" fill="#fff"/><circle cx="121" cy="93" r="2.2" fill="#fff"/></g>
  <g class="on-eyes-confused"><ellipse cx="76" cy="84" rx="9" ry="12.5" fill="#0a1640"/><circle cx="125" cy="86" r="6" fill="#0a1640"/><circle cx="79" cy="79" r="3.4" fill="#fff"/><circle cx="127" cy="84" r="2" fill="#fff"/>
    <path d="M62 66 q12 -10 26 -2" stroke="#0a1640" stroke-width="5" fill="none" stroke-linecap="round"/></g>
  <g class="on-brows-angry" stroke="#0a1640" stroke-width="6.5" stroke-linecap="round"><path d="M60 64 L91 77"/><path d="M140 64 L109 77"/></g>
  <g class="on-brows-sad" stroke="#0a1640" stroke-width="5" stroke-linecap="round" fill="none"><path d="M62 76 L90 64"/><path d="M138 76 L110 64"/></g>

  <path class="beak-closed" d="M85 97 Q100 88 115 97 Q100 117 85 97Z" fill="#ff8a1f" stroke="#d96d0a" stroke-width="2.5" stroke-linejoin="round"/>
  <g class="on-beak-open" stroke="#d96d0a" stroke-width="2.5" stroke-linejoin="round"><path d="M85 95 Q100 86 115 95 Q100 103 85 95Z" fill="#ff8a1f"/><path d="M89 99 Q100 121 111 99Z" fill="#7a2318"/><ellipse cx="100" cy="112" rx="6" ry="3.5" fill="#ff7a8a" stroke="none"/></g>
  <g class="on-tear"><path d="M58 98 q-8 13 0 18 q8 -5 0 -18z" fill="#7fd0ff" stroke="#3d9be0" stroke-width="1.5"/></g>
  <g class="on-lol"><path d="M56 96 q-8 11 0 16 q8 -5 0 -16z" fill="#7fd0ff"/><path d="M144 96 q-8 11 0 16 q8 -5 0 -16z" fill="#7fd0ff"/></g>
  <g class="on-sweat"><path d="M150 54 q-9 14 0 20 q9 -6 0 -20z" fill="#7fd0ff" stroke="#3d9be0" stroke-width="1.5"/></g>
  <g class="on-crown"><path d="M70 38 L76 8 L90 26 L100 2 L110 26 L124 8 L130 38 Z" fill="#ffd23f" stroke="#c99a12" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="12" r="4" fill="#ff5d73"/></g>
</g>
<g class="on-sparks" fill="#fff3b0" stroke="#e0a800" stroke-width="1.5">
  <path d="M26 52 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5z"/><path d="M168 36 l4 -11 l4 11 l11 4 l-11 4 l-4 11 l-4 -11 l-11 -4z"/><path d="M162 112 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3z"/>
</g>
<g class="on-conf"><rect x="22" y="20" width="9" height="14" rx="2" fill="#5ec3ff" transform="rotate(20 26 27)"/><rect x="170" y="24" width="9" height="14" rx="2" fill="#ff6b3d" transform="rotate(-25 174 31)"/><rect x="40" y="6" width="8" height="12" rx="2" fill="#fff" transform="rotate(40 44 12)"/><rect x="150" y="4" width="8" height="12" rx="2" fill="#2f6bff" transform="rotate(-10 154 10)"/><rect x="180" y="70" width="8" height="12" rx="2" fill="#ffd23f" transform="rotate(30 184 76)"/></g>
<text class="on-qmark" x="150" y="46" font-size="44" font-weight="900" fill="#fff" stroke="#0a1640" stroke-width="3" paint-order="stroke" font-family="ui-rounded,system-ui,sans-serif">?</text>
<text class="on-bang" x="152" y="48" font-size="48" font-weight="900" fill="#ff5d73" stroke="#0a1640" stroke-width="3" paint-order="stroke" font-family="ui-rounded,system-ui,sans-serif">!</text>
</svg>`;
}

/** Frases del pollito, por tipo de suceso. e = emoción que acompaña. */
export const LINES = {
  start: [{ t: '¡Corre, corre, que te pío!', e: 'excited' }, { t: '¡Pío, pío! Que empiece el follón.', e: 'excited' }],
  myTurn: [{ t: '¡Te toca! No me hagas esperar.', e: 'excited' }, { t: '¡Tu turno! Piensa bien... o no.', e: 'laughing' }, { t: '¡Corre que te pío! A por esos huevos.', e: 'warning' }],
  steal: [{ t: '¡Pero qué acaba de pasar!', e: 'surprised' }, { t: 'Uy... creo que alguien tiene problemas.', e: 'surprised' }, { t: '¡Eso es un robo con alas!', e: 'laughing' }],
  stolenFromMe: [{ t: '¡Ladrones! ¡Cacareo de alarma!', e: 'warning' }, { t: 'No te lo tomes a mal... ¡toma venganza!', e: 'warning' }],
  sabotage: [{ t: '¡Pío, pío! Aquí nadie está a salvo.', e: 'laughing' }, { t: 'Qué carita de inocente... y qué jugada más sucia.', e: 'laughing' }, { t: 'Yo no he visto nada.', e: 'confused' }],
  defense: [{ t: '¡Ni hablar! Portazo en toda la cresta.', e: 'excited' }, { t: '¡Eso ha sido una jugada maestra!', e: 'excited' }],
  power: [{ t: '¡Eso ha sido una jugada maestra!', e: 'excited' }, { t: '¡Madre mía, qué barbaridad!', e: 'surprised' }],
  fizzle: [{ t: 'No me mires a mí, yo no he sido.', e: 'confused' }, { t: 'Pues eso no ha servido de mucho, ¿no?', e: 'laughing' }],
  egg: [{ t: '¡Qué huevo más bonito!', e: 'excited' }, { t: '¡Huevo a la vista!', e: 'excited' }],
  eggLost: [{ t: 'Pobre huevito... se ha ido a la sartén.', e: 'sad' }, { t: 'Eso va a doler en el nido.', e: 'sad' }],
  mod: [{ t: '¡Esto cambia las reglas del corral!', e: 'surprised' }],
  betrayal: [{ t: '¡Traición! Qué feo, qué feo...', e: 'surprised' }],
  skip: [{ t: 'Uy, a este le toca mirar.', e: 'laughing' }],
  win: [{ t: '¡Campeón del corral! ¡Pío, pío, pío!', e: 'victory' }],
  lose: [{ t: 'Otra vez será... ¡la próxima te pillo yo!', e: 'sad' }],
  react: [{ t: '¡Reacciona rápido, que se te escapa!', e: 'warning' }],
  chaos: [{ t: '¡Y ahora, el caos!', e: 'excited' }],
};

export const mascot = {
  host: null, svg: null, bubble: null, tm: 0, bt: 0, lastAt: 0, lastPrio: 0, enabled: true,
  mount(el) {
    this.host = el; el.innerHTML = chickSVG(); this.svg = el.querySelector('svg');
    this.bubble = document.createElement('div'); this.bubble.className = 'bubble hidden'; el.appendChild(this.bubble);
  },
  emote(name, ms = 1800) {
    if (!this.svg) return;
    this.svg.setAttribute('class', `chick e-${name}`);
    clearTimeout(this.tm);
    if (name !== 'idle' && ms) this.tm = setTimeout(() => this.svg && this.svg.setAttribute('class', 'chick e-idle'), ms);
  },
  say(text, emotion = 'idle', { ms = 3800, prio = 1, sticky = false } = {}) {
    if (!this.host || !this.enabled) return;
    const now = Date.now();
    if (!sticky && prio < this.lastPrio && now - this.lastAt < 1800) return;
    if (!sticky && now - this.lastAt < 900 && prio <= this.lastPrio) return;
    this.lastAt = now; this.lastPrio = prio;
    this.emote(emotion, sticky ? 0 : Math.min(ms, 2600));
    this.bubble.textContent = text; this.bubble.classList.remove('hidden', 'out');
    this.bubble.style.animation = 'none'; void this.bubble.offsetWidth; this.bubble.style.animation = '';
    clearTimeout(this.bt);
    if (!sticky) this.bt = setTimeout(() => this.hide(), ms);
  },
  quip(kind, opts = {}) {
    const arr = LINES[kind]; if (!arr) return;
    const l = arr[Math.floor(Math.random() * arr.length)];
    this.say(l.t, l.e, opts);
  },
  hide() {
    if (!this.bubble) return;
    this.bubble.classList.add('out'); this.lastPrio = 0;
    setTimeout(() => this.bubble && this.bubble.classList.add('hidden'), 240);
    if (this.svg) this.svg.setAttribute('class', 'chick e-idle');
  },
  setEnabled(v) { this.enabled = v; if (!v) { this.hide(); } },
};
