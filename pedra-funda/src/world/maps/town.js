// ÁREA 1 — Pedra Funda, rua principal (externa, chuva e névoa).
import * as THREE from 'three';
import { makeKit, LOOK, P, emissive } from './kit.js';
import { DIALOGS } from '../../game/Story.js';

function facade(L, x0, z0, x1, z1, h, mat, opts = {}) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  L.box(cx, 0, cz, x1 - x0, h, z1 - z0, mat);
  L.box(cx, h, cz, x1 - x0 + 0.3, 0.35, z1 - z0 + 0.3, 'concreteDark', { collide: false });
  const face = opts.face || 'e';
  const fx = face === 'e' ? x1 + 0.03 : x0 - 0.03;
  const floors = Math.max(1, Math.floor(h / 3.1));
  const len = z1 - z0;
  const n = Math.max(1, Math.floor(len / 3));
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < n; i++) {
      const wz = z0 + (len * (i + 0.5)) / n;
      if (f === 0 && opts.door && Math.abs(wz - opts.door) < 1.5) continue;
      const y = 1.0 + f * 3.1;
      const lit = opts.lit && opts.lit.includes(f * 10 + i);
      const mat2 = lit ? emissive(0xffb060, 0.55) : 'glassDark';
      L.box(fx, y, wz, 0.04, 1.4, 1.1, mat2, { collide: false, batch: !lit });
      L.box(fx + (face === 'e' ? 0.02 : -0.02), y - 0.08, wz, 0.08, 0.08, 1.3, 'concreteDark', { collide: false });
      if (opts.bars) for (let b = -0.4; b <= 0.4; b += 0.2) L.box(fx + (face === 'e' ? 0.04 : -0.04), y, wz + b, 0.03, 1.4, 0.03, 'metalDark', { collide: false });
    }
  }
  if (opts.door) {
    L.box(fx, 0, opts.door, 0.06, 2.3, 1.3, 'woodDark', { collide: false });
    L.box(fx + (face === 'e' ? 0.3 : -0.3), 0, opts.door, 0.6, 0.15, 1.8, 'concrete', { collide: false });
  }
  if (opts.sign) P.sign(L, fx + (face === 'e' ? 0.02 : -0.02), opts.signY || Math.min(h - 0.8, 3.2), cz, Math.min(len - 1, opts.signW || 6), 0.8, opts.sign, face === 'e' ? Math.PI / 2 : -Math.PI / 2, opts.signOpts || {});
}

