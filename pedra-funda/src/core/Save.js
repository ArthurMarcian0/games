// Registros de jogo (3 espaços) em localStorage.
const KEY = 'pedrafunda.save.';
const SLOTS = 3;

export class SaveManager {
  list() {
    const out = [];
    for (let i = 0; i < SLOTS; i++) {
      try {
        const raw = localStorage.getItem(KEY + i);
        out.push(raw ? JSON.parse(raw) : null);
      } catch {
        out.push(null);
      }
    }
    return out;
  }
  write(i, state) {
    const data = JSON.parse(JSON.stringify(state));
    data.date = Date.now();
    try {
      localStorage.setItem(KEY + i, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  read(i) {
    return this.list()[i];
  }
  newest() {
    let best = -1;
    let bt = -1;
    this.list().forEach((s, i) => {
      if (s && s.date > bt) {
        bt = s.date;
        best = i;
      }
    });
    return best;
  }
}
