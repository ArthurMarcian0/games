import * as THREE from 'three';

// Sistema de partículas leve (um único THREE.Points) para confetes,
// brilhos na rede e poeira de aterrissagem.
const MAX = 600;

export class Particles {
  constructor(scene) {
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.gravity = new Float32Array(MAX);
    this.baseSize = new Float32Array(MAX);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.2, d));
        }`,
    });
    this.material = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(pos, { count = 20, colors = ['#ffffff'], speed = 3, spread = 1, up = 2, life = 1.2, gravity = 6, size = 0.08 } = {}) {
    const col = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.vel[i * 3] = Math.cos(a) * r * speed;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * r * speed;
      col.set(colors[k % colors.length]);
      this.colors[i * 3] = col.r;
      this.colors[i * 3 + 1] = col.g;
      this.colors[i * 3 + 2] = col.b;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.gravity[i] = gravity;
      this.baseSize[i] = size * (0.6 + Math.random() * 0.8);
    }
  }

  update(dt, viewportHeight) {
    this.material.uniforms.uScale.value = viewportHeight * 0.9;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.sizes[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.gravity[i] * dt;
      this.vel[i * 3] *= 0.98;
      this.vel[i * 3 + 2] *= 0.98;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] = Math.max(0.02, this.positions[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.sizes[i] = this.baseSize[i] * Math.min(1, this.life[i] / (this.maxLife[i] * 0.4));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}
