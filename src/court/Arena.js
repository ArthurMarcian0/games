import * as THREE from 'three';
import { COURT } from '../config/Constants.js';
import { pick } from '../core/MathUtils.js';
import { SKIN_TONES } from '../data/Teams.js';

// Ambiente da arena: arquibancadas, público animado, bancos, placas de LED,
// placar eletrônico suspenso e iluminação.
const ADS = [
  { text: 'SKYHOOP', bg: '#0b1d3a', fg: '#ffb21e' },
  { text: 'VOLT ENERGIA', bg: '#111111', fg: '#39ff88' },
  { text: 'CAFÉ AURORA', bg: '#3a1a0b', fg: '#ffd9a0' },
  { text: 'PIXEL TELECOM', bg: '#1a0b3a', fg: '#7dd3fc' },
  { text: 'NORTE SEGUROS', bg: '#0b3a2a', fg: '#ffffff' },
  { text: 'TÊNIS ÓRBITA', bg: '#3a0b16', fg: '#ff7aa2' },
];

export class Arena {
  constructor(scene, theme, quality) {
    this.scene = scene;
    this.theme = theme;
    this.group = new THREE.Group();
    this.group.name = 'arena';
    scene.add(this.group);
    this.excitement = 0;
    this.time = 0;
    this.scoreState = null;

    this.buildEnvironment();
    this.buildStands();
    this.buildCrowd(quality === 'low' ? 0.55 : 1);
    this.buildCourtside();
    this.buildAdBoards();
    this.buildScoreboard();
    this.buildLights(quality);
  }

