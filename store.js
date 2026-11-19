// Preferencias y datos locales del navegador (nada se envía a ningún servidor externo).
const K = 'cqtp.';
export const store = {
  get(k, d) { try { const v = localStorage.getItem(K + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (_) { /* modo privado */ } },
  del(k) { try { localStorage.removeItem(K + k); } catch (_) { /* nada */ } },
};

export const settings = Object.assign({ volume: 0.7, muted: false, reducedMotion: null, mascot: true }, store.get('settings', {}));
export const saveSettings = () => { store.set('settings', settings); applySettings(); };
export const motionOff = () => settings.reducedMotion === null
  ? !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) : !!settings.reducedMotion;
export function applySettings() { document.documentElement.dataset.rm = motionOff() ? '1' : '0'; }
