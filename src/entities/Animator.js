import { clamp, damp } from '../core/MathUtils.js';

// Animação procedural por poses. A cada quadro calcula uma pose-alvo a partir
// do estado do personagem e interpola suavemente as articulações.
const KEYS = [
  'rootY', 'hipsPitch', 'hipsYaw', 'hipsRoll',
  'spinePitch', 'spineYaw', 'spineRoll',
  'headPitch', 'headYaw',
  'lShX', 'lShZ', 'lElX', 'lHandX',
  'rShX', 'rShZ', 'rElX', 'rHandX',
  'lLegX', 'lLegZ', 'lKneeX', 'lFootX',
  'rLegX', 'rLegZ', 'rKneeX', 'rFootX',
];

function emptyPose() {
  const p = {};
  for (const k of KEYS) p[k] = 0;
  return p;
}

export class Animator {
  constructor(model) {
    this.model = model;
    this.current = emptyPose();
    this.target = emptyPose();
    this.phase = Math.random() * 6;
    this.time = Math.random() * 10;
    this.rate = 14;
  }

  update(dt, s) {
    this.time += dt;
    const T = this.target;
    for (const k of KEYS) T[k] = 0;
    this.rate = 14;

    const speed = s.speed || 0;
    const move = clamp(speed / 1.2, 0, 1);
    const run = clamp((speed - 2.2) / 3.6, 0, 1);
    if (speed > 0.15) this.phase += dt * (4.6 + speed * 0.85);
    const p = this.phase;

    // ---------- Locomoção base ----------
    const legA = (0.32 + 0.42 * run) * move;
    const kneeA = (0.35 + 1.0 * run) * move;
    T.lLegX = -Math.sin(p) * legA - 0.05;
    T.rLegX = Math.sin(p) * legA - 0.05;
    T.lKneeX = 0.12 + kneeA * Math.max(0, Math.cos(p));
    T.rKneeX = 0.12 + kneeA * Math.max(0, -Math.cos(p));
    const armA = (0.3 + 0.5 * run) * move;
    T.lShX = Math.sin(p) * armA;
    T.rShX = -Math.sin(p) * armA;
    T.lShZ = 0.1;
    T.rShZ = -0.1;
    T.lElX = -0.25 - 1.0 * run;
    T.rElX = -0.25 - 1.0 * run;
    T.spinePitch = 0.04 + 0.2 * run + Math.sin(this.time * 1.8) * 0.012 * (1 - move);
    T.hipsYaw = Math.sin(p) * 0.12 * move;
    T.spineYaw = -Math.sin(p) * 0.1 * move;
    T.rootY = -0.02 + run * (0.04 * Math.abs(Math.sin(p)) - 0.05) - 0.015 * move;

    // ---------- Postura de defesa ----------
    if (s.stance === 'defense' && !s.hasBall && !s.action) {
      const side = s.localSide || 0;
      const shuffle = clamp(Math.abs(side) / 3, 0, 1);
      T.rootY = -0.17 + Math.abs(Math.sin(p)) * 0.03 * shuffle;
      T.spinePitch = 0.35;
      T.headPitch = -0.3;
      T.lLegX = -0.4 + Math.sin(p) * 0.15 * (1 - shuffle) * move;
      T.rLegX = -0.4 - Math.sin(p) * 0.15 * (1 - shuffle) * move;
      T.lLegZ = 0.22 + Math.max(0, Math.sin(p)) * 0.18 * shuffle;
      T.rLegZ = -0.22 - Math.max(0, -Math.sin(p)) * 0.18 * shuffle;
      T.lKneeX = 0.85;
      T.rKneeX = 0.85;
      T.lShX = -0.5;
      T.rShX = -0.5;
      T.lShZ = 1.05 + Math.sin(this.time * 3) * 0.05;
      T.rShZ = -1.05 - Math.sin(this.time * 3 + 1) * 0.05;
      T.lElX = -0.7;
      T.rElX = -0.7;
      T.hipsYaw = 0;
      T.spineYaw = 0;
      if (s.contesting) {
        T.rShX = -2.8;
        T.rShZ = -0.15;
        T.rElX = -0.1;
      }
    }

    // ---------- Drible ----------
    if (s.hasBall && !s.action) {
      const dp = s.dribblePhase || 0;
      const hand = s.dribbleHand || 1; // 1 = direita
      const push = 1 - Math.abs(Math.cos(Math.PI * dp));
      const D = hand > 0 ? 'r' : 'l';
      const O = hand > 0 ? 'l' : 'r';
      const sz = hand > 0 ? -1 : 1;
      T[D + 'ShX'] = -0.45 - 0.1 * run;
      T[D + 'ShZ'] = sz * 0.28;
      T[D + 'ElX'] = -1.05 + 0.6 * push;
      T[D + 'HandX'] = -0.3 + 0.7 * push;
      T[O + 'ShX'] = -0.65;
      T[O + 'ShZ'] = -sz * 0.45;
      T[O + 'ElX'] = -1.1;
      T.spinePitch += 0.12;
      T.rootY -= 0.06;
      T.lKneeX += 0.2;
      T.rKneeX += 0.2;
      T.spineRoll = sz * 0.05;
    }

    // ---------- Ações ----------
    const t = s.actionTime || 0;
    const air = !s.onGround;
    switch (s.action) {
      case 'shoot':
      case 'ft': {
        this.rate = 18;
        const d = s.actionData || {};
        if (!d.released) {
          const crouch = d.jumped ? 0 : clamp((d.meter || 0) / 0.42, 0, 1);
          T.rootY = -0.13 * crouch;
          T.lKneeX = 0.75 * crouch + (air ? 0.35 : 0.1);
          T.rKneeX = 0.75 * crouch + (air ? 0.35 : 0.1);
          T.lLegX = -0.35 * crouch - (air ? 0.15 : 0);
          T.rLegX = -0.35 * crouch - (air ? 0.15 : 0);
          T.lFootX = air ? 0.4 : 0;
          T.rFootX = air ? 0.4 : 0;
          T.spinePitch = 0.12 * crouch - 0.04;
          T.rShX = -1.95;
          T.rShZ = -0.12;
          T.rElX = -1.25;
          T.rHandX = -0.9;
          T.lShX = -1.85;
          T.lShZ = 0.38;
          T.lElX = -1.2;
          T.headPitch = -0.15;
        } else {
          T.rShX = -2.75;
          T.rShZ = -0.08;
          T.rElX = -0.06;
          T.rHandX = 1.1;
          T.lShX = -2.2;
          T.lShZ = 0.4;
          T.lElX = -0.5;
          T.lKneeX = air ? 0.25 : 0.2;
          T.rKneeX = air ? 0.25 : 0.2;
          T.lFootX = air ? 0.45 : 0;
          T.rFootX = air ? 0.45 : 0;
          T.headPitch = -0.2;
        }
        T.hipsYaw = 0;
        T.spineYaw = 0;
        break;
      }
      case 'layup':
      case 'dunk': {
        this.rate = 16;
        const d = s.actionData || {};
        const dunk = s.action === 'dunk';
        T.lLegX = air ? -1.35 : -0.5;
        T.lKneeX = air ? 1.6 : 0.6;
        T.rLegX = air ? 0.25 : -0.2;
        T.rKneeX = air ? 0.35 : 0.4;
        T.lFootX = 0.3;
        T.rFootX = 0.5;
        if (!d.released) {
          T.rShX = dunk ? -3.05 : -2.6;
          T.rShZ = -0.1;
          T.rElX = dunk ? -1.1 : -0.5;
          T.rHandX = -0.4;
          T.lShX = air ? -1.2 : -1.6;
          T.lShZ = 0.55;
          T.lElX = -0.9;
        } else {
          T.rShX = dunk ? -1.7 : -2.9;
          T.rElX = dunk ? -0.2 : -0.1;
          T.rHandX = 0.9;
          T.lShX = -1.0;
          T.lShZ = 0.7;
          T.lElX = -0.5;
        }
        T.spinePitch = -0.08;
        T.headPitch = -0.3;
        T.hipsYaw = 0;
        T.spineYaw = 0;
        break;
      }
      case 'pass': {
        this.rate = 24;
        const k = clamp((t - 0.04) / 0.12, 0, 1);
        T.rShX = -1.25 - 0.3 * k;
        T.lShX = -1.25 - 0.3 * k;
        T.rShZ = -0.35 + 0.25 * k;
        T.lShZ = 0.35 - 0.25 * k;
        T.rElX = -1.8 + 1.7 * k;
        T.lElX = -1.8 + 1.7 * k;
        T.rHandX = 0.6 * k;
        T.lHandX = 0.6 * k;
        T.spinePitch = 0.12 + 0.12 * k;
        T.lLegX = -0.45 * k;
        T.lKneeX = 0.3;
        break;
      }
      case 'steal': {
        this.rate = 26;
        const k = clamp(t / 0.12, 0, 1);
        T.rShX = -1.0 - 0.5 * k;
        T.rShZ = -0.1;
        T.rElX = -0.1;
        T.lShX = 0.4;
        T.lShZ = 0.4;
        T.lElX = -0.5;
        T.spinePitch = 0.5 * k;
        T.rootY = -0.14;
        T.rLegX = -0.8 * k;
        T.rKneeX = 0.9;
        T.lKneeX = 0.5;
        break;
      }
      case 'block':
      case 'jump': {
        this.rate = 18;
        const up = s.action === 'block' ? -2.95 : -2.7;
        T.lShX = up;
        T.rShX = up;
        T.lShZ = 0.18;
        T.rShZ = -0.18;
        T.lElX = -0.15;
        T.rElX = -0.15;
        T.lKneeX = air ? 0.45 : 0.8;
        T.rKneeX = air ? 0.55 : 0.8;
        T.lLegX = air ? -0.15 : -0.4;
        T.rLegX = air ? -0.1 : -0.4;
        T.lFootX = 0.4;
        T.rFootX = 0.4;
        T.rootY = air ? 0 : -0.12;
        T.headPitch = -0.35;
        break;
      }
      case 'catch': {
        this.rate = 22;
        T.rShX = -1.3;
        T.lShX = -1.3;
        T.rElX = -0.7;
        T.lElX = -0.7;
        T.rShZ = -0.2;
        T.lShZ = 0.2;
        break;
      }
      case 'dribbleMove':
        this.dribbleMovePose(T, s, t);
        break;
      case 'stumble': {
        this.rate = 12;
        T.spineRoll = Math.sin(t * 9) * 0.25;
        T.spinePitch = -0.2;
        T.lShZ = 1.4;
        T.rShZ = -1.3;
        T.lShX = -0.6;
        T.rKneeX = 0.6;
        T.rootY = -0.12;
        T.headPitch = 0.2;
        break;
      }
      case 'celebrate': {
        this.rate = 12;
        const v = (s.actionData && s.actionData.variant) || 0;
        const w = Math.sin(this.time * 11);
        if (v === 0) {
          T.lShX = -2.8 + w * 0.25;
          T.rShX = -2.8 - w * 0.25;
          T.lShZ = 0.4;
          T.rShZ = -0.4;
          T.lElX = -0.9;
          T.rElX = -0.9;
          T.headPitch = -0.3;
        } else if (v === 1) {
          T.lShZ = 1.5;
          T.rShZ = -1.5;
          T.lShX = -0.1;
          T.rShX = -0.1;
          T.spineRoll = Math.sin(this.time * 4) * 0.2;
          T.spinePitch = 0.15;
        } else {
          T.rShX = -1.2 + Math.max(0, w) * 0.3;
          T.rShZ = -0.6;
          T.rElX = -2.2;
          T.lShX = -2.9;
          T.lShZ = 0.2;
          T.lElX = -0.3;
          T.headPitch = -0.2;
        }
        if (s.speed < 0.5) {
          T.lKneeX = 0.25 + Math.max(0, w) * 0.2;
          T.rKneeX = 0.25 + Math.max(0, w) * 0.2;
        }
        break;
      }
      case 'tipoff': {
        T.lShX = air ? -3.0 : -0.6;
        T.rShX = air ? -3.0 : -0.6;
        T.lElX = -0.2;
        T.rElX = -0.2;
        T.rootY = air ? 0 : -0.15;
        T.lKneeX = air ? 0.3 : 0.8;
        T.rKneeX = air ? 0.3 : 0.8;
        break;
      }
      default:
        if (air) {
          T.lKneeX = 0.5;
          T.rKneeX = 0.4;
          T.lShX = -1.2;
          T.rShX = -1.2;
        }
    }

    // Interpolação suave
    const C = this.current;
    const rate = this.rate;
    for (const k of KEYS) C[k] = damp(C[k], T[k], rate, dt);
    this.apply();
  }

