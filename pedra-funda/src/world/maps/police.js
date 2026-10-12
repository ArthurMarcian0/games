// ÁREA 2 — Delegacia de Pedra Funda (interna). Chefe: O Carcereiro (garagem).
import { makeKit, LOOK, P } from './kit.js';
import { RADIO } from '../../game/Story.js';

export default {
  id: 'police',
  fog: { color: 0x07080a, density: 0.06 },
  sky: 0x2a3038,
  ground: 0x0a0908,
  ambient: 0.12,
  ambience: 'building',
  music: 'explore',
  bounds: { minX: -28, minZ: -26, maxX: 32, maxZ: 14 },
  rainBounds: { minX: 18.2, minZ: -0.2, maxX: 26, maxZ: 12 },
  ceilDefault: 3,

  build(L, g, w) {
    const K = makeKit(L, g, w);
    L.spawn('front', 0, 8.6, Math.PI);
    L.spawn('garage', 28.4, -14, -Math.PI / 2);
    L.spawn('default', 0, 8.6, Math.PI);
    const blue = { wall: 'plasterBlue', wainscot: { mat: 'woodDark', h: 1.05 }, floor: 'tilefloor', ceil: 'ceiling', h: 3.1, trim: 'woodDark' };

    // ---------------------------------------------------------------- salas
    L.room({ ...blue, id: 'recepcao', name: 'Recepção', x0: -6, x1: 6, z0: 0, z1: 10, h: 3.4, open: { n: [[-2, 2]] } });
    L.room({ ...blue, id: 'corredor', name: 'Corredor', x0: -18, x1: 18, z0: -4, z1: 0, open: { s: [[-2, 2]] } });
    L.room({ ...blue, id: 'escritorio', name: 'Sala dos investigadores', x0: -18, x1: -6, z0: 0, z1: 10, floor: 'carpet' });
    L.room({
      id: 'celas',
      name: 'Bloco de celas',
      x0: 6,
      x1: 18,
      z0: 0,
      z1: 10,
      h: 3.1,
      wall: 'concrete',
      floor: 'concrete',
      ceil: 'concreteDark',
      windows: [
        { side: 'e', a: 1.0, b: 2.4, y0: 1.9, y1: 2.6, bars: true },
        { side: 'e', a: 4.3, b: 5.7, y0: 1.9, y1: 2.6, bars: true },
        { side: 'e', a: 7.6, b: 9.0, y0: 1.9, y1: 2.6, bars: true },
      ],
    });
    L.room({ ...blue, id: 'arquivo', name: 'Arquivo', x0: -26, x1: -18, z0: -12, z1: 6, wall: 'plasterDark', wainscot: null, floor: 'concrete' });
    L.room({ ...blue, id: 'descanso', name: 'Sala de descanso', x0: -18, x1: -8, z0: -14, z1: -4, wall: 'wallpaper', floor: 'woodfloor', safe: true });
    L.room({ ...blue, id: 'arsenal', name: 'Arsenal', x0: -8, x1: 0, z0: -12, z1: -4, wall: 'concrete', wainscot: null, floor: 'concrete' });
    L.room({ ...blue, id: 'gabinete', name: 'Gabinete do delegado', x0: 0, x1: 10, z0: -14, z1: -4, wall: 'wallpaperRed', floor: 'woodfloor' });
    L.room({ id: 'garagem', name: 'Garagem', x0: 10, x1: 30, z0: -24, z1: -4, h: 5, wall: 'concreteDark', floor: 'concrete', ceil: 'metalDark' });
    // beco externo (visto pelas janelas das celas)
    L.floor(18, -1, 26, 12, 'dirt');
    P.fence(L, 24.5, -1, 24.5, 12, 3, { barbed: true });
    L.box(22, 0, -1.2, 8, 4, 0.3, 'brickDark');
    L.box(22, 0, 12.2, 8, 4, 0.3, 'brickDark');
    K.light({ x: 22, y: 4, z: 5, color: 0x6a7a9a, intensity: 3, distance: 10 });

    // ---------------------------------------------------------------- portas
    L.door({ id: 'd_front', x: 0, z: 10, axis: 'x', w: 2, kind: 'double', to: { map: 'town', spawn: 'fromPolice' } });
    L.door({ id: 'd_office', x: -12, z: 0, axis: 'x', w: 1.2, kind: 'glass' });
    L.door({ id: 'd_cells', x: 12, z: 0, axis: 'x', w: 1.2, kind: 'metal' });
    L.door({ id: 'd_archive', x: -18, z: -2, axis: 'z', w: 1.2, kind: 'wood' });
    L.door({ id: 'd_rest', x: -13, z: -4, axis: 'x', w: 1.2, kind: 'wood' });
    L.door({ id: 'd_armory', x: -4, z: -4, axis: 'x', w: 1.2, kind: 'metal', lock: { code: '7138', codeTitle: 'ARSENAL — código de acesso', msg: 'Porta blindada com painel numérico de quatro dígitos.', okMsg: 'A trava do arsenal se abriu.' } });
    L.door({ id: 'd_chief', x: 5, z: -4, axis: 'x', w: 1.2, kind: 'wood', lock: { item: 'key_chief', consume: true, msg: 'Uma placa de latão: "DEL. ALDO BASTOS". Trancada.' } });
    L.door({
      id: 'd_garage',
      x: 14,
      z: -4,
      axis: 'x',
      w: 1.4,
      kind: 'metal',
      lock: { flag: 'got_eastgate', msg: 'A porta da garagem está emperrada. De vez em quando, algo pesado bate do outro lado.' },
    });
    L.door({ id: 'd_garage_out', x: 30, z: -14, axis: 'z', w: 4, h: 3.4, kind: 'roll', lock: { flag: 'boss1_dead', msg: 'O portão da garagem não abre por aqui enquanto aquela coisa estiver de pé.' }, to: { map: 'town', spawn: 'fromPoliceGarage' } });
    // celas (abrem pela alavanca)
    const cellLock = { msg: 'A grade está trancada. As celas abrem pela alavanca do painel na parede.' };
    L.door({ id: 'cell1', x: 14, z: 1.7, axis: 'z', w: 1.1, h: 2.6, kind: 'bars', lock: cellLock });
    L.door({ id: 'cell2', x: 14, z: 5, axis: 'z', w: 1.1, h: 2.6, kind: 'bars', lock: cellLock });
    L.door({ id: 'cell3', x: 14, z: 8.3, axis: 'z', w: 1.1, h: 2.6, kind: 'bars', lock: cellLock });

    // ---------------------------------------------------------------- recepção
    P.counter(L, -1.2, 3.2, 6, 0.8, 0, 'woodDark', 'wood');
    P.chair(L, -2, 2.2, Math.PI);
    P.bench(L, 4.6, 7, -Math.PI / 2);
    P.bench(L, -4.6, 7, Math.PI / 2);
    P.vending(L, 5.4, 1.2, -Math.PI / 2, true);
    P.papers(L, 1, 6, 8, 3);
    P.sign(L, 0, 2.6, 0.17, 3, 0.45, 'ATENDIMENTO 24 H', 0, { bg: '#e8e8e0', fg: '#1a2a4a' });
    K.corpse(2.6, 5.4, 2.4, { look: LOOK.cop, pose: 'deadFace' });
    K.examine(2.6, 5.4, 'Um policial. A identificação diz "Sd. Teles". Foi mordido no pescoço. A arma do coldre sumiu.', { r: 1.6 });
    K.light({ x: 0, y: 3.2, z: 5, color: 0xd8ecff, intensity: 6, distance: 9, flicker: 0.35 });
    P.fluorescent(L, 0, 3.4, 5, 0, true);
    K.enemy({ id: 'p_rec', type: 'errante', x: -4.6, z: 1.2, ry: Math.PI, state: 'idle', look: { shirt: 0x1f2a3e, pants: 0x161c28, hair: 0x101010 } });

    // ---------------------------------------------------------------- corredor
    K.light({ x: -8, y: 2.9, z: -2, color: 0xd8ecff, intensity: 5, distance: 9, flicker: 0.05 });
    P.fluorescent(L, -8, 3.1, -2, 0, true);
    K.light({ x: 9, y: 2.9, z: -2, color: 0xd8ecff, intensity: 4, distance: 8, flicker: 0.6 });
    P.fluorescent(L, 9, 3.1, -2, 0, true);
    P.fluorescent(L, 0, 3.1, -2, 0, false);
    P.filingCabinet(L, 16.9, -1.5, -Math.PI / 2);
    P.trashBags(L, -16.5, -0.8, 2);
    K.decal(3, -2, 1.3, 2);
    K.decal(4.5, -2.3, 1.0, 2);
    K.enemy({ id: 'p_hall', type: 'errante', x: 7, z: -2, state: 'idle', wander: true });

    // ---------------------------------------------------------------- escritório
    for (const [dx, dz] of [
      [-15, 3],
      [-15, 7],
      [-9.5, 3],
      [-9.5, 7],
    ]) {
      P.desk(L, dx, dz, 0, { w: 1.6 });
      P.deskClutter(L, dx, dz, 0);
      P.chair(L, dx - 0.2, dz + 0.75, Math.PI);
    }
    P.filingCabinet(L, -17.4, 9.2, Math.PI / 2);
    P.filingCabinet(L, -17.4, 8.6, Math.PI / 2);
    P.shelf(L, -6.4, 7.5, -Math.PI / 2, 2, 2, { boxes: true });
    // quadro de escala
    L.box(-17.8, 1.0, 4.8, 0.05, 1.3, 2.2, 'woodDark', { collide: false });
    P.poster(
      L,
      -17.76,
      1.65,
      4.8,
      2.0,
      1.1,
      (ctx, W, H) => {
        ctx.fillStyle = '#d8d4c4';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#1a2a4a';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('ESCALA DE PLANTÃO — OUTUBRO', 14, 22);
        ctx.font = '11px "Courier New"';
        const rows = ['Del. A. Bastos ... 0001', 'Cb. Figueiredo ... 1156', 'Sd. Prado ....... 3809', 'Sd. Ramos ....... 4471', 'Sd. Teles ....... 2938'];
        rows.forEach((r, i) => ctx.fillText(r, 18, 46 + i * 17));
        ctx.strokeStyle = '#8a1a14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, 79);
        ctx.lineTo(180, 75);
        ctx.stroke();
      },
      Math.PI / 2,
    );
    K.doc('d_escala', 'escala_plantao', -17.5, 4.8, { model: 'none', y: 1.6, r: 1.8, prompt: 'Ler o quadro' });
    K.doc('d_memo', 'memo_arsenal', -9.5, 7.1, { y: 0.79 });
    L.box(-6.9, 0.95, 7.2, 0.4, 0.3, 0.5, 'oldwood', { collide: false });
    K.doc('d_foto', 'foto_equipe', -6.95, 7.2, { y: 1.27, model: 'photo', prompt: 'Revirar pertences apreendidos' });
    K.item('p_ammo_office', 'ammo_pistol', -15, 3.1, { y: 0.79, qty: 6 });
    K.light({ x: -12, y: 2.8, z: 5, color: 0xffd8a0, intensity: 3, distance: 8, flicker: 0.1 });
    K.enemy({ id: 'p_office', type: 'errante', x: -11.5, z: 5, ry: 1.2, state: 'fakedead' });

    // ---------------------------------------------------------------- celas
    for (const z of [3.33, 6.66]) L.box(16, 0, z, 4, 3.1, 0.15, 'concrete');
    P.cellBarsZ(L, 14, 0.15, 1.1);
    P.cellBarsZ(L, 14, 2.3, 4.4);
    P.cellBarsZ(L, 14, 5.6, 7.7);
    P.cellBarsZ(L, 14, 8.9, 9.85);
    for (const z of [1.7, 5, 8.3]) {
      L.box(17.3, 0, z, 1.2, 0.45, 0.8, 'metalDark');
      L.box(17.3, 0.45, z, 1.1, 0.08, 0.7, 'mattress', { collide: false });
    }
    P.toilet(L, 15, 2.7, Math.PI);
    P.poster(
      L,
      17.83,
      1.6,
      5,
      2.2,
      0.9,
      (ctx, W, H) => {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(110,10,8,0.9)';
        ctx.font = 'bold 34px Georgia';
        ctx.fillText('NINGUÉM', 14, 46);
        ctx.fillText('SAI', 70, 90);
      },
      -Math.PI / 2,
    );
    // alavanca
    P.panel(L, 6.25, 1.0, 5, Math.PI / 2);
    K.interact({
      x: 6.6,
      z: 5,
      r: 1.6,
      prompt: () => (g.flag('cells_open') ? 'Painel das celas (aberto)' : 'Puxar a alavanca das celas'),
      use: (g) => {
        if (g.flag('cells_open')) {
          g.hud.message('As celas já estão abertas.');
          return;
        }
        g.setFlag('cells_open');
        g.audio.play('breaker');
        g.audio.play('gate', { x: 14, y: 1, z: 5 });
        g.cam.shake(0.03, 0.4);
        for (const id of ['cell1', 'cell2', 'cell3']) w.unlockDoor(id, true);
        const e = w.enemies.find((x) => x.id === 'p_cell');
        if (e) {
          e.alert = true;
          e.setState('notice');
        }
        g.hud.message('As grades se abriram com um estrondo.');
      },
    });
    if (g.flag('cells_open')) for (const d of ['cell1', 'cell2', 'cell3']) g.setFlag(`door_police_${d}`, 'o');
    K.enemy({ id: 'p_cell', type: 'errante', x: 16.5, z: 1.7, ry: -Math.PI / 2, state: 'idle', look: { shirt: 0x8a7a6a, pants: 0x3a3a3a, hair: 0x4a3020 } });
    K.corpse(16.6, 8.0, -1.9, { look: LOOK.caio, pose: 'sitFloor', blood: true });
    K.doc('d_fita_caio', 'fita_caio', 15.8, 8.6, { y: 0.02, model: 'tape' });
    K.item('p_key_chief', 'key_chief', 16.0, 7.6, { y: 0.02 });
    K.examine(16.6, 8.0, 'Caio. O rosto magro, os óculos quebrados no chão. Ele esperou por ajuda até o fim.', { r: 1.4 });
    K.light({ x: 10, y: 2.8, z: 5, color: 0xffc890, intensity: 3.5, distance: 8, flicker: 0.4 });
    P.bulb(L, 10, 3.1, 5, true);
    K.trigger({
      id: 'vigia_window',
      x0: 7,
      z0: 0.5,
      x1: 13.5,
      z1: 9.5,
      onEnter: (g, w) => {
        const v = w.spawnEnemy({ type: 'vigia', id: 'win_vigia', x: 21.5, z: 13, ry: Math.PI, state: 'walk', persist: false });
        if (!v) return;
        v.walkTo = { x: 21.5, z: -3 };
        v.walkSpeed = 1.3;
        v.yaw = Math.PI;
        g.after(1.2, () => g.audio.play('stinger', null, 0.4));
      },
    });

    // ---------------------------------------------------------------- arquivo
    for (let i = 0; i < 4; i++) {
      P.shelf(L, -23.6, -9 + i * 3.6, 0, 3.4, 2.2, { boxes: true });
    }
    P.filingCabinet(L, -18.6, 4.6, -Math.PI / 2);
    K.item('p_ammo_archive', 'ammo_pistol', -24.2, 4.4, { y: 0.02, qty: 8 });
    K.item('p_powder', 'gunpowder', -20, -10.8, { y: 0.02 });
    K.item('p_herb_archive', 'herb', -19.0, -11.2, { y: 0.02 });
    L.box(-22, 2.6, -2.5, 0.8, 0.3, 0.8, 'metalDark', { collide: false });
    K.trigger({
      id: 'archive_vent',
      x0: -25.5,
      z0: -6,
      x1: -18.5,
      z1: 5.5,
      onEnter: (g, w) => {
        g.audio.play('vent', { x: -22, y: 2.6, z: -2.5 });
        g.cam.shake(0.03, 0.3);
        g.after(0.6, () => w.spawnEnemy({ type: 'rastejante', id: 'p_vent_dog', x: -22, z: -2.5, state: 'emerge', y: 2.5 }));
      },
    });

    // ---------------------------------------------------------------- sala de descanso (segura)
    P.sofa(L, -15.6, -12.9, 0, 'fabricGreen');
    P.table(L, -15.6, -11.3, 0, 1.0, 0.6, 'woodDark', 0.45);
    P.locker(L, -9.0, -11.5, -Math.PI / 2, 3);
    L.box(-10.2, 0, -4.6, 1.6, 0.9, 0.55, 'woodDark');
    L.box(-10.6, 0.9, -4.6, 0.3, 0.35, 0.3, 'plasticDark', { collide: false });
    K.save(-17.2, -8.4, Math.PI / 2);
    K.storage(-13.2, -13.6, 0);
    K.light({ x: -13, y: 2.7, z: -9, color: 0xffb070, intensity: 7, distance: 9 });
    P.bulb(L, -13, 3.1, -9, true, 0xffb070);
    K.item('p_herb_rest', 'herb', -15.6, -11.3, { y: 0.47 });

    // ---------------------------------------------------------------- arsenal
    for (let i = 0; i < 3; i++) L.box(-7.6, 0, -11 + i * 2.6, 0.5, 2, 2.2, 'metalDark');
    L.box(-3.5, 0, -11.6, 4, 1.0, 0.7, 'metalPaint');
    K.item('p_shotgun', 'shotgun', -3.8, -11.5, {
      y: 1.02,
      onTake: (g) => {
        g.state.weapons.shotgun.mag = 4;
        g.hud.message('A espingarda já tem 4 cartuchos.');
        g.hint('aim');
      },
    });
    K.item('p_shells1', 'ammo_shotgun', -2.6, -11.6, { y: 1.02, qty: 6 });
    K.item('p_ammo_armory', 'ammo_pistol', -1.2, -11.6, { y: 1.02, qty: 15 });
    K.light({ x: -4, y: 2.8, z: -8, color: 0xe8f0ff, intensity: 4, distance: 7 });

    // ---------------------------------------------------------------- gabinete
    P.desk(L, 5, -11.5, Math.PI, { w: 2, mat: 'woodDark' });
    P.chair(L, 5, -12.6, 0);
    P.shelf(L, 9.4, -10, -Math.PI / 2, 3, 2.4);
    P.sofa(L, 1.4, -6.6, Math.PI / 2, 'fabricRed');
    L.box(0.6, 0, -13.2, 0.04, 2.2, 0.04, 'woodDark', { collide: false });
    L.box(0.95, 1.4, -13.2, 0.7, 0.8, 0.02, 'paintGreen', { collide: false });
    K.doc('d_memo_vertice', 'memo_vertice', 4.4, -11.3, { y: 0.79 });
    K.doc('d_diario_bastos', 'diario_bastos', 5.8, -11.7, { y: 0.79 });
    K.doc('d_ficha_vigia', 'ficha_vigia', 9.0, -6.2, { y: 0.02 });
    K.item('p_key_east', 'key_eastgate', 5.1, -11.9, {
      y: 0.79,
      onTake: (g) => {
        g.setFlag('got_eastgate');
        g.after(2, () => g.radio(RADIO.renata_call));
        g.after(5, () => g.audio.play('slam', { x: 20, y: 1, z: -10 }, 0.6));
      },
    });
    K.item('p_herb_chief', 'herb', 8.8, -13.2, { y: 0.02 });
    K.light({ x: 5, y: 1.4, z: -11.8, color: 0xa8ffb0, intensity: 2.5, distance: 6 });

    // ---------------------------------------------------------------- garagem (chefe)
    P.car(L, 15.5, -18.5, 0.35, { police: true, paint: 'paintWhite' });
    P.car(L, 24.5, -9.5, -1.2, { police: true, paint: 'paintWhite' });
    for (const [px, pz] of [
      [16, -9],
      [24, -19],
      [20, -14],
    ])
      L.box(px, 0, pz, 0.9, 5, 0.9, 'concrete');
    P.crate(L, 28.4, -22.4, 1);
    P.crate(L, 27.2, -22.6, 0.8);
    P.shelf(L, 11, -21, Math.PI / 2, 3, 2.2, { boxes: true });
    K.decal(19, -15, 3, 0);
    K.decal(22, -12, 1.6, 2);
    K.light({ x: 15, y: 4.6, z: -9, color: 0xffd8a0, intensity: 16, distance: 18, flicker: 0.04 });
    K.light({ x: 25, y: 4.6, z: -19, color: 0xffd8a0, intensity: 16, distance: 18, flicker: 0.3 });
    K.light({ x: 22, y: 4.4, z: -12, color: 0xff9a60, intensity: 10, distance: 16 });
    P.fluorescent(L, 15, 5, -9, 0, true);
    P.fluorescent(L, 25, 5, -19, 0, true);
    if (!g.flag('boss1_dead')) {
      K.barrel(13, -12.5);
      K.barrel(27.6, -6.5);
      K.barrel(19.4, -21.5);
      K.trigger({
        id: 'boss1',
        x0: 10.5,
        z0: -23.5,
        x1: 29.5,
        z1: -5.6,
        persist: false,
        onEnter: (g, w) => {
          const d = w.doors.find((x) => x.def.id === 'd_garage');
          d.setOpen(false, null);
          d.locked = true;
          g.audio.play('doorClose');
          const boss = w.spawnEnemy({ type: 'carcereiro', id: 'boss1', x: 23, z: -20, ry: -2.4 });
          boss.onDefeated = () => {
            d.locked = false;
            g.setMusic(null);
            g.after(2, () => {
              w.unlockDoor('d_garage_out');
              g.hud.message('O portão da garagem pode ser aberto agora. Ele dá de volta para a praça.');
            });
            const s = g.state.storage;
            if (!s.some((e) => e.id === 'ammo_shotgun' && e.joaquim)) s.push({ id: 'ammo_shotgun', qty: 5, joaquim: true });
          };
          g.setMusic('boss1');
          g.cinematicLook(boss, 2.2);
        },
      });
    } else {
      K.examine(23, -20, 'O corpo deformado do delegado Bastos. O escudo de osso se partiu ao meio. No uniforme rasgado, ainda dá para ler o distintivo: 0001.', { r: 2.5 });
      K.corpse(23, -20, -2.4, { look: { ...LOOK.cop, height: 2.3, bulk: 1.6 }, pose: 'deadFace', bloodSize: 3 });
    }
  },

  onEnter(g, w, spawn) {
    if (spawn === 'front' && !g.flag('police_first')) {
      g.setFlag('police_first');
      g.after(1.5, () => g.hud.message('O cheiro aqui dentro é de coisa morta há dias.'));
    }
  },
};
