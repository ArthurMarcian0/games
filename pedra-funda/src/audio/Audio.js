// Áudio 100% procedural (Web Audio): ambiências, efeitos posicionais, rádio,
// respiração, batimentos e trilha adaptativa extremamente discreta.
import { rand, pick, clamp } from '../core/utils.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.ambientProfile = null;
    this.musicTrack = 'none';
    this.indoor = false;
    this.radioLevel = 0;
    this.breathLevel = 0;
    this.heartLevel = 0;
    this.nextAmbient = 3;
    this.time = 0;
    settings.onChange(() => this.applyVolumes());
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.amb = ctx.createGain();
    this.ui = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.ui.connect(this.master);
    // ambiência externa passa por filtro (abafado em interiores)
    this.outFilter = ctx.createBiquadFilter();
    this.outFilter.type = 'lowpass';
    this.outFilter.frequency.value = 18000;
    this.outGain = ctx.createGain();
    this.outFilter.connect(this.outGain).connect(this.amb);
    this.amb.connect(this.master);
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.5;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.setReverb(2.2, 2.5);

    this.noise = { white: this.makeNoise('white'), pink: this.makeNoise('pink'), brown: this.makeNoise('brown') };
    this.loops = {};
    this.buildLoops();
    this.buildRadio();
    this.applyVolumes();
    this.musicGain = {};
    this.nextNoteTime = 0;
    this.musicStep = 0;
    this.ready = true;
    this.schedTimer = setInterval(() => this.scheduleMusic(), 50);
    const pendingTrack = this.musicTrack;
    this.musicTrack = 'none';
    if (pendingTrack !== 'none') this.setMusic(pendingTrack);
    if (this.pendingAmbient) this.setAmbient(...this.pendingAmbient);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.get('master'), t, 0.05);
    this.sfx.gain.setTargetAtTime(s.get('sfx'), t, 0.05);
    this.music.gain.setTargetAtTime(s.get('music') * 0.8, t, 0.05);
    this.amb.gain.setTargetAtTime(s.get('ambient'), t, 0.05);
    this.ui.gain.setTargetAtTime(s.get('sfx') * 0.7, t, 0.05);
  }

  makeNoise(type) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0,
        last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') d[i] = w;
        else if (type === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
    }
    return buf;
  }

  setReverb(seconds, decay) {
    const ctx = this.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    this.reverb.buffer = buf;
  }

  // ---------------------------------------------------------------- loops
  noiseSrc(type, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise[type];
    s.loop = true;
    s.playbackRate.value = rate;
    s.loopStart = Math.random() * 2;
    s.start(0, Math.random() * 3);
    return s;
  }

  buildLoops() {
    const ctx = this.ctx;
    const mk = (name, nodes, dest) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      nodes.connect(g).connect(dest);
      this.loops[name] = g;
      return g;
    };
    // chuva: ruído rosa + camada de "gotas"
    {
      const src = this.noiseSrc('pink');
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 500;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 9000;
      src.connect(hp).connect(lp);
      mk('rain', lp, this.outFilter);
      const src2 = this.noiseSrc('white', 0.5);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500;
      bp.Q.value = 0.6;
      const g2 = ctx.createGain();
      g2.gain.value = 0.3;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lg = ctx.createGain();
      lg.gain.value = 0.2;
      lfo.connect(lg).connect(g2.gain);
      lfo.start();
      src2.connect(bp).connect(g2);
      mk('rain2', g2, this.outFilter);
    }
    // vento
    {
      const src = this.noiseSrc('brown');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 400;
      bp.Q.value = 1.2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      const lg = ctx.createGain();
      lg.gain.value = 250;
      lfo.connect(lg).connect(bp.frequency);
      lfo.start();
      src.connect(bp);
      mk('wind', bp, this.outFilter);
    }
    // tom de ambiente interno (grave)
    {
      const src = this.noiseSrc('brown', 0.7);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      src.connect(lp);
      mk('room', lp, this.amb);
    }
    // zumbido elétrico
    {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 120;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.value = 0.15;
      o.connect(lp);
      o2.connect(g).connect(lp);
      o.start();
      o2.start();
      mk('hum', lp, this.amb);
    }
    // ventilação (laboratório)
    {
      const src = this.noiseSrc('pink', 0.6);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 280;
      bp.Q.value = 0.8;
      src.connect(bp);
      mk('vent', bp, this.amb);
    }
    // ronco subterrâneo
    {
      const src = this.noiseSrc('brown', 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 90;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
      src.connect(lp).connect(g);
      mk('rumble', g, this.amb);
    }
    // respiração (ruído filtrado com envelope)
    {
      const src = this.noiseSrc('pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 0.9;
      src.connect(bp);
      this.breathGain = ctx.createGain();
      this.breathGain.gain.value = 0;
      bp.connect(this.breathGain).connect(this.sfx);
      this.breathFilter = bp;
      this.nextBreath = 0;
      this.breathPhase = 0;
    }
  }

  buildRadio() {
    const ctx = this.ctx;
    const src = this.noiseSrc('white');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 7;
    const lg = ctx.createGain();
    lg.gain.value = 0.35;
    lfo.connect(lg).connect(am.gain);
    lfo.start();
    this.radioLfo = lfo;
    this.radioGain = ctx.createGain();
    this.radioGain.gain.value = 0;
    src.connect(bp).connect(am).connect(this.radioGain).connect(this.sfx);
  }

  setLoop(name, vol, time = 1.5) {
    const g = this.loops[name];
    if (g) g.gain.setTargetAtTime(vol, this.ctx.currentTime, time / 3);
  }

  // perfis de ambiência por área
  setAmbient(profile, opts = {}) {
    if (!this.ready) {
      this.pendingAmbient = [profile, opts];
      return;
    }
    this.ambientProfile = profile;
    this.ambOpts = opts;
    const P = {
      outdoor: { rain: 0.5, rain2: 0.35, wind: 0.35, room: 0, hum: 0, vent: 0, rumble: 0.05 },
      forest: { rain: 0.45, rain2: 0.4, wind: 0.5, room: 0, hum: 0, vent: 0, rumble: 0.08 },
      building: { rain: 0.22, rain2: 0.1, wind: 0.15, room: 0.35, hum: 0, vent: 0, rumble: 0.05 },
      hospital: { rain: 0.18, rain2: 0.08, wind: 0.12, room: 0.4, hum: opts.power ? 0.05 : 0, vent: opts.power ? 0.15 : 0, rumble: 0.06 },
      basement: { rain: 0, rain2: 0, wind: 0, room: 0.5, hum: opts.power ? 0.08 : 0, vent: 0.05, rumble: 0.25 },
      tunnels: { rain: 0, rain2: 0, wind: 0.08, room: 0.4, hum: 0, vent: 0, rumble: 0.5 },
      lab: { rain: 0, rain2: 0, wind: 0, room: 0.2, hum: 0.07, vent: 0.35, rumble: 0.2 },
      menu: { rain: 0.45, rain2: 0.3, wind: 0.3, room: 0, hum: 0, vent: 0, rumble: 0 },
      silent: { rain: 0, rain2: 0, wind: 0, room: 0, hum: 0, vent: 0, rumble: 0 },
    }[profile] || {};
    for (const k of Object.keys(this.loops)) this.setLoop(k, P[k] || 0, 2.5);
    const rv = { outdoor: [1.6, 3], forest: [1.8, 3], building: [1.6, 2.6], hospital: [2.6, 2.2], basement: [2.8, 2], tunnels: [4, 1.6], lab: [2.4, 2.4] }[profile];
    if (rv) this.setReverb(rv[0], rv[1]);
  }

  setIndoor(indoor) {
    if (!this.ready || indoor === this.indoor) return;
    this.indoor = indoor;
    const t = this.ctx.currentTime;
    this.outFilter.frequency.setTargetAtTime(indoor ? 700 : 18000, t, 0.25);
    this.outGain.gain.setTargetAtTime(indoor ? 0.5 : 1, t, 0.25);
  }

  // ---------------------------------------------------------------- one-shots
  out(pos, vol = 1, opts = {}) {
    // retorna um nó de entrada já roteado (posicional se pos)
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = vol;
    let node = g;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = opts.ref || 2;
      p.rolloffFactor = opts.rolloff || 1.3;
      p.maxDistance = 80;
      p.positionX.value = pos.x;
      p.positionY.value = pos.y ?? 1;
      p.positionZ.value = pos.z;
      g.connect(p);
      node = p;
    }
    node.connect(opts.bus || this.sfx);
    if (opts.reverb !== 0) {
      const rs = ctx.createGain();
      rs.gain.value = opts.reverb ?? 0.35;
      node.connect(rs).connect(this.reverb);
    }
    return g;
  }

  env(param, t, a, peak, d, end = 0.0001) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    param.exponentialRampToValueAtTime(Math.max(end, 0.0001), t + a + d);
  }

  noiseBurst(dest, t, dur, { type = 'white', filter = 'lowpass', freq = 1000, q = 0.7, freqEnd, vol = 1, attack = 0.002, rate = 1 } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise[type];
    s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g.gain, t, attack, vol, dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 3);
    s.stop(t + attack + dur + 0.05);
    return g;
  }

  tone(dest, t, dur, { type = 'sine', freq = 440, freqEnd, vol = 0.5, attack = 0.005, detune = 0, filter } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    this.env(g.gain, t, attack, vol, dur);
    let n = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      n = f;
    }
    n.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  play(name, pos = null, vol = 1) {
    if (!this.ready) return;
    const fn = this.sounds[name];
    if (!fn) return;
    try {
      fn.call(this, this.ctx.currentTime + 0.005, pos, vol);
    } catch (e) {
      console.warn('som falhou', name, e);
    }
  }

  footstep(surface, pos, run = false, vol = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, (run ? 0.5 : 0.3) * vol, { reverb: 0.2 });
    switch (surface) {
      case 'wood':
        this.noiseBurst(o, t, 0.08, { freq: 500, vol: 0.9 });
        this.tone(o, t, 0.09, { freq: rand(130, 170), freqEnd: 90, vol: 0.5 });
        if (Math.random() < 0.15) this.sounds.creak.call(this, t + 0.05, pos, 0.25);
        break;
      case 'metal':
        this.noiseBurst(o, t, 0.06, { freq: 2200, filter: 'bandpass', q: 6, vol: 0.9 });
        this.tone(o, t, 0.25, { freq: rand(400, 470), vol: 0.12, type: 'triangle' });
        break;
      case 'mud':
      case 'grass':
        this.noiseBurst(o, t, 0.12, { freq: 700, freqEnd: 300, vol: 1 });
        this.noiseBurst(o, t + 0.02, 0.1, { freq: 3000, filter: 'bandpass', q: 1, vol: 0.35 });
        break;
      case 'wet':
        this.noiseBurst(o, t, 0.07, { freq: 900, vol: 0.9 });
        this.noiseBurst(o, t + 0.01, 0.12, { freq: 4000, filter: 'bandpass', q: 0.8, vol: 0.5 });
        break;
      case 'water':
        this.noiseBurst(o, t, 0.25, { freq: 1500, filter: 'bandpass', q: 0.8, vol: 1.2, freqEnd: 600 });
        break;
      case 'tile':
        this.noiseBurst(o, t, 0.04, { freq: 3500, filter: 'bandpass', q: 1.5, vol: 0.8 });
        this.noiseBurst(o, t, 0.06, { freq: 600, vol: 0.6 });
        break;
      case 'glass':
        this.noiseBurst(o, t, 0.1, { freq: 5000, filter: 'highpass', vol: 0.8 });
        break;
      default:
        this.noiseBurst(o, t, 0.06, { freq: 1200, vol: 0.9 });
        this.tone(o, t, 0.05, { freq: 90, freqEnd: 50, vol: 0.4 });
    }
  }

  // ---------------------------------------------------------------- update contínuo
  update(dt, listener) {
    if (!this.ready) return;
    this.time += dt;
    const ctx = this.ctx;
    const L = ctx.listener;
    if (listener) {
      const { pos, fwd } = listener;
      if (L.positionX) {
        L.positionX.value = pos.x;
        L.positionY.value = pos.y;
        L.positionZ.value = pos.z;
        L.forwardX.value = fwd.x;
        L.forwardY.value = fwd.y;
        L.forwardZ.value = fwd.z;
        L.upX.value = 0;
        L.upY.value = 1;
        L.upZ.value = 0;
      } else {
        L.setPosition(pos.x, pos.y, pos.z);
        L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
      }
      this.listenerPos = pos;
    }
    // rádio
    const t = ctx.currentTime;
    this.radioGain.gain.setTargetAtTime(this.radioLevel * 0.16, t, 0.08);
    this.radioLfo.frequency.setTargetAtTime(4 + this.radioLevel * 18 + Math.random() * 4, t, 0.1);
    if (this.radioLevel > 0.05 && Math.random() < dt * this.radioLevel * 8) {
      const o = this.out(null, 0.15 * this.radioLevel, { reverb: 0 });
      this.noiseBurst(o, t, 0.02, { freq: 3000, filter: 'highpass', vol: 1 });
    }
    // respiração
    this.nextBreath -= dt;
    if (this.nextBreath <= 0 && this.breathLevel > 0.05) {
      const rate = 3.2 - this.breathLevel * 2.2;
      const inhale = this.breathPhase % 2 === 0;
      this.breathPhase++;
      const v = 0.05 + this.breathLevel * 0.22;
      const dur = rate * (inhale ? 0.4 : 0.5);
      const g = this.breathGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(v * (inhale ? 0.8 : 1), t + dur * 0.35);
      g.linearRampToValueAtTime(0.0001, t + dur);
      this.breathFilter.frequency.setValueAtTime(inhale ? 1400 : 900, t);
      this.nextBreath = dur + (inhale ? 0.05 : rate * 0.15);
    } else if (this.breathLevel <= 0.05) this.nextBreath = Math.min(this.nextBreath, 0.5);
    // batimentos cardíacos
    if (this.heartLevel > 0) {
      this.nextHeart = (this.nextHeart ?? 0) - dt;
      if (this.nextHeart <= 0) {
        this.nextHeart = 1.1 - this.heartLevel * 0.45;
        const o = this.out(null, 0.5 * this.heartLevel, { reverb: 0 });
        this.tone(o, t, 0.12, { freq: 60, freqEnd: 35, vol: 1 });
        this.tone(o, t + 0.22, 0.12, { freq: 55, freqEnd: 32, vol: 0.7 });
      }
    }
    // eventos ambientes aleatórios (poucos, para não virar susto constante)
    this.nextAmbient -= dt;
    if (this.nextAmbient <= 0) {
      this.nextAmbient = rand(7, 16);
      this.ambientEvent();
    }
  }

  ambientEvent() {
    const p = this.ambientProfile;
    const lp = this.listenerPos || { x: 0, y: 1, z: 0 };
    const far = () => {
      const a = Math.random() * Math.PI * 2;
      const d = rand(14, 30);
      return { x: lp.x + Math.cos(a) * d, y: rand(0.5, 3), z: lp.z + Math.sin(a) * d };
    };
    const choices = {
      outdoor: ['distantGroan', 'metalBang', 'dogHowl', 'creak', 'distantSteps', 'windGust', 'glassDistant'],
      forest: ['branchSnap', 'owl', 'dogHowl', 'distantGroan', 'windGust', 'branchSnap'],
      building: ['creak', 'creak', 'distantSteps', 'metalBang', 'distantGroan', 'drip', 'doorSlamFar'],
      hospital: ['creak', 'distantSteps', 'metalBang', 'distantGroan', 'drip', 'gurney', 'doorSlamFar'],
      basement: ['drip', 'drip', 'pipe', 'pipe', 'metalBang', 'distantGroan', 'distantSteps'],
      tunnels: ['drip', 'drip', 'pipe', 'rockfall', 'distantGroan', 'metalBang'],
      lab: ['pipe', 'beep', 'distantGroan', 'metalBang', 'drip', 'distantSteps'],
    }[p];
    if (!choices) return;
    this.play(pick(choices), far(), rand(0.4, 0.9));
  }

  // ---------------------------------------------------------------- música
  setMusic(track) {
    if (track === this.musicTrack) return;
    this.musicTrack = track;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (this.musicBus) {
      const old = this.musicBus;
      old.gain.setTargetAtTime(0.0001, t, 0.6);
      setTimeout(() => old.disconnect(), 4000);
    }
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.setValueAtTime(0.0001, t);
    this.musicBus.gain.setTargetAtTime(1, t + 0.1, 0.8);
    this.musicBus.connect(this.music);
    const rs = this.ctx.createGain();
    rs.gain.value = 0.6;
    this.musicBus.connect(rs).connect(this.reverb);
    this.musicStep = 0;
    this.nextNoteTime = t + 0.15;
  }

  scheduleMusic() {
    if (!this.ready || this.musicTrack === 'none' || !this.musicBus) return;
    const tr = TRACKS[this.musicTrack];
    if (!tr) return;
    const ctx = this.ctx;
    while (this.nextNoteTime < ctx.currentTime + 0.25) {
      tr.step.call(this, this.nextNoteTime, this.musicStep, this.musicBus);
      this.nextNoteTime += 60 / tr.bpm / (tr.div || 2);
      this.musicStep++;
    }
  }

  // instrumentos
  pad(dest, t, freq, dur, vol = 0.05, type = 'sawtooth', cutoff = 700) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(dest);
    for (const d of [-9, 0, 8]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = d;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  piano(dest, t, freq, vol = 0.12, dur = 2.5) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    f.connect(g).connect(dest);
    for (const [m, v, ty] of [
      [1, 1, 'triangle'],
      [2, 0.3, 'sine'],
      [3, 0.1, 'sine'],
    ]) {
      const o = ctx.createOscillator();
      o.type = ty;
      o.frequency.value = freq * m;
      o.detune.value = rand(-4, 4);
      const og = ctx.createGain();
      og.gain.value = v;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  drum(dest, t, freq = 60, vol = 0.5, dur = 0.35) {
    this.tone(dest, t, dur, { freq: freq * 2.2, freqEnd: freq * 0.6, vol });
    this.noiseBurst(dest, t, 0.04, { freq: 900, vol: vol * 0.3 });
  }

  metal(dest, t, vol = 0.2, base = 400) {
    for (const m of [1, 2.76, 5.4, 8.93]) {
      this.noiseBurst(dest, t, 0.4 / Math.sqrt(m), { filter: 'bandpass', freq: base * m, q: 25, vol: vol * 2 });
    }
  }

  choir(dest, t, freq, dur, vol = 0.04) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    for (const fm of [700, 1150]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fm;
      bp.Q.value = 8;
      bp.connect(g);
      for (const d of [-12, 0, 11]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = d;
        const v = ctx.createOscillator();
        v.frequency.value = 5 + Math.random();
        const vg = ctx.createGain();
        vg.gain.value = 4;
        v.connect(vg).connect(o.detune);
        o.connect(bp);
        o.start(t);
        v.start(t);
        o.stop(t + dur + 0.1);
        v.stop(t + dur + 0.1);
      }
    }
  }

  // "voz" de rádio ininteligível sob as legendas
  radioVoice(duration, pitch = 140) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = this.out(null, 0.22, { reverb: 0.1 });
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1400;
    hp.Q.value = 0.6;
    hp.connect(o);
    for (let t = 0; t < duration; t += rand(0.12, 0.3)) {
      const len = rand(0.08, 0.22);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch * rand(0.85, 1.25), t0 + t);
      osc.frequency.linearRampToValueAtTime(pitch * rand(0.8, 1.2), t0 + t + len);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = rand(500, 1600);
      f.Q.value = 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + t);
      g.gain.linearRampToValueAtTime(rand(0.15, 0.4), t0 + t + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, t0 + t + len);
      osc.connect(f).connect(g).connect(hp);
      osc.start(t0 + t);
      osc.stop(t0 + t + len + 0.05);
    }
    this.noiseBurst(o, t0, duration, { freq: 2000, filter: 'bandpass', q: 0.5, vol: 0.25, attack: 0.05 });
  }
}