export default {
  id: 'town',
  rain: true,
  mist: true,
  mistColor: 0x3c464e,
  mistOpacity: 0.35,
  fog: { color: 0x141a20, density: 0.04 },
  sky: 0x2c3846,
  ground: 0x0a0908,
  ambient: 0.34,
  ambience: 'outdoor',
  music: 'explore',
  surface: 'mud',
  bounds: { minX: -50, minZ: -90, maxX: 42, maxZ: 76 },
  mapDraw: [
    { x0: -8, x1: 8, z0: -60, z1: 72, kind: 'road' },
    { x0: -14, x1: 14, z0: -60, z1: -40, kind: 'road', label: 'Praça' },
    { x0: -26, x1: -8, z0: -10, z1: 17, kind: 'road' },
    { x0: 8, x1: 30, z0: -24, z1: -18, kind: 'road', label: 'Beco' },
    { x0: -40, x1: -8, z0: -38, z1: -32, kind: 'road' },
    { x0: -20, x1: -8, z0: 54, z1: 68, kind: 'building' },
    { x0: -22, x1: -8, z0: 18, z1: 32, kind: 'building', label: 'Farmácia' },
    { x0: -26, x1: -18, z0: -10, z1: 6, kind: 'building', label: 'Posto' },
    { x0: -22, x1: -8, z0: -30, z1: -12, kind: 'building', label: 'Mercado' },
    { x0: -30, x1: -14, z0: -58, z1: -40, kind: 'building', label: 'Prefeitura' },
    { x0: 8, x1: 22, z0: 48, z1: 66, kind: 'building' },
    { x0: 8, x1: 20, z0: 34, z1: 46, kind: 'building' },
    { x0: 8, x1: 24, z0: -14, z1: 8, kind: 'building', label: 'Hotel' },
    { x0: 8, x1: 22, z0: -40, z1: -26, kind: 'building', label: 'Escola' },
    { x0: 14, x1: 28, z0: -58, z1: -42, kind: 'building', label: 'Garagem' },
    { x0: -14, x1: 14, z0: -80, z1: -66, kind: 'building', label: 'Delegacia' },
    { x0: -6, x1: 6, z0: 68, z1: 72, kind: 'trees', label: 'Barreira' },
    { x0: -48, x1: -41, z0: -46, z1: -22, kind: 'trees', label: 'Mata' },
  ],
  surfaces: [
    { x0: -8, x1: 8, z0: -62, z1: 74, surface: 'wet' },
    { x0: -14, x1: 14, z0: -66, z1: -40, surface: 'wet' },
    { x0: -26, x1: -8, z0: -10, z1: 17, surface: 'wet' },
    { x0: 8, x1: 30, z0: -24, z1: -18, surface: 'wet' },
    { x0: -40, x1: -8, z0: -38, z1: -32, surface: 'wet' },
  ],

  build(L, g, w) {
    const K = makeKit(L, g, w);
    const boss1 = g.flag('boss1_dead');
    L.spawn('default', 0.8, 53.5, Math.PI);
    L.spawn('fromPolice', 0, -63.6, 0);
    L.spawn('fromPoliceGarage', 12.2, -50, -Math.PI / 2);
    L.spawn('fromHospital', 28.2, -21, -Math.PI / 2);
    L.spawn('fromForest', -38.2, -35, Math.PI / 2);

    // ---------------------------------------------------------------- chão
    L.floor(-50, -90, 42, 76, 'grass');
    L.floor(-5, -62, 5, 74, 'asphalt', 0.005);
    L.floor(-8, -40, -5, 74, 'sidewalk', 0.01);
    L.floor(5, -40, 8, 74, 'sidewalk', 0.01);
    L.floor(-14, -60, 14, -40, 'sidewalk', 0.012);
    L.floor(-14, -66, 14, -60, 'concrete', 0.013);
    L.floor(-26, -10, -8, 17, 'concrete', 0.012);
    L.floor(8, -24, 30, -18, 'asphalt', 0.006);
    L.floor(-40, -38, -8, -32, 'asphalt', 0.006);
    for (const sx of [-5, 5]) L.box(sx, 0, 17, 0.15, 0.1, 114, 'concrete', { collide: false });
    for (let z = -58; z < 72; z += 4) L.box(0, 0.006, z, 0.12, 0.01, 2, 'paintYellow', { collide: false, worldUV: false });
    // limites
    L.wall(-50, 72, 42, 76);
    L.wall(-50, -90, 42, -86);
    L.wall(-50, -90, -46, 76);
    L.wall(38, -90, 42, 76);

    // ---------------------------------------------------------------- barreira sul
    for (let i = -2; i <= 2; i++) P.jersey(L, i * 2.05, 70, 0.05 * i);
    P.fence(L, -8, 71.2, 8, 71.2, 2.4, { barbed: true });
    L.wall(-8.5, 70, 8.5, 72);
    P.fence(L, 8.5, 66, 8.5, 72, 2.4);
    P.fence(L, -8.5, 68, -8.5, 72, 2.4);
    P.sign(L, -3.2, 1.6, 69.6, 2.6, 0.9, 'BARREIRA SANITÁRIA\nPROIBIDA A SAÍDA', Math.PI, { bg: '#c8b030', fg: '#1a1408', font: 'Arial' });
    L.box(-3.2, 0, 69.75, 0.08, 1.2, 0.08, 'metalDark', { collide: false });
    for (const [cx, cz] of [
      [-4, 66],
      [-1.5, 67.5],
      [3.5, 66.5],
    ])
      P.cone(L, cx, cz);
    K.doc('d_barreira', 'aviso_barreira', 1.2, 69.3, { model: 'wall', y: 0.9, ry: Math.PI, w: 0.4, h: 0.5 });
    K.examine(-1, 68.5, 'Do outro lado da barreira, só a estrada vazia e trinta quilômetros de chuva. Não vou embora sem a minha equipe.', { r: 2.2 });
    // viatura abandonada
    P.car(L, -3.2, 63.5, 0.35, { police: true, paint: 'paintWhite', doorOpen: true, sirenOn: true });
    K.item('t_ammo_car', 'ammo_pistol', -1.7, 62.6, { qty: 10 });
    // carro do jogador com faróis acesos
    P.car(L, 2.3, 57.5, Math.PI, { paint: 'paintBlue', lightsOn: true });
    K.light({ type: 'spot', x: 2.3, y: 0.7, z: 55.2, tx: 2.0, ty: 0, tz: 32, color: 0xfff0d0, intensity: 70, distance: 34, angle: 0.42, penumbra: 0.45, decay: 1.2 });
    K.examine(4.0, 57.5, 'Meu carro. O motor morreu de vez. Os faróis ainda funcionam — por enquanto.', { r: 2.4 });
    K.item('t_pipe', 'pipe', 3.6, 61.4, { y: 0.02 });

    // ---------------------------------------------------------------- lado oeste
    facade(L, -20, 54, -8, 68, 6, 'plaster', { face: 'e', door: 61 });
    P.fence(L, -8.5, 50, -8.5, 54, 2);
    // Bar do Joaquim (área segura)
    L.room({
      id: 'diner',
      name: 'Bar do Joaquim',
      x0: -22,
      x1: -8,
      z0: 34,
      z1: 50,
      h: 3.4,
      floor: 'tilefloor',
      wall: 'wallpaperRed',
      wainscot: { mat: 'woodDark', h: 1.1 },
      ceil: 'ceiling',
      outer: 'brick',
      roof: 'roof',
      trim: 'woodDark',
      safe: true,
      windows: [
        { side: 'e', a: 36, b: 40, y0: 1.0, y1: 2.3, glass: true },
        { side: 'e', a: 46, b: 49, y0: 1.0, y1: 2.3, glass: true },
      ],
    });
    L.box(-15, 3.55, 42, 14.2, 2.6, 16.2, 'brick', { collide: false });
    L.door({ id: 'd_diner', x: -8, z: 43, axis: 'z', w: 1.4, kind: 'glass' });
    P.sign(L, -7.8, 2.95, 43, 3.4, 0.7, 'BAR DO JOAQUIM', Math.PI / 2, { emissive: 1.4, bg: '#1a0705', fg: '#ff8a3a', borderColor: '#ff6a2a' });
    P.counter(L, -16.6, 43.5, 0.9, 7.5);
    P.shelf(L, -21.5, 44, Math.PI / 2, 3, 2.2, { boxes: false });
    P.table(L, -10.2, 37.8, 0, 1.2, 0.8, 'wood');
    P.table(L, -10.2, 47.4, 0, 1.2, 0.8, 'wood');
    P.table(L, -13.2, 42.4, 0, 1.0, 1.0, 'wood');
    P.chair(L, -13.2, 41.5, 0);
    P.chair(L, -13.2, 43.3, Math.PI);
    P.sofa(L, -11.6, 37.8, Math.PI / 2, 'fabricRed');
    P.sofa(L, -11.6, 47.4, Math.PI / 2, 'fabricRed');
    P.tv(L, -21.6, 2.4, 38, Math.PI / 2, true);
    K.light({ x: -14, y: 3.0, z: 42, color: 0xffb070, intensity: 9, distance: 10, decay: 1.6 });
    K.save(-20.4, 36.6, Math.PI / 2);
    K.storage(-21.6, 40, Math.PI / 2);
    K.item('t_herb_planter', 'herb', -7.0, 39.2, { y: 0.47 });
    P.planter(L, -7.0, 39.2);
    K.item('t_bandage', 'bandage', -10.2, 47.4, { y: 0.78 });
    K.doc('d_jornal', 'recorte_jornal', -13.0, 42.6, { y: 0.78 });
    K.doc('d_caderno', 'caderno_joaquim', -16.6, 42.2, { y: 1.06 });
    if (!boss1) {
      K.npc({
        id: 'joaquim',
        x: -18.3,
        z: 44.6,
        ry: Math.PI / 2,
        look: LOOK.joaquim,
        pose: 'sit',
        talk: (g) => {
          if (!g.flag('met_joaquim')) {
            g.ui.dialog(DIALOGS.joaquim_first, () => {
              g.setFlag('met_joaquim');
              if (g.inv.canAdd('herb')) g.inv.add('herb', 1);
              else g.state.storage.push({ id: 'herb', qty: 1 });
              g.audio.play('pickup');
              g.hud.message('Joaquim te deu uma Erva medicinal.');
              g.hint('save');
            });
          } else if (!g.inv.has('bolt_cutter') && !g.flag('door_town_g_police')) g.ui.dialog(DIALOGS.joaquim_hint_cutter);
          else if (!g.flag('door_town_g_police')) g.ui.dialog(DIALOGS.joaquim_hint_police);
          else g.ui.dialog(DIALOGS.joaquim_hint_generic);
        },
      });
      L.box(-18.3, 0, 44.6, 0.45, 0.48, 0.45, 'woodDark', { collide: false });
    } else {
      K.doc('d_bilhete_joaquim', 'bilhete_joaquim', -16.6, 45.2, { y: 1.06 });
      K.examine(-18.3, 44.6, 'O banquinho do Joaquim está vazio. A espingarda dele também sumiu.', { r: 1.6 });
    }
    P.fence(L, -8.5, 32, -8.5, 34, 2);
    facade(L, -22, 18, -8, 32, 7, 'brick', { face: 'e', door: 25, sign: 'FARMÁCIA POPULAR', signOpts: { bg: '#e8e8e0', fg: '#1a6a3a' } });
    P.fence(L, -26, 17, -8, 17, 2.2);

    // posto + oficina
    facade(L, -26, -10, -18, 6, 4, 'plasterDark', { face: 'e', door: -2, sign: 'LOJA DE CONVENIÊNCIA', signW: 5, signY: 3.1 });
    L.room({
      id: 'oficina',
      name: 'Oficina do posto',
      x0: -26,
      x1: -18,
      z0: 6,
      z1: 16,
      h: 3.6,
      floor: 'concrete',
      wall: 'concreteDark',
      ceil: 'metalDark',
      outer: 'plasterDark',
      roof: 'roof',
      windows: [{ side: 'w', a: 9.2, b: 11, y0: 1.3, y1: 2.1, glass: false }],
    });
    for (let i = 0; i < 3; i++) L.box(-25.95, 1.4 + i * 0.25, 10.1, 0.05, 0.16, 2.0, 'oldwood', { collide: false, rx: (i - 1) * 0.08 });
    L.door({
      id: 'd_oficina',
      x: -18,
      z: 11,
      axis: 'z',
      w: 1.3,
      kind: 'metal',
      lock: { code: '1987', codeTitle: 'Cadeado de segredo — 4 dígitos', msg: 'Um cadeado de segredo de quatro dígitos.', okMsg: 'O cadeado abriu com um estalo.' },
    });
    K.doc('d_bilhete_lu', 'bilhete_lu', -17.75, 12.2, { model: 'wall', y: 1.5, ry: Math.PI / 2, w: 0.22, h: 0.3 });
    P.car(L, -21.6, 9.6, 0.1, { paint: 'paintRed' });
    P.table(L, -25.2, 12.6, Math.PI / 2, 2.4, 0.8, 'oldwood', 0.9);
    P.shelf(L, -25.4, 14.9, Math.PI / 2, 1.6, 2, { boxes: true });
    P.barrel(L, -19, 15, 'rust');
    for (let i = 0; i < 3; i++) L.cyl(-24.5 + i * 0.1, 0.12 * i * 2, 7.2, 0.35, 0.22, 'rubber', { collide: i === 0, center: false });
    K.light({ x: -22, y: 3.3, z: 11.5, color: 0xffd090, intensity: 5, distance: 8, flicker: 0.12 });
    P.bulb(L, -22, 3.6, 11.5, true);
    K.item('t_cutter', 'bolt_cutter', -25.2, 12.3, {
      y: 0.92,
      onTake: (g) => {
        // um rastejante arrebenta a janela
        g.audio.play('glassDistant', { x: -25.8, y: 1.6, z: 10 }, 2.5);
        g.audio.play('screech', { x: -25.8, y: 1.6, z: 10 });
        g.cam.shake(0.04, 0.3);
        w.spawnEnemy({ type: 'rastejante', id: 't_garage_dog', x: -25.0, z: 10.1, state: 'emerge', y: 1.6 });
      },
    });
    K.item('t_ammo_oficina', 'ammo_pistol', -19.2, 7.2, { qty: 5 });
    // cobertura das bombas
    for (const [px, pz] of [
      [-16, -4],
      [-10, -4],
      [-16, 4],
      [-10, 4],
    ])
      L.cyl(px, 0, pz, 0.2, 4.5, 'paintWhite', { seg: 10 });
    L.box(-13, 4.5, 0, 9, 0.45, 11, 'metalPaint', { collide: false });
    P.sign(L, -8.47, 4.72, 0, 8.5, 0.42, 'POSTO FUNDA   ·   DESDE 1987', Math.PI / 2, { bg: '#b8241a', fg: '#f0e8d0', size: 46, w: 1024, h: 64 });
    P.gasPump(L, -13, -1.8, Math.PI / 2);
    P.gasPump(L, -13, 1.8, Math.PI / 2);
    K.light({ x: -13, y: 4.2, z: 0, color: 0xd8f0ff, intensity: 9, distance: 11, flicker: 0.25 });
    P.fluorescent(L, -13, 4.5, 0, Math.PI / 2, true);
    K.examine(-9.4, 0, 'O letreiro do posto, desbotado: "POSTO FUNDA · DESDE 1987".', { r: 2.2, prompt: 'Olhar o letreiro' });
    K.item('t_powder', 'gunpowder', -15.5, 4.9, { y: 0.02 });
    P.dumpster(L, -24.4, -8.4, 0);
    P.trashBags(L, -21.5, -8.6, 3);
    P.fence(L, -26, -11, -8, -11, 2.2);
    L.wall(-27, -12, -26, 17);
    K.footprints(-8.6, 43, -16.5, 13, 16);

    facade(L, -22, -30, -8, -12, 8, 'brickDark', { face: 'e', door: -20, sign: 'MERCADO SÃO JORGE', bars: true });
    // estrada oeste até o portão da mata
    P.fence(L, -40, -31.5, -8, -31.5, 2.2);
    P.fence(L, -40, -38.5, -8, -38.5, 2.2);
    L.box(-40.2, 0, -37.6, 0.6, 3, 0.6, 'brickDark');
    L.box(-40.2, 0, -32.4, 0.6, 3, 0.6, 'brickDark');
    L.door({ id: 'g_forest', x: -40, z: -35, axis: 'z', w: 4.4, h: 2.6, kind: 'gate', lock: { flag: 'forest_gate_open', msg: 'O portão para a mata está trancado com um cadeado — pelo outro lado.' }, to: { map: 'forest', spawn: 'fromTown' } });
    for (let i = 0; i < 12; i++) P.pineTree(L, -43 - (i % 3) * 2.5, -44 + i * 2.2, 1.1 + (i % 4) * 0.15);
    const l7 = P.lampPost(L, -30, -38.3, 0, { on: true });
    K.light({ type: 'spot', x: l7.x, y: l7.y, z: l7.z, tx: l7.x, ty: 0, tz: l7.z, intensity: 40, distance: 12, angle: 0.75, penumbra: 0.6, decay: 1.4, flicker: 0.25, cone: { h: 5, r: 2.6, o: 0.05 } });

    // praça e prefeitura
    facade(L, -30, -58, -14, -40, 9, 'plaster', { face: 'e', door: -49, sign: 'PREFEITURA MUNICIPAL', signW: 8 });
    P.fence(L, -14.5, -60, -14.5, -58, 2.2);
    P.fence(L, -14.5, -40, -14.5, -38.5, 2.2);
    P.deadTree(L, -9, -52, 1.3);
    L.cyl(9, 0, -52, 1.6, 0.6, 'concrete', { seg: 18 });
    L.cyl(9, 0.6, -52, 0.25, 1.2, 'concrete', { seg: 10, collide: false });
    P.bench(L, -10, -46, Math.PI / 2);
    P.bench(L, 10.5, -45, -Math.PI / 2);
    L.box(-11.5, 0, -43.5, 0.1, 2.2, 0.1, 'metalDark', { collide: false });
    L.box(-11.5, 0, -45.5, 0.1, 2.2, 0.1, 'metalDark', { collide: false });
    L.box(-11.5, 1.0, -44.5, 0.06, 1.2, 2.1, 'oldwood');
    P.poster(
      L,
      -11.44,
      1.6,
      -44.5,
      0.9,
      1.1,
      (ctx, W, H) => {
        ctx.fillStyle = '#e8e4d4';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#1a4a7a';
        ctx.fillRect(0, 0, W, H * 0.22);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PEDRA FUNDA', W / 2, 32);
        ctx.fillText('PROTEGIDA', W / 2, 60);
        ctx.fillStyle = '#1a4a7a';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('VACINAÇÃO', W / 2, H * 0.4);
        ctx.fillText('OBRIGATÓRIA', W / 2, H * 0.4 + 26);
        ctx.font = '14px Arial';
        ctx.fillText('Hospital São Lázaro', W / 2, H * 0.62);
        ctx.fillStyle = '#7a2a1a';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('VÉRTICE', W / 2, H * 0.85);
        ctx.fillStyle = 'rgba(80,0,0,0.6)';
        ctx.fillRect(W * 0.6, H * 0.45, 40, 90);
      },
      Math.PI / 2,
    );
    K.doc('d_cartaz', 'cartaz_vacina', -11.0, -44.5, { model: 'none', y: 1.5, glint: true });
    K.item('t_herb_plaza', 'herb', 8.5, -44.2, { y: 0.02 });
    // delegacia
    P.fence(L, -14, -60, -1.5, -60, 2.4, { barbed: true });
    P.fence(L, 1.5, -60, 14, -60, 2.4, { barbed: true });
    L.door({
      id: 'g_police',
      x: 0,
      z: -60,
      axis: 'x',
      w: 3,
      h: 2.4,
      kind: 'gate',
      chain: true,
      lock: { item: 'bolt_cutter', consume: true, msg: 'O portão da delegacia está fechado com uma corrente grossa. Preciso de algo para cortá-la.' },
    });
    L.box(0, 0, -73, 28, 8, 14, 'brickDark');
    L.box(0, 8, -73, 28.4, 0.4, 14.4, 'concreteDark', { collide: false });
    for (const x of [-11, -7, -4, 4, 7, 11]) {
      L.box(x, 1.2, -65.97, 1.2, 1.4, 0.05, 'glassDark', { collide: false });
      for (let b = -0.45; b <= 0.45; b += 0.15) L.box(x + b, 1.2, -65.92, 0.03, 1.4, 0.03, 'metalDark', { collide: false });
      L.box(x, 4.2, -65.97, 1.2, 1.4, 0.05, 'glassDark', { collide: false });
    }
    P.sign(L, 0, 3.3, -65.94, 6, 0.8, 'DELEGACIA DE POLÍCIA', 0, { bg: '#1a2238', fg: '#e8e0c8' });
    L.door({ id: 'd_police', x: 0, z: -66, axis: 'x', w: 2.0, kind: 'double', to: { map: 'police', spawn: 'front' } });
    L.box(0, 0, -65.2, 4, 0.15, 1.6, 'concrete', { collide: false });
    K.light({ x: 0, y: 3.0, z: -64.8, color: 0xffd8a0, intensity: 6, distance: 9, flicker: 0.08 });
    P.bulb(L, 0, 3.3, -65.4, true);
    // garagem da delegacia (atalho)
    L.box(21, 0, -50, 14, 5, 16, 'concreteDark');
    L.door({ id: 'd_garage_town', x: 14, z: -50, axis: 'z', w: 4, h: 3.2, kind: 'roll', lock: { flag: 'boss1_dead', msg: 'A porta da garagem da delegacia, trancada por dentro. Do outro lado, algo pesado se arrasta.' }, to: { map: 'police', spawn: 'garage' } });
    P.fence(L, 14.5, -60, 14.5, -58, 2.2);
    P.fence(L, 14.5, -42, 14.5, -40, 2.2);

    // ---------------------------------------------------------------- lado leste
    facade(L, 8, 48, 22, 66, 6, 'plasterGreen', { face: 'w', door: 57 });
    // janela com TV ligada: sinais de alguém ainda por perto
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x7a9ac8, emissiveIntensity: 0.6 });
    L.box(7.96, 1.0, 51.5, 0.04, 1.4, 1.1, tvMat, { collide: false, batch: false });
    K.onUpdate((dt) => {
      tvMat.emissiveIntensity = 0.25 + Math.random() * 0.6;
    });
    K.examine(7.4, 57, 'Ninguém responde. Mas a TV lá dentro está ligada, sem som. Pegadas de lama recentes vão da porta até a rua.', { r: 1.8, prompt: 'Bater na porta' });
    K.footprints(7.6, 57, 1, 50, 12);
    P.fence(L, 8.5, 46, 8.5, 48, 2);
    facade(L, 8, 34, 20, 46, 5.5, 'brick', { face: 'w', door: 40 });
    P.fence(L, 8.5, 30, 8.5, 34, 2);
    // Casa 14
    const c14 = { outer: 'plaster', roof: 'roof', h: 3, ceil: 'ceiling', trim: 'woodDark' };
    L.room({ ...c14, id: 'c14sala', name: 'Casa 14 — Sala', x0: 8, x1: 16, z0: 14, z1: 24, floor: 'woodfloor', wall: 'wallpaper', windows: [{ side: 'w', a: 15.5, b: 17.5, glass: true }] });
    L.room({ ...c14, id: 'c14coz', name: 'Casa 14 — Cozinha', x0: 16, x1: 22, z0: 14, z1: 22, floor: 'tilefloor', wall: 'tilewall' });
    L.room({ ...c14, id: 'c14ban', name: 'Casa 14 — Banheiro', x0: 16, x1: 22, z0: 22, z1: 30, floor: 'tilefloor', wall: 'tilewall' });
    L.room({ ...c14, id: 'c14qua', name: 'Casa 14 — Quarto', x0: 8, x1: 16, z0: 24, z1: 30, floor: 'woodfloor', wall: 'wallpaperRed' });
    L.box(15, 3.15, 22, 14.4, 1.6, 16.4, 'roof', { collide: false, rx: 0 });
    L.door({ id: 'd_c14', x: 8, z: 20.5, axis: 'z', w: 1.2, kind: 'wood' });
    L.door({ id: 'd_c14_coz', x: 16, z: 18, axis: 'z', w: 1.1, kind: 'wood' });
    L.door({ id: 'd_c14_ban', x: 19, z: 22, axis: 'x', w: 1.0, kind: 'wood' });
    L.door({ id: 'd_c14_qban', x: 16, z: 27, axis: 'z', w: 1.0, kind: 'wood' });
    L.door({ id: 'd_c14_qua', x: 12, z: 24, axis: 'x', w: 1.1, kind: 'wood', lock: { msg: 'Trancada por dentro. Alguém escreveu na porta com batom: "NÃO ABRA".' } });
    P.sign(L, 7.88, 2.3, 21.6, 0.4, 0.3, '14', -Math.PI / 2, { bg: '#2a2a2a', fg: '#e0d8c0' });
    L.box(7.4, 0, 20.5, 0.8, 0.12, 2, 'concrete', { collide: false });
    P.sofa(L, 13.2, 22.8, Math.PI, 'fabricGreen');
    P.table(L, 12.8, 20.6, 0, 1.0, 0.6, 'woodDark', 0.45);
    P.tv(L, 12.8, 0, 15.0, 0, false);
    L.box(12.8, 0, 14.9, 1.2, 0.5, 0.5, 'woodDark');
    P.shelf(L, 15.6, 16.4, -Math.PI / 2, 1.4, 1.8);
    K.light({ x: 11, y: 2.2, z: 19, color: 0xffb070, intensity: 3.5, distance: 7, flicker: 0.3 });
    K.item('t_c14_ammo', 'ammo_pistol', 12.8, 20.6, { y: 0.47, qty: 6 });
    P.fridge(L, 21.4, 14.8, Math.PI);
    P.stove(L, 19.8, 14.6, Math.PI);
    P.counter(L, 21.55, 18.6, 0.75, 3.2);
    P.table(L, 18, 19.5, 0, 1.2, 0.8, 'wood');
    K.item('t_c14_herb', 'herb', 21.5, 18.2, { y: 1.06 });
    K.enemy({ id: 't_ze', type: 'errante', x: 20.6, z: 16.3, ry: Math.PI, state: 'idle', look: { shirt: 0x8a7a5a, pants: 0x30343c, hair: 0x3a3a38 } });
    K.decal(19.5, 17.5, 1.1, 2);
    P.sink(L, 21.6, 25.5, -Math.PI / 2);
    P.toilet(L, 21.6, 28.5, -Math.PI / 2);
    L.box(17.6, 0, 28.8, 2.4, 0.55, 1.0, 'paintWhite');
    K.item('t_c14_chem', 'chem', 21.5, 25.5, { y: 0.86 });
    P.bed(L, 10.2, 27.2, Math.PI / 2, { sheetMat: 'fabricRed' });
    K.corpse(10.4, 27.2, Math.PI / 2, { look: LOOK.woman, pose: 'bed', blood: false });
    L.box(9, 0, 29.4, 0.5, 0.6, 0.45, 'woodDark');
    K.doc('d_diario_ana', 'diario_ana', 9.0, 29.4, { y: 0.62 });
    L.box(14.8, 0, 29.5, 1.8, 2.0, 0.55, 'woodDark');
    K.item('t_c14_bandage', 'bandage', 13.6, 29.4, { y: 0.02 });
    P.fence(L, 8.5, 8, 8.5, 14, 2);
    facade(L, 8, -14, 24, 8, 10, 'brick', { face: 'w', door: -3, sign: 'HOTEL PEDRA FUNDA', signW: 8, lit: [21] });
    P.fence(L, 8.5, -17.5, 8.5, -14, 2);
    // beco leste até o portão do hospital
    P.fence(L, 8, -17.5, 30, -17.5, 2.6);
    P.fence(L, 8, -24.5, 30, -24.5, 2.6);
    P.dumpster(L, 16, -23.2, 0);
    P.trashBags(L, 19, -23.4, 4);
    P.planter(L, 12, -18.8);
    K.item('t_herb_alley', 'herb', 12, -18.8, { y: 0.47 });
    L.box(30.2, 0, -24.2, 0.6, 3, 0.6, 'brickDark');
    L.box(30.2, 0, -17.8, 0.6, 3, 0.6, 'brickDark');
    L.door({ id: 'g_hospital', x: 30, z: -21, axis: 'z', w: 5.6, h: 2.8, kind: 'gate', lock: { item: 'key_eastgate', consume: true, msg: 'Portão de ferro trancado. Placa: "ACESSO AO HOSPITAL SÃO LÁZARO".' }, to: { map: 'hospital', spawn: 'fromTown' } });
    P.sign(L, 29.6, 3.1, -21, 3, 0.5, 'HOSPITAL SÃO LÁZARO →', -Math.PI / 2, { bg: '#e8e8e0', fg: '#1a3a6a' });
    facade(L, 8, -40, 22, -26, 7, 'plasterBlue', { face: 'w', door: -33, sign: 'ESCOLA MUNICIPAL', bars: true });
    P.fence(L, 8.5, -26, 8.5, -24.5, 2);
    L.wall(22, -40, 24, -26);

    // ---------------------------------------------------------------- postes
    const lamp = (x, z, ry, flicker, on = true) => {
      const p = P.lampPost(L, x, z, ry, { on });
      if (on) K.light({ type: 'spot', x: p.x, y: p.y, z: p.z, tx: p.x, ty: 0, tz: p.z, intensity: 42, distance: 13, angle: 0.75, penumbra: 0.6, decay: 1.4, flicker, cone: { h: 5, r: 2.6, o: 0.05 } });
    };
    lamp(6.6, 44, -Math.PI / 2, 0.04);
    lamp(-6.6, 24, Math.PI / 2, 0.45);
    lamp(6.6, 2, -Math.PI / 2, 0.06);
    lamp(-6.6, -22, Math.PI / 2, 0, false);
    lamp(6.6, -36, -Math.PI / 2, 0.15);
    lamp(-6.6, -54, Math.PI / 2, 0.05);

    // ---------------------------------------------------------------- criaturas
    K.corpse(-1.4, 31.4, 0.4, { look: LOOK.worker, pose: 'dead', bloodSize: 2.2 });
    K.enemy({ id: 't_eater', type: 'errante', x: -1.5, z: 30.3, ry: 0.2, state: 'eat' });
    K.enemy({ id: 't_gas', type: 'errante', x: -12, z: -6, state: 'idle', wander: true });
    K.enemy({ id: 't_fake', type: 'errante', x: 6.4, z: -19.5, ry: 2, state: 'fakedead' });
    K.enemy({ id: 't_alley', type: 'errante', x: 22, z: -21, ry: -1.5, state: 'idle' });
    K.enemy({ id: 't_plaza', type: 'errante', x: -5, z: -49, state: 'idle', wander: true });
    K.enemy({ id: 't2_a', type: 'errante', x: 2, z: -12, state: 'idle', wander: true, cond: (g) => g.flag('boss1_dead') });
    K.enemy({ id: 't2_b', type: 'rastejante', x: 3, z: 18, state: 'idle', cond: (g) => g.flag('boss1_dead') });
    K.enemy({ id: 't2_c', type: 'errante', x: 3, z: -30, state: 'idle', wander: true, cond: (g) => g.flag('boss1_dead') });
    K.enemy({ id: 't2_d', type: 'rastejante', x: 18, z: -20.5, state: 'idle', cond: (g) => g.flag('boss1_dead') });

    // ---------------------------------------------------------------- eventos
    K.trigger({
      id: 'gas_howl',
      x0: -8,
      z0: -2,
      x1: 8,
      z1: 8,
      onEnter: (g) => {
        g.audio.play('dogHowl', { x: -30, y: 2, z: -20 }, 1.4);
      },
    });
    K.trigger({
      id: 'glimpse',
      x0: -8,
      z0: -42,
      x1: 8,
      z1: -30,
      cond: (g) => !g.flag('boss1_dead'),
      onEnter: (g, w) => {
        const v = w.spawnEnemy({ type: 'vigia', id: 'glimpse', x: -31, z: -34.8, ry: Math.PI / 2, state: 'walk', persist: false });
        if (!v) return;
        v.walkTo = { x: -39, z: -34.8 };
        v.walkSpeed = 1.2;
        v.yaw = -Math.PI / 2;
        g.audio.play('stinger', null, 0.5);
        setTimeout(() => {
          if (w.enemies.includes(v)) w.removeEnemy(v);
        }, 6000);
      },
    });
  },

  onEnter(g, w, spawn) {
    if (spawn === 'fromPoliceGarage' && !g.flag('town_return_msg')) {
      g.setFlag('town_return_msg');
      setTimeout(() => g.hud.message('A garagem dá na praça. O portão leste fica no beco à direita.'), 1500);
    }
  },
};
