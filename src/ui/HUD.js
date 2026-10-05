import * as THREE from 'three';
import { SHOT } from '../config/Constants.js';

const $ = (sel, root = document) => root.querySelector(sel);

function fmtClock(sec) {
  if (sec == null) return '--:--';
  if (sec < 60) return sec.toFixed(1).padStart(4, '0');
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Interface durante o jogo: placar, cronômetros, posse, energia, barra de
 * arremesso, nome do jogador, mensagens e animação de pontos.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.el = {
      hud: $('#hud'),
      scorebug: $('#scorebug'),
      homeAbbr: $('#sb-home .abbr'),
      awayAbbr: $('#sb-away .abbr'),
      homeScore: $('#sb-home .score'),
      awayScore: $('#sb-away .score'),
      homeFouls: $('#sb-home .fouls'),
      awayFouls: $('#sb-away .fouls'),
      homeTeam: $('#sb-home'),
      awayTeam: $('#sb-away'),
      period: $('#sb-period'),
      clock: $('#sb-clock'),
      shot: $('#sb-shot'),
      card: $('#playerCard'),
      cardNum: $('#playerCard .num'),
      cardName: $('#playerCard .name'),
      cardPos: $('#playerCard .pos'),
      energy: $('#playerCard .energy .fill'),
      meter: $('#shotMeter'),
      meterFill: $('#shotMeter .fill'),
      meterZone: $('#shotMeter .zone'),
      meterPerfect: $('#shotMeter .perfect'),
      meterLabel: $('#shotMeter .label'),
      messages: $('#messages'),
      popup: $('#pointsPopup'),
      hints: $('#hints'),
      training: $('#trainingPanel'),
      fade: $('#fade'),
    };
    this.v = new THREE.Vector3();
    this.lastText = {};
    this.meterHold = 0;
    this.layoutMeter();
  }

  layoutMeter() {
    const z0 = SHOT.sweetSpot - SHOT.goodWindow;
    const p0 = SHOT.sweetSpot - SHOT.perfectWindow;
    this.el.meterZone.style.bottom = `${(z0 / 1.12) * 100}%`;
    this.el.meterZone.style.height = `${((SHOT.goodWindow * 2) / 1.12) * 100}%`;
    this.el.meterPerfect.style.bottom = `${(p0 / 1.12) * 100}%`;
    this.el.meterPerfect.style.height = `${((SHOT.perfectWindow * 2) / 1.12) * 100}%`;
  }

  show(v) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  setText(key, el, text) {
    if (this.lastText[key] === text) return;
    this.lastText[key] = text;
    el.textContent = text;
  }

  setHints(visible, mode) {
    const h = this.el.hints;
    h.classList.toggle('hidden', !visible);
    const extra =
      mode === 'training'
        ? '<div><b>T</b> defensor &nbsp; <b>F</b> lance livre &nbsp; <b>R</b> reposicionar</div>'
        : '<div><b>Q</b> trocar jogador</div>';
    h.innerHTML = `
      <div><b>WASD</b> mover &nbsp; <b>Shift</b> correr</div>
      <div><b>Espaço</b> segurar/soltar: arremesso • bandeja • enterrada (correndo)</div>
      <div><b>E</b> passe / roubo &nbsp; <b>X</b> drible especial &nbsp; <b>C</b> pular/toco</div>
      ${extra}
      <div class="muted"><b>H</b> ocultar dicas &nbsp; <b>Esc</b> pausa</div>`;
  }

  update(dt, state, camera, renderer) {
    if (!state) return;
    const el = this.el;
    const t0 = state.teams[0];
    const t1 = state.teams[1];
    if (state.type === 'match') {
      el.scorebug.classList.remove('hidden');
      el.training.classList.add('hidden');
      this.setText('ha', el.homeAbbr, t0.abbr);
      this.setText('aa', el.awayAbbr, t1.abbr);
      el.homeTeam.style.setProperty('--team', state.kits[0].primary);
      el.awayTeam.style.setProperty('--team', state.kits[1].primary);
      this.setText('hs', el.homeScore, String(state.score[0]));
      this.setText('as', el.awayScore, String(state.score[1]));
      this.setText('hf', el.homeFouls, `F ${state.fouls[0]}`);
      this.setText('af', el.awayFouls, `F ${state.fouls[1]}`);
      this.setText('per', el.period, state.period);
      this.setText('clk', el.clock, fmtClock(state.clock));
      const sc = state.shotClockOff ? '' : String(Math.ceil(state.shotClock));
      this.setText('shc', el.shot, sc);
      el.shot.classList.toggle('low', state.shotClock <= 5 && !state.shotClockOff);
      el.homeTeam.classList.toggle('poss', state.possession === 0);
      el.awayTeam.classList.toggle('poss', state.possession === 1);
    } else {
      el.scorebug.classList.add('hidden');
      el.training.classList.remove('hidden');
      const s = state.stats;
      const pct = s.attempts ? Math.round((s.makes / s.attempts) * 100) : 0;
      const html = `
        <div class="tp-title">TREINAMENTO</div>
        <div class="tp-row"><span>Cestas</span><b>${s.makes}/${s.attempts} (${pct}%)</b></div>
        <div class="tp-row"><span>3 pontos</span><b>${s.threesM}/${s.threesA}</b></div>
        <div class="tp-row"><span>Lances livres</span><b>${s.ftM}/${s.ftA}</b></div>
        <div class="tp-row"><span>Soltura perfeita</span><b>${s.perfect}</b></div>
        <div class="tp-row"><span>Sequência</span><b>${s.streak} (máx ${s.best})</b></div>
        <div class="tp-row"><span>Defensor</span><b>${state.defender ? 'Ativo' : 'Desligado'}</b></div>`;
      if (this.lastText.tp !== html) {
        this.lastText.tp = html;
        el.training.innerHTML = html;
      }
    }

    const p = state.human;
    if (p) {
      el.card.classList.remove('hidden');
      this.setText('cn', el.cardName, p.name);
      this.setText('cnum', el.cardNum, String(p.number));
      el.card.style.setProperty('--team', p.model.kit.primary);
      const labels = { guard: 'Armador', wing: 'Ala', big: 'Pivô' };
      this.setText('cpos', el.cardPos, `${labels[p.archetype] || ''}${p.hasBall ? ' • com a bola' : ''}`);
      el.energy.style.width = `${Math.round(p.energy * 100)}%`;
      el.energy.classList.toggle('low', p.energy < 0.3);
      this.updateMeter(dt, p, camera, renderer);
    } else {
      el.card.classList.add('hidden');
      el.meter.classList.add('hidden');
    }
  }

  updateMeter(dt, p, camera, renderer) {
    const el = this.el;
    const shooting = (p.action === 'shoot' || p.action === 'ft') && p.actionData && p.actionData.meter != null;
    if (shooting) {
      this.meterHold = 0.7;
      const m = p.actionData.meter;
      el.meterFill.style.height = `${Math.min(100, (m / 1.12) * 100)}%`;
      if (!p.actionData.released) {
        el.meterLabel.textContent = '';
        el.meter.className = '';
      } else if (p.actionData.timingShown !== true) {
        p.actionData.timingShown = true;
      }
    } else {
      this.meterHold -= dt;
    }
    if (this.meterHold <= 0) {
      el.meter.classList.add('hidden');
      return;
    }
    el.meter.classList.remove('hidden');
    // posiciona a barra ao lado do jogador
    this.v.set(p.pos.x, p.pos.y + p.height * 0.75, p.pos.z);
    this.v.project(camera);
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const x = (this.v.x * 0.5 + 0.5) * w + 46;
    const y = (-this.v.y * 0.5 + 0.5) * h;
    el.meter.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - 70)}px)`;
  }

  showTiming(timing) {
    const el = this.el;
    if (!timing) return;
    el.meter.className = timing.grade;
    el.meterLabel.textContent = timing.label;
  }

  message(text, sub = '', kind = 'info', duration = 1.6) {
    const box = document.createElement('div');
    box.className = `msg ${kind}`;
    box.innerHTML = `<div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
    box.style.animationDuration = `${duration}s`;
    this.el.messages.appendChild(box);
    while (this.el.messages.children.length > 3) this.el.messages.firstChild.remove();
    setTimeout(() => box.remove(), duration * 1000 + 50);
  }

  points(points, color, label) {
    const el = this.el.popup;
    el.innerHTML = `<div class="pts" style="--c:${color}">+${points}</div><div class="lbl">${label}</div>`;
    el.classList.remove('anim');
    void el.offsetWidth;
    el.classList.add('anim');
  }

  fade(fn, quick = false) {
    const f = this.el.fade;
    const d = quick ? 120 : 280;
    f.style.transitionDuration = `${d}ms`;
    f.classList.add('on');
    setTimeout(() => {
      try {
        fn();
      } finally {
        setTimeout(() => f.classList.remove('on'), 60);
      }
    }, d);
  }
}
