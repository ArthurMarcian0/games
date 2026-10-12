// Texturas 100% procedurais (canvas): cor, relevo (normal map) e rugosidade.
// Todas são "tileable" para repetir sem emendas visíveis.
import * as THREE from 'three';
import { mulberry32, clamp, lerp } from '../core/utils.js';

function makeNoise(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rng();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const h = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
  // ruído de valor periódico (px/py = período em células)
  return function noise(x, y, px = 256, py = px) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(h(x0, y0), h(x1, y0), u), lerp(h(x0, y1), h(x1, y1), u), v);
  };
}

function fbm(noise, x, y, p, oct = 4, py = p) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f, y * f, p * f, py * f);
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

const hash2 = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// gera cor/altura/rugosidade por pixel
function generate(size, seed, pixel, opts = {}) {
  const noise = makeNoise(seed);
  const cc = canvas(size);
  const ctx = cc.getContext('2d');
  const img = ctx.createImageData(size, size);
  const H = new Float32Array(size * size);
  const R = opts.rough ? new Float32Array(size * size) : null;
  const out = [0, 0, 0, 0.5, 0.5];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[3] = 0.5;
      out[4] = 0.8;
      pixel(x / size, y / size, noise, out, x, y);
      const i = y * size + x;
      img.data[i * 4] = clamp(out[0], 0, 1) * 255;
      img.data[i * 4 + 1] = clamp(out[1], 0, 1) * 255;
      img.data[i * 4 + 2] = clamp(out[2], 0, 1) * 255;
      img.data[i * 4 + 3] = 255;
      H[i] = out[3];
      if (R) R[i] = out[4];
    }
  }
  ctx.putImageData(img, 0, 0);
  if (opts.post) opts.post(ctx, size, mulberry32(seed + 7));
  const map = new THREE.CanvasTexture(cc);
  map.colorSpace = THREE.SRGBColorSpace;
  finishTex(map);
  const res = { map };
  if (opts.normal !== 0) res.normalMap = normalFromHeight(H, size, opts.normal ?? 2.5);
  if (R) res.roughnessMap = grayTex(R, size);
  return res;
}

