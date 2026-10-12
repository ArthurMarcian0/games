// Renderizador com pós-processamento próprio: bloom, granulação, vinheta,
// aberração cromática, dessaturação por ferimento, fade e tone mapping ACES.
import * as THREE from 'three';

const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FS = `
uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(threshold, threshold * 2.5, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FS = `
uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;
  s += texture2D(tDiffuse, vUv + dir * 1.3846).rgb * 0.316216;
  s += texture2D(tDiffuse, vUv - dir * 1.3846).rgb * 0.316216;
  s += texture2D(tDiffuse, vUv + dir * 3.2307).rgb * 0.070270;
  s += texture2D(tDiffuse, vUv - dir * 3.2307).rgb * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}`;

const FINAL_FS = `
uniform sampler2D tDiffuse; uniform sampler2D tBloom;
uniform float time, exposure, bloom, vignette, grain, damage, lowHealth, fade, flash, brightness, aberr, safe;
uniform vec2 res;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x){ const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0); }
void main(){
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  float ab = (aberr + damage * 0.006) * r2 * 4.0;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + cc * ab).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - cc * ab).b;
  col += texture2D(tBloom, uv).rgb * bloom;
  col *= exposure * brightness;
  col += flash;
  col = aces(col);
  // gradação: sombras frias, médios levemente esverdeados
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 tint = mix(vec3(0.86, 0.95, 1.08), vec3(1.04, 1.0, 0.92), smoothstep(0.0, 0.7, l));
  tint = mix(tint, vec3(1.08, 0.98, 0.86), safe);
  col *= tint;
  // dessaturação quando ferido
  float desat = clamp(lowHealth * 0.75, 0.0, 0.75);
  col = mix(col, vec3(l), desat);
  // pulso vermelho de dano
  float edge = smoothstep(0.08, 0.5, r2);
  col = mix(col, vec3(0.45, 0.0, 0.0), clamp(damage * edge * 1.3, 0.0, 0.85));
  col = mix(col, col * vec3(1.0, 0.75, 0.75), lowHealth * edge * (0.5 + 0.5 * sin(time * 5.0)));
  // vinheta
  col *= 1.0 - smoothstep(0.15, 0.85, r2 * vignette * 2.0) * 0.85;
  col = pow(col, vec3(1.0 / 2.2));
  // granulação de filme
  float g = hash(uv * res + fract(time * 13.0) * 100.0) - 0.5;
  col += g * grain * (1.2 - l);
  // linhas sutis
  col *= 1.0 - 0.025 * sin(uv.y * res.y * 1.5);
  col *= 1.0 - fade;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(container, settings) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    container.appendChild(r.domElement);
    this.canvas = r.domElement;

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: 0.9 } },
      vertexShader: QUAD_VS,
      fragmentShader: BRIGHT_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VS,
      fragmentShader: BLUR_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        time: { value: 0 },
        exposure: { value: 1.0 },
        bloom: { value: 0.7 },
        vignette: { value: 1.0 },
        grain: { value: 0.07 },
        damage: { value: 0 },
        lowHealth: { value: 0 },
        fade: { value: 0 },
        flash: { value: 0 },
        brightness: { value: 1 },
        aberr: { value: 0.0015 },
        safe: { value: 0 },
        res: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: QUAD_VS,
      fragmentShader: FINAL_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.fx = this.finalMat.uniforms;
    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
  }

  applyQuality() {
    const q = this.settings.get('quality');
    this.quality = q;
    this.scale = q === 'low' ? 0.7 : q === 'high' ? 1 : 0.85;
    this.shadowSize = q === 'low' ? 512 : q === 'high' ? 2048 : 1024;
    this.useBloom = q !== 'low';
    this.renderer.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 1.5) * this.scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, true);
    const W = Math.max(2, Math.floor(w * pr));
    const H = Math.max(2, Math.floor(h * pr));
    const samples = this.quality === 'high' ? 4 : this.quality === 'medium' ? 2 : 0;
    if (this.rtScene) {
      this.rtScene.dispose();
      this.rtA.dispose();
      this.rtB.dispose();
    }
    this.rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples });
    const bw = Math.max(2, W >> 2);
    const bh = Math.max(2, H >> 2);
    this.rtA = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
    this.rtB = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType });
    this.bloomTexel = new THREE.Vector2(1 / bw, 1 / bh);
    this.fx.res.value.set(W, H);
    if (this.onResize) this.onResize(w, h);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    if (this.useBloom) {
      this.brightMat.uniforms.tDiffuse.value = this.rtScene.texture;
      this.pass(this.brightMat, this.rtA);
      for (let i = 0; i < 2; i++) {
        this.blurMat.uniforms.tDiffuse.value = this.rtA.texture;
        this.blurMat.uniforms.dir.value.set(this.bloomTexel.x * (1 + i), 0);
        this.pass(this.blurMat, this.rtB);
        this.blurMat.uniforms.tDiffuse.value = this.rtB.texture;
        this.blurMat.uniforms.dir.value.set(0, this.bloomTexel.y * (1 + i));
        this.pass(this.blurMat, this.rtA);
      }
      this.fx.bloom.value = 0.65;
    } else {
      this.fx.bloom.value = 0;
    }
    this.fx.tDiffuse.value = this.rtScene.texture;
    this.fx.tBloom.value = this.rtA.texture;
    this.fx.time.value = time;
    this.fx.brightness.value = this.settings.get('brightness');
    this.pass(this.finalMat, null);
  }
}
