import * as THREE from 'three';
import { COURT, PLAYER } from '../config/Constants.js';
import { EventBus } from './EventBus.js';
import { Ball } from '../entities/Ball.js';
import { Player } from '../entities/Player.js';
import { BallPhysics } from '../physics/BallPhysics.js';
import { clamp, distXZ, distPointSegmentXZ, chance, gauss } from './MathUtils.js';

// Mundo da partida: jogadores, bola, física, recepção de bola, tocos e colisões.
// É independente do modo de jogo (partida, treino, futuramente multiplayer).
export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.court = game.court;
    this.events = new EventBus();
    this.ball = new Ball(this.scene);
    this.physics = new BallPhysics((type, data) => this.onBallEvent(type, data));
    this.players = [];
    this.teams = [
      { index: 0, def: null, players: [], attackSign: 1 },
      { index: 1, def: null, players: [], attackSign: -1 },
    ];
    this.baskets = [new THREE.Vector3(COURT.basketX, COURT.rimHeight, 0), new THREE.Vector3(-COURT.basketX, COURT.rimHeight, 0)];
    this.time = 0;
    this.rules = null;
    this.lastCollisionFoul = new Map();
  }

  emit(type, data) {
    this.events.emit(type, data);
  }

  on(type, fn) {
    return this.events.on(type, fn);
  }

  addPlayer(data, team, kit) {
    const p = new Player(this, data, team, this.teams[team].players.length, kit);
    this.players.push(p);
    this.teams[team].players.push(p);
    return p;
  }

  attackSign(team) {
    return this.teams[team].attackSign;
  }

  attackBasket(team) {
    return this.attackSign(team) > 0 ? this.baskets[0] : this.baskets[1];
  }

  defendBasket(team) {
    return this.attackSign(team) > 0 ? this.baskets[1] : this.baskets[0];
  }

  opponents(team) {
    return this.teams[1 - team].players;
  }

  teammates(player) {
    return this.teams[player.team].players.filter((p) => p !== player);
  }

  nearestOpponentDist(player, pos = player.pos) {
    let best = Infinity;
    for (const o of this.opponents(player.team)) best = Math.min(best, distXZ(pos, o.pos));
    return best;
  }

  // Escolhe o melhor destino de passe; com direção dá prioridade a quem está nela
  choosePassTarget(player, dir) {
    const mates = this.teammates(player);
    if (!mates.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const m of mates) {
      const dx = m.pos.x - player.pos.x;
      const dz = m.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz) || 0.01;
      let score = -d * 0.05 + Math.min(4, this.nearestOpponentDist(m)) * 0.25;
      if (dir && (dir.x || dir.z)) {
        const dl = Math.hypot(dir.x, dir.z);
        score += ((dx * dir.x + dz * dir.z) / (d * dl)) * 3;
      }
      if (this.passLaneBlocked(player, m)) score -= 0.8;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  passLaneBlocked(from, to) {
    for (const o of this.opponents(from.team)) {
      const r = distPointSegmentXZ(o.pos, from.pos, to.pos);
      if (r.dist < 0.75 && r.t > 0.12 && r.t < 0.92) return true;
    }
    return false;
  }

  update(dt) {
    this.time += dt;
    for (const p of this.players) p.update(dt);
    this.resolveCollisions();

    const ball = this.ball;
    if (ball.holder) {
      ball.pos.copy(ball.holder.ballAnchor);
      const h = ball.holder;
      if (!h.action || h.action === 'crossover') {
        const r = h.right;
        ball.spin.set(r.x, 0, r.z).multiplyScalar(-6 - h.speed * 2);
      } else ball.spin.multiplyScalar(0.9);
    } else if (ball.state !== 'frozen') {
      this.physics.step(ball, dt);
    }
    ball.update(dt);
    this.checkBlocks();
    this.checkCatches();
    this.court.update(dt, ball);
  }

  onBallEvent(type, data) {
    const ball = this.ball;
    switch (type) {
      case 'rim':
      case 'board':
        ball.touchedRim = true;
        if (ball.state === 'shot') ball.setState('loose');
        if (type === 'rim') {
          const hoop = this.court.hoops[data.side > 0 ? 0 : 1];
          hoop.triggerRim(data.impact);
        }
        this.emit(type, { impact: data.impact, pos: ball.pos.clone(), side: data.side });
        break;
      case 'bounce':
        this.emit('bounce', { impact: data.impact, pos: data.pos });
        break;
      case 'floor':
        ball.touchedFloor = true;
        if (ball.state === 'shot' || ball.state === 'pass') ball.setState('loose');
        this.emit('ballFloor', { pos: ball.pos.clone(), impact: data.impact });
        break;
      case 'wall':
        if (ball.state === 'shot' || ball.state === 'pass') ball.setState('loose');
        this.emit('ballWall', { pos: ball.pos.clone() });
        break;
      case 'net':
        this.court.hoops[data.side > 0 ? 0 : 1].triggerSwish(1);
        this.emit('net', { side: data.side });
        break;
      case 'score':
        this.court.hoops[data.side > 0 ? 0 : 1].triggerSwish(1.2);
        this.emit('score', { side: data.side, swish: data.swish, shotInfo: ball.shotInfo });
        break;
      default:
        break;
    }
  }

  resolveCollisions() {
    const ps = this.players;
    const minD = PLAYER.radius * 2;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d >= minD || d < 1e-5) continue;
        // jogadores no ar a alturas diferentes não colidem
        if (Math.abs(a.pos.y - b.pos.y) > 0.6) continue;
        const push = (minD - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        if (a.team !== b.team) this.checkContactFoul(a, b, nx, nz);
      }
    }
  }

  checkContactFoul(a, b, nx, nz) {
    if (!this.rules || this.rules.phase !== 'live') return;
    const handler = a.hasBall ? a : b.hasBall ? b : null;
    if (!handler) return;
    const def = handler === a ? b : a;
    const key = handler.index * 10 + def.index + handler.team * 100;
    const last = this.lastCollisionFoul.get(key) || -10;
    if (this.time - last < 1.5) return;
    this.lastCollisionFoul.set(key, this.time);
    const rel = Math.hypot(handler.vel.x - def.vel.x, handler.vel.z - def.vel.z);
    if (rel < 4.2 || handler.speed < 4) return;
    const defSpeed = def.speed;
    if (defSpeed < 1.0 && chance(0.15)) {
      this.emit('foul', { type: 'charge', fouler: handler, victim: def });
    } else if (defSpeed > 2.5 && chance(0.12 * ((def.controller && def.controller.foulRate) || 1))) {
      this.emit('foul', { type: 'block', fouler: def, victim: handler });
    }
  }

  // Dribles fortes podem desequilibrar o marcador
  checkAnkleBreaker(handler) {
    for (const o of this.opponents(handler.team)) {
      const d = distXZ(o.pos, handler.pos);
      if (d > 1.8 || o.action) continue;
      const f = handler.forward;
      const dot = ((o.pos.x - handler.pos.x) * f.x + (o.pos.z - handler.pos.z) * f.z) / (d || 1);
      if (dot < 0.3) continue;
      let p = 0.06 + 0.3 * handler.attr('speed') - 0.3 * o.attr('defense');
      if (o.controller && o.controller.stealSkill) p /= o.controller.stealSkill;
      if (o.isHuman) p *= 0.6;
      if (chance(clamp(p, 0.04, 0.45))) {
        o.stumble(0.75);
        this.emit('ankleBreaker', { player: handler, victim: o });
      }
    }
  }

  checkBlocks() {
    const ball = this.ball;
    // bola em voo após arremesso
    if (ball.state === 'shot' && ball.shotInfo && ball.stateTime > 0.03 && ball.vel.y > -1.5 && !ball.touchedRim) {
      for (const p of this.opponents(ball.shotInfo.team)) {
        if (p.onGround || (p.action !== 'block' && p.action !== 'jump')) continue;
        if (!p.blockRolled || p.blockRolled.has(ball.shotInfo)) continue;
        const hand = p.pos.clone();
        hand.y = p.pos.y + p.reach;
        hand.addScaledVector(p.forward, 0.18);
        if (hand.distanceTo(ball.pos) < 0.42) {
          p.blockRolled.add(ball.shotInfo);
          const chanceBlock = 0.18 + 0.25 * p.attr('defense');
          if (chance(chanceBlock)) this.applyBlock(p, ball.shotInfo.shooter);
        }
      }
    }
    // bandeja / enterrada ainda na mão
    const h = ball.holder;
    if (h && !h.onGround && (h.action === 'layup' || h.action === 'dunk' || (h.action === 'shoot' && h.actionData.jumped))) {
      for (const p of this.opponents(h.team)) {
        if (p.onGround || (p.action !== 'block' && p.action !== 'jump')) continue;
        if (!p.blockRolled || p.blockRolled.has(h.actionData)) continue;
        const hand = p.pos.clone();
        hand.y = p.pos.y + p.reach;
        hand.addScaledVector(p.forward, 0.2);
        if (hand.distanceTo(ball.pos) < 0.45) {
          p.blockRolled.add(h.actionData);
          let c = 0.08 + 0.16 * p.attr('defense');
          if (h.action === 'dunk') c -= 0.12;
          if (chance(c)) {
            h.clearAction();
            this.applyBlock(p, h);
          }
        }
      }
    }
  }

  applyBlock(blocker, shooter) {
    const ball = this.ball;
    const dir = new THREE.Vector3(ball.pos.x - blocker.pos.x, 0, ball.pos.z - blocker.pos.z);
    if (dir.lengthSq() < 0.01) dir.copy(blocker.forward);
    dir.normalize();
    const v = dir.multiplyScalar(3 + Math.random() * 2.5);
    v.x += gauss() * 1.2;
    v.z += gauss() * 1.2;
    v.y = -0.5 + Math.random() * 2.2;
    ball.release('loose', v, blocker);
    ball.shotInfo = null;
    ball.spin.set(gauss() * 20, gauss() * 20, gauss() * 20);
    this.emit('block', { player: blocker, shooter });
  }

  checkCatches() {
    const ball = this.ball;
    if (ball.holder || ball.state === 'dead' || ball.state === 'toss' || ball.state === 'frozen') return;
    if (this.rules && this.rules.allowCatch && !this.rules.allowCatch()) return;
    // interferência: ninguém toca na bola sobre o aro (cilindro acima da cesta)
    if (ball.pos.y > COURT.rimHeight - 0.2) {
      for (const b of this.baskets) if (distXZ(ball.pos, b) < COURT.rimRadius + 0.3) return;
    }
    let best = null;
    let bestD = Infinity;
    const contenders = [];
    for (const p of this.players) {
      if (!p.canCatch()) continue;
      if (ball.ignorePlayer === p && ball.time < ball.ignoreUntil) continue;
      if (ball.state === 'shot' && !(ball.pos.y < 2.6 && ball.vel.y < 0)) continue;
      const top = p.pos.y + p.reach;
      const bottom = p.pos.y + 0.25;
      const by = clamp(ball.pos.y, bottom, top);
      const dy = ball.pos.y - by;
      const dxz = distXZ(ball.pos, p.pos);
      const d = Math.hypot(dxz, dy);
      let radius = PLAYER.catchRadius;
      const intended = ball.state === 'pass' && ball.passInfo && ball.passInfo.target === p;
      if (intended) radius += 0.25;
      if (d > radius) continue;
      // interceptação de passe
      if (ball.state === 'pass' && p.team !== ball.lastTouchTeam) {
        const rolled = ball.passInfo.rolled;
        if (!rolled.has(p)) {
          const skill = (p.controller && p.controller.interceptSkill) || 0.8;
          rolled.set(p, chance((0.08 + 0.26 * p.attr('defense')) * skill));
        }
        if (!rolled.get(p)) continue;
      }
      contenders.push(p);
      const score = d - (ball.state === 'loose' ? Math.random() * 0.35 * p.attr('rebound') : 0) - (intended ? 0.3 : 0);
      if (score < bestD) {
        bestD = score;
        best = p;
      }
    }
    if (best) this.giveBall(best);
  }

  giveBall(p) {
    const ball = this.ball;
    const prevState = ball.state;
    const prevTeam = ball.lastTouchTeam;
    const shotInfo = ball.shotInfo;
    const passInfo = ball.passInfo;
    const touchedRim = ball.touchedRim;
    ball.setHeld(p);
    ball.touchedFloor = false;
    p.onCatch();
    if (passInfo && passInfo.from && passInfo.from.team === p.team && prevState === 'pass') {
      p.lastPassFrom = passInfo.from;
      p.lastPassTime = this.time;
    } else {
      p.lastPassFrom = null;
    }
    p.computeBallAnchor();
    this.emit('catch', { player: p, prevState, prevTeam, shotInfo, passInfo, touchedRim });
  }

  dispose() {
    for (const p of this.players) p.dispose();
    this.players = [];
    this.ball.dispose();
    this.events.clear();
  }
}