  // Poses dos dribles (o atleta é visto de frente: x > 0 = esquerda dele)
  dribbleMovePose(T, s, t) {
    const d = s.actionData || {};
    const kind = d.kind || 'crossover';
    const from = d.fromHand || 1;
    const to = d.toHand || -from;
    const air = !s.onGround;
    const hand = (h) => (h > 0 ? 'r' : 'l');
    const zs = (h) => (h > 0 ? -1 : 1); // sinal de abertura do ombro
    const low = () => {
      T.rootY = -0.16;
      T.spinePitch = 0.35;
      T.lKneeX = 0.85;
      T.rKneeX = 0.85;
      T.lLegX = -0.35;
      T.rLegX = -0.35;
      T.lLegZ = 0.3;
      T.rLegZ = -0.3;
      T.rShX = -0.6;
      T.lShX = -0.6;
      T.rElX = -0.7;
      T.lElX = -0.7;
    };
    switch (kind) {
      case 'crossover':
      case 'inOut': {
        this.rate = 22;
        low();
        const k = clamp(t / 0.36, 0, 1);
        const side = kind === 'crossover' ? from * (1 - 2 * k) : from * (1 - 1.6 * Math.sin(Math.PI * k));
        T.spineRoll = side * 0.18;
        T.hipsRoll = -side * 0.06;
        T.rShZ = -0.25 - 0.3 * Math.max(0, -side);
        T.lShZ = 0.25 + 0.3 * Math.max(0, side);
        T.headYaw = side * 0.15;
        break;
      }
      case 'behindBack': {
        this.rate = 20;
        low();
        T.spinePitch = 0.22;
        const k = clamp(t / 0.4, 0, 1);
        const H = hand(from);
        // braço da bola vai para trás do quadril
        T[H + 'ShX'] = 0.4 + 0.5 * Math.sin(Math.PI * k);
        T[H + 'ShZ'] = zs(from) * (0.35 + 0.3 * Math.sin(Math.PI * k));
        T[H + 'ElX'] = -0.6;
        T.spineYaw = from * 0.25 * Math.sin(Math.PI * k);
        T.lLegX = -0.45 + Math.sin(this.phase) * 0.3;
        T.rLegX = -0.45 - Math.sin(this.phase) * 0.3;
        break;
      }
      case 'betweenLegs': {
        this.rate = 20;
        low();
        // pé contrário à bola vai à frente, abrindo o espaço entre as pernas
        const L = hand(-from) === 'r' ? 'r' : 'l';
        const B = L === 'r' ? 'l' : 'r';
        T[L + 'LegX'] = -0.75;
        T[L + 'KneeX'] = 0.9;
        T[B + 'LegX'] = 0.25;
        T[B + 'KneeX'] = 0.7;
        T.lLegZ = 0.38;
        T.rLegZ = -0.38;
        T.rootY = -0.2;
        T.spinePitch = 0.42;
        T.headPitch = -0.35;
        const k = clamp(t / 0.4, 0, 1);
        T.rShX = -0.4 - 0.3 * Math.sin(Math.PI * k);
        T.lShX = -0.4 - 0.3 * Math.sin(Math.PI * k);
        break;
      }
      case 'spin': {
        this.rate = 18;
        const k = clamp(t / 0.56, 0, 1);
        const H = hand(k < 0.75 ? from : to);
        T.rootY = -0.14;
        T.spinePitch = 0.25;
        T.lKneeX = 0.7;
        T.rKneeX = 0.7;
        // pé de pivô fixo, perna livre aberta para girar
        T.lLegX = -0.3;
        T.rLegX = -0.3;
        T.lLegZ = 0.25 + 0.35 * Math.sin(Math.PI * k);
        T.rLegZ = -0.25 - 0.35 * Math.sin(Math.PI * k);
        T[H + 'ShX'] = -0.9;
        T[H + 'ShZ'] = zs(H === 'r' ? 1 : -1) * 0.9;
        T[H + 'ElX'] = -0.5;
        const O = H === 'r' ? 'l' : 'r';
        T[O + 'ShX'] = -0.8;
        T[O + 'ShZ'] = -zs(H === 'r' ? 1 : -1) * 0.7;
        T[O + 'ElX'] = -1.1;
        T.headYaw = 0;
        break;
      }
      case 'hesitation': {
        const burst = d.burst;
        this.rate = burst ? 22 : 14;
        if (!burst) {
          // corpo sobe, como se fosse parar ou arremessar
          T.rootY = -0.02;
          T.spinePitch = -0.04;
          T.headPitch = -0.15;
          T.lKneeX = 0.2;
          T.rKneeX = 0.2;
          const H = hand(from);
          T[H + 'ShX'] = -1.1;
          T[H + 'ShZ'] = zs(from) * 0.2;
          T[H + 'ElX'] = -1.3;
          const O = H === 'r' ? 'l' : 'r';
          T[O + 'ShX'] = -0.7;
          T[O + 'ElX'] = -1.2;
        } else {
          // arrancada: corpo baixo e projetado para frente
          T.rootY = -0.14;
          T.spinePitch = 0.5;
          T.lLegX = -Math.sin(this.phase) * 0.9;
          T.rLegX = Math.sin(this.phase) * 0.9;
          T.lKneeX = 0.4 + Math.max(0, Math.cos(this.phase)) * 1.3;
          T.rKneeX = 0.4 + Math.max(0, -Math.cos(this.phase)) * 1.3;
          T.lShX = Math.sin(this.phase) * 0.8;
          T.rShX = -0.6;
          T.rElX = -0.9;
          T.lElX = -1.2;
        }
        break;
      }
      case 'stepback': {
        this.rate = 20;
        T.rootY = air ? -0.04 : -0.15;
        T.spinePitch = 0.1;
        T.lLegX = air ? 0.2 : -0.3;
        T.rLegX = air ? -0.5 : -0.3;
        T.lKneeX = air ? 0.6 : 0.8;
        T.rKneeX = air ? 0.4 : 0.8;
        T.lFootX = air ? 0.3 : 0;
        T.rFootX = air ? 0.3 : 0;
        // bola recolhida, pronta para o arremesso
        T.rShX = -1.2;
        T.lShX = -1.15;
        T.rShZ = -0.25;
        T.lShZ = 0.3;
        T.rElX = -1.2;
        T.lElX = -1.25;
        T.headPitch = -0.1;
        break;
      }
      default:
        break;
    }
  }

