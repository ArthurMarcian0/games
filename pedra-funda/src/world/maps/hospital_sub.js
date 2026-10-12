// ÁREA 3b — Subsolo do hospital: necrotério, gerador, depósito e caldeiras.
import * as THREE from 'three';
import { makeKit, LOOK, P } from './kit.js';
import { RADIO } from '../../game/Story.js';

const DRAWERS = [
  { id: 'A-1', c: 0, r: 0, text: ['Gaveta A-1. Uma senhora muito velha, coberta até o queixo. Descanse em paz, Dona Maria.'] },
  { id: 'B-1', c: 1, r: 0, text: ['Gaveta B-1. Vazia. Cheiro de desinfetante.'] },
  { id: 'C-1', c: 2, r: 0, text: ['Gaveta C-1. Vazia.'] },
  { id: 'A-2', c: 0, r: 1, text: ['Gaveta A-2. Vazia. Há marcas de unha por dentro do metal.'] },
  { id: 'B-2', c: 1, r: 1, monster: true },
  { id: 'C-2', c: 2, r: 1, text: ['Gaveta C-2. Um saco preto, fechado. Leve demais para ser um corpo inteiro. Melhor não abrir.'] },
  { id: 'A-3', c: 0, r: 2, text: ['Gaveta A-3. Vazia.'] },
  { id: 'B-3', c: 1, r: 2, text: ['Gaveta B-3. Vazia, exceto por uma pulseira de identificação: "VACINADO — LOTE CR-I".'] },
  { id: 'C-3', c: 2, r: 2, fuse: true },
];

