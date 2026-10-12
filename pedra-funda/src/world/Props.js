// Catálogo de objetos de cenário montados com primitivas.
import * as THREE from 'three';
import { emissive, basic, glowMat } from '../engine/materials.js';
import { signTex, drawnTex } from '../engine/textures.js';
import { mulberry32 } from '../core/utils.js';

const rng = mulberry32(4242);
const R = () => rng();

export function desk(L, x, z, ry = 0, opts = {}) {
  L.push(x, 0, z, ry);
  const w = opts.w || 1.5;
  const mat = opts.mat || 'woodDark';
  L.box(0, 0.73, 0, w, 0.05, 0.75, mat, { collide: false });
  L.box(-w / 2 + 0.05, 0, 0, 0.06, 0.73, 0.7, mat, { collide: false });
  L.box(w / 2 - 0.25, 0, 0, 0.45, 0.73, 0.7, mat, { collide: false });
  L.box(0, 0.3, -0.33, w - 0.1, 0.4, 0.03, mat, { collide: false });
  for (let i = 0; i < 3; i++) L.box(w / 2 - 0.25, 0.08 + i * 0.22, 0.355, 0.4, 0.18, 0.01, 'wood', { collide: false });
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.39, 0), w, 0.78, 0.75);
  L.pop();
}

export function deskClutter(L, x, z, ry = 0) {
  L.push(x, 0.78, z, ry);
  L.box(-0.3, 0, 0.05, 0.3, 0.02, 0.22, 'paper', { collide: false, batch: true });
  L.box(0.25, 0, -0.1, 0.12, 0.1, 0.12, 'plasticDark', { collide: false });
  L.box(-0.1, 0, -0.15, 0.4, 0.25, 0.3, 'plastic', { collide: false });
  L.cyl(0.45, 0, 0.15, 0.04, 0.1, 'paintWhite', { collide: false, seg: 8 });
  L.pop();
}

export function chair(L, x, z, ry = 0, mat = 'woodDark') {
  L.push(x, 0, z, ry);
  L.box(0, 0.42, 0, 0.45, 0.05, 0.45, mat, { collide: false });
  L.box(0, 0.47, -0.2, 0.45, 0.5, 0.04, mat, { collide: false });
  for (const sx of [-0.19, 0.19]) for (const sz of [-0.19, 0.19]) L.box(sx, 0, sz, 0.04, 0.42, 0.04, mat, { collide: false });
  L.pop();
}

export function table(L, x, z, ry = 0, w = 1.2, d = 0.8, mat = 'wood', h = 0.76) {
  L.push(x, 0, z, ry);
  L.box(0, h - 0.04, 0, w, 0.04, d, mat, { collide: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.06, h - 0.04, 0.06, mat, { collide: false });
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, h / 2, 0), w, h, d);
  L.pop();
}

export function shelf(L, x, z, ry = 0, w = 1.2, h = 2, opts = {}) {
  L.push(x, 0, z, ry);
  const mat = opts.mat || 'wood';
  const d = opts.d || 0.4;
  L.box(-w / 2, 0, 0, 0.04, h, d, mat, { collide: false });
  L.box(w / 2, 0, 0, 0.04, h, d, mat, { collide: false });
  L.box(0, 0, -d / 2 + 0.01, w, h, 0.02, mat, { collide: false });
  const n = Math.round(h / 0.45);
  const bookMats = ['fabricRed', 'paintBlue', 'fabricGreen', 'woodDark', 'paintWhite', 'fabric'];
  for (let i = 0; i <= n; i++) {
    const y = (i * h) / n;
    L.box(0, Math.min(y, h - 0.03), 0, w, 0.03, d, mat, { collide: false });
    if (i < n && opts.books !== false) {
      let bx = -w / 2 + 0.05;
      while (bx < w / 2 - 0.1) {
        const bw = 0.03 + R() * 0.05;
        if (R() < 0.82) {
          const bh = 0.18 + R() * 0.15;
          const mat2 = opts.boxes ? 'concreteDark' : bookMats[Math.floor(R() * bookMats.length)];
          L.box(bx + bw / 2, y + 0.03, 0.02, bw, bh, d * 0.75, mat2, { collide: false, rz: R() < 0.1 ? 0.2 : 0 });
        }
        bx += bw + 0.005;
      }
    }
  }
  L.pop();
  L.push(x, 0, z, ry);
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, h / 2, 0), w, h, d);
  L.pop();
}

