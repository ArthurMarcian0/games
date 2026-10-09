import * as THREE from 'three';
import { COURT, MATCH } from '../config/Constants.js';
import { clamp, distXZ, chance } from '../core/MathUtils.js';
import { solveByTime } from '../physics/ShotCalculator.js';
import { ScoreSystem } from './ScoreSystem.js';
import { tipoffPositions, inboundPositions, freeThrowPositions, tallest } from './Formations.js';

const QUARTER_NAMES = ['1º QUARTO', '2º QUARTO', '3º QUARTO', '4º QUARTO'];
const HALF_NAMES = ['1º TEMPO', '2º TEMPO'];

/**
 * Regras da partida: cronômetro, relógio de posse, posse de bola, pontuação,
 * faltas, lances livres, bola fora, violações, quartos, prorrogação e fim.
 */
export class MatchRules {
  constructor(world, config, hooks = {}) {
    this.world = world;
    this.config = config;
    this.hooks = hooks; // { transition(fn), onGameOver(result) }
    this.scoreSys = new ScoreSystem(world);
    this.quarterLength = config.quarterLength;
    this.quarters = config.quarters || 4;
    this.regulation = this.quarters; // 4 quartos ou 2 tempos
    this.quarter = 1;
    this.clock = this.quarterLength;
    this.shotClock = MATCH.shotClock;
    this.shotClockOff = false;
    this.phase = 'intro';
    this.phaseTime = 0;
    this.possession = 0;
    this.teamFouls = [0, 0];
    this.pending = null;
    this.deadTimer = 0;
    this.ft = null;
    this.foulShot = null;
    this.clockExpired = false;
    this.altPossession = 1;
    this.looseTime = 0;
    this.stuckTime = 0;
    this.winner = null;
    this.training = false;
    this.lastHolder = null;

    const on = (t, fn) => world.on(t, fn.bind(this));
    on('score', this.onScore);
    on('catch', this.onCatch);
    on('ballFloor', this.onBallOut);
    on('ballWall', this.onBallWall);
    on('foul', this.onFoul);
    on('shotReleased', this.onShotReleased);
    on('rim', this.onRim);
    on('board', this.onRim);
    on('steal', this.onSteal);
    on('block', this.onBlock);
  }

  get score() {
    return this.scoreSys.score;
  }

  msg(text, sub = '', kind = 'info', duration = 1.6) {
    this.world.emit('message', { text, sub, kind, duration });
  }

  teamName(team) {
    const t = this.world.teams[team].def;
    return t ? t.abbr : team === 0 ? 'CASA' : 'VIS';
  }

  isFreeThrowShooter(p) {
    return this.phase === 'freethrow' && this.ft && this.ft.shooter === p;
  }

  ftReady() {
    return this.ft && this.ft.state === 'ready';
  }

  allowCatch() {
    return this.phase === 'live' || this.phase === 'tipoff';
  }

  // ---------------------------------------------------------------
  start() {
    this.setPositions(tipoffPositions(this.world));
    this.world.ball.setState('frozen');
    this.world.ball.pos.set(0, 1.2, 0);
    this.lockAll(true);
    this.phase = 'intro';
    this.phaseTime = 0;
    this.world.emit('matchStart', {});
  }

  setPositions(list) {
    for (const { p, x, z, h } of list) {
      p.teleport(x, z, h);
      p.scriptTarget = null;
    }
  }

  lockAll(lock) {
    for (const p of this.world.players) {
      p.lockMove = lock;
      p.lockActions = lock;
    }
  }

