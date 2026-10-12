// Colisão 2D (plano XZ) com caixas alinhadas aos eixos + grade de navegação com A*.
const CELL = 4;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
  }

  add(minX, minZ, maxX, maxZ, top = 3, tag = null) {
    const b = { minX, minZ, maxX, maxZ, top, tag, enabled: true, id: this.boxes.length };
    this.boxes.push(b);
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = x * 73856093 + z * 19349663;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(b);
      }
    }
    return b;
  }

  query(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    this._stamp = (this._stamp || 0) + 1;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const arr = this.grid.get(x * 73856093 + z * 19349663);
        if (!arr) continue;
        for (const b of arr) {
          if (b._s === this._stamp || !b.enabled) continue;
          b._s = this._stamp;
          out.push(b);
        }
      }
    }
    return out;
  }

  // empurra um círculo para fora das caixas. pos = {x, z}
  resolveCircle(pos, r, minTop = 0.35) {
    const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this._tmp || (this._tmp = []));
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of list) {
        if (b.top < minTop) continue;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (r - d);
          pos.z += (dz / d) * (r - d);
        } else {
          // centro dentro da caixa: sai pelo lado mais próximo
          const l = pos.x - b.minX;
          const rr = b.maxX - pos.x;
          const t = pos.z - b.minZ;
          const bt = b.maxZ - pos.z;
          const m = Math.min(l, rr, t, bt);
          if (m === l) pos.x = b.minX - r;
          else if (m === rr) pos.x = b.maxX + r;
          else if (m === t) pos.z = b.minZ - r;
          else pos.z = b.maxZ + r;
        }
        moved = true;
        hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  blocked(x, z, r) {
    const list = this.query(x - r, z - r, x + r, z + r, this._tmp2 || (this._tmp2 = []));
    for (const b of list) {
      if (b.top < 0.35) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }

  // primeiro impacto ao longo de um segmento; y0/y1 = alturas inicial/final
  segment(x0, z0, x1, z1, y0 = 1.2, y1 = 1.2, minTop = 0.35) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const list = this.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), this._tmp3 || (this._tmp3 = []));
    let best = 1;
    let hitBox = null;
    for (const b of list) {
      if (b.top < minTop) continue;
      let tmin = 0;
      let tmax = best;
      if (Math.abs(dx) < 1e-9) {
        if (x0 < b.minX || x0 > b.maxX) continue;
      } else {
        let ta = (b.minX - x0) / dx;
        let tb = (b.maxX - x0) / dx;
        if (ta > tb) [ta, tb] = [tb, ta];
        tmin = Math.max(tmin, ta);
        tmax = Math.min(tmax, tb);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-9) {
        if (z0 < b.minZ || z0 > b.maxZ) continue;
      } else {
        let ta = (b.minZ - z0) / dz;
        let tb = (b.maxZ - z0) / dz;
        if (ta > tb) [ta, tb] = [tb, ta];
        tmin = Math.max(tmin, ta);
        tmax = Math.min(tmax, tb);
        if (tmin > tmax) continue;
      }
      const y = y0 + (y1 - y0) * tmin;
      if (y > b.top) continue;
      if (tmin < best) {
        best = tmin;
        hitBox = b;
      }
    }
    return { t: best, box: hitBox };
  }
}

