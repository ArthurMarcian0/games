// HUD minimalista: vida, stamina, arma/munição, prompt de interação,
// mira, mensagens, barra de chefe e indicador de rádio.
import { el, clamp } from '../core/utils.js';
import { WEAPONS } from '../game/Items.js';

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'hud hidden');
    root.appendChild(this.root);
    this.root.innerHTML = `
      <div class="hud-vitals">
        <div class="hud-ecg"><canvas width="140" height="34"></canvas></div>
        <div class="hud-bar hp"><div></div></div>
        <div class="hud-bar st"><div></div></div>
      </div>
      <div class="hud-weapon"><div class="wname"></div><div class="wammo"></div></div>
      <div class="hud-radio"><span></span><span></span><span></span><span></span></div>
      <div class="hud-prompt"></div>
      <div class="hud-cross"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="hud-msgs"></div>
      <div class="hud-boss hidden"><div class="bname"></div><div class="bbar"><div></div></div></div>
      <div class="hud-struggle hidden"><div class="slabel">SOLTE-SE! [E] / [ESPAÇO]</div><div class="sbar"><div></div></div></div>
      <div class="hud-hint hidden"></div>
      <div class="hud-timer hidden"></div>
      <div class="hud-fps hidden"></div>`;
    const q = (s) => this.root.querySelector(s);
    this.ecg = q('.hud-ecg canvas').getContext('2d');
    this.hpBar = q('.hud-bar.hp div');
    this.stBar = q('.hud-bar.st div');
    this.stWrap = q('.hud-bar.st');
    this.vitals = q('.hud-vitals');
    this.wname = q('.wname');
    this.wammo = q('.wammo');
    this.weaponBox = q('.hud-weapon');
    this.radioEl = q('.hud-radio');
    this.promptEl = q('.hud-prompt');
    this.cross = q('.hud-cross');
    this.msgs = q('.hud-msgs');
    this.boss = q('.hud-boss');
    this.bossName = q('.bname');
    this.bossBar = q('.bbar div');
    this.struggle = q('.hud-struggle');
    this.struggleBar = q('.sbar div');
    this.hintEl = q('.hud-hint');
    this.timerEl = q('.hud-timer');
    this.fpsEl = q('.hud-fps');
    this.ecgBuf = new Array(140).fill(17);
    this.ecgHead = 0;
    this.ecgPhase = 0;
    this.ecgAcc = 0;
    this.idle = 0;
    this.lastPrompt = '';
    this.fpsAcc = 0;
    this.fpsN = 0;
  }

  show(v) {
    this.root.classList.toggle('hidden', !v);
  }

  message(text, dur = 3.2) {
    const m = el('div', 'hud-msg', text);
    this.msgs.appendChild(m);
    while (this.msgs.children.length > 3) this.msgs.firstChild.remove();
    setTimeout(() => m.classList.add('out'), dur * 1000);
    setTimeout(() => m.remove(), dur * 1000 + 600);
  }

  hint(text, dur = 7) {
    this.hintEl.innerHTML = text;
    this.hintEl.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hintEl.classList.add('hidden'), dur * 1000);
  }

  setTimer(text) {
    if (!text) this.timerEl.classList.add('hidden');
    else {
      this.timerEl.classList.remove('hidden');
      this.timerEl.textContent = text;
    }
  }

  flashWeapon() {
    this.weaponBox.classList.remove('flash');
    void this.weaponBox.offsetWidth;
    this.weaponBox.classList.add('flash');
    this.updateWeapon();
  }

  updateWeapon() {
    const g = this.game;
    const id = g.state?.equipped;
    let name = 'Desarmado';
    let ammo = '';
    if (id) {
      const w = WEAPONS[id];
      name = w.name;
      if (w.melee) ammo = `<span class="dur">${'▮'.repeat(Math.ceil(g.state.weapons.pipe.dur / 4))}</span>`;
      else {
        const mag = g.state.weapons[id].mag;
        ammo = `<b class="${mag === 0 ? 'empty' : ''}">${mag}</b><span>/ ${g.inv.ammoFor(id)}</span>`;
      }
    }
    const key = name + ammo;
    if (key === this.lastWeapon) return;
    this.lastWeapon = key;
    this.wname.textContent = name;
    this.wammo.innerHTML = ammo;
  }

  updateHealth() {
    /* desenhado em update */
  }

  setStruggle(v, show) {
    if (show !== undefined) this.struggle.classList.toggle('hidden', !show);
    this.struggleBar.style.width = `${clamp(v, 0, 1) * 100}%`;
  }

  setBoss(name, ratio) {
    if (!name) {
      this.boss.classList.add('hidden');
      return;
    }
    this.boss.classList.remove('hidden');
    this.bossName.textContent = name;
    this.bossBar.style.width = `${clamp(ratio, 0, 1) * 100}%`;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!g.state) return;
    // vida em faixas (Bem / Cuidado / Perigo), sem números
    const hp = p.hp;
    const col = hp > 66 ? '#5fae5a' : hp > 33 ? '#d8b23a' : '#c8402c';
    this.hpBar.style.width = `${hp}%`;
    this.hpBar.style.background = col;
    this.stBar.style.width = `${p.stamina}%`;
    this.stWrap.classList.toggle('low', p.exhausted);
    // eletrocardiograma em varredura (como um monitor cardíaco)
    const bpm = hp > 66 ? 68 : hp > 33 ? 96 : 132;
    this.ecgAcc += Math.min(dt, 0.1) * 46;
    while (this.ecgAcc >= 1) {
      this.ecgAcc -= 1;
      this.ecgPhase += bpm / 60 / 46;
      const k = this.ecgPhase % 1;
      let y = 17;
      const amp = hp > 33 ? 1 : 0.6;
      if (k < 0.06) y = 17 - Math.sin((k / 0.06) * Math.PI) * 2;
      else if (k >= 0.1 && k < 0.12) y = 17 - ((k - 0.1) / 0.02) * 15 * amp;
      else if (k >= 0.12 && k < 0.15) y = 17 - 15 * amp + ((k - 0.12) / 0.03) * (11 + 15 * amp);
      else if (k >= 0.15 && k < 0.18) y = 28 - ((k - 0.15) / 0.03) * 11;
      else if (k >= 0.3 && k < 0.42) y = 17 - Math.sin(((k - 0.3) / 0.12) * Math.PI) * 3.5;
      this.ecgBuf[this.ecgHead] = y;
      this.ecgHead = (this.ecgHead + 1) % 140;
    }
    const c = this.ecg;
    c.clearRect(0, 0, 140, 34);
    c.strokeStyle = col;
    c.lineWidth = 1.6;
    c.shadowColor = col;
    c.shadowBlur = 6;
    c.beginPath();
    let pen = false;
    for (let x = 0; x < 140; x++) {
      const gap = (x - this.ecgHead + 140) % 140;
      if (gap < 8) {
        pen = false;
        continue;
      }
      const y = this.ecgBuf[x];
      if (!pen) c.moveTo(x, y);
      else c.lineTo(x, y);
      pen = true;
    }
    c.stroke();
    // estado de repouso: HUD mais discreta
    const active = p.aiming || p.hp < 66 || p.stamina < 99 || p.hurtT > 0 || g.fear > 0.2;
    this.idle = active ? 0 : this.idle + dt;
    this.root.classList.toggle('calm', this.idle > 4);
    // rádio
    const lvl = g.radioLevel || 0;
    const bars = this.radioEl.children;
    for (let i = 0; i < 4; i++) bars[i].classList.toggle('on', lvl > i * 0.22 + 0.05 && Math.random() > 0.15);
    this.radioEl.classList.toggle('active', lvl > 0.05);
    // prompt
    const f = g.mode === 'playing' ? g.world.focus : null;
    const ptxt = f ? (typeof f.prompt === 'function' ? f.prompt(g) : f.prompt) : '';
    if (ptxt !== this.lastPrompt) {
      this.lastPrompt = ptxt;
      this.promptEl.innerHTML = ptxt ? `<kbd>E</kbd> ${ptxt}` : '';
      this.promptEl.classList.toggle('on', !!ptxt);
    }
    // mira
    const aiming = p.aiming && g.mode === 'playing';
    this.cross.classList.toggle('on', aiming);
    if (aiming) {
      const spread = p.spread;
      const px = 8 + spread * 380;
      this.cross.style.setProperty('--s', `${px}px`);
    }
    // chefe
    const boss = g.world.enemies.find((e) => e.isBoss && e.alive && e.state !== 'intro');
    if (boss) this.setBoss(boss.name, boss.hp / boss.maxHp);
    else this.setBoss(null);
    if (g.debug) {
      this.fpsAcc += dt;
      this.fpsN++;
      if (this.fpsAcc > 0.5) {
        this.fpsEl.classList.remove('hidden');
        this.fpsEl.textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps · ${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)}`;
        this.fpsAcc = 0;
        this.fpsN = 0;
      }
    }
    this.updateWeapon();
  }
}