  update(dt) {
    this.phaseTime += dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseTime > (this.config.introTime ?? 2.6)) this.beginTipoff();
        break;
      case 'tipoff':
        this.updateTipoff();
        break;
      case 'live':
        this.updateLive(dt);
        break;
      case 'dead':
        this.deadTimer -= dt;
        if (this.deadTimer <= 0 && this.pending) {
          const fn = this.pending;
          this.pending = null;
          this.phase = 'transition';
          this.hooks.transition ? this.hooks.transition(fn) : fn();
        }
        break;
      case 'freethrow':
        this.updateFreeThrow(dt);
        break;
      case 'break':
        this.deadTimer -= dt;
        if (this.deadTimer <= 0 && this.pending) {
          const fn = this.pending;
          this.pending = null;
          this.phase = 'transition';
          this.hooks.transition ? this.hooks.transition(fn) : fn();
        }
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------
  // Bola ao alto
  beginTipoff() {
    const w = this.world;
    this.phase = 'tipoff';
    this.phaseTime = 0;
    const ball = w.ball;
    ball.holder = null;
    ball.pos.set(0, 1.9, 0);
    ball.vel.set(0, 5.4, 0);
    ball.setState('toss');
    ball.lastTouchTeam = -1;
    this.jumpers = [tallest(w.teams[0].players), tallest(w.teams[1].players)];
    this.tipDone = false;
    this.jumped = false;
    this.world.emit('whistle', {});
  }

  updateTipoff() {
    const w = this.world;
    const t = this.phaseTime;
    if (!this.jumped && t > 0.3) {
      this.jumped = true;
      for (const j of this.jumpers) {
        j.lockActions = true;
        j.setAction('tipoff', {});
        j.vel.y = 3.9;
        j.onGround = false;
      }
    }
    if (!this.tipDone && t > 0.62) {
      this.tipDone = true;
      const [a, b] = this.jumpers;
      const wa = a.height + a.attr('rebound') * 0.3 + Math.random() * 0.35;
      const wb = b.height + b.attr('rebound') * 0.3 + Math.random() * 0.35;
      const winner = wa >= wb ? a : b;
      const mates = w.teammates(winner);
      const ball = w.ball;
      this.lockAll(false);
      this.phase = 'live';
      this.possession = winner.team;
      this.shotClock = MATCH.shotClock;
      if (mates.length) {
        const tgt = mates.reduce((m, p) => (Math.abs(p.pos.x) < Math.abs(m.pos.x) ? p : m), mates[0]);
        const to = tgt.pos.clone();
        to.y = 1.3;
        ball.release('pass', solveByTime(ball.pos, to, 0.75), winner, { from: winner, target: tgt, time: 0.75, rolled: new Map() });
      } else {
        const s = w.attackSign(winner.team);
        ball.release('loose', new THREE.Vector3(s * 2.2, 0.5, 0), winner);
      }
      ball.ignorePlayer = null;
      this.world.emit('possession', { team: winner.team, reason: 'tipoff' });
      this.msg('BOLA AO ALTO', `Posse: ${this.teamName(winner.team)}`, 'info', 1.2);
    }
  }