export function filingCabinet(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 0.5, 1.32, 0.6, 'metalPaint');
  for (let i = 0; i < 4; i++) {
    L.box(0, 0.08 + i * 0.31, 0.305, 0.44, 0.27, 0.01, 'metalDark', { collide: false });
    L.box(0, 0.25 + i * 0.31, 0.32, 0.12, 0.02, 0.03, 'chrome', { collide: false });
  }
  L.pop();
}

export function locker(L, x, z, ry = 0, n = 3, mat = 'metalPaint') {
  L.push(x, 0, z, ry);
  for (let i = 0; i < n; i++) {
    const lx = (i - (n - 1) / 2) * 0.42;
    L.box(lx, 0, 0, 0.4, 1.9, 0.5, mat, { collide: false });
    for (let k = 0; k < 4; k++) L.box(lx, 1.5 + k * 0.05, 0.255, 0.25, 0.015, 0.01, 'black', { collide: false });
    L.box(lx + 0.14, 0.95, 0.26, 0.03, 0.1, 0.02, 'chrome', { collide: false });
  }
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.95, 0), n * 0.42, 1.9, 0.5);
  L.pop();
}

export function bed(L, x, z, ry = 0, opts = {}) {
  L.push(x, 0, z, ry);
  const frame = opts.frame || 'chrome';
  for (const sx of [-0.45, 0.45]) {
    L.box(sx, 0, -0.95, 0.04, 0.9, 0.04, frame, { collide: false });
    L.box(sx, 0, 0.95, 0.04, 0.7, 0.04, frame, { collide: false });
  }
  L.box(0, 0.42, 0, 0.94, 0.06, 1.95, frame, { collide: false });
  L.box(0, 0.6, -0.95, 0.94, 0.3, 0.03, frame, { collide: false });
  L.box(0, 0.48, 0, 0.88, 0.14, 1.88, opts.mattress || 'mattress', { collide: false });
  L.box(0, 0.62, -0.72, 0.6, 0.1, 0.35, 'fabricWhite', { collide: false });
  if (opts.sheet !== false) L.box(0.02, 0.62, 0.3, 0.9, 0.04, 1.1, opts.sheetMat || 'fabricWhite', { collide: false, rz: 0.02 });
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.4, 0), 0.95, 0.8, 1.95);
  L.pop();
}

export function gurney(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0.8, 0, 0.6, 0.06, 1.8, 'chrome', { collide: false });
  L.box(0, 0.86, 0, 0.56, 0.06, 1.7, 'fabricWhite', { collide: false });
  for (const sx of [-0.25, 0.25]) for (const sz of [-0.8, 0.8]) {
    L.box(sx, 0.1, sz, 0.03, 0.7, 0.03, 'chrome', { collide: false });
    L.cyl(sx, 0, sz, 0.05, 0.05, 'rubber', { collide: false, rz: Math.PI / 2, seg: 8, center: false });
  }
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.45, 0), 0.6, 0.9, 1.8);
  L.pop();
}

export function counter(L, x, z, w, d, ry = 0, mat = 'woodDark', top = 'wood') {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, w, 1.0, d, mat);
  L.box(0, 1.0, 0, w + 0.06, 0.05, d + 0.06, top, { collide: false });
  L.pop();
}

export function sofa(L, x, z, ry = 0, mat = 'fabricRed') {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 1.9, 0.42, 0.85, mat);
  L.box(0, 0.42, -0.32, 1.9, 0.5, 0.22, mat, { collide: false });
  L.box(-0.88, 0.42, 0, 0.16, 0.25, 0.85, mat, { collide: false });
  L.box(0.88, 0.42, 0, 0.16, 0.25, 0.85, mat, { collide: false });
  L.pop();
}

export function tv(L, x, y, z, ry = 0, on = false) {
  L.push(x, y, z, ry);
  L.box(0, 0, 0, 0.6, 0.45, 0.45, 'plasticDark');
  const scr = on ? emissive(0x6c8aa0, 0.6) : 'glassDark';
  L.box(0, 0.06, 0.226, 0.48, 0.34, 0.01, scr, { collide: false, batch: false });
  L.pop();
}

export function crate(L, x, z, s = 0.8, ry = 0, y = 0) {
  L.push(x, y, z, ry);
  L.box(0, 0, 0, s, s, s, 'oldwood');
  L.pop();
}

export function barrel(L, x, z, mat = 'rust', y = 0) {
  L.cyl(x, y, z, 0.3, 0.9, mat, { seg: 14 });
  L.cyl(x, y + 0.2, z, 0.31, 0.04, 'metalDark', { collide: false, seg: 14 });
  L.cyl(x, y + 0.65, z, 0.31, 0.04, 'metalDark', { collide: false, seg: 14 });
}

