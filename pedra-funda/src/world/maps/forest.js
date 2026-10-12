// ÁREA 4 — Mata da Funda (externa). Chefe: O Cervo Pálido. Enigma: discos da mina.
import * as THREE from 'three';
import { makeKit, P } from './kit.js';
import { RADIO } from '../../game/Story.js';
import { getMaterial } from '../../engine/materials.js';
import { mulberry32 } from '../../core/utils.js';

const PATHS = [
  [0, 54, 0, 20],
  [0, 20, -50, 20],
  [0, 20, 9, -2],
  [9, -2, 10, -8],
  [10, -8, 3, -30],
  [3, -30, 0, -42],
  [0, -60, 0, -76],
];
const CLEARINGS = [
  { x: 10, z: -9, r: 8.5 },
  { x: 0, z: -56, r: 18 },
  { x: 0, z: 20, r: 5 },
  { x: -15, z: 15, r: 6 },
  { x: 0, z: 50, r: 6 },
];

function distSeg(px, pz, [x0, z0, x1, z1]) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t));
}

function freeSpot(x, z, margin) {
  for (const p of PATHS) if (distSeg(x, z, p) < 2.2 + margin) return false;
  for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return false;
  if (z > 53) return false;
  if (z < -75 && Math.abs(x) < 30) return false;
  return true;
}

function forestTrees(L, w) {
  const rng = mulberry32(777);
  const trunks = [];
  const dead = [];
  const b = { x0: -58, x1: 38, z0: -92, z1: 56 };
  for (let x = b.x0; x < b.x1; x += 3.4) {
    for (let z = b.z0; z < b.z1; z += 3.4) {
      const tx = x + (rng() - 0.5) * 2.6;
      const tz = z + (rng() - 0.5) * 2.6;
      if (!freeSpot(tx, tz, rng() * 1.2)) continue;
      if (rng() < 0.12) continue;
      const s = 0.8 + rng() * 0.7;
      if (rng() < 0.14) dead.push({ x: tx, z: tz, s });
      else trunks.push({ x: tx, z: tz, s });
      w.collision.add(tx - 0.3 * s, tz - 0.3 * s, tx + 0.3 * s, tz + 0.3 * s, 6);
    }
  }
  const all = trunks.concat(dead);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  const tMesh = new THREE.InstancedMesh(trunkGeo, getMaterial('bark'), all.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  all.forEach((t, i) => {
    const h = dead.includes(t) ? 5 + t.s * 3 : 3 * t.s;
    q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.08, rng() * 6, (rng() - 0.5) * 0.08));
    m.compose(pos.set(t.x, 0, t.z), q, sc.set(t.s * 1.2, h, t.s * 1.2));
    tMesh.setMatrixAt(i, m);
  });
  tMesh.frustumCulled = false;
  tMesh.castShadow = true;
  tMesh.receiveShadow = true;
  L.scene.add(tMesh);
  const coneGeo = new THREE.ConeGeometry(1, 1, 8);
  coneGeo.translate(0, 0.5, 0);
  const layers = 3;
  const cMesh = new THREE.InstancedMesh(coneGeo, getMaterial('leaves'), trunks.length * layers);
  let k = 0;
  for (const t of trunks) {
    for (let l = 0; l < layers; l++) {
      const r = (1.9 - l * 0.45) * t.s;
      q.setFromEuler(new THREE.Euler(0, rng() * 6, 0));
      m.compose(pos.set(t.x, (1.8 + l * 1.5) * t.s, t.z), q, sc.set(r, 2.6 * t.s, r));
      cMesh.setMatrixAt(k++, m);
    }
  }
  cMesh.frustumCulled = false;
  cMesh.castShadow = true;
  cMesh.receiveShadow = true;
  L.scene.add(cMesh);
  // galhos secos nas árvores mortas
  for (const t of dead.slice(0, 60)) {
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const y = (2.5 + rng() * 3) * t.s;
      const len = (1 + rng() * 1.2) * t.s;
      L.push(t.x, y, t.z, a);
      L.cyl(0, 0, len / 2, 0.05 * t.s, len, 'bark', { rx: 1.0 + rng() * 0.4, center: true, collide: false, rTop: 0.015, seg: 5 });
      L.pop();
    }
  }
  // arbustos
  const bushGeo = new THREE.SphereGeometry(1, 8, 6);
  const bushes = [];
  for (let i = 0; i < 260; i++) {
    const x = b.x0 + rng() * (b.x1 - b.x0);
    const z = b.z0 + rng() * (b.z1 - b.z0);
    if (!freeSpot(x, z, -0.6)) continue;
    bushes.push({ x, z, s: 0.5 + rng() * 0.7 });
  }
  const bMesh = new THREE.InstancedMesh(bushGeo, getMaterial('leaves'), bushes.length);
  bushes.forEach((bs, i) => {
    m.compose(pos.set(bs.x, bs.s * 0.35, bs.z), q.setFromEuler(new THREE.Euler(0, rng() * 6, 0)), sc.set(bs.s * 1.2, bs.s * 0.7, bs.s));
    bMesh.setMatrixAt(i, m);
  });
  bMesh.frustumCulled = false;
  bMesh.receiveShadow = true;
  bMesh.castShadow = true;
  L.scene.add(bMesh);
}

