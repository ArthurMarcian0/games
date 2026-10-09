import * as THREE from 'three';
import { COURT, SHOT, PLAYER } from '../config/Constants.js';
import { clamp, distXZ, headingTo, gauss, chance, rand, pick, distPointSegmentXZ } from '../core/MathUtils.js';
import { isThreePoint } from '../physics/ShotCalculator.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function blankIntent() {
  return {
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
    contest: false,
  };
}

/**
 * Controlador de IA de um jogador. Gera "intenções" a partir do estado do
 * jogo, com tempo de reação, erros de posicionamento e decisões imperfeitas
 * definidos pelo perfil de dificuldade.
 */
export class AIController {
  constructor(teamAI, profile) {
    this.teamAI = teamAI;
    this.profile = profile;
    this.intent = blankIntent();
    this.decisionTimer = Math.random() * profile.reaction;
    this.moveTarget = new THREE.Vector3();
    this.hasMoveTarget = false;
    this.shootPlan = null;
    this.holdTime = 0;
    this.cutTimer = 0;
    this.posError = new THREE.Vector2();
    this.driveSide = Math.random() < 0.5 ? -1 : 1;
    this.mode = 'drive';
    this.modeTimer = 0;
    this.sprintWant = false;
  }

  get isHuman() {
    return false;
  }
  get speedMul() {
    return this.profile.speed;
  }
  get shotSigma() {
    return this.profile.shotSigma;
  }
  get passError() {
    return this.profile.passError;
  }
  get stealSkill() {
    return this.profile.stealSkill;
  }
  get foulRate() {
    return this.profile.foulRate;
  }
  get interceptSkill() {
    return this.profile.interceptSkill;
  }

  getIntent(p, dt) {
    const I = this.intent;
    I.moveX = 0;
    I.moveZ = 0;
    I.sprint = false;
    I.pass = false;
    I.passTarget = null;
    I.steal = false;
    I.jump = false;
    I.dribbleMove = null;
    I.face = null;
    I.contest = false;

    const w = p.world;
    const rules = w.rules;
    const ball = w.ball;
    this.decisionTimer -= dt;
    const decide = this.decisionTimer <= 0;
    if (decide) this.decisionTimer = this.profile.reaction * rand(0.7, 1.3);
    p.stance = 'normal';

    // Plano de arremesso em andamento: segura até o ponto escolhido da barra
    if (this.shootPlan) {
      if ((p.action === 'shoot' || p.action === 'ft') && !p.actionData.released) {
        I.shootHeld = p.actionData.meter < this.shootPlan.target;
        return I;
      }
      this.shootPlan.frames++;
      if (p.action || this.shootPlan.frames > 2) this.shootPlan = null;
      I.shootHeld = false;
      return I;
    }
    I.shootHeld = false;

    if (!rules) return I;
    if (rules.phase === 'freethrow') {
      if (rules.isFreeThrowShooter(p) && p.hasBall && !p.action && rules.ftReady()) {
        if (this.ftWait == null) this.ftWait = rand(0.6, 1.4);
        this.ftWait -= dt;
        if (this.ftWait <= 0) {
          this.ftWait = null;
          this.startShot(p, true);
        }
      }
      return I;
    }
    if (rules.phase !== 'live') {
      if (p.scriptTarget) this.moveTo(p, p.scriptTarget, 99, 0.4);
      return I;
    }
    if (p.lockMove) return I;

    if (p.hasBall) {
      this.holdTime += dt;
      this.handler(p, decide, dt);
    } else {
      this.holdTime = 0;
      const offense = this.teamAI.isOffense();
      if (ball.state === 'pass' && ball.passInfo && ball.passInfo.target === p) this.receive(p);
      else if (this.teamAI.chasers.has(p) && !ball.holder) this.chase(p, decide);
      else if (offense) this.offBall(p, decide, dt);
      else this.defend(p, decide);
    }
    return I;
  }