export function dumpster(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0.15, 0, 1.9, 1.1, 1.1, 'metalPaint');
  L.box(0, 1.25, -0.05, 1.95, 0.06, 1.2, 'metalDark', { collide: false, rx: -0.15 });
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.45, 0.45]) L.cyl(sx, 0, sz, 0.07, 0.15, 'rubber', { collide: false, seg: 8 });
  L.pop();
}

export function trashBags(L, x, z, n = 3) {
  for (let i = 0; i < n; i++) {
    const s = 0.25 + R() * 0.15;
    L.sphere(x + (R() - 0.5) * 0.9, s * 0.7, z + (R() - 0.5) * 0.9, s, 'plasticDark', { scale: [s, s * 0.8, s] });
  }
}

export function bench(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  for (let i = 0; i < 3; i++) L.box(0, 0.45, -0.15 + i * 0.15, 1.6, 0.04, 0.12, 'oldwood', { collide: false });
  for (let i = 0; i < 2; i++) L.box(0, 0.6 + i * 0.16, -0.3, 1.6, 0.1, 0.03, 'oldwood', { collide: false, rx: -0.15 });
  for (const sx of [-0.7, 0.7]) L.box(sx, 0, 0, 0.06, 0.45, 0.4, 'metalDark', { collide: false });
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.4, 0), 1.6, 0.8, 0.5);
  L.pop();
}

// carro genérico; retorna posições dos faróis em coordenadas locais
export function car(L, x, z, ry = 0, opts = {}) {
  const paint = opts.paint || 'paintBlue';
  L.push(x, 0, z, ry);
  L.box(0, 0.32, 0, 1.75, 0.6, 4.3, paint);
  L.box(0, 0.92, -0.25, 1.6, 0.55, 2.2, paint, { collide: false });
  // vidros
  L.box(0, 0.95, 0.86, 1.5, 0.45, 0.05, 'glassDark', { collide: false, rx: -0.5 });
  L.box(0, 0.95, -1.37, 1.5, 0.42, 0.05, 'glassDark', { collide: false, rx: 0.5 });
  L.box(0.81, 0.97, -0.25, 0.02, 0.4, 2.0, 'glassDark', { collide: false });
  L.box(-0.81, 0.97, -0.25, 0.02, 0.4, 2.0, 'glassDark', { collide: false });
  // rodas
  for (const sx of [-0.82, 0.82]) for (const sz of [-1.35, 1.35]) L.cyl(sx, 0.33, sz, 0.33, 0.22, 'rubber', { collide: false, rz: Math.PI / 2, center: true });
  // para-choques
  L.box(0, 0.25, 2.17, 1.8, 0.2, 0.1, 'chrome', { collide: false });
  L.box(0, 0.25, -2.17, 1.8, 0.2, 0.1, 'chrome', { collide: false });
  // faróis
  const hl = opts.lightsOn ? emissive(0xfff0c8, 3) : 'chrome';
  for (const sx of [-0.6, 0.6]) L.box(sx, 0.55, 2.16, 0.32, 0.14, 0.04, hl, { collide: false, batch: false });
  const tl = opts.lightsOn ? emissive(0xff2010, 2) : 'paintRed';
  for (const sx of [-0.65, 0.65]) L.box(sx, 0.6, -2.16, 0.3, 0.12, 0.04, tl, { collide: false, batch: false });
  if (opts.police) {
    L.box(0, 1.2, -0.3, 1.0, 0.12, 0.3, 'plasticDark', { collide: false });
    L.box(-0.3, 1.21, -0.3, 0.35, 0.1, 0.25, emissive(0x2040ff, opts.sirenOn ? 2 : 0.15), { collide: false, batch: false });
    L.box(0.3, 1.21, -0.3, 0.35, 0.1, 0.25, emissive(0xff2020, opts.sirenOn ? 2 : 0.15), { collide: false, batch: false });
    L.box(0.88, 0.45, 0, 0.01, 0.25, 1.8, 'paintWhite', { collide: false });
    L.box(-0.88, 0.45, 0, 0.01, 0.25, 1.8, 'paintWhite', { collide: false });
  }
  if (opts.doorOpen) L.box(1.2, 0.3, 0.6, 0.06, 0.9, 1.1, paint, { collide: false, ry: 0.7 });
  L.pop();
}