// ------------------------------------------------------------------ trilhas
const TRACKS = {
  menu: {
    bpm: 40,
    div: 1,
    step(t, s, d) {
      if (s % 8 === 0) this.pad(d, t, NOTE(33), 12, 0.03, 'sawtooth', 300);
      if (s % 8 === 4) this.pad(d, t, NOTE(40), 12, 0.02, 'sawtooth', 300);
      if (Math.random() < 0.55) this.piano(d, t + rand(0, 0.3), NOTE(pick([69, 72, 76, 74, 71, 64, 67])), 0.05, 5);
    },
  },
  explore: {
    bpm: 30,
    div: 1,
    step(t, s, d) {
      if (s % 8 === 0) this.pad(d, t, NOTE(pick([33, 34, 31])), 16, 0.022, 'sawtooth', 220);
      if (s % 8 === 4 && Math.random() < 0.5) this.pad(d, t, NOTE(pick([45, 46, 44])), 14, 0.01, 'triangle', 600);
      if (Math.random() < 0.12) this.tone(d, t, 4, { freq: NOTE(pick([84, 87, 89, 91])), vol: 0.008, attack: 1.5 });
    },
  },
  tension: {
    bpm: 50,
    div: 1,
    step(t, s, d) {
      if (s % 8 === 0) this.pad(d, t, NOTE(32), 10, 0.03, 'sawtooth', 260);
      if (s % 8 === 0) this.pad(d, t, NOTE(33), 10, 0.02, 'sawtooth', 260);
      if (s % 2 === 0) this.drum(d, t, 40, 0.18, 0.5);
      if (Math.random() < 0.2) this.tone(d, t, 3, { freq: NOTE(pick([80, 81, 86])), vol: 0.01, attack: 1 });
    },
  },
  safe: {
    bpm: 66,
    div: 2,
    step(t, s, d) {
      const chords = [
        [57, 60, 64],
        [53, 57, 60],
        [48, 52, 55],
        [52, 56, 59],
      ];
      const c = chords[Math.floor(s / 16) % 4];
      if (s % 16 === 0) this.pad(d, t, NOTE(c[0] - 12), 7.5, 0.02, 'triangle', 800);
      const arp = [0, 1, 2, 1, 0, 2, 1, 2];
      if (s % 2 === 0) this.piano(d, t, NOTE(c[arp[(s / 2) % 8]] + 12), 0.045, 3);
      if (s % 32 === 30) this.piano(d, t, NOTE(c[2] + 24), 0.03, 4);
    },
  },
  chase: {
    bpm: 152,
    div: 2,
    step(t, s, d) {
      const bass = [40, 40, 41, 40, 40, 43, 41, 39];
      this.tone(d, t, 0.18, { type: 'sawtooth', freq: NOTE(bass[Math.floor(s / 4) % 8] - 12), vol: 0.09, filter: 500 });
      if (s % 4 === 0) this.drum(d, t, 50, 0.5);
      if (s % 8 === 4) this.noiseBurst(d, t, 0.15, { freq: 2000, filter: 'bandpass', q: 1, vol: 0.2 });
      if (s % 2 === 1) this.metal(d, t, 0.04, 900);
      if (s % 32 === 0) {
        this.pad(d, t, NOTE(76), 6, 0.025, 'sawtooth', 2500);
        this.pad(d, t, NOTE(77), 6, 0.02, 'sawtooth', 2500);
      }
    },
  },
  boss1: {
    bpm: 112,
    div: 2,
    step(t, s, d) {
      const riff = [40, 40, 41, 40, 46, 40, 41, 39];
      if (s % 2 === 0) this.tone(d, t, 0.25, { type: 'square', freq: NOTE(riff[(s / 2) % 8] - 12), vol: 0.06, filter: 420 });
      if (s % 4 === 0 || s % 16 === 10) this.drum(d, t, 45, 0.6);
      if (s % 8 === 4) this.metal(d, t, 0.12, 320);
      if (s % 16 === 14) this.metal(d, t, 0.08, 610);
      if (s % 32 === 0) this.pad(d, t, NOTE(52), 8, 0.02, 'sawtooth', 900);
    },
  },
  boss2: {
    bpm: 72,
    div: 2,
    step(t, s, d) {
      if (s % 4 === 0) {
        this.drum(d, t, 45, 0.6, 0.3);
        this.drum(d, t + 0.22, 40, 0.45, 0.3);
      }
      if (s % 16 === 0) {
        this.choir(d, t, NOTE(pick([57, 56, 58])), 6.5, 0.035);
        this.choir(d, t, NOTE(pick([63, 64, 62])), 6.5, 0.025);
      }
      if (s % 8 === 6 && Math.random() < 0.6) this.tone(d, t, 2, { freq: NOTE(pick([88, 89, 94])), vol: 0.012, attack: 0.5 });
    },
  },
  boss3: {
    bpm: 92,
    div: 2,
    step(t, s, d) {
      const pat = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0];
      if (pat[s % 16]) this.drum(d, t, s % 16 === 0 ? 38 : 55, 0.5, 0.4);
      if (s % 32 === 0) this.pad(d, t, NOTE(pick([33, 36])), 9, 0.05, 'sawtooth', 380);
      if (s % 32 === 16) this.pad(d, t, NOTE(pick([34, 31])), 9, 0.045, 'sawtooth', 380);
      if (s % 4 === 2) this.noiseBurst(d, t, 0.03, { freq: 4000, filter: 'highpass', vol: 0.12 });
    },
  },
  ending: {
    bpm: 48,
    div: 1,
    step(t, s, d) {
      const mel = [76, 74, 72, 71, 69, 67, 69, 64];
      if (s % 8 === 0) this.pad(d, t, NOTE(pick([45, 41, 43])), 11, 0.03, 'triangle', 700);
      this.piano(d, t, NOTE(mel[s % 8]), 0.05, 4);
    },
  },
};