export default {
  id: 'hospital_sub',
  fog: { color: 0x060706, density: 0.07 },
  sky: 0x202428,
  ground: 0x080808,
  ambient: 0.08,
  ambience: 'basement',
  music: 'none',
  bounds: { minX: -16, minZ: -12, maxX: 32, maxZ: 18 },
  ceilDefault: 3,

  build(L, g, w) {
    const K = makeKit(L, g, w);
    const power = !!g.flag('power_on');
    L.spawn('fromUp', 26.2, 1, -Math.PI / 2);
    L.spawn('default', 26.2, 1, -Math.PI / 2);
    const B = { wall: 'concrete', floor: 'concrete', ceil: 'concreteDark', h: 3 };
    L.room({ ...B, id: 'sstairs', name: 'Escadaria (subsolo)', x0: 22, x1: 30, z0: -4, z1: 8 });
    L.room({ ...B, id: 'scor', name: 'Corredor de serviço', x0: -14, x1: 22, z0: 0, z1: 4, wall: 'tilewall' });
    L.room({ ...B, id: 'morgue', name: 'Necrotério', x0: -14, x1: 2, z0: 4, z1: 16, wall: 'tilewall', floor: 'tilefloor' });
    L.room({ ...B, id: 'gen', name: 'Sala do gerador', x0: 2, x1: 14, z0: 4, z1: 16 });
    L.room({ ...B, id: 'store', name: 'Depósito', x0: -14, x1: 6, z0: -10, z1: 0 });
    L.room({ ...B, id: 'boiler', name: 'Caldeiras', x0: 6, x1: 22, z0: -10, z1: 0, wall: 'brickDark' });

    L.door({ id: 'd_scor', x: 22, z: 2, axis: 'z', w: 1.4, kind: 'metal' });
    L.door({ id: 'd_morgue', x: -6, z: 4, axis: 'x', w: 1.6, kind: 'double' });
    L.door({ id: 'd_gen', x: 8, z: 4, axis: 'x', w: 1.4, kind: 'metal' });
    L.door({ id: 'd_store', x: -4, z: 0, axis: 'x', w: 1.3, kind: 'wood' });
    L.door({ id: 'd_boiler', x: 14, z: 0, axis: 'x', w: 1.3, kind: 'metal' });

    // escada para cima
    P.stairsUp(L, 28, 3.6, Math.PI, 2.8);
    L.wall(26.5, -0.2, 29.5, 4, 3);
    K.interact({ x: 28, z: 4.6, r: 1.6, prompt: 'Subir para o térreo', use: (g) => g.transition('hospital', 'fromSub', 'stairs') });

    // tubulações e vapor
    P.pipeRun(L, -14, 2.6, 0.5, 22, 0.5, 0.1, 'rust');
    P.pipeRun(L, -14, 2.75, 3.4, 22, 3.4, 0.07, 'metalDark');
    K.onUpdate((dt, g, w) => {
      if (Math.random() < dt * 4) w.particles.steam(new THREE.Vector3(10.5, 2.4, 0.6));
      if (Math.random() < dt * 2) w.particles.steam(new THREE.Vector3(-8, 2.5, 3.4));
    });
    K.decal(4, 2, 1.4, 2);
    K.decal(16, 1.6, 2.2, 0);

    // luzes: emergência sempre; fluorescentes com energia
    K.light({ x: 18, y: 2.6, z: 2, color: 0xff3a1a, intensity: 2.2, distance: 8, flicker: 0.1 });
    const fl = (x, z, flicker) => {
      P.fluorescent(L, x, 3, z, 0, power);
      K.light({ x, y: 2.7, z, color: 0xe0f0ff, intensity: 6, distance: 10, flicker, group: 'power', on: power });
    };
    fl(-4, 2, 0.1);
    fl(8, 10, 0.05);
    fl(-6, 10, 0.4);
    fl(-4, -5, 0.2);
    fl(14, -5, 0.1);
    K.light({ x: 25, y: 2.6, z: 2, color: 0xffb060, intensity: 3, distance: 8, flicker: 0.2 });

    // ---------------------------------------------------------------- necrotério
    P.morgueWall(L, -6, 15.4, Math.PI, 3, 3);
    for (const d of DRAWERS) {
      // a parede está girada (ry = PI): a coluna A fica à direita de quem olha
      const x = -6 + (1 - d.c) * 0.75;
      const y = 0.25 + d.r * 0.7;
      P.sign(L, x, y + 0.45, 15.13, 0.22, 0.09, d.id, Math.PI, { bg: '#d8d8d0', fg: '#111', size: 60, w: 128, h: 48, border: false });
    }
    const openDrawer = (d) => {
      const flag = 'drawer_' + d.id;
      const pos = { x: -6, y: 1, z: 15 };
      if (g.flag(flag)) {
        g.ui.examine([d.fuse ? 'O eletricista Valdo, em paz agora.' : d.monster ? 'A gaveta B-2, vazia e arranhada por dentro.' : d.text[0]]);
        return;
      }
      g.audio.play('metalDoor', pos, 0.5);
      if (d.fuse) {
        g.ui.examine(['Gaveta C-3. O eletricista. A mão rígida ainda aperta um fusível.', 'Você solta os dedos frios, um por um.'], () => {
          if (!g.inv.canAdd('fuse')) return g.hud.message('Inventário cheio.');
          g.setFlag(flag);
          g.inv.add('fuse');
          g.audio.play('keyItem');
          g.hud.message('Você pegou: Fusível.');
        });
        return;
      }
      g.setFlag(flag);
      if (d.monster) {
        g.audio.play('groan', pos, 1.2);
        g.cam.shake(0.04, 0.3);
        const e = w.spawnEnemy({ type: 'errante', id: 's_b2', x: -6, z: 13.4, ry: 0, state: 'rising', look: { shirt: 0x6a6a60, pants: 0x4a4a44, hair: 0x2a2a2a } });
        if (e) {
          e.alert = true;
          e.hearing = 1;
        }
        return;
      }
      g.ui.examine(d.text);
    };
    K.interact({
      x: -6,
      z: 14.3,
      r: 1.9,
      prompt: 'Gavetas refrigeradas',
      use: (g) => {
        g.ui.choose(
          'Gavetas refrigeradas',
          DRAWERS.map((d) => ({ label: `Gaveta ${d.id}${g.flag('drawer_' + d.id) ? ' — aberta' : ''}`, value: d })),
          (d) => openDrawer(d),
        );
      },
    });
    L.box(-11, 0, 9, 1, 0.9, 2.2, 'chrome');
    K.corpse(-11, 9.2, 0, { look: LOOK.worker, pose: 'bed', blood: false });
    L.box(-11, 0.9, 9.2, 0.9, 0.04, 2.1, 'fabricWhite', { collide: false });
    L.box(-3, 0, 6, 1.4, 0.8, 0.7, 'metal');
    K.doc('d_necro', 'registro_necroterio', -3.2, 6.1, { y: 0.82 });
    K.item('s_bandage', 'bandage', -2.4, 6.0, { y: 0.82 });
    P.sink(L, 1.5, 10, -Math.PI / 2);

    // ---------------------------------------------------------------- gerador
    P.generator(L, 8, 11.5, 0);
    P.panel(L, 13.75, 1.0, 8, -Math.PI / 2);
    L.box(4.2, 0, 15.2, 1.2, 1.6, 0.6, 'metalPaint');
    K.item('s_ammo_gen', 'ammo_pistol', 3.4, 5.0, { y: 0.02, qty: 8 });
    K.light({ x: 4.5, y: 2.2, z: 14.6, color: 0xffa040, intensity: 3, distance: 7 });
    K.interact({
      x: 8,
      z: 10.2,
      r: 1.8,
      prompt: () => (g.flag('fuses_in') ? (g.flag('power_on') ? 'Gerador (funcionando)' : 'Gerador (pronto)') : 'Examinar o gerador'),
      use: (g) => {
        if (g.flag('fuses_in')) {
          g.ui.examine([g.flag('power_on') ? 'O gerador ronca, estável.' : 'Os fusíveis estão no lugar. Falta distribuir a energia no painel da parede.']);
          return;
        }
        const n = g.inv.count('fuse');
        if (n >= 3) {
          g.inv.remove('fuse', 3);
          g.setFlag('fuses_in');
          g.audio.play('unlock', { x: 8, y: 1, z: 11 });
          g.ui.examine(['Você encaixa os três fusíveis no compartimento do gerador.', 'Agora é preciso ligar os circuitos no painel de distribuição.']);
        } else {
          g.ui.examine([`O gerador de emergência. O compartimento dos fusíveis principais está vazio: são três encaixes.${n ? ` Você tem ${n}.` : ''}`]);
        }
      },
    });
    K.interact({
      x: 13.1,
      z: 8,
      r: 1.5,
      prompt: 'Painel de distribuição',
      use: (g) => {
        if (!g.flag('fuses_in')) return g.ui.examine(['O painel está morto. O gerador precisa dos fusíveis primeiro.']);
        g.ui.openBreakers({
          max: 10,
          circuits: [
            { id: 'doors', name: 'Portas de segurança', load: 5 },
            { id: 'elev', name: 'Elevador', load: 4 },
            { id: 'ground', name: 'Iluminação — térreo', load: 3 },
            { id: 'base', name: 'Iluminação — subsolo', load: 2 },
            { id: 'cold', name: 'Refrigeração do necrotério', load: 3 },
            { id: 'xray', name: 'Raio-X', load: 6 },
          ],
          initial: g.state.breakers || [],
          require: ['doors'],
          requireMsg: 'O gerador ligou, mas as portas de segurança continuam travadas. Elas precisam de energia.',
          onSolve: (sel) => {
            g.state.breakers = sel;
            const first = !g.flag('power_on');
            g.setFlag('power_on');
            g.setFlag('lights_ground', sel.includes('ground'));
            g.setFlag('lights_base', sel.includes('base'));
            g.audio.play('generator', { x: 8, y: 1, z: 11 });
            g.after(1.2, () => g.audio.play('powerOn'));
            w.setLightGroup('power', sel.includes('base'));
            g.audio.setAmbient('basement', { power: true });
            if (sel.includes('elev')) g.after(3, () => g.hud.message('O elevador dá um tranco... e nada. Está mesmo quebrado.'));
            if (first) g.after(3.5, () => g.radio(RADIO.power_on));
          },
        });
      },
    });
    if (power) w.setLightGroup('power', !!g.flag('lights_base'));

    // ---------------------------------------------------------------- depósito
    for (let i = 0; i < 3; i++) P.shelf(L, -11 + i * 5, -8.8, 0, 3.6, 2.2, { boxes: true });
    P.crate(L, 3, -3, 1);
    P.crate(L, 4.2, -2.6, 0.8, 0.3);
    P.crate(L, 3.6, -3.1, 0.7, 0, 1);
    P.barrel(L, -12.6, -2, 'rust');
    K.item('s_shells', 'ammo_shotgun', -11, -8.6, { y: 0.5, qty: 5 });
    K.item('s_herb', 'herb', -1.6, -9, { y: 0.02 });
    K.item('s_powder', 'gunpowder', -6, -8.7, { y: 0.95 });
    K.enemy({ id: 's_dog', type: 'rastejante', x: -6, z: -4.5, state: 'idle' });

    // ---------------------------------------------------------------- caldeiras
    for (const x of [10, 16]) {
      L.cyl(x, 0, -6.5, 1.3, 3, 'rust', { seg: 16 });
      L.cyl(x, 2.8, -6.5, 0.2, 0.8, 'metalDark', { collide: false });
    }
    P.pipeRun(L, 6, 2.2, -2, 22, -2, 0.12, 'rust');
    K.onUpdate((dt, g, w) => {
      if (Math.random() < dt * 3) w.particles.steam(new THREE.Vector3(13 + Math.random(), 2.2, -2));
    });
    K.item('s_shells2', 'ammo_shotgun', 20.4, -9, { y: 0.02, qty: 3 });
    K.enemy({ id: 's_boiler', type: 'errante', x: 13, z: -4, state: 'idle', wander: true, look: { shirt: 0x3a4a6a, pants: 0x2a3040, hair: 0x1a1410 } });
    K.enemy({ id: 's_cor', type: 'errante', x: 4, z: 2, ry: Math.PI / 2, state: 'fakedead' });
    K.light({ x: 13, y: 2.5, z: -4, color: 0xff7030, intensity: 3, distance: 8, flicker: 0.15 });
  },

  onEnter(g) {
    if (!g.flag('sub_first')) {
      g.setFlag('sub_first');
      g.after(1.2, () => g.hud.message('O ar aqui embaixo é úmido e frio. Canos gotejam no escuro.'));
    }
  },
};