  // ---------------------------------------------------------------
  updateLive(dt) {
    const w = this.world;
    const ball = w.ball;
    if (!this.training) {
      this.clock = Math.max(0, this.clock - dt);
      if (!this.shotClockOff) this.shotClock = Math.max(0, this.shotClock - dt);
    }

    // jogador com a bola pisou fora da quadra
    const h = ball.holder;
    if (h && h.onGround && (Math.abs(h.pos.x) > COURT.halfL + 0.05 || Math.abs(h.pos.z) > COURT.halfW + 0.05)) {
      this.turnover(h.team, 'BOLA FORA', `${h.name} pisou fora`, h.pos);
      return;
    }

    // falta de arremesso pendente: resolve quando a bola erra
    if (this.foulShot && !h && ball.state === 'loose' && ((ball.touchedRim && ball.pos.y < 2.3 && ball.vel.y < 0) || ball.touchedFloor)) {
      const f = this.foulShot;
      this.foulShot = null;
      ball.setState('dead');
      this.deadBall(0.8, () => this.startFreeThrows(f.shooter, f.points));
      return;
    }
    if (this.foulShot && h && h !== this.foulShot.shooter) this.foulShot = null;

    // violação de 24 segundos
    if (!this.training && this.shotClock <= 0 && !this.shotClockOff && ball.state !== 'shot') {
      const team = this.possession;
      ball.setState('dead');
      this.world.emit('buzzer', { short: true });
      this.turnover(team, 'VIOLAÇÃO', 'Estouro dos 24 segundos', h ? h.pos : ball.pos);
      return;
    }

    // fim do quarto (espera a bola em voo: "estouro do cronômetro")
    if (!this.training && this.clock <= 0) {
      if (!this.clockExpired) {
        this.clockExpired = true;
        this.world.emit('buzzer', {});
      }
      if (ball.state !== 'shot' || ball.stateTime > 3) {
        if (!this.pending) {
          ball.setState('dead');
          this.endQuarter();
        }
        return;
      }
    }

    // bola solta por muito tempo ou presa no aro
    if (!h) {
      this.looseTime += dt;
      if (ball.pos.y > 2.8 && ball.vel.length() < 0.4) this.stuckTime += dt;
      else this.stuckTime = 0;
      if (this.stuckTime > 1.2 || this.looseTime > 12) {
        const team = this.altPossession;
        this.altPossession = 1 - team;
        ball.setState('dead');
        this.msg('BOLA PRESA', `Posse alternada: ${this.teamName(team)}`, 'warn');
        this.deadBall(1.0, () => this.setupInbound(team, this.sideSpot(team, ball.pos)));
      }
    } else {
      this.looseTime = 0;
      this.stuckTime = 0;
      this.lastHolder = h;
    }
  }

  // ---------------------------------------------------------------
  deadBall(delay, next) {
    this.phase = 'dead';
    this.deadTimer = delay;
    this.pending = next;
    for (const p of this.world.players) p.lockActions = true;
  }

  turnover(team, text, sub, pos) {
    const other = 1 - team;
    const ball = this.world.ball;
    ball.setState('dead');
    if (this.lastHolder && this.lastHolder.team === team) this.lastHolder.stats.tov++;
    this.msg(text, sub, 'warn');
    this.world.emit('whistle', {});
    this.world.emit('turnover', { team });
    this.deadBall(1.4, () => this.setupInbound(other, this.sideSpot(other, pos || ball.pos)));
  }

  // ponto de reposição na lateral/fundo mais próximo
  sideSpot(team, pos) {
    const x = clamp(pos.x, -COURT.halfL + 1.2, COURT.halfL - 1.2);
    let z;
    if (Math.abs(pos.x) > COURT.halfL - 1) {
      // fundo: evita a área sob a cesta
      z = clamp(pos.z, -6.6, 6.6);
      if (Math.abs(z) < 2) z = 2.6 * (z >= 0 ? 1 : -1);
      return new THREE.Vector3(Math.sign(pos.x) * (COURT.halfL - 0.5), 0, z);
    }
    z = (pos.z >= 0 ? 1 : -1) * (COURT.halfW - 0.45);
    return new THREE.Vector3(x, 0, z);
  }

  // após cesta: reposição no fundo da quadra defendida por "team"
  baselineSpot(team) {
    const s = this.world.attackSign(team);
    return new THREE.Vector3(-s * (COURT.halfL - 0.6), 0, 2.4);
  }

  setupInbound(team, spot) {
    const w = this.world;
    const players = w.teams[team].players;
    // armador repõe (mais próximo do ponto)
    const inbounder = players.reduce((a, b) => (distXZ(b.pos, spot) < distXZ(a.pos, spot) ? b : a), players[0]);
    this.setPositions(inboundPositions(w, team, spot, inbounder));
    this.lockAll(false);
    const ball = w.ball;
    w.giveBall(inbounder);
    this.possession = team;
    this.shotClock = MATCH.shotClock;
    this.shotClockOff = false;
    this.clockExpired = false;
    this.foulShot = null;
    this.phase = 'live';
    this.phaseTime = 0;
    this.looseTime = 0;
    ball.lastScoreTime = -10;
    w.emit('possession', { team, reason: 'inbound' });
    w.emit('inbound', { team, player: inbounder });
  }

