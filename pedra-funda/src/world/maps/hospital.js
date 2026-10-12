// ÁREA 3 — Hospital São Lázaro, térreo. Chefe: A Ninhada. Clímax: perseguição do Vigia.
import * as THREE from 'three';
import { makeKit, LOOK, P } from './kit.js';
import { DIALOGS, RADIO } from '../../game/Story.js';

export default {
  id: 'hospital',
  fog: { color: 0x07090a, density: 0.055 },
  sky: 0x26303a,
  ground: 0x0a0a0a,
  ambient: 0.1,
  ambience: 'hospital',
  music: 'explore',
  bounds: { minX: -32, minZ: -26, maxX: 32, maxZ: 16 },
  ceilDefault: 3.2,

  build(L, g, w) {
    const K = makeKit(L, g, w);
    const power = !!g.flag('power_on');
    const lightsOn = power && !!g.flag('lights_ground');
        L.spawn('fromTown', 0, 12.4, Math.PI);
    L.spawn('fromSub', 27.2, -1.6, Math.PI);
    L.spawn('fromForest', 28.6, -6, -Math.PI / 2);
    L.spawn('default', 0, 12.4, Math.PI);
    const H = { wall: 'plasterGreen', wainscot: { mat: 'tilewall', h: 1.3 }, floor: 'tilefloor', ceil: 'ceiling', h: 3.2 };

    // ---------------------------------------------------------------- salas
    L.room({ ...H, id: 'corN', name: 'Corredor norte', x0: -30, x1: 30, z0: -8, z1: -4, open: { s: [[-3, 3]] } });
    L.room({ ...H, id: 'lobby', name: 'Recepção', x0: -10, x1: 10, z0: -4, z1: 14, h: 4.2, open: { n: [[-3, 3]] }, wainscot: { mat: 'woodDark', h: 1.1 } });
    L.room({ ...H, id: 'ward', name: 'Enfermaria', x0: -30, x1: -10, z0: -4, z1: 14 });
    L.room({ ...H, id: 'pharm', name: 'Farmácia', x0: 10, x1: 22, z0: -4, z1: 8, wall: 'plaster' });
    L.room({ ...H, id: 'stairs', name: 'Escadaria', x0: 22, x1: 30, z0: -4, z1: 8, wall: 'concrete', wainscot: null, floor: false });
    L.room({ ...H, id: 'xray', name: 'Raio-X', x0: 10, x1: 30, z0: 8, z1: 14, wall: 'plasterBlue' });
    L.room({ ...H, id: 'iso', name: 'Ala de isolamento', x0: -30, x1: -8, z0: -24, z1: -8, h: 4.6, wall: 'tilewall', wainscot: null });
    L.room({ ...H, id: 'dir', name: 'Gabinete do diretor', x0: -8, x1: 6, z0: -18, z1: -8, wall: 'wallpaper', floor: 'woodfloor', wainscot: { mat: 'woodDark', h: 1.0 }, safe: true });
    L.room({ ...H, id: 'ped', name: 'Ala pediátrica', x0: 6, x1: 30, z0: -18, z1: -8, wall: 'plasterBlue' });

    // ---------------------------------------------------------------- portas
    L.door({ id: 'd_front', x: 0, z: 14, axis: 'x', w: 2.4, kind: 'double', to: { map: 'town', spawn: 'fromHospital' } });
    L.door({ id: 'd_ward_lobby', x: -10, z: 5, axis: 'z', w: 1.6, kind: 'double' });
    L.door({ id: 'd_ward_cor', x: -20, z: -4, axis: 'x', w: 1.4, kind: 'wood' });
    L.door({ id: 'd_pharm', x: 10, z: 2, axis: 'z', w: 1.2, kind: 'glass', lock: { item: 'key_pharmacy', consume: true, msg: 'FARMÁCIA — ACESSO RESTRITO. A porta de vidro está trancada.' } });
    L.door({ id: 'd_xray_lobby', x: 10, z: 11, axis: 'z', w: 1.4, kind: 'wood' });
    L.door({ id: 'd_xray_stairs', x: 26, z: 8, axis: 'x', w: 1.2, kind: 'metal' });
    L.door({ id: 'd_stairs_cor', x: 26, z: -4, axis: 'x', w: 1.4, kind: 'metal' });
    L.door({ id: 'd_ped', x: 14, z: -8, axis: 'x', w: 1.4, kind: 'wood' });
    L.door({
      id: 'd_iso',
      x: -19,
      z: -8,
      axis: 'x',
      w: 2,
      h: 2.6,
      kind: 'security',
      sealed: true,
      lock: { flag: 'power_on', msg: 'Porta de segurança da ALA DE ISOLAMENTO. Sem energia, a trava eletromagnética não abre.' },
    });
    L.door({
      id: 'd_dir',
      x: -1,
      z: -8,
      axis: 'x',
      w: 1.2,
      kind: 'wood',
      lock: {
        flag: 'met_renata',
        msg: 'Trancada. Ouço alguém se mexendo lá dentro.',
        onLocked: (g) => {
          g.ui.dialog(DIALOGS.renata_door, () => {
            g.setFlag('met_renata');
            w.unlockDoor('d_dir', true);
            g.audio.play('unlock');
          });
        },
      },
    });
    L.door({
      id: 'd_exit',
      x: 30,
      z: -6,
      axis: 'z',
      w: 1.6,
      kind: 'security',
      lock: { item: 'card_exit', consume: true, msg: 'SAÍDA DE SERVIÇO. Leitor de cartão magnético — luz vermelha.' },
      to: { map: 'forest', spawn: 'fromHospital' },
    });

    // ---------------------------------------------------------------- iluminação
    const fl = (x, z, flicker = 0.05, h = 3.2, intensity = 9) => {
      P.fluorescent(L, x, h, z, 0, lightsOn);
      if (lightsOn) K.light({ x, y: h - 0.3, z, color: 0xe0f0ff, intensity, distance: 13, flicker });
    };
    fl(0, 4, 0.05, 4.2, 13);
    fl(-14, -6, 0.1);
    fl(14, -6, 0.5);
    fl(-20, 4, 0.2);
    fl(16, 2, 0.05);
    fl(18, -13, 0.3);
    fl(20, 11, 0.6);
    if (!lightsOn) {
      // luzes de emergência
      K.light({ x: 0, y: 3.8, z: 13, color: 0xff2a1a, intensity: 3, distance: 8 });
      K.light({ x: 2, y: 3, z: -6, color: 0xff2a1a, intensity: 2.5, distance: 7 });
      K.light({ x: 26, y: 2.8, z: 2, color: 0xff2a1a, intensity: 2.5, distance: 7 });
    }
    K.light({ x: 22, y: 2.6, z: -6, color: 0x40ff60, intensity: 1.5, distance: 4 });
    P.sign(L, 29.85, 2.5, -6, 0.9, 0.3, 'SAÍDA', -Math.PI / 2, { emissive: 1.5, bg: '#0a3a10', fg: '#60ff80' });

    // ---------------------------------------------------------------- recepção
    P.counter(L, -3, 6, 6, 1.0, 0, 'woodDark', 'wood');
    P.chair(L, -3, 5.0, Math.PI);
    for (let i = 0; i < 3; i++) {
      P.bench(L, 6.5, 2 + i * 3, -Math.PI / 2);
    }
    P.vending(L, -9.4, 10.5, Math.PI / 2, lightsOn);
    P.wheelchair(L, 3, 9, 0.6);
    P.papers(L, 0, 10, 10, 4);
    P.sign(L, 0, 3.2, 13.83, 4, 0.5, 'HOSPITAL SÃO LÁZARO', Math.PI, { bg: '#e8e8e0', fg: '#1a3a6a' });
    K.doc('d_nota_gerador', 'nota_gerador', -4.2, 6, { y: 1.06 });
    K.item('h_fuse1', 'fuse', -1.8, 6.1, { y: 1.06 });
    K.examine(-3, 6.4, 'Um quadro de avisos atrás do balcão: "VACINAÇÃO — FILA ÚNICA". Alguém riscou VACINAÇÃO e escreveu embaixo: MATADOURO.', { r: 1.2, prompt: 'Examinar o quadro' });
    L.box(9.8, 1.3, -1.5, 0.05, 0.8, 0.6, 'paper', { collide: false });
    K.examine(9.4, -1.5, ['Um calendário da campanha de vacinação. Os dias 28 a 30 de setembro estão marcados: "LOTE CR-I — POPULAÇÃO GERAL".', 'O dia 5 de outubro está circulado em vermelho, com uma anotação: "simulação do vazamento — imprensa".'], { r: 1.3, prompt: 'Examinar o calendário' });
    K.enemy({ id: 'h_lobby', type: 'errante', x: 5, z: 0, ry: 2.5, state: 'idle', look: { shirt: 0xc8c8c0, pants: 0xc8c8c0, hair: 0x2a2a2a } });

    // ---------------------------------------------------------------- enfermaria
    for (let i = 0; i < 4; i++) {
      P.bed(L, -27.6, -1.5 + i * 4, Math.PI / 2, { sheetMat: i === 2 ? 'fabricRed' : 'fabricWhite' });
      P.curtain(L, -26, 0.4 + i * 4, 0, 3.6, 'fabricGreen');
      P.ivStand(L, -28.8, -0.3 + i * 4);
      P.bed(L, -12.4, -1.5 + i * 4, -Math.PI / 2);
    }
    K.corpse(-27.4, 6.5, Math.PI / 2, { look: LOOK.worker, pose: 'bed', blood: false });
    K.doc('d_prontuario', 'prontuario_moraes', -25.8, 2.6, { y: 0.02 });
    K.item('h_herb_ward', 'herb', -12.4, 10.5, { y: 0.62 });
    K.item('h_ammo_ward', 'ammo_pistol', -20, 12.6, { y: 0.02, qty: 8 });
    // Joaquim chegou até aqui
    K.corpse(-18.5, 9.5, 0.8, { look: LOOK.joaquim, pose: 'sitFloor' });
    K.examine(-18.5, 9.5, ['Joaquim. Chegou até aqui procurando a neta.', 'Não há sinal da menina. Só um elástico de cabelo cor-de-rosa na mão dele.'], { r: 1.5 });
    K.item('h_shells_joaquim', 'ammo_shotgun', -17.6, 10.2, { y: 0.02, qty: 4 });
    K.enemy({ id: 'h_ward1', type: 'errante', x: -20, z: 2, state: 'idle', wander: true, look: { shirt: 0xb8c4c8, pants: 0xb8c4c8, hair: 0x4a3a2a } });
    K.enemy({ id: 'h_ward2', type: 'errante', x: -12.6, z: 6.4, ry: -Math.PI / 2, state: 'fakedead' });

    // ---------------------------------------------------------------- farmácia
    for (let i = 0; i < 3; i++) P.shelf(L, 16, -2.6 + i * 3.4, 0, 4, 2.2, { boxes: true });
    P.counter(L, 11.8, 6.4, 2.6, 0.8, 0, 'paintWhite', 'paintWhite');
    K.item('h_fuse2', 'fuse', 20.8, 6.6, { y: 0.02 });
    K.item('h_chem', 'chem', 12.6, 6.4, { y: 1.06 });
    K.item('h_firstaid', 'firstaid', 11.2, 6.4, { y: 1.06 });
    K.item('h_pouch', 'pouch', 21.2, -3.2, { y: 0.02 });
    K.item('h_ammo_pharm', 'ammo_pistol', 13.4, -3.2, { y: 0.02, qty: 10 });
    K.item('h_herb_pharm', 'herb', 18.2, 3.6, { y: 0.02 });

    // ---------------------------------------------------------------- escadaria (buraco das escadas)
    L.floor(22, -4, 30, -1, 'concrete');
    L.floor(22, -1, 26.6, 8, 'concrete');
    L.floor(29.4, -1, 30, 8, 'concrete');
    L.floor(26.6, 3.6, 29.4, 8, 'concrete');
    P.stairsDown(L, 28, -1, 0, 2.8);
    L.wall(26.5, -1.1, 26.7, 3.7, 1.1);
    L.wall(26.6, -1.15, 29.4, -0.95, 1.1);
    L.wall(26.6, 3.5, 29.4, 3.7, 1.1);
    for (const [x0, z0, x1, z1] of [
      [26.6, -1, 26.6, 3.6],
      [26.6, -1, 29.4, -1],
      [26.6, 3.6, 29.4, 3.6],
    ])
      L.box((x0 + x1) / 2, 1.0, (z0 + z1) / 2, Math.max(0.05, x1 - x0), 0.05, Math.max(0.05, z1 - z0), 'metalDark', { collide: false });
    K.interact({ x: 28, z: -1.6, r: 1.5, prompt: 'Descer para o subsolo', use: (g) => g.transition('hospital_sub', 'fromUp', 'stairs') });
    P.sign(L, 22.17, 2.2, 1.5, 1.6, 0.4, 'SUBSOLO ↓', Math.PI / 2, { bg: '#e8e8e0', fg: '#1a1a1a' });

    // ---------------------------------------------------------------- raio-x
    L.box(20, 0, 11, 2.2, 0.9, 1.2, 'paintWhite');
    L.box(20, 2.2, 11, 1.2, 0.5, 1.0, 'metalPaint', { collide: false });
    P.gurney(L, 14, 11, Math.PI / 2);
    P.locker(L, 28.6, 11.5, -Math.PI / 2, 2);
    K.item('h_shells_xray', 'ammo_shotgun', 27.6, 9.0, { y: 0.02, qty: 4 });
    K.enemy({ id: 'h_xray', type: 'errante', x: 17, z: 11, ry: -1.5, state: 'idle', wander: true });

    // ---------------------------------------------------------------- pediatria
    for (let i = 0; i < 4; i++) P.bed(L, 9 + i * 5, -16.4, 0, { sheetMat: 'fabricGreen' });
    L.box(26.5, 0, -10, 1.2, 0.6, 0.8, 'paintBlue');
    for (const [tx, tz, s, col] of [
      [26.2, -9.9, 0.12, 'fabricRed'],
      [26.7, -10.1, 0.1, 'fabricWhite'],
    ])
      L.sphere(tx, 0.7, tz, s, col, { batch: false });
    // o coelho de pelúcia
    L.sphere(25.9, 0.72, -10.2, 0.11, 'fabricWhite', { scale: [0.1, 0.12, 0.09], batch: false });
    L.sphere(25.9, 0.86, -10.2, 0.07, 'fabricWhite', { batch: false });
    L.box(25.87, 0.92, -10.2, 0.02, 0.12, 0.03, 'fabricWhite', { collide: false, batch: false });
    L.box(25.93, 0.92, -10.2, 0.02, 0.12, 0.03, 'fabricWhite', { collide: false, batch: false });
    K.interact({
      x: 26.2,
      z: -10.2,
      r: 1.5,
      prompt: () => (g.flag('rabbit_searched') ? 'Caixa de brinquedos' : 'Examinar os brinquedos'),
      use: (g) => {
        if (g.flag('rabbit_searched')) return g.ui.examine(['Brinquedos velhos. O Sr. Coelho, agora sem enchimento.']);
        g.ui.examine(['Uma caixa de brinquedos: um urso sem olho, uma boneca de pano... e um coelho de pelúcia encardido.', 'Há uma costura mal feita nas costas do coelho. Algo duro por dentro.'], () => {
          if (!g.inv.canAdd('key_pharmacy')) {
            g.hud.message('Inventário cheio.');
            return;
          }
          g.inv.add('key_pharmacy');
          g.setFlag('rabbit_searched');
          g.audio.play('keyItem');
          g.hud.message('Você encontrou: Chave da Farmácia.');
        });
      },
    });
    P.poster(
      L,
      17,
      1.6,
      -17.82,
      0.8,
      0.6,
      (ctx, W, H) => {
        ctx.fillStyle = '#f0ece0';
        ctx.fillRect(0, 0, W, H);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d02020';
        ctx.beginPath();
        ctx.arc(80, 70, 22, 0, 7);
        ctx.stroke();
        ctx.strokeStyle = '#2050c0';
        ctx.beginPath();
        ctx.moveTo(80, 92);
        ctx.lineTo(80, 150);
        ctx.moveTo(50, 110);
        ctx.lineTo(110, 110);
        ctx.stroke();
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath();
        ctx.ellipse(150, 140, 18, 26, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = 'bold 13px Comic Sans MS, cursive';
        ctx.fillText('A TIA ENFERMEIRA ESCONDEU', 10, 20);
        ctx.fillText('A CHAVE DENTRO DO SR. COELHO', 10, 36);
      },
      0,
    );
    K.doc('d_desenho', 'desenho_bia', 17, -17.4, { model: 'none', y: 1.5, prompt: 'Olhar o desenho' });
    K.item('h_bandage_ped', 'bandage', 9, -16.4, { y: 0.62 });
    K.enemy({ id: 'h_ped', type: 'rastejante', x: 20, z: -12, state: 'idle' });

    // ---------------------------------------------------------------- gabinete do diretor (seguro)
    P.desk(L, -1, -15.6, 0, { w: 2 });
    P.chair(L, -1, -16.6, 0);
    P.shelf(L, -7.6, -13, Math.PI / 2, 3, 2.2);
    P.sofa(L, 4.6, -12.6, -Math.PI / 2, 'fabricGreen');
    K.save(-6.6, -9.2, Math.PI);
    K.storage(5.4, -16.8, -Math.PI / 2);
    K.light({ x: -1, y: 2.8, z: -13, color: 0xffb070, intensity: 7, distance: 9 });
    P.bulb(L, -1, 3.2, -13, true, 0xffb070);
    K.doc('d_brandt', 'relatorio_brandt', -0.4, -15.4, { y: 0.79 });
    K.npc({
      id: 'renata',
      x: 2.4,
      z: -14.6,
      ry: -2.2,
      look: LOOK.renata,
      pose: 'stand',
      talk: (g) => {
        if (!g.flag('renata_talked')) {
          g.ui.dialog(DIALOGS.renata_first, () => g.setFlag('renata_talked'));
        } else if (!g.flag('power_on')) g.ui.dialog(DIALOGS.renata_hint_fuses);
        else if (!g.inv.has('card_exit') && !g.flag('chase_started')) g.ui.dialog(DIALOGS.renata_hint_power);
        else if (g.flag('chase_started')) g.ui.dialog(DIALOGS.renata_hint_exit);
        else g.ui.dialog(DIALOGS.renata_generic);
      },
    });

    // ---------------------------------------------------------------- ala de isolamento (chefe)
    for (let i = 0; i < 3; i++) P.gurney(L, -27.6, -21 + i * 4, 0.2 * i);
    K.decal(-19, -16, 4, 0);
    K.decal(-14, -12, 2, 2);
    if (power) K.light({ x: -19, y: 4.2, z: -16, color: 0xff8a6a, intensity: 6, distance: 14, flicker: 0.2 });
    const brandtX = -10.2;
    const brandtZ = -22.4;
    K.corpse(brandtX, brandtZ, -2.2, { look: LOOK.doctor, pose: 'sitFloor' });
    K.examine(brandtX, brandtZ, 'Dr. Aurélio Brandt. O jaleco está coberto de uma gosma escura. Ele voltou para coletar provas e não saiu mais.', { r: 1.4, cond: (g) => g.flag('boss2_dead') });
    if (g.flag('boss2_dead')) {
      K.item('h_card', 'card_exit', brandtX + 0.6, brandtZ + 0.4, { y: 0.02 });
    } else if (power) {
      K.trigger({
        id: 'boss2',
        x0: -29.5,
        z0: -23.5,
        x1: -8.5,
        z1: -9.6,
        persist: false,
        onEnter: (g, w) => {
          const d = w.doors.find((x) => x.def.id === 'd_iso');
          d.setOpen(false, null);
          d.locked = true;
          const boss = w.spawnEnemy({
            type: 'ninhada',
            id: 'boss2',
            x: -19,
            z: -16,
            h: 4.6,
            nodes: [
              { x: -29.6, y: 2.4, z: -12 },
              { x: -22, y: 1.8, z: -23.6 },
              { x: -8.5, y: 2.2, z: -19 },
            ],
          });
          boss.onDefeated = () => {
            d.locked = false;
            g.setMusic(null);
            w.addPickup({ id: 'h_card', item: 'card_exit', x: brandtX + 0.6, z: brandtZ + 0.4, y: 0.02 });
            g.after(1.5, () => g.hud.message('Algo brilha perto do corpo do Dr. Brandt.'));
          };
          g.setMusic('boss2');
          g.cinematicLook(boss, 2.5, 3);
        },
      });
    }

    // ---------------------------------------------------------------- perseguição
    const debris = () => {
      for (let i = 0; i < 7; i++) P.rock(L, 5 + Math.random() * 3, -6 + (Math.random() - 0.5) * 3.2, 0.5 + Math.random() * 0.4);
      L.box(6.5, 0, -6, 0.6, 1.4, 4, 'concreteDark', { rz: 0.4 });
      L.box(6, 1.2, -6, 3.5, 0.3, 0.4, 'metal', { rx: 0.3, rz: -0.5, collide: false });
      L.wall(4.2, -8, 8.8, -4, 3);
    };
    if (g.flag('chase_started')) debris();
    else if (g.flag('boss2_dead') || power) {
      K.trigger({
        id: 'chase',
        x0: -29.5,
        z0: -8,
        x1: -8,
        z1: -4,
        cond: (g) => g.flag('boss2_dead') && g.inv.has('card_exit'),
        onEnter: (g, w) => {
          g.setFlag('chase_started');
          // o teto do corredor cede
          g.audio.play('wallBreak', { x: 6, y: 2, z: -6 });
          g.cam.shake(0.08, 1);
          w.particles.dust(new THREE.Vector3(6, 2, -6), 40);
          collapseCorridor(w);
          g.after(1.4, () => spawnVigia(g, w, -27, -6, true));
          g.after(2.2, () => g.radio(RADIO.chase));
        },
      });
    }
  },

  onEnter(g, w, spawn) {
    if (!g.flag('hosp_first')) {
      g.setFlag('hosp_first');
      g.after(1.5, () => g.hud.message('Silêncio. Só a chuva no telhado e alguma coisa respirando longe.'));
    }
    if (g.flag('chase_started') && !g.flag('chase_done')) {
      // o Vigia continua à espreita
      g.after(4, () => {
        if (w.id === 'hospital' && !w.enemies.some((e) => e.def.type === 'vigia')) {
          const [x, z] = vigiaSpot(g);
          spawnVigia(g, w, x, z, false);
        }
      });
    }
  },
};

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
function collapseCorridor(w) {
  const L = w.L;
  // destroços adicionados em tempo de execução (sem mesclagem)
  for (let i = 0; i < 8; i++) {
    const s = 0.5 + Math.random() * 0.4;
    L.sphere(5 + Math.random() * 3, s * 0.5, -6 + (Math.random() - 0.5) * 3.2, s, 'concreteDark', { geo: rockGeo, batch: false, scale: [s, s * 0.7, s], rx: Math.random() * 3 });
  }
  L.box(6.5, 0, -6, 0.6, 1.4, 4, 'concreteDark', { rz: 0.4, batch: false, collide: false });
  for (let i = 0; i < 8; i++) L.box(5 + Math.random() * 3, 0, -6 + (Math.random() - 0.5) * 3, 0.5 + Math.random(), 0.4 + Math.random() * 0.6, 0.5 + Math.random(), 'concreteDark', { batch: false, ry: Math.random() * 3, collide: false });
  w.collision.add(4.2, -8, 8.8, -4, 3);
  w.nav.markRect(4.2, -8, 8.8, -4, 1, 0.3);
}

// ponto de reaparecimento: o mais longe possível da saída, mas não em cima do jogador
function vigiaSpot(g) {
  const p = g.player.pos;
  const spots = [
    [-27, -6],
    [-20, 10],
    [0, 12],
    [-4, -1],
    [26, 11],
  ];
  const ok = spots.filter(([x, z]) => Math.hypot(x - p.x, z - p.z) > 14);
  const list = ok.length ? ok : spots;
  list.sort((a, b) => Math.hypot(b[0] - 30, b[1] + 6) - Math.hypot(a[0] - 30, a[1] + 6));
  return list[0];
}

function spawnVigia(g, w, x, z, burst) {
  const v = w.spawnEnemy({ type: 'vigia', id: 'vigia_h', x, z, state: burst ? 'burst' : 'chase', persist: false });
  if (!v) return;
  g.setMusic('chase');
  if (burst) {
    g.audio.play('wallBreak', { x, y: 2, z });
    g.audio.play('vigiaRoar', { x, y: 2, z });
    g.cam.shake(0.1, 0.8);
    w.particles.dust(v.pos.clone().setY(1.5), 40);
  } else g.audio.play('vigiaRoar', { x, y: 2, z }, 0.7);
  v.onLeave = () => {
    g.setMusic(null);
    g.hud.message('Os passos pesados se afastam... por enquanto.');
    // volta quando o jogador sair da área segura
    const check = () => {
      if (w.id !== 'hospital' || g.flag('chase_done')) return;
      if (!w.isSafe(g.player.pos.x, g.player.pos.z))
        g.after(6, () => {
          if (w.id !== 'hospital' || g.flag('chase_done') || w.enemies.some((e) => e.def.type === 'vigia')) return;
          const [x, z] = vigiaSpot(g);
          spawnVigia(g, w, x, z, false);
        });
      else g.after(1, check);
    };
    g.after(2, check);
  };
}
