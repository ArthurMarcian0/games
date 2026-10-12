// Construtor de níveis: salas com paredes automáticas (com vãos de portas e
// janelas), primitivas com UV em escala de mundo e geometria estática mesclada
// por material (poucas draw calls).
import * as THREE from 'three';
import { getMaterial, tileOf, hasMaterial } from '../engine/materials.js';

const T = 0.15; // espessura de parede (por sala)
const DOOR_H = 2.25;

function scaleBoxUV(geo, w, h, d, tile, ox, oy, oz) {
  const uv = geo.attributes.uv;
  // ordem das faces do BoxGeometry: +x, -x, +y, -y, +z, -z
  const dims = [
    [d, h, oz, oy],
    [d, h, oz, oy],
    [w, d, ox, oz],
    [w, d, ox, oz],
    [w, h, ox, oy],
    [w, h, ox, oy],
  ];
  for (let f = 0; f < 6; f++) {
    const [du, dv, ou, ov] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * du + ou) / tile, (uv.getY(i) * dv + ov) / tile);
    }
  }
  uv.needsUpdate = true;
}

const tmpV = new THREE.Vector3();

export class LevelBuilder {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.collision = world.collision;
    this.batches = new Map();
    this.stack = [new THREE.Matrix4()];
    this.rooms = [];
    this.doorDefs = [];
    this.zones = [];
    this.mapShapes = [];
    this.spawns = {};
    this.meshes = [];
  }

  get m() {
    return this.stack[this.stack.length - 1];
  }
  push(x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.stack.push(this.m.clone().multiply(m));
  }
  pop() {
    this.stack.pop();
  }

  matOf(mat) {
    return typeof mat === 'string' ? getMaterial(mat) : mat;
  }

  // adiciona geometria com matriz local (relativa ao contexto atual)
  addGeo(geo, mat, local, opts = {}) {
    const world = this.m.clone().multiply(local);
    const material = this.matOf(mat);
    if (opts.batch === false || (material.transparent && opts.batch !== true)) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.applyMatrix4(world);
      mesh.castShadow = opts.cast ?? !material.transparent;
      mesh.receiveShadow = true;
      if (opts.renderOrder) mesh.renderOrder = opts.renderOrder;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    }
    const key = material.uuid;
    let b = this.batches.get(key);
    if (!b) this.batches.set(key, (b = { material, list: [], cast: opts.cast ?? true }));
    b.list.push({ geo, matrix: world });
    return null;
  }

  colliderFromLocal(local, w, h, d, top) {
    const world = this.m.clone().multiply(local);
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const sx of [-0.5, 0.5])
      for (const sy of [-0.5, 0.5])
        for (const sz of [-0.5, 0.5]) {
          tmpV.set(sx * w, sy * h, sz * d).applyMatrix4(world);
          minX = Math.min(minX, tmpV.x);
          maxX = Math.max(maxX, tmpV.x);
          minZ = Math.min(minZ, tmpV.z);
          maxZ = Math.max(maxZ, tmpV.z);
          minY = Math.min(minY, tmpV.y);
          maxY = Math.max(maxY, tmpV.y);
        }
    if (minY > 1.6) return null;
    return this.collision.add(minX, minZ, maxX, maxZ, top ?? maxY);
  }

  // caixa: (x, z) centro, y = base
  box(x, y, z, w, h, d, mat, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const tile = opts.tile || (typeof mat === 'string' && hasMaterial(mat) ? tileOf(mat) : 1);
    const wp = new THREE.Vector3(x, y, z).applyMatrix4(this.m);
    scaleBoxUV(geo, w, h, d, tile, opts.worldUV === false ? 0 : wp.x - w / 2, y, opts.worldUV === false ? 0 : wp.z - d / 2);
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0));
    local.compose(new THREE.Vector3(x, y + h / 2, z), q, new THREE.Vector3(1, 1, 1));
    const mesh = this.addGeo(geo, mat, local, opts);
    const collide = opts.collide ?? (h > 0.25 && y < 1.6);
    if (collide) {
      const c = this.colliderFromLocal(local, w, h, d, opts.top);
      if (c && opts.tag) c.tag = opts.tag;
    }
    return mesh;
  }

  cyl(x, y, z, r, h, mat, opts = {}) {
    const seg = opts.seg || 12;
    const geo = new THREE.CylinderGeometry(opts.rTop ?? r, r, h, seg, 1, !!opts.open);
    const tile = opts.tile || (typeof mat === 'string' && hasMaterial(mat) ? tileOf(mat) : 1);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * 2 * r) / tile, (uv.getY(i) * h) / tile);
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0));
    local.compose(new THREE.Vector3(x, y + (opts.center ? 0 : h / 2), z), q, new THREE.Vector3(1, 1, 1));
    const mesh = this.addGeo(geo, mat, local, opts);
    if (opts.collide ?? (h > 0.4 && !opts.rx && !opts.rz && y < 1.6)) {
      const wp = new THREE.Vector3(x, 0, z).applyMatrix4(this.m);
      const rr = opts.colR ?? r;
      this.collision.add(wp.x - rr, wp.z - rr, wp.x + rr, wp.z + rr, y + h);
    }
    return mesh;
  }

  sphere(x, y, z, r, mat, opts = {}) {
    const geo = opts.geo || new THREE.SphereGeometry(1, opts.seg || 12, opts.seg ? Math.ceil(opts.seg * 0.7) : 8);
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0));
    const s = opts.scale || [r, r, r];
    local.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s[0], s[1], s[2]));
    const mesh = this.addGeo(geo, mat, local, opts);
    if (opts.collide) {
      const wp = new THREE.Vector3(x, 0, z).applyMatrix4(this.m);
      this.collision.add(wp.x - s[0] * 0.8, wp.z - s[2] * 0.8, wp.x + s[0] * 0.8, wp.z + s[2] * 0.8, y + s[1]);
    }
    return mesh;
  }

  mesh(geo, mat, x, y, z, opts = {}) {
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0));
    const s = opts.scale || [1, 1, 1];
    local.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s[0], s[1], s[2]));
    return this.addGeo(geo, mat, local, opts);
  }

  // colisor invisível (coordenadas de mundo)
  wall(minX, minZ, maxX, maxZ, top = 3) {
    return this.collision.add(minX, minZ, maxX, maxZ, top);
  }

  floor(x0, z0, x1, z1, mat, y = 0) {
    this.box((x0 + x1) / 2, y - 0.1, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, mat, { collide: false });
  }

  // ------------------------------------------------------------- salas
  room(def) {
    const r = {
      h: 3,
      floor: 'concrete',
      wall: 'plaster',
      ceil: 'ceiling',
      indoor: true,
      map: true,
      ...def,
    };
    r.minX = r.x0;
    r.maxX = r.x1;
    r.minZ = r.z0;
    r.maxZ = r.z1;
    this.rooms.push(r);
    if (r.indoor || r.safe) this.zones.push(r);
    return r;
  }

  door(def) {
    const d = { w: 1.3, h: DOOR_H, kind: 'wood', ...def };
    this.doorDefs.push(d);
    return d;
  }

  zone(def) {
    const z = { indoor: true, ...def, minX: def.x0, maxX: def.x1, minZ: def.z0, maxZ: def.z1 };
    this.zones.push(z);
    return z;
  }

  shape(def) {
    this.mapShapes.push(def);
  }

  spawn(name, x, z, ry = 0) {
    this.spawns[name] = { x, z, ry };
  }

  buildRoomWalls(r) {
    const sides = {
      n: { horiz: true, line: r.z0, a: r.x0, b: r.x1, inward: 1 },
      s: { horiz: true, line: r.z1, a: r.x0, b: r.x1, inward: -1 },
      w: { horiz: false, line: r.x0, a: r.z0 + T, b: r.z1 - T, inward: 1 },
      e: { horiz: false, line: r.x1, a: r.z0 + T, b: r.z1 - T, inward: -1 },
    };
    const noWalls = r.noWalls || '';
    for (const [key, sd] of Object.entries(sides)) {
      if (noWalls.includes(key)) continue;
      const cuts = [];
      for (const d of this.doorDefs) {
        const along = sd.horiz ? d.x : d.z;
        const across = sd.horiz ? d.z : d.x;
        const axisOk = sd.horiz ? d.axis === 'x' : d.axis === 'z';
        if (!axisOk || Math.abs(across - sd.line) > 0.35) continue;
        if (along < sd.a - 0.01 || along > sd.b + 0.01) continue;
        cuts.push({ a: along - d.w / 2, b: along + d.w / 2, y0: 0, y1: d.h });
      }
      const open = (r.open && r.open[key]) || [];
      for (const [a, b] of open) cuts.push({ a, b, y0: 0, y1: 99 });
      for (const wdw of r.windows || []) if (wdw.side === key) cuts.push({ a: wdw.a, b: wdw.b, y0: wdw.y0 ?? 1, y1: wdw.y1 ?? 2.1, window: wdw });
      cuts.sort((p, q) => p.a - q.a);
      let cur = sd.a;
      const seg = (p, q, y0, y1) => {
        if (q - p < 0.01 || y1 - y0 < 0.01) return;
        this.wallPiece(r, sd, p, q, y0, y1);
      };
      for (const c of cuts) {
        seg(cur, Math.min(c.a, sd.b), 0, r.h);
        const ca = Math.max(c.a, sd.a);
        const cb = Math.min(c.b, sd.b);
        if (cb > ca) {
          if (c.y0 > 0) seg(ca, cb, 0, c.y0);
          if (c.y1 < r.h) seg(ca, cb, c.y1, r.h);
          if (c.window) this.windowFill(r, sd, ca, cb, c.y0, c.y1, c.window);
        }
        cur = Math.max(cur, c.b);
      }
      seg(cur, sd.b, 0, r.h);
    }
  }

  wallPiece(r, sd, p, q, y0, y1) {
    const len = q - p;
    const mid = (p + q) / 2;
    const off = sd.line + (sd.inward * T) / 2;
    const place = (ya, yb, mat) => {
      if (yb - ya < 0.01) return;
      if (sd.horiz) this.box(mid, ya, off, len, yb - ya, T, mat);
      else this.box(off, ya, mid, T, yb - ya, len, mat);
    };
    if (r.wainscot && y0 < r.wainscot.h) {
      const wh = Math.min(r.wainscot.h, y1);
      place(y0, wh, r.wainscot.mat);
      place(wh, y1, r.wall);
    } else place(y0, y1, r.wall);
    if (r.outer) {
      const o3 = sd.line - sd.inward * 0.05;
      const top = y1 >= r.h - 0.01 ? r.h + (r.parapet ?? 0.4) : y1;
      if (sd.horiz) this.box(mid, y0, o3, len, top - y0, 0.1, r.outer, { collide: false });
      else this.box(o3, y0, mid, 0.1, top - y0, len, r.outer, { collide: false });
    }
    if (r.trim && y0 === 0) {
      const o2 = sd.line + sd.inward * (T + 0.015);
      if (sd.horiz) this.box(mid, 0, o2, len, 0.12, 0.03, r.trim, { collide: false });
      else this.box(o2, 0, mid, 0.03, 0.12, len, r.trim, { collide: false });
    }
  }

  windowFill(r, sd, a, b, y0, y1, wdw) {
    const mid = (a + b) / 2;
    const len = b - a;
    const off = sd.line + (sd.inward * T) / 2;
    if (wdw.bars) {
      const n = Math.max(2, Math.round(len / 0.14));
      for (let i = 1; i < n; i++) {
        const p = a + (len * i) / n;
        if (sd.horiz) this.cyl(p, y0, off, 0.015, y1 - y0, 'metalDark', { collide: false, seg: 6 });
        else this.cyl(off, y0, p, 0.015, y1 - y0, 'metalDark', { collide: false, seg: 6 });
      }
    }
    if (wdw.glass) {
      if (sd.horiz) this.box(mid, y0, off, len, y1 - y0, 0.02, 'glass', { collide: false });
      else this.box(off, y0, mid, 0.02, y1 - y0, len, 'glass', { collide: false });
    }
    // parapeito
    if (sd.horiz) this.box(mid, y0 - 0.04, off, len, 0.04, T + 0.08, 'woodDark', { collide: false });
    else this.box(off, y0 - 0.04, mid, T + 0.08, 0.04, len, 'woodDark', { collide: false });
    // colisor completo da janela (não dá pra passar)
    if (sd.horiz) this.collision.add(a, sd.line + (sd.inward < 0 ? -T : 0), b, sd.line + (sd.inward < 0 ? 0 : T), r.h);
    else this.collision.add(sd.line + (sd.inward < 0 ? -T : 0), a, sd.line + (sd.inward < 0 ? 0 : T), b, r.h);
  }

  finalize() {
    for (const r of this.rooms) {
      if (r.floor) this.floor(r.x0, r.z0, r.x1, r.z1, r.floor);
      if (r.ceil) this.box((r.x0 + r.x1) / 2, r.h, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.12, r.z1 - r.z0, r.ceil, { collide: false });
      if (r.roof) this.box((r.x0 + r.x1) / 2, r.h + 0.12, (r.z0 + r.z1) / 2, r.x1 - r.x0 + 0.1, 0.15, r.z1 - r.z0 + 0.1, r.roof, { collide: false });
      if (!r.noAutoWalls) this.buildRoomWalls(r);
    }
    // mescla por material
    for (const b of this.batches.values()) {
      const merged = mergeList(b.list);
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.userData.static = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      for (const it of b.list) it.geo.dispose();
    }
    this.batches.clear();
  }
}

function mergeList(list) {
  let vCount = 0;
  let iCount = 0;
  for (const it of list) {
    vCount += it.geo.attributes.position.count;
    iCount += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0;
  let io = 0;
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  for (const it of list) {
    const g = it.geo;
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const U = g.attributes.uv;
    nm.getNormalMatrix(it.matrix);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(it.matrix);
      pos[(vo + i) * 3] = v.x;
      pos[(vo + i) * 3 + 1] = v.y;
      pos[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = v.x;
      nor[(vo + i) * 3 + 1] = v.y;
      nor[(vo + i) * 3 + 2] = v.z;
      if (U) {
        uv[(vo + i) * 2] = U.getX(i);
        uv[(vo + i) * 2 + 1] = U.getY(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < P.count; i++) idx[io + i] = vo + i;
      io += P.count;
    }
    vo += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}
