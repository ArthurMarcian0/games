import * as THREE from 'three';
import { headingTo, distXZ } from '../core/MathUtils.js';

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
      crossover: false,
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
    I.crossover = false;
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
      if (inp.wasPressed('crossover')) I.crossover = true;
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
