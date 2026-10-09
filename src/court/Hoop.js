import * as THREE from 'three';
import { COURT, BALL } from '../config/Constants.js';

// Cesta completa: suporte, tabela, aro, rede animada e relógio de posse.
const NET_N = 14;
const NET_ROWS = 5;
const NET_DEPTH = 0.44;
const NET_BOTTOM_R = 0.135;

export class Hoop {
  constructor(parent, side, theme) {
    this.side = side; // +1 = cesta do lado +x
    this.group = new THREE.Group();
    parent.add(this.group);
    this.rimCenter = new THREE.Vector3(side * COURT.basketX, COURT.rimHeight, 0);
    this.swish = 0;
    this.rimShake = 0;
    this.lastClock = null;
    this.build(theme);
  }

  build(theme) {
    const s = this.side;
    const ruin = theme.hoop || null; // variação pós-apocalíptica
    const pad = new THREE.MeshStandardMaterial({ color: theme.padColor, roughness: ruin ? 0.95 : 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: ruin ? ruin.steel || 0x5a3a24 : 0x2b2f36, roughness: ruin ? 0.85 : 0.4, metalness: ruin ? 0.35 : 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

    const add = (geo, mat, x, y, z, cast = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };

    // Base acolchoada e coluna
    add(new THREE.BoxGeometry(1.1, 1.1, 1.8), pad, s * 15.5, 0.55, 0);
    add(new THREE.BoxGeometry(0.26, 2.6, 0.26), steel, s * 15.25, 2.4, 0);
    add(new THREE.BoxGeometry(0.34, 1.6, 0.34), pad, s * 15.25, 1.9, 0);
    add(new THREE.BoxGeometry(2.4, 0.16, 0.16), steel, s * 14.05, 3.62, 0);
    const brace = add(new THREE.BoxGeometry(2.0, 0.1, 0.1), steel, s * 14.25, 3.15, 0);
    brace.rotation.z = s * 0.38;

    // Tabela de vidro
    const glass = ruin
      ? new THREE.MeshStandardMaterial({ map: this.makeBoardTexture(ruin), roughness: 0.9, metalness: ruin.board === 'metal' ? 0.4 : 0 })
      : new THREE.MeshStandardMaterial({
          color: 0xe6f2ff,
          roughness: 0.05,
          metalness: 0.2,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        });
    const boardY = (COURT.boardBottom + COURT.boardTop) / 2;
    const boardH = COURT.boardTop - COURT.boardBottom;
    const bx = s * (COURT.boardX + COURT.boardThick / 2);
    const board = add(new THREE.BoxGeometry(COURT.boardThick, boardH, COURT.boardHalfW * 2), glass, bx, boardY, 0, !!ruin);
    board.renderOrder = 2;
    if (ruin) board.rotation.x = (s > 0 ? 1 : -1) * (ruin.tilt || 0);

    // Moldura e quadrado do arremesso
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const fz = COURT.boardHalfW;
    add(new THREE.BoxGeometry(0.07, 0.05, fz * 2 + 0.05), frameMat, bx, COURT.boardTop, 0);
    add(new THREE.BoxGeometry(0.07, 0.05, fz * 2 + 0.05), frameMat, bx, COURT.boardBottom, 0);
    add(new THREE.BoxGeometry(0.07, boardH, 0.05), frameMat, bx, boardY, fz);
    add(new THREE.BoxGeometry(0.07, boardH, 0.05), frameMat, bx, boardY, -fz);
    add(new THREE.BoxGeometry(0.12, 0.09, fz * 2 + 0.1), pad, bx, COURT.boardBottom - 0.04, 0);
    const lx = s * (COURT.boardX - 0.003);
    const lineGeoH = new THREE.BoxGeometry(0.004, 0.045, 0.59);
    const lineGeoV = new THREE.BoxGeometry(0.004, 0.45, 0.045);
    if (!ruin) {
      add(lineGeoH, white, lx, 3.07, 0, false);
      add(lineGeoH, white, lx, 3.52, 0, false);
      add(lineGeoV, white, lx, 3.295, 0.295, false);
      add(lineGeoV, white, lx, 3.295, -0.295, false);
    }

    // Suporte do aro
    add(new THREE.BoxGeometry(0.18, 0.06, 0.2), steel, s * 12.71, COURT.rimHeight - 0.02, 0);

    // Aro
    const rimMat = ruin
      ? new THREE.MeshStandardMaterial({ color: ruin.rim || 0xa8461c, roughness: 0.75, metalness: 0.5, emissive: 0x150500 })
      : new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.35, metalness: 0.5, emissive: 0x2a0a00 });
    const rimGeo = new THREE.TorusGeometry(COURT.rimRadius, COURT.rimTube, 8, 36);
    this.rim = new THREE.Mesh(rimGeo, rimMat);
    this.rim.rotation.x = Math.PI / 2;
    this.rim.position.copy(this.rimCenter);
    this.rim.castShadow = true;
    this.group.add(this.rim);

    this.buildNet(ruin && ruin.chainNet);
    this.buildShotClock(s);
  }

