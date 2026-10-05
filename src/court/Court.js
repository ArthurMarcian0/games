import * as THREE from 'three';
import { Reflector } from 'three/addons/Reflector.js';
import { COURT } from '../config/Constants.js';
import { Hoop } from './Hoop.js';

// Piso de madeira com marcações oficiais e as duas cestas.
const FLOOR_W = 32; // metros cobertos pela textura (com área externa)
const FLOOR_D = 19;
const PPM = 64; // pixels por metro

export class Court {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;
    this.group = new THREE.Group();
    this.group.name = 'court';
    scene.add(this.group);

    this.buildFloor();
    this.hoops = [new Hoop(this.group, 1, theme), new Hoop(this.group, -1, theme)];
    this.reflector = null;
  }

  // Converte coordenadas do mundo para pixels da textura
  px(x) {
    return (x + FLOOR_W / 2) * PPM;
  }

  pz(z) {
    return (z + FLOOR_D / 2) * PPM;
  }

  buildFloor() {
    const canvas = document.createElement('canvas');
    canvas.width = FLOOR_W * PPM;
    canvas.height = FLOOR_D * PPM;
    const ctx = canvas.getContext('2d');
    this.drawWood(ctx, canvas.width, canvas.height);
    this.drawMarkings(ctx);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.floorTexture = tex;

    this.floorMaterial = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.28,
      metalness: 0.0,
      envMapIntensity: 0.55,
    });
    const geo = new THREE.PlaneGeometry(FLOOR_W, FLOOR_D);
    geo.rotateX(-Math.PI / 2);
    this.floor = new THREE.Mesh(geo, this.floorMaterial);
    this.floor.receiveShadow = true;
    this.group.add(this.floor);
  }

  drawWood(ctx, w, h) {
    const [r0, g0, b0] = this.theme.woodBase;
    const v = this.theme.woodVar;
    const plankW = 0.09 * PPM;
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let y = 0; y < h; y += plankW) {
      let x = -rnd() * 3 * PPM;
      while (x < w) {
        const len = (1.8 + rnd() * 2.6) * PPM;
        const d = (rnd() - 0.5) * v;
        ctx.fillStyle = `rgb(${r0 + d},${g0 + d * 0.8},${b0 + d * 0.6})`;
        ctx.fillRect(x, y, len, plankW);
        // veios sutis
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#3b2412';
        for (let k = 0; k < 3; k++) ctx.fillRect(x, y + rnd() * plankW, len, 0.7);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(60,35,15,0.35)';
        ctx.fillRect(x, y, 1.2, plankW);
        x += len;
      }
      ctx.fillStyle = 'rgba(60,35,15,0.25)';
      ctx.fillRect(0, y, w, 0.8);
    }

    // Área externa (fora da quadra) tingida
    ctx.fillStyle = this.theme.apron;
    ctx.globalAlpha = 0.86;
    const x0 = this.px(-COURT.halfL);
    const x1 = this.px(COURT.halfL);
    const z0 = this.pz(-COURT.halfW);
    const z1 = this.pz(COURT.halfW);
    ctx.fillRect(0, 0, w, z0);
    ctx.fillRect(0, z1, w, h - z1);
    ctx.fillRect(0, z0, x0, z1 - z0);
    ctx.fillRect(x1, z0, w - x1, z1 - z0);
    ctx.globalAlpha = 1;
  }

  drawMarkings(ctx) {
    const t = this.theme;
    const L = COURT.halfL;
    const W = COURT.halfW;
    const lw = 0.05 * PPM;
    ctx.lineWidth = lw;
    ctx.strokeStyle = t.lines;

    // Círculo central preenchido + logo
    ctx.fillStyle = t.centerFill;
    ctx.beginPath();
    ctx.arc(this.px(0), this.pz(0), COURT.centerCircleR * PPM, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this.drawCenterLogo(ctx);

    for (const s of [1, -1]) {
      const bx = s * COURT.basketX;
      // Garrafão pintado
      ctx.fillStyle = t.paint;
      const keyX0 = s > 0 ? COURT.ftLineX : -L;
      const keyX1 = s > 0 ? L : -COURT.ftLineX;
      ctx.fillRect(this.px(keyX0), this.pz(-COURT.keyHalfW), (keyX1 - keyX0) * PPM, COURT.keyHalfW * 2 * PPM);
      ctx.strokeRect(this.px(keyX0), this.pz(-COURT.keyHalfW), (keyX1 - keyX0) * PPM, COURT.keyHalfW * 2 * PPM);

      // Círculo do lance livre: metade sólida, metade tracejada
      const fx = s * COURT.ftLineX;
      ctx.beginPath();
      if (s > 0) ctx.arc(this.px(fx), this.pz(0), COURT.ftCircleR * PPM, Math.PI / 2, Math.PI * 1.5);
      else ctx.arc(this.px(fx), this.pz(0), COURT.ftCircleR * PPM, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.setLineDash([0.35 * PPM, 0.3 * PPM]);
      ctx.beginPath();
      if (s > 0) ctx.arc(this.px(fx), this.pz(0), COURT.ftCircleR * PPM, -Math.PI / 2, Math.PI / 2);
      else ctx.arc(this.px(fx), this.pz(0), COURT.ftCircleR * PPM, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Marcas laterais do garrafão
      for (const d of [1.75, 2.6, 3.45]) {
        for (const zz of [-1, 1]) {
          const x = s * (L - d);
          ctx.beginPath();
          ctx.moveTo(this.px(x), this.pz(zz * COURT.keyHalfW));
          ctx.lineTo(this.px(x), this.pz(zz * (COURT.keyHalfW + 0.1)));
          ctx.stroke();
        }
      }

      // Linha de três pontos
      const R = COURT.threeRadius;
      const sideZ = COURT.threeSideZ;
      const meetDx = Math.sqrt(R * R - sideZ * sideZ); // distância em x do aro até o encontro
      ctx.beginPath();
      ctx.moveTo(this.px(s * L), this.pz(-sideZ));
      ctx.lineTo(this.px(bx - s * meetDx), this.pz(-sideZ));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.px(s * L), this.pz(sideZ));
      ctx.lineTo(this.px(bx - s * meetDx), this.pz(sideZ));
      ctx.stroke();
      const a = Math.asin(sideZ / R);
      ctx.beginPath();
      if (s > 0) ctx.arc(this.px(bx), this.pz(0), R * PPM, Math.PI - a, Math.PI + a);
      else ctx.arc(this.px(bx), this.pz(0), R * PPM, -a, a);
      ctx.stroke();

      // Área restritiva
      ctx.beginPath();
      if (s > 0) ctx.arc(this.px(bx), this.pz(0), COURT.restrictedR * PPM, Math.PI / 2, Math.PI * 1.5);
      else ctx.arc(this.px(bx), this.pz(0), COURT.restrictedR * PPM, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Texto na área externa atrás da linha de fundo
      ctx.save();
      ctx.translate(this.px(s * (L + 1.0)), this.pz(0));
      ctx.rotate(s > 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${0.7 * PPM}px Arial Black, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.baselineText, 0, 0);
      ctx.restore();
    }

    // Linha central e limites
    ctx.beginPath();
    ctx.moveTo(this.px(0), this.pz(-W));
    ctx.lineTo(this.px(0), this.pz(W));
    ctx.stroke();
    ctx.lineWidth = lw * 1.4;
    ctx.strokeRect(this.px(-L), this.pz(-W), L * 2 * PPM, W * 2 * PPM);
  }

  drawCenterLogo(ctx) {
    const cx = this.px(0);
    const cy = this.pz(0);
    const r = 1.25 * PPM;
    // bola estilizada
    ctx.save();
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1405';
    ctx.lineWidth = 0.05 * PPM;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.moveTo(cx - r * 0.62, cy);
    ctx.lineTo(cx + r * 0.62, cy);
    ctx.moveTo(cx, cy - r * 0.62);
    ctx.lineTo(cx, cy + r * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.62, cy, r * 0.35, r * 0.55, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.62, cy, r * 0.35, r * 0.55, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    // texto
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 6;
    ctx.font = `italic 900 ${0.55 * PPM}px Arial Black, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(this.theme.centerText, cx, cy);
    ctx.fillText(this.theme.centerText, cx, cy);
    ctx.restore();
  }

  // Reflexo dinâmico do piso (qualidade alta)
  setReflections(enabled, renderer) {
    if (enabled && !this.reflector) {
      const geo = new THREE.PlaneGeometry(FLOOR_W, FLOOR_D);
      const size = new THREE.Vector2();
      renderer.getSize(size);
      this.reflector = new Reflector(geo, {
        textureWidth: Math.floor(size.x * 0.5),
        textureHeight: Math.floor(size.y * 0.5),
        color: 0x9a9a9a,
        clipBias: 0.003,
      });
      this.reflector.rotation.x = -Math.PI / 2;
      this.reflector.position.y = -0.002;
      this.group.add(this.reflector);
    }
    if (this.reflector) this.reflector.visible = enabled;
    this.floorMaterial.transparent = enabled;
    this.floorMaterial.opacity = enabled ? 0.88 : 1;
    this.floorMaterial.needsUpdate = true;
  }

  update(dt, ball) {
    for (const h of this.hoops) h.update(dt, ball);
  }
}
