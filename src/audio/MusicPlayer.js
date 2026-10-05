// Música procedural com sequenciador simples (bateria, baixo e acordes).
// Duas trilhas: menu (groove relaxado) e partida (mais energética).
const TRACKS = {
  menu: {
    bpm: 88,
    swing: 0.12,
    chords: [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 65],
      [52, 55, 59, 62],
    ],
    bass: [45, null, null, 45, null, 52, null, null, 41, null, null, 41, null, 48, null, null],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
    chordGain: 0.05,
    lead: false,
  },
  game: {
    bpm: 104,
    swing: 0.06,
    chords: [
      [50, 53, 57, 60],
      [50, 53, 57, 60],
      [46, 50, 53, 57],
      [48, 52, 55, 58],
    ],
    bass: [38, null, 38, null, null, 38, null, 41, 38, null, 38, null, 45, null, 43, null],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    chordGain: 0.035,
    lead: true,
  },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class MusicPlayer {
  constructor(audio) {
    this.audio = audio;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.noise = null;
  }

  play(name) {
    if (!this.audio.ctx) return;
    if (this.track === TRACKS[name]) return;
    this.track = TRACKS[name];
    this.step = 0;
    this.nextTime = this.audio.ctx.currentTime + 0.1;
    if (!this.noise) {
      const c = this.audio.ctx;
      const n = c.sampleRate;
      this.noise = c.createBuffer(1, n, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    this.track = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    const c = this.audio.ctx;
    if (!c || !this.track) return;
    const tr = this.track;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % tr.chords.length;
      const swing = s % 2 === 1 ? tr.swing * stepDur : 0;
      const t = this.nextTime + swing;
      if (tr.kick[s]) this.kick(t);
      if (tr.snare[s]) this.snare(t);
      if (tr.hat[s]) this.hat(t, s % 4 === 2 ? 0.07 : 0.035);
      if (tr.bass[s] != null) this.bass(t, tr.bass[s] + (bar === 2 ? -2 : bar === 3 ? 2 : 0), stepDur * 2);
      if (s === 0) this.chord(t, tr.chords[bar], stepDur * 15, tr.chordGain);
      if (tr.lead && (s === 6 || s === 14) && Math.random() < 0.6) {
        const ch = tr.chords[bar];
        this.lead(t, ch[Math.floor(Math.random() * ch.length)] + 12, stepDur * 1.5);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  out() {
    return this.audio.musicBus;
  }

  kick(t) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + 0.32);
  }

  noiseHit(t, dur, gain, type, freq) {
    const c = this.audio.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out());
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  snare(t) {
    this.noiseHit(t, 0.18, 0.3, 'bandpass', 1800);
    const c = this.audio.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 190;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + 0.12);
  }

  hat(t, gain) {
    this.noiseHit(t, 0.05, gain, 'highpass', 7000);
  }

  bass(t, note, dur) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(note);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  chord(t, notes, dur, gain) {
    const c = this.audio.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1600, t + dur * 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.08);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g);
    g.connect(this.out());
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  lead(t, note, dur) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = mtof(note);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
