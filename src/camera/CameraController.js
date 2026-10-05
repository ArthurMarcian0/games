import * as THREE from 'three';
import { COURT } from '../config/Constants.js';
import { clamp, dampAngle, damp, wrapAngle } from '../core/MathUtils.js';

/**
 * Câmera em terceira pessoa (atrás do jogador), câmera de transmissão,
 * câmera de menu, câmera de personalização e tomadas cinematográficas.
 */
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'menu';
    this.pos = new THREE.Vector3(0, 8, 18);
    this.look = new THREE.Vector3(0, 1, 0);
    this.yaw = Math.PI / 2;
    this.fov = 55;
    this.orbit = 0;
    this.shakeAmt = 0;
    this.cine = null;
    this.previewYaw = 0;
    this._t = new THREE.Vector3();
    this._l = new THREE.Vector3();
  }

  setMode(mode, snap = false) {
    this.mode = mode;
    if (snap) this.snapNext = true;
  }

  shake(a) {
    this.shakeAmt = Math.min(0.6, this.shakeAmt + a);
  }

  // Tomada cinematográfica temporária (ex.: após uma cesta)
  cinematic(opts) {
    this.cine = { t: 0, angle: null, ...opts };
  }

  update(dt, ctx = {}) {
    const desiredPos = this._t;
    const desiredLook = this._l;
    let fov = 55;
    let posRate = 5;
    let lookRate = 7;

    if (this.cine) {
      const c = this.cine;
      c.t += dt;
      if (c.angle == null) c.angle = Math.atan2(this.pos.x - c.center.x, this.pos.z - c.center.z);
      c.angle += dt * (c.speed ?? 0.45);
      const r = c.radius ?? 4.5;
      desiredPos.set(c.center.x + Math.sin(c.angle) * r, c.center.y + (c.height ?? 1.6), c.center.z + Math.cos(c.angle) * r);
      desiredLook.copy(c.center);
      desiredLook.y += c.lookY ?? 1.2;
      fov = c.fov ?? 45;
      posRate = 3;
      lookRate = 5;
      if (c.follow) {
        c.center.copy(c.follow.pos);
      }
      if (c.t > c.duration) this.cine = null;
    } else if (this.mode === 'menu') {
      this.orbit += dt * 0.06;
      desiredPos.set(Math.sin(this.orbit) * 17, 6.5 + Math.sin(this.orbit * 0.7) * 1.5, Math.cos(this.orbit) * 12);
      desiredLook.set(0, 1.4, 0);
      fov = 50;
      posRate = 2;
      lookRate = 2;
    } else if (this.mode === 'preview') {
      desiredPos.set(-0.55, 1.55, 3.9);
      desiredLook.set(-0.85, 1.05, 0);
      fov = 40;
      posRate = 4;
      lookRate = 4;
    } else if (this.mode === 'broadcast') {
      const ball = ctx.ball ? ctx.ball.pos : new THREE.Vector3();
      desiredPos.set(clamp(ball.x * 0.72, -9, 9), 8.6, 16.8);
      desiredLook.set(ball.x * 0.88, 0.6, ball.z * 0.3);
      fov = 42;
      posRate = 3;
      lookRate = 4;
    } else if (this.mode === 'follow' && ctx.player) {
      this.followCam(dt, ctx, desiredPos, desiredLook);
      fov = this.followFov;
    } else if (this.mode === 'intro') {
      this.orbit += dt * 0.25;
      desiredPos.set(Math.sin(this.orbit) * 10, 4 + this.orbit, Math.cos(this.orbit) * 10);
      desiredLook.set(0, 1.5, 0);
      fov = 48;
    }

    if (this.snapNext) {
      this.pos.copy(desiredPos);
      this.look.copy(desiredLook);
      this.snapNext = false;
    } else {
      this.pos.x = damp(this.pos.x, desiredPos.x, posRate, dt);
      this.pos.y = damp(this.pos.y, desiredPos.y, posRate, dt);
      this.pos.z = damp(this.pos.z, desiredPos.z, posRate, dt);
      this.look.x = damp(this.look.x, desiredLook.x, lookRate, dt);
      this.look.y = damp(this.look.y, desiredLook.y, lookRate, dt);
      this.look.z = damp(this.look.z, desiredLook.z, lookRate, dt);
    }
    this.fov = damp(this.fov, fov, 3, dt);

    this.camera.position.copy(this.pos);
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt;
      this.camera.position.x += (Math.random() - 0.5) * s * 0.3;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.3;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    }
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  followCam(dt, ctx, outPos, outLook) {
    const p = ctx.player;
    const ball = ctx.ball;
    const P = p.pos;
    const goalSign = ctx.goalSign || 1;
    const goal = new THREE.Vector3(goalSign * COURT.basketX, 0, 0);
    const toGoal = Math.atan2(goal.x - P.x, goal.z - P.z);
    const distGoal = Math.hypot(goal.x - P.x, goal.z - P.z);
    // perto da cesta: direção fixa ao longo da quadra para evitar giros bruscos
    const straight = goalSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    let desired = distGoal < 5 ? straight : dampAngle(straight, toGoal, 1, 0.55);
    if (p.speed > 1.2) {
      const mv = Math.atan2(p.vel.x, p.vel.z);
      // gira levemente para a direção da movimentação
      const diff = wrapAngle(mv - desired);
      desired += clamp(diff, -0.6, 0.6) * 0.35;
    }
    this.yaw = dampAngle(this.yaw, desired, 1.8, dt);

    const shooting = ball.state === 'shot' && ball.shotInfo && ball.shotInfo.team === p.team;
    const dist = shooting ? 8.6 : 7.4;
    const height = shooting ? 4.8 : 4.1;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    outPos.set(P.x - fx * dist, height + P.y * 0.3, P.z - fz * dist);
    outPos.z = clamp(outPos.z, -9.9, 9.9);
    // não deixa a câmera atrás da tabela (ela taparia a visão)
    const limX = Math.abs(outPos.z) < 2.6 ? 11.4 : 16.6;
    if (Math.abs(outPos.x) > limX) {
      outPos.y += Math.min(2, Math.abs(outPos.x) - limX);
      outPos.x = Math.sign(outPos.x) * limX;
    }
    outLook.set(P.x + fx * 2.6, 1.2, P.z + fz * 2.6);
    // mantém a bola no quadro
    const bw = shooting ? 0.55 : 0.3;
    outLook.x += (ball.pos.x - outLook.x) * bw;
    outLook.y += (Math.min(ball.pos.y, 4) - outLook.y) * bw;
    outLook.z += (ball.pos.z - outLook.z) * bw;
    this.followFov = shooting ? 50 : 55;
  }
}
