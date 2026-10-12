// Catálogo de materiais (cacheados e compartilhados entre mapas).
import * as THREE from 'three';
import { getTex, bloodTex, paperTex, softTex } from './textures.js';

// tile = metros cobertos por uma repetição da textura
const DEFS = {
  asphalt: { tex: 'asphalt', tile: 6, rough: 1, normalScale: 0.8 },
  sidewalk: { tex: 'sidewalk', tile: 3, rough: 1 },
  brick: { tex: 'brick', tile: 2.4, rough: 0.9 },
  brickDark: { tex: 'brick', tile: 2.4, rough: 0.9, color: 0x6a6460 },
  plaster: { tex: 'plaster', tile: 3, rough: 0.92 },
  plasterGreen: { tex: 'plaster', tile: 3, rough: 0.9, color: 0x9fb0a0 },
  plasterBlue: { tex: 'plaster', tile: 3, rough: 0.9, color: 0x96a3b3 },
  plasterDark: { tex: 'plaster', tile: 3, rough: 0.92, color: 0x857a6c },
  wallpaper: { tex: 'wallpaper', tile: 2.5, rough: 0.9 },
  wallpaperRed: { tex: 'wallpaper', tile: 2.5, rough: 0.9, color: 0xc49a90 },
  woodfloor: { tex: 'woodfloor', tile: 4, rough: 1 },
  wood: { tex: 'wood', tile: 1.5, rough: 0.7 },
  woodDark: { tex: 'wood', tile: 1.5, rough: 0.6, color: 0x6e5a4a },
  oldwood: { tex: 'oldwood', tile: 2.5, rough: 0.95 },
  tilefloor: { tex: 'tilefloor', tile: 3.6, rough: 1 },
  tilewall: { tex: 'tilewall', tile: 1.6, rough: 1 },
  concrete: { tex: 'concrete', tile: 3, rough: 1 },
  concreteDark: { tex: 'concrete', tile: 3, rough: 1, color: 0x77736e },
  metal: { tex: 'metal', tile: 2, rough: 1, metal: 0.55 },
  metalDark: { tex: 'metal', tile: 2, rough: 1, metal: 0.5, color: 0x55585c },
  metalPaint: { tex: 'metal', tile: 2, rough: 1, metal: 0.2, color: 0x6f7a6a },
  rust: { tex: 'rust', tile: 1.5, rough: 0.95, metal: 0.3 },
  grass: { tex: 'grass', tile: 5, rough: 1 },
  forestfloor: { tex: 'forestfloor', tile: 5, rough: 1 },
  dirt: { tex: 'dirt', tile: 4, rough: 1 },
  bark: { tex: 'bark', tile: 1.2, rough: 0.95 },
  rock: { tex: 'rock', tile: 5, rough: 1 },
  ceiling: { tex: 'ceiling', tile: 2.4, rough: 0.95 },
  carpet: { tex: 'carpet', tile: 2, rough: 1 },
  labpanel: { tex: 'labpanel', tile: 2.4, rough: 1 },
  labfloor: { tex: 'tilefloor', tile: 2.4, rough: 1, color: 0xc8ccd0 },
  roof: { tex: 'roof', tile: 3, rough: 0.8 },
  fabric: { tex: 'fabric', tile: 0.6, rough: 1, color: 0x55504a },
  fabricRed: { tex: 'fabric', tile: 0.6, rough: 1, color: 0x6a2a24 },
  fabricGreen: { tex: 'fabric', tile: 0.6, rough: 1, color: 0x51604f },
  fabricWhite: { tex: 'fabric', tile: 0.6, rough: 1, color: 0xb8b4a8 },
  flesh: { tex: 'flesh', tile: 1.2, rough: 1 },
  leaves: { tex: 'leaves', tile: 2, rough: 0.9 },
  water: { tex: 'water', tile: 4, rough: 0.05, metal: 0.1, normalScale: 0.4 },
  // sem textura
  black: { color: 0x050505, rough: 0.9 },
  glassDark: { color: 0x0a0e10, rough: 0.05, metal: 0.6 },
  glass: { color: 0x9db0b8, rough: 0.05, metal: 0.2, transparent: true, opacity: 0.25 },
  chrome: { color: 0x9a9ea2, rough: 0.25, metal: 0.95 },
  rubber: { color: 0x141414, rough: 0.9 },
  paintRed: { color: 0x6a1410, rough: 0.5 },
  paintWhite: { color: 0xc8c6be, rough: 0.6 },
  paintYellow: { color: 0xb08a1c, rough: 0.6 },
  paintBlue: { color: 0x1d2c48, rough: 0.5 },
  paintGreen: { color: 0x2d3d2e, rough: 0.6 },
  plastic: { color: 0x9a968c, rough: 0.55 },
  plasticDark: { color: 0x2a2a2c, rough: 0.5 },
  mattress: { tex: 'fabric', tile: 0.8, rough: 1, color: 0x9a9480 },
  bone: { tex: 'skin', tile: 0.6, color: 0xc9bea2, rough: 0.6 },
  paper: { map: () => paperTex(), rough: 1, side: THREE.DoubleSide },
};

