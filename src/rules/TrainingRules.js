import * as THREE from 'three';
import { COURT } from '../config/Constants.js';
import { solveByTime, isThreePoint } from '../physics/ShotCalculator.js';
import { freeThrowPositions } from './Formations.js';

// Regras simplificadas do modo treinamento: sem relógio, bola sempre volta
// para o jogador e estatísticas de aproveitamento.
export class TrainingRules {
  constructor(world) {
    this.world = world;
    this.phase = 'live';
    this.possession = 0;
    this.training = true;
    this.clock = null;
    this.shotClock = null;
    this.quarter = 1;
    this.score = [0, 0];
    this.stats = { attempts: 0, makes: 0, threesA: 0, threesM: 0, perfect: 0, streak: 0, best: 0, ftA: 0, ftM: 0 };
    this.returnTimer = 0;
    this.ftMode = false;
    this.lastShot = null;

    world.on('shotReleased', ({ info }) => {
      this.stats.attempts++;
      if (info.points === 3) this.stats.threesA++;
      if (info.type === 'ft') this.stats.ftA++;
      if (info.timing && info.timing.grade === 'perfect') this.stats.perfect++;
      this.lastShot = info;
      this.lastMade = false;
      this.missCounted = false;
    });
    world.on('score', ({ side, swish, shotInfo }) => {
      if (side < 0) return;
      const info = shotInfo || this.lastShot;
      const pts = info ? info.points : 2;
      this.stats.makes++;
      if (pts === 3) this.stats.threesM++;
      if (info && info.type === 'ft') this.stats.ftM++;
      this.stats.streak++;
      this.stats.best = Math.max(this.stats.best, this.stats.streak);
      this.score[0] += pts;
      this.lastMade = true;
      world.emit('scored', { team: 0, points: pts, shooter: info ? info.shooter : null, swish, type: info ? info.type : 'tip' });
      this.returnTimer = 1.3;
    });
    world.on('rim', () => {});
    world.on('block', ({ player }) => world.emit('message', { text: 'TOCO!', sub: player.name, kind: 'block', duration: 1 }));
    world.on('steal', ({ player }) => world.emit('message', { text: 'ROUBO!', sub: player.name, kind: 'steal', duration: 1 }));
  }

  get human() {
    return this.world.teams[0].players[0];
  }

  isFreeThrowShooter(p) {
    return this.ftMode && p === this.human;
  }

  ftReady() {
    return false;
  }

  allowCatch() {
    return true;
  }

  start() {
    this.resetPlayer();
  }

  resetPlayer(pos = new THREE.Vector3(COURT.basketX - 6.5, 0, 0)) {
    const h = this.human;
    this.ftMode = false;
    h.lockMove = false;
    h.teleport(pos.x, pos.z, Math.PI / 2);
    this.world.giveBall(h);
    for (const d of this.world.teams[1].players) d.teleport(COURT.basketX - 3, 0, -Math.PI / 2);
  }

  freeThrow() {
    const h = this.human;
    const list = freeThrowPositions(this.world, h).filter((o) => o.p === h);
    for (const o of list) o.p.teleport(o.x, o.z, o.h);
    this.world.giveBall(h);
    this.ftMode = true;
    h.lockMove = true;
  }

  update(dt) {
    const w = this.world;
    const ball = w.ball;
    const h = this.human;
    if (this.lastShot && !ball.holder && !this.lastMade && ball.touchedFloor && !this.missCounted) {
      this.missCounted = true;
      this.stats.streak = 0;
    }
    if (this.ftMode) {
      // após o lance livre, devolve a bola na linha
      if (!ball.holder && ball.state !== 'shot') {
        this.ftWait = (this.ftWait || 0) + dt;
        if (this.ftWait > 1.6) {
          this.ftWait = 0;
          this.freeThrow();
        }
      }
      return;
    }
    if (ball.holder) {
      this.returnTimer = 0;
      if (ball.holder.team === 1) {
        // defensor de treino devolve a bola
        this.holdByDef = (this.holdByDef || 0) + dt;
        if (this.holdByDef > 0.7 && !ball.holder.action) {
          ball.holder.forcePassTo(h);
          this.holdByDef = 0;
        }
      }
      return;
    }
    if (ball.state === 'pass') return;
    // devolve a bola automaticamente quando ela para ou depois de um tempo
    this.returnTimer += dt;
    const settled = ball.pos.y < 0.4 && ball.vel.length() < 1.5;
    if ((settled && this.returnTimer > 1.0) || this.returnTimer > 3.2) {
      this.returnTimer = 0;
      this.missCounted = false;
      const from = ball.pos.clone();
      if (from.y < 0.5) from.y = 0.5;
      ball.pos.copy(from);
      const to = h.pos.clone();
      to.y = 1.3;
      const T = Math.min(1.1, Math.max(0.5, from.distanceTo(to) / 9));
      ball.release('pass', solveByTime(from, to, T), null, { from: null, target: h, time: T, rolled: new Map() });
      ball.lastTouchTeam = 0;
    }
  }

  shotIsThree(p) {
    return isThreePoint(p.pos, 1);
  }
}