  apply() {
    const C = this.current;
    const J = this.model.joints;
    J.hips.position.y = 1.0 + C.rootY;
    J.hips.rotation.set(C.hipsPitch, C.hipsYaw, C.hipsRoll);
    J.spine.rotation.set(C.spinePitch, C.spineYaw, C.spineRoll);
    J.head.rotation.set(C.headPitch - C.spinePitch * 0.6, C.headYaw, 0);
    J.lShoulder.rotation.set(C.lShX, 0, C.lShZ);
    J.rShoulder.rotation.set(C.rShX, 0, C.rShZ);
    J.lElbow.rotation.x = C.lElX;
    J.rElbow.rotation.x = C.rElX;
    J.lHand.rotation.x = C.lHandX;
    J.rHand.rotation.x = C.rHandX;
    J.lHip.rotation.set(C.lLegX, 0, C.lLegZ);
    J.rHip.rotation.set(C.rLegX, 0, C.rLegZ);
    J.lKnee.rotation.x = C.lKneeX;
    J.rKnee.rotation.x = C.rKneeX;
    // mantém os pés aproximadamente paralelos ao chão
    J.lFoot.rotation.x = C.lFootX - (C.lLegX + C.lKneeX + C.hipsPitch) * 0.85;
    J.rFoot.rotation.x = C.rFootX - (C.rLegX + C.rKneeX + C.hipsPitch) * 0.85;
  }
}
