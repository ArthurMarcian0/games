// Esqueletos procedurais (humanoide e quadrúpede) montados com primitivas,
// mais modelos de armas. Animação feita por código (rotação das juntas).
import * as THREE from 'three';
import { charMat, emissive } from '../engine/materials.js';

const capCache = new Map();
function capsule(r, len) {
  const k = `${r.toFixed(3)}_${len.toFixed(3)}`;
  if (!capCache.has(k)) capCache.set(k, new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 10));
  return capCache.get(k);
}
const boxCache = new Map();
function box(w, h, d) {
  const k = `${w}_${h}_${d}`;
  if (!boxCache.has(k)) boxCache.set(k, new THREE.BoxGeometry(w, h, d));
  return boxCache.get(k);
}
const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function limb(parent, r, len, mat, r2 = r) {
  const m = mesh(capsule((r + r2) / 2, len), mat, parent, 0, -len / 2, 0);
  return m;
}

export function buildHumanoid(o = {}) {
  const H = o.height || 1.78;
  const s = H / 1.78;
  const bulk = o.bulk || 1;
  const armL = o.armLength || 1;
  const skin = o.skinMat || charMat(o.skin ?? 0xc79a7a, 0.7, { tex: 'skin' });
  const shirt = o.shirtMat || charMat(o.shirt ?? 0x4a4a48, 0.9, { tex: 'fabric' });
  const pants = o.pantsMat || charMat(o.pants ?? 0x2a3040, 0.9, { tex: 'fabric' });
  const shoes = o.shoesMat || charMat(o.shoes ?? 0x1a1612, 0.6);
  const jacket = o.jacketMat || shirt;

  const root = new THREE.Group();
  const rig = { root, s, H };
  const legLen = 0.92 * s;
  const thigh = 0.45 * s;
  const shin = 0.42 * s;
  rig.hips = group(root, 0, legLen, 0);
  rig.spine = group(rig.hips, 0, 0.02 * s, 0);
  // tronco
  const torsoLen = 0.32 * s;
  const tw = 0.17 * s * bulk;
  const torso = mesh(capsule(tw, torsoLen), jacket, rig.spine, 0, 0.24 * s, 0);
  torso.scale.set(1, 1, 0.68);
  mesh(capsule(tw * 0.92, 0.1 * s), pants, rig.spine, 0, 0.02 * s, 0).scale.set(1.05, 1, 0.75);
  rig.chest = group(rig.spine, 0, 0.36 * s, 0);
  const chestM = mesh(capsule(tw * 1.08, 0.12 * s), jacket, rig.chest, 0, 0.04 * s, 0);
  chestM.scale.set(1.2, 1, 0.72);
  rig.neck = group(rig.chest, 0, 0.17 * s, 0);
  mesh(capsule(0.05 * s, 0.06 * s), skin, rig.neck, 0, 0.04 * s, 0);
  rig.head = group(rig.neck, 0, 0.1 * s, 0);
  buildHead(rig, o, skin, s);

  // braços
  const shW = 0.22 * s * bulk;
  const up = 0.29 * s * armL;
  const fore = 0.27 * s * armL;
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'r' : 'l'; // o personagem olha para +z: a direita fica em -x
    const sh = group(rig.chest, side * shW, 0.1 * s, 0);
    limb(sh, 0.055 * s * bulk, up, jacket);
    const el = group(sh, 0, -up, 0);
    limb(el, 0.045 * s * bulk, fore, o.sleeves === false ? skin : jacket);
    const hand = group(el, 0, -fore, 0);
    const hm = mesh(box(0.07 * s, 0.1 * s, 0.04 * s), skin, hand, 0, -0.05 * s, 0);
    if (o.claws) {
      for (let i = -1; i <= 1; i++) {
        const c = mesh(cylGeo, o.clawMat || charMat(0x1a1410, 0.4), hand, i * 0.02 * s, -0.16 * s, 0.01);
        c.scale.set(0.008 * s, 0.14 * s, 0.008 * s);
        c.rotation.x = 0.2;
      }
    }
    hm.userData.hand = true;
    rig[key + 'Sh'] = sh;
    rig[key + 'El'] = el;
    rig[key + 'Hand'] = hand;
  }
  // pernas
  const hipW = 0.1 * s * bulk;
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'r' : 'l';
    const hip = group(rig.hips, side * hipW, 0, 0);
    limb(hip, 0.075 * s * bulk, thigh, pants);
    const knee = group(hip, 0, -thigh, 0);
    limb(knee, 0.06 * s * bulk, shin - 0.05 * s, pants);
    const foot = group(knee, 0, -shin + 0.03 * s, 0);
    mesh(box(0.1 * s, 0.07 * s, 0.25 * s), shoes, foot, 0, -0.01 * s, 0.05 * s);
    rig[key + 'Hip'] = hip;
    rig[key + 'Knee'] = knee;
    rig[key + 'Foot'] = foot;
  }
  if (o.coat) {
    // sobretudo: saia cônica presa ao quadril
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s * bulk, 0.34 * s * bulk, 0.75 * s, 12, 1, true), o.coatMat || jacket);
    coat.position.y = -0.3 * s;
    coat.castShadow = true;
    coat.material.side = THREE.DoubleSide;
    rig.hips.add(coat);
    rig.coat = coat;
  }
  if (o.extras) o.extras(rig, s);
  root.traverse((c) => {
    if (c.isMesh) c.userData.rigPart = true;
  });
  return rig;
}

