// Áudio 100% procedural (Web Audio API): nenhum arquivo externo é necessário.
// Os efeitos são sintetizados uma vez em buffers e reproduzidos com variação.
export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.buffers = {};
    this.crowdLevel = 0.25;
    this.sfxScale = 1;
    this.listener = { x: 0, z: 0, yaw: 0 };
  }

  // O navegador exige um gesto do usuário para iniciar o áudio
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.connect(this.master);
    this.crowdBus = c.createGain();
    this.crowdBus.connect(this.master);
    this.applyVolumes();
    this.buildBuffers();
    this.startCrowd();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.get('masterVolume'), t, 0.05);
    this.sfx.gain.setTargetAtTime(s.get('sfxVolume') * this.sfxScale, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.get('musicVolume') * 0.55, t, 0.05);
    this.crowdBus.gain.setTargetAtTime(s.get('crowdVolume'), t, 0.05);
  }

  setSfxScale(v) {
    this.sfxScale = v;
    this.applyVolumes();
  }

  // ------------------------------------------------------------------
  makeBuffer(seconds, fn) {
    const sr = this.ctx.sampleRate;
    const n = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let state = {};
    for (let i = 0; i < n; i++) d[i] = fn(i / sr, state);
    return buf;
  }

  buildBuffers() {
    const rnd = () => Math.random() * 2 - 1;
    const B = this.buffers;
    // quique: baque grave com queda de afinação + estalo do couro
    B.bounce = this.makeBuffer(0.28, (t) => {
      const f = 95 + 160 * Math.exp(-t * 40);
      return (Math.sin(2 * Math.PI * f * t) * 0.9 + rnd() * 0.35 * Math.exp(-t * 90)) * Math.exp(-t * 18);
    });
    // aro: parciais metálicos inarmônicos
    B.rim = this.makeBuffer(0.9, (t) => {
      const parts = [523, 1187, 1873, 2711, 3420];
      let v = 0;
      parts.forEach((f, i) => (v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (5 + i * 4)) / (i + 1)));
      return (v * 0.7 + rnd() * 0.3 * Math.exp(-t * 120)) * 0.8;
    });
    // tabela: pancada média com ressonância
    B.board = this.makeBuffer(0.4, (t) => {
      const v = Math.sin(2 * Math.PI * 180 * t) * 0.6 + Math.sin(2 * Math.PI * 410 * t) * 0.3 + rnd() * 0.4 * Math.exp(-t * 60);
      return v * Math.exp(-t * 14);
    });
    // rede: ruído filtrado "swish"
    B.swish = this.makeBuffer(0.55, (t, s) => {
      s.lp = (s.lp || 0) * 0.6 + rnd() * 0.4;
      const hp = rnd() - s.lp;
      const env = Math.sin(Math.min(1, t / 0.5) * Math.PI) * Math.exp(-t * 3);
      return hp * env * 0.7;
    });
    // tênis: rangido agudo com glissando
    for (let k = 0; k < 3; k++) {
      const base = 1900 + k * 450;
      B['squeak' + k] = this.makeBuffer(0.16, (t, s) => {
        s.ph = (s.ph || 0) + (2 * Math.PI * (base + 900 * Math.sin(t * 50 + k))) / this.ctx.sampleRate;
        const env = Math.sin(Math.min(1, t / 0.15) * Math.PI);
        return (Math.sin(s.ph) * 0.6 + Math.sin(s.ph * 2.01) * 0.25) * env * 0.5;
      });
    }
    // apito
    B.whistle = this.makeBuffer(0.7, (t) => {
      const f = 2950 + Math.sin(t * 2 * Math.PI * 34) * 120;
      const env = Math.min(1, t * 40) * (t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) * 7));
      return (Math.sin(2 * Math.PI * f * t) * 0.6 + rnd() * 0.12) * env * 0.6;
    });
    // buzina do placar
    B.buzzer = this.makeBuffer(1.3, (t) => {
      const sq = (f) => (Math.sin(2 * Math.PI * f * t) > 0 ? 1 : -1);
      const env = Math.min(1, t * 30) * (t < 1.15 ? 1 : Math.max(0, 1 - (t - 1.15) * 7));
      return (sq(220) * 0.4 + sq(277) * 0.3 + sq(330) * 0.2) * env * 0.35;
    });
    // aplauso / vibração
    B.cheer = this.makeBuffer(2.6, (t, s) => {
      s.lp = (s.lp || 0) * 0.85 + rnd() * 0.15;
      const claps = Math.random() < 0.02 ? rnd() * 2 : 0;
      const env = Math.min(1, t * 3) * Math.exp(-Math.max(0, t - 0.6) * 1.4);
      return (s.lp * 2.5 + claps * 0.4) * env * 0.6;
    });
    B.clap = this.makeBuffer(0.12, (t) => rnd() * Math.exp(-t * 55) * 0.8);
    B.catch = this.makeBuffer(0.1, (t) => (rnd() * 0.6 + Math.sin(2 * Math.PI * 300 * t) * 0.4) * Math.exp(-t * 60));
    B.whoosh = this.makeBuffer(0.3, (t, s) => {
      s.lp = (s.lp || 0) * 0.9 + rnd() * 0.1;
      return s.lp * Math.sin((t / 0.3) * Math.PI) * 2;
    });
    B.click = this.makeBuffer(0.06, (t) => Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 80) * 0.5);
    B.dunk = this.makeBuffer(0.8, (t) => {
      const parts = [180, 420, 760, 1310];
      let v = 0;
      parts.forEach((f, i) => (v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (6 + i * 3))));
      return (v * 0.4 + rnd() * 0.6 * Math.exp(-t * 25)) * 0.8;
    });
    // ambiente da torcida (loop)
    B.crowd = this.makeBuffer(4, (t, s) => {
      s.a = (s.a || 0) * 0.97 + rnd() * 0.03;
      s.b = (s.b || 0) * 0.8 + rnd() * 0.2;
      const murmur = Math.sin(t * 2 * Math.PI * 0.5) * 0.15 + 0.85;
      return (s.a * 3 + s.b * 0.5) * murmur * 0.5;
    });
  }

  play(name, { volume = 1, rate = 1, pan = 0, delay = 0 } = {}) {
    if (!this.ctx || !this.buffers[name]) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = volume;
    let node = g;
    if (c.createStereoPanner && pan) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(this.sfx);
    src.start(c.currentTime + delay);
  }

  // Som posicional simples: volume pela distância e pan pela lateralidade
  playAt(name, pos, opts = {}) {
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const d = Math.hypot(dx, dz);
    const vol = (opts.volume ?? 1) / (1 + d * 0.08);
    const ang = Math.atan2(dx, dz) - this.listener.yaw;
    const pan = -Math.sin(ang) * Math.min(1, d / 6) * 0.8;
    this.play(name, { ...opts, volume: vol, pan });
  }

  setListener(camera) {
    this.listener.x = camera.position.x;
    this.listener.z = camera.position.z;
    const dir = { x: 0, z: 0 };
    const m = camera.matrixWorld.elements;
    dir.x = -m[8];
    dir.z = -m[10];
    this.listener.yaw = Math.atan2(dir.x, dir.z);
  }

  startCrowd() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.buffers.crowd;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.6;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0.0;
    src.connect(filter);
    filter.connect(this.crowdGain);
    this.crowdGain.connect(this.crowdBus);
    src.start();
    this.crowdFilter = filter;
  }

  setCrowd(level) {
    this.crowdLevel = level;
    if (!this.ctx || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
    this.crowdFilter.frequency.setTargetAtTime(500 + level * 900, this.ctx.currentTime, 0.4);
  }

  cheer(intensity = 1) {
    this.play('cheer', { volume: 0.5 + intensity * 0.6, rate: 0.9 + Math.random() * 0.2 });
    this.play('cheer', { volume: 0.3 * intensity, rate: 0.7, delay: 0.15 });
  }

  // Palmas ritmadas da torcida ("de-fe-sa!")
  chant() {
    for (let i = 0; i < 3; i++) this.play('clap', { volume: 0.45, rate: 0.9 + Math.random() * 0.2, delay: i * 0.33 });
    for (let i = 0; i < 3; i++) this.play('clap', { volume: 0.4, rate: 0.95, delay: 1.2 + i * 0.33 });
  }

  // Efeito de pontuação: arpejo curto
  scoreJingle(points) {
    if (!this.ctx) return;
    const c = this.ctx;
    const notes = points >= 3 ? [523, 659, 784, 1047] : points === 2 ? [523, 659, 784] : [659, 880];
    notes.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t0 = c.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t0);
      o.stop(t0 + 0.4);
    });
  }
}
