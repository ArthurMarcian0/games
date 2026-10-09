import * as THREE from 'three';
import { PLAYER, SHOT, GRAVITY, COURT } from '../config/Constants.js';
import { CharacterModel } from './CharacterModel.js';
import { Animator } from './Animator.js';
import { clamp, dampAngle, distXZ, headingTo, gauss, chance } from '../core/MathUtils.js';
import { getMove, COMBO_WINDOW } from './DribbleMoves.js';
import { computeJumpShot, computeLayup, contestLevel, isThreePoint, solveByTime } from '../physics/ShotCalculator.js';

export const EMPTY_INTENT = Object.freeze({
  moveX: 0,
  moveZ: 0,
  sprint: false,
  shootHeld: false,
  pass: false,
  passTarget: null,
  steal: false,
  jump: false,
  dribbleMove: null,
  face: null,
});

const UP = new THREE.Vector3(0, 1, 0);
const BUSY_NO_CATCH = new Set(['shoot', 'ft', 'layup', 'dunk', 'pass', 'stumble', 'celebrate']);

// Atleta: movimento, energia, ações com bola e defesa.
// Recebe "intenções" de um controlador (humano, IA ou, no futuro, rede).
export class Player {
  constructor(world, data, team, index, kit) {
    this.world = world;
    this.data = data;
    this.name = data.name;
    this.number = data.number;
    this.team = team;
    this.index = index;
    this.attrs = data.attrs;
    this.archetype = data.archetype;
    this.height = data.appearance.height;
    this.isCustom = !!data.isCustom;

    this.model = new CharacterModel(data.appearance, kit, data.number, data.name);
    world.scene.add(this.model.root);
    this.animator = new Animator(this.model);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.onGround = true;
    this.energy = 1;
    this.action = null;
    this.actionTime = 0;
    this.actionData = {};
    this.stance = 'normal';
    this.contesting = false;
    this.dribblePhase = Math.random();
    this.dribbleHand = 1;
    this.controller = null;
    this.isHuman = false;
    this.lockMove = false;
    this.lockActions = false;
    this.scriptTarget = null;
    this.cooldowns = { steal: 0, pass: 0, jump: 0, dribble: 0, catch: 0 };
    this.burstTime = 0;
    this.burstMul = 1;
    this.combo = 0;
    this.lastMoveEnd = -10;
    this.prevShootHeld = false;
    this.intent = EMPTY_INTENT;
    this.speed = 0;
    this.localSide = 0;
    this.localFwd = 0;
    this.prevMoveDir = new THREE.Vector2();
    this.ballAnchor = new THREE.Vector3();
    this.handPos = new THREE.Vector3();
    this.handPos2 = new THREE.Vector3();
    this.lastSqueak = 0;
    this.lastPassFrom = null;
    this.lastPassTime = -10;
    this.stats = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fouls: 0 };

