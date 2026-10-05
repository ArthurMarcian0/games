import * as THREE from 'three';
import { COURT } from '../config/Constants.js';
import { distXZ, clamp, rand } from '../core/MathUtils.js';

// Coordenação coletiva da IA: marcação individual, espaçamento ofensivo
// e quem disputa as bolas soltas.
// Pontos ofensivos em coordenadas (u = distância da linha de fundo atacada, z)
const SPOTS = {
  cornerL: [1.3, -6.75],
  cornerR: [1.3, 6.75],
  wingL: [5.6, -5.7],
  wingR: [5.6, 5.7],
  top: [9.0, 0],
  slotL: [8.2, -3.6],
  slotR: [8.2, 3.6],
  postL: [2.6, -2.3],
  postR: [2.6, 2.3],
  elbowL: [5.8, -2.4],
  elbowR: [5.8, 2.4],
};

const PREFS = {
  guard: ['top', 'slotL', 'slotR', 'wingL', 'wingR'],
  wing: ['wingL', 'wingR', 'cornerL', 'cornerR', 'slotL', 'slotR'],
  big: ['postL', 'postR', 'elbowL', 'elbowR'],
};

export class TeamAI {
  constructor(world, team) {
    this.world = world;
    this.team = team;
    this.assign = new Map(); // defensor -> atacante
    this.spots = new Map(); // jogador -> nome do ponto
    this.chasers = new Set();
    this.lastPossession = null;
    this.timer = 0;
    this.spotTimer = 0;
    this.assignTimer = 0;
    this.landing = new THREE.Vector3();
  }

  get players() {
    return this.world.teams[this.team].players;
  }

  get sign() {
    return this.world.attackSign(this.team);
  }

  isOffense() {
    const r = this.world.rules;
    return r ? r.possession === this.team : true;
  }

  spotWorld(name, out = new THREE.Vector3()) {
    const [u, z] = SPOTS[name];
    out.set(this.sign * (COURT.halfL - u), 0, z);
    return out;
  }

  update(dt) {
    this.timer -= dt;
    this.spotTimer -= dt;
    this.assignTimer -= dt;
    const rules = this.world.rules;
    const poss = rules ? rules.possession : 0;
    if (poss !== this.lastPossession) {
      this.lastPossession = poss;
      this.assignDefense();
      this.assignSpots();
    }
    if (this.assignTimer <= 0) this.assignDefense(true);
    if (this.spotTimer <= 0) this.assignSpots();
    if (this.timer <= 0) {
      this.timer = 0.2;
      this.updateChasers();
    }
  }

  // Marcação individual: pares mais próximos (com "troca" ocasional)
  assignDefense(soft = false) {
    this.assignTimer = 4 + Math.random() * 2;
    const mine = this.players;
    const theirs = this.world.opponents(this.team);
    if (!theirs.length) {
      this.assign.clear();
      return;
    }
    if (soft && this.assign.size === mine.length) {
      // só refaz se algum marcador estiver muito longe do seu homem
      let worst = 0;
      for (const [d, o] of this.assign) worst = Math.max(worst, distXZ(d.pos, o.pos));
      if (worst < 7) return;
    }
    const pairs = [];
    for (const d of mine) for (const o of theirs) pairs.push({ d, o, dist: distXZ(d.pos, o.pos) + (d.index === o.index ? -2.5 : 0) });
    pairs.sort((a, b) => a.dist - b.dist);
    const usedD = new Set();
    const usedO = new Set();
    this.assign.clear();
    for (const p of pairs) {
      if (usedD.has(p.d) || usedO.has(p.o)) continue;
      this.assign.set(p.d, p.o);
      usedD.add(p.d);
      usedO.add(p.o);
    }
    // sobra (times desiguais): marca o portador
    for (const d of mine) if (!this.assign.has(d)) this.assign.set(d, theirs[0]);
  }

  assignSpots() {
    this.spotTimer = 5 + Math.random() * 3;
    this.spots.clear();
    const taken = new Set();
    const order = [...this.players].sort((a, b) => (a.archetype === 'big' ? -1 : 0) - (b.archetype === 'big' ? -1 : 0));
    for (const p of order) {
      const prefs = PREFS[p.archetype] || PREFS.wing;
      const options = prefs.filter((s) => !taken.has(s));
      const list = options.length ? options : Object.keys(SPOTS).filter((s) => !taken.has(s));
      const name = list[Math.floor(Math.random() * Math.min(list.length, 3))];
      taken.add(name);
      this.spots.set(p, name);
    }
  }

  spotFor(player, out) {
    const name = this.spots.get(player) || 'top';
    return this.spotWorld(name, out);
  }

  predictLanding() {
    const ball = this.world.ball;
    const p = ball.pos.clone();
    const v = ball.vel.clone();
    let t = 0;
    while (t < 1.2) {
      v.y -= 9.81 * 0.05;
      p.addScaledVector(v, 0.05);
      t += 0.05;
      if (p.y < 1.4 && v.y < 0) break;
    }
    p.x = clamp(p.x, -COURT.halfL + 0.3, COURT.halfL - 0.3);
    p.z = clamp(p.z, -COURT.halfW + 0.3, COURT.halfW - 0.3);
    this.landing.copy(p);
    return this.landing;
  }

  updateChasers() {
    this.chasers.clear();
    const ball = this.world.ball;
    if (ball.holder || ball.state === 'dead' || ball.state === 'toss') return;
    if (ball.state === 'pass') {
      // o destinatário vai até a bola
      if (ball.passInfo && ball.passInfo.target.team === this.team) this.chasers.add(ball.passInfo.target);
      return;
    }
    const target = this.predictLanding();
    const ranked = [...this.players].sort((a, b) => distXZ(a.pos, target) - distXZ(b.pos, target));
    if (ranked[0]) this.chasers.add(ranked[0]);
    if (ranked[1] && distXZ(ranked[1].pos, target) < 4.5 && ball.state === 'loose' && ball.pos.y < 2.5) this.chasers.add(ranked[1]);
  }

  manFor(player) {
    return this.assign.get(player) || null;
  }

  jitter() {
    return rand(-1, 1);
  }
}
