import * as THREE from 'three';
import { pick } from '../core/MathUtils.js';
import { SKIN_TONES } from '../data/Teams.js';
import { createCrowd } from './Crowd.js';

// Cenário pós-apocalíptico (quadras da campanha): céu, ruínas ao redor,
// cerca de alambrado, sucata, fogueiras em tambores, público de
// sobreviventes, placar improvisado, holofotes e partículas no ar.
// Tem a mesma interface pública da Arena (setTeamColors, updateScoreboard,
// setShadows, cheer, update), então o restante do jogo não muda.
//
// O conteúdo de cada quadra vem de theme.env (ver CourtThemes.js).

const RAGS = ['#5b4a3a', '#3e3a33', '#6b5b45', '#2f3a33', '#4a3b30', '#55524a', '#7a6248', '#383028', '#5d4636'];

function seeded(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export class Wasteland {
  constructor(scene, theme, quality) {
    this.scene = scene;
    this.theme = theme;
    this.env = theme.env;
    this.quality = quality;
    this.rnd = seeded(theme.seed || 11);
    this.group = new THREE.Group();
    this.group.name = 'wasteland';
    scene.add(this.group);
    this.excitement = 0;
    this.time = 0;
    this.scoreState = null;
    this.fires = [];
    this.flags = [];
    this.mats = {};

    this.buildSky();
    this.buildGround();
    this.buildRuins();
    this.buildFence();
    this.buildProps();
    this.buildFires();
    this.buildCrowd(quality === 'low' ? 0.5 : 1);
    this.buildScoreboard();
    this.buildLights(quality);
    this.buildParticles(quality);
  }

  // ------------------------------------------------------------------
  material(key, make) {
    if (!this.mats[key]) this.mats[key] = make();
    return this.mats[key];
  }

  rust() {
    return this.material('rust', () => {
      const tex = canvasTex(
        128,
        128,
        (ctx, w, h) => {
          const r = seeded(5);
          ctx.fillStyle = '#6b3b22';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 300; i++) {
            const c = r() < 0.5 ? '120,60,25' : r() < 0.5 ? '60,35,22' : '150,85,40';
            ctx.fillStyle = `rgba(${c},${0.2 + r() * 0.5})`;
            ctx.beginPath();
            ctx.arc(r() * w, r() * h, 1 + r() * 8, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        [2, 2],
      );
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.25 });
    });
  }

  concrete() {
    return this.material('concrete', () => {
      const tex = canvasTex(
        128,
        128,
        (ctx, w, h) => {
          const r = seeded(9);
          ctx.fillStyle = '#7d7a73';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 900; i++) {
            const v = 70 + r() * 80;
            ctx.fillStyle = `rgba(${v},${v},${v * 0.95},0.35)`;
            ctx.fillRect(r() * w, r() * h, 2, 2);
          }
          ctx.strokeStyle = 'rgba(30,28,26,0.6)';
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            let x = r() * w;
            let y = 0;
            ctx.moveTo(x, y);
            while (y < h) {
              x += (r() - 0.5) * 14;
              y += 6 + r() * 10;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        },
        [1, 1],
      );
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    });
  }

  add(mesh, cast = true) {
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------
  buildSky() {
    const e = this.env;
    const tex = canvasTex(4, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, e.sky[0]);
      g.addColorStop(0.55, e.sky[1]);
      g.addColorStop(1, e.sky[2] || e.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(150, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    dome.renderOrder = -1;
    this.group.add(dome);

    // sol/lua velado pela poeira
    if (e.sunDisc) {
      const disc = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glowTexture(), color: e.sunDisc, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }),
      );
      const d = new THREE.Vector3(...e.sunPos).normalize().multiplyScalar(130);
      disc.position.copy(d);
      disc.scale.setScalar(e.sunSize || 30);
      this.group.add(disc);
    }
  }

  buildGround() {
    const e = this.env;
    const tex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        const r = seeded(21);
        ctx.fillStyle = e.ground;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2200; i++) {
          const v = r() < 0.5 ? 'rgba(0,0,0,' : 'rgba(255,240,220,';
          ctx.fillStyle = v + (0.03 + r() * 0.07) + ')';
          ctx.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 4);
        }
        for (let i = 0; i < 8; i++) {
          ctx.strokeStyle = 'rgba(0,0,0,0.16)';
          ctx.lineWidth = 1 + r() * 2;
          ctx.beginPath();
          let x = r() * w;
          let y = r() * h;
          ctx.moveTo(x, y);
          for (let k = 0; k < 8; k++) {
            x += (r() - 0.5) * 50;
            y += (r() - 0.5) * 50;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      },
      [24, 24],
    );
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    this.group.add(ground);

    // dunas (deserto)
    if (e.dunes) {
      const mat = new THREE.MeshStandardMaterial({ color: e.ground, roughness: 1 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + this.rnd();
        const R = 45 + this.rnd() * 40;
        const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        dune.scale.set(14 + this.rnd() * 16, 3 + this.rnd() * 6, 8 + this.rnd() * 10);
        dune.position.set(Math.cos(a) * R, -0.5, Math.sin(a) * R);
        dune.rotation.y = a;
        this.add(dune, false);
      }
    }
  }

  windowTexture(seed, lit) {
    return canvasTex(128, 256, (ctx, w, h) => {
      const r = seeded(seed);
      ctx.fillStyle = '#3a3733';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        const v = 30 + r() * 60;
        ctx.fillStyle = `rgba(${v},${v * 0.95},${v * 0.9},0.4)`;
        ctx.fillRect(r() * w, r() * h, 3, 3);
      }
      for (let y = 10; y < h - 10; y += 22) {
        for (let x = 8; x < w - 8; x += 20) {
          const k = r();
          if (k < lit) ctx.fillStyle = `rgba(255,${150 + r() * 60},70,${0.6 + r() * 0.4})`;
          else if (k < 0.45) ctx.fillStyle = '#0b0a09';
          else ctx.fillStyle = '#16140f';
          ctx.fillRect(x, y, 11, 13);
        }
      }
      // marcas de fogo/fuligem
      for (let i = 0; i < 6; i++) {
        const x = r() * w;
        const y = r() * h;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + r() * 40);
        g.addColorStop(0, 'rgba(0,0,0,0.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    });
  }

  buildRuins() {
    const e = this.env;
    const count = e.ruins ?? 22;
    if (!count) return;
    const texA = this.windowTexture(31, e.litWindows ?? 0.04);
    const texB = this.windowTexture(57, e.litWindows ?? 0.04);
    const tint = new THREE.Color(e.ruinTint || '#9a948a');
    const r = this.rnd;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.2;
      const R = 48 + r() * 40;
      const w = 8 + r() * 12;
      const d = 8 + r() * 10;
      const h = (e.ruinHeight || 22) * (0.4 + r() * 0.9);
      const tex = (r() < 0.5 ? texA : texB).clone();
      tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.round(w / 6), Math.round(h / 10));
      const mat = new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.95 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(Math.cos(a) * R, h / 2 - 0.5, Math.sin(a) * R);
      b.rotation.y = -a + (r() - 0.5) * 0.4;
      b.rotation.z = (r() - 0.5) * (e.ruinLean ?? 0.08);
      this.add(b, false);
      // topo destruído: blocos menores e vigas tortas
      for (let k = 0; k < 3; k++) {
        if (r() < 0.4) continue;
        const cw = w * (0.2 + r() * 0.4);
        const ch = 2 + r() * 5;
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, d * (0.3 + r() * 0.5)), mat);
        chunk.position.set((r() - 0.5) * (w - cw), h / 2 + ch / 2 - 0.3, (r() - 0.5) * 2);
        chunk.rotation.z = (r() - 0.5) * 0.5;
        b.add(chunk);
      }
      if (r() < 0.5) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), this.rust());
        beam.position.set((r() - 0.5) * w * 0.7, h / 2 + 2, 0);
        beam.rotation.z = (r() - 0.5) * 1.2;
        b.add(beam);
      }
    }
  }

  buildFence() {
    const e = this.env;
    if (e.fence === false) return;
    const tex = canvasTex(
      64,
      64,
      (ctx) => {
        ctx.clearRect(0, 0, 64, 64);
        ctx.strokeStyle = 'rgba(190,190,180,1)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(64, 64);
        ctx.moveTo(64, 0);
        ctx.lineTo(0, 64);
        ctx.stroke();
      },
      [1, 1],
    );
    const fenceMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, color: 0xb0a898 });
    const postMat = this.rust();
    const H = 3.6;
    const segs = [
      // [x0, z0, x1, z1]
      [-21, -14, 21, -14],
      [-21, 14, -6, 14],
      [6, 14, 21, 14],
      [-21, -14, -21, 14],
      [21, -14, 21, 14],
    ];
    for (const [x0, z0, x1, z1] of segs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const t = tex.clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(len / 0.6, H / 0.6);
      const mat = fenceMat.clone();
      mat.map = t;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, H), mat);
      plane.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
      plane.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      this.group.add(plane);
      const n = Math.ceil(len / 3.5);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H + 0.2, 6), postMat);
        post.position.set(x0 + (x1 - x0) * k, (H + 0.2) / 2, z0 + (z1 - z0) * k);
        post.rotation.z = (this.rnd() - 0.5) * 0.08;
        this.group.add(post);
      }
      // arame farpado no topo
      const wire = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 4, 8), postMat);
      for (let i = 0; i < len / 0.5; i++) {
        const k = i / (len / 0.5);
        const w = wire.clone();
        w.position.set(x0 + (x1 - x0) * k, H + 0.18, z0 + (z1 - z0) * k);
        w.rotation.y = plane.rotation.y;
        this.group.add(w);
      }
    }

    // bandeiras de pano com a cor dos times, presas na cerca
    const flagGeo = new THREE.PlaneGeometry(2.2, 1.3, 8, 1);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x777777, side: THREE.DoubleSide, roughness: 1 });
      const f = new THREE.Mesh(flagGeo, mat);
      const x = -15 + i * 6;
      f.position.set(x, 2.6, -13.95);
      this.group.add(f);
      this.flags.push({ mesh: f, side: x < 0 ? 0 : 1, phase: i });
    }
  }

  // ------------------------------------------------------------------
  car(x, z, rot, color) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.8), body);
    b.position.y = 0.65;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 1.6), body);
    cab.position.set(-0.2, 1.35, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.45, 1.5), dark);
    glass.position.set(-0.2, 1.36, 0);
    g.add(b, cab, glass);
    for (const [wx, wz] of [[1.3, 0.85], [-1.3, 0.85], [1.3, -0.85], [-1.3, -0.85]]) {
      if (this.rnd() < 0.25) continue; // rodas faltando
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10), dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.34, wz);
      g.add(w);
    }
    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    g.position.set(x, this.rnd() < 0.3 ? -0.15 : 0, z);
    g.rotation.set((this.rnd() - 0.5) * 0.1, rot, (this.rnd() - 0.5) * 0.12);
    this.group.add(g);
    return g;
  }

  container(x, y, z, rot, color) {
    const tex = this.material('corrugated', () =>
      canvasTex(
        128,
        64,
        (ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < w; i += 8) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(i, 0, 3, h);
          }
          const r = seeded(77);
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(110,55,20,${0.2 + r() * 0.5})`;
            ctx.beginPath();
            ctx.arc(r() * w, r() * h, 2 + r() * 8, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        [3, 1],
      ),
    );
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.8, metalness: 0.3 }));
    m.position.set(x, y + 1.3, z);
    m.rotation.y = rot;
    return this.add(m);
  }

  barrel(x, z, toxic = false) {
    const mat = toxic
      ? this.material('toxicBarrel', () => new THREE.MeshStandardMaterial({ color: 0xc9b51c, roughness: 0.7, metalness: 0.3 }))
      : this.rust();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), mat);
    b.position.set(x, 0.45, z);
    if (this.rnd() < 0.3) {
      b.rotation.z = Math.PI / 2;
      b.position.y = 0.3;
    }
    this.add(b);
    if (toxic) {
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.9, 16),
        this.material('ooze', () => new THREE.MeshBasicMaterial({ color: 0x7dff3a, transparent: true, opacity: 0.55, depthWrite: false })),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x + 0.5, 0.02, z + 0.3);
      this.group.add(glow);
    }
    return b;
  }

  tires(x, z) {
    const mat = this.material('tire', () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }));
    const n = 2 + Math.floor(this.rnd() * 4);
    for (let i = 0; i < n; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 14), mat);
      t.rotation.x = Math.PI / 2;
      t.position.set(x + (this.rnd() - 0.5) * 0.1, 0.17 + i * 0.32, z + (this.rnd() - 0.5) * 0.1);
      this.add(t);
    }
  }

  barrier(x, z, rot) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.6), this.concrete());
    m.position.set(x, 0.45, z);
    m.rotation.y = rot;
    return this.add(m);
  }

  scrapPile(x, z, size = 1) {
    const r = this.rnd;
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry((0.5 + r() * 2) * size, (0.2 + r() * 0.8) * size, (0.4 + r()) * size), r() < 0.6 ? this.rust() : this.concrete());
      m.position.set(x + (r() - 0.5) * 3 * size, r() * 1.2 * size, z + (r() - 0.5) * 2.5 * size);
      m.rotation.set(r() * 1.2, r() * 3, r() * 1.2);
      this.add(m);
    }
  }

  billboard(x, z, rot, text) {
    const g = new THREE.Group();
    const tex = canvasTex(512, 192, (ctx, w, h) => {
      const r = seeded(text.length * 13);
      ctx.fillStyle = '#2b3b4a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e8d9a8';
      ctx.font = 'italic 900 70px Arial Black, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
      // desbotado e rasgado
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${40 + r() * 40},${35 + r() * 30},${30 + r() * 20},${0.4 + r() * 0.6})`;
        ctx.fillRect(r() * w, r() * h, 10 + r() * 60, 6 + r() * 40);
      }
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 0.2), [
      this.rust(),
      this.rust(),
      this.rust(),
      this.rust(),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
      this.rust(),
    ]);
    board.position.y = 8;
    board.rotation.z = (this.rnd() - 0.5) * 0.2;
    g.add(board);
    for (const px of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, 0.3), this.rust());
      leg.position.set(px, 4, -0.3);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    g.traverse((m) => m.isMesh && (m.castShadow = true));
    this.group.add(g);
  }

  overpass() {
    // viaduto desabado atravessando o fundo
    const mat = this.concrete();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(70, 1.6, 9), mat);
    deck.position.set(-6, 9, -30);
    deck.rotation.z = 0.02;
    this.add(deck, false);
    const broken = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 9), mat);
    broken.position.set(36, 4.6, -30);
    broken.rotation.z = -0.5;
    this.add(broken, false);
    for (const x of [-34, -18, -2, 14]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 2.4), mat);
      p.position.set(x, 4.3, -30);
      this.add(p, false);
    }
  }

  coolingTower(x, z, scale = 1) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = 7 - 4.2 * Math.sin(t * Math.PI * 0.85) + t * 1.2;
      pts.push(new THREE.Vector2(r * scale, t * 26 * scale));
    }
    const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.95, side: THREE.DoubleSide }));
    tower.position.set(x, -0.5, z);
    this.add(tower, false);
    return tower;
  }

  crane(x, z, rot) {
    const mat = this.material('crane', () => new THREE.MeshStandardMaterial({ color: 0xb4682a, roughness: 0.8, metalness: 0.3 }));
    const g = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), mat);
    mast.position.y = 11;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(24, 0.9, 0.9), mat);
    jib.position.set(6, 21.5, 0);
    jib.rotation.z = -0.05;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 14, 4), this.rust());
    cable.position.set(15, 14.5, 0);
    g.add(mast, jib, cable);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.group.add(g);
  }

  // Cada quadra tem seu conjunto de objetos (env.props)
  buildProps() {
    const e = this.env;
    const r = this.rnd;
    const props = new Set(e.props || []);
    const carColors = [0x6a5f4e, 0x3d4a52, 0x7a2e22, 0x4f5a3a, 0x8a7a5a, 0x2e2e33];

    // sempre: barreiras, pneus e sucata nos cantos (fora da área de jogo)
    for (const [x, z, rot] of [[-19.5, 11.5, 0.3], [19.5, 11.5, -0.3], [-19.5, -11.5, -0.3], [19.5, -11.5, 0.3]]) this.barrier(x, z, rot);
    for (const [x, z] of [[-18.5, 12.6], [18.6, -12.8], [17.6, 12.9], [-18, -12.7]]) this.tires(x, z);
    this.scrapPile(-27, -19, 1.2);
    this.scrapPile(28, 17, 1.1);

    if (props.has('junkyard')) {
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2;
        const R = 26 + r() * 14;
        const car = this.car(Math.cos(a) * R, Math.sin(a) * R, r() * 6, pick(carColors));
        if (r() < 0.4) {
          // carros empilhados
          const top = this.car(car.position.x, car.position.z, r() * 6, pick(carColors));
          top.position.y = 1.7;
        }
      }
      this.scrapPile(-30, 10, 2);
      this.scrapPile(26, -22, 2.2);
      this.billboard(-8, -34, 0, 'FERRO VELHO');
    }
    if (props.has('overpass')) {
      this.overpass();
      for (let i = 0; i < 6; i++) this.car(-26 + i * 10 + r() * 3, 20 + r() * 4, r() * 0.6 - 0.3 + (i % 2) * Math.PI, pick(carColors));
      this.billboard(22, -24, -0.5, 'VOLT ENERGIA');
    }
    if (props.has('port')) {
      const colors = [0x1d5f8a, 0xa63a22, 0x2f7a3b, 0xc9a227, 0x7a3b8a, 0x8a8a8a];
      for (let i = 0; i < 8; i++) {
        const x = -24 + i * 6.6;
        const base = this.container(x, 0, -21 - r() * 2, (r() - 0.5) * 0.15, pick(colors));
        if (r() < 0.7) this.container(x + (r() - 0.5), 2.6, base.position.z, (r() - 0.5) * 0.3, pick(colors));
        if (r() < 0.3) this.container(x, 5.2, base.position.z, (r() - 0.5) * 0.3, pick(colors));
      }
      for (const z of [-8, 8]) {
        this.container(-27, 0, z, Math.PI / 2, pick(colors));
        this.container(27, 0, z, Math.PI / 2, pick(colors));
      }
      this.crane(-30, -36, 0.4);
      this.crane(24, -40, 2.4);
    }
    if (props.has('toxic')) {
      for (let i = 0; i < 18; i++) {
        const a = r() * Math.PI * 2;
        const R = 16 + r() * 10;
        const x = Math.cos(a) * R * 1.3;
        const z = Math.sin(a) * R;
        if (Math.abs(x) < 21.5 && Math.abs(z) < 14.5) continue;
        this.barrel(x, z, true);
      }
      this.billboard(-14, -30, 0.1, 'PERIGO • QUÍMICO');
    }
    if (props.has('plant')) {
      this.coolingTower(-34, -46, 1.3);
      this.coolingTower(-4, -58, 1.5);
      this.coolingTower(38, -44, 1.1);
      for (let i = 0; i < 5; i++) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 18, 0.5), this.rust());
        pole.position.set(-40 + i * 20, 9, 30);
        pole.rotation.z = (r() - 0.5) * 0.2;
        this.add(pole, false);
      }
    }
    if (props.has('ash')) {
      for (let i = 0; i < 10; i++) {
        const a = r() * Math.PI * 2;
        const R = 25 + r() * 15;
        this.car(Math.cos(a) * R, Math.sin(a) * R, r() * 6, 0x2a2826);
      }
      this.billboard(16, -28, -0.3, 'CIDADE CINZA');
    }
    if (props.has('desert')) {
      for (let i = 0; i < 5; i++) {
        const a = r() * Math.PI * 2;
        const R = 26 + r() * 12;
        const c = this.car(Math.cos(a) * R, Math.sin(a) * R, r() * 6, 0x8a7a5a);
        c.position.y = -0.4;
      }
      this.billboard(-20, -26, 0.4, 'POSTO 66');
    }
    if (props.has('citadel')) {
      // muralha de sucata e torres de vigia
      const wallMat = this.rust();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const R = 34;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(8, 7 + r() * 4, 1.2), r() < 0.5 ? wallMat : this.concrete());
        seg.position.set(Math.cos(a) * R * 1.25, 3.5, Math.sin(a) * R);
        seg.rotation.y = -a + Math.PI / 2;
        seg.rotation.z = (r() - 0.5) * 0.1;
        this.add(seg, false);
      }
      for (const [x, z] of [[-30, -24], [30, -24], [-30, 24], [30, 24]]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 14, 3), wallMat);
        tower.position.set(x, 7, z);
        this.add(tower, false);
        const top = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, 4.5), this.concrete());
        top.position.set(x, 14.6, z);
        this.add(top, false);
      }
      this.billboard(0, -32, 0, 'OS SOBERANOS');
    }
  }

  // Fogueiras em tambores, com luz tremulante (só nas qualidades média/alta)
  buildFires() {
    const e = this.env;
    const n = e.fires ?? 4;
    const spots = [[-19.6, 0], [19.6, 0], [-12, -13.2], [12, -13.2], [-12, 13.4], [12, 13.4], [-19.6, -8], [19.6, 8]];
    const flameTex = this.flameTexture();
    const lights = this.quality === 'low' ? 0 : this.quality === 'medium' ? 2 : 4;
    for (let i = 0; i < Math.min(n, spots.length); i++) {
      const [x, z] = spots[i];
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.95, 12, 1, true), this.rust());
      drum.position.set(x, 0.475, z);
      this.add(drum);
      const flames = [];
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: flameTex, color: e.fireColor || 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
        );
        s.position.set(x + (Math.random() - 0.5) * 0.2, 1.25 + k * 0.15, z + (Math.random() - 0.5) * 0.2);
        s.scale.set(0.8, 1.2, 1);
        this.group.add(s);
        flames.push(s);
      }
      let light = null;
      if (i < lights) {
        light = new THREE.PointLight(e.fireColor || 0xff8a2a, 9, 14, 1.6);
        light.position.set(x, 1.8, z);
        this.group.add(light);
      }
      this.fires.push({ flames, light, phase: Math.random() * 10, x, z });
    }
  }

  flameTexture() {
    return canvasTex(64, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.6, h * 0.55);
      g.addColorStop(0, 'rgba(255,255,220,1)');
      g.addColorStop(0.25, 'rgba(255,190,80,0.9)');
      g.addColorStop(0.6, 'rgba(255,90,20,0.45)');
      g.addColorStop(1, 'rgba(120,20,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  glowTexture() {
    if (this._glow) return this._glow;
    this._glow = canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,240,210,0.55)');
      g.addColorStop(1, 'rgba(255,220,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
    return this._glow;
  }

  // Público de sobreviventes em pé fora da cerca, sobre sucata e contêineres
  buildCrowd(density) {
    const e = this.env;
    const seats = [];
    const r = this.rnd;
    const amount = (e.crowd ?? 1) * density;
    const row = (x0, x1, z, face, y = 0, rows = 3) => {
      for (let k = 0; k < rows; k++) {
        for (let x = x0; x < x1; x += 0.7) {
          if (r() > 0.75 * amount) continue;
          seats.push({ x: x + (r() - 0.5) * 0.3, y: y + (k > 1 ? 0.4 : 0), z: z + Math.sign(z) * k * 0.75 + (r() - 0.5) * 0.25, face, scale: 0.95 + r() * 0.15 });
        }
      }
    };
    // laterais (fora da cerca), com um vão perto da câmera de transmissão
    row(-20, -6.5, -15, 0, 0, 4);
    row(6.5, 20, -15, 0, 0, 4);
    row(-6, 6, -15.2, 0, 0, 2);
    row(-20, -6.5, 15, Math.PI, 0, 3);
    row(6.5, 20, 15, Math.PI, 0, 3);
    // fundos
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        for (let z = -12; z < 12; z += 0.7) {
          if (r() > 0.7 * amount) continue;
          seats.push({ x: s * (22 + k * 0.75), y: 0, z: z + (r() - 0.5) * 0.3, face: s > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 0.95 + r() * 0.15 });
        }
      }
    }
    // alguns em cima de uma plataforma de sucata
    const plat = new THREE.Mesh(new THREE.BoxGeometry(12, 1.4, 3), this.rust());
    plat.position.set(0, 0.7, -18.5);
    this.add(plat);
    for (let x = -5.5; x < 5.5; x += 0.75) if (r() < 0.8 * amount) seats.push({ x, y: 1.4, z: -18.2, face: 0 });
    if (!seats.length) return;
    const crowd = createCrowd(seats, { shirtColors: e.crowdColors || RAGS, skinTones: SKIN_TONES, bodyRoughness: 1 });
    this.crowdUniforms = crowd.uniforms;
    this.group.add(...crowd.meshes);
  }

  // Placar pintado em chapa, preso a um andaime atrás da lateral
  buildScoreboard() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    this.sbCanvas = c;
    this.sbTex = new THREE.CanvasTexture(c);
    this.sbTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: this.sbTex, toneMapped: false }));
    face.position.set(0, 7.2, -19.9);
    this.group.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.4, 0.3), this.rust());
    back.position.set(0, 7.2, -20.1);
    this.add(back);
    for (const x of [-3.6, 3.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 9.4, 0.25), this.rust());
      leg.position.set(x, 4.7, -20.2);
      this.add(leg);
    }
    // lâmpadas penduradas sobre o placar
    for (const x of [-2.5, 0, 2.5]) {
      const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture(), color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      bulb.position.set(x, 9.6, -19.7);
      bulb.scale.setScalar(1.4);
      this.group.add(bulb);
    }
    this.updateScoreboard({ home: 'CASA', away: 'FORA', homeScore: 0, awayScore: 0, clock: '0:00', period: '', homeColor: '#888', awayColor: '#666' });
  }

  updateScoreboard(s) {
    const key = JSON.stringify(s);
    if (key === this.scoreState) return;
    this.scoreState = key;
    const ctx = this.sbCanvas.getContext('2d');
    ctx.fillStyle = '#1d1a16';
    ctx.fillRect(0, 0, 512, 256);
    // tinta escorrida
    ctx.fillStyle = s.homeColor;
    ctx.fillRect(16, 16, 228, 46);
    ctx.fillStyle = s.awayColor;
    ctx.fillRect(268, 16, 228, 46);
    ctx.fillStyle = '#f2ead8';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.home, 130, 40);
    ctx.fillText(s.away, 382, 40);
    ctx.fillStyle = '#ffd36a';
    ctx.font = 'bold 100px "Courier New", monospace';
    ctx.fillText(String(s.homeScore), 130, 134);
    ctx.fillText(String(s.awayScore), 382, 134);
    ctx.fillStyle = '#ff5a3a';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText(s.clock, 256, 212);
    ctx.fillStyle = '#c9c0a8';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(s.period, 256, 246);
    this.sbTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------
  buildLights(quality) {
    const e = this.env;
    const hemi = new THREE.HemisphereLight(e.hemi[0], e.hemi[1], e.hemiIntensity ?? 0.7);
    this.group.add(hemi);
    this.group.add(new THREE.AmbientLight(e.ambient || 0xffffff, e.ambientIntensity ?? 0.12));

    const key = new THREE.DirectionalLight(e.sun, e.sunIntensity ?? 1.6);
    key.position.set(...e.sunPos);
    key.target.position.set(0, 0, 0);
    key.castShadow = quality !== 'low';
    const ms = quality === 'high' ? 2048 : 1024;
    key.shadow.mapSize.set(ms, ms);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    key.shadow.camera.near = 5;
    key.shadow.camera.far = 90;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.03;
    this.keyLight = key;
    this.group.add(key, key.target);

    // holofotes improvisados em postes
    const poles = [[-18, -12.5], [18, -12.5], [-18, 12.5], [18, 12.5]];
    const spots = quality === 'low' ? 0 : e.floodlights ?? 4;
    const glowMat = new THREE.SpriteMaterial({ map: this.glowTexture(), color: e.floodColor || 0xfff1d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    poles.forEach(([x, z], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 8), this.rust());
      pole.position.set(x * 1.12, 5.5, z * 1.14);
      this.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.5), this.rust());
      lamp.position.set(x * 1.12, 11, z * 1.14);
      lamp.lookAt(0, 0, 0);
      this.group.add(lamp);
      if (e.floodlights === 0) return;
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(x * 1.08, 10.9, z * 1.1);
      glow.scale.setScalar(3.2);
      this.group.add(glow);
      if (i < spots) {
        const sp = new THREE.SpotLight(e.floodColor || 0xfff1d0, e.floodIntensity ?? 260, 40, Math.PI / 6, 0.6, 1.5);
        sp.position.set(x * 1.08, 10.8, z * 1.1);
        sp.target.position.set(x * 0.35, 0, z * 0.3);
        this.group.add(sp, sp.target);
      }
    });
  }

  // Poeira, cinzas, esporos, brasas ou chuva no ar
  buildParticles(quality) {
    const p = this.env.particles;
    if (!p) return;
    const n = Math.round((p.count || 700) * (quality === 'low' ? 0.4 : 1));
    const pos = new Float32Array(n * 3);
    this.partVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
      this.partVel[i * 3] = (p.drift?.[0] ?? 0) + (Math.random() - 0.5) * (p.jitter ?? 0.3);
      this.partVel[i * 3 + 1] = (p.drift?.[1] ?? -0.3) * (0.6 + Math.random() * 0.8);
      this.partVel[i * 3 + 2] = (p.drift?.[2] ?? 0) + (Math.random() - 0.5) * (p.jitter ?? 0.3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: p.color,
      size: p.size || 0.08,
      map: this.glowTexture(),
      transparent: true,
      opacity: p.opacity ?? 0.8,
      depthWrite: false,
      blending: p.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
  }

  // ------------------------------------------------------------------
  setTeamColors(homeColor, awayColor) {
    for (const f of this.flags) f.mesh.material.color.set(f.side === 0 ? homeColor : awayColor);
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
    const t = this.time;
    this.excitement = Math.max(0, this.excitement - dt * 0.35);
    if (this.crowdUniforms) {
      this.crowdUniforms.uTime.value = t;
      this.crowdUniforms.uExcite.value = this.excitement;
    }
    for (const f of this.fires) {
      const k = 0.75 + 0.25 * Math.sin(t * 13 + f.phase) * Math.sin(t * 7.3 + f.phase * 2);
      f.flames.forEach((s, i) => {
        s.scale.set(0.7 + 0.2 * Math.sin(t * 9 + i + f.phase), (1.0 + 0.35 * Math.sin(t * 11 + i * 2 + f.phase)) * k, 1);
        s.position.y = 1.2 + i * 0.16 + 0.05 * Math.sin(t * 8 + i);
      });
      if (f.light) f.light.intensity = 7 + 4 * k;
    }
    for (const f of this.flags) {
      const pos = f.mesh.geometry.attributes.position;
      // a geometria é compartilhada: ondula todas as bandeiras igualmente
      if (f === this.flags[0]) {
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          pos.setZ(i, Math.sin(x * 2.4 + t * 4) * 0.08 * (x + 1.1));
        }
        pos.needsUpdate = true;
      }
    }
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      const a = pos.array;
      const v = this.partVel;
      const sway = this.env.particles.sway ?? 0.4;
      for (let i = 0; i < a.length; i += 3) {
        a[i] += (v[i] + Math.sin(t * 0.7 + i) * sway * 0.3) * dt;
        a[i + 1] += v[i + 1] * dt;
        a[i + 2] += v[i + 2] * dt;
        if (a[i + 1] < 0) a[i + 1] = 18;
        else if (a[i + 1] > 18) a[i + 1] = 0;
        if (a[i] > 30) a[i] = -30;
        else if (a[i] < -30) a[i] = 30;
        if (a[i + 2] > 22) a[i + 2] = -22;
        else if (a[i + 2] < -22) a[i + 2] = 22;
      }
      pos.needsUpdate = true;
    }
  }
}
