// ÁREA 6 — Estação Raiz: laboratório subterrâneo. Final da Parte I.
import * as THREE from 'three';
import { makeKit, LOOK, P, emissive } from './kit.js';
import { RADIO } from '../../game/Story.js';

const LABCOAT = { shirt: 0xd8d8d0, pants: 0x3a3a3a, hair: 0x2a2a2a };

export default {
  id: 'lab',
  fog: { color: 0x06070a, density: 0.05 },
  sky: 0x2a3038,
  ground: 0x0a0a0a,
  ambient: 0.1,
  ambience: 'lab',
  music: 'explore',
  bounds: { minX: -26, minZ: -34, maxX: 26, maxZ: 12 },
  ceilDefault: 3.4,

  build(L, g, w) {
    const K = makeKit(L, g, w);
    const final = !!g.flag('final_started');
    // a contagem do elevador não sobrevive a um carregamento: pode chamar de novo
    if (g.flag('elevator_called') && !g.flag('elevator_here')) g.setFlag('elevator_called', false);
    L.spawn('fromTunnels', 0, 8.6, Math.PI);
    L.spawn('default', 0, 8.6, Math.PI);
    const LB = { wall: 'labpanel', floor: 'labfloor', ceil: 'ceiling', h: 3.4 };
    L.room({ ...LB, id: 'check', name: 'Posto de controle', x0: -6, x1: 6, z0: 0, z1: 10, open: { n: [[-2, 2]] } });
    L.room({ ...LB, id: 'corL', name: 'Corredor principal', x0: -24, x1: 24, z0: -4, z1: 0, open: { s: [[-2, 2]] } });
    L.room({ ...LB, id: 'cont', name: 'Contenção', x0: -24, x1: -6, z0: 0, z1: 12, h: 4 });
    L.room({ ...LB, id: 'office', name: 'Escritório científico', x0: -24, x1: -10, z0: -14, z1: -4, floor: 'carpet' });
    L.room({ ...LB, id: 'sec', name: 'Sala de segurança', x0: -10, x1: 0, z0: -14, z1: -4, safe: true });
    L.room({ ...LB, id: 'cold', name: 'Câmara fria', x0: 6, x1: 24, z0: 0, z1: 12, wall: 'metal' });
    L.room({ ...LB, id: 'central', name: 'Laboratório central', x0: 0, x1: 24, z0: -28, z1: -4, h: 5 });
    L.room({ ...LB, id: 'elev', name: 'Elevador de carga', x0: 9, x1: 15, z0: -32, z1: -28, wall: 'metalDark', floor: 'metal', ceil: 'metalDark', h: 3.2 });

    L.door({ id: 'd_tunnels', x: 0, z: 10, axis: 'x', w: 2.4, h: 2.8, kind: 'security', to: { map: 'tunnels', spawn: 'fromLab' } });
    L.door({ id: 'd_cont', x: -15, z: 0, axis: 'x', w: 1.8, kind: 'security' });
    L.door({ id: 'd_office', x: -17, z: -4, axis: 'x', w: 1.2, kind: 'glass' });
    L.door({ id: 'd_sec', x: -5, z: -4, axis: 'x', w: 1.2, kind: 'metal' });
    L.door({ id: 'd_cold', x: 15, z: 0, axis: 'x', w: 1.8, kind: 'security' });
    L.door({
      id: 'd_central',
      x: 12,
      z: -4,
      axis: 'x',
      w: 2.4,
      h: 2.8,
      kind: 'security',
      lock: {
        flag: 'central_open',
        msg: null,
        onLocked: (g) => {
          const have = ['sample_blue', 'sample_amber', 'sample_red'].filter((id) => g.inv.has(id));
          if (have.length < 3) {
            g.ui.examine([`LABORATÓRIO CENTRAL — leitor de amostras. Três encaixes vazios. O visor pisca: "INSIRA AS AMOSTRAS-PADRÃO".${have.length ? ` Você tem ${have.length} de 3.` : ''}`]);
            return;
          }
          g.ui.openSamples({
            samples: ['sample_red', 'sample_blue', 'sample_amber'],
            solution: ['sample_blue', 'sample_amber', 'sample_red'],
            onSolve: () => {
              for (const id of have) g.inv.remove(id, 1);
              g.setFlag('central_open');
              w.unlockDoor('d_central', true);
              g.hud.message('SEQUÊNCIA ACEITA. As portas do laboratório central se abrem.');
            },
            onFail: () => {
              g.after(1, () => {
                g.audio.play('vent', { x: 18, y: 3, z: -2 });
                w.spawnEnemy({ type: 'rastejante', id: 'lab_pen_' + Math.floor(Math.random() * 1e6), x: 19, z: -2, state: 'emerge', y: 3, persist: false });
              });
            },
          });
        },
      },
    });
    L.door({ id: 'd_elev', x: 12, z: -28, axis: 'x', w: 2.6, h: 2.8, kind: 'security', lock: { flag: 'elevator_here', msg: 'ELEVADOR DE CARGA — o elevador não está neste andar. Há um painel de chamada ao lado.' } });

    // ---------------------------------------------------------------- luzes
    const fl = (x, z, h, flicker, group = 'normal', on = !final) => {
      P.fluorescent(L, x, h, z, 0, true);
      return K.light({ x, y: h - 0.3, z, color: 0xe8f4ff, intensity: 7, distance: 11, flicker, group, on });
    };
    K.light({ x: 0, y: 2.6, z: 5, color: 0xff2a1a, intensity: 2.2, distance: 8, flicker: 0.5 });
    fl(-12, -2, 3.4, 0.05);
    fl(12, -2, 3.4, 0.4);
    fl(7, -16, 5, 0.05);
    fl(18, -16, 5, 0.1);
    K.light({ x: 12, y: 4.5, z: -16, color: 0xff1a0a, intensity: 10, distance: 18, flicker: 0.3, group: 'alarm', on: final });
    K.light({ x: -2, y: 2.6, z: -2, color: 0xff1a0a, intensity: 5, distance: 12, flicker: 0.3, group: 'alarm', on: final });
    K.light({ x: -15, y: 2.5, z: 4, color: 0x40ffa0, intensity: 5, distance: 12, flicker: 0.05 });
    K.light({ x: 15, y: 3, z: 6, color: 0xa0d0ff, intensity: 6, distance: 12, flicker: 0.1 });
    K.light({ x: 12, y: 2.8, z: -30, color: 0xffe0b0, intensity: 3, distance: 6 });

    // ---------------------------------------------------------------- posto de controle
    P.counter(L, -3, 4, 4, 0.8, 0, 'metalPaint', 'plasticDark');
    P.terminal(L, -3.6, 3.6, Math.PI, 0xff4030);
    for (const x of [1.5, 3]) L.box(x, 0, 6, 0.1, 1, 1.2, 'chrome');
    P.sign(L, 0, 2.7, 0.17, 3.6, 0.5, 'ESTAÇÃO RAIZ · VÉRTICE', 0, { bg: '#e8e8e4', fg: '#1a3a5a', font: 'Arial' });
    K.corpse(4, 2.4, 0.4, { look: LOOK.guard, pose: 'dead' });
    K.item('lab_ammo_check', 'ammo_pistol', 4.6, 1.6, { y: 0.02, qty: 10 });

    // ---------------------------------------------------------------- corredor
    P.sign(L, -15, 2.5, -3.83, 2, 0.35, '← CONTENÇÃO · ESCRITÓRIOS', 0, { bg: '#e8e8e4', fg: '#1a1a1a', font: 'Arial' });
    P.sign(L, 15, 2.5, -0.17, 2, 0.35, 'CÂMARA FRIA →', Math.PI, { bg: '#e8e8e4', fg: '#1a1a1a', font: 'Arial' });
    P.sign(L, 12, 3.1, -4.17, 3, 0.45, 'LABORATÓRIO CENTRAL — NÍVEL 1', Math.PI, { bg: '#8a1a10', fg: '#f0e8e0', font: 'Arial' });
    L.box(13.6, 1.0, -4.25, 0.5, 0.6, 0.12, 'plasticDark', { collide: false });
    for (let i = 0; i < 3; i++) L.box(13.45 + i * 0.15, 1.2, -4.32, 0.1, 0.1, 0.02, emissive([0x2a70ff, 0xffa020, 0xff2020][i], 1.5), { collide: false, batch: false });
    K.decal(-6, -2, 1.5, 2);
    K.enemy({ id: 'lab_cor', type: 'errante', x: 18, z: -2, ry: -1.5, state: 'idle', wander: true, hazmat: true, look: { shirt: 0xc8c4a8, pants: 0xc8c4a8, hair: null } });

    // ---------------------------------------------------------------- contenção
    P.tank(L, -21, 4, { color: 0x2a9a6a });
    P.tank(L, -17, 4, { broken: true });
    P.tank(L, -13, 4, { color: 0x2a9a6a });
    P.tank(L, -9, 4, { broken: true });
    for (let i = 0; i < 3; i++) {
      const x0 = -24 + i * 6;
      L.box(x0 + 6, 0, 9.5, 0.12, 4, 5, 'labpanel');
      // a primeira cela está com o vidro estilhaçado
      if (i > 0) L.box(x0 + 3, 0, 9.4, 5.6, 2.6, 0.05, 'glass', { collide: true });
      else for (let k = 0; k < 6; k++) L.box(x0 + 0.5 + Math.random() * 5, 0.005, 8.6 + Math.random() * 1.6, 0.15, 0.01, 0.1, 'glass', { collide: false, ry: Math.random() * 3 });
    }
    L.box(-21, 0, 10.8, 1.2, 0.9, 0.6, 'metal');
    K.item('lab_red', 'sample_red', -21, 10.8, { y: 0.92 });
    K.decal(-17, 4, 2.2, 1);
    K.decal(-9, 4.6, 1.8, 1);
    K.enemy({ id: 'lab_c1', type: 'rastejante', x: -18, z: 7, state: 'idle' });
    K.enemy({ id: 'lab_c2', type: 'rastejante', x: -10, z: 8, state: 'idle' });

    // ---------------------------------------------------------------- escritório científico
    P.desk(L, -21, -10, 0, { w: 1.8 });
    P.deskClutter(L, -21, -10, 0);
    P.desk(L, -14, -10, 0, { w: 1.8 });
    P.deskClutter(L, -14, -10, 0);
    P.chair(L, -21, -9, Math.PI);
    L.box(-23.5, 0, -13.2, 0.8, 1.2, 0.7, 'paintWhite');
    K.item('lab_amber', 'sample_amber', -23.5, -13.2, { y: 1.22 });
    L.box(-17, 0.9, -13.82, 3.2, 1.5, 0.05, 'paintWhite', { collide: false });
    P.poster(
      L,
      -17,
      1.65,
      -13.78,
      3,
      1.4,
      (ctx, W, H) => {
        ctx.fillStyle = '#f2f2ee';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText('CICLO CR', 12, 22);
        const rows = [
          ['I', '#2a60e0', 'AZUL — incubação'],
          ['II', '#e09010', 'ÂMBAR — transmissão'],
          ['III', '#d02020', 'VERMELHO — colheita'],
        ];
        rows.forEach(([n, c, t], i) => {
          ctx.fillStyle = c;
          ctx.font = 'bold 16px Arial';
          ctx.fillText(n, 14, 50 + i * 24);
          ctx.fillStyle = '#222';
          ctx.font = '12px Arial';
          ctx.fillText(t, 44, 50 + i * 24);
        });
      },
      0,
    );
    K.doc('d_quadro', 'quadro_estagios', -17, -13.3, { model: 'none', y: 1.5, r: 1.8, prompt: 'Ler o quadro branco' });
    L.box(-11.2, 0.79, -10.2, 0.2, 0.15, 0.03, 'woodDark', { collide: false });
    K.examine(-11.2, -10.2, ['Um porta-retratos sobre a mesa: "EQUIPE FASE 2 — ESTAÇÃO RAIZ".', 'Seis pessoas de jaleco sorrindo para a câmera. Na ponta, de braços cruzados, Marina. Ela parece mais velha do que você lembrava. Ou mais cansada.'], { r: 1.3, prompt: 'Examinar o porta-retratos' });
    K.enemy({ id: 'lab_off', type: 'errante', x: -13, z: -7, ry: 2.5, state: 'idle', look: LABCOAT });

    // ---------------------------------------------------------------- segurança (segura)
    for (let i = 0; i < 3; i++) P.terminal(L, -8.8 + i * 1.6, -13.4, 0, 0x60c0ff);
    P.locker(L, -0.6, -8, -Math.PI / 2, 2);
    K.save(-9.2, -6, Math.PI / 2);
    K.storage(-5, -4.7, Math.PI);
    K.light({ x: -5, y: 3.0, z: -9, color: 0xffb070, intensity: 6, distance: 9 });
    P.bulb(L, -5, 3.4, -9, true, 0xffb070);
    K.item('lab_herb_sec', 'herb', -2, -13.2, { y: 0.02 });
    K.item('lab_shells_sec', 'ammo_shotgun', -1.2, -12.6, { y: 0.02, qty: 4 });

    // ---------------------------------------------------------------- câmara fria
    for (let i = 0; i < 3; i++) P.shelf(L, 9 + i * 5, 11.2, Math.PI, 3.6, 2.4, { boxes: true });
    for (let i = 0; i < 3; i++) {
      L.box(10 + i * 4, 0, 4.5, 0.9, 0.35, 2, 'plasticDark');
    }
    L.box(22.6, 0, 9, 1.2, 1.0, 0.8, 'metal');
    K.item('lab_blue', 'sample_blue', 22.6, 9, { y: 1.02 });
    K.onUpdate((dt, g, w) => {
      if (Math.random() < dt * 5) w.particles.steam(new THREE.Vector3(6.5 + Math.random() * 17, 0.1, 1 + Math.random() * 10), [0.7, 0.8, 0.9]);
    });
    K.enemy({ id: 'lab_k1', type: 'errante', x: 12, z: 7, ry: 1, state: 'idle', speed: 0.7, look: LABCOAT });
    K.enemy({ id: 'lab_k2', type: 'errante', x: 19, z: 4, ry: -2, state: 'fakedead', look: LABCOAT });

    // ---------------------------------------------------------------- laboratório central
    L.cyl(12, 0, -16, 2.2, 0.5, 'metalDark', { seg: 20 });
    L.cyl(12, 4.4, -16, 2.2, 0.6, 'metalDark', { seg: 20, collide: false });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      L.box(12 + Math.cos(a) * 2, 0.5, -16 + Math.sin(a) * 2, 0.4, 1.4 - (i % 2) * 0.6, 0.05, 'glass', { collide: false, ry: -a });
    }
    K.decal(12, -16, 4, 1);
    K.decal(10, -12, 2, 2);
    K.examine(12, -13.4, 'O tanque principal estourou de dentro para fora. Seja o que for que estava aqui, tinha mais de dois metros e meio.', { r: 2 });
    for (let i = 0; i < 4; i++) P.serverRack(L, 23.2, -24 + i * 1.6, -Math.PI / 2);
    P.desk(L, 4, -20, Math.PI / 2, { w: 2 });
    P.deskClutter(L, 4, -20, Math.PI / 2);
    K.doc('d_colheita', 'relatorio_colheita', 4.1, -20.4, { y: 0.79 });
    P.terminal(L, 19, -26.6, 0, 0x40ff90);
    K.doc('d_email', 'email_lacerda', 19, -25.9, {
      model: 'none',
      y: 1.0,
      r: 1.6,
      prompt: 'Usar o terminal',
      onRead: (g) => startFinal(g, w),
    });
    P.sign(L, 12, 3.2, -27.83, 3, 0.5, 'CARGA — NÍVEL 4 ↓', 0, { bg: '#c8b030', fg: '#1a1408', font: 'Arial' });
    L.box(14.4, 1.0, -27.75, 0.3, 0.5, 0.12, 'plasticDark', { collide: false });
    K.interact({
      x: 14.4,
      z: -27,
      r: 1.4,
      prompt: () => (g.flag('elevator_here') ? 'Elevador (aberto)' : g.flag('elevator_called') ? 'Elevador (chegando...)' : 'Chamar o elevador'),
      use: (g) => {
        if (g.flag('elevator_here')) return;
        if (!g.flag('final_started')) {
          g.ui.examine(['Painel do elevador de carga. Um só destino: NÍVEL 4. "ACESSO SOMENTE COM AUTORIZAÇÃO DA COORDENAÇÃO."', 'O painel está bloqueado. Talvez o terminal da sala tenha algo.']);
          return;
        }
        if (g.flag('elevator_called')) return g.hud.message('O elevador está descendo... aguente.');
        g.setFlag('elevator_called');
        g.audio.play('elevator', { x: 12, y: 2, z: -30 });
        let t = 14;
        g.hud.setTimer(`ELEVADOR: ${t}s`);
        const tick = () => {
          t--;
          if (w.id !== 'lab') return g.hud.setTimer(null);
          if (t <= 0) {
            g.hud.setTimer(null);
            g.setFlag('elevator_here');
            w.unlockDoor('d_elev', true);
            g.audio.play('metalDoor', { x: 12, y: 1, z: -28 });
            g.hud.message('O elevador chegou! Entre!');
            return;
          }
          g.hud.setTimer(`ELEVADOR: ${t}s`);
          if (t % 4 === 0) g.audio.play('elevator', { x: 12, y: 2, z: -30 }, 0.6);
          g.after(1, tick);
        };
        g.after(1, tick);
      },
    });
    K.trigger({
      id: 'ending',
      x0: 9.5,
      z0: -31.6,
      x1: 14.5,
      z1: -28.6,
      persist: false,
      cond: (g) => g.flag('elevator_here'),
      onEnter: (g) => g.ending(),
    });
    if (final) {
      // recarregando no meio do final: o Vigia já está à espreita
      g.after(3, () => spawnLabVigia(g, w));
      K.onUpdate(alarmUpdater());
    }
  },

  onEnter(g) {
    if (!g.flag('lab_first')) {
      g.setFlag('lab_first');
      g.after(1.5, () => g.hud.message('Ar filtrado, cheiro de desinfetante e de algo apodrecendo por baixo.'));
    }
  },
};

