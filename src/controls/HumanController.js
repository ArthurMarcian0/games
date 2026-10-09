import * as THREE from 'three';
import { headingTo, distXZ } from '../core/MathUtils.js';
import { chooseMove } from '../entities/DribbleMoves.js';

const fwd = new THREE.Vector3();

// Converte a entrada do jogador em intenções para o atleta controlado.
// Os movimentos são relativos à câmera.
export class HumanController {
  constructor(input, camera) {
    this.input = input;
    this.camera = camera;
    this.intent = {
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
    this.passPreview = null;
  }

  get isHuman() {
    return true;
  }

  worldMove() {
    const m = this.input.getMove();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    // direita da tela = (-fwd.z, fwd.x)
    const x = -fwd.z * m.x + fwd.x * m.y;
    const z = fwd.x * m.x + fwd.z * m.y;
    return { x, z };
  }

  getIntent(p) {
    const I = this.intent;
    const inp = this.input;
    const w = p.world;
    const rules = w.rules;
    const mv = this.worldMove();
    I.moveX = mv.x;
    I.moveZ = mv.z;
    I.sprint = inp.isDown('sprint');
    I.pass = false;
    I.passTarget = null;
    I.steal = false;
    I.jump = false;
    I.dribbleMove = null;
    I.face = null;
    I.contest = false;
    p.stance = 'normal';

    const hasBall = p.hasBall;
    I.shootHeld = hasBall ? inp.isDown('action') : false;
    if (p.action === 'shoot' || p.action === 'ft') I.shootHeld = inp.isDown('action');

    this.passPreview = null;
    if (hasBall) {
      const dir = Math.hypot(mv.x, mv.z) > 0.2 ? { x: mv.x, z: mv.z } : null;
      this.passPreview = w.choosePassTarget(p, dir);
      if (inp.wasPressed('pass')) {
        I.pass = true;
        I.passTarget = this.passPreview;
      }
      const spin = inp.wasPressed('spin');
      if (spin || inp.wasPressed('crossover')) {
        // a direção na tela escolhe o drible (frente/trás/lados); o lado é
        // convertido para o corpo do atleta para saber qual mão fica com a bola
        const m = inp.getMove();
        this.camera.getWorldDirection(fwd);
        const rx = -fwd.z;
        const rz = fwd.x;
        const r = p.right;
        const bodySide = rx * r.x + rz * r.z;
        I.dribbleMove = chooseMove({
          fwd: m.y,
          side: m.x * (bodySide < -0.3 ? -1 : 1),
          hand: p.dribbleHand,
          sprint: I.sprint,
          spin,
        });
        // step-back sai na direção pedida, de frente para a quadra
        if (I.dribbleMove.kind === 'stepback') I.dribbleMove.push = { x: mv.x, z: mv.z };
      }
    } else {
      if (inp.wasPressed('pass')) I.steal = true;
      if (inp.wasPressed('action') || inp.wasPressed('jump')) I.jump = true;
      // postura defensiva automática diante do portador da bola
      const holder = w.ball.holder;
      if (holder && holder.team !== p.team && rules && rules.phase === 'live') {
        const d = distXZ(p.pos, holder.pos);
        if (d < 4.5 && !I.sprint) {
          p.stance = 'defense';
          I.face = headingTo(p.pos, holder.pos);
          I.contest = (holder.action === 'shoot' || holder.action === 'ft') && d < 2.2;
        }
      }
    }
    return I;
  }
}