export function truck(L, x, z, ry = 0, opts = {}) {
  L.push(x, 0, z, ry);
  L.box(0, 0.5, 2.4, 2.2, 1.6, 1.8, opts.cab || 'paintWhite');
  L.box(0, 1.5, 3.0, 2.0, 0.6, 0.05, 'glassDark', { collide: false, rx: -0.2 });
  L.box(0, 0.6, -1.1, 2.4, 2.4, 5.0, opts.box || 'metal');
  for (const sx of [-1.05, 1.05]) for (const sz of [-2.6, -1.4, 2.6]) L.cyl(sx, 0.45, sz, 0.45, 0.3, 'rubber', { collide: false, rz: Math.PI / 2, center: true });
  if (opts.logo) {
    const t = signTex(opts.logo, { bg: '#d8d8d4', fg: '#1a3a5a', w: 512, h: 160, border: false });
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.95), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
      L.addGeo(m.geometry, m.material, new THREE.Matrix4().makeRotationY((sx * Math.PI) / 2).setPosition(sx * 1.21, 1.9, -1.1), { batch: false });
    }
  }
  if (opts.open) L.box(0.6, 0.6, -3.7, 1.2, 2.3, 0.05, opts.box || 'metal', { collide: false, ry: -1.2 });
  L.pop();
}

export function lampPost(L, x, z, ry = 0, opts = {}) {
  L.push(x, 0, z, ry);
  L.cyl(0, 0, 0, 0.09, 5.6, 'metalDark', { seg: 8, colR: 0.12 });
  L.box(0, 5.4, 0.6, 0.08, 0.08, 1.3, 'metalDark', { collide: false });
  L.box(0, 5.25, 1.15, 0.35, 0.16, 0.5, 'metalDark', { collide: false });
  L.box(0, 5.22, 1.15, 0.28, 0.02, 0.42, opts.on ? emissive(opts.color || 0xffc98a, opts.intensity || 4) : 'glassDark', { collide: false, batch: false });
  L.pop();
  // posição de mundo da lâmpada
  const p = new THREE.Vector3(0, 5.1, 1.15).applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z));
  return p;
}

export function fence(L, x0, z0, x1, z1, h = 2.2, opts = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(x1 - x0, z1 - z0);
  L.push(x0, 0, z0, ang);
  const n = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= n; i++) L.cyl(0, 0, (len * i) / n, 0.04, h, 'metalDark', { seg: 6, collide: false });
  L.box(0, h - 0.05, len / 2, 0.04, 0.04, len, 'metalDark', { collide: false });
  L.box(0, 0.1, len / 2, 0.04, 0.04, len, 'metalDark', { collide: false });
  // tela
  L.box(0, 0.1, len / 2, 0.01, h - 0.15, len, fenceMat(), { collide: false, batch: true, worldUV: false });
  if (opts.barbed) for (let i = 0; i < 3; i++) L.box(0.08 + i * 0.05, h + 0.1 + i * 0.1, len / 2, 0.01, 0.01, len, 'metalDark', { collide: false });
  L.pop();
  // colisor
  const minX = Math.min(x0, x1) - 0.08;
  const maxX = Math.max(x0, x1) + 0.08;
  const minZ = Math.min(z0, z1) - 0.08;
  const maxZ = Math.max(z0, z1) + 0.08;
  if (Math.abs(x1 - x0) < 0.01 || Math.abs(z1 - z0) < 0.01) L.wall(minX, minZ, maxX, maxZ, h);
  else {
    const steps = Math.ceil(len / 0.5);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const px = x0 + (x1 - x0) * t;
      const pz = z0 + (z1 - z0) * t;
      L.wall(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, h);
    }
  }
}

let _fenceMat = null;
function fenceMat() {
  if (_fenceMat) return _fenceMat;
  const t = drawnTex(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,120,115,1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  _fenceMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6 });
  _fenceMat.userData.shared = true;
  return _fenceMat;
}

export function woodFence(L, x0, z0, x1, z1, h = 1.6) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(x1 - x0, z1 - z0);
  L.push(x0, 0, z0, ang);
  for (let p = 0; p < len; p += 0.18) {
    if (R() < 0.06) continue;
    L.box(0, 0, p + 0.08, 0.03, h * (0.85 + R() * 0.15), 0.14, 'oldwood', { collide: false });
  }
  L.box(0.03, h * 0.3, len / 2, 0.03, 0.08, len, 'oldwood', { collide: false });
  L.box(0.03, h * 0.75, len / 2, 0.03, 0.08, len, 'oldwood', { collide: false });
  L.pop();
  L.wall(Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1, h);
}

export function jersey(L, x, z, ry = 0, mat = 'concrete') {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 2.0, 0.3, 0.6, mat, { collide: false });
  L.box(0, 0.3, 0, 2.0, 0.5, 0.3, mat, { collide: false });
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.4, 0), 2.0, 0.8, 0.6);
  L.pop();
}

