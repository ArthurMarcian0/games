import * as THREE from 'three';
import { BALL } from '../config/Constants.js';

// Bola de basquete: malha + estado lógico. A física de voo fica em BallPhysics.
function makeBallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8661c';
  ctx.fillRect(0, 0, 512, 256);
  // textura granulada
  const img = ctx.getImageData(0, 0, 512, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n * 0.6;
    img.data[i + 2] += n * 0.3;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  for (const x of [0, 256, 512]) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
  }
  ctx.stroke();
  for (const cx of [128, 384]) {
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 4) {
      const x = cx + Math.sin((y / 256) * Math.PI) * 58 * (cx === 128 ? 1 : -1);
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Ball {
  constructor(scene) {
    this.radius = BALL.radius;
    const geo = new THREE.SphereGeometry(this.radius, 24, 16);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.65 }));
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.pos = new THREE.Vector3(0, 1, 0);
    this.vel = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.state = 'loose'; // held | shot | pass | loose | dead | toss
    this.holder = null;
    this.lastTouch = null;
    this.lastTouchTeam = -1;
    this.shotInfo = null;
    this.passInfo = null;
    this.stateTime = 0;
    this.ignorePlayer = null;
    this.ignoreUntil = 0;
    this.touchedRim = false;
    this.lastScoreTime = -10;
    this.time = 0;
    this.restTime = 0;
    this._q = new THREE.Quaternion();
    this._axis = new THREE.Vector3();
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  setHeld(player) {
    this.holder = player;
    this.lastTouch = player;
    this.lastTouchTeam = player.team;
    this.shotInfo = null;
    this.passInfo = null;
    this.touchedRim = false;
    this.setState('held');
    this.vel.set(0, 0, 0);
  }

  // Lança a bola (arremesso, passe ou bola solta)
  release(state, velocity, by = null, info = null) {
    this.holder = null;
    this.vel.copy(velocity);
    this.setState(state);
    this.touchedFloor = false;
    if (by) {
      this.lastTouch = by;
      this.lastTouchTeam = by.team;
      this.ignorePlayer = by;
      this.ignoreUntil = this.time + 0.35;
    }
    if (state === 'shot') {
      this.shotInfo = info;
      this.passInfo = null;
      this.touchedRim = false;
      // efeito contrário (backspin)
      const dir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
      this.spin.set(dir.z, 0, -dir.x).multiplyScalar(-14);
    } else if (state === 'pass') {
      this.passInfo = info;
      this.spin.set(0, 0, 0);
    }
  }

  placeAt(p) {
    this.pos.copy(p);
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    // rotação visual
    const w = this.spin.length();
    if (w > 0.01) {
      this._axis.copy(this.spin).divideScalar(w);
      this._q.setFromAxisAngle(this._axis, w * dt);
      this.mesh.quaternion.premultiply(this._q);
    }
    this.mesh.position.copy(this.pos);
  }

  setVisible(v) {
    this.mesh.visible = v;
  }

  dispose() {
    this.mesh.parent && this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}