function alarmUpdater() {
  let t = 0;
  return (dt, g) => {
    t -= dt;
    if (t <= 0) {
      t = 3.2;
      g.audio.play('alarm', { x: 12, y: 4, z: -16 }, 0.6);
    }
  };
}

function startFinal(g, w) {
  if (g.flag('final_started')) return;
  g.setFlag('final_started');
  g.after(1.2, () => {
    w.setLightGroup('normal', false);
    w.setLightGroup('alarm', true);
    g.audio.play('powerOn', null, 0.6);
    w.updaters.push(alarmUpdater());
    g.setMusic('none');
  });
  g.after(3, () => g.radio(RADIO.lab_marina));
  g.after(20, () => spawnLabVigia(g, w));
}

function spawnLabVigia(g, w) {
  if (w.id !== 'lab' || w.enemies.some((e) => e.def.type === 'vigia')) return;
  const v = w.spawnEnemy({ type: 'vigia', id: 'vigia_lab', x: 12, z: -2, state: 'burst', persist: false, speed: 3.1 });
  if (!v) return;
  g.audio.play('wallBreak', { x: 12, y: 2, z: -3 });
  g.audio.play('vigiaRoar', { x: 12, y: 2, z: -3 });
  g.cam.shake(0.1, 0.8);
  g.setMusic('chase');
  g.after(2, () => {
    if (!g.flag('elevator_called')) g.hud.hint('Chame o elevador no fundo do laboratório e sobreviva até ele chegar.', 8);
  });
  v.onLeave = () => {
    g.setMusic(null);
    // volta alguns segundos depois que o jogador deixar a área segura
    const check = () => {
      if (w.id !== 'lab') return;
      if (w.isSafe(g.player.pos.x, g.player.pos.z)) g.after(1, check);
      else g.after(6, () => spawnLabVigia(g, w));
    };
    g.after(2, check);
  };
}