  // ---------------------------------------------------------------
  onShotReleased({ player, info }) {
    if (this.phase !== 'live' && this.phase !== 'freethrow') return;
    this.scoreSys.shotAttempt(info);
    if (this.phase === 'freethrow') {
      this.ft.state = 'flight';
      this.ft.t = 0;
      return;
    }
    // falta no arremesso
    for (const o of this.world.opponents(player.team)) {
      const d = distXZ(o.pos, player.pos);
      if (d > 1.05) continue;
      let p = 0.025;
      if (!o.onGround) p += 0.07;
      if (d < 0.75) p += 0.05;
      if (o.speed > 3) p += 0.05;
      if (info.type !== 'jump') p += 0.04;
      p *= (o.controller && o.controller.foulRate) || 1;
      if (chance(p)) {
        this.registerFoul(o, player, 'shooting');
        this.foulShot = { shooter: player, points: info.points, fouler: o };
        this.msg('FALTA NO ARREMESSO', `${o.name} em ${player.name}`, 'foul', 1.4);
        this.world.emit('whistle', {});
        break;
      }
    }
  }

  onRim() {
    const ball = this.world.ball;
    if (ball.shotInfo) this.shotClockOff = true;
  }

  onScore({ side, swish, shotInfo }) {
    const team = side > 0 ? 0 : 1;
    const w = this.world;
    const ball = w.ball;
    if (this.phase === 'freethrow' && this.ft && this.ft.state === 'flight') {
      this.scoreSys.addPoints(team, 1, this.quarter, shotInfo || { shooter: this.ft.shooter, type: 'ft', points: 1 });
      w.emit('scored', { team, points: 1, shooter: this.ft.shooter, swish, type: 'ft' });
      this.ftResult(true);
      return;
    }
    if (this.phase !== 'live') return;
    const points = shotInfo && shotInfo.team === team ? shotInfo.points : 2;
    const info = shotInfo && shotInfo.team === team ? shotInfo : null;
    this.scoreSys.addPoints(team, points, this.quarter, info);
    ball.setState('dead');
    const shooter = info ? info.shooter : null;
    w.emit('scored', { team, points, shooter, swish, type: info ? info.type : 'tip', assist: info ? info.assistFrom : null });
    if (shooter && (shooter.isHuman || chance(0.6))) shooter.celebrate(1.6);

    if (this.clockExpired || (this.clock <= 0 && !this.training)) {
      this.deadBall(1.6, () => this.endQuarter());
      return;
    }
    if (this.foulShot && this.foulShot.shooter === shooter) {
      const f = this.foulShot;
      this.foulShot = null;
      this.msg('E-UM!', 'Cesta e falta: 1 lance livre', 'score', 1.6);
      this.deadBall(1.6, () => this.startFreeThrows(f.shooter, 1));
      return;
    }
    this.foulShot = null;
    this.deadBall(1.7, () => this.setupInbound(1 - team, this.baselineSpot(1 - team)));
  }

  onCatch({ player, prevState, shotInfo, touchedRim, passInfo }) {
    if (this.phase === 'tipoff') return;
    if (this.phase !== 'live') return;
    const team = player.team;
    const wasShot = !!shotInfo;
    if (wasShot) player.stats.reb++;
    if (team !== this.possession) {
      let reason = 'rebound';
      if (prevState === 'pass' && passInfo && passInfo.from) {
        reason = 'interception';
        player.stats.stl++;
        passInfo.from.stats.tov++;
        this.msg('INTERCEPTAÇÃO!', player.name, 'steal', 1.2);
      } else if (wasShot) {
        reason = 'defensive-rebound';
      }
      this.possession = team;
      this.shotClock = MATCH.shotClock;
      this.world.emit('possession', { team, reason });
    } else if (wasShot) {
      if (touchedRim) this.shotClock = Math.max(this.shotClock, MATCH.offRebShotClock);
      this.world.emit('offensiveRebound', { player });
    }
    this.shotClockOff = false;
    this.foulShot = this.foulShot && this.foulShot.shooter === player ? this.foulShot : null;
  }