  // ---------------------------------------------------------------
  moveTo(p, target, sprintDist = 3, arrive = 0.35) {
    const I = this.intent;
    const tx = clamp(target.x, -COURT.halfL + 0.45, COURT.halfL - 0.45);
    const tz = clamp(target.z, -COURT.halfW + 0.45, COURT.halfW - 0.45);
    const dx = tx - p.pos.x;
    const dz = tz - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) return d;
    const m = Math.min(1, d / 1.2);
    I.moveX = (dx / d) * m;
    I.moveZ = (dz / d) * m;
    I.sprint = d > sprintDist && p.energy > 0.15;
    return d;
  }

  startShot(p, ft = false) {
    const target = SHOT.sweetSpot + gauss() * this.profile.shotTiming * (ft ? 0.8 : 1);
    this.shootPlan = { target: clamp(target, SHOT.pumpFake + 0.08, 1.08), frames: 0 };
    this.intent.shootHeld = true;
  }

  estimateShot(p, pos = p.pos, defDist = null) {
    const w = p.world;
    const basket = w.attackBasket(p.team);
    const d = distXZ(pos, basket);
    const three = isThreePoint(pos, w.attackSign(p.team));
    const nd = defDist == null ? w.nearestOpponentDist(p, pos) : defDist;
    let prob;
    if (d < 1.9) prob = 0.62 + 0.25 * p.attr('finishing');
    else if (d < 3.2) prob = 0.42 + 0.2 * p.attr('finishing');
    else if (!three) prob = 0.36 + 0.35 * (p.attr('shooting') - 0.6) - (d - 3.2) * 0.02;
    else prob = 0.3 + 0.5 * (p.attr('three') - 0.6) - Math.max(0, d - 7.4) * 0.09;
    const contest = clamp(1 - (nd - 0.7) / 2.3, 0, 1);
    prob *= 1 - 0.6 * contest;
    prob = clamp(prob, 0.02, 0.95);
    return { prob, value: prob * (three ? 3 : 2), d, three, nd };
  }

  bestPass(p) {
    const w = p.world;
    let best = null;
    let bestV = -1;
    for (const m of w.teammates(p)) {
      if (w.passLaneBlocked(p, m)) continue;
      const est = this.estimateShot(m, m.pos);
      let v = est.value;
      if (distXZ(m.pos, p.pos) > 13) v -= 0.4;
      if (v > bestV) {
        bestV = v;
        best = m;
      }
    }
    return best ? { target: best, value: bestV } : null;
  }

  // ---------------------------------------------------------------
  handler(p, decide, dt) {
    const I = this.intent;
    const w = p.world;
    const rules = w.rules;
    const s = w.attackSign(p.team);
    const basket = w.attackBasket(p.team);
    if (this.stepbackShot != null) {
      // logo após o step-back, arremessa no espaço criado
      this.stepbackShot -= dt;
      if (p.action === 'dribbleMove' && p.actionData.kind === 'stepback') return;
      const st = this.stepbackShot;
      this.stepbackShot = null;
      if (!p.action && st > -0.3 && chance(0.8)) {
        this.startShot(p);
        return;
      }
    }
    if (p.action) return;
    const est = this.estimateShot(p);
    const inBackcourt = p.pos.x * s < -0.3;
    const prof = this.profile;
    this.modeTimer -= dt;

    if (decide) {
      const sc = rules.shotClock != null ? rules.shotClock : 99;
      const gameClock = rules.clock != null ? rules.clock : 99;
      const urgent = (sc < 3.2 || gameClock < 2.5) && !rules.training;
      const urgency = clamp((14 - sc) / 14, 0, 1);
      const shooterBonus = this.mode === 'probe' ? Math.max(0, p.attr('three') - 0.72) * 0.7 : 0;
      const threshold = 0.8 - urgency * 0.35 - shooterBonus + (1 - prof.decision) * gauss() * 0.3;

      if (urgent && est.d < 13) {
        this.startShot(p);
        return;
      }
      if (est.d < SHOT.layupRange + 0.2 && (est.nd > 1.0 || chance(0.45))) {
        // enterrada só com caminho livre e alguma chance
        I.sprint = est.d < SHOT.dunkRange && p.canDunk() && est.nd > 1.2 && chance(0.45);
        this.startShot(p);
        return;
      }
      if (!inBackcourt && est.value > threshold && this.holdTime > 0.5 && chance(0.55 + 0.4 * prof.decision)) {
        this.startShot(p);
        return;
      }
      // erro de decisão ocasional
      if (!inBackcourt && chance((1 - prof.decision) * 0.07) && this.holdTime > 1) {
        if (chance(0.5) && est.d < 9) this.startShot(p);
        else {
          const mates = w.teammates(p);
          if (mates.length) {
            I.pass = true;
            I.passTarget = pick(mates);
          }
        }
        return;
      }
      if (this.holdTime > 0.6) {
        const bp = this.bestPass(p);
        if (bp) {
          const better = bp.value > est.value + 0.25 && this.holdTime > 0.9;
          const pressured = est.nd < 1.0 && chance(0.35);
          const stale = this.holdTime > 4.5;
          if ((better && chance(0.35 + 0.4 * prof.decision)) || pressured || stale) {
            I.pass = true;
            I.passTarget = bp.target;
            return;
          }
        }
      }
      // escolha de movimento
      if (this.modeTimer <= 0) {
        this.modeTimer = rand(1.2, 2.6);
        this.mode = chance(0.45) ? 'drive' : 'probe';
        this.driveSide = chance(0.5) ? -1 : 1;
      }
      // drible especial quando o marcador está colado à frente
      const nearest = this.nearestDefender(p);
      if (nearest && nearest.d < 1.6 && chance(0.18 + 0.15 * prof.decision)) I.dribbleMove = this.pickDribble(p, nearest, est);
    }

    // movimento contínuo
    const target = tmp;
    if (inBackcourt) {
      target.set(s * 5, 0, clamp(p.pos.z * 0.6, -4, 4));
      this.moveTo(p, target, 2, 0.5);
      I.sprint = I.sprint || est.nd > 2.5;
      return;
    }
    const nd = this.nearestDefender(p);
    const nearBaseline = Math.abs(p.pos.x) > COURT.halfL - 1.6 && est.d > 2.2;
    if (this.mode === 'drive' && !nearBaseline) {
      const dx = basket.x - s * 0.9 - p.pos.x;
      const dz = clamp(p.pos.z * 0.4, -1.2, 1.2) - p.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      if (nd && nd.front && nd.d < 1.7) {
        // contorna o marcador mantendo a direção da cesta
        const px = -dz / dl;
        const pz = dx / dl;
        const lat = (nd.o.pos.x - p.pos.x) * px + (nd.o.pos.z - p.pos.z) * pz;
        const side = lat > 0 ? -1 : 1;
        target.set(p.pos.x + (dx / dl) * 1.6 + px * side * 1.7, 0, p.pos.z + (dz / dl) * 1.6 + pz * side * 1.7);
      } else {
        target.set(p.pos.x + dx, 0, p.pos.z + dz);
      }
      this.moveTo(p, target, 1.6, 0.3);
      I.sprint = I.sprint || !nd || nd.d > 1.4 || chance(0.02);
    } else {
      // circula pelo perímetro procurando espaço
      const ang = this.driveSide * (0.5 + 0.55 * Math.sin(w.time * 0.7 + p.index));
      target.set(basket.x - s * Math.cos(ang) * 7.0, 0, Math.sin(ang) * 5.8);
      this.moveTo(p, target, 5, 0.6);
    }
  }

  // Escolhe um drible variado: step-back para criar espaço de arremesso,
  // giro/crossover para passar pelo marcador, hesitação para arrancar
  pickDribble(p, nearest, est) {
    const o = nearest.o;
    const r = p.right;
    const lat = (o.pos.x - p.pos.x) * r.x + (o.pos.z - p.pos.z) * r.z;
    const away = lat > 0 ? -1 : 1; // lado oposto ao marcador
    const hand = p.dribbleHand;
    const shooter = Math.max(p.attr('three'), p.attr('shooting'));
    if (est.d > 4.5 && est.d < 8.4 && shooter > 0.78 && chance(0.4)) {
      this.stepbackShot = 0.55;
      return { kind: 'stepback', side: hand };
    }
    const options = [
      ['crossover', 3],
      ['behindBack', 1.5],
      ['betweenLegs', 1.2],
      ['spin', est.d < 6 ? 1.6 : 0.6],
      ['hesitation', 1.6],
      ['inOut', 1],
    ];
    const total = options.reduce((a, b) => a + b[1], 0);
    let x = Math.random() * total;
    let kind = 'crossover';
    for (const [k, wgt] of options) {
      if ((x -= wgt) <= 0) {
        kind = k;
        break;
      }
    }
    if (kind === 'crossover' || kind === 'behindBack') {
      if (away === hand) kind = 'inOut';
    }
    return { kind, side: kind === 'betweenLegs' ? -hand : kind === 'hesitation' ? hand : away };
  }

  nearestDefender(p) {
    const w = p.world;
    let best = null;
    const basket = w.attackBasket(p.team);
    for (const o of w.opponents(p.team)) {
      const d = distXZ(o.pos, p.pos);
      if (!best || d < best.d) {
        const bx = basket.x - p.pos.x;
        const bz = basket.z - p.pos.z;
        const bl = Math.hypot(bx, bz) || 1;
        const front = ((o.pos.x - p.pos.x) * bx + (o.pos.z - p.pos.z) * bz) / (bl * (d || 1)) > 0.3;
        best = { o, d, front };
      }
    }
    return best;
  }

  receive(p) {
    const ball = p.world.ball;
    this.intent.face = headingTo(p.pos, ball.pos);
    // dá um passo em direção à bola
    tmp.copy(ball.pos);
    if (distXZ(tmp, p.pos) < 3) this.moveTo(p, tmp, 99, 0.6);
  }

  chase(p, decide) {
    const ball = p.world.ball;
    const landing = this.teamAI.landing;
    const target = ball.pos.y < 1.6 ? ball.pos : landing;
    this.moveTo(p, target, 1.2, 0.15);
    const dxz = distXZ(ball.pos, p.pos);
    if (decide && dxz < 1.4 && ball.pos.y > 2.0 && ball.pos.y < 3.5 && ball.vel.y < 0.5 && chance(0.6)) this.intent.jump = true;
  }

  offBall(p, decide, dt) {
    const I = this.intent;
    const w = p.world;
    const ball = w.ball;
    const s = w.attackSign(p.team);
    const basket = w.attackBasket(p.team);
    const target = tmp;

    if (ball.state === 'shot' || (ball.state === 'loose' && !ball.holder)) {
      // ataca o rebote (pivôs) ou recompõe (armadores)
      if (p.archetype === 'big' || p.index % 3 === 1) target.set(basket.x - s * 2.2, 0, (p.index % 2 ? 1 : -1) * 1.4);
      else target.set(basket.x - s * 8.5, 0, (p.index % 2 ? 1 : -1) * 3);
      this.moveTo(p, target, 3);
      return;
    }

    this.teamAI.spotFor(p, target);
    const man = this.myDefender(p);
    if (this.cutTimer > 0) {
      this.cutTimer -= dt;
      target.set(basket.x - s * 1.6, 0, p.pos.z > 0 ? 0.8 : -0.8);
    } else if (decide && man && distXZ(man.pos, p.pos) < 1.1 && chance(0.12 + 0.1 * this.profile.decision)) {
      this.cutTimer = 1.6;
    }
    const holder = ball.holder;
    const transition = holder && holder.pos.x * s < 0;
    const d = this.moveTo(p, target, transition ? 2 : 4.5, 0.5);
    if (d < 1.5 && holder) I.face = headingTo(p.pos, holder.pos);
  }

  myDefender(p) {
    let best = null;
    let bd = Infinity;
    for (const o of p.world.opponents(p.team)) {
      const d = distXZ(o.pos, p.pos);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  defend(p, decide) {
    const I = this.intent;
    const w = p.world;
    const ball = w.ball;
    const prof = this.profile;
    const defB = w.defendBasket(p.team);
    const man = this.teamAI.manFor(p);
    const target = tmp;

    if (decide) this.posError.set(gauss() * prof.positionError * 0.5, gauss() * prof.positionError * 0.5);

    if (!man) {
      target.set(defB.x * 0.8, 0, 0);
      this.moveTo(p, target, 3);
      return;
    }

    if (ball.state === 'shot' || (ball.state === 'loose' && !ball.holder)) {
      // bloqueio de rebote: entre o adversário e a cesta
      tmp2.set(man.pos.x - defB.x, 0, man.pos.z - defB.z);
      const md = tmp2.length() || 1;
      target.copy(defB).addScaledVector(tmp2, Math.min(2.3, md * 0.6) / md);
      target.y = 0;
      this.moveTo(p, target, 2.5, 0.25);
      I.face = headingTo(p.pos, man.pos);
      const dxz = distXZ(ball.pos, p.pos);
      if (decide && dxz < 1.5 && ball.pos.y > 2.1 && ball.pos.y < 3.6 && ball.vel.y < 0.5 && chance(0.55)) I.jump = true;
      return;
    }

    const holder = ball.holder;
    const isOnBall = holder === man;
    const anticipate = 0.1 + 0.25 * (1 - prof.positionError);
    const ax = man.pos.x + man.vel.x * anticipate;
    const az = man.pos.z + man.vel.z * anticipate;
    tmp2.set(defB.x - ax, 0, defB.z - az);
    const manToBasket = tmp2.length() || 1;
    tmp2.divideScalar(manToBasket);
    let gap = isOnBall ? prof.defenseGap * 0.72 : prof.defenseGap + clamp(distXZ(man.pos, ball.pos) * 0.15, 0, 2.0);
    gap = Math.min(gap, manToBasket * 0.6);
    target.set(ax + tmp2.x * gap, 0, az + tmp2.z * gap);
    if (!isOnBall && holder) {
      // ajuda: aproxima-se da linha bola-cesta
      target.x += (holder.pos.x - target.x) * 0.12;
      target.z += (holder.pos.z - target.z) * 0.12;
    }
    if (manToBasket > 15.5) {
      // espera na meia quadra em vez de pressionar a quadra toda
      tmp2.set(ax - defB.x, 0, az - defB.z).normalize();
      target.copy(defB).addScaledVector(tmp2, 12.8);
      target.y = 0;
    }
    target.x += this.posError.x;
    target.z += this.posError.y;
    const dist = this.moveTo(p, target, 2.4, 0.18);
    if (dist < 2.6) {
      p.stance = 'defense';
      I.sprint = I.sprint && dist > 2.0;
      I.face = headingTo(p.pos, man.pos);
    }

    const md = distXZ(p.pos, man.pos);
    if (isOnBall) {
      const shooting = (man.action === 'shoot' || man.action === 'ft') && !man.actionData.released;
      if (shooting && md < prof.contestDist + 0.4) {
        I.contest = true;
        this.moveTo(p, man.pos, 99, 0.85);
        if (decide && man.actionTime > 0.12 && chance(prof.blockRate)) I.jump = true;
      } else if ((man.action === 'layup' || man.action === 'dunk') && md < 2.4) {
        if (decide && chance(prof.blockRate)) I.jump = true;
        this.moveTo(p, man.pos, 99, 0.6);
      } else if (decide && !man.action && md < PLAYER.stealRange - 0.1 && chance(prof.stealRate)) {
        I.steal = true;
      }
    } else if (ball.state === 'pass' && ball.passInfo && decide) {
      // tenta cortar a linha de passe
      const tgt = ball.passInfo.target;
      const r = distPointSegmentXZ(p.pos, ball.pos, tgt.pos);
      if (r.dist < 1.8 && chance(prof.interceptSkill * 0.45)) {
        target.set(ball.pos.x + (tgt.pos.x - ball.pos.x) * Math.max(r.t, 0.4), 0, ball.pos.z + (tgt.pos.z - ball.pos.z) * Math.max(r.t, 0.4));
        this.moveTo(p, target, 0, 0.1);
        I.sprint = true;
      }
    }
  }
}