export function cone(L, x, z) {
  L.cyl(x, 0, z, 0.18, 0.6, 'paintRed', { rTop: 0.03, seg: 10, collide: false });
  L.box(x, 0, z, 0.38, 0.04, 0.38, 'paintRed', { collide: false });
}

export function gasPump(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 1.2, 0.2, 0.6, 'concrete');
  L.box(0, 0.2, 0, 0.7, 1.6, 0.45, 'paintRed');
  L.box(0, 1.25, 0.23, 0.5, 0.3, 0.01, 'glassDark', { collide: false });
  L.box(0.36, 0.6, 0.1, 0.05, 0.4, 0.1, 'plasticDark', { collide: false });
  L.pop();
}

export function sink(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0.7, 0, 0.55, 0.15, 0.42, 'paintWhite', { collide: false });
  L.box(0, 0, 0.0, 0.14, 0.7, 0.14, 'paintWhite', { collide: false });
  L.box(0, 1.1, -0.2, 0.5, 0.6, 0.02, 'chrome', { collide: false });
  L.pop();
}

export function toilet(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0.05, 0.38, 0.4, 0.5, 'paintWhite', { collide: false });
  L.box(0, 0.4, -0.2, 0.42, 0.4, 0.18, 'paintWhite', { collide: false });
  L.pop();
}

export function fridge(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 0.75, 1.8, 0.7, 'paintWhite');
  L.box(0.3, 0.8, 0.36, 0.03, 0.4, 0.04, 'chrome', { collide: false });
  L.pop();
}

export function stove(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 0.7, 0.9, 0.65, 'paintWhite');
  for (const sx of [-0.17, 0.17]) for (const sz of [-0.15, 0.15]) L.cyl(sx, 0.9, sz, 0.1, 0.02, 'metalDark', { collide: false });
  L.pop();
}

export function vending(L, x, z, ry = 0, lit = true) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 0.95, 1.9, 0.8, 'paintRed');
  L.box(-0.1, 0.5, 0.41, 0.6, 1.2, 0.01, lit ? emissive(0x9ab8c8, 0.35) : 'glassDark', { collide: false, batch: false });
  L.pop();
}

export function generator(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 2.6, 0.2, 1.4, 'concreteDark');
  L.box(0, 0.2, 0, 2.2, 1.2, 1.1, 'metalPaint', { collide: false });
  L.cyl(-0.6, 1.4, 0, 0.25, 0.9, 'metalDark', { collide: false, rz: Math.PI / 2, center: true });
  L.cyl(0.9, 1.4, 0.2, 0.08, 1.2, 'rust', { collide: false });
  for (let i = 0; i < 6; i++) L.box(0.4 + i * 0.1, 0.4, 0.56, 0.04, 0.7, 0.02, 'metalDark', { collide: false });
  L.pop();
}

export function panel(L, x, y, z, ry = 0) {
  L.push(x, y, z, ry);
  L.box(0, 0, 0, 0.7, 1.0, 0.18, 'metalPaint', { collide: false });
  L.box(0, 0.05, 0.095, 0.6, 0.9, 0.01, 'metalDark', { collide: false });
  for (let i = 0; i < 6; i++) L.box(-0.2 + (i % 3) * 0.2, 0.25 + Math.floor(i / 3) * 0.35, 0.11, 0.08, 0.14, 0.03, 'plasticDark', { collide: false });
  L.pop();
}

export function pipeRun(L, x0, y, z0, x1, z1, r = 0.08, mat = 'rust') {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(x1 - x0, z1 - z0);
  L.push(x0, y, z0, ang);
  L.cyl(0, 0, len / 2, r, len, mat, { rx: Math.PI / 2, center: true, collide: false, seg: 10 });
  for (let p = 1; p < len; p += 3) L.cyl(0, 0, p, r * 1.4, 0.08, 'metalDark', { rx: Math.PI / 2, center: true, collide: false, seg: 10 });
  L.pop();
}

export function morgueWall(L, x, z, ry = 0, cols = 3, rows = 3, labels = []) {
  L.push(x, 0, z, ry);
  const w = cols * 0.75;
  L.box(0, 0, 0, w + 0.1, rows * 0.7 + 0.3, 0.5, 'metal');
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const dx = -w / 2 + 0.375 + c * 0.75;
      const dy = 0.25 + r * 0.7;
      L.box(dx, dy, 0.255, 0.68, 0.6, 0.02, 'chrome', { collide: false });
      L.box(dx, dy + 0.27, 0.27, 0.25, 0.04, 0.03, 'metalDark', { collide: false });
    }
  L.pop();
}