// ------------------------------------------------------------------ efeitos sonoros
AudioSystem.prototype.sounds = {
  pistol(t, pos, v) {
    const o = this.out(pos, 0.9 * v, { reverb: 0.6, ref: 4 });
    this.noiseBurst(o, t, 0.18, { freq: 6000, freqEnd: 500, vol: 1.2 });
    this.tone(o, t, 0.15, { freq: 160, freqEnd: 40, vol: 0.9 });
    this.noiseBurst(o, t + 0.01, 0.4, { type: 'brown', freq: 400, vol: 0.6 });
  },
  shotgun(t, pos, v) {
    const o = this.out(pos, 1.1 * v, { reverb: 0.7, ref: 5 });
    this.noiseBurst(o, t, 0.35, { freq: 4500, freqEnd: 300, vol: 1.4 });
    this.tone(o, t, 0.3, { freq: 110, freqEnd: 30, vol: 1.2 });
    this.noiseBurst(o, t + 0.02, 0.8, { type: 'brown', freq: 300, vol: 0.8 });
  },
  pump(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.2 });
    this.noiseBurst(o, t, 0.05, { freq: 2500, filter: 'bandpass', q: 3, vol: 1 });
    this.noiseBurst(o, t + 0.16, 0.06, { freq: 1800, filter: 'bandpass', q: 3, vol: 1 });
  },
  reload(t, pos, v) {
    const o = this.out(pos, 0.45 * v, { reverb: 0.15 });
    this.noiseBurst(o, t, 0.04, { freq: 3000, filter: 'bandpass', q: 4, vol: 1 });
    this.noiseBurst(o, t + 0.5, 0.05, { freq: 2200, filter: 'bandpass', q: 4, vol: 1 });
    this.noiseBurst(o, t + 0.9, 0.04, { freq: 3500, filter: 'bandpass', q: 5, vol: 1 });
  },
  shell(t, pos, v) {
    const o = this.out(pos, 0.4 * v, { reverb: 0.1 });
    this.noiseBurst(o, t, 0.05, { freq: 2600, filter: 'bandpass', q: 4, vol: 1 });
  },
  empty(t, pos, v) {
    const o = this.out(pos, 0.4 * v, { reverb: 0.1 });
    this.noiseBurst(o, t, 0.02, { freq: 4000, filter: 'bandpass', q: 6, vol: 1 });
  },
  swing(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.1 });
    this.noiseBurst(o, t, 0.25, { freq: 400, freqEnd: 1600, filter: 'bandpass', q: 2, vol: 0.8, attack: 0.05 });
  },
  hitFlesh(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.2 });
    this.noiseBurst(o, t, 0.12, { freq: 600, freqEnd: 200, vol: 1.2 });
    this.tone(o, t, 0.1, { freq: 120, freqEnd: 50, vol: 0.6 });
  },
  hitMetal(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.3 });
    this.metal(o, t, 0.25, 700);
  },
  hitWall(t, pos, v) {
    const o = this.out(pos, 0.35 * v, { reverb: 0.2 });
    this.noiseBurst(o, t, 0.06, { freq: 2500, filter: 'bandpass', q: 1, vol: 1 });
  },
  pipeHit(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.3 });
    this.tone(o, t, 0.3, { freq: 600, type: 'triangle', vol: 0.3 });
    this.noiseBurst(o, t, 0.1, { freq: 800, vol: 1 });
  },
  pipeBreak(t, pos, v) {
    const o = this.out(pos, 0.8 * v, { reverb: 0.4 });
    this.metal(o, t, 0.3, 500);
    this.noiseBurst(o, t, 0.3, { freq: 2000, filter: 'bandpass', vol: 0.6 });
  },
  explosion(t, pos, v) {
    const o = this.out(pos, 1.4 * v, { reverb: 0.8, ref: 6 });
    this.noiseBurst(o, t, 1.6, { type: 'brown', freq: 900, freqEnd: 80, vol: 2 });
    this.tone(o, t, 0.8, { freq: 80, freqEnd: 25, vol: 1.4 });
    this.noiseBurst(o, t, 0.4, { freq: 5000, freqEnd: 400, vol: 0.8 });
  },
  doorOpen(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.4 });
    this.noiseBurst(o, t, 0.05, { freq: 2500, filter: 'bandpass', q: 4, vol: 0.8 });
    this.sounds.creak.call(this, t + 0.1, pos, 0.8 * v);
  },
  doorClose(t, pos, v) {
    const o = this.out(pos, 0.6 * v, { reverb: 0.5 });
    this.tone(o, t, 0.2, { freq: 90, freqEnd: 50, vol: 0.9 });
    this.noiseBurst(o, t, 0.12, { freq: 800, vol: 0.8 });
  },
  doorLocked(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.2 });
    for (let i = 0; i < 3; i++) this.noiseBurst(o, t + i * 0.09, 0.04, { freq: 1800 + i * 300, filter: 'bandpass', q: 5, vol: 1 });
  },
  unlock(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.2 });
    this.noiseBurst(o, t, 0.04, { freq: 2800, filter: 'bandpass', q: 6, vol: 1 });
    this.noiseBurst(o, t + 0.18, 0.06, { freq: 1500, filter: 'bandpass', q: 5, vol: 1 });
  },
  metalDoor(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.6 });
    this.noiseBurst(o, t, 1.2, { freq: 300, freqEnd: 900, filter: 'bandpass', q: 3, vol: 0.8, attack: 0.1 });
    this.metal(o, t + 1.1, 0.2, 200);
  },
  gate(t, pos, v) {
    const o = this.out(pos, 0.6 * v, { reverb: 0.4 });
    this.tone(o, t, 0.9, { type: 'sawtooth', freq: 900, freqEnd: 600, vol: 0.05, filter: 2500 });
    this.metal(o, t + 0.8, 0.2, 350);
  },
  chain(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.3 });
    for (let i = 0; i < 7; i++) this.noiseBurst(o, t + i * 0.05 + Math.random() * 0.03, 0.04, { freq: rand(2500, 4500), filter: 'bandpass', q: 8, vol: 0.9 });
  },
  creak(t, pos, v) {
    const ctx = this.ctx;
    const o = this.out(pos, 0.25 * v, { reverb: 0.5 });
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = rand(140, 260);
    osc.frequency.setValueAtTime(base, t);
    for (let i = 1; i < 8; i++) osc.frequency.linearRampToValueAtTime(base * rand(0.85, 1.3), t + i * 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(700, 1400);
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(bp).connect(g).connect(o);
    osc.start(t);
    osc.stop(t + 0.75);
  },
  pickup(t, pos, v) {
    const o = this.out(null, 0.25 * v, { bus: this.ui, reverb: 0.3 });
    this.tone(o, t, 0.25, { freq: 660, vol: 0.4, type: 'triangle' });
    this.tone(o, t + 0.08, 0.35, { freq: 990, vol: 0.3, type: 'triangle' });
  },
  keyItem(t, pos, v) {
    const o = this.out(null, 0.3 * v, { bus: this.ui, reverb: 0.5 });
    this.tone(o, t, 0.6, { freq: 523, vol: 0.3, type: 'triangle' });
    this.tone(o, t + 0.1, 0.6, { freq: 784, vol: 0.25, type: 'triangle' });
    this.tone(o, t + 0.2, 0.9, { freq: 1046, vol: 0.2, type: 'triangle' });
  },
  uiMove(t, pos, v) {
    const o = this.out(null, 0.12 * v, { bus: this.ui, reverb: 0 });
    this.tone(o, t, 0.04, { freq: 1200, vol: 0.4, type: 'square', filter: 2500 });
  },
  uiOk(t, pos, v) {
    const o = this.out(null, 0.18 * v, { bus: this.ui, reverb: 0.1 });
    this.tone(o, t, 0.08, { freq: 800, vol: 0.4, type: 'square', filter: 2000 });
    this.tone(o, t + 0.06, 0.1, { freq: 1200, vol: 0.3, type: 'square', filter: 2000 });
  },
  uiBack(t, pos, v) {
    const o = this.out(null, 0.15 * v, { bus: this.ui, reverb: 0.1 });
    this.tone(o, t, 0.1, { freq: 500, vol: 0.4, type: 'square', filter: 1500 });
  },
  uiError(t, pos, v) {
    const o = this.out(null, 0.2 * v, { bus: this.ui, reverb: 0.1 });
    this.tone(o, t, 0.25, { freq: 180, vol: 0.5, type: 'sawtooth', filter: 900 });
  },
  paper(t, pos, v) {
    const o = this.out(null, 0.3 * v, { bus: this.ui, reverb: 0.1 });
    this.noiseBurst(o, t, 0.25, { freq: 3000, filter: 'bandpass', q: 0.6, vol: 0.6, attack: 0.03 });
  },
  typewriter(t, pos, v) {
    const o = this.out(null, 0.25 * v, { bus: this.ui, reverb: 0.2 });
    for (let i = 0; i < 8; i++) this.noiseBurst(o, t + i * rand(0.07, 0.14), 0.03, { freq: 2200, filter: 'bandpass', q: 3, vol: 1 });
  },
  heal(t, pos, v) {
    const o = this.out(null, 0.3 * v, { bus: this.ui, reverb: 0.3 });
    this.noiseBurst(o, t, 0.4, { freq: 1500, filter: 'bandpass', q: 1, vol: 0.4, attack: 0.1 });
    this.tone(o, t + 0.1, 0.8, { freq: 440, vol: 0.15, type: 'sine' });
    this.tone(o, t + 0.25, 0.8, { freq: 660, vol: 0.12, type: 'sine' });
  },
  hurt(t, pos, v) {
    const o = this.out(null, 0.6 * v, { reverb: 0.2 });
    this.tone(o, t, 0.22, { type: 'sawtooth', freq: 190, freqEnd: 120, vol: 0.4, filter: 900 });
    this.noiseBurst(o, t, 0.18, { freq: 900, filter: 'bandpass', q: 1.5, vol: 0.6 });
  },
  death(t, pos, v) {
    const o = this.out(null, 0.7 * v, { reverb: 0.5 });
    this.tone(o, t, 0.9, { type: 'sawtooth', freq: 170, freqEnd: 70, vol: 0.4, filter: 800 });
    this.noiseBurst(o, t, 0.8, { freq: 700, filter: 'bandpass', q: 1, vol: 0.5 });
  },
  groan(t, pos, v) {
    const ctx = this.ctx;
    const o = this.out(pos, 0.5 * v, { reverb: 0.4 });
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f0 = rand(70, 105);
    const dur = rand(0.8, 1.6);
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f0 * rand(0.7, 1.1), t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = rand(4, 8);
    const vg = ctx.createGain();
    vg.gain.value = 6;
    vib.connect(vg).connect(osc.frequency);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = rand(450, 700);
    f1.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(f1).connect(g).connect(o);
    osc.start(t);
    vib.start(t);
    osc.stop(t + dur + 0.1);
    vib.stop(t + dur + 0.1);
    this.noiseBurst(o, t, dur * 0.8, { freq: 1200, filter: 'bandpass', q: 1, vol: 0.15, attack: 0.2 });
  },
  zombieAttack(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.3 });
    this.tone(o, t, 0.4, { type: 'sawtooth', freq: 140, freqEnd: 80, vol: 0.5, filter: 1200 });
    this.noiseBurst(o, t, 0.3, { freq: 1500, filter: 'bandpass', q: 1, vol: 0.5 });
  },
  bite(t, pos, v) {
    const o = this.out(pos, 0.8 * v, { reverb: 0.2 });
    this.noiseBurst(o, t, 0.15, { freq: 800, vol: 1.2 });
    this.noiseBurst(o, t + 0.12, 0.2, { freq: 400, vol: 0.9 });
  },
  zombieDie(t, pos, v) {
    const o = this.out(pos, 0.6 * v, { reverb: 0.4 });
    this.tone(o, t, 1.2, { type: 'sawtooth', freq: 110, freqEnd: 45, vol: 0.5, filter: 700 });
    this.tone(o, t + 0.9, 0.25, { freq: 70, freqEnd: 40, vol: 0.8 });
  },
  bodyFall(t, pos, v) {
    const o = this.out(pos, 0.6 * v, { reverb: 0.3 });
    this.tone(o, t, 0.25, { freq: 80, freqEnd: 40, vol: 0.9 });
    this.noiseBurst(o, t, 0.2, { freq: 500, vol: 0.7 });
  },
  growl(t, pos, v) {
    const ctx = this.ctx;
    const o = this.out(pos, 0.6 * v, { reverb: 0.3 });
    const s = ctx.createBufferSource();
    s.buffer = this.noise.brown;
    const am = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rand(25, 40);
    const lg = ctx.createGain();
    lg.gain.value = 0.8;
    lfo.connect(lg).connect(am.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 300;
    lp.Q.value = 1.5;
    const g = ctx.createGain();
    this.env(g.gain, t, 0.1, 1.5, 0.9);
    s.connect(lp).connect(am).connect(g).connect(o);
    s.start(t, rand(0, 2));
    lfo.start(t);
    s.stop(t + 1.1);
    lfo.stop(t + 1.1);
  },
  screech(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.4 });
    this.tone(o, t, 0.5, { type: 'sawtooth', freq: rand(900, 1300), freqEnd: rand(500, 700), vol: 0.25, filter: 4000 });
    this.tone(o, t, 0.5, { type: 'square', freq: rand(1400, 1800), freqEnd: 900, vol: 0.08, filter: 5000 });
    this.noiseBurst(o, t, 0.4, { freq: 3500, filter: 'bandpass', q: 2, vol: 0.4 });
  },
  vent(t, pos, v) {
    const o = this.out(pos, 0.8 * v, { reverb: 0.5 });
    this.metal(o, t, 0.3, 260);
    this.metal(o, t + 0.15, 0.25, 330);
    this.noiseBurst(o, t, 0.5, { freq: 900, vol: 0.6 });
  },
  vigiaStep(t, pos, v) {
    const o = this.out(pos, 0.9 * v, { reverb: 0.5, ref: 3 });
    this.tone(o, t, 0.3, { freq: 70, freqEnd: 32, vol: 1.2 });
    this.noiseBurst(o, t, 0.12, { freq: 400, vol: 0.8 });
    this.metal(o, t + 0.02, 0.05, 180);
  },
  vigiaBreath(t, pos, v) {
    const o = this.out(pos, 0.6 * v, { reverb: 0.4, ref: 3 });
    this.noiseBurst(o, t, 1.2, { freq: 500, filter: 'bandpass', q: 6, vol: 0.9, attack: 0.4 });
    this.tone(o, t, 1.3, { type: 'sawtooth', freq: 48, vol: 0.12, filter: 200, attack: 0.3 });
  },
  vigiaRoar(t, pos, v) {
    const ctx = this.ctx;
    const o = this.out(pos, 1.2 * v, { reverb: 0.8, ref: 5 });
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 4);
    }
    ws.curve = curve;
    ws.connect(o);
    this.tone(ws, t, 1.6, { type: 'sawtooth', freq: 70, freqEnd: 45, vol: 0.6, attack: 0.1 });
    this.tone(ws, t, 1.6, { type: 'sawtooth', freq: 104, freqEnd: 66, vol: 0.4, attack: 0.1 });
    this.noiseBurst(o, t, 1.5, { freq: 800, filter: 'bandpass', q: 1, vol: 0.5, attack: 0.1 });
  },
  wallBreak(t, pos, v) {
    const o = this.out(pos, 1.3 * v, { reverb: 0.8, ref: 5 });
    this.noiseBurst(o, t, 1.4, { type: 'brown', freq: 1200, freqEnd: 100, vol: 2 });
    this.tone(o, t, 0.5, { freq: 70, freqEnd: 30, vol: 1.2 });
    for (let i = 0; i < 10; i++) this.noiseBurst(o, t + 0.2 + Math.random() * 1.2, 0.08, { freq: rand(1500, 4000), filter: 'bandpass', q: 2, vol: 0.4 });
  },
  bossRoar(t, pos, v) {
    const ctx = this.ctx;
    const o = this.out(pos, 1.3 * v, { reverb: 0.8, ref: 6 });
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 128) - 1) * 6);
    ws.curve = curve;
    ws.connect(o);
    this.tone(ws, t, 2, { type: 'sawtooth', freq: 55, freqEnd: 38, vol: 0.6, attack: 0.15 });
    this.tone(ws, t, 2, { type: 'square', freq: 83, freqEnd: 52, vol: 0.3, attack: 0.15 });
    this.noiseBurst(o, t, 1.8, { freq: 600, filter: 'bandpass', q: 1, vol: 0.6, attack: 0.15 });
  },
  slam(t, pos, v) {
    const o = this.out(pos, 1.3 * v, { reverb: 0.7, ref: 6 });
    this.tone(o, t, 0.6, { freq: 60, freqEnd: 25, vol: 1.5 });
    this.noiseBurst(o, t, 0.6, { type: 'brown', freq: 600, freqEnd: 80, vol: 1.5 });
  },
  heartbeatBoss(t, pos, v) {
    const o = this.out(pos, 0.9 * v, { reverb: 0.5, ref: 6 });
    this.tone(o, t, 0.2, { freq: 55, freqEnd: 30, vol: 1.4 });
    this.tone(o, t + 0.25, 0.2, { freq: 50, freqEnd: 28, vol: 1.0 });
  },
  squelch(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.4 });
    this.noiseBurst(o, t, 0.35, { freq: 300, freqEnd: 900, filter: 'bandpass', q: 3, vol: 1.2 });
    this.tone(o, t, 0.3, { freq: 200, freqEnd: 90, vol: 0.4, type: 'sine' });
  },
  spit(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.3 });
    this.noiseBurst(o, t, 0.3, { freq: 2000, freqEnd: 600, filter: 'bandpass', q: 1, vol: 1 });
  },
  sizzle(t, pos, v) {
    const o = this.out(pos, 0.3 * v, { reverb: 0.2 });
    this.noiseBurst(o, t, 0.8, { freq: 5000, filter: 'highpass', vol: 0.5, attack: 0.05 });
  },
  bellow(t, pos, v) {
    const ctx = this.ctx;
    const o = this.out(pos, 1.2 * v, { reverb: 0.9, ref: 8 });
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.linearRampToValueAtTime(90, t + 0.6);
    osc.frequency.linearRampToValueAtTime(50, t + 2.2);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900, t + 0.7);
    f.frequency.linearRampToValueAtTime(250, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.3);
    osc.connect(f).connect(g).connect(o);
    osc.start(t);
    osc.stop(t + 2.4);
  },
  clicks(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.6, ref: 5 });
    const n = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) this.noiseBurst(o, t + i * 0.06, 0.012, { freq: 3500, filter: 'bandpass', q: 3, vol: 1.3 });
  },
  gallop(t, pos, v) {
    const o = this.out(pos, 0.9 * v, { reverb: 0.4, ref: 5 });
    this.tone(o, t, 0.2, { freq: 70, freqEnd: 35, vol: 1 });
    this.tone(o, t + 0.12, 0.2, { freq: 65, freqEnd: 35, vol: 0.8 });
  },
  thunder(t, pos, v) {
    const o = this.out(null, 0.9 * v, { reverb: 0.6, bus: this.outFilter });
    this.noiseBurst(o, t, 0.5, { type: 'brown', freq: 2000, freqEnd: 300, vol: 0.8 });
    this.noiseBurst(o, t + 0.1, 4, { type: 'brown', freq: 400, freqEnd: 60, vol: 1.5, attack: 0.2 });
  },
  // ambientes
  distantGroan(t, pos, v) {
    this.sounds.groan.call(this, t, pos, 0.6 * v);
  },
  metalBang(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.9, ref: 3 });
    this.metal(o, t, 0.2, rand(150, 300));
  },
  dogHowl(t, pos, v) {
    const o = this.out(pos, 0.25 * v, { reverb: 0.8, ref: 3 });
    this.tone(o, t, 2.2, { type: 'sawtooth', freq: 500, freqEnd: 380, vol: 0.15, filter: 1400, attack: 0.4 });
  },
  distantSteps(t, pos, v) {
    for (let i = 0; i < 6; i++) {
      const o = this.out(pos, 0.25 * v, { reverb: 0.8 });
      this.noiseBurst(o, t + i * 0.55, 0.06, { freq: 700, vol: 0.9 });
      this.tone(o, t + i * 0.55, 0.06, { freq: 80, freqEnd: 50, vol: 0.4 });
    }
  },
  windGust(t, pos, v) {
    const o = this.out(null, 0.3 * v, { reverb: 0.2, bus: this.outFilter });
    this.noiseBurst(o, t, 3, { type: 'pink', filter: 'bandpass', freq: 300, freqEnd: 900, q: 1.5, vol: 0.8, attack: 1.2 });
  },
  glassDistant(t, pos, v) {
    const o = this.out(pos, 0.3 * v, { reverb: 0.8 });
    for (let i = 0; i < 6; i++) this.noiseBurst(o, t + Math.random() * 0.4, 0.15, { freq: rand(4000, 8000), filter: 'bandpass', q: 6, vol: 0.6 });
  },
  branchSnap(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.5 });
    this.noiseBurst(o, t, 0.05, { freq: 1500, filter: 'bandpass', q: 2, vol: 1.2 });
    this.noiseBurst(o, t + 0.06, 0.08, { freq: 900, filter: 'bandpass', q: 2, vol: 0.6 });
  },
  owl(t, pos, v) {
    const o = this.out(pos, 0.15 * v, { reverb: 0.7 });
    this.tone(o, t, 0.4, { freq: 380, freqEnd: 340, vol: 0.4, attack: 0.08 });
    this.tone(o, t + 0.6, 0.6, { freq: 370, freqEnd: 330, vol: 0.4, attack: 0.08 });
  },
  drip(t, pos, v) {
    const o = this.out(pos, 0.3 * v, { reverb: 0.8, ref: 1 });
    this.tone(o, t, 0.08, { freq: rand(1200, 2200), freqEnd: rand(500, 800), vol: 0.5 });
  },
  pipe(t, pos, v) {
    const o = this.out(pos, 0.35 * v, { reverb: 0.9, ref: 3 });
    this.tone(o, t, 2, { type: 'sawtooth', freq: rand(55, 80), freqEnd: rand(40, 60), vol: 0.12, filter: 300, attack: 0.3 });
    this.metal(o, t + rand(0.5, 1.5), 0.1, rand(120, 200));
  },
  doorSlamFar(t, pos, v) {
    const o = this.out(pos, 0.4 * v, { reverb: 0.9, ref: 3 });
    this.tone(o, t, 0.3, { freq: 70, freqEnd: 40, vol: 1 });
    this.noiseBurst(o, t, 0.2, { freq: 600, vol: 0.8 });
  },
  gurney(t, pos, v) {
    const o = this.out(pos, 0.25 * v, { reverb: 0.8 });
    this.tone(o, t, 1.5, { type: 'sawtooth', freq: 900, freqEnd: 1100, vol: 0.03, filter: 3000, attack: 0.2 });
  },
  rockfall(t, pos, v) {
    const o = this.out(pos, 0.4 * v, { reverb: 0.9 });
    for (let i = 0; i < 8; i++) this.noiseBurst(o, t + Math.random() * 1, 0.1, { freq: rand(300, 1200), vol: 0.6 });
  },
  beep(t, pos, v) {
    const o = this.out(pos, 0.15 * v, { reverb: 0.7 });
    this.tone(o, t, 0.15, { freq: 1000, vol: 0.3, type: 'square', filter: 3000 });
    this.tone(o, t + 0.3, 0.15, { freq: 1000, vol: 0.3, type: 'square', filter: 3000 });
  },
  alarm(t, pos, v) {
    const o = this.out(pos, 0.4 * v, { reverb: 0.7, ref: 6 });
    for (let i = 0; i < 4; i++) this.tone(o, t + i * 0.6, 0.5, { type: 'sawtooth', freq: 600, freqEnd: 900, vol: 0.15, filter: 2000 });
  },
  generator(t, pos, v) {
    const o = this.out(pos, 0.8 * v, { reverb: 0.5, ref: 4 });
    this.noiseBurst(o, t, 1.5, { type: 'brown', freq: 200, freqEnd: 600, vol: 1, attack: 0.3 });
    this.tone(o, t + 0.5, 2.5, { type: 'sawtooth', freq: 30, freqEnd: 60, vol: 0.3, filter: 300, attack: 0.5 });
  },
  powerOn(t, pos, v) {
    const o = this.out(null, 0.4 * v, { reverb: 0.8 });
    this.tone(o, t, 1.5, { type: 'sawtooth', freq: 40, freqEnd: 120, vol: 0.2, filter: 600, attack: 0.3 });
    for (let i = 0; i < 6; i++) this.noiseBurst(o, t + 0.5 + i * 0.25, 0.04, { freq: 3000, filter: 'bandpass', q: 3, vol: 0.5 });
  },
  breaker(t, pos, v) {
    const o = this.out(null, 0.35 * v, { bus: this.ui, reverb: 0.3 });
    this.noiseBurst(o, t, 0.04, { freq: 2000, filter: 'bandpass', q: 3, vol: 1 });
    this.tone(o, t, 0.06, { freq: 150, freqEnd: 80, vol: 0.5 });
  },
  spark(t, pos, v) {
    const o = this.out(pos, 0.4 * v, { reverb: 0.3 });
    for (let i = 0; i < 5; i++) this.noiseBurst(o, t + Math.random() * 0.3, 0.03, { freq: 5000, filter: 'highpass', vol: 0.8 });
  },
  water(t, pos, v) {
    const o = this.out(pos, 0.6 * v, { reverb: 0.7 });
    this.noiseBurst(o, t, 3, { type: 'pink', freq: 900, filter: 'bandpass', q: 0.8, vol: 0.8, attack: 0.5 });
  },
  valve(t, pos, v) {
    const o = this.out(pos, 0.5 * v, { reverb: 0.6 });
    this.tone(o, t, 1.4, { type: 'sawtooth', freq: 300, freqEnd: 200, vol: 0.06, filter: 1500, attack: 0.2 });
    this.metal(o, t + 1.3, 0.12, 260);
  },
  elevator(t, pos, v) {
    const o = this.out(pos, 0.7 * v, { reverb: 0.7 });
    this.noiseBurst(o, t, 4, { type: 'brown', freq: 300, vol: 0.8, attack: 0.5 });
    this.tone(o, t, 4, { type: 'sawtooth', freq: 50, vol: 0.1, filter: 200, attack: 0.5 });
    this.metal(o, t, 0.2, 220);
  },
  stinger(t, pos, v) {
    const o = this.out(null, 0.4 * v, { bus: this.music, reverb: 0.8 });
    this.tone(o, t, 2.5, { type: 'sawtooth', freq: NOTE(41), vol: 0.15, filter: 900, attack: 0.02 });
    this.tone(o, t, 2.5, { type: 'sawtooth', freq: NOTE(42), vol: 0.12, filter: 900, attack: 0.02 });
    this.noiseBurst(o, t, 1.5, { freq: 3000, filter: 'bandpass', q: 1, vol: 0.3, attack: 0.02 });
  },
  saveChime(t, pos, v) {
    const o = this.out(null, 0.25 * v, { bus: this.ui, reverb: 0.8 });
    [64, 67, 71, 76].forEach((n, i) => this.piano(o, t + i * 0.18, NOTE(n), 0.2, 2.5));
  },
  radioSquelch(t, pos, v) {
    const o = this.out(null, 0.35 * v, { reverb: 0 });
    this.noiseBurst(o, t, 0.25, { freq: 1800, filter: 'bandpass', q: 0.8, vol: 1 });
    this.tone(o, t + 0.2, 0.08, { freq: 1400, vol: 0.2, type: 'square', filter: 3000 });
  },
};

export { clamp };