const cache = new Map();

export function getMaterial(name) {
  if (cache.has(name)) return cache.get(name);
  const d = DEFS[name];
  if (!d) throw new Error('Material desconhecido: ' + name);
  const params = {
    color: d.color ?? 0xffffff,
    roughness: d.rough ?? 0.9,
    metalness: d.metal ?? 0,
  };
  if (d.tex) {
    const t = getTex(d.tex);
    params.map = t.map;
    if (t.normalMap) {
      params.normalMap = t.normalMap;
      const s = d.normalScale ?? 1;
      params.normalScale = new THREE.Vector2(s, -s);
    }
    if (t.roughnessMap) params.roughnessMap = t.roughnessMap;
  }
  if (d.map) params.map = d.map();
  if (d.transparent) {
    params.transparent = true;
    params.opacity = d.opacity;
    params.depthWrite = false;
  }
  if (d.side) params.side = d.side;
  const m = new THREE.MeshStandardMaterial(params);
  m.userData.tile = d.tile || 1;
  m.userData.shared = true;
  cache.set(name, m);
  return m;
}

export function tileOf(name) {
  return DEFS[name]?.tile || 1;
}

export function hasMaterial(name) {
  return !!DEFS[name];
}

// materiais especiais
const special = new Map();
function sp(key, make) {
  if (!special.has(key)) {
    const m = make();
    m.userData.shared = true;
    special.set(key, m);
  }
  return special.get(key);
}

export const emissive = (color, intensity = 1) =>
  sp(`em${color}_${intensity}`, () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.6 }));

export const basic = (color, opts = {}) => sp(`basic${color}${JSON.stringify(opts)}`, () => new THREE.MeshBasicMaterial({ color, ...opts }));

export const bloodMat = (variant = 0) =>
  sp('blood' + variant, () => {
    const m = new THREE.MeshStandardMaterial({
      map: bloodTex(variant),
      transparent: true,
      depthWrite: false,
      roughness: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    return m;
  });

export const glowMat = (color, opacity = 0.5) =>
  sp(`glow${color}_${opacity}`, () => new THREE.MeshBasicMaterial({ color, map: softTex(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));

export const charMat = (color, rough = 0.85, opts = {}) =>
  sp(`char${color}_${rough}_${JSON.stringify(opts)}`, () => {
    const p = { color, roughness: rough, metalness: opts.metal || 0 };
    if (opts.tex) {
      const t = getTex(opts.tex);
      p.map = t.map;
      if (t.normalMap) p.normalMap = t.normalMap;
    }
    if (opts.emissive) {
      p.emissive = opts.emissive;
      p.emissiveIntensity = opts.ei ?? 1;
    }
    return new THREE.MeshStandardMaterial(p);
  });