function buildHead(rig, o, skin, s) {
  const h = rig.head;
  const style = o.head || 'human';
  if (style === 'gasmask') {
    const mat = o.maskMat || charMat(0x1c1c1a, 0.6);
    mesh(sphereGeo, mat, h, 0, 0.1 * s, 0).scale.set(0.12 * s, 0.14 * s, 0.13 * s);
    const snout = mesh(cylGeo, mat, h, 0, 0.04 * s, 0.13 * s);
    snout.scale.set(0.05 * s, 0.1 * s, 0.05 * s);
    snout.rotation.x = Math.PI / 2 + 0.4;
    const filt = mesh(cylGeo, charMat(0x2a2a26, 0.5, { metal: 0.6 }), h, 0, 0.0, 0.2 * s);
    filt.scale.set(0.06 * s, 0.05 * s, 0.06 * s);
    filt.rotation.x = Math.PI / 2 + 0.4;
    const eyeM = emissive(o.eyeColor ?? 0xff5a1a, o.eyeIntensity ?? 2.5);
    for (const sx of [-1, 1]) {
      const e = mesh(sphereGeo, eyeM, h, sx * 0.05 * s, 0.13 * s, 0.11 * s);
      e.scale.set(0.03 * s, 0.03 * s, 0.015 * s);
      e.castShadow = false;
    }
    rig.eyes = true;
    return;
  }
  const headM = mesh(sphereGeo, skin, h, 0, 0.1 * s, 0.01 * s);
  headM.scale.set(0.105 * s, 0.13 * s, 0.115 * s);
  // mandíbula
  rig.jaw = group(h, 0, 0.04 * s, 0.02 * s);
  const jm = mesh(sphereGeo, skin, rig.jaw, 0, -0.01 * s, 0.03 * s);
  jm.scale.set(0.08 * s, 0.045 * s, 0.08 * s);
  // nariz
  const nose = mesh(sphereGeo, skin, h, 0, 0.09 * s, 0.115 * s);
  nose.scale.set(0.018 * s, 0.03 * s, 0.025 * s);
  if (style === 'infected') {
    const eyeM = charMat(0xd8d2a0, 0.3, { emissive: 0x302810, ei: 0.4 });
    for (const sx of [-1, 1]) {
      const e = mesh(sphereGeo, eyeM, h, sx * 0.04 * s, 0.12 * s, 0.1 * s);
      e.scale.setScalar(0.017 * s);
    }
    if (o.hair !== undefined) {
      const hair = mesh(sphereGeo, charMat(o.hair, 0.95), h, 0, 0.14 * s, -0.02 * s);
      hair.scale.set(0.11 * s, 0.1 * s, 0.11 * s);
    }
  } else {
    const eyeM = charMat(0x1a1410, 0.3);
    for (const sx of [-1, 1]) {
      const e = mesh(sphereGeo, eyeM, h, sx * 0.04 * s, 0.12 * s, 0.105 * s);
      e.scale.setScalar(0.012 * s);
    }
    if (o.hair !== undefined && o.hair !== null) {
      const hm = charMat(o.hair, 0.95);
      const hair = mesh(sphereGeo, hm, h, 0, 0.15 * s, -0.015 * s);
      hair.scale.set(0.112 * s, 0.1 * s, 0.12 * s);
      if (o.longHair) {
        const back = mesh(capsule(0.09 * s, 0.12 * s), hm, h, 0, 0.04 * s, -0.06 * s);
        back.scale.set(1.1, 1, 0.6);
      }
    }
    if (o.beard) {
      const b = mesh(sphereGeo, charMat(o.beard, 0.95), rig.jaw, 0, -0.015 * s, 0.04 * s);
      b.scale.set(0.085 * s, 0.05 * s, 0.075 * s);
    }
  }
  if (style === 'cap') {
    const cm = charMat(o.capColor ?? 0x1b2333, 0.7);
    const cap = mesh(cylGeo, cm, h, 0, 0.2 * s, 0);
    cap.scale.set(0.12 * s, 0.06 * s, 0.12 * s);
    const brim = mesh(cylGeo, cm, h, 0, 0.18 * s, 0.07 * s);
    brim.scale.set(0.1 * s, 0.01 * s, 0.09 * s);
  }
}

