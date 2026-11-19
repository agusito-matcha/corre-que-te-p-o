// Efectos de sonido sintetizados con WebAudio: originales, sin archivos ni licencias.
import { settings } from './store.js';
let ctx = null, master = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  master.gain.value = settings.muted ? 0 : Math.pow(settings.volume, 1.6);
  return ctx;
}
export const unlock = () => { ensure(); };
export const refreshVolume = () => { if (master) master.gain.value = settings.muted ? 0 : Math.pow(settings.volume, 1.6); };

function tone({ f = 440, f2 = null, t = 0, d = .15, type = 'sine', v = .25, a = .006 }) {
  const c = ensure(); if (!c || settings.muted) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + .03);
}
function noise({ t = 0, d = .12, v = .2, hp = 600, lp = 7000 }) {
  const c = ensure(); if (!c || settings.muted) return;
  const len = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
  const g = c.createGain(); const t0 = c.currentTime + t; g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(h); h.connect(l); l.connect(g); g.connect(master); s.start(t0);
}
const arp = (notes, step = .09, o = {}) => notes.forEach((f, i) => tone(Object.assign({ f, t: i * step, d: .22, type: 'triangle', v: .22 }, o)));

const BANK = {
  select: () => tone({ f: 620, f2: 880, d: .07, type: 'triangle', v: .16 }),
  draw: () => { noise({ d: .09, v: .12, hp: 1800 }); tone({ f: 300, f2: 520, d: .08, type: 'sine', v: .1 }); },
  play: () => { noise({ d: .14, v: .16, hp: 900 }); tone({ f: 200, f2: 90, d: .16, type: 'sine', v: .3 }); },
  sabotage: () => { tone({ f: 520, f2: 130, d: .28, type: 'sawtooth', v: .14 }); noise({ d: .18, v: .12, hp: 1200 }); },
  defense: () => { tone({ f: 330, d: .1, type: 'square', v: .12 }); tone({ f: 660, t: .09, d: .22, type: 'triangle', v: .2 }); },
  manip: () => { tone({ f: 300, f2: 900, d: .3, type: 'sine', v: .18 }); tone({ f: 900, f2: 300, t: .22, d: .3, type: 'sine', v: .12 }); },
  strategy: () => arp([660, 880, 1320], .06, { d: .14, v: .14 }),
  special: () => { arp([523, 659, 784, 1047, 1319], .07, { v: .2 }); noise({ t: .3, d: .3, v: .06, hp: 4000 }); },
  nope: () => { tone({ f: 180, f2: 90, d: .3, type: 'square', v: .2 }); noise({ d: .12, v: .15 }); },
  steal: () => { tone({ f: 800, f2: 240, d: .35, type: 'triangle', v: .2 }); noise({ d: .2, v: .08, hp: 2500 }); },
  egg: () => arp([784, 988, 1319], .07, { d: .16, v: .2 }),
  eggLost: () => { tone({ f: 420, f2: 120, d: .4, type: 'sine', v: .26 }); noise({ t: .05, d: .15, v: .1 }); },
  shuffle: () => { for (let i = 0; i < 5; i++) noise({ t: i * .06, d: .06, v: .1, hp: 1500 }); },
  notify: () => { tone({ f: 880, d: .12, type: 'triangle', v: .22 }); tone({ f: 1175, t: .12, d: .2, type: 'triangle', v: .22 }); },
  tick: () => tone({ f: 1000, d: .04, type: 'square', v: .06 }),
  chick: () => { tone({ f: 1700, f2: 2500, d: .09, type: 'sine', v: .16 }); tone({ f: 1900, f2: 2700, t: .12, d: .09, type: 'sine', v: .16 }); },
  win: () => { arp([523, 659, 784, 1047, 784, 1047, 1319], .11, { v: .25 }); },
  lose: () => arp([440, 392, 349, 262], .16, { type: 'sine', v: .22, d: .35 }),
  chat: () => tone({ f: 1400, d: .05, type: 'sine', v: .1 }),
  coin: () => { tone({ f: 1500, d: .06, type: 'square', v: .1 }); tone({ f: 2000, t: .06, d: .3, type: 'sine', v: .12 }); },
};
export const sfx = (name) => { try { const f = BANK[name]; if (f) f(); } catch (_) { /* audio no disponible */ } };