function pathStrip(L, x0, z0, x1, z1, wdt = 3.6) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(x1 - x0, z1 - z0);
  L.push((x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
  L.box(0, -0.09, 0, wdt, 0.1, len + 1.5, 'dirt', { collide: false });
  L.pop();
}

export default {
  id: 'forest',
  rain: true,
  mist: true,
  mistColor: 0x56606a,
  mistOpacity: 0.32,
  fog: { color: 0x182028, density: 0.045 },
  sky: 0x34424e,
  ground: 0x0a0b08,
  ambient: 0.3,
  ambience: 'forest',
  music: 'explore',
  surface: 'mud',
  bounds: { minX: -60, minZ: -95, maxX: 40, maxZ: 64 },
  mapDraw: [
    { x0: -2, x1: 2, z0: 20, z1: 54, kind: 'road' },
    { x0: -50, x1: 0, z0: 18, z1: 22, kind: 'road' },
    { x0: 0, x1: 11, z0: -8, z1: 20, kind: 'road' },
    { x0: 0, x1: 11, z0: -42, z1: -8, kind: 'road' },
    { x0: -18, x1: 18, z0: -74, z1: -38, kind: 'road', label: 'Clareira da mina' },
    { x0: -20, x1: 20, z0: 56, z1: 62, kind: 'building', label: 'Hospital' },
    { x0: -30, x1: 30, z0: -82, z1: -77, kind: 'building', label: 'Rocha / Mina' },
    { x0: -54, x1: -52, z0: 17, z1: 23, kind: 'building', label: '→ Cidade' },
    { x0: -19, x1: -13, z0: 12, z1: 18, kind: 'building', label: 'Caminhão' },
  ],

  build(L, g, w) {
    const K = makeKit(L, g, w);
    L.spawn('fromHospital', 0, 53.4, Math.PI);
    L.spawn('fromTown', -50.4, 20, Math.PI / 2);
    L.spawn('fromTunnels', 0, -74.8, 0);
    L.spawn('default', 0, 53.4, Math.PI);
    const moon = new THREE.DirectionalLight(0x8a9ab8, 0.35);
    moon.position.set(-30, 50, 20);
    L.scene.add(moon);

    L.floor(-60, -95, 40, 64, 'forestfloor');
    for (const p of PATHS) pathStrip(L, ...p);
    L.floor(-15, -72, 15, -40, 'dirt', 0.004);
    L.wall(-60, 62, 40, 64);
    L.wall(-60, -95, 40, -93);
    L.wall(-60, -95, -58, 64);
    L.wall(38, -95, 40, 64);
    forestTrees(L, w);

    // ---------------------------------------------------------------- fundos do hospital
    L.box(0, 0, 59.5, 44, 12, 7, 'concrete');
    for (let i = -4; i <= 4; i++) if (i) L.box(i * 4.4, 4, 55.97, 1.2, 1.4, 0.05, 'glassDark', { collide: false });
    L.door({ id: 'd_hosp', x: 0, z: 56, axis: 'x', w: 1.6, kind: 'security', lock: { flag: 'chase_done', msg: 'Trancada.' }, to: { map: 'hospital', spawn: 'fromForest' } });
    K.light({ x: 0, y: 2.9, z: 55.2, color: 0x60ff80, intensity: 3, distance: 7 });
    P.sign(L, 0, 2.7, 55.94, 1.2, 0.35, 'SAÍDA DE SERVIÇO', Math.PI, { emissive: 1.2, bg: '#0a3a10', fg: '#60ff80' });
    P.dumpster(L, 5, 54, 0);
    P.trashBags(L, -4, 54, 4);

    // ---------------------------------------------------------------- bifurcação + portão para a cidade
    L.cyl(1.8, 0, 21.8, 0.08, 2.4, 'oldwood', { seg: 6 });
    L.box(1.8, 2.4, 22.0, 0.05, 0.05, 0.5, 'oldwood', { collide: false });
    P.bulb(L, 1.8, 2.3, 22.3, true, 0xffb060);
    K.light({ x: 1.8, y: 1.9, z: 22.3, color: 0xffb060, intensity: 5, distance: 9, flicker: 0.2 });
    P.sign(L, 2.2, 1.6, 21.8, 1.4, 0.35, '← CIDADE    CABANA ↑', Math.PI / 2, { bg: '#3a2a18', fg: '#d8c8a0', font: 'Georgia' });
    P.woodFence(L, -52.4, 8, -52.4, 18);
    P.woodFence(L, -52.4, 22, -52.4, 32);
    L.box(-52.4, 0, 17.9, 0.5, 2.6, 0.5, 'oldwood');
    L.box(-52.4, 0, 22.1, 0.5, 2.6, 0.5, 'oldwood');
    L.door({
      id: 'g_town',
      x: -52.4,
      z: 20,
      axis: 'z',
      w: 3.6,
      h: 2.4,
      kind: 'gate',
      lock: {
        flag: 'forest_gate_open',
        msg: (g) => {
          g.setFlag('forest_gate_open');
          g.audio.play('unlock');
          return 'Você abriu o cadeado por este lado. O portão agora é um atalho de volta para a cidade.';
        },
      },
      to: { map: 'town', spawn: 'fromForest' },
    });
    K.item('f_herb1', 'herb', -30, 18.4, { y: 0.02 });

    // ---------------------------------------------------------------- caminhão da Vértice
    P.truck(L, -16, 15, 1.25, { logo: 'VÉRTICE\nBIOTECNOLOGIA', open: true });
    P.crate(L, -18.6, 18.2, 0.9, 0.3);
    P.crate(L, -17.6, 19, 0.7, 0.1);
    K.doc('d_ordem', 'ordem_transporte', -13.6, 16.8, { y: 0.02 });
    K.item('f_ammo_truck', 'ammo_pistol', -18.6, 18.2, { y: 0.92, qty: 8 });
    K.examine(-19.2, 13.6, 'A caçamba do caminhão está vazia, mas cheia de arranhões por dentro. Jaulas abertas. Pelos brancos presos nas grades.', { r: 2 });
    K.decal(-14, 13, 1.6, 2);

    // ---------------------------------------------------------------- cabana do caçador (segura)
    const cab = { h: 2.8, wall: 'oldwood', floor: 'oldwood', ceil: 'oldwood', outer: 'oldwood', roof: 'roof', parapet: 0.2, safe: true };
    L.room({ ...cab, id: 'cabin', name: 'Cabana do caçador', x0: 4, x1: 14, z0: -14, z1: -5, windows: [{ side: 's', a: 5.2, b: 6.8, glass: true }, { side: 'w', a: -11, b: -9.4, glass: true }] });
    L.room({ ...cab, id: 'cabin_secret', name: 'Esconderijo', x0: 14, x1: 17, z0: -14, z1: -9, map: true });
    L.box(10.5, 2.9, -9.5, 13.6, 0.4, 9.8, 'roof', { collide: false, rx: 0 });
    L.door({ id: 'd_cabin', x: 9, z: -5, axis: 'x', w: 1.2, kind: 'wood' });
    L.door({ id: 'd_shelf', x: 14, z: -11.5, axis: 'z', w: 1.3, h: 2.2, kind: 'shelf', lock: { flag: 'read_abilio', msg: 'Uma estante pesada, encostada na parede. Há marcas de arrasto no assoalho.' } });
    L.box(9, 0, -4.4, 2, 0.2, 1, 'oldwood', { collide: false });
    P.table(L, 8.5, -9.5, 0, 1.4, 0.9, 'oldwood');
    P.chair(L, 8.5, -8.6, Math.PI, 'oldwood');
    P.bed(L, 5.4, -12.4, Math.PI / 2, { frame: 'oldwood', sheetMat: 'fabric' });
    P.stove(L, 13.2, -6, -Math.PI / 2);
    L.box(4.3, 1.6, -7.5, 0.05, 0.4, 1.6, 'woodDark', { collide: false });
    L.box(4.35, 1.65, -7.5, 0.05, 0.05, 1.4, 'metalDark', { collide: false });
    K.save(11.6, -13.2, 0);
    K.storage(13.4, -8.6, -Math.PI / 2);
    P.bulb(L, 8.5, 2.75, -9.5, true, 0xffa050);
    K.light({ x: 8.5, y: 2.2, z: -9.5, color: 0xffa050, intensity: 6, distance: 9, flicker: 0.04 });
    K.doc('d_abilio', 'diario_abilio', 8.6, -9.6, { y: 0.77, onRead: (g) => g.setFlag('read_abilio') });
    K.item('f_herb_cabin', 'herb', 5.2, -6, { y: 0.02 });
    // esconderijo
    L.box(15.5, 0, -13.5, 2.6, 0.9, 0.6, 'oldwood');
    K.doc('d_cracha', 'cracha_vertice', 15.2, -13.5, { y: 0.92 });
    K.item('f_shells_secret', 'ammo_shotgun', 16.2, -13.4, { y: 0.92, qty: 6 });
    K.item('f_herb_s1', 'herb', 16.3, -10, { y: 0.02 });
    K.item('f_herb_s2', 'herb', 15.4, -9.8, { y: 0.02 });
    K.item('f_powder', 'gunpowder', 14.8, -12.4, { y: 0.02 });
    K.light({ x: 15.5, y: 2.2, z: -11.5, color: 0xffa050, intensity: 2, distance: 5 });

    // ---------------------------------------------------------------- clareira da mina (chefe)
    for (const [x, z, s] of [
      [-8, -47, 1.5],
      [9.5, -59, 1.7],
      [-5.5, -65, 1.4],
      [12, -46, 1.2],
      [-13, -57, 1.6],
    ])
      P.rock(L, x, z, s);
    P.deadTree(L, 5.5, -44.5, 1.3);
    P.deadTree(L, -10, -62, 1.2);
    P.deadTree(L, 2.5, -51, 1.1);
    // torre de observação
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      L.box(14 + dx, 0, -64 + dz, 0.25, 5, 0.25, 'oldwood');
    L.box(14, 5, -64, 2.6, 0.2, 2.6, 'oldwood', { collide: false });
    L.box(14, 5.2, -65.2, 2.6, 1, 0.1, 'oldwood', { collide: false });
    K.item('f_shells_tower', 'ammo_shotgun', 14, -62.2, { y: 0.02, qty: 4 });
    K.item('f_ammo_clear', 'ammo_pistol', -12, -50, { y: 0.02, qty: 6 });
    // paredão de rocha e porta da mina
    L.box(-17, 0, -80, 26, 11, 5, 'rock');
    L.box(17, 0, -80, 26, 11, 5, 'rock');
    L.box(0, 3.6, -80, 8, 8, 5, 'rock', { collide: false });
    for (let i = 0; i < 9; i++) P.rock(L, -26 + i * 6.5, -76.5 + Math.sin(i) * 0.8, 1.6 + (i % 3) * 0.4);
    L.box(-2.1, 0, -77.4, 0.4, 3.8, 0.6, 'oldwood');
    L.box(2.1, 0, -77.4, 0.4, 3.8, 0.6, 'oldwood');
    L.box(0, 3.6, -77.4, 4.6, 0.4, 0.6, 'oldwood', { collide: false });
    P.sign(L, 0, 4.2, -77.05, 3.4, 0.5, 'ESTAÇÃO RAIZ — ACESSO RESTRITO', 0, { bg: '#d8d8d0', fg: '#8a1a10', font: 'Arial' });
    L.door({
      id: 'd_mine',
      x: 0,
      z: -77.2,
      axis: 'x',
      w: 3.4,
      h: 3.4,
      kind: 'mine',
      lock: {
        flag: 'mine_open',
        msg: null,
        onLocked: (g) => {
          g.ui.openDials({
            title: 'Porta de ferro da mina',
            subtitle: 'Quatro discos com símbolos gravados e uma alavanca.',
            symbols: ['SOL', 'LUA', 'MAO', 'OLHO', 'RAIZ', 'SERPENTE'],
            solution: ['LUA', 'OLHO', 'SERPENTE', 'RAIZ'],
            initial: g.state.dials || [0, 0, 0, 0],
            onChange: (cur) => (g.state.dials = cur.slice()),
            onSolve: () => {
              g.setFlag('mine_open');
              w.unlockDoor('d_mine');
              g.audio.play('metalDoor', { x: 0, y: 1.5, z: -77 });
              g.cam.shake(0.05, 1);
              g.hud.message('Os discos se alinham. A porta de ferro destrava com um estrondo.');
            },
          });
        },
      },
      to: { map: 'tunnels', spawn: 'fromForest' },
    });
    for (const sx of [-1, 1]) {
      const px = sx * 4.4;
      L.cyl(px, 0, -73.6, 0.07, 3.2, 'metalDark', { seg: 6 });
      L.box(px, 3.2, -73.6, 0.5, 0.35, 0.3, 'metalPaint', { collide: false });
      K.light({ type: 'spot', x: px, y: 3.2, z: -73.6, tx: 0, ty: 1.2, tz: -77.2, color: 0xe8f0ff, intensity: 30, distance: 14, angle: 0.6, penumbra: 0.5, decay: 1.4, flicker: sx > 0 ? 0.08 : 0 });
    }
    P.crate(L, 6.5, -75, 1.0);
    P.crate(L, -6.8, -74.6, 0.9, 0.4);
    P.generator(L, -7.5, -72, 0.3);

    // ---------------------------------------------------------------- criaturas
    K.enemy({ id: 'f_d1', type: 'rastejante', x: -26, z: 21.5, state: 'idle' });
    K.enemy({ id: 'f_d2', type: 'rastejante', x: 6, z: 4, state: 'idle' });
    K.enemy({ id: 'f_d3', type: 'rastejante', x: 4, z: -32, state: 'idle' });
    K.enemy({ id: 'f_h', type: 'errante', x: 1.2, z: 34, state: 'idle', wander: true, look: { shirt: 0x4a4a2a, pants: 0x3a3020, hair: 0x5a5048 } });
    K.enemy({ id: 'f_h2', type: 'errante', x: -13.4, z: 18.6, ry: 1, state: 'fakedead', look: { shirt: 0xd0d0c8, pants: 0xd0d0c8, hair: null } });

    if (!g.flag('boss3_dead')) {
      K.trigger({
        id: 'boss3',
        x0: -17,
        z0: -70,
        x1: 17,
        z1: -41,
        persist: false,
        onEnter: (g, w) => {
          const boss = w.spawnEnemy({ type: 'cervo', id: 'boss3', x: 0, z: -68, ry: 0 });
          boss.onDefeated = () => {
            g.setMusic(null);
            g.after(2, () => g.hud.message('A clareira fica em silêncio. Só a chuva.'));
          };
          g.setMusic('boss3');
          g.cinematicLook(boss, 2.6, 4);
          g.after(3, () => g.hud.hint('Ele é cego e caça pelo som. Correr e atirar o atraem. Faça-o bater nas rochas.', 9));
        },
      });
    } else {
      // carcaça do cervo
      L.sphere(1.5, 0.5, -60, 1, 'bone', { scale: [1.0, 0.55, 1.8], batch: false });
      L.sphere(2.8, 0.25, -61.8, 0.35, 'bone', { scale: [0.3, 0.25, 0.55], batch: false });
      K.examine(1.5, -60, 'A carcaça do Cervo Pálido. Os sacos luminosos apagaram. De perto, dá para ver uma etiqueta metálica presa na orelha: "CR-III / 0447".', { r: 3 });
    }
  },

  onEnter(g, w, spawn) {
    if (spawn === 'fromHospital' && !g.flag('chase_done')) {
      g.setFlag('chase_done');
      g.setMusic(null);
      g.after(1.5, () => g.audio.play('vigiaRoar', { x: 0, y: 3, z: 64 }, 0.5));
      g.after(5, () => g.radio(RADIO.forest));
    }
  },
};