  onSteal({ player, victim }) {
    player.stats.stl++;
    victim.stats.tov++;
    this.msg('ROUBO DE BOLA!', player.name, 'steal', 1.2);
  }

  onBlock({ player }) {
    player.stats.blk++;
    this.msg('TOCO!', player.name, 'block', 1.2);
  }

  onBallOut({ pos }) {
    if (this.phase !== 'live') return;
    const ball = this.world.ball;
    if (ball.holder || ball.state === 'dead') return;
    if (Math.abs(pos.x) > COURT.halfL || Math.abs(pos.z) > COURT.halfW) {
      const team = ball.lastTouchTeam >= 0 ? ball.lastTouchTeam : this.possession;
      if (this.foulShot) return;
      this.turnover(team, 'BOLA FORA', `Reposição: ${this.teamName(1 - team)}`, pos);
    }
  }

  onBallWall({ pos }) {
    this.onBallOut({ pos });
  }

  registerFoul(fouler, victim, type) {
    fouler.stats.fouls++;
    this.teamFouls[fouler.team]++;
    this.world.emit('foulCalled', { fouler, victim, type });
  }

  onFoul({ type, fouler, victim }) {
    if (this.phase !== 'live') return;
    const ball = this.world.ball;
    this.world.emit('whistle', {});
    if (type === 'charge') {
      this.registerFoul(fouler, victim, type);
      ball.setState('dead');
      if (ball.holder) ball.holder = null;
      this.msg('FALTA DE ATAQUE', `${fouler.name} atropelou ${victim.name}`, 'foul');
      fouler.stats.tov++;
      this.deadBall(1.4, () => this.setupInbound(victim.team, this.sideSpot(victim.team, fouler.pos)));
      return;
    }
    this.registerFoul(fouler, victim, type);
    const bonus = this.teamFouls[fouler.team] >= MATCH.bonusFouls;
    const label = type === 'reach' ? 'FALTA (tapa no braço)' : 'FALTA DE BLOQUEIO';
    ball.setState('dead');
    if (ball.holder) {
      ball.holder = null;
    }
    if (bonus) {
      this.msg(label, `${fouler.name} • Bônus: 2 lances livres`, 'foul');
      this.deadBall(1.3, () => this.startFreeThrows(victim, 2));
    } else {
      this.msg(label, `${fouler.name} (${this.teamFouls[fouler.team]} faltas da equipe)`, 'foul');
      this.deadBall(1.3, () => this.setupInbound(victim.team, this.sideSpot(victim.team, victim.pos)));
    }
  }

  // ---------------------------------------------------------------
  // Lances livres
  startFreeThrows(shooter, total) {
    this.ft = { shooter, total, index: 0, made: 0, state: 'setup', t: 0 };
    this.setupFreeThrow();
  }

  setupFreeThrow() {
    const w = this.world;
    const ft = this.ft;
    this.setPositions(freeThrowPositions(w, ft.shooter));
    for (const p of w.players) {
      p.lockMove = true;
      p.lockActions = p !== ft.shooter;
    }
    w.giveBall(ft.shooter);
    ft.shooter.dribblePhase = 0;
    this.possession = ft.shooter.team;
    ft.state = 'ready';
    ft.t = 0;
    this.phase = 'freethrow';
    this.phaseTime = 0;
    this.msg(`LANCE LIVRE ${ft.index + 1}/${ft.total}`, ft.shooter.name, 'info', 1.4);
    w.emit('freeThrowSetup', { shooter: ft.shooter });
  }