export function resetPose(rig) {
  const parts = ['hips', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKnee', 'rHip', 'rKnee', 'lFoot', 'rFoot', 'lHand', 'rHand'];
  for (const p of parts) if (rig[p]) rig[p].rotation.set(0, 0, 0);
  if (rig.jaw) rig.jaw.rotation.set(0, 0, 0);
}

// ciclo de caminhada; amount 0..1 (amplitude), run 0..1
export function gait(rig, phase, amount, run = 0, opts = {}) {
  const sw = (0.45 + run * 0.35) * amount;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  rig.lHip.rotation.x = -s * sw;
  rig.rHip.rotation.x = s * sw;
  rig.lKnee.rotation.x = Math.max(0, c) * (0.6 + run * 0.6) * amount + 0.05;
  rig.rKnee.rotation.x = Math.max(0, -c) * (0.6 + run * 0.6) * amount + 0.05;
  rig.lFoot.rotation.x = -rig.lHip.rotation.x * 0.3;
  rig.rFoot.rotation.x = -rig.rHip.rotation.x * 0.3;
  if (!opts.noArms) {
    rig.lSh.rotation.x = s * sw * 0.8;
    rig.rSh.rotation.x = -s * sw * 0.8;
    rig.lEl.rotation.x = -(0.2 + run * 0.9) * Math.max(0.3, amount);
    rig.rEl.rotation.x = -(0.2 + run * 0.9) * Math.max(0.3, amount);
  }
  rig.hips.position.y = rig.s * 0.92 - Math.abs(c) * 0.04 * amount * (1 + run) + (opts.drop || 0);
  rig.spine.rotation.y = s * 0.08 * amount;
  rig.spine.rotation.x = run * 0.25 * amount + (opts.lean || 0);
}

// ---------------------------------------------------------------- quadrúpede
export function buildQuadruped(o = {}) {
  const L = o.length || 1.2;
  const legLen = o.legLen || 0.55;
  const mat = o.mat || charMat(0x6a2a24, 0.5, { tex: 'flesh' });
  const root = new THREE.Group();
  const rig = { root, legLen, L, legs: [] };
  rig.body = group(root, 0, legLen, 0);
  const torso = mesh(capsule(o.bodyR || 0.18, L * 0.7), mat, rig.body);
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(o.bodyW || 1, 1, o.bodyH || 1);
  if (o.ribs) {
    for (let i = 0; i < 5; i++) {
      const rib = mesh(new THREE.TorusGeometry((o.bodyR || 0.18) * 1.02, 0.012, 4, 12, Math.PI), o.ribMat || charMat(0xc9bea2, 0.6), rig.body, 0, 0, -0.1 + i * 0.07);
      rib.rotation.z = Math.PI;
    }
  }
  rig.neck = group(rig.body, 0, 0.05, L * 0.42);
  const nl = o.neckLen || 0.25;
  const nm = mesh(capsule(o.neckR || 0.08, nl), mat, rig.neck, 0, nl * 0.3, nl * 0.4);
  nm.rotation.x = Math.PI / 4;
  rig.head = group(rig.neck, 0, nl * 0.65, nl * 0.75);
  const hl = o.headLen || 0.28;
  const hm = mesh(capsule(o.headR || 0.08, hl), o.headMat || mat, rig.head, 0, 0, hl * 0.4);
  hm.rotation.x = Math.PI / 2;
  rig.jaw = group(rig.head, 0, -0.04, 0.05);
  const jm = mesh(capsule((o.headR || 0.08) * 0.7, hl * 0.8), o.headMat || mat, rig.jaw, 0, -0.02, hl * 0.4);
  jm.rotation.x = Math.PI / 2;
  if (o.teeth) {
    const tm = charMat(0xd8d0b0, 0.4);
    for (let i = 0; i < 6; i++) {
      const t = mesh(new THREE.ConeGeometry(0.008, 0.04, 4), tm, rig.jaw, (i % 2 ? 1 : -1) * 0.03, 0.02, 0.06 + i * 0.03);
      t.castShadow = false;
    }
  }
  // pernas
  const up = legLen * 0.52;
  const low = legLen * 0.5;
  for (const front of [true, false]) {
    for (const side of [-1, 1]) {
      const hip = group(rig.body, side * (o.hipW || 0.12), 0, (front ? 1 : -1) * L * 0.33);
      limb(hip, o.legR || 0.05, up, mat);
      const knee = group(hip, 0, -up, 0);
      limb(knee, (o.legR || 0.05) * 0.7, low, o.lowerLegMat || mat);
      rig.legs.push({ hip, knee, side, front });
    }
  }
  rig.tail = group(rig.body, 0, 0.04, -L * 0.45);
  if (o.tail !== false) {
    const tm = mesh(capsule(0.025, 0.3), mat, rig.tail, 0, 0, -0.15);
    tm.rotation.x = Math.PI / 2 + 0.4;
  }
  if (o.extras) o.extras(rig);
  return rig;
}

export function quadGait(rig, phase, amount, gallop = 0) {
  for (const leg of rig.legs) {
    const off = (leg.front ? 0 : Math.PI) + (leg.side > 0 ? Math.PI * (gallop ? 0.15 : 1) : 0);
    const s = Math.sin(phase + off);
    leg.hip.rotation.x = s * 0.6 * amount;
    leg.knee.rotation.x = (leg.front ? -1 : 1) * Math.max(0, Math.cos(phase + off)) * 0.8 * amount;
  }
  rig.body.position.y = rig.legLen - Math.abs(Math.sin(phase * 2)) * 0.03 * amount;
  rig.body.rotation.x = Math.sin(phase) * 0.05 * amount * (1 + gallop * 2);
}

// ---------------------------------------------------------------- armas
export function buildWeapon(type) {
  const g = new THREE.Group();
  const dark = charMat(0x1a1b1d, 0.35, { metal: 0.7 });
  const grip = charMat(0x2a2420, 0.7);
  const wood = charMat(0x4a2e1a, 0.6, { tex: 'wood' });
  if (type === 'pistol') {
    mesh(box(0.035, 0.05, 0.2), dark, g, 0, 0.02, 0.06);
    const gr = mesh(box(0.032, 0.11, 0.05), grip, g, 0, -0.035, -0.01);
    gr.rotation.x = 0.25;
    g.userData.muzzle = new THREE.Vector3(0, 0.03, 0.17);
  } else if (type === 'shotgun') {
    const barrel = mesh(cylGeo, dark, g, 0, 0.03, 0.3);
    barrel.scale.set(0.018, 0.65, 0.018);
    barrel.rotation.x = Math.PI / 2;
    const tube = mesh(cylGeo, dark, g, 0, -0.005, 0.25);
    tube.scale.set(0.015, 0.5, 0.015);
    tube.rotation.x = Math.PI / 2;
    mesh(box(0.05, 0.07, 0.22), dark, g, 0, 0.01, 0.0);
    const pump = mesh(cylGeo, wood, g, 0, -0.005, 0.25);
    pump.scale.set(0.027, 0.16, 0.027);
    pump.rotation.x = Math.PI / 2;
    g.userData.pump = pump;
    const stock = mesh(box(0.045, 0.09, 0.3), wood, g, 0, -0.03, -0.24);
    stock.rotation.x = 0.12;
    g.userData.muzzle = new THREE.Vector3(0, 0.03, 0.63);
  } else if (type === 'pipe') {
    const p = mesh(cylGeo, charMat(0x5a3a26, 0.8, { tex: 'rust', metal: 0.4 }), g, 0, 0, 0.3);
    p.scale.set(0.022, 0.75, 0.022);
    p.rotation.x = Math.PI / 2;
    const tape = mesh(cylGeo, charMat(0x111111, 0.9), g, 0, 0, 0.02);
    tape.scale.set(0.026, 0.14, 0.026);
    tape.rotation.x = Math.PI / 2;
    const joint = mesh(cylGeo, charMat(0x4a4a48, 0.5, { metal: 0.6 }), g, 0, 0, 0.66);
    joint.scale.set(0.035, 0.06, 0.035);
    joint.rotation.x = Math.PI / 2;
  }
  g.traverse((c) => {
    if (c.isMesh) c.castShadow = true;
  });
  return g;
}

export function buildFlashlightModel() {
  const g = new THREE.Group();
  const body = mesh(cylGeo, charMat(0x222222, 0.5, { metal: 0.5 }), g, 0, 0, 0);
  body.scale.set(0.025, 0.12, 0.025);
  body.rotation.x = Math.PI / 2;
  const lens = mesh(cylGeo, emissive(0xfff2d0, 2), g, 0, 0, 0.065);
  lens.scale.set(0.022, 0.01, 0.022);
  lens.rotation.x = Math.PI / 2;
  g.userData.lens = lens;
  return g;
}
