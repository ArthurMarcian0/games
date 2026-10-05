// Configurações persistentes do jogo (salvas no localStorage quando disponível).
const KEY = 'skyhoop.settings.v1';

export const DEFAULT_SETTINGS = {
  difficulty: 'normal',
  cameraMode: 'follow', // 'follow' (terceira pessoa) | 'broadcast' (transmissão)
  quality: 'medium', // 'low' | 'medium' | 'high'
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.85,
  crowdVolume: 0.6,
  quarterLength: 2, // minutos
  teamSize: 3,
  showHints: true,
  autoSwitch: true,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULT_SETTINGS };
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch (e) {
      /* armazenamento indisponível: usa padrões */
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch (e) {
      /* ignora */
    }
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    this.values[key] = value;
    this.save();
    for (const fn of this.listeners) fn(key, value);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
