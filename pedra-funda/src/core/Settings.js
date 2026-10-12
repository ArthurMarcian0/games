// Configurações persistentes do jogador.
const KEY = 'pedrafunda.settings.v1';

export const DEFAULTS = {
  master: 0.85,
  music: 0.6,
  sfx: 0.9,
  ambient: 0.85,
  sensitivity: 1,
  invertY: false,
  brightness: 1.12,
  quality: 'medium',
  fov: 68,
  subtitles: true,
  hints: true,
  shake: 1,
};

export class Settings {
  constructor() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      saved = {};
    }
    this.data = { ...DEFAULTS, ...saved };
    this.listeners = [];
  }
  get(k) {
    return this.data[k];
  }
  set(k, v) {
    this.data[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* armazenamento indisponível */
    }
    for (const fn of this.listeners) fn(k, v);
  }
  onChange(fn) {
    this.listeners.push(fn);
  }
}