  // Tabela improvisada: compensado ou chapa de metal com o quadrado pintado
  makeBoardTexture(ruin) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const ctx = c.getContext('2d');
    const metal = ruin.board === 'metal';
    ctx.fillStyle = metal ? '#6b6e70' : '#a07a4f';
    ctx.fillRect(0, 0, 256, 160);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (metal) {
      for (let x = 0; x < 256; x += 22) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, 0, 3, 160);
      }
    } else {
      for (let y = 0; y < 160; y += 3) {
        ctx.fillStyle = `rgba(70,45,20,${0.05 + rnd() * 0.12})`;
        ctx.fillRect(0, y, 256, 1 + rnd() * 2);
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd() * 256;
      const y = rnd() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + rnd() * 30);
      g.addColorStop(0, 'rgba(110,50,15,0.55)');
      g.addColorStop(1, 'rgba(110,50,15,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 160);
    }
    ctx.strokeStyle = ruin.paint || '#f2efe6';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 244, 148);
    ctx.strokeRect(84, 66, 88, 72);
    // parafusos
    ctx.fillStyle = '#2a2a2a';
    for (const [x, y] of [[14, 14], [242, 14], [14, 146], [242, 146]]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildNet(chain = false) {
    this.netBase = [];
    for (let r = 0; r < NET_ROWS; r++) {
      const t = r / (NET_ROWS - 1);
      const radius = COURT.rimRadius + (NET_BOTTOM_R - COURT.rimRadius) * t;
      const y = -NET_DEPTH * t;
      for (let i = 0; i < NET_N; i++) {
        const a = ((i + 0.5 * (r % 2)) / NET_N) * Math.PI * 2;
        this.netBase.push({ a, radius, y, t });
      }
    }
    const idx = [];
    const id = (r, i) => r * NET_N + ((i + NET_N) % NET_N);
    for (let r = 0; r < NET_ROWS - 1; r++) {
      for (let i = 0; i < NET_N; i++) {
        const shift = r % 2 === 0 ? -1 : 1;
        idx.push(id(r, i), id(r + 1, i));
        idx.push(id(r, i), id(r + 1, i + (shift < 0 ? -1 : 0) + (shift > 0 ? 1 : 0)));
      }
    }
    // anel inferior
    for (let i = 0; i < NET_N; i++) idx.push(id(NET_ROWS - 1, i), id(NET_ROWS - 1, i + 1));

    const geo = new THREE.BufferGeometry();
    this.netPositions = new Float32Array(this.netBase.length * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.netPositions, 3));
    geo.setIndex(idx);
    const netColor = chain ? 0x9a9a92 : 0xf5f5f5;
    this.net = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: netColor, transparent: true, opacity: 0.92 }));
    this.net.position.copy(this.rimCenter);
    this.net.frustumCulled = false;
    this.group.add(this.net);
    this.updateNet(null);
  }

  buildShotClock(s) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    this.clockCanvas = c;
    this.clockTex = new THREE.CanvasTexture(c);
    this.clockTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: this.clockTex, toneMapped: false });
    const geo = new THREE.PlaneGeometry(0.62, 0.31);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.7), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    box.position.set(s * (COURT.boardX + 0.06), COURT.boardTop + 0.25, 0);
    this.group.add(box);
    for (const dir of [-1, 1]) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(s * (COURT.boardX + 0.06) + dir * 0.051, COURT.boardTop + 0.25, 0);
      p.rotation.y = dir * Math.PI / 2;
      this.group.add(p);
    }
    this.setShotClock(24);
  }

  setShotClock(value) {
    const v = value == null ? '' : String(Math.max(0, Math.ceil(value)));
    if (v === this.lastClock) return;
    this.lastClock = v;
    const ctx = this.clockCanvas.getContext('2d');
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = value != null && value <= 5 ? '#ff3b3b' : '#ffb21e';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(v, 64, 34);
    this.clockTex.needsUpdate = true;
  }

  triggerSwish(strength = 1) {
    this.swish = Math.max(this.swish, strength);
  }

  triggerRim(strength) {
    this.rimShake = Math.min(1, this.rimShake + strength * 0.25);
  }

  updateNet(ball) {
    const p = this.netPositions;
    let inside = null;
    if (ball) {
      const dx = ball.pos.x - this.rimCenter.x;
      const dz = ball.pos.z - this.rimCenter.z;
      const dy = ball.pos.y - this.rimCenter.y;
      const hd = Math.hypot(dx, dz);
      if (hd < COURT.rimRadius + 0.05 && dy < 0.15 && dy > -NET_DEPTH - 0.15) inside = { dx, dz, dy, hd };
    }
    const sw = this.swish;
    for (let k = 0; k < this.netBase.length; k++) {
      const b = this.netBase[k];
      let radius = b.radius * (1 + 0.22 * sw * Math.sin(b.t * Math.PI));
      let y = b.y * (1 + 0.3 * sw * b.t);
      let ox = 0;
      let oz = 0;
      if (inside) {
        const near = 1 - Math.min(1, Math.abs(inside.dy - b.y) / 0.16);
        if (near > 0) {
          const need = BALL.radius + 0.02 + inside.hd * 0.5;
          radius = Math.max(radius, radius + (need - radius) * near);
          ox = inside.dx * 0.5 * near;
          oz = inside.dz * 0.5 * near;
          y -= 0.04 * near;
        }
      }
      p[k * 3] = Math.cos(b.a) * radius + ox;
      p[k * 3 + 1] = y;
      p[k * 3 + 2] = Math.sin(b.a) * radius + oz;
    }
    this.net.geometry.attributes.position.needsUpdate = true;
  }

  update(dt, ball) {
    this.swish = Math.max(0, this.swish - dt * 1.8);
    this.rimShake = Math.max(0, this.rimShake - dt * 3);
    this.rim.position.y = this.rimCenter.y + Math.sin(performance.now() * 0.08) * 0.012 * this.rimShake;
    this.updateNet(ball);
  }
}