  buildEnvironment() {
    const t = this.theme;
    // piso externo
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 60),
      new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.9 }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.group.add(outer);

    // paredes e teto
    const wallMat = new THREE.MeshStandardMaterial({ color: t.wallColor, roughness: 0.95, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(76, 30, 58), wallMat);
    shell.position.y = 14.9;
    this.group.add(shell);

    // treliças do teto
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x2c313b, roughness: 0.6, metalness: 0.5 });
    for (let x = -30; x <= 30; x += 6) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 56), trussMat);
      b.position.set(x, 24, 0);
      this.group.add(b);
    }
    for (let z = -24; z <= 24; z += 8) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(74, 0.4, 0.3), trussMat);
      b.position.set(0, 23.5, z);
      this.group.add(b);
    }

    // bandeiras (fictícias) penduradas
    const banners = ['CAMPEÕES 2019', 'CAMPEÕES 2022', 'FINAL 2024', '#7 LENDA', '#33 LENDA'];
    banners.forEach((txt, i) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = i % 2 ? '#1558b0' : '#b0151f';
      ctx.fillRect(0, 0, 128, 256);
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 116, 244);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      txt.split(' ').forEach((w, k) => ctx.fillText(w, 64, 100 + k * 34));
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
      m.position.set(-12 + i * 6, 19, -27.5);
      this.group.add(m);
    });
  }

  // Arquibancada em degraus (seção extrudada)
  makeStand(length, rows, rowDepth, rowHeight, baseHeight) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    let y = baseHeight;
    shape.lineTo(0, y);
    for (let r = 0; r < rows; r++) {
      shape.lineTo(r * rowDepth + rowDepth, y);
      y += rowHeight;
      shape.lineTo(r * rowDepth + rowDepth, y);
    }
    shape.lineTo(rows * rowDepth, 0);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    geo.translate(0, 0, -length / 2);
    return geo;
  }

  buildStands() {
    const mat = new THREE.MeshStandardMaterial({ color: this.theme.standColor, roughness: 0.85 });
    this.standDefs = [];
    const rows = 14;
    const rowDepth = 0.85;
    const rowHeight = 0.48;
    const base = 1.1;
    // laterais (ao longo de x)
    for (const s of [1, -1]) {
      const geo = this.makeStand(38, rows, rowDepth, rowHeight, base);
      const m = new THREE.Mesh(geo, mat);
      // shape local: x = profundidade, extrusão em z → girar para alinhar profundidade com ±z
      m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      m.position.set(0, 0, s * 10.6);
      m.receiveShadow = true;
      this.group.add(m);
      this.standDefs.push({ axis: 'z', sign: s, start: 10.6, length: 38, rows, rowDepth, rowHeight, base });
    }
    // fundos (ao longo de z)
    for (const s of [1, -1]) {
      const geo = this.makeStand(26, rows - 2, rowDepth, rowHeight, base);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.y = s > 0 ? 0 : Math.PI;
      m.position.set(s * 17.6, 0, 0);
      m.receiveShadow = true;
      this.group.add(m);
      this.standDefs.push({ axis: 'x', sign: s, start: 17.6, length: 26, rows: rows - 2, rowDepth, rowHeight, base });
    }
  }

  buildCrowd(density) {
    const seats = [];
    for (const d of this.standDefs) {
      for (let r = 0; r < d.rows; r++) {
        const depth = d.start + r * d.rowDepth + d.rowDepth * 0.55;
        const y = d.base + r * d.rowHeight;
        for (let a = -d.length / 2 + 0.4; a < d.length / 2 - 0.3; a += 0.62) {
          if (Math.random() > 0.9 * density) continue;
          const jitter = (Math.random() - 0.5) * 0.12;
          if (d.axis === 'z') seats.push({ x: a + jitter, y, z: d.sign * depth, face: d.sign > 0 ? Math.PI : 0 });
          else seats.push({ x: d.sign * depth, y, z: a + jitter, face: d.sign > 0 ? -Math.PI / 2 : Math.PI / 2 });
        }
      }
    }

    this.crowdUniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
    const patch = (mat) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = this.crowdUniforms.uTime;
        shader.uniforms.uExcite = this.crowdUniforms.uExcite;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uExcite;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float h = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float bob = abs(sin(uTime * (2.2 + h * 3.0) + h * 40.0));
  float stand = step(0.3, h) * uExcite;
  transformed.y += bob * (0.025 + stand * 0.32) + stand * 0.25;
#endif`,
          );
      };
      return mat;
    };

    const bodyGeo = new THREE.BoxGeometry(0.42, 0.62, 0.3);
    bodyGeo.translate(0, 0.42, 0);
    const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
    headGeo.translate(0, 0.88, 0);
    const bodyMat = patch(new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    const headMat = patch(new THREE.MeshStandardMaterial({ roughness: 0.8 }));
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, seats.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, seats.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const shirtColors = ['#1666c5', '#1666c5', '#ffffff', '#c4262e', '#ffc928', '#333333', '#1f7a3a', '#e5e5e5', '#6a2ea0', '#0d47a1'];
    const c = new THREE.Color();
    seats.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.face);
      m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, 1, 1));
      bodies.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      bodies.setColorAt(i, c.set(pick(shirtColors)));
      heads.setColorAt(i, c.set(pick(SKIN_TONES)));
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.group.add(bodies, heads);
    this.crowd = [bodies, heads];
  }

  buildCourtside() {
    // mesa de controle e bancos
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.5 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(7, 0.85, 0.8), tableMat);
    table.position.set(0, 0.425, 9.0);
    table.castShadow = true;
    this.group.add(table);
    const front = this.makeLedTexture('MESA OFICIAL • SKYHOOP • MESA OFICIAL', '#0b1d3a', '#ffffff', 1024);
    const tf = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.7), new THREE.MeshBasicMaterial({ map: front, toneMapped: false }));
    tf.position.set(0, 0.45, 8.59);
    tf.rotation.y = Math.PI;
    this.group.add(tf);

    const chairMat = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.6 });
    this.benchMats = [];
    for (const side of [-1, 1]) {
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x1666c5, roughness: 0.6 });
      this.benchMats.push(benchMat);
      for (let i = 0; i < 7; i++) {
        const x = side * (5.2 + i * 0.85);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.55), chairMat);
        seat.position.set(x, 0.48, 9.35);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 0.08), benchMat);
        back.position.set(x, 0.85, 9.62);
        seat.castShadow = back.castShadow = true;
        this.group.add(seat, back);
      }
    }
    // reservas sentados (figuras simples, cor do time atualizada na partida)
    this.subs = [];
    const bodyGeo = new THREE.BoxGeometry(0.42, 0.62, 0.3);
    const headGeo = new THREE.SphereGeometry(0.12, 10, 8);
    for (const side of [-1, 1]) {
      const jersey = new THREE.MeshStandardMaterial({ color: 0x1666c5, roughness: 0.7 });
      for (let i = 0; i < 4; i++) {
        const x = side * (5.6 + i * 1.3);
        const body = new THREE.Mesh(bodyGeo, jersey);
        body.position.set(x, 0.85, 9.42);
        const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: pick(SKIN_TONES), roughness: 0.7 }));
        head.position.set(x, 1.32, 9.4);
        body.castShadow = true;
        this.group.add(body, head);
        this.subs.push({ body, head, side, baseY: 1.32, phase: Math.random() * 6 });
      }
      this.subs.push({ jersey, side });
    }
  }

  setTeamColors(homeColor, awayColor) {
    // banco da esquerda (-x) = casa, direita = visitante
    this.benchMats[0].color.set(homeColor);
    this.benchMats[1].color.set(awayColor);
    for (const s of this.subs) if (s.jersey) s.jersey.color.set(s.side < 0 ? homeColor : awayColor);
  }

  makeLedTexture(text, bg, fg, width = 1024) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fg;
    ctx.font = 'italic 900 58px Arial Black, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, c.width / 2, 50);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildAdBoards() {
    // placas de LED ao redor da quadra (rolagem animada)
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = 96;
    const ctx = c.getContext('2d');
    const seg = c.width / ADS.length;
    ADS.forEach((ad, i) => {
      ctx.fillStyle = ad.bg;
      ctx.fillRect(i * seg, 0, seg, 96);
      ctx.fillStyle = ad.fg;
      ctx.font = 'italic 900 44px Arial Black, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ad.text, i * seg + seg / 2, 50);
    });
    this.adTex = new THREE.CanvasTexture(c);
    this.adTex.colorSpace = THREE.SRGBColorSpace;
    this.adTex.wrapS = THREE.RepeatWrapping;
    this.adTex.repeat.set(3, 1);
    const mat = new THREE.MeshBasicMaterial({ map: this.adTex, toneMapped: false });
    mat.color.setScalar(0.85);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e });
    const mk = (w, x, z, ry) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.2), boxMat);
      box.position.set(x, 0.45, z);
      box.rotation.y = ry;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.8), mat);
      face.position.set(0, 0, 0.101);
      box.add(face);
      this.group.add(box);
    };
    mk(36, 0, -10.2, 0);
    mk(10, -10, 10.2, Math.PI);
    mk(10, 10, 10.2, Math.PI);
    mk(22, 17.0, 0, -Math.PI / 2);
    mk(22, -17.0, 0, Math.PI / 2);
  }

  buildScoreboard() {
    const g = new THREE.Group();
    g.position.set(0, 12.5, 0);
    this.scoreboard = g;
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.0, 4.2), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.4, metalness: 0.4 }));
    g.add(body);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e90ff, toneMapped: false });
    this.ringMat = ringMat;
    const ring = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.25, 4.4), ringMat);
    ring.position.y = -1.65;
    g.add(ring);
    const ring2 = ring.clone();
    ring2.position.y = 1.62;
    g.add(ring2);
    // cabos
    for (const x of [-2, 2]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 10), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      cable.position.set(x, 6.5, 0);
      g.add(cable);
    }

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 300;
    this.sbCanvas = c;
    this.sbTex = new THREE.CanvasTexture(c);
    this.sbTex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = new THREE.MeshBasicMaterial({ map: this.sbTex, toneMapped: false });
    const faces = [
      [0, 0, 2.11, 0, 5.0],
      [0, 0, -2.11, Math.PI, 5.0],
      [2.61, 0, 0, Math.PI / 2, 4.0],
      [-2.61, 0, 0, -Math.PI / 2, 4.0],
    ];
    for (const [x, y, z, ry, w] of faces) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.8), screenMat);
      p.position.set(x, y, z);
      p.rotation.y = ry;
      g.add(p);
    }
    this.group.add(g);
    this.updateScoreboard({ home: 'CASA', away: 'VIS', homeScore: 0, awayScore: 0, clock: '00:00', period: 'SKYHOOP', homeColor: '#1666c5', awayColor: '#c4262e' });
  }

  updateScoreboard(s) {
    const key = JSON.stringify(s);
    if (key === this.scoreState) return;
    this.scoreState = key;
    const ctx = this.sbCanvas.getContext('2d');
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, 512, 300);
    ctx.fillStyle = s.homeColor;
    ctx.fillRect(10, 10, 240, 60);
    ctx.fillStyle = s.awayColor;
    ctx.fillRect(262, 10, 240, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.home, 130, 42);
    ctx.fillText(s.away, 382, 42);
    ctx.fillStyle = '#ffb21e';
    ctx.font = 'bold 110px "Courier New", monospace';
    ctx.fillText(String(s.homeScore), 130, 148);
    ctx.fillText(String(s.awayScore), 382, 148);
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 60px "Courier New", monospace';
    ctx.fillText(s.clock, 256, 240);
    ctx.fillStyle = '#9ad1ff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(s.period, 256, 285);
    this.sbTex.needsUpdate = true;
  }

  buildLights(quality) {
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a2a1e, 0.5);
    this.group.add(hemi);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    const key = new THREE.DirectionalLight(0xfff4e6, 1.9);
    key.position.set(6, 22, 8);
    key.target.position.set(0, 0, 0);
    key.castShadow = quality !== 'low';
    const ms = quality === 'high' ? 2048 : 1024;
    key.shadow.mapSize.set(ms, ms);
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    key.shadow.camera.near = 5;
    key.shadow.camera.far = 45;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.keyLight = key;
    this.group.add(key, key.target);

    // refletores principais da arena (sem sombra para manter desempenho)
    this.spots = [];
    const spotCount = quality === 'low' ? 0 : 4;
    const spotPos = [
      [-9, 18, -6],
      [9, 18, 6],
      [-9, 18, 6],
      [9, 18, -6],
    ];
    for (let i = 0; i < spotCount; i++) {
      const sp = new THREE.SpotLight(0xfff1dd, 420, 40, Math.PI / 7, 0.6, 1.6);
      sp.position.set(...spotPos[i]);
      sp.target.position.set(spotPos[i][0] * 0.7, 0, spotPos[i][2] * 0.3);
      this.group.add(sp, sp.target);
      this.spots.push(sp);
    }

    // luminárias visíveis com brilho aditivo
    const glowTex = this.makeGlowTexture();
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3dd, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    for (let x = -15; x <= 15; x += 6) {
      for (const z of [-7, 0, 7]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.9), fixtureMat);
        f.position.set(x, 21.5, z);
        this.group.add(f);
        const sprite = new THREE.Sprite(glowMat);
        sprite.position.set(x, 21.3, z);
        sprite.scale.setScalar(4.5);
        this.group.add(sprite);
      }
    }
  }

  makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,240,210,0.6)');
    g.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  setShadows(enabled, size) {
    this.keyLight.castShadow = enabled;
    if (size && this.keyLight.shadow.mapSize.x !== size) {
      this.keyLight.shadow.mapSize.set(size, size);
      if (this.keyLight.shadow.map) {
        this.keyLight.shadow.map.dispose();
        this.keyLight.shadow.map = null;
      }
    }
  }

  cheer(amount = 1) {
    this.excitement = Math.min(1, this.excitement + amount);
  }

  update(dt) {
    this.time += dt;
    this.excitement = Math.max(0, this.excitement - dt * 0.35);
    this.crowdUniforms.uTime.value = this.time;
    this.crowdUniforms.uExcite.value = this.excitement;
    this.adTex.offset.x = (this.time * 0.03) % 1;
    const hue = (this.time * 0.05) % 1;
    this.ringMat.color.setHSL(0.58 + Math.sin(this.time * 0.7) * 0.05 + this.excitement * hue * 0.4, 0.9, 0.5);
    for (const s of this.subs) {
      if (s.head) s.head.position.y = s.baseY + Math.abs(Math.sin(this.time * 6 + s.phase)) * this.excitement * 0.25;
    }
  }
}