// ---------------------------------------------------------------------------
export class NavGrid {
  constructor(minX, minZ, maxX, maxZ, cell = 0.5) {
    this.minX = minX;
    this.minZ = minZ;
    this.cell = cell;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n); // 1 = parede, 2 = porta fechada, 3 = zona proibida (área segura)
    this.doorAt = new Int16Array(n).fill(-1);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.visit = new Uint32Array(n);
    this.closedV = new Uint32Array(n);
    this.stamp = 1;
    this.heap = new Int32Array(n);
    this.f = new Float32Array(n);
  }

  idx(x, z) {
    const cx = Math.floor((x - this.minX) / this.cell);
    const cz = Math.floor((z - this.minZ) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return -1;
    return cz * this.w + cx;
  }
  cx(i) {
    return this.minX + ((i % this.w) + 0.5) * this.cell;
  }
  cz(i) {
    return this.minZ + (Math.floor(i / this.w) + 0.5) * this.cell;
  }

  markRect(minX, minZ, maxX, maxZ, value, pad = 0) {
    const c = this.cell;
    const x0 = Math.max(0, Math.floor((minX - pad - this.minX) / c));
    const x1 = Math.min(this.w - 1, Math.floor((maxX + pad - this.minX) / c));
    const z0 = Math.max(0, Math.floor((minZ - pad - this.minZ) / c));
    const z1 = Math.min(this.h - 1, Math.floor((maxZ + pad - this.minZ) / c));
    const out = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push(z * this.w + x);
    for (const i of out) {
      if (value === 0) this.blocked[i] = 0;
      else if (value === 1) this.blocked[i] = 1;
      else if (this.blocked[i] !== 1) this.blocked[i] = value;
    }
    return out;
  }

  build(collision, pad = 0.32) {
    this.blocked.fill(0);
    for (const b of collision.boxes) {
      if (!b.enabled || b.top < 0.35 || b.tag === 'door') continue;
      this.markRect(b.minX, b.minZ, b.maxX, b.maxZ, 1, pad);
    }
  }

  setDoor(id, rect, closed, pad = 0.32) {
    const cells = this.markRect(rect.minX, rect.minZ, rect.maxX, rect.maxZ, closed ? 2 : 0, pad * 0.5);
    for (const i of cells) {
      if (this.blocked[i] === 1) continue;
      this.doorAt[i] = closed ? id : -1;
      if (!closed && this.blocked[i] === 2) this.blocked[i] = 0;
    }
  }

  passable(i, opts) {
    const b = this.blocked[i];
    if (b === 0) return true;
    if (b === 2) return !!opts.doors;
    if (b === 3) return !!opts.ignoreSafe;
    return false;
  }

  // linha de visão entre dois pontos (amostragem)
  los(x0, z0, x1, z1, opts = {}) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const i = this.idx(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (i < 0 || !this.passable(i, opts)) return false;
    }
    return true;
  }

  nearestFree(x, z, opts = {}) {
    const i0 = this.idx(x, z);
    if (i0 >= 0 && this.passable(i0, opts)) return i0;
    const cx = Math.floor((x - this.minX) / this.cell);
    const cz = Math.floor((z - this.minZ) / this.cell);
    for (let r = 1; r < 8; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const xx = cx + dx;
          const zz = cz + dz;
          if (xx < 0 || zz < 0 || xx >= this.w || zz >= this.h) continue;
          const i = zz * this.w + xx;
          if (this.passable(i, opts)) return i;
        }
      }
    }
    return -1;
  }

  // A* com 8 vizinhos; retorna lista de pontos {x, z} suavizada
  findPath(sx, sz, tx, tz, opts = {}) {
    const start = this.nearestFree(sx, sz, opts);
    const goal = this.nearestFree(tx, tz, opts);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [{ x: tx, z: tz }];
    const st = ++this.stamp;
    const W = this.w;
    const gx = goal % W;
    const gz = Math.floor(goal / W);
    const heap = this.heap;
    let hn = 0;
    const push = (i) => {
      let k = hn++;
      heap[k] = i;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (this.f[heap[p]] <= this.f[heap[k]]) break;
        const t = heap[p];
        heap[p] = heap[k];
        heap[k] = t;
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      heap[0] = heap[--hn];
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < hn && this.f[heap[l]] < this.f[heap[m]]) m = l;
        if (r < hn && this.f[heap[r]] < this.f[heap[m]]) m = r;
        if (m === k) break;
        const t = heap[m];
        heap[m] = heap[k];
        heap[k] = t;
        k = m;
      }
      return top;
    };
    const hfun = (i) => {
      const dx = Math.abs((i % W) - gx);
      const dz = Math.abs(Math.floor(i / W) - gz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    this.g[start] = 0;
    this.f[start] = hfun(start);
    this.visit[start] = st;
    this.came[start] = -1;
    push(start);
    const maxIter = opts.maxIter || 9000;
    let iter = 0;
    let found = false;
    let bestI = start;
    let bestH = Infinity;
    while (hn > 0 && iter++ < maxIter) {
      const cur = pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (this.closedV[cur] === st) continue;
      this.closedV[cur] = st;
      const h = hfun(cur);
      if (h < bestH) {
        bestH = h;
        bestI = cur;
      }
      const cx = cur % W;
      const cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
          const ni = nz * W + nx;
          if (!this.passable(ni, opts)) continue;
          if (dx && dz) {
            // sem cortar quinas
            if (!this.passable(cz * W + nx, opts) || !this.passable(nz * W + cx, opts)) continue;
          }
          let cost = dx && dz ? 1.414 : 1;
          if (this.blocked[ni] === 2) cost += 3;
          const ng = this.g[cur] + cost;
          if (this.visit[ni] !== st || ng < this.g[ni]) {
            this.visit[ni] = st;
            this.g[ni] = ng;
            this.came[ni] = cur;
            this.f[ni] = ng + hfun(ni);
            push(ni);
          }
        }
      }
    }
    let end = found ? goal : bestI;
    const cells = [];
    for (let c = end; c !== -1 && cells.length < 2000; c = this.came[c]) cells.push(c);
    cells.reverse();
    // suavização por linha de visão
    const pts = cells.map((c) => ({ x: this.cx(c), z: this.cz(c) }));
    if (found) pts[pts.length - 1] = { x: tx, z: tz };
    const out = [];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.los(pts[a].x, pts[a].z, pts[b].x, pts[b].z, opts)) b--;
      out.push(pts[b]);
      a = b;
    }
    return out.length ? out : null;
  }
}
