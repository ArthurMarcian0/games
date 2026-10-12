// Partículas (sangue, faíscas, poeira), marcas no chão e clima (chuva, névoa, raios).
import * as THREE from 'three';
import { rand } from '../core/utils.js';
import { bloodMat } from './materials.js';
import { fogTex, softTex } from './textures.js';

const PART_VS = `
attribute float size; attribute vec4 pcolor; varying vec4 vColor;
void main(){
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PART_FS = `
uniform sampler2D map; varying vec4 vColor;
void main(){
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`;

export class Particles {
  constructor(max = 700) {
    this.max = max;
    this.items = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.normalMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softTex() } },
      vertexShader: PART_VS,
      fragmentShader: PART_FS,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.normalMat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  attach(scene) {
    scene.add(this.points);
    this.items.length = 0;
  }

  spawn(p) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push(p);
  }

  blood(pos, dir, n = 12, scale = 1) {
    for (let i = 0; i < n; i++) {
      const s = rand(1.5, 4.5) * scale;
      this.spawn({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: dir.x * s + rand(-1.5, 1.5),
        vy: rand(0.5, 3),
        vz: dir.z * s + rand(-1.5, 1.5),
        life: rand(0.4, 0.9),
        t: 0,
        g: 9,
        r: 0.35,
        gg: 0.02,
        b: 0.02,
        a: 0.95,
        size: rand(0.05, 0.13) * scale,
        grow: 0.05,
      });
    }
  }

  sparks(pos, n = 10) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: rand(-3, 3),
        vy: rand(0, 4),
        vz: rand(-3, 3),
        life: rand(0.15, 0.4),
        t: 0,
        g: 12,
        r: 2.5,
        gg: 1.6,
        b: 0.6,
        a: 1,
        size: rand(0.03, 0.06),
        grow: -0.05,
      });
    }
  }

  dust(pos, n = 8, color = [0.5, 0.48, 0.44]) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: pos.x + rand(-0.1, 0.1),
        y: pos.y + rand(-0.1, 0.1),
        z: pos.z + rand(-0.1, 0.1),
        vx: rand(-0.8, 0.8),
        vy: rand(0, 1.2),
        vz: rand(-0.8, 0.8),
        life: rand(0.5, 1.2),
        t: 0,
        g: 0.5,
        r: color[0],
        gg: color[1],
        b: color[2],
        a: 0.5,
        size: rand(0.12, 0.3),
        grow: 0.6,
        drag: 2,
      });
    }
  }

  smoke(pos, n = 6) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: rand(-0.3, 0.3),
        vy: rand(0.4, 1.2),
        vz: rand(-0.3, 0.3),
        life: rand(0.6, 1.4),
        t: 0,
        g: -0.4,
        r: 0.6,
        gg: 0.6,
        b: 0.6,
        a: 0.25,
        size: rand(0.1, 0.2),
        grow: 1,
        drag: 1,
      });
    }
  }

  steam(pos, color = [0.7, 0.72, 0.75]) {
    this.spawn({
      x: pos.x + rand(-0.1, 0.1),
      y: pos.y,
      z: pos.z + rand(-0.1, 0.1),
      vx: rand(-0.3, 0.3),
      vy: rand(1, 2),
      vz: rand(-0.3, 0.3),
      life: rand(1, 2),
      t: 0,
      g: -0.2,
      r: color[0],
      gg: color[1],
      b: color[2],
      a: 0.12,
      size: rand(0.3, 0.6),
      grow: 1.5,
      drag: 0.6,
    });
  }

  acid(pos, n = 10) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: rand(-2, 2),
        vy: rand(1, 3),
        vz: rand(-2, 2),
        life: rand(0.4, 0.8),
        t: 0,
        g: 9,
        r: 0.5,
        gg: 0.8,
        b: 0.1,
        a: 0.9,
        size: rand(0.06, 0.12),
        grow: 0,
      });
    }
  }

  update(dt) {
    let n = 0;
    const its = this.items;
    for (let i = its.length - 1; i >= 0; i--) {
      const p = its[i];
      p.t += dt;
      if (p.t >= p.life) {
        its.splice(i, 1);
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vz *= k;
      }
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.01 && p.g > 0) {
        p.y = 0.01;
        p.vy *= -0.2;
        p.vx *= 0.5;
        p.vz *= 0.5;
      }
      p.size = Math.max(0.01, p.size + p.grow * dt);
    }
    for (const p of its) {
      if (n >= this.max) break;
      const k = 1 - p.t / p.life;
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r;
      this.col[n * 4 + 1] = p.gg;
      this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * k;
      this.size[n] = p.size;
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.pcolor.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
export class Decals {
  constructor(max = 40) {
    this.max = max;
    this.list = [];
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.geo.rotateX(-Math.PI / 2);
  }
  attach(scene) {
    this.scene = scene;
    this.list.length = 0;
  }
  add(x, z, size = 1, variant = 0, y = 0.015) {
    if (!this.scene) return;
    const m = new THREE.Mesh(this.geo, bloodMat(variant));
    m.position.set(x, y + this.list.length * 0.0004, z);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.scale.setScalar(size);
    m.renderOrder = 1;
    m.receiveShadow = true;
    this.scene.add(m);
    this.list.push(m);
    if (this.list.length > this.max) {
      const old = this.list.shift();
      this.scene.remove(old);
    }
  }
}

// ---------------------------------------------------------------------------
const RAIN_VS = `
attribute vec3 offset; attribute float tip;
uniform float time, speed, len; uniform vec3 box; uniform vec3 center; uniform vec2 wind;
varying vec3 vWorld; varying float vTip;
void main(){
  vec3 hb = box * 0.5;
  float y = mod(offset.y * box.y - time * speed * (0.8 + offset.x * 0.4), box.y);
  vec3 p;
  p.x = center.x - hb.x + mod(offset.x * box.x - (center.x - hb.x) + wind.x * (box.y - y) * 0.05, box.x);
  p.z = center.z - hb.z + mod(offset.z * box.z - (center.z - hb.z) + wind.y * (box.y - y) * 0.05, box.z);
  p.y = center.y - 2.0 + y;
  vec3 v = normalize(vec3(wind.x * 0.05, -1.0, wind.y * 0.05));
  p -= v * len * tip;
  vWorld = p; vTip = tip;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FS = `
uniform vec4 rects[8]; uniform int nRects; uniform vec4 bounds; uniform float useBounds; uniform vec3 color; uniform float opacity; uniform vec3 camPos;
varying vec3 vWorld; varying float vTip;
void main(){
  if (vWorld.y < 0.0) discard;
  for (int i = 0; i < 8; i++) {
    if (i >= nRects) break;
    vec4 r = rects[i];
    if (vWorld.x > r.x && vWorld.x < r.z && vWorld.z > r.y && vWorld.z < r.w) discard;
  }
  if (useBounds > 0.5 && (vWorld.x < bounds.x || vWorld.x > bounds.z || vWorld.z < bounds.y || vWorld.z > bounds.w)) discard;
  float d = distance(vWorld, camPos);
  float a = opacity * (1.0 - smoothstep(6.0, 22.0, d)) * mix(1.0, 0.0, vTip);
  gl_FragColor = vec4(color, a);
}`;

const SPLASH_VS = `
attribute vec3 offset; uniform float time; uniform vec3 box; uniform vec3 center;
varying float vA; varying vec3 vWorld;
void main(){
  float ph = fract(time * (1.6 + offset.y) + offset.x * 7.0);
  vec3 hb = box * 0.5;
  float cyc = floor(time * (1.6 + offset.y) + offset.x * 7.0);
  vec2 jitter = vec2(fract(sin(cyc * 12.9 + offset.z * 78.2) * 43758.5), fract(sin(cyc * 39.3 + offset.x * 11.1) * 24634.6));
  vec3 p;
  p.x = center.x - hb.x + mod((offset.x + jitter.x) * box.x - (center.x - hb.x), box.x);
  p.z = center.z - hb.z + mod((offset.z + jitter.y) * box.z - (center.z - hb.z), box.z);
  p.y = 0.08;
  vA = (1.0 - ph);
  vWorld = p;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.0 + ph * 3.5) * (14.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const SPLASH_FS = `
uniform vec4 rects[8]; uniform int nRects; uniform vec4 bounds; uniform float useBounds; uniform float opacity;
varying float vA; varying vec3 vWorld;
void main(){
  for (int i = 0; i < 8; i++) {
    if (i >= nRects) break;
    vec4 r = rects[i];
    if (vWorld.x > r.x && vWorld.x < r.z && vWorld.z > r.y && vWorld.z < r.w) discard;
  }
  if (useBounds > 0.5 && (vWorld.x < bounds.x || vWorld.x > bounds.z || vWorld.z < bounds.y || vWorld.z > bounds.w)) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float ring = smoothstep(0.5, 0.35, d) * smoothstep(0.2, 0.4, d);
  gl_FragColor = vec4(vec3(0.7, 0.75, 0.8), ring * vA * opacity);
}`;

export class Weather {
  constructor(quality = 'medium') {
    this.group = new THREE.Group();
    const count = quality === 'high' ? 9000 : quality === 'low' ? 3000 : 6000;
    const offs = new Float32Array(count * 2 * 3);
    const tips = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random();
      const y = Math.random();
      const z = Math.random();
      for (let k = 0; k < 2; k++) {
        offs.set([x, y, z], (i * 2 + k) * 3);
        tips[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    g.setAttribute('offset', new THREE.BufferAttribute(offs, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(tips, 1));
    const rects = [];
    for (let i = 0; i < 8; i++) rects.push(new THREE.Vector4());
    this.uniforms = {
      time: { value: 0 },
      speed: { value: 16 },
      len: { value: 0.55 },
      box: { value: new THREE.Vector3(36, 22, 36) },
      center: { value: new THREE.Vector3() },
      wind: { value: new THREE.Vector2(2, 1) },
      rects: { value: rects },
      nRects: { value: 0 },
      bounds: { value: new THREE.Vector4() },
      useBounds: { value: 0 },
      color: { value: new THREE.Color(0.55, 0.6, 0.68) },
      opacity: { value: 0.32 },
      camPos: { value: new THREE.Vector3() },
    };
    this.rain = new THREE.LineSegments(
      g,
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false }),
    );
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    const sc = 500;
    const so = new Float32Array(sc * 3);
    for (let i = 0; i < sc * 3; i++) so[i] = Math.random();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sc * 3), 3));
    sg.setAttribute('offset', new THREE.BufferAttribute(so, 3));
    this.splashU = {
      time: this.uniforms.time,
      box: { value: new THREE.Vector3(12, 1, 12) },
      center: this.uniforms.center,
      rects: this.uniforms.rects,
      nRects: this.uniforms.nRects,
      bounds: this.uniforms.bounds,
      useBounds: this.uniforms.useBounds,
      opacity: { value: 0.22 },
    };
    this.splash = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({ uniforms: this.splashU, vertexShader: SPLASH_VS, fragmentShader: SPLASH_FS, transparent: true, depthWrite: false }),
    );
    this.splash.frustumCulled = false;
    this.group.add(this.splash);

    // névoa rasteira (planos com textura suave)
    this.mist = [];
    const mg = new THREE.PlaneGeometry(1, 1);
    const mm = new THREE.MeshBasicMaterial({ map: fogTex(), transparent: true, depthWrite: false, opacity: 0.5, color: 0x8a96a0, fog: true });
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(mg, mm);
      m.scale.set(rand(8, 14), rand(3, 5), 1);
      m.userData.drift = rand(0.2, 0.6);
      m.userData.h = rand(0.4, 1.6);
      this.mist.push(m);
      this.group.add(m);
    }
    this.mistMat = mm;

    this.enabled = false;
    this.mistOn = false;
    this.nextLightning = rand(15, 30);
    this.lightning = 0;
    this.lightningQueue = [];
    this.onThunder = null;
  }

  configure({ rain = false, mist = false, rects = [], bounds = null, mistColor = 0x8a96a0, mistOpacity = 0.5, lightning = true }) {
    this.enabled = rain;
    this.rain.visible = rain;
    this.splash.visible = rain;
    this.mistOn = mist;
    this.lightningOn = rain && lightning;
    for (const m of this.mist) {
      m.visible = mist;
      m.userData.placed = false;
    }
    this.mistMat.color.set(mistColor);
    this.mistMat.opacity = mistOpacity;
    this.uniforms.nRects.value = Math.min(8, rects.length);
    rects.slice(0, 8).forEach((r, i) => this.uniforms.rects.value[i].set(r.minX, r.minZ, r.maxX, r.maxZ));
    if (bounds) {
      this.uniforms.useBounds.value = 1;
      this.uniforms.bounds.value.set(bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ);
    } else this.uniforms.useBounds.value = 0;
    this.mistRects = rects;
  }

  update(dt, time, camera, focus) {
    this.uniforms.time.value = time;
    this.uniforms.center.value.set(camera.position.x, camera.position.y, camera.position.z);
    this.uniforms.camPos.value.copy(camera.position);
    this.uniforms.wind.value.set(2 + Math.sin(time * 0.1) * 1.5, 1 + Math.cos(time * 0.13));
    if (this.mistOn) {
      for (const m of this.mist) {
        const dx = m.position.x - focus.x;
        const dz = m.position.z - focus.z;
        if (!m.userData.placed || dx * dx + dz * dz > 30 * 30) {
          const a = Math.random() * Math.PI * 2;
          const d = m.userData.placed ? rand(20, 28) : rand(2, 26);
          m.position.set(focus.x + Math.cos(a) * d, m.userData.h, focus.z + Math.sin(a) * d);
          m.userData.placed = true;
          const p = m.position;
          m.visible = !this.mistRects.some((r) => p.x > r.minX - 3 && p.x < r.maxX + 3 && p.z > r.minZ - 3 && p.z < r.maxZ + 3);
        }
        m.position.x += m.userData.drift * dt;
        m.quaternion.copy(camera.quaternion);
      }
    }
    // raios
    this.lightning = Math.max(0, this.lightning - dt * 6);
    if (this.lightningOn) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.nextLightning = rand(18, 45);
        this.lightningQueue.push(0, 0.12, 0.28);
        if (this.onThunder) setTimeout(() => this.onThunder(), rand(700, 2500));
      }
    }
    for (let i = this.lightningQueue.length - 1; i >= 0; i--) {
      this.lightningQueue[i] -= dt;
      if (this.lightningQueue[i] <= 0) {
        this.lightning = rand(0.6, 1);
        this.lightningQueue.splice(i, 1);
      }
    }
  }
}