export function curtain(L, x, z, ry = 0, w = 2, mat = 'fabricGreen') {
  L.push(x, 0, z, ry);
  L.box(0, 2.25, 0, w, 0.03, 0.03, 'chrome', { collide: false });
  const n = Math.ceil(w / 0.25);
  for (let i = 0; i < n; i++) L.box(-w / 2 + 0.12 + i * 0.25, 0.25, (i % 2) * 0.05, 0.25, 2.0, 0.02, mat, { collide: false });
  L.pop();
}

export function ivStand(L, x, z) {
  L.cyl(x, 0, z, 0.015, 1.9, 'chrome', { collide: false, seg: 6 });
  L.box(x, 1.85, z, 0.4, 0.02, 0.02, 'chrome', { collide: false });
  L.box(x + 0.15, 1.6, z, 0.1, 0.2, 0.05, 'glass', { collide: false });
}

export function wheelchair(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  for (const sx of [-0.28, 0.28]) L.cyl(sx, 0.3, 0, 0.3, 0.03, 'rubber', { rz: Math.PI / 2, center: true, collide: false, seg: 14 });
  L.box(0, 0.45, 0, 0.5, 0.05, 0.45, 'fabric', { collide: false });
  L.box(0, 0.5, -0.22, 0.5, 0.5, 0.04, 'fabric', { collide: false });
  L.pop();
}

export function cellBars(L, x0, z, x1, h = 2.6, gap = null) {
  for (let x = x0; x <= x1; x += 0.14) {
    if (gap && x > gap[0] && x < gap[1]) continue;
    L.cyl(x, 0, z, 0.018, h, 'metalDark', { collide: false, seg: 6 });
  }
  L.box((x0 + x1) / 2, h - 0.05, z, x1 - x0, 0.05, 0.05, 'metalDark', { collide: false });
  L.box((x0 + x1) / 2, 1.1, z, x1 - x0, 0.04, 0.04, 'metalDark', { collide: false });
  if (gap) {
    L.wall(x0, z - 0.08, gap[0], z + 0.08, h);
    L.wall(gap[1], z - 0.08, x1, z + 0.08, h);
  } else L.wall(x0, z - 0.08, x1, z + 0.08, h);
}

export function cellBarsZ(L, x, z0, z1, h = 2.6) {
  for (let z = z0; z <= z1; z += 0.14) L.cyl(x, 0, z, 0.018, h, 'metalDark', { collide: false, seg: 6 });
  L.box(x, h - 0.05, (z0 + z1) / 2, 0.05, 0.05, z1 - z0, 'metalDark', { collide: false });
  L.box(x, 1.1, (z0 + z1) / 2, 0.04, 0.04, z1 - z0, 'metalDark', { collide: false });
  L.wall(x - 0.08, z0, x + 0.08, z1, h);
}

export function fluorescent(L, x, y, z, ry = 0, on = true) {
  L.push(x, y, z, ry);
  L.box(0, -0.06, 0, 1.25, 0.06, 0.25, 'metalPaint', { collide: false });
  L.box(0, -0.08, 0, 1.15, 0.02, 0.18, on ? emissive(0xe8f4ff, 2.2) : 'plastic', { collide: false, batch: !on });
  L.pop();
}

export function bulb(L, x, y, z, on = true, color = 0xffc070) {
  L.box(x, y - 0.4, z, 0.01, 0.4, 0.01, 'black', { collide: false });
  L.sphere(x, y - 0.45, z, 0.06, on ? emissive(color, 4) : 'glass', { batch: false });
}

export function tank(L, x, z, opts = {}) {
  const h = opts.h || 2.6;
  L.cyl(x, 0, z, 0.75, 0.35, 'metalDark', { seg: 16 });
  L.cyl(x, h - 0.3, z, 0.75, 0.35, 'metalDark', { seg: 16, collide: false });
  L.cyl(x, 0.35, z, 0.62, h - 0.65, emissive(opts.color ?? 0x2a7a5a, opts.broken ? 0.05 : 0.5), { seg: 16, collide: false, batch: false });
  L.cyl(x, 0.35, z, 0.66, h - 0.65, 'glass', { seg: 16, collide: false, open: true });
  if (opts.specimen !== false && !opts.broken) {
    L.sphere(x, h * 0.5, z, 0.3, 'flesh', { scale: [0.25, 0.45, 0.22], batch: false });
    L.sphere(x, h * 0.5 + 0.5, z, 0.14, 'flesh', { batch: false });
  }
}