    // anel indicador do jogador controlado
    const ringGeo = new THREE.RingGeometry(0.46, 0.56, 36);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: kit.accent, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    world.scene.add(this.ring);
    const arrowGeo = new THREE.ConeGeometry(0.12, 0.22, 3);
    arrowGeo.rotateX(Math.PI);
    this.marker = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.marker.visible = false;
    world.scene.add(this.marker);
  }

  attr(k) {
    return (this.attrs[k] ?? 70) / 100;
  }

  get hasBall() {
    return this.world.ball.holder === this;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  get right() {
    return new THREE.Vector3(-Math.cos(this.heading), 0, Math.sin(this.heading));
  }

  get attackSign() {
    return this.world.attackSign(this.team);
  }

  get reach() {
    return this.height * 1.31;
  }

  setController(c) {
    this.controller = c;
    this.isHuman = !!(c && c.isHuman);
    this.ring.visible = this.isHuman;
  }

  setAction(name, data = {}) {
    this.action = name;
    this.actionData = data;
    this.actionTime = 0;
  }

  clearAction() {
    this.action = null;
    this.actionData = {};
    this.actionTime = 0;
  }

  canCatch() {
    if (this.cooldowns.catch > 0) return false;
    return !BUSY_NO_CATCH.has(this.action);
  }

  teleport(x, z, heading = null) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.clearAction();
    if (heading != null) this.heading = heading;
    this.syncModel();
  }

  // ------------------------------------------------------------------
  update(dt) {
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (this.passQueued && (this.passQueued.t -= dt) <= 0) this.passQueued = null;
    const intent = this.controller ? this.controller.getIntent(this, dt) : EMPTY_INTENT;
    this.intent = intent;
    this.actionTime += dt;
    this.contesting = !!intent.contest;

    if (!this.lockActions) this.processIntent(intent);
    this.prevShootHeld = intent.shootHeld;
    this.updateAction(dt, intent);
    this.updateMovement(dt, intent);
    this.updateEnergy(dt, intent);

    if (this.hasBall) {
      const prev = this.dribblePhase;
      this.dribblePhase = (this.dribblePhase + dt * (1.45 + this.speed * 0.2)) % 1;
      if ((!this.action || this.action === 'dribbleMove') && prev < 0.5 && this.dribblePhase >= 0.5) {
        this.world.emit('dribble', { player: this, pos: this.ballAnchor });
      }
    }

    this.syncModel();
    this.animator.update(dt, this);
    this.model.root.updateMatrixWorld(true);
    if (this.hasBall) this.computeBallAnchor();

    this.ring.position.set(this.pos.x, 0.012, this.pos.z);
    this.ring.rotation.y += dt * 1.5;
    this.marker.position.set(this.pos.x, this.pos.y + this.height + 0.45 + Math.sin(performance.now() * 0.006) * 0.05, this.pos.z);
  }

  syncModel() {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.heading;
  }

  processIntent(intent) {
    const hasBall = this.hasBall;
    // comandos dados durante a recepção da bola ficam guardados
    if (intent.shootHeld && !this.prevShootHeld) this.shootQueued = true;
    if (!intent.shootHeld) this.shootQueued = false;
    if (intent.pass) this.passQueued = { target: intent.passTarget, t: 0.25 };
    if (hasBall) {
      // os últimos quadros de um drible já aceitam arremesso/passe (encadeamento)
      const free = !this.action || this.action === 'catch' || (this.action === 'dribbleMove' && this.actionTime >= getMove(this.actionData.kind).duration * 0.7);
      if (intent.shootHeld && this.shootQueued && free && this.onGround) {
        this.shootQueued = false;
        this.passQueued = null;
        this.beginShot(intent);
      } else if (this.passQueued && free && this.cooldowns.pass <= 0 && this.onGround) {
        const q = this.passQueued;
        this.passQueued = null;
        this.beginPass(q.target);
      } else if (intent.dribbleMove && (!this.action || this.action === 'catch') && this.cooldowns.dribble <= 0 && this.onGround) {
        this.beginDribbleMove(intent.dribbleMove.kind, intent.dribbleMove.side, intent.dribbleMove.push);
      }
    } else {
      if (intent.steal && !this.action && this.cooldowns.steal <= 0 && this.onGround) this.beginSteal();
      else if (intent.jump && (!this.action || this.action === 'catch') && this.onGround && this.cooldowns.jump <= 0) this.beginJump();
    }
  }

  // ------------------------------------------------------------------
  // Arremessos
  canDunk() {
    return (this.attr('finishing') >= 0.8 || this.height >= 1.98) && this.height >= 1.85 && this.energy > 0.2;
  }

  beginShot(intent) {
    const w = this.world;
    const rules = w.rules;
    const isFT = !!(rules && rules.isFreeThrowShooter && rules.isFreeThrowShooter(this));
    const basket = w.attackBasket(this.team);
    const d = distXZ(this.pos, basket);
    if (!isFT) {
      if (d < SHOT.dunkRange && intent.sprint && this.canDunk()) return this.beginDunk();
      if (d < SHOT.layupRange) return this.beginLayup();
    }
    this.setAction(isFT ? 'ft' : 'shoot', { meter: 0, jumped: false, released: false, ft: isFT });
    this.heading = headingTo(this.pos, basket);
    w.emit('shotStart', { player: this, ft: isFT });
  }

  beginLayup() {
    this.setAction('layup', { released: false, jumped: false });
    this.world.emit('shotStart', { player: this, layup: true });
  }

  beginDunk() {
    this.setAction('dunk', { released: false, jumped: false });
    this.world.emit('shotStart', { player: this, dunk: true });
  }

  releaseShot() {
    const w = this.world;
    const d = this.actionData;
    d.released = true;
    this.actionTime = 0;
    const rim = w.attackBasket(this.team);
    const from = this.ballAnchor.clone();
    const is3 = !d.ft && isThreePoint(this.pos, this.attackSign);
    const skill = d.ft ? this.attr('shooting') : is3 ? this.attr('three') : this.attr('shooting');
    const contest = d.ft ? 0 : contestLevel(this, w.opponents(this.team), rim);
    const res = computeJumpShot({
      from,
      rim,
      meter: d.meter,
      skill,
      contest,
      fatigue: 1 - this.energy,
      extraSigma: ((this.controller && this.controller.shotSigma) || 0) + (this.team === 0 ? w.mods.homeShotSigma : 0),
      isFreeThrow: d.ft,
    });
    const info = {
      shooter: this,
      team: this.team,
      points: d.ft ? 1 : is3 ? 3 : 2,
      type: d.ft ? 'ft' : 'jump',
      origin: this.pos.clone(),
      contest,
      timing: res.timing,
      distance: res.distance,
      assistFrom: this.world.time - this.lastPassTime < 5 ? this.lastPassFrom : null,
    };
    w.ball.release('shot', res.velocity, this, info);
    w.emit('shotReleased', { player: this, info });
  }

  releaseLayup() {
    const w = this.world;
    this.actionData.released = true;
    const rim = w.attackBasket(this.team);
    const from = this.ballAnchor.clone();
    const contest = contestLevel(this, w.opponents(this.team), rim);
    const res = computeLayup({ from, rim, side: this.attackSign, skill: this.attr('finishing'), contest });
    const info = {
      shooter: this,
      team: this.team,
      points: 2,
      type: 'layup',
      origin: this.pos.clone(),
      contest,
      timing: null,
      distance: distXZ(this.pos, rim),
      assistFrom: this.world.time - this.lastPassTime < 5 ? this.lastPassFrom : null,
    };
    w.ball.release('shot', res.velocity, this, info);
    w.emit('shotReleased', { player: this, info });
  }

  releaseDunk() {
    const w = this.world;
    this.actionData.released = true;
    const rim = w.attackBasket(this.team);
    const contest = contestLevel(this, w.opponents(this.team), rim);
    const info = {
      shooter: this,
      team: this.team,
      points: 2,
      type: 'dunk',
      origin: this.pos.clone(),
      contest,
      timing: null,
      distance: distXZ(this.pos, rim),
      assistFrom: this.world.time - this.lastPassTime < 5 ? this.lastPassFrom : null,
    };
    const ball = w.ball;
    if (chance(contest * 0.4)) {
      // enterrada falha: bola bate no aro e sobe
      ball.pos.set(rim.x - this.attackSign * 0.3, rim.y + 0.25, rim.z);
      const v = new THREE.Vector3(-this.attackSign * 1.5, 3.5, gauss() * 1.2);
      ball.release('shot', v, this, info);
    } else {
      ball.pos.set(rim.x - this.attackSign * 0.03, rim.y + 0.2, rim.z);
      ball.release('shot', new THREE.Vector3(this.attackSign * 0.1, -4.5, 0), this, info);
      w.emit('dunk', { player: this });
    }
    w.emit('shotReleased', { player: this, info });
  }

  // ------------------------------------------------------------------
  beginPass(target) {
    if (!target) target = this.world.choosePassTarget(this, null);
    if (!target || target === this) return;
    this.setAction('pass', { target, released: false });
    this.heading = headingTo(this.pos, target.pos);
    this.cooldowns.pass = 0.35;
  }

  releasePass() {
    const w = this.world;
    const d = this.actionData;
    d.released = true;
    const tgt = d.target;
    const from = this.ballAnchor.clone();
    const dist = distXZ(this.pos, tgt.pos);
    const speed = 10 + 5 * this.attr('passing');
    let T = clamp(dist / speed, 0.2, 1.3);
    if (dist > 11) T *= 1.25;
    const lead = tgt.vel.clone().setY(0).multiplyScalar(T * 0.9);
    const target = tgt.pos.clone().add(lead);
    target.y = Math.min(1.35 * (tgt.height / 1.95), 1.5);
    const err = ((1 - this.attr('passing')) * 0.5 + ((this.controller && this.controller.passError) || 0) * 0.6) * (0.4 + dist / 12);
    target.x += gauss() * err;
    target.z += gauss() * err;
    target.x = clamp(target.x, -COURT.halfL - 0.2, COURT.halfL + 0.2);
    target.z = clamp(target.z, -COURT.halfW - 0.2, COURT.halfW + 0.2);
    const vel = solveByTime(from, target, T);
    w.ball.release('pass', vel, this, { from: this, target: tgt, time: T, rolled: new Map() });
    w.emit('pass', { from: this, to: tgt });
  }

  forcePassTo(target) {
    if (!this.hasBall || this.action) return;
    this.beginPass(target);
  }

  // ------------------------------------------------------------------
  beginSteal() {
    this.setAction('steal', { resolved: false });
    this.cooldowns.steal = 0.95;
    const h = this.world.ball.holder;
    if (h && h.team !== this.team) this.heading = headingTo(this.pos, h.pos);
  }

  resolveSteal() {
    const w = this.world;
    const h = w.ball.holder;
    this.actionData.resolved = true;
    if (!h || h.team === this.team) return;
    const d = distXZ(this.pos, h.pos);
    if (d > PLAYER.stealRange) return;
    const reachPoint = this.pos.clone().addScaledVector(this.forward, 0.55);
    reachPoint.y = 0.9;
    const bd = reachPoint.distanceTo(w.ball.pos);
    const handle = (h.attr('passing') + h.attr('speed')) / 2;
    let p = 0.08 + 0.26 * this.attr('defense') - 0.22 * (handle - 0.7);
    p *= (this.controller && this.controller.stealSkill) || 1;
    if (bd < 0.75) p += 0.12;
    if (h.action === 'shoot' || h.action === 'pass') p *= 0.5;
    if (h.action === 'dribbleMove') p *= getMove(h.actionData.kind).protect;
    if (chance(p)) {
      const dir = new THREE.Vector3(this.pos.x - h.pos.x, 0, this.pos.z - h.pos.z).normalize();
      const v = dir.multiplyScalar(2.6).add(new THREE.Vector3(gauss() * 0.8, 1.6, gauss() * 0.8));
      w.ball.release('loose', v, this);
      w.ball.ignorePlayer = h;
      w.ball.ignoreUntil = w.ball.time + 0.5;
      h.cooldowns.catch = 0.45;
      w.emit('steal', { player: this, victim: h });
    } else if (d < 1.15 && chance(0.1 * ((this.controller && this.controller.foulRate) || 1))) {
      w.emit('foul', { type: 'reach', fouler: this, victim: h });
    }
  }

  beginJump() {
    const w = this.world;
    const onDefense = w.rules && w.rules.possession !== this.team;
    this.setAction(onDefense ? 'block' : 'jump', {});
    this.vel.y = PLAYER.jumpVel * (0.86 + 0.22 * this.attr('rebound'));
    this.onGround = false;
    this.cooldowns.jump = 0.45;
    this.blockRolled = new Set();
  }

  // Dribles: crossover, finta, por trás das costas, entre as pernas, giro,
  // hesitação e step-back (definidos em DribbleMoves.js)
  beginDribbleMove(kind, side, push = null) {
    const m = getMove(kind);
    const from = this.dribbleHand;
    const to = m.switchHand ? -from : from;
    const dir = side || to;
    // drible encadeado logo após outro aumenta o combo
    this.combo = this.world.time - this.lastMoveEnd < COMBO_WINDOW ? Math.min(this.combo + 1, 4) : 0;
    this.setAction('dribbleMove', { kind, fromHand: from, toHand: to, side: dir, switched: false, burst: false, startHeading: this.heading, combo: this.combo });
    this.cooldowns.dribble = m.cooldown * (1.15 - 0.3 * this.attr('speed'));
    this.energy = Math.max(0, this.energy - m.cost);
    const f = this.forward;
    const r = this.right;
    const handling = 0.85 + 0.3 * (this.attr('passing') + this.attr('speed')) / 2;
    if (push && Math.hypot(push.x, push.z) > 0.1) {
      // direção de saída definida pelo comando (step-back): o atleta fica de frente para o lado oposto
      const l = Math.hypot(push.x, push.z);
      this.heading = Math.atan2(-push.x, -push.z);
      this.vel.x += (push.x / l) * Math.abs(m.forward) * handling;
      this.vel.z += (push.z / l) * Math.abs(m.forward) * handling;
    } else {
      this.vel.addScaledVector(r, dir * m.lateral * handling);
      this.vel.addScaledVector(f, m.forward * handling);
    }
    if (m.hop) {
      this.vel.y = m.hop;
      this.onGround = false;
    }
    this.world.emit('dribbleMove', { player: this, kind, label: m.label, combo: this.combo });
    if (m.ankle > 0.5) this.world.checkAnkleBreaker(this, m.ankle * (1 + 0.3 * this.combo));
  }

  stumble(duration = 0.7) {
    if (this.hasBall) return;
    this.setAction('stumble', { duration });
  }

  celebrate(duration = 1.8) {
    this.setAction('celebrate', { variant: Math.floor(Math.random() * 3), duration });
  }

  onCatch() {
    if (!this.action || this.action === 'jump' || this.action === 'block') {
      if (this.onGround) this.setAction('catch', {});
    }
    this.dribbleHand = 1;
    this.dribblePhase = 0.1;
  }

  // ------------------------------------------------------------------
  updateAction(dt, intent) {
    const d = this.actionData;
    const w = this.world;
    switch (this.action) {
      case 'shoot':
      case 'ft': {
        if (!d.released) {
          if (!this.hasBall) {
            this.clearAction();
            break;
          }
          d.meter += dt / SHOT.meterTime;
          if (!d.ft && !d.jumped && d.meter >= SHOT.jumpAt) {
            d.jumped = true;
            this.vel.y = PLAYER.jumpVel * (0.78 + 0.12 * this.attr('rebound'));
            this.onGround = false;
          }
          if (!intent.shootHeld) {
            if (d.meter < SHOT.pumpFake && !d.jumped) {
              this.clearAction();
              w.emit('pumpFake', { player: this });
            } else this.releaseShot();
          } else if (d.meter >= 1.12) this.releaseShot();
        } else if (this.onGround && this.actionTime > 0.3) this.clearAction();
        break;
      }
      case 'layup':
      case 'dunk': {
        const dunk = this.action === 'dunk';
        const rim = w.attackBasket(this.team);
        if (!d.jumped && this.actionTime >= 0.12) {
          d.jumped = true;
          const vy = dunk ? 4.5 : PLAYER.jumpVel * 1.02;
          const airUp = vy / GRAVITY;
          // alvo de chegada à frente do aro
          const toPlayer = new THREE.Vector3(this.pos.x - rim.x, 0, this.pos.z - rim.z);
          if (toPlayer.lengthSq() < 0.01) toPlayer.set(-this.attackSign, 0, 0);
          toPlayer.normalize();
          // evita passar por baixo / atrás da tabela
          if (toPlayer.x * this.attackSign > -0.25) {
            toPlayer.x = -this.attackSign * 0.6;
            toPlayer.normalize();
          }
          const land = rim.clone().addScaledVector(toPlayer, dunk ? 0.55 : 1.3);
          const hv = new THREE.Vector3(land.x - this.pos.x, 0, land.z - this.pos.z).divideScalar(airUp);
          if (hv.length() > 5.5) hv.setLength(5.5);
          this.vel.x = hv.x;
          this.vel.z = hv.z;
          this.vel.y = vy;
          this.onGround = false;
          this.heading = headingTo(this.pos, rim);
        }
        if (d.jumped && !d.released && this.hasBall && this.vel.y <= (dunk ? 0.5 : 1.0)) {
          if (dunk) this.releaseDunk();
          else this.releaseLayup();
        }
        if (d.jumped && !this.hasBall && !d.released) d.released = true;
        if (d.jumped && this.onGround && this.actionTime > 0.3) this.clearAction();
        break;
      }
      case 'pass':
        if (!d.released && this.actionTime >= 0.1) {
          if (this.hasBall) this.releasePass();
          else d.released = true;
        }
        if (this.actionTime >= 0.3) this.clearAction();
        break;
      case 'steal':
        if (!d.resolved && this.actionTime >= 0.12) this.resolveSteal();
        if (this.actionTime >= 0.4) this.clearAction();
        break;
      case 'jump':
      case 'block':
      case 'tipoff':
        if (this.onGround && this.actionTime > 0.15) this.clearAction();
        break;
      case 'dribbleMove': {
        const m = getMove(d.kind);
        if (!this.hasBall) {
          this.clearAction();
          break;
        }
        if (!d.switched && m.switchAt != null && this.actionTime >= m.switchAt) {
          d.switched = true;
          this.dribbleHand = d.toHand;
        }
        if (d.kind === 'spin') {
          // giro completo: vira de costas para o marcador e volta de frente
          const k = clamp(this.actionTime / m.duration, 0, 1);
          const sm = k * k * (3 - 2 * k);
          this.heading = d.startHeading - d.side * Math.PI * 2 * sm;
        }
        if (m.burstAt != null && !d.burst && this.actionTime >= m.burstAt) {
          // hesitação: freia e explode para frente
          d.burst = true;
          this.burstTime = m.burstTime;
          this.burstMul = m.burstMul;
          this.vel.addScaledVector(this.forward, m.burstPush);
          w.checkAnkleBreaker(this, m.ankle * (1 + 0.3 * (d.combo || 0)));
        }
        if (this.actionTime >= m.duration && this.onGround) {
          if (d.kind === 'spin') this.heading = d.startHeading;
          this.lastMoveEnd = w.time;
          this.clearAction();
        }
        break;
      }
      case 'catch':
        if (this.actionTime >= 0.18) this.clearAction();
        break;
      case 'stumble':
      case 'celebrate':
        if (this.actionTime >= (d.duration || 1)) this.clearAction();
        break;
      default:
        break;
    }
  }

  updateMovement(dt, intent) {
    const w = this.world;
    let maxSpeed = intent.sprint && this.energy > 0.06 ? PLAYER.runSpeed : PLAYER.walkSpeed;
    maxSpeed *= 0.8 + 0.3 * this.attr('speed');
    maxSpeed *= 0.72 + 0.28 * Math.min(1, this.energy * 2.2);
    if (this.hasBall) maxSpeed *= 0.93;
    if (this.controller && this.controller.speedMul) maxSpeed *= this.controller.speedMul;
    if (this.stance === 'defense' && !intent.sprint) maxSpeed *= 0.85;
    if (this.burstTime > 0) {
      this.burstTime -= dt;
      maxSpeed *= this.burstMul;
    }

    let control = 1;
    switch (this.action) {
      case 'shoot':
      case 'ft':
        control = 0;
        break;
      case 'pass':
        control = 0.45;
        break;
      case 'steal':
        control = 0.6;
        break;
      case 'stumble':
        control = 0.2;
        break;
      case 'celebrate':
        control = 0.4;
        break;
      case 'catch':
        control = 0.75;
        break;
      case 'dribbleMove': {
        const m = getMove(this.actionData.kind);
        control = m.burstAt != null && this.actionData.burst ? 1 : m.control;
        break;
      }
      case 'layup':
      case 'dunk':
        control = this.actionData.jumped ? -1 : 0.6;
        break;
      default:
        break;
    }
    if (this.lockMove) control = 0;

    if (this.onGround && control >= 0) {
      const tx = intent.moveX * maxSpeed * control;
      const tz = intent.moveZ * maxSpeed * control;
      const dx = tx - this.vel.x;
      const dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz);
      const speeding = tx * tx + tz * tz > this.vel.x * this.vel.x + this.vel.z * this.vel.z;
      const maxDelta = (speeding ? PLAYER.accel : PLAYER.decel) * dt * w.mods.grip;
      if (dl > maxDelta) {
        this.vel.x += (dx / dl) * maxDelta;
        this.vel.z += (dz / dl) * maxDelta;
      } else {
        this.vel.x = tx;
        this.vel.z = tz;
      }
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    if (!this.onGround) {
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vel.y = 0;
        this.onGround = true;
        w.emit('land', { player: this });
      }
    }

    // limites físicos (arquibancadas)
    this.pos.x = clamp(this.pos.x, -16.2, 16.2);
    this.pos.z = clamp(this.pos.z, -9.2, 8.6);

    // orientação
    let target = null;
    if (intent.face != null) target = intent.face;
    else if (this.action === 'shoot' || this.action === 'ft' || this.action === 'layup' || this.action === 'dunk') {
      target = headingTo(this.pos, w.attackBasket(this.team));
    } else if (Math.hypot(this.vel.x, this.vel.z) > 0.4) target = Math.atan2(this.vel.x, this.vel.z);
    const holdHeading = this.action === 'dribbleMove' && (this.actionData.kind === 'spin' || this.actionData.kind === 'stepback' || this.actionData.kind === 'betweenLegs');
    if (target != null && this.action !== 'pass' && !holdHeading) this.heading = dampAngle(this.heading, target, PLAYER.turnRate, dt);

    const f = this.forward;
    const r = this.right;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.localFwd = this.vel.x * f.x + this.vel.z * f.z;
    this.localSide = this.vel.x * r.x + this.vel.z * r.z;

    // rangido do tênis em mudanças bruscas de direção
    if (this.onGround && this.speed > 2.6) {
      const mx = this.vel.x / this.speed;
      const mz = this.vel.z / this.speed;
      const dot = mx * this.prevMoveDir.x + mz * this.prevMoveDir.y;
      if (dot < 0.55 && w.time - this.lastSqueak > 0.6) {
        this.lastSqueak = w.time;
        w.emit('squeak', { player: this });
      }
      this.prevMoveDir.set(mx, mz);
    }
  }

  updateEnergy(dt, intent) {
    if (intent.sprint && this.speed > 3) {
      this.energy -= dt * 0.07 * (1.35 - this.attr('stamina') * 0.55) * this.world.mods.drain;
    } else {
      this.energy += dt * (this.speed < 1 ? 0.065 : 0.035);
    }
    if (this.action === 'shoot' || this.action === 'dunk') this.energy -= dt * 0.01;
    this.energy = clamp(this.energy, 0, 1);
  }

  computeBallAnchor() {
    const s = this.model.scale;
    const a = this.ballAnchor;
    const f = this.forward;
    const r = this.right;
    const R = this.world.ball.radius;
    const act = this.action;
    if (!act || act === 'catch' || act === 'stumble' || act === 'celebrate' || act === 'jump' || act === 'block') {
      // drible procedural com quique no chão
      const H = 0.9 * s;
      const y = R + (H - R) * Math.abs(Math.cos(Math.PI * this.dribblePhase));
      const fwd = 0.34 * s + 0.12 * Math.min(1, this.speed / 6);
      a.copy(this.pos).addScaledVector(f, fwd).addScaledVector(r, this.dribbleHand * 0.3 * s);
      a.y = y + (this.onGround ? 0 : this.pos.y);
      if (act === 'catch') {
        this.model.joints.rHand.getWorldPosition(this.handPos);
        this.model.joints.lHand.getWorldPosition(this.handPos2);
        const k = 1 - Math.min(1, this.actionTime / 0.18);
        const mid = this.handPos.add(this.handPos2).multiplyScalar(0.5).addScaledVector(f, 0.12);
        a.lerp(mid, k);
      }
    } else if (act === 'dribbleMove') {
      this.dribbleMoveAnchor(a, f, r, s);
    } else if (act === 'pass') {
      this.model.joints.rHand.getWorldPosition(this.handPos);
      this.model.joints.lHand.getWorldPosition(this.handPos2);
      a.copy(this.handPos).add(this.handPos2).multiplyScalar(0.5).addScaledVector(f, 0.1);
    } else {
      // segurando para arremesso / bandeja / enterrada
      this.model.joints.rHand.getWorldPosition(this.handPos);
      a.copy(this.handPos).addScaledVector(UP, 0.1).addScaledVector(f, 0.03);
    }
  }

  // Trajetória da bola durante cada drible
  dribbleMoveAnchor(a, f, r, s) {
    const d = this.actionData;
    const m = getMove(d.kind);
    const lift = this.onGround ? 0 : this.pos.y;
    const from = d.fromHand;
    const to = d.toHand;
    const smooth = (k) => k * k * (3 - 2 * k);
    switch (d.kind) {
      case 'crossover': {
        const k = clamp(this.actionTime / (m.switchAt * 2), 0, 1);
        const lat = from + (to - from) * smooth(k);
        a.copy(this.pos).addScaledVector(f, 0.42 * s).addScaledVector(r, lat * 0.32 * s);
        a.y = 0.2 + 0.58 * s * Math.abs(Math.cos(Math.PI * k));
        break;
      }
      case 'inOut': {
        // leva a bola para o meio e volta para a mesma mão
        const k = clamp(this.actionTime / m.duration, 0, 1);
        const lat = from * (1 - 0.85 * Math.sin(Math.PI * k));
        a.copy(this.pos).addScaledVector(f, 0.4 * s).addScaledVector(r, lat * 0.32 * s);
        a.y = 0.25 + 0.6 * s * Math.abs(Math.cos(Math.PI * k * 2));
        break;
      }
      case 'behindBack': {
        // bola passa por trás do quadril
        const k = clamp(this.actionTime / (m.switchAt * 1.8), 0, 1);
        const lat = from + (to - from) * smooth(k);
        const back = Math.sin(Math.PI * k);
        a.copy(this.pos).addScaledVector(f, (0.3 - 0.62 * back) * s).addScaledVector(r, lat * 0.34 * s);
        a.y = (0.55 + 0.15 * back) * s;
        break;
      }
      case 'betweenLegs': {
        // quique entre as pernas, com o pé da frente avançado
        const k = clamp(this.actionTime / (m.switchAt * 2), 0, 1);
        const lat = from + (to - from) * smooth(k);
        a.copy(this.pos).addScaledVector(f, (0.2 - 0.1 * Math.sin(Math.PI * k)) * s).addScaledVector(r, lat * 0.3 * s);
        a.y = 0.14 + 0.62 * s * Math.abs(Math.cos(Math.PI * k));
        break;
      }
      case 'spin': {
        // bola presa na palma, girando junto com o corpo
        const k = clamp(this.actionTime / m.duration, 0, 1);
        const hand = k < m.switchAt / m.duration ? from : to;
        a.copy(this.pos).addScaledVector(f, 0.22 * s).addScaledVector(r, hand * 0.38 * s);
        a.y = (0.85 - 0.2 * Math.sin(Math.PI * k)) * s;
        break;
      }
      case 'hesitation': {
        // bola alta no "bolso" e depois quique forte na arrancada
        const k = clamp(this.actionTime / m.duration, 0, 1);
        const high = k < m.burstAt / m.duration;
        a.copy(this.pos).addScaledVector(f, (high ? 0.3 : 0.45) * s).addScaledVector(r, from * 0.3 * s);
        a.y = high ? (0.85 + 0.12 * Math.sin(k * 20)) * s : 0.2 + 0.7 * s * Math.abs(Math.cos(Math.PI * (k - 0.5) * 2));
        break;
      }
      case 'stepback':
      default: {
        const k = clamp(this.actionTime / m.duration, 0, 1);
        a.copy(this.pos).addScaledVector(f, 0.3 * s).addScaledVector(r, from * 0.22 * s);
        a.y = (0.75 - 0.25 * Math.sin(Math.PI * k)) * s;
        break;
      }
    }
    a.y += lift;
  }

  setMarker(visible, color) {
    this.marker.visible = visible;
    if (color) this.marker.material.color.set(color);
  }

  dispose() {
    this.model.dispose();
    for (const m of [this.ring, this.marker]) {
      if (m.parent) m.parent.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

