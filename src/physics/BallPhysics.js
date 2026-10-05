import { COURT, BALL, GRAVITY } from '../config/Constants.js';

// Física 3D da bola: gravidade, quique no piso, colisão com aro (toro),
// tabela (caixa), rede (amortecimento), paredes e detecção de cesta.
const WALL_X = 17.2;
const WALL_Z = 10.1;
const CEILING = 21;

export class BallPhysics {
  constructor(onEvent) {
    this.onEvent = onEvent; // (type, data) => void
    this.rims = [1, -1].map((s) => ({ side: s, x: s * COURT.basketX, y: COURT.rimHeight, z: 0 }));
  }

  step(ball, dt) {
    const speed = ball.vel.length();
    const n = Math.min(12, Math.max(2, Math.ceil((speed * dt) / 0.025)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(ball, h);
  }

  substep(ball, h) {
    const p = ball.pos;
    const v = ball.vel;
    const r = BALL.radius;
    const prevY = p.y;

    // integração exata para gravidade constante (trajetórias previsíveis)
    p.x += v.x * h;
    p.y += v.y * h - 0.5 * GRAVITY * h * h;
    p.z += v.z * h;
    v.y -= GRAVITY * h;

    // Piso
    if (p.y < r) {
      p.y = r;
      if (v.y < 0) {
        const impact = -v.y;
        v.y = impact > 0.5 ? impact * BALL.restitution : 0;
        v.x *= BALL.floorFriction;
        v.z *= BALL.floorFriction;
        // rolagem
        ball.spin.set(v.z, 0, -v.x).multiplyScalar(1 / r);
        if (impact > 0.5) this.onEvent('bounce', { ball, impact, pos: p.clone() });
        this.onEvent('floor', { ball, impact });
      }
    }
    if (p.y <= r + 0.001 && Math.abs(v.y) < 0.01) {
      const f = Math.max(0, 1 - 0.9 * h);
      v.x *= f;
      v.z *= f;
    }

    // Paredes / arquibancadas
    if (Math.abs(p.x) > WALL_X - r) {
      p.x = Math.sign(p.x) * (WALL_X - r);
      v.x *= -0.5;
      this.onEvent('wall', { ball });
    }
    if (Math.abs(p.z) > WALL_Z - r) {
      p.z = Math.sign(p.z) * (WALL_Z - r);
      v.z *= -0.5;
      this.onEvent('wall', { ball });
    }
    if (p.y > CEILING) {
      p.y = CEILING;
      v.y = -Math.abs(v.y) * 0.4;
    }

    for (const rim of this.rims) {
      if (Math.abs(p.x - rim.x) > 1.2 || p.y < 2.0 || p.y > 4.6) continue;
      this.collideBoard(ball, rim);
      this.collideRim(ball, rim);
      this.applyNet(ball, rim, h);
      this.checkScore(ball, rim, prevY);
    }
  }

  collideRim(ball, rim) {
    const p = ball.pos;
    const v = ball.vel;
    const R = COURT.rimRadius;
    const dx = p.x - rim.x;
    const dz = p.z - rim.z;
    const hd = Math.hypot(dx, dz) || 1e-6;
    // ponto mais próximo no anel
    const qx = rim.x + (dx / hd) * R;
    const qz = rim.z + (dz / hd) * R;
    const ex = p.x - qx;
    const ey = p.y - rim.y;
    const ez = p.z - qz;
    const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const minD = BALL.radius + COURT.rimTube;
    if (dist < minD && dist > 1e-6) {
      const nx = ex / dist;
      const ny = ey / dist;
      const nz = ez / dist;
      p.x = qx + nx * minD;
      p.y = rim.y + ny * minD;
      p.z = qz + nz * minD;
      const vn = v.x * nx + v.y * ny + v.z * nz;
      if (vn < 0) {
        const e = BALL.rimRestitution;
        v.x -= (1 + e) * vn * nx;
        v.y -= (1 + e) * vn * ny;
        v.z -= (1 + e) * vn * nz;
        // atrito tangencial leve
        v.multiplyScalar(0.94);
        ball.spin.multiplyScalar(0.5);
        this.onEvent('rim', { ball, impact: -vn, side: rim.side });
      }
    }
  }

  collideBoard(ball, rim) {
    const p = ball.pos;
    const v = ball.vel;
    const s = rim.side;
    const x0 = s * COURT.boardX;
    const x1 = s * (COURT.boardX + COURT.boardThick);
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const cx = Math.max(minX, Math.min(p.x, maxX));
    const cy = Math.max(COURT.boardBottom, Math.min(p.y, COURT.boardTop));
    const cz = Math.max(-COURT.boardHalfW, Math.min(p.z, COURT.boardHalfW));
    const ex = p.x - cx;
    const ey = p.y - cy;
    const ez = p.z - cz;
    const d2 = ex * ex + ey * ey + ez * ez;
    const r = BALL.radius;
    if (d2 < r * r) {
      const d = Math.sqrt(d2);
      let nx;
      let ny;
      let nz;
      if (d < 1e-5) {
        nx = -s;
        ny = 0;
        nz = 0;
      } else {
        nx = ex / d;
        ny = ey / d;
        nz = ez / d;
      }
      p.x = cx + nx * r;
      p.y = cy + ny * r;
      p.z = cz + nz * r;
      const vn = v.x * nx + v.y * ny + v.z * nz;
      if (vn < 0) {
        const e = BALL.boardRestitution;
        v.x -= (1 + e) * vn * nx;
        v.y -= (1 + e) * vn * ny;
        v.z -= (1 + e) * vn * nz;
        v.y *= 0.92;
        this.onEvent('board', { ball, impact: -vn, side: s });
      }
    }
  }

  // A rede desacelera a bola e a mantém dentro do cilindro
  applyNet(ball, rim, h) {
    const p = ball.pos;
    const v = ball.vel;
    if (!ball.inNet || ball.netSide !== rim.side) return;
    const dy = rim.y - p.y;
    if (dy < 0 || dy > 0.46) return;
    const dx = p.x - rim.x;
    const dz = p.z - rim.z;
    const hd = Math.hypot(dx, dz);
    const netR = COURT.rimRadius - (COURT.rimRadius - 0.135) * (dy / 0.44);
    if (hd > COURT.rimRadius + 0.02) return;
    // arrasto da rede
    const k = 1 - Math.min(1, 5.5 * h);
    v.x *= k;
    v.z *= k;
    if (v.y < -2.0) v.y += (v.y + 2.0) * -Math.min(1, 6 * h);
    const limit = Math.max(0.0, netR - BALL.radius * 0.55);
    if (hd > limit && hd > 1e-4) {
      p.x = rim.x + (dx / hd) * limit;
      p.z = rim.z + (dz / hd) * limit;
      const vr = (v.x * dx + v.z * dz) / hd;
      if (vr > 0) {
        v.x -= (dx / hd) * vr * 1.3;
        v.z -= (dz / hd) * vr * 1.3;
      }
    }
  }

  checkScore(ball, rim, prevY) {
    const p = ball.pos;
    if (ball.inNet && ball.netSide === rim.side && (p.y > rim.y + 0.3 || p.y < rim.y - 0.6)) ball.inNet = false;
    if (prevY >= rim.y && p.y < rim.y && ball.vel.y < 0) {
      const hd = Math.hypot(p.x - rim.x, p.z - rim.z);
      if (hd < COURT.rimRadius) {
        ball.inNet = true;
        ball.netSide = rim.side;
        this.onEvent('net', { ball, side: rim.side });
      }
      if (hd < COURT.rimRadius - BALL.radius * 0.3 && ball.time - ball.lastScoreTime > 1.0) {
        ball.lastScoreTime = ball.time;
        this.onEvent('score', { ball, side: rim.side, swish: !ball.touchedRim });
      }
    }
  }
}
