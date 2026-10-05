import * as THREE from 'three';

// Personagem humano estilizado construído a partir de primitivas.
// Hierarquia de articulações permite animação procedural (ver Animator.js).

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...opts }));
  return matCache.get(key);
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

const geoCache = new Map();
function capsule(r, len) {
  const key = `cap${r.toFixed(3)}_${len.toFixed(3)}`;
  if (!geoCache.has(key)) {
    const g = new THREE.CapsuleGeometry(r, len, 4, 10);
    g.translate(0, -len / 2, 0);
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

function numberTexture(number, name, fg, outline) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (name) {
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillStyle = fg;
    ctx.fillText(name.toUpperCase().slice(0, 12), 128, 34);
  }
  ctx.font = '900 150px Arial Black, Arial, sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = outline;
  ctx.strokeText(String(number), 128, name ? 150 : 128);
  ctx.fillStyle = fg;
  ctx.fillText(String(number), 128, name ? 150 : 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CharacterModel {
  constructor(appearance, kit, number = 0, name = '') {
    this.root = new THREE.Group();
    this.appearance = appearance;
    this.kit = kit;
    this.number = number;
    this.name = name;
    this.meshes = [];
    this.build();
  }

  add(parent, geo, material, x = 0, y = 0, z = 0, cast = true) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = false;
    parent.add(m);
    this.meshes.push(m);
    return m;
  }

  build() {
    const a = this.appearance;
    const k = this.kit;
    const s = (a.height || 1.95) / 1.95;
    const b = a.build || 1;
    this.scale = s;

    const skin = mat(a.skin, { roughness: 0.55 });
    const jersey = mat(k.primary, { roughness: 0.7 });
    const trim = mat(k.secondary, { roughness: 0.7 });
    const accent = mat(k.accent, { roughness: 0.6 });
    const hairMat = mat(a.hairColor, { roughness: 0.9 });
    const shoe = mat(a.shoeColor, { roughness: 0.45 });
    const sole = mat('#f2f2f2', { roughness: 0.6 });
    const sock = mat(k.secondary, { roughness: 0.8 });

    const J = {};
    this.joints = J;
    const root = this.root;
    const body = new THREE.Group();
    body.scale.setScalar(s);
    root.add(body);
    this.body = body;

    // Quadril
    J.hips = new THREE.Group();
    J.hips.position.y = 1.0;
    body.add(J.hips);
    const shorts = this.add(J.hips, new THREE.CylinderGeometry(0.175 * b, 0.19 * b, 0.27, 14), jersey, 0, -0.06, 0);
    shorts.scale.z = 0.72;
    const band = this.add(J.hips, new THREE.CylinderGeometry(0.178 * b, 0.178 * b, 0.04, 14), trim, 0, 0.07, 0);
    band.scale.z = 0.72;

    // Pernas
    for (const side of [1, -1]) {
      const L = side > 0 ? 'l' : 'r';
      const hip = new THREE.Group();
      hip.position.set(side * 0.095 * b, -0.07, 0);
      J.hips.add(hip);
      J[L + 'Hip'] = hip;
      this.add(hip, capsule(0.078 * b, 0.4), skin, 0, -0.02, 0);
      const shortLeg = this.add(hip, new THREE.CylinderGeometry(0.1 * b, 0.095 * b, 0.3, 12), jersey, 0, -0.13, 0);
      shortLeg.castShadow = true;
      this.add(hip, new THREE.BoxGeometry(0.015, 0.28, 0.06), trim, side * 0.098 * b, -0.13, 0, false);

      const knee = new THREE.Group();
      knee.position.y = -0.46;
      hip.add(knee);
      J[L + 'Knee'] = knee;
      this.add(knee, capsule(0.062, 0.38), skin, 0, -0.02, 0);
      this.add(knee, new THREE.CylinderGeometry(0.064, 0.058, 0.16, 10), sock, 0, -0.34, 0, false);

      const foot = new THREE.Group();
      foot.position.y = -0.44;
      knee.add(foot);
      J[L + 'Foot'] = foot;
      this.add(foot, new THREE.BoxGeometry(0.12, 0.085, 0.29), shoe, 0, -0.03, 0.06);
      this.add(foot, new THREE.BoxGeometry(0.125, 0.035, 0.3), sole, 0, -0.085, 0.06, false);
      this.add(foot, new THREE.BoxGeometry(0.126, 0.02, 0.1), accent, 0, -0.01, -0.04, false);
    }

    // Tronco
    J.spine = new THREE.Group();
    J.spine.position.y = 0.04;
    J.hips.add(J.spine);
    const torso = this.add(J.spine, new THREE.CylinderGeometry(0.215 * b, 0.172 * b, 0.56, 16), jersey, 0, 0.29, 0);
    torso.scale.z = 0.6;
    const neckTrim = this.add(J.spine, new THREE.TorusGeometry(0.08, 0.016, 6, 16), trim, 0, 0.565, 0.0, false);
    neckTrim.rotation.x = Math.PI / 2;
    neckTrim.scale.y = 0.75;
    for (const side of [1, -1]) {
      const stripe = this.add(J.spine, new THREE.BoxGeometry(0.02, 0.5, 0.08), trim, side * 0.195 * b, 0.28, 0, false);
      stripe.rotation.z = -side * 0.07;
    }

    // Número e nome na camisa
    const back = numberTexture(this.number, this.name.split(' ').slice(-1)[0], k.secondary, shade(k.primary, 0.5));
    const front = numberTexture(this.number, '', k.secondary, shade(k.primary, 0.5));
    const backPlane = this.add(J.spine, new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: back, transparent: true, roughness: 0.7 }), 0, 0.32, -0.123 * b, false);
    backPlane.rotation.y = Math.PI;
    backPlane.rotation.x = -0.05;
    const frontPlane = this.add(J.spine, new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshStandardMaterial({ map: front, transparent: true, roughness: 0.7 }), 0, 0.35, 0.124 * b, false);
    frontPlane.rotation.x = -0.05;

    J.chest = new THREE.Group();
    J.chest.position.y = 0.55;
    J.spine.add(J.chest);
    this.add(J.chest, new THREE.CylinderGeometry(0.052, 0.06, 0.14, 10), skin, 0, 0.06, 0);

    // Cabeça
    J.head = new THREE.Group();
    J.head.position.y = 0.2;
    J.chest.add(J.head);
    this.buildHead(J.head, skin, hairMat, accent);

    // Braços
    for (const side of [1, -1]) {
      const L = side > 0 ? 'l' : 'r';
      const sh = new THREE.Group();
      sh.position.set(side * 0.235 * b, -0.02, 0);
      J.chest.add(sh);
      J[L + 'Shoulder'] = sh;
      this.add(sh, new THREE.SphereGeometry(0.07 * b, 10, 8), skin, 0, -0.01, 0);
      this.add(sh, capsule(0.055 * b, 0.27), skin, 0, -0.02, 0);
      const el = new THREE.Group();
      el.position.y = -0.32;
      sh.add(el);
      J[L + 'Elbow'] = el;
      this.add(el, capsule(0.045, 0.24), skin, 0, -0.01, 0);
      this.add(el, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), accent, 0, -0.22, 0, false);
      const hand = new THREE.Group();
      hand.position.y = -0.29;
      el.add(hand);
      J[L + 'Hand'] = hand;
      const h = this.add(hand, new THREE.SphereGeometry(0.052, 8, 8), skin, 0, -0.04, 0);
      h.scale.set(0.8, 1.35, 0.55);
    }
  }

  buildHead(head, skin, hairMat, accent) {
    const a = this.appearance;
    const fw = a.faceWidth || 1;
    const skull = this.add(head, new THREE.SphereGeometry(0.115, 18, 14), skin, 0, 0, 0);
    skull.scale.set(0.93 * fw, 1.12, 1.0);
    const jaw = this.add(head, new THREE.SphereGeometry(0.085, 14, 10), skin, 0, -0.055, 0.025);
    jaw.scale.set(1.05 * fw, 0.8, 1.0);

    // Orelhas
    for (const side of [1, -1]) {
      const ear = this.add(head, new THREE.SphereGeometry(0.026, 8, 6), skin, side * 0.108 * fw, -0.005, 0, false);
      ear.scale.set(0.5, 1, 0.8);
    }

    // Olhos
    const white = mat('#f7f7f2', { roughness: 0.3 });
    const iris = mat(a.eyeColor || '#3b2414', { roughness: 0.2 });
    const dark = mat('#0b0705', { roughness: 0.2 });
    const browMat = mat(a.hairColor, { roughness: 0.9 });
    for (const side of [1, -1]) {
      const e = this.add(head, new THREE.SphereGeometry(0.019, 10, 8), white, side * 0.038 * fw, 0.012, 0.096, false);
      e.scale.z = 0.55;
      this.add(head, new THREE.SphereGeometry(0.0105, 8, 6), iris, side * 0.038 * fw, 0.012, 0.106, false);
      this.add(head, new THREE.SphereGeometry(0.005, 6, 4), dark, side * 0.038 * fw, 0.012, 0.1135, false);
      const brow = this.add(head, new THREE.BoxGeometry(0.04, 0.009, 0.012), browMat, side * 0.04 * fw, 0.042, 0.103, false);
      brow.rotation.z = side * -0.12;
    }
    // Nariz e boca
    const nose = this.add(head, new THREE.SphereGeometry(0.02, 8, 6), mat(shade(a.skin, 0.88)), 0, -0.012, 0.112, false);
    nose.scale.set(0.8, 1.1, 0.9);
    const mouth = this.add(head, new THREE.BoxGeometry(0.042, 0.008, 0.01), mat('#5a2420'), 0, -0.058, 0.1, false);
    mouth.scale.x = fw;

    // Barba
    if (a.beard && a.beard !== 'none') {
      const beardMat =
        a.beard === 'stubble'
          ? new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 1, transparent: true, opacity: 0.45 })
          : mat(a.hairColor, { roughness: 1 });
      if (a.beard === 'goatee') {
        this.add(head, new THREE.BoxGeometry(0.04, 0.04, 0.03), beardMat, 0, -0.09, 0.085, false);
        this.add(head, new THREE.BoxGeometry(0.05, 0.008, 0.012), beardMat, 0, -0.047, 0.104, false);
      } else {
        const g = new THREE.SphereGeometry(a.beard === 'full' ? 0.093 : 0.088, 14, 10, 0, Math.PI, Math.PI * 0.42, Math.PI * 0.4);
        const bm = this.add(head, g, beardMat, 0, -0.045, 0.026, false);
        bm.scale.set(1.05 * fw, 0.9, 1.04);
      }
    }

    // Cabelo
    const style = a.hairStyle;
    const cap = (r, t, sy = 1.12, y = 0.0) => {
      const g = new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * t);
      const m = this.add(head, g, hairMat, 0, y, -0.004, false);
      m.scale.set(0.95 * fw, sy, 1.02);
      m.rotation.x = -0.25;
      return m;
    };
    if (style === 'short') cap(0.121, 0.42);
    else if (style === 'buzz') cap(0.117, 0.4);
    else if (style === 'afro') {
      const af = this.add(head, new THREE.SphereGeometry(0.175, 16, 12), hairMat, 0, 0.06, -0.035);
      af.scale.set(fw, 0.92, 1);
    } else if (style === 'mohawk') {
      cap(0.117, 0.36);
      const m = this.add(head, new THREE.BoxGeometry(0.035, 0.07, 0.22), hairMat, 0, 0.12, -0.015, false);
      m.rotation.x = 0.2;
    } else if (style === 'bun') {
      cap(0.122, 0.45);
      this.add(head, new THREE.SphereGeometry(0.055, 10, 8), hairMat, 0, 0.12, -0.08, false);
    } else if (style === 'braids') {
      cap(0.122, 0.48);
      for (let i = -2; i <= 2; i++) {
        const br = this.add(head, new THREE.CylinderGeometry(0.012, 0.009, 0.2, 5), hairMat, i * 0.035, -0.06, -0.1, false);
        br.rotation.x = 0.25;
      }
    } else if (style === 'long') {
      cap(0.124, 0.5);
      const back = this.add(head, new THREE.BoxGeometry(0.2, 0.22, 0.06), hairMat, 0, -0.07, -0.085, false);
      back.rotation.x = 0.12;
    }

    if (a.headband) {
      const hb = this.add(head, new THREE.TorusGeometry(0.118, 0.012, 6, 20), accent, 0, 0.055, 0, false);
      hb.rotation.x = Math.PI / 2 - 0.25;
      hb.scale.x = 0.95 * fw;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh && o.material && o.material.map) {
        o.material.map.dispose();
        o.material.dispose();
      }
    });
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}
