// ÁREA 5 — Galerias da mina / acesso à Estação Raiz.
import * as THREE from 'three';
import { makeKit, LOOK, P } from './kit.js';
import { RADIO } from '../../game/Story.js';
import { getMaterial } from '../../engine/materials.js';

export default {
  id: 'tunnels',
  fog: { color: 0x050505, density: 0.08 },
  sky: 0x1c2024,
  ground: 0x060606,
  ambient: 0.1,
  ambience: 'tunnels',
  music: 'none',
  bounds: { minX: -33, minZ: -92, maxX: 33, maxZ: 2 },
  ceilDefault: 3.4,

  build(L, g, w) {
    const K = makeKit(L, g, w);
    const drained = !!g.flag('drained');
    L.spawn('fromForest', 0, -1.6, Math.PI);
    L.spawn('fromLab', 0, -88.4, 0);
    L.spawn('default', 0, -1.6, Math.PI);
    const R = { wall: 'rock', floor: 'dirt', ceil: 'rock', h: 3.4 };
    const C = { wall: 'concrete', floor: 'concrete', ceil: 'concreteDark', h: 3 };
    L.room({ ...R, id: 'entrada', name: 'Galeria de entrada', x0: -3, x1: 3, z0: -30, z1: 0, open: { n: [[-3, 3]] } });
    L.room({ ...R, id: 'juncao', name: 'Câmara de junção', x0: -9, x1: 9, z0: -44, z1: -30, h: 4.2, open: { s: [[-3, 3]], n: [[-3, 3]], w: [[-40, -36]], e: [[-40, -36]] } });
    L.room({ ...R, id: 'passW', name: 'Passagem oeste', x0: -21, x1: -9, z0: -40, z1: -36, h: 3, open: { e: [[-40, -36]] } });
    L.room({ ...C, id: 'ferr', name: 'Sala de ferramentas', x0: -31, x1: -21, z0: -46, z1: -32 });
    L.room({ ...R, id: 'passE', name: 'Passagem leste', x0: 9, x1: 21, z0: -40, z1: -36, h: 3, open: { w: [[-40, -36]] } });
    L.room({ ...C, id: 'manut', name: 'Escritório de manutenção', x0: 21, x1: 31, z0: -46, z1: -32, wall: 'plasterDark', floor: 'woodfloor', safe: true });
    L.room({ ...R, id: 'tunelN', name: 'Túnel norte', x0: -3, x1: 3, z0: -80, z1: -44, open: { s: [[-3, 3]], n: [[-3, 3]] } });
    L.room({ ...C, id: 'portaLab', name: 'Antecâmara', x0: -6, x1: 6, z0: -90, z1: -80, h: 4, wall: 'labpanel', floor: 'labfloor', open: { s: [[-3, 3]] } });

    L.door({ id: 'd_out', x: 0, z: 0, axis: 'x', w: 3, h: 3.2, kind: 'mine', to: { map: 'forest', spawn: 'fromTunnels' } });
    L.door({ id: 'd_ferr', x: -21, z: -38, axis: 'z', w: 1.3, kind: 'metal' });
    L.door({ id: 'd_manut', x: 21, z: -38, axis: 'z', w: 1.3, kind: 'metal' });
    L.door({ id: 'd_lab', x: 0, z: -90, axis: 'x', w: 2.4, h: 2.8, kind: 'security', to: { map: 'lab', spawn: 'fromTunnels' } });

    // suportes, trilhos
    for (let z = -3; z > -30; z -= 4) P.mineSupport(L, 0, z, 6, 3.3);
    for (let z = -47; z > -80; z -= 4.5) P.mineSupport(L, 0, z, 6, 3.3);
    P.rails(L, 0, -1, -43);
    P.rails(L, 0, -45, -79);
    P.minecart(L, 0, -41, 0.1);
    P.minecart(L, 5, -33.5, 1.4);
    for (const [x, z, s] of [
      [2.2, -12, 0.5],
      [-2.3, -19, 0.6],
      [7.5, -42.5, 0.9],
      [-7.6, -31.5, 0.8],
    ])
      P.rock(L, x, z, s);
    P.pipeRun(L, -2.7, 2.8, -1, -2.7, -79, 0.08, 'rust');
    K.onUpdate((dt, g, w) => {
      if (Math.random() < dt * 1.2) g.audio.play('drip', { x: (Math.random() - 0.5) * 5, y: 3, z: g.player.pos.z + (Math.random() - 0.5) * 10 }, 0.5);
    });

    // luzes
    const bulbL = (x, z, flicker, h = 3.3, col = 0xffc070, int = 4) => {
      P.bulb(L, x, h, z, true, col);
      K.light({ x, y: h - 0.5, z, color: col, intensity: int * 1.4, distance: 10, flicker });
    };
    bulbL(0, -8, 0.1);
    bulbL(0, -24, 0.5);
    bulbL(0, -37, 0.05, 4.1, 0xffc070, 6);
    bulbL(-26, -39, 0.1, 3, 0xe0f0ff, 4);
    bulbL(15, -38, 0.6, 3);
    K.light({ x: 0, y: 3.6, z: -85, color: 0xff2a1a, intensity: 4, distance: 9 });
    P.sign(L, 0, 3.2, -89.83, 3, 0.5, 'ESTAÇÃO RAIZ — NÍVEL 1', 0, { bg: '#d8d8d0', fg: '#1a2a3a', font: 'Arial' });

    // ---------------------------------------------------------------- túnel inundado
    const water = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 27), getMaterial('water'));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, drained ? -0.3 : 0.35, -59.5);
    water.receiveShadow = true;
    L.scene.add(water);
    let blocker = null;
    const cables = [];
    if (!drained) {
      blocker = w.collision.add(-3, -46.4, 3, -45.8, 3);
      for (const [x, z] of [
        [-1.2, -50],
        [1.4, -57],
        [-0.6, -64],
      ]) {
        L.cyl(x, 0.3, z, 0.03, 3, 'rubber', { collide: false, batch: false, rz: 0.2 });
        cables.push(new THREE.Vector3(x, 0.4, z));
      }
      K.light({ x: 0, y: 1.2, z: -55, color: 0x7ab0ff, intensity: 5, distance: 10, flicker: 0.6, group: 'cables' });
      K.trigger({
        id: 'water_warn',
        x0: -3,
        z0: -47.5,
        x1: 3,
        z1: -44,
        once: false,
        persist: false,
        cond: (g) => !g.flag('drained'),
        onEnter: (g) => {
          g.audio.play('spark', { x: 0, y: 0.5, z: -50 });
          g.hud.message('A água está eletrificada — cabos de alta tensão caídos. Entrar aqui é morte certa.');
        },
      });
    }
    K.onUpdate((dt, g, w) => {
      if (g.flag('drained') || !cables.length) return;
      for (const c of cables) {
        if (Math.random() < dt * 3) {
          w.particles.sparks(c, 5);
          if (Math.random() < 0.3) g.audio.play('spark', c, 0.5);
        }
      }
    });
    // registro do dreno
    L.box(-8.75, 0.9, -42.3, 0.3, 0.6, 0.6, 'metalPaint', { collide: false });
    L.cyl(-8.5, 1.2, -42.3, 0.08, 0.2, 'metalDark', { rz: Math.PI / 2, center: true, collide: false });
    K.doc('d_manual', 'manual_dreno', -8.7, -43.3, { model: 'wall', y: 1.5, ry: Math.PI / 2, w: 0.3, h: 0.4 });
    K.interact({
      x: -8.2,
      z: -42.3,
      r: 1.5,
      prompt: () => (g.flag('drained') ? 'Registro do dreno (aberto)' : 'Registro do dreno'),
      use: (g) => {
        if (g.flag('drained')) return g.ui.examine(['O registro está todo aberto. O túnel norte está seco.']);
        if (g.inv.has('valve')) {
          g.inv.remove('valve', 1);
          g.setFlag('drained');
          g.audio.play('valve', { x: -8.5, y: 1.2, z: -42.3 });
          g.after(1.2, () => g.audio.play('water', { x: 0, y: 0.5, z: -55 }));
          g.hud.message('Você encaixa a válvula e gira. A água começa a escoar com um ronco grave.');
          let t = 0;
          w.updaters.push((dt) => {
            if (t > 6) return;
            t += dt;
            water.position.y = 0.35 - Math.min(1, t / 6) * 0.65;
          });
          w.setLightGroup('cables', false);
          if (blocker) blocker.enabled = false;
          w.nav.markRect(-2.6, -47, 2.6, -45.5, 0);
          cables.length = 0;
          g.after(6, () => {
            g.hud.message('O túnel norte está livre.');
            w.spawnEnemy({ type: 'rastejante', id: 'tn_dog', x: 0, z: -66, state: 'idle' });
          });
          return;
        }
        if (g.inv.has('valve_wheel') || g.inv.has('valve_rod')) return g.ui.examine(['O eixo do registro está sem volante. Você tem uma das peças, mas falta a outra — e elas precisam estar montadas.']);
        g.ui.examine(['Um registro de dreno, pintado de vermelho. O volante foi retirado.']);
      },
    });
    if (drained) K.enemy({ id: 'tn_dog', type: 'rastejante', x: 0, z: -66, state: 'idle' });

    // ---------------------------------------------------------------- ferramentas
    P.table(L, -27, -45, 0, 3, 0.8, 'metalPaint', 0.9);
    P.shelf(L, -30.4, -38, Math.PI / 2, 4, 2.2, { boxes: true });
    P.locker(L, -24, -32.6, Math.PI, 3);
    K.item('tn_wheel', 'valve_wheel', -27.5, -45, { y: 0.92 });
    K.item('tn_ammo_tools', 'ammo_pistol', -26, -45.1, { y: 0.92, qty: 8 });
    K.item('tn_powder', 'gunpowder', -30, -44.6, { y: 0.02 });
    K.enemy({ id: 'tn_h2', type: 'errante', x: -15, z: -38, ry: Math.PI / 2, state: 'idle', hazmat: true, look: { shirt: 0xc8c4a8, pants: 0xc8c4a8, hair: null } });

    // ---------------------------------------------------------------- passagem leste: o vigilante
    K.corpse(16, -37.2, 2.6, { look: LOOK.guard, pose: 'deadFace' });
    K.item('tn_rod', 'valve_rod', 16.8, -38.4, { y: 0.02 });
    K.doc('d_log_guarda', 'log_guarda', 15, -38.6, { y: 0.02 });
    K.examine(16, -37.2, 'Um vigilante da Vértice. Uniforme escuro, crachá arrancado. As marcas no peito são de garras enormes — três rasgos paralelos.', { r: 1.3 });

    // ---------------------------------------------------------------- manutenção (segura)
    P.desk(L, 26, -44.6, 0, { w: 1.8 });
    P.chair(L, 26, -43.6, Math.PI);
    P.filingCabinet(L, 30.4, -36, -Math.PI / 2);
    P.sofa(L, 24, -33, Math.PI, 'fabricGreen');
    K.save(30.2, -42, -Math.PI / 2);
    K.storage(22, -45.2, 0);
    K.light({ x: 26, y: 2.6, z: -39, color: 0xffb070, intensity: 6, distance: 9 });
    P.bulb(L, 26, 3, -39, true, 0xffb070);
    K.item('tn_firstaid', 'firstaid', 26.4, -44.6, { y: 0.79 });
    K.item('tn_shells', 'ammo_shotgun', 29.6, -33, { y: 0.02, qty: 5 });

    // ---------------------------------------------------------------- criaturas
    K.enemy({ id: 'tn_h1', type: 'errante', x: 4, z: -37, state: 'idle', wander: true, hazmat: true, look: { shirt: 0xc8c4a8, pants: 0xc8c4a8, hair: null } });
    K.enemy({ id: 'tn_h3', type: 'errante', x: -3.5, z: -86, ry: 0.5, state: 'fakedead', hazmat: true, look: { shirt: 0xc8c4a8, pants: 0xc8c4a8, hair: null } });
    K.enemy({ id: 'tn_d0', type: 'rastejante', x: 1, z: -20, state: 'idle' });
    K.item('tn_herb', 'herb', -2.2, -28.5, { y: 0.02 });
    K.item('tn_herb2', 'herb', 5, -82, { y: 0.02 });
  },

  onEnter(g) {
    if (!g.flag('tunnels_radio')) {
      g.setFlag('tunnels_radio');
      g.after(6, () => g.radio(RADIO.tunnels));
    }
  },
};
