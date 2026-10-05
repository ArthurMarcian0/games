import { COURT } from '../config/Constants.js';
import { clamp } from '../core/MathUtils.js';

// Posicionamentos para bola ao alto, reposições e lances livres.
const LANE_SLOTS = [
  [1.9, 1],
  [1.9, -1],
  [2.9, 1],
  [2.9, -1],
  [3.9, 1],
  [3.9, -1],
];

export function tipoffPositions(world) {
  const out = [];
  for (const team of [0, 1]) {
    const s = world.attackSign(team);
    const players = world.teams[team].players;
    const jumper = tallest(players);
    const others = players.filter((p) => p !== jumper);
    out.push({ p: jumper, x: -s * 0.55, z: 0, h: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
    const spots = [
      [-s * 3.0, 3.2],
      [-s * 3.0, -3.2],
      [-s * 6.0, 0],
      [-s * 1.0, 4.5],
    ];
    others.forEach((p, i) => {
      const [x, z] = spots[i % spots.length];
      out.push({ p, x, z, h: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
    });
  }
  return out;
}

export function tallest(players) {
  return players.reduce((a, b) => (b.height + b.attr('rebound') * 0.1 > a.height + a.attr('rebound') * 0.1 ? b : a), players[0]);
}

// Reposição: o time "team" recebe a bola no ponto "spot"
export function inboundPositions(world, team, spot, inbounder) {
  const s = world.attackSign(team);
  const out = [];
  const offense = world.teams[team].players;
  const defense = world.opponents(team);
  const zs = [-4.2, 4.2, 0.5, -1.8, 2.2];
  let i = 0;
  for (const p of offense) {
    if (p === inbounder) {
      out.push({ p, x: spot.x, z: spot.z, h: Math.atan2(s, 0) });
      continue;
    }
    const x = clamp(spot.x + s * (4.5 + i * 1.8), -COURT.halfL + 1.5, COURT.halfL - 1.6);
    const z = clamp(zs[i % zs.length] + spot.z * 0.2, -6.5, 6.5);
    out.push({ p, x, z, h: Math.atan2(s, 0) });
    i++;
  }
  // defensores entre cada atacante e a cesta defendida
  const defB = world.defendBasket(1 - team);
  const placed = new Map(out.map((o) => [o.p, o]));
  defense.forEach((d, k) => {
    const man = offense[k % offense.length];
    const m = placed.get(man);
    const dx = defB.x - m.x;
    const dz = defB.z - m.z;
    const len = Math.hypot(dx, dz) || 1;
    let gap = 1.6;
    let x = m.x + (dx / len) * gap;
    let z = m.z + (dz / len) * gap;
    if (len > 15) {
      // recua até a meia quadra
      x = defB.x - (dx / len) * 12.5;
      z = defB.z - (dz / len) * 12.5;
    }
    out.push({ p: d, x: clamp(x, -13.5, 13.5), z: clamp(z, -7, 7), h: Math.atan2(-s, 0) });
  });
  return out;
}

export function freeThrowPositions(world, shooter) {
  const team = shooter.team;
  const s = world.attackSign(team);
  const out = [];
  const lineX = s * (COURT.ftLineX - 0.15);
  out.push({ p: shooter, x: lineX, z: 0, h: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
  const defense = world.opponents(team);
  const offense = world.teams[team].players.filter((p) => p !== shooter);
  // defensores ocupam as posições mais próximas da cesta
  const lane = [];
  defense.forEach((p, i) => lane.push({ p, slot: i < 2 ? i : i + 2 }));
  offense.forEach((p, i) => lane.push({ p, slot: i < 2 ? i + 2 : i + 4 }));
  for (const { p, slot } of lane) {
    if (slot < LANE_SLOTS.length) {
      const [u, side] = LANE_SLOTS[slot];
      const x = s * (COURT.halfL - u - 0.3);
      out.push({ p, x, z: side * (COURT.keyHalfW + 0.45), h: side > 0 ? Math.PI : 0 });
    } else {
      const k = slot - LANE_SLOTS.length;
      out.push({ p, x: s * (COURT.halfL - 8.6), z: (k % 2 ? 1 : -1) * 4.5, h: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  return out;
}
