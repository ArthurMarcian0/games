// Inventório limitado por espaços + baú compartilhado entre pontos seguros.
import { ITEMS, findRecipe, WEAPONS } from './Items.js';

export class Inventory {
  constructor(state) {
    this.state = state; // referência ao estado salvo
  }
  get slots() {
    return this.state.inv;
  }
  get size() {
    return this.state.invSize;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.qty;
    return n;
  }
  has(id, qty = 1) {
    return this.count(id) >= qty;
  }
  freeSlots() {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (!this.slots[i]) n++;
    return n;
  }

  // quantos cabem (considerando pilhas)
  canAdd(id, qty = 1) {
    const def = ITEMS[id];
    const stack = def.stack || 1;
    let room = 0;
    for (let i = 0; i < this.size; i++) {
      const s = this.slots[i];
      if (!s) room += stack;
      else if (s.id === id && stack > 1) room += stack - s.qty;
      if (room >= qty) return true;
    }
    return room >= qty;
  }

  add(id, qty = 1) {
    const def = ITEMS[id];
    if (!def) return 0;
    const stack = def.stack || 1;
    let left = qty;
    if (stack > 1) {
      for (let i = 0; i < this.size && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.qty < stack) {
          const k = Math.min(stack - s.qty, left);
          s.qty += k;
          left -= k;
        }
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const k = Math.min(stack, left);
        this.slots[i] = { id, qty: k };
        left -= k;
      }
    }
    return qty - left;
  }

  remove(id, qty = 1) {
    let left = qty;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const k = Math.min(s.qty, left);
        s.qty -= k;
        left -= k;
        if (s.qty <= 0) this.slots[i] = null;
      }
    }
    return qty - left;
  }

  removeAt(i, qty = 1) {
    const s = this.slots[i];
    if (!s) return;
    s.qty -= qty;
    if (s.qty <= 0) this.slots[i] = null;
  }

  combine(i, j) {
    const a = this.slots[i];
    const b = this.slots[j];
    if (!a || !b || i === j) return { ok: false, msg: 'Nada acontece.' };
    // munição na arma = recarregar (tratado pelo jogo)
    const r = findRecipe(a.id, b.id);
    if (!r) {
      if (a.id === b.id && (ITEMS[a.id].stack || 1) > 1) {
        // juntar pilhas
        const stack = ITEMS[a.id].stack;
        const k = Math.min(stack - b.qty, a.qty);
        if (k <= 0) return { ok: false, msg: 'Já está cheio.' };
        b.qty += k;
        a.qty -= k;
        if (a.qty <= 0) this.slots[i] = null;
        return { ok: true, msg: 'Itens agrupados.' };
      }
      return { ok: false, msg: 'Esses itens não combinam.' };
    }
    if (a.id === b.id && a.qty < 2 && (ITEMS[a.id].stack || 1) > 1) {
      // receita que usa 2 do mesmo item numa pilha só
    }
    this.removeAt(i, 1);
    // o índice j pode ter sido o mesmo item; recalcula
    if (this.slots[j] && this.slots[j].id === b.id) this.removeAt(j, 1);
    else this.remove(b.id, 1);
    const def = ITEMS[r.out];
    // coloca o resultado no espaço liberado (prioriza j)
    if (!this.slots[j]) this.slots[j] = { id: r.out, qty: r.qty };
    else if (!this.slots[i]) this.slots[i] = { id: r.out, qty: r.qty };
    else this.add(r.out, r.qty);
    return { ok: true, msg: `Você obteve: ${def.name}${r.qty > 1 ? ' ×' + r.qty : ''}.`, out: r.out };
  }

  // combinar duas unidades de uma mesma pilha (ex.: 2 pólvoras numa pilha)
  combineSelf(i) {
    const a = this.slots[i];
    if (!a || a.qty < 2) return null;
    const r = findRecipe(a.id, a.id);
    if (!r) return null;
    this.removeAt(i, 2);
    if (!this.slots[i]) this.slots[i] = { id: r.out, qty: r.qty };
    else this.add(r.out, r.qty);
    return { ok: true, msg: `Você obteve: ${ITEMS[r.out].name}${r.qty > 1 ? ' ×' + r.qty : ''}.`, out: r.out };
  }

  weapons() {
    const out = [];
    for (const s of this.slots) if (s && ITEMS[s.id].type === 'weapon') out.push(s.id);
    return out;
  }

  ammoFor(weapon) {
    const w = WEAPONS[weapon];
    return w && w.ammo ? this.count(w.ammo) : 0;
  }

  // baú
  storeFrom(i) {
    const s = this.slots[i];
    if (!s) return false;
    const st = this.state.storage;
    const def = ITEMS[s.id];
    const stack = def.stack || 1;
    let left = s.qty;
    if (stack > 1) {
      for (const e of st) {
        if (e.id === s.id && left > 0) {
          e.qty += left;
          left = 0;
        }
      }
    }
    if (left > 0) st.push({ id: s.id, qty: left });
    this.slots[i] = null;
    return true;
  }

  takeFromStorage(k) {
    const st = this.state.storage;
    const e = st[k];
    if (!e) return 0;
    const def = ITEMS[e.id];
    const stack = def.stack || 1;
    const want = Math.min(e.qty, stack * this.size);
    let moved = 0;
    // pega o quanto couber
    for (let n = want; n > 0; n--) {
      if (this.canAdd(e.id, n)) {
        moved = this.add(e.id, n);
        break;
      }
    }
    e.qty -= moved;
    if (e.qty <= 0) st.splice(k, 1);
    return moved;
  }
}