export function serverRack(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 0.7, 2.0, 0.9, 'plasticDark');
  for (let i = 0; i < 10; i++) {
    L.box(0, 0.15 + i * 0.18, 0.455, 0.6, 0.12, 0.01, 'metalDark', { collide: false });
    if (R() < 0.6) L.box(0.22, 0.18 + i * 0.18, 0.462, 0.03, 0.02, 0.01, emissive(R() < 0.3 ? 0xff3020 : 0x30ff60, 2), { collide: false, batch: false });
  }
  L.pop();
}

export function terminal(L, x, z, ry = 0, color = 0x40ff90) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 1.0, 0.75, 0.6, 'metalPaint');
  L.box(0, 0.75, -0.05, 0.55, 0.42, 0.4, 'plastic', { collide: false });
  L.box(0, 0.8, 0.152, 0.45, 0.32, 0.01, emissive(color, 0.9), { collide: false, batch: false });
  L.box(0, 0.76, 0.25, 0.5, 0.03, 0.18, 'plasticDark', { collide: false });
  L.pop();
}

export function mineSupport(L, x, z, w = 5, h = 3.2, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(-w / 2 + 0.15, 0, 0, 0.25, h, 0.25, 'oldwood');
  L.box(w / 2 - 0.15, 0, 0, 0.25, h, 0.25, 'oldwood');
  L.box(0, h - 0.25, 0, w, 0.28, 0.3, 'oldwood', { collide: false });
  L.pop();
}

export function rails(L, x, z0, z1) {
  const len = Math.abs(z1 - z0);
  const cz = (z0 + z1) / 2;
  L.box(x - 0.45, 0, cz, 0.06, 0.08, len, 'rust', { collide: false });
  L.box(x + 0.45, 0, cz, 0.06, 0.08, len, 'rust', { collide: false });
  for (let z = Math.min(z0, z1); z < Math.max(z0, z1); z += 0.7) L.box(x, 0, z, 1.3, 0.05, 0.2, 'oldwood', { collide: false });
}

export function minecart(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0.25, 0, 1.0, 0.75, 1.5, 'rust');
  for (const sx of [-0.45, 0.45]) for (const sz of [-0.5, 0.5]) L.cyl(sx, 0.15, sz, 0.15, 0.08, 'metalDark', { rz: Math.PI / 2, center: true, collide: false });
  L.sphere(0, 0.95, 0, 0.4, 'rock', { scale: [0.45, 0.2, 0.65] });
  L.pop();
}

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
export function rock(L, x, z, s = 1, y = 0, collide = true) {
  L.mesh(rockGeo, 'rock', x, y + s * 0.4, z, { scale: [s * (0.8 + R() * 0.5), s * (0.6 + R() * 0.4), s * (0.8 + R() * 0.5)], rx: R() * 3, ry: R() * 3 });
  if (collide) L.wall(x - s * 0.8, z - s * 0.8, x + s * 0.8, z + s * 0.8, y + s);
}

export function pineTree(L, x, z, s = 1) {
  L.cyl(x, 0, z, 0.2 * s, 2.5 * s, 'bark', { rTop: 0.12 * s, seg: 7, colR: 0.3 * s });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry((1.7 - i * 0.35) * s, 2.2 * s, 8);
    L.mesh(g, 'leaves', x, (2.2 + i * 1.15) * s, z, { ry: R() * 3 });
  }
}

export function deadTree(L, x, z, s = 1) {
  L.cyl(x, 0, z, 0.22 * s, 4 * s, 'bark', { rTop: 0.1 * s, seg: 7, colR: 0.3 * s });
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2;
    const y = (1.8 + R() * 2) * s;
    const len = (0.9 + R() * 1.3) * s;
    L.push(x, y, z, a);
    L.cyl(0, 0, len / 2, 0.06 * s, len, 'bark', { rx: 1.0 + R() * 0.4, center: true, collide: false, rTop: 0.02 * s, seg: 5 });
    L.pop();
  }
}

export function bush(L, x, z, s = 1) {
  L.sphere(x, 0.4 * s, z, 0.7 * s, 'leaves', { scale: [0.8 * s, 0.6 * s, 0.8 * s] });
}

export function planter(L, x, z) {
  L.box(x, 0, z, 0.7, 0.45, 0.7, 'concrete');
  L.box(x, 0.45, z, 0.6, 0.02, 0.6, 'dirt', { collide: false });
}