  updateFreeThrow(dt) {
    const ft = this.ft;
    const ball = this.world.ball;
    if (!ft) return;
    ft.t += dt;
    if (ft.state === 'flight') {
      const missed = (ball.touchedRim && ball.pos.y < 2.5 && ball.vel.y < 0) || ball.touchedFloor || ft.t > 4;
      if (missed && ball.state !== 'dead') this.ftResult(false);
    }
  }

  ftResult(made) {
    const ft = this.ft;
    const w = this.world;
    ft.made += made ? 1 : 0;
    ft.index++;
    ft.state = 'result';
    const last = ft.index >= ft.total;
    if (!made) this.msg('ERROU', '', 'warn', 0.9);
    if (!last) {
      w.ball.setState('dead');
      this.deadBall(1.1, () => this.setupFreeThrow());
      return;
    }
    if (made) {
      w.ball.setState('dead');
      const other = 1 - ft.shooter.team;
      this.ft = null;
      if (this.clock <= 0) return this.deadBall(1.4, () => this.endQuarter());
      this.deadBall(1.4, () => this.setupInbound(other, this.baselineSpot(other)));
    } else {
      // último lance livre errado: bola viva para o rebote
      this.ft = null;
      this.lockAll(false);
      this.phase = 'live';
      this.shotClockOff = true;
      if (this.clock <= 0) {
        w.ball.setState('dead');
        this.deadBall(1.0, () => this.endQuarter());
      }
    }
  }

  // ---------------------------------------------------------------
  endQuarter() {
    const w = this.world;
    const [a, b] = this.score;
    this.clockExpired = false;
    w.ball.setState('dead');
    this.lockAll(true);
    if (this.quarter >= this.quarters && a !== b) {
      this.phase = 'over';
      this.winner = a > b ? 0 : 1;
      this.msg('FIM DE JOGO', `${this.teamName(0)} ${a} x ${b} ${this.teamName(1)}`, 'final', 3);
      w.emit('buzzer', {});
      w.emit('gameOver', { winner: this.winner, score: [a, b] });
      if (this.hooks.onGameOver) this.hooks.onGameOver({ winner: this.winner, score: [a, b] });
      return;
    }
    const overtime = this.quarter >= this.quarters;
    const label = overtime ? 'EMPATE! PRORROGAÇÃO' : this.quarter === Math.floor(this.regulation / 2) ? 'INTERVALO' : `FIM DO ${this.periodName(this.quarter)}`;
    this.msg(label, `${this.teamName(0)} ${a} x ${b} ${this.teamName(1)}`, 'period', 2.4);
    w.emit('quarterEnd', { quarter: this.quarter });
    this.phase = 'break';
    this.deadTimer = 2.8;
    this.pending = () => {
      this.quarter++;
      if (this.quarter > this.quarters) this.quarters = this.quarter;
      this.clock = overtime ? Math.min(60, this.quarterLength) : this.quarterLength;
      this.teamFouls = [0, 0];
      const team = this.altPossession;
      this.altPossession = 1 - team;
      this.msg(this.periodLabel(), '', 'period', 1.6);
      this.setupInbound(team, new THREE.Vector3(0, 0, COURT.halfW - 0.45));
    };
  }

  periodName(q) {
    return (this.regulation === 2 ? HALF_NAMES : QUARTER_NAMES)[q - 1];
  }

  periodLabel() {
    const R = this.regulation;
    if (this.quarter > R) return this.quarter === R + 1 ? 'PRORROGAÇÃO' : `PRORROGAÇÃO ${this.quarter - R}`;
    return this.periodName(this.quarter);
  }

  shortPeriod() {
    if (this.quarter > this.regulation) return `PR${this.quarter - this.regulation}`;
    return this.regulation === 2 ? `${this.quarter}º T` : `${this.quarter}º Q`;
  }
}

