// Câmera em terceira pessoa (atrás do ombro), com colisão, mira, tremor e
// modo cinematográfico para cenas.
import * as THREE from 'three';
import { clamp, damp, lerp, rand, wrapAngle } from '../core/utils.js';

export class CameraController {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 260);
    this.yaw = 0;
    this.pitch = -0.08;
    this.dist = 2.6;
    this.aim = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.kick = 0;
    this.turnAnim = null;
    this.cine = null;
    this.pivot = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.curDist = 2.6;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  shake(amp, dur = 0.3) {
    const s = this.game.settings.get('shake');
    this.shakeAmp = Math.max(this.shakeAmp, amp * s);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  recoil(amount) {
    this.kick += amount;
  }

  quickTurn() {
    this.turnAnim = { from: this.yaw, to: this.yaw + Math.PI, t: 0 };
  }

  setYaw(y) {
    this.yaw = y;
    this.turnAnim = null;
  }

  // cena: posição e alvo fixos (com interpolação)
  cinematic(pos, look, blend = 1.2) {
    this.cine = { pos: pos.clone(), look: look.clone(), blend, t: 0, fromPos: this.camera.position.clone(), fromLook: this.lastLook ? this.lastLook.clone() : look.clone() };
  }
  endCinematic() {
    this.cine = null;
  }

  update(dt, input, player, world) {
    const cam = this.camera;
    const settings = this.game.settings;
    if (input && !this.cine) {
      const sens = 0.0022 * settings.get('sensitivity') * (this.aim > 0.5 ? 0.6 : 1);
      this.yaw -= input.mdx * sens;
      this.pitch -= input.mdy * sens * (settings.get('invertY') ? -1 : 1);
    }
    if (this.turnAnim) {
      const ta = this.turnAnim;
      ta.t += dt / 0.28;
      const k = Math.min(1, ta.t);
      const e = k * k * (3 - 2 * k);
      this.yaw = ta.from + (ta.to - ta.from) * e;
      if (k >= 1) {
        this.yaw = wrapAngle(ta.to);
        this.turnAnim = null;
      }
    }
    // recuo: sobe a mira e recupera parcialmente
    if (this.kick > 0) {
      const k = Math.min(this.kick, dt * 1.6 + this.kick * dt * 14);
      this.pitch += k * 0.7;
      this.kick -= k;
    }
    this.pitch = clamp(this.pitch, -0.95, 0.75);

    const aiming = player.aiming ? 1 : 0;
    this.aim = damp(this.aim, aiming, 12, dt);
    const fovBase = settings.get('fov');
    const fov = lerp(fovBase, fovBase - 20, this.aim);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    if (this.cine) {
      const c = this.cine;
      c.t = Math.min(1, c.t + dt / c.blend);
      const e = c.t * c.t * (3 - 2 * c.t);
      cam.position.lerpVectors(c.fromPos, c.pos, e);
      const look = new THREE.Vector3().lerpVectors(c.fromLook, c.look, e);
      cam.lookAt(look);
      this.lastLook = look;
      this.applyShake(dt);
      return;
    }

    const height = lerp(1.68, 1.62, this.aim);
    const shoulder = lerp(0.5, 0.58, this.aim);
    const dist = lerp(2.75, 1.2, this.aim);
    const cy = Math.cos(this.pitch);
    this.fwd.set(Math.sin(this.yaw) * cy, Math.sin(this.pitch), Math.cos(this.yaw) * cy);
    const rx = -Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);
    const pp = player.pos;
    // o pivô acompanha a altura de agachamento/queda do personagem
    const bodyY = player.dead ? 0.4 : height;
    this.pivot.set(pp.x + rx * shoulder, pp.y + bodyY, pp.z + rz * shoulder);
    // garante que o ombro não entra na parede
    const sh = world.collision.segment(pp.x, pp.z, this.pivot.x, this.pivot.z, bodyY, bodyY);
    if (sh.t < 1) {
      const t = Math.max(0, sh.t - 0.15 / Math.max(0.01, shoulder));
      this.pivot.x = pp.x + rx * shoulder * t;
      this.pivot.z = pp.z + rz * shoulder * t;
    }
    let tx = this.pivot.x - this.fwd.x * dist;
    let ty = this.pivot.y - this.fwd.y * dist;
    let tz = this.pivot.z - this.fwd.z * dist;
    const hit = world.collision.segment(this.pivot.x, this.pivot.z, tx, tz, this.pivot.y, ty, 0.2);
    let want = dist;
    if (hit.t < 1) want = Math.max(0.25, hit.t * dist - 0.25);
    this.curDist = want < this.curDist ? want : damp(this.curDist, want, 4, dt);
    tx = this.pivot.x - this.fwd.x * this.curDist;
    ty = this.pivot.y - this.fwd.y * this.curDist;
    tz = this.pivot.z - this.fwd.z * this.curDist;
    const ceil = world.ceilingAt(tx, tz);
    ty = clamp(ty, 0.25, ceil - 0.25);
    cam.position.set(tx, ty, tz);
    const look = new THREE.Vector3(this.pivot.x + this.fwd.x * 10, this.pivot.y + this.fwd.y * 10, this.pivot.z + this.fwd.z * 10);
    cam.lookAt(look);
    this.lastLook = look;
    this.applyShake(dt);
  }

  applyShake(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.min(1, this.shakeT * 4);
      this.camera.position.x += rand(-a, a);
      this.camera.position.y += rand(-a, a);
      this.camera.rotation.z += rand(-a, a) * 0.3;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
  }

  // direção da mira no mundo (do centro da tela)
  aimRay(out = { origin: new THREE.Vector3(), dir: new THREE.Vector3() }) {
    this.camera.getWorldPosition(out.origin);
    this.camera.getWorldDirection(out.dir);
    return out;
  }
}