export function savePointProps(L, x, z, ry = 0) {
  // mesa com gravador de fita e luminária
  L.push(x, 0, z, ry);
  L.box(0, 0.72, 0, 1.0, 0.05, 0.6, 'woodDark', { collide: false });
  for (const sx of [-0.45, 0.45]) for (const sz of [-0.25, 0.25]) L.box(sx, 0, sz, 0.05, 0.72, 0.05, 'woodDark', { collide: false });
  L.box(-0.1, 0.77, 0, 0.32, 0.09, 0.2, 'plasticDark', { collide: false });
  L.box(-0.1, 0.861, 0.0, 0.2, 0.01, 0.08, 'metalDark', { collide: false });
  L.cyl(-0.15, 0.862, 0, 0.025, 0.005, 'chrome', { collide: false });
  L.cyl(-0.05, 0.862, 0, 0.025, 0.005, 'chrome', { collide: false });
  // luminária
  L.cyl(0.3, 0.77, -0.1, 0.07, 0.02, 'metalDark', { collide: false });
  L.cyl(0.3, 0.79, -0.1, 0.012, 0.35, 'metalDark', { collide: false });
  L.cyl(0.3, 1.1, -0.1, 0.06, 0.12, 'paintGreen', { rTop: 0.12, collide: false, open: true });
  L.sphere(0.3, 1.08, -0.1, 0.035, emissive(0xffd090, 5), { batch: false });
  L.colliderFromLocal(new THREE.Matrix4().makeTranslation(0, 0.4, 0), 1.0, 0.8, 0.6);
  L.pop();
}

export function storageBox(L, x, z, ry = 0) {
  L.push(x, 0, z, ry);
  L.box(0, 0, 0, 1.0, 1.8, 0.55, 'woodDark');
  L.box(-0.24, 0.05, 0.28, 0.46, 1.7, 0.01, 'wood', { collide: false });
  L.box(0.24, 0.05, 0.28, 0.46, 1.7, 0.01, 'wood', { collide: false });
  L.box(-0.04, 0.9, 0.3, 0.02, 0.12, 0.02, 'chrome', { collide: false });
  L.box(0.04, 0.9, 0.3, 0.02, 0.12, 0.02, 'chrome', { collide: false });
  L.pop();
}

export function papers(L, x, z, n = 5, spread = 1) {
  for (let i = 0; i < n; i++) L.box(x + (R() - 0.5) * spread, 0.005, z + (R() - 0.5) * spread, 0.21, 0.004, 0.29, 'paper', { collide: false, ry: R() * 3 });
}

export function bloodPool(L, x, z, s = 1.2, variant = 0) {
  L.world.decals.add(x, z, s, variant, 0.012);
}

// placa / letreiro (plano com textura de texto)
export function sign(L, x, y, z, w, h, text, ry = 0, opts = {}) {
  const t = signTex(text, opts);
  const mat = opts.emissive
    ? new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: opts.emissive, roughness: 0.6 })
    : new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  const g = new THREE.PlaneGeometry(w, h);
  return L.mesh(g, mat, x, y, z, { ry, batch: false });
}

export function poster(L, x, y, z, w, h, draw, ry = 0) {
  const t = drawnTex(256, Math.round((256 * h) / w), draw);
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide });
  return L.mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z, { ry, batch: false });
}

export function stairsDown(L, x, z, ry = 0, w = 2) {
  L.push(x, 0, z, ry);
  for (let i = 0; i < 8; i++) L.box(0, -0.2 * (i + 1), 0.3 * i + 0.15, w, 0.2, 0.3, 'concrete', { collide: false });
  L.box(0, -2, 1.5, w, 0.1, 3, 'black', { collide: false });
  L.pop();
}

export function stairsUp(L, x, z, ry = 0, w = 2) {
  L.push(x, 0, z, ry);
  for (let i = 0; i < 10; i++) L.box(0, 0, 0.3 * i + 0.15, w, 0.2 * (i + 1), 0.3, 'concrete', { collide: false });
  L.pop();
}

export function lightCone(L, x, y, z, h, r, color = 0xffd8a0, opacity = 0.08) {
  const geo = new THREE.ConeGeometry(r, h, 20, 1, true);
  geo.translate(0, -h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity }, h: { value: h } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; uniform float h;
      void main(){ vY = -position.y / h; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(vN, vV)), 1.5); float a = opacity * (1.0 - vY) * f; gl_FragColor = vec4(color * a, a); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(new THREE.Vector3(x, y, z).applyMatrix4(L.m));
  m.renderOrder = 4;
  L.scene.add(m);
  L.meshes.push(m);
  return m;
}

export function glowSprite(L, x, y, z, s, color, opacity = 0.4) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMat(color).map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.set(x, y, z);
  sp.scale.setScalar(s);
  L.scene.add(sp);
  L.meshes.push(sp);
  return sp;
}

export { emissive, basic };