function finishTex(t) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function normalFromHeight(H, size, strength) {
  const cc = canvas(size);
  const ctx = cc.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = H[y * size + ((x - 1 + size) % size)];
      const r = H[y * size + ((x + 1) % size)];
      const u = H[((y - 1 + size) % size) * size + x];
      const d = H[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(new THREE.CanvasTexture(cc));
}

function grayTex(R, size) {
  const cc = canvas(size);
  const ctx = cc.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = clamp(R[i], 0, 1) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finishTex(new THREE.CanvasTexture(cc));
}

// manchas de sujeira / umidade desenhadas por cima
function stains(ctx, size, rng, n, color, maxR = 0.25) {
  for (let i = 0; i < n; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = (0.04 + rng() * maxR) * size;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
}

function drips(ctx, size, rng, n, color) {
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    const x = rng() * size;
    const y = rng() * size * 0.5;
    const len = (0.2 + rng() * 0.6) * size;
    ctx.lineWidth = 1 + rng() * 3;
    ctx.globalAlpha = 0.25 + rng() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 6, y + len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const RECIPES = {
  asphalt: () =>
    generate(
      512,
      11,
      (u, v, n, o) => {
        const f = fbm(n, u * 8, v * 8, 8, 5);
        const sp = n(u * 160, v * 160, 160);
        const crack = Math.abs(fbm(n, u * 4 + 9, v * 4 + 3, 4, 4) - 0.5);
        const puddle = fbm(n, u * 3 + 30, v * 3, 3, 3);
        let c = 0.1 + f * 0.09 + (sp > 0.78 ? 0.06 : 0);
        let h = f * 0.6 + sp * 0.25;
        if (crack < 0.012) {
          c *= 0.4;
          h -= 0.4;
        }
        const wet = clamp((puddle - 0.55) * 8, 0, 1);
        c *= 1 - wet * 0.35;
        h = lerp(h, 0.3, wet);
        o[0] = c;
        o[1] = c * 1.01;
        o[2] = c * 1.05;
        o[3] = h;
        o[4] = lerp(0.62, 0.05, wet);
      },
      { rough: true, normal: 3 },
    ),
  sidewalk: () =>
    generate(
      256,
      12,
      (u, v, n, o) => {
        const f = fbm(n, u * 8, v * 8, 8, 4);
        const gx = Math.min(u % 0.5, 0.5 - (u % 0.5));
        const gy = Math.min(v % 0.5, 0.5 - (v % 0.5));
        const groove = Math.min(gx, gy) < 0.006;
        const puddle = fbm(n, u * 2 + 5, v * 2, 2, 3);
        const wet = clamp((puddle - 0.58) * 6, 0, 1);
        let c = 0.32 + f * 0.14;
        if (groove) c *= 0.5;
        c *= 1 - wet * 0.3;
        o[0] = c;
        o[1] = c * 0.98;
        o[2] = c * 0.94;
        o[3] = groove ? 0.1 : 0.5 + f * 0.3;
        o[4] = lerp(0.75, 0.15, wet);
      },
      { rough: true, normal: 2 },
    ),
  brick: () =>
    generate(
      512,
      13,
      (u, v, n, o) => {
        const rows = 8;
        const cols = 4;
        const row = Math.floor(v * rows);
        const off = row % 2 ? 0.5 / cols : 0;
        const uu = (u + off) % 1;
        const col = Math.floor(uu * cols);
        const fx = (uu * cols) % 1;
        const fy = (v * rows) % 1;
        const mortar = fx < 0.04 || fx > 0.96 || fy < 0.07 || fy > 0.93;
        const hv = hash2(col, row, 3);
        const f = fbm(n, u * 16, v * 16, 16, 4);
        const grime = fbm(n, u * 2, v * 2, 2, 3);
        if (mortar) {
          const m = 0.36 + f * 0.1;
          o[0] = m;
          o[1] = m * 0.95;
          o[2] = m * 0.88;
          o[3] = 0.2 + f * 0.1;
        } else {
          const base = 0.3 + hv * 0.14;
          o[0] = base * (1.25 + f * 0.3);
          o[1] = base * (0.62 + f * 0.2);
          o[2] = base * (0.48 + f * 0.15);
          o[3] = 0.65 + f * 0.25;
        }
        const g = 0.55 + grime * 0.6;
        o[0] *= g;
        o[1] *= g;
        o[2] *= g;
      },
      { normal: 4, post: (ctx, s, r) => stains(ctx, s, r, 10, 'rgba(10,8,5,0.35)') },
    ),
  plaster: () =>
    generate(
      256,
      14,
      (u, v, n, o) => {
        const f = fbm(n, u * 6, v * 6, 6, 5);
        const streak = n(u * 24, v * 2, 24, 2);
        let c = 0.55 + f * 0.18 - Math.max(0, streak - 0.6) * 0.4;
        o[0] = c * 1.02;
        o[1] = c * 0.97;
        o[2] = c * 0.86;
        o[3] = f;
      },
      {
        normal: 1.5,
        post: (ctx, s, r) => {
          stains(ctx, s, r, 7, 'rgba(70,55,30,0.28)');
          drips(ctx, s, r, 14, 'rgba(60,45,25,1)');
        },
      },
    ),
  wallpaper: () =>
    generate(
      256,
      15,
      (u, v, n, o) => {
        const stripe = Math.floor(u * 8) % 2;
        const du = (u * 8) % 1;
        const dv = (v * 8) % 1;
        const motif = Math.abs(du - 0.5) + Math.abs(dv - 0.5) < 0.22 ? 1 : 0;
        const f = fbm(n, u * 6, v * 6, 6, 4);
        const peel = fbm(n, u * 3 + 11, v * 3, 3, 4);
        let r = stripe ? 0.36 : 0.42;
        let g = stripe ? 0.4 : 0.42;
        let b = stripe ? 0.3 : 0.32;
        if (motif && !stripe) {
          r *= 0.8;
          g *= 0.9;
          b *= 0.75;
        }
        const k = 0.75 + f * 0.35;
        o[0] = r * k;
        o[1] = g * k;
        o[2] = b * k;
        o[3] = 0.6;
        if (peel > 0.66) {
          const p = 0.5 + f * 0.15;
          o[0] = p;
          o[1] = p * 0.95;
          o[2] = p * 0.85;
          o[3] = 0.3;
        }
      },
      {
        normal: 2,
        post: (ctx, s, r) => {
          stains(ctx, s, r, 6, 'rgba(50,38,18,0.3)');
          drips(ctx, s, r, 10, 'rgba(45,35,20,1)');
        },
      },
    ),
  woodfloor: () =>
    generate(
      512,
      16,
      (u, v, n, o) => {
        const rows = 8;
        const row = Math.floor(v * rows);
        const plankLen = 0.5;
        const off = hash2(row, 1) * plankLen;
        const plank = Math.floor((u + off) / plankLen);
        const fy = (v * rows) % 1;
        const fx = ((u + off) / plankLen) % 1;
        const gap = fy < 0.04 || fx < 0.008;
        const hv = hash2(plank, row, 5);
        const grain = n(u * 6 + hv * 50, v * 90, 6, 90);
        const f = fbm(n, u * 8, v * 8, 8, 3);
        const base = 0.22 + hv * 0.1 + grain * 0.08;
        o[0] = base * 1.3 * (0.8 + f * 0.4);
        o[1] = base * 0.88 * (0.8 + f * 0.4);
        o[2] = base * 0.55 * (0.8 + f * 0.4);
        o[3] = gap ? 0 : 0.6 + grain * 0.2;
        o[4] = gap ? 0.9 : 0.55 + f * 0.25;
        if (gap) {
          o[0] *= 0.3;
          o[1] *= 0.3;
          o[2] *= 0.3;
        }
      },
      { rough: true, normal: 3, post: (ctx, s, r) => stains(ctx, s, r, 6, 'rgba(15,10,5,0.35)') },
    ),
  wood: () =>
    generate(
      256,
      17,
      (u, v, n, o) => {
        const grain = n(u * 4, v * 60, 4, 60);
        const ring = Math.sin((u * 20 + fbm(n, u * 4, v * 4, 4, 3) * 8) * Math.PI) * 0.5 + 0.5;
        const c = 0.24 + grain * 0.1 + ring * 0.05;
        o[0] = c * 1.25;
        o[1] = c * 0.85;
        o[2] = c * 0.55;
        o[3] = grain * 0.5 + ring * 0.3;
      },
      { normal: 1.5 },
    ),
  oldwood: () =>
    generate(
      256,
      18,
      (u, v, n, o) => {
        const boards = 4;
        const b = Math.floor(u * boards);
        const fx = (u * boards) % 1;
        const gap = fx < 0.03;
        const grain = n(u * 8 + b * 13, v * 50, 8, 50);
        const f = fbm(n, u * 6, v * 6, 6, 4);
        const c = (0.2 + grain * 0.12) * (0.7 + f * 0.5);
        o[0] = c * 1.05;
        o[1] = c * 0.9;
        o[2] = c * 0.75;
        o[3] = gap ? 0 : 0.5 + grain * 0.3;
        if (gap) {
          o[0] *= 0.2;
          o[1] *= 0.2;
          o[2] *= 0.2;
        }
      },
      { normal: 3.5 },
    ),
  tilefloor: () =>
    generate(
      512,
      19,
      (u, v, n, o) => {
        const t = 6;
        const tx = Math.floor(u * t);
        const ty = Math.floor(v * t);
        const fx = (u * t) % 1;
        const fy = (v * t) % 1;
        const grout = fx < 0.03 || fy < 0.03;
        const checker = (tx + ty) % 2;
        const f = fbm(n, u * 10, v * 10, 10, 4);
        const dirt = fbm(n, u * 3, v * 3, 3, 4);
        let c = checker ? 0.55 : 0.42;
        c *= 0.85 + f * 0.2;
        c *= 0.6 + (1 - dirt) * 0.5;
        o[0] = c * 0.92;
        o[1] = c;
        o[2] = c * 0.95;
        o[3] = grout ? 0.1 : 0.6;
        o[4] = grout ? 0.9 : 0.25 + dirt * 0.4;
        if (grout) {
          o[0] *= 0.45;
          o[1] *= 0.45;
          o[2] *= 0.45;
        }
      },
      { rough: true, normal: 2, post: (ctx, s, r) => stains(ctx, s, r, 8, 'rgba(30,25,10,0.3)') },
    ),
  tilewall: () =>
    generate(
      256,
      20,
      (u, v, n, o) => {
        const t = 8;
        const fx = (u * t) % 1;
        const fy = (v * t) % 1;
        const grout = fx < 0.05 || fy < 0.05;
        const hv = hash2(Math.floor(u * t), Math.floor(v * t), 2);
        const f = fbm(n, u * 6, v * 6, 6, 4);
        let c = 0.62 + hv * 0.08;
        c *= 0.75 + f * 0.3;
        o[0] = c * 0.82;
        o[1] = c * 0.95;
        o[2] = c * 0.88;
        o[3] = grout ? 0.15 : 0.7;
        o[4] = grout ? 0.9 : 0.2;
        if (grout) {
          o[0] *= 0.6;
          o[1] *= 0.6;
          o[2] *= 0.6;
        }
        if (hv > 0.94) {
          o[0] *= 0.5;
          o[1] *= 0.5;
          o[2] *= 0.5;
          o[3] = 0.3;
        }
      },
      {
        rough: true,
        normal: 2,
        post: (ctx, s, r) => {
          stains(ctx, s, r, 6, 'rgba(60,50,20,0.3)');
          drips(ctx, s, r, 10, 'rgba(70,40,20,1)');
        },
      },
    ),
  concrete: () =>
    generate(
      256,
      21,
      (u, v, n, o) => {
        const f = fbm(n, u * 6, v * 6, 6, 5);
        const pores = n(u * 90, v * 90, 90) > 0.82 ? -0.15 : 0;
        const c = 0.36 + f * 0.14 + pores * 0.3;
        o[0] = c;
        o[1] = c * 0.99;
        o[2] = c * 0.96;
        o[3] = f + pores;
        o[4] = 0.85;
      },
      {
        rough: true,
        normal: 2.5,
        post: (ctx, s, r) => {
          stains(ctx, s, r, 8, 'rgba(20,18,15,0.35)');
          drips(ctx, s, r, 8, 'rgba(25,22,18,1)');
        },
      },
    ),
  metal: () =>
    generate(
      256,
      22,
      (u, v, n, o) => {
        const brush = n(u * 2, v * 120, 2, 120);
        const rust = fbm(n, u * 5, v * 5, 5, 5);
        const r = clamp((rust - 0.56) * 5, 0, 1);
        const c = 0.42 + brush * 0.1;
        o[0] = lerp(c, 0.4, r);
        o[1] = lerp(c, 0.2, r);
        o[2] = lerp(c * 1.04, 0.1, r);
        o[3] = brush * 0.2 + r * 0.6;
        o[4] = lerp(0.4, 0.9, r);
      },
      { rough: true, normal: 2 },
    ),
  rust: () =>
    generate(
      256,
      23,
      (u, v, n, o) => {
        const f = fbm(n, u * 8, v * 8, 8, 5);
        const g = n(u * 60, v * 60, 60);
        o[0] = 0.32 + f * 0.2;
        o[1] = 0.15 + f * 0.1;
        o[2] = 0.07 + g * 0.04;
        o[3] = f + g * 0.3;
      },
      { normal: 3 },
    ),
  grass: () =>
    generate(
      512,
      24,
      (u, v, n, o) => {
        const f = fbm(n, u * 10, v * 10, 10, 5);
        const blades = n(u * 200, v * 200, 200);
        const mud = fbm(n, u * 3 + 7, v * 3, 3, 4);
        const m = clamp((mud - 0.5) * 4, 0, 1);
        const gr = 0.12 + f * 0.1 + blades * 0.05;
        o[0] = lerp(gr * 0.7, 0.16, m);
        o[1] = lerp(gr * 1.1, 0.12, m);
        o[2] = lerp(gr * 0.45, 0.08, m);
        o[3] = lerp(0.5 + blades * 0.4, 0.3, m);
        o[4] = lerp(0.85, 0.3, m);
      },
      { rough: true, normal: 3 },
    ),
  forestfloor: () =>
    generate(
      512,
      25,
      (u, v, n, o) => {
        const f = fbm(n, u * 10, v * 10, 10, 5);
        const leaf = n(u * 80, v * 80, 80);
        const twig = Math.abs(n(u * 30, v * 30, 30) - 0.5) < 0.02;
        let r = 0.14 + f * 0.08 + leaf * 0.06;
        let g = 0.11 + f * 0.06 + leaf * 0.03;
        let b = 0.07 + f * 0.03;
        if (leaf > 0.7) {
          r += 0.06;
          g += 0.02;
        }
        if (twig) {
          r *= 0.6;
          g *= 0.6;
          b *= 0.6;
        }
        o[0] = r;
        o[1] = g;
        o[2] = b;
        o[3] = f * 0.5 + leaf * 0.5;
        o[4] = 0.7 - f * 0.3;
      },
      { rough: true, normal: 3 },
    ),
  dirt: () =>
    generate(
      256,
      26,
      (u, v, n, o) => {
        const f = fbm(n, u * 8, v * 8, 8, 5);
        const st = n(u * 70, v * 70, 70);
        const wet = clamp((fbm(n, u * 2 + 3, v * 2, 2, 3) - 0.55) * 6, 0, 1);
        const c = 0.17 + f * 0.1 + (st > 0.8 ? 0.05 : 0);
        o[0] = c * 1.15 * (1 - wet * 0.4);
        o[1] = c * 0.9 * (1 - wet * 0.4);
        o[2] = c * 0.65 * (1 - wet * 0.4);
        o[3] = lerp(f + st * 0.3, 0.3, wet);
        o[4] = lerp(0.85, 0.12, wet);
      },
      { rough: true, normal: 3 },
    ),
  bark: () =>
    generate(
      256,
      27,
      (u, v, n, o) => {
        const ridge = Math.abs(n(u * 16, v * 2, 16, 2) - 0.5) * 2;
        const f = fbm(n, u * 8, v * 8, 8, 4);
        const c = 0.1 + ridge * 0.1 + f * 0.06;
        o[0] = c * 1.1;
        o[1] = c * 0.95;
        o[2] = c * 0.8;
        o[3] = ridge;
      },
      { normal: 5 },
    ),
  rock: () =>
    generate(
      512,
      28,
      (u, v, n, o) => {
        const f = fbm(n, u * 6, v * 6, 6, 6);
        const r = 1 - Math.abs(fbm(n, u * 4 + 5, v * 4, 4, 5) - 0.5) * 2;
        const c = 0.17 + f * 0.15 + r * 0.05;
        o[0] = c * 1.05;
        o[1] = c;
        o[2] = c * 0.9;
        o[3] = f * 0.6 + r * 0.5;
        o[4] = 0.75 - r * 0.3;
      },
      { rough: true, normal: 6, post: (ctx, s, r) => drips(ctx, s, r, 12, 'rgba(15,12,8,1)') },
    ),
  ceiling: () =>
    generate(
      256,
      29,
      (u, v, n, o) => {
        const t = 4;
        const fx = (u * t) % 1;
        const fy = (v * t) % 1;
        const frame = fx < 0.03 || fy < 0.03;
        const holes = n(u * 120, v * 120, 120) > 0.75 ? -0.1 : 0;
        const f = fbm(n, u * 4, v * 4, 4, 4);
        const c = frame ? 0.3 : 0.58 + f * 0.1 + holes;
        o[0] = c;
        o[1] = c * 0.98;
        o[2] = c * 0.92;
        o[3] = frame ? 0.2 : 0.6 + holes;
      },
      { normal: 1.5, post: (ctx, s, r) => stains(ctx, s, r, 6, 'rgba(90,65,30,0.35)', 0.18) },
    ),
  carpet: () =>
    generate(
      256,
      30,
      (u, v, n, o) => {
        const f = n(u * 128, v * 128, 128);
        const g = fbm(n, u * 4, v * 4, 4, 4);
        const c = 0.18 + f * 0.05 + g * 0.06;
        o[0] = c * 0.9;
        o[1] = c * 0.6;
        o[2] = c * 0.55;
        o[3] = f;
        o[4] = 0.95;
      },
      { rough: true, normal: 1, post: (ctx, s, r) => stains(ctx, s, r, 5, 'rgba(10,5,5,0.4)') },
    ),
  labpanel: () =>
    generate(
      256,
      31,
      (u, v, n, o) => {
        const fx = (u * 2) % 1;
        const fy = (v * 2) % 1;
        const seam = fx < 0.012 || fy < 0.012;
        const f = fbm(n, u * 6, v * 6, 6, 4);
        const c = seam ? 0.25 : 0.7 + f * 0.08;
        o[0] = c * 0.95;
        o[1] = c * 0.98;
        o[2] = c;
        o[3] = seam ? 0.1 : 0.6;
        o[4] = seam ? 0.8 : 0.3;
      },
      { rough: true, normal: 2, post: (ctx, s, r) => stains(ctx, s, r, 5, 'rgba(60,50,40,0.3)') },
    ),
  roof: () =>
    generate(
      256,
      32,
      (u, v, n, o) => {
        const rows = 10;
        const row = Math.floor(v * rows);
        const fy = (v * rows) % 1;
        const off = row % 2 ? 0.05 : 0;
        const fx = ((u + off) * 10) % 1;
        const edge = fy > 0.85 || fx < 0.04;
        const f = fbm(n, u * 8, v * 8, 8, 3);
        const c = 0.14 + f * 0.06 + hash2(Math.floor((u + off) * 10), row) * 0.04;
        o[0] = c;
        o[1] = c * 0.9;
        o[2] = c * 0.88;
        o[3] = edge ? 0.1 : 0.5 + fy * 0.3;
      },
      { normal: 3 },
    ),
  fabric: () =>
    generate(
      128,
      33,
      (u, v, n, o) => {
        const w = (Math.sin(u * 256) * Math.sin(v * 256) + 1) * 0.5;
        const f = fbm(n, u * 4, v * 4, 4, 3);
        const c = 0.5 + w * 0.15 + f * 0.25;
        o[0] = o[1] = o[2] = c;
        o[3] = w;
      },
      { normal: 1 },
    ),
  flesh: () =>
    generate(
      256,
      34,
      (u, v, n, o) => {
        const f = fbm(n, u * 6, v * 6, 6, 5);
        const vein = Math.abs(fbm(n, u * 5 + 3, v * 5, 5, 4) - 0.5);
        const spot = n(u * 30, v * 30, 30);
        let r = 0.36 + f * 0.2;
        let g = 0.1 + f * 0.06;
        let b = 0.1 + f * 0.05;
        if (vein < 0.03) {
          r *= 0.5;
          g *= 0.4;
          b *= 0.9;
        }
        if (spot > 0.8) {
          r *= 0.6;
          g *= 0.7;
        }
        o[0] = r;
        o[1] = g;
        o[2] = b;
        o[3] = f + (vein < 0.03 ? 0.3 : 0);
        o[4] = 0.3 + f * 0.2;
      },
      { rough: true, normal: 4 },
    ),
  skin: () =>
    generate(
      128,
      35,
      (u, v, n, o) => {
        const f = fbm(n, u * 8, v * 8, 8, 4);
        const c = 0.7 + f * 0.3;
        o[0] = o[1] = o[2] = c;
        o[3] = f;
      },
      { normal: 1.2 },
    ),
  paleskin: () =>
    generate(
      256,
      36,
      (u, v, n, o) => {
        const f = fbm(n, u * 8, v * 8, 8, 4);
        const vein = Math.abs(fbm(n, u * 6 + 3, v * 6, 6, 4) - 0.5);
        const rot = fbm(n, u * 3 + 9, v * 3, 3, 4);
        let c = 0.75 + f * 0.2;
        o[0] = c;
        o[1] = c * 0.98;
        o[2] = c * 0.92;
        if (vein < 0.025) {
          o[0] *= 0.7;
          o[1] *= 0.72;
          o[2] *= 0.85;
        }
        if (rot > 0.62) {
          o[0] *= 0.6;
          o[1] *= 0.45;
          o[2] *= 0.4;
        }
        o[3] = f + (rot > 0.62 ? -0.3 : 0);
      },
      { normal: 2 },
    ),
  water: () =>
    generate(
      256,
      37,
      (u, v, n, o) => {
        const f = fbm(n, u * 6, v * 6, 6, 4);
        o[0] = 0.05 + f * 0.03;
        o[1] = 0.07 + f * 0.03;
        o[2] = 0.07 + f * 0.04;
        o[3] = f;
      },
      { normal: 1.5 },
    ),
  leaves: () =>
    generate(
      256,
      38,
      (u, v, n, o) => {
        const f = fbm(n, u * 12, v * 12, 12, 4);
        const l = n(u * 50, v * 50, 50);
        const c = 0.06 + f * 0.08 + l * 0.04;
        o[0] = c * 0.75;
        o[1] = c * 1.15;
        o[2] = c * 0.6;
        o[3] = l;
      },
      { normal: 3 },
    ),
};

const cache = new Map();
export function getTex(name) {
  if (!cache.has(name)) {
    const fn = RECIPES[name];
    if (!fn) throw new Error('Textura desconhecida: ' + name);
    cache.set(name, fn());
  }
  return cache.get(name);
}
export const textureNames = () => Object.keys(RECIPES);

// ---------- Texturas com transparência ----------
const alphaCache = new Map();
function alphaTex(key, size, draw) {
  if (alphaCache.has(key)) return alphaCache.get(key);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  alphaCache.set(key, t);
  return t;
}

export function bloodTex(variant = 0) {
  return alphaTex('blood' + variant, 256, (ctx, s) => {
    const r = mulberry32(100 + variant);
    const blob = (x, y, rad, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(55,4,4,${a})`);
      g.addColorStop(0.7, `rgba(45,3,3,${a * 0.9})`);
      g.addColorStop(1, 'rgba(30,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    };
    if (variant === 2) {
      // rastro de arrasto
      for (let i = 0; i < 40; i++) blob(s * 0.5 + (r() - 0.5) * 30, s * (0.1 + i * 0.02), 10 + r() * 14, 0.5);
      return;
    }
    blob(s / 2, s / 2, s * 0.28, 0.95);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.15 + r() * 0.3);
      blob(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 3 + r() * (variant ? 6 : 16), 0.9);
    }
  });
}

export function softTex() {
  return alphaTex('soft', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function fogTex() {
  return alphaTex('fog', 256, (ctx, s) => {
    const r = mulberry32(55);
    for (let i = 0; i < 40; i++) {
      const x = s * (0.2 + r() * 0.6);
      const y = s * (0.3 + r() * 0.4);
      const rad = s * (0.08 + r() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
}

export function glintTex() {
  return alphaTex('glint', 64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,250,230,1)');
    g.addColorStop(0.15, 'rgba(255,240,200,0.8)');
    g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,250,235,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s / 2, 4);
    ctx.lineTo(s / 2, s - 4);
    ctx.moveTo(4, s / 2);
    ctx.lineTo(s - 4, s / 2);
    ctx.stroke();
  });
}

export function paperTex() {
  return alphaTex('paper', 128, (ctx, s) => {
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(40,35,30,0.55)';
    for (let i = 0; i < 14; i++) ctx.fillRect(14, 16 + i * 7, 60 + ((i * 37) % 40), 2);
    ctx.fillStyle = 'rgba(110,80,40,0.25)';
    ctx.beginPath();
    ctx.arc(90, 90, 26, 0, 7);
    ctx.fill();
  });
}

// Placas e letreiros com texto
export function signTex(text, opts = {}) {
  const w = opts.w || 512;
  const h = opts.h || 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || '#1c1a17';
  ctx.fillRect(0, 0, w, h);
  if (opts.border !== false) {
    ctx.strokeStyle = opts.borderColor || 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }
  ctx.fillStyle = opts.fg || '#e8e0c8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const fs = opts.size || Math.min(h / (lines.length + 0.6), (w / Math.max(...lines.map((l) => l.length))) * 1.6);
  ctx.font = `${opts.weight || 'bold'} ${fs}px ${opts.font || 'Georgia, serif'}`;
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
  // desgaste
  const r = mulberry32(text.length * 13 + 5);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.3})`;
    ctx.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 6);
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(30,15,5,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Textura desenhada livremente (cartazes, desenhos, quadros)
export function drawnTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
