// Interface: telas (título, opções, pausa, morte, final), inventário,
// arquivos, mapa, baú, leitura de documentos, diálogos, rádio e enigmas.
import { el, clamp, formatTime } from '../core/utils.js';
import { ITEMS, RECIPES, WEAPONS } from '../game/Items.js';
import { DOCS, KIND_LABEL, AREA_NAMES } from '../game/Story.js';
import { iconURL, SYMBOLS, SYMBOL_NAMES } from './icons.js';
import { BINDINGS } from '../core/Input.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nl = (s) => esc(s).replace(/\n/g, '<br>');

export class UI {
  constructor(game, root) {
    this.g = game;
    this.root = root;
    this.layer = el('div', 'ui-layer');
    root.appendChild(this.layer);
    this.subs = el('div', 'radio-subs hidden');
    root.appendChild(this.subs);
    this.fadeEl = el('div', 'fade');
    root.appendChild(this.fadeEl);
    this.clickEl = el('div', 'click-to-play hidden', '<div>Clique para continuar</div><small>(o mouse controla a câmera)</small>');
    root.appendChild(this.clickEl);
    this.clickEl.addEventListener('click', () => this.g.resumeLock());
    this.loadingEl = el('div', 'loading hidden', '<div class="ld-title">PEDRA FUNDA</div><div class="ld-text"></div><div class="ld-bar"><div></div></div>');
    root.appendChild(this.loadingEl);
    this.stack = [];
    this.radioQueue = [];
    this.radioBusy = false;
  }

  get open() {
    return this.stack.length > 0;
  }
  top() {
    return this.stack[this.stack.length - 1];
  }

  push(m) {
    if (!this.stack.length) this.g.enterUI();
    this.stack.push(m);
    this.layer.appendChild(m.el);
    requestAnimationFrame(() => m.el.classList.add('in'));
    return m;
  }

  close(m, silent = false) {
    const i = this.stack.indexOf(m);
    if (i < 0) return;
    this.stack.splice(i, 1);
    m.el.remove();
    if (m.onClose) m.onClose();
    // adiado: se outro modal abrir logo em seguida, o jogo não "pisca" de volta
    if (!silent) queueMicrotask(() => {
      if (!this.stack.length) this.g.exitUI();
    });
  }

  closeAll() {
    while (this.stack.length) this.close(this.top(), true);
  }

  onKey(e) {
    const m = this.top();
    if (m && m.onKey) m.onKey(e);
  }

  modal(cls, html) {
    const m = { el: el('div', 'modal ' + cls, html) };
    m.q = (s) => m.el.querySelector(s);
    m.qa = (s) => [...m.el.querySelectorAll(s)];
    return m;
  }

  sfx(n) {
    this.g.audio.play(n);
  }

  // ------------------------------------------------------------ utilidades
  fade(to, dur = 0.6) {
    return new Promise((res) => {
      this.fadeEl.style.transition = `opacity ${dur}s ease`;
      this.fadeEl.style.opacity = to;
      setTimeout(res, dur * 1000 + 30);
    });
  }

  loading(text, pct) {
    if (text === null) {
      this.loadingEl.classList.add('hidden');
      return;
    }
    this.loadingEl.classList.remove('hidden');
    this.loadingEl.querySelector('.ld-text').textContent = text;
    if (pct !== undefined) this.loadingEl.querySelector('.ld-bar div').style.width = `${pct * 100}%`;
  }

  showClick(v) {
    this.clickEl.classList.toggle('hidden', !v);
  }

  // menu navegável por teclado
  menuNav(m, selector = 'button:not([disabled])') {
    let idx = 0;
    const items = () => m.qa(selector);
    const focus = () => {
      const it = items();
      it.forEach((b, i) => b.classList.toggle('sel', i === idx));
    };
    m.el.addEventListener('mousemove', (e) => {
      const it = items();
      const k = it.indexOf(e.target.closest('button'));
      if (k >= 0 && k !== idx) {
        idx = k;
        focus();
      }
    });
    setTimeout(focus, 0);
    return (e) => {
      const it = items();
      if (!it.length) return false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        idx = (idx + 1) % it.length;
        focus();
        this.sfx('uiMove');
        return true;
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        idx = (idx - 1 + it.length) % it.length;
        focus();
        this.sfx('uiMove');
        return true;
      }
      if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space') {
        it[idx]?.click();
        return true;
      }
      return false;
    };
  }

  confirm(text, onYes, onNo) {
    const m = this.modal('confirm', `<div class="panel small"><p>${nl(text)}</p><div class="row"><button data-y>Sim</button><button data-n>Não</button></div></div>`);
    const nav = this.menuNav(m);
    m.q('[data-y]').onclick = () => {
      this.sfx('uiOk');
      this.close(m);
      onYes && onYes();
    };
    m.q('[data-n]').onclick = () => {
      this.sfx('uiBack');
      this.close(m);
      onNo && onNo();
    };
    m.onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') m.q('[data-n]').click();
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') nav({ code: 'ArrowDown' });
      else nav(e);
    };
    this.push(m);
  }

  choose(title, options, cb) {
    const m = this.modal(
      'panel-screen',
      `<div class="panel small"><h2>${esc(title)}</h2><nav class="menu">${options.map((o, i) => `<button data-i="${i}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}<button data-back>Cancelar</button></nav></div>`,
    );
    const nav = this.menuNav(m);
    m.onKey = (e) => (e.code === 'Escape' || e.code === 'Tab' ? m.q('[data-back]').click() : nav(e));
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.back !== undefined) {
        this.sfx('uiBack');
        this.close(m);
        return;
      }
      this.sfx('uiOk');
      this.close(m);
      cb(options[+b.dataset.i].value);
    });
    this.push(m);
  }

  // ------------------------------------------------------------ título
  title() {
    const g = this.g;
    const hasSave = g.saves.list().some((s) => s);
    const m = this.modal(
      'title',
      `<div class="title-wrap">
        <div class="logo">PEDRA FUNDA</div>
        <div class="logo-sub">PARTE I · QUARENTENA</div>
        <nav class="menu">
          <button data-a="continue" ${hasSave ? '' : 'disabled'}>Continuar</button>
          <button data-a="new">Novo jogo</button>
          <button data-a="load" ${hasSave ? '' : 'disabled'}>Carregar</button>
          <button data-a="settings">Configurações</button>
          <button data-a="controls">Controles</button>
          <button data-a="credits">Créditos</button>
        </nav>
        <div class="title-foot">Use fones de ouvido. O som é parte do jogo.</div>
      </div>`,
    );
    m.noClose = true;
    const nav = this.menuNav(m);
    m.onKey = (e) => nav(e);
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      this.sfx('uiOk');
      const a = b.dataset.a;
      if (a === 'continue') g.continueGame();
      if (a === 'new') this.newGame();
      if (a === 'load') this.slots('load', (slot) => g.loadGame(slot));
      if (a === 'settings') this.settings();
      if (a === 'controls') this.controls();
      if (a === 'credits') this.credits();
    });
    this.push(m);
    this.titleModal = m;
    return m;
  }

  newGame() {
    const m = this.modal(
      'panel-screen',
      `<div class="panel">
        <h2>Novo jogo</h2>
        <p class="muted">Escolha a dificuldade. Ela afeta o dano recebido, a resistência das criaturas e a munição encontrada.</p>
        <nav class="menu">
          <button data-d="easy">Fácil <small>Mais munição, criaturas mais frágeis. Para quem quer a história.</small></button>
          <button data-d="normal">Normal <small>A experiência pensada para o jogo.</small></button>
          <button data-d="hard">Difícil <small>Cada bala conta. Cada erro também.</small></button>
          <button data-back>Voltar</button>
        </nav>
      </div>`,
    );
    const nav = this.menuNav(m);
    m.onKey = (e) => {
      if (e.code === 'Escape') m.q('[data-back]').click();
      else nav(e);
    };
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.back !== undefined) {
        this.sfx('uiBack');
        this.close(m);
        return;
      }
      this.sfx('uiOk');
      this.closeAll();
      this.g.newGame(b.dataset.d);
    });
    this.push(m);
  }

  credits() {
    const m = this.modal(
      'panel-screen',
      `<div class="panel">
        <h2>Créditos</h2>
        <p><b>Pedra Funda — Parte I: Quarentena</b></p>
        <p class="muted">Protótipo de survival horror em terceira pessoa. Toda a geometria, as texturas, a música e os efeitos sonoros são gerados por código em tempo real (Three.js + Web Audio).</p>
        <p class="muted">Personagens, empresas e lugares são fictícios. Qualquer semelhança é coincidência.</p>
        <nav class="menu"><button data-back>Voltar</button></nav>
      </div>`,
    );
    const nav = this.menuNav(m);
    m.onKey = (e) => (e.code === 'Escape' ? m.q('[data-back]').click() : nav(e));
    m.q('[data-back]').onclick = () => {
      this.sfx('uiBack');
      this.close(m);
    };
    this.push(m);
  }

  // ------------------------------------------------------------ configurações
  settings() {
    const s = this.g.settings;
    const slider = (k, label, min, max, step, fmt = (v) => Math.round(v * 100) + '%') =>
      `<div class="set-row"><label>${label}</label><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s.get(k)}"><span class="val" data-v="${k}">${fmt(s.get(k))}</span></div>`;
    const toggle = (k, label) => `<div class="set-row"><label>${label}</label><button class="tog ${s.get(k) ? 'on' : ''}" data-t="${k}">${s.get(k) ? 'Sim' : 'Não'}</button></div>`;
    const q = s.get('quality');
    const m = this.modal(
      'panel-screen',
      `<div class="panel wide">
        <h2>Configurações</h2>
        <div class="set-grid">
          <div>
            <h3>Áudio</h3>
            ${slider('master', 'Volume geral', 0, 1, 0.05)}
            ${slider('music', 'Música', 0, 1, 0.05)}
            ${slider('sfx', 'Efeitos', 0, 1, 0.05)}
            ${slider('ambient', 'Ambiente', 0, 1, 0.05)}
            <h3>Controles</h3>
            ${slider('sensitivity', 'Sensibilidade do mouse', 0.2, 2.5, 0.05, (v) => v.toFixed(2))}
            ${toggle('invertY', 'Inverter eixo vertical')}
          </div>
          <div>
            <h3>Vídeo</h3>
            <div class="set-row"><label>Qualidade gráfica</label><div class="seg" data-q>
              <button data-qv="low" class="${q === 'low' ? 'on' : ''}">Baixa</button><button data-qv="medium" class="${q === 'medium' ? 'on' : ''}">Média</button><button data-qv="high" class="${q === 'high' ? 'on' : ''}">Alta</button></div></div>
            ${slider('brightness', 'Brilho', 0.6, 1.8, 0.05)}
            ${slider('fov', 'Campo de visão', 55, 85, 1, (v) => Math.round(v) + '°')}
            ${slider('shake', 'Tremor de câmera', 0, 1.5, 0.05)}
            ${toggle('hints', 'Dicas na tela')}
            <div class="bright-test"><span>Ajuste o brilho até o símbolo da esquerda ficar quase invisível.</span><i></i><i></i></div>
          </div>
        </div>
        <nav class="menu row"><button data-back>Voltar</button></nav>
      </div>`,
    );
    m.qa('input[type=range]').forEach((inp) => {
      inp.oninput = () => {
        const k = inp.dataset.k;
        const v = parseFloat(inp.value);
        s.set(k, v);
        const span = m.q(`[data-v="${k}"]`);
        span.textContent = k === 'sensitivity' ? v.toFixed(2) : k === 'fov' ? Math.round(v) + '°' : Math.round(v * 100) + '%';
      };
    });
    m.qa('[data-t]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.t;
        s.set(k, !s.get(k));
        b.classList.toggle('on', s.get(k));
        b.textContent = s.get(k) ? 'Sim' : 'Não';
        this.sfx('uiMove');
      };
    });
    m.qa('[data-qv]').forEach((b) => {
      b.onclick = () => {
        s.set('quality', b.dataset.qv);
        m.qa('[data-qv]').forEach((x) => x.classList.toggle('on', x === b));
        this.g.renderer.applyQuality();
        this.sfx('uiMove');
      };
    });
    m.q('[data-back]').onclick = () => {
      this.sfx('uiBack');
      this.close(m);
    };
    m.onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') m.q('[data-back]').click();
    };
    this.push(m);
  }

  controls() {
    const rows = [
      ['Mover', 'W A S D'],
      ['Olhar / câmera', 'Mouse'],
      ['Correr (gasta stamina)', 'Shift'],
      ['Mirar', 'Botão direito (segurar) ou C'],
      ['Atirar / golpear', 'Botão esquerdo (mirando)'],
      ['Recarregar', 'R'],
      ['Interagir / examinar / abrir', 'E'],
      ['Virada rápida (180°)', 'Q'],
      ['Lanterna liga/desliga', 'F'],
      ['Trocar arma', '1 · 2 · 3'],
      ['Cura rápida', 'H'],
      ['Inventário', 'Tab ou I'],
      ['Mapa', 'M'],
      ['Soltar-se de um agarrão', 'Apertar E / Espaço repetidamente'],
      ['Pausar', 'Esc ou P'],
    ];
    const m = this.modal(
      'panel-screen',
      `<div class="panel">
        <h2>Controles</h2>
        <table class="ctl">${rows.map((r) => `<tr><td>${r[0]}</td><td><kbd>${r[1]}</kbd></td></tr>`).join('')}</table>
        <p class="muted small">Dica: andar devagar faz menos barulho. Algumas criaturas caçam pelo som. Desligar a lanterna ajuda a passar despercebido — e a se perder.</p>
        <nav class="menu"><button data-back>Voltar</button></nav>
      </div>`,
    );
    m.q('[data-back]').onclick = () => {
      this.sfx('uiBack');
      this.close(m);
    };
    m.onKey = (e) => {
      if (['Escape', 'Tab', 'Enter', 'KeyE'].includes(e.code)) m.q('[data-back]').click();
    };
    this.push(m);
  }

  // ------------------------------------------------------------ pausa
  pause() {
    const m = this.modal(
      'pause',
      `<div class="panel small">
        <h2>Pausado</h2>
        <div class="muted center">${esc(AREA_NAMES[this.g.world.id] || '')} · ${formatTime(this.g.state.time)}</div>
        <nav class="menu">
          <button data-a="resume">Continuar</button>
          <button data-a="settings">Configurações</button>
          <button data-a="controls">Controles</button>
          <button data-a="load">Carregar jogo</button>
          <button data-a="quit">Sair para o menu</button>
        </nav>
      </div>`,
    );
    const nav = this.menuNav(m);
    m.onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') m.q('[data-a=resume]').click();
      else nav(e);
    };
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.sfx('uiOk');
      const a = b.dataset.a;
      if (a === 'resume') this.close(m);
      if (a === 'settings') this.settings();
      if (a === 'controls') this.controls();
      if (a === 'load') this.slots('load', (slot) => this.g.loadGame(slot));
      if (a === 'quit') this.confirm('Sair para o menu principal? O progresso desde o último salvamento será perdido.', () => this.g.toTitle());
    });
    this.push(m);
  }

  // ------------------------------------------------------------ salvar/carregar
  slots(mode, cb) {
    const list = this.g.saves.list();
    const m = this.modal(
      'panel-screen',
      `<div class="panel">
        <h2>${mode === 'save' ? 'Gravar diário' : 'Carregar jogo'}</h2>
        <p class="muted">${mode === 'save' ? 'Escolha onde registrar seu progresso.' : 'Escolha um registro.'}</p>
        <nav class="menu slots">
          ${list
            .map((s, i) =>
              s
                ? `<button data-s="${i}"><b>Registro ${i + 1}</b> — ${esc(AREA_NAMES[s.map] || s.map)}<small>${formatTime(s.time)} de jogo · ${new Date(s.date).toLocaleString('pt-BR')} · ${({ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' })[s.difficulty] || ''}</small></button>`
                : `<button data-s="${i}" ${mode === 'load' ? 'disabled' : ''}><b>Registro ${i + 1}</b> — vazio</button>`,
            )
            .join('')}
          <button data-back>Voltar</button>
        </nav>
      </div>`,
    );
    const nav = this.menuNav(m);
    m.onKey = (e) => (e.code === 'Escape' || e.code === 'Tab' ? m.q('[data-back]').click() : nav(e));
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.back !== undefined) {
        this.sfx('uiBack');
        this.close(m);
        return;
      }
      const i = +b.dataset.s;
      this.sfx('uiOk');
      if (mode === 'save' && list[i])
        this.confirm('Sobrescrever este registro?', () => {
          this.close(m);
          cb(i);
        });
      else {
        this.close(m, mode === 'load');
        cb(i);
      }
    });
    this.push(m);
  }

  // ------------------------------------------------------------ morte / final
  gameOver() {
    const m = this.modal(
      'gameover',
      `<div class="go-wrap"><div class="go-title">VOCÊ MORREU</div>
        <nav class="menu">
          <button data-a="retry" ${this.g.saves.list().some((s) => s) ? '' : 'disabled'}>Continuar do último registro</button>
          <button data-a="title">Menu principal</button>
        </nav></div>`,
    );
    const nav = this.menuNav(m);
    m.noClose = true;
    m.onKey = (e) => nav(e);
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      this.sfx('uiOk');
      if (b.dataset.a === 'retry') this.g.continueGame();
      else this.g.toTitle();
    });
    this.push(m);
  }

  async introText(lines, opts = {}) {
    const m = this.modal('intro', `<div class="intro-text"></div><div class="intro-skip">Enter — pular</div>`);
    let skip = false;
    m.onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') skip = true;
    };
    m.el.addEventListener('click', () => (skip = true));
    this.push(m);
    const box = m.q('.intro-text');
    for (const line of lines) {
      if (skip) break;
      const p = el('p', '', esc(line));
      box.appendChild(p);
      requestAnimationFrame(() => p.classList.add('on'));
      this.sfx('typewriter');
      const dur = opts.speed ? opts.speed : 1400 + line.length * 38;
      for (let t = 0; t < dur && !skip; t += 100) await new Promise((r) => setTimeout(r, 100));
    }
    if (!skip) await new Promise((r) => setTimeout(r, 1200));
    m.el.classList.add('out');
    await new Promise((r) => setTimeout(r, 600));
    this.close(m, true);
  }

  ending(lines, stats) {
    const m = this.modal('ending', `<div class="intro-text"></div>`);
    m.noClose = true;
    this.push(m);
    const box = m.q('.intro-text');
    let i = 0;
    const next = () => {
      if (i < lines.length) {
        const p = el('p', '', esc(lines[i++]));
        box.appendChild(p);
        requestAnimationFrame(() => p.classList.add('on'));
        setTimeout(next, 2600 + lines[i - 1].length * 35);
      } else {
        setTimeout(() => {
          box.innerHTML = `
            <div class="end-title">FIM DA PARTE I</div>
            <div class="end-sub">Continua em <b>PEDRA FUNDA — PARTE II: NÍVEL 4</b></div>
            <table class="stats">
              <tr><td>Tempo de jogo</td><td>${formatTime(stats.time)}</td></tr>
              <tr><td>Dificuldade</td><td>${({ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' })[stats.difficulty]}</td></tr>
              <tr><td>Criaturas abatidas</td><td>${stats.kills}</td></tr>
              <tr><td>Disparos</td><td>${stats.shots}</td></tr>
              <tr><td>Registros no diário</td><td>${stats.saves}</td></tr>
              <tr><td>Documentos encontrados</td><td>${stats.docs} / ${stats.docsTotal}</td></tr>
            </table>
            <nav class="menu"><button data-a="title">Menu principal</button></nav>`;
          const nav = this.menuNav(m);
          m.onKey = (e) => nav(e);
          m.q('[data-a=title]').onclick = () => this.g.toTitle();
        }, 2500);
      }
    };
    setTimeout(next, 1200);
  }

  // ------------------------------------------------------------ examinar / diálogo / rádio
  examine(lines, onDone) {
    const m = this.modal('examine', `<div class="ex-box"><div class="ex-text"></div><div class="ex-next">▼</div></div>`);
    let i = 0;
    const txt = m.q('.ex-text');
    const show = () => {
      txt.innerHTML = nl(lines[i]);
    };
    const adv = () => {
      i++;
      if (i >= lines.length) {
        this.close(m);
        if (onDone) onDone();
      } else {
        this.sfx('uiMove');
        show();
      }
    };
    m.onKey = (e) => {
      if (['KeyE', 'Enter', 'Space', 'Escape'].includes(e.code)) adv();
    };
    m.el.addEventListener('click', adv);
    show();
    this.push(m);
  }

  dialog(lines, onDone) {
    const m = this.modal('dialog', `<div class="dl-box"><div class="dl-who"></div><div class="dl-text"></div><div class="ex-next">▼</div></div>`);
    let i = 0;
    let shown = 0;
    let full = '';
    let timer = null;
    const who = m.q('.dl-who');
    const txt = m.q('.dl-text');
    const show = () => {
      const L = lines[i];
      who.textContent = L.who;
      who.classList.toggle('me', L.who === 'Tomás');
      full = L.text;
      shown = 0;
      clearInterval(timer);
      timer = setInterval(() => {
        shown += 2;
        txt.textContent = full.slice(0, shown);
        if (shown >= full.length) clearInterval(timer);
      }, 22);
    };
    const adv = () => {
      if (shown < full.length) {
        shown = full.length;
        txt.textContent = full;
        clearInterval(timer);
        return;
      }
      i++;
      if (i >= lines.length) {
        clearInterval(timer);
        this.close(m);
        if (onDone) onDone();
      } else {
        this.sfx('uiMove');
        show();
      }
    };
    m.onKey = (e) => {
      if (['KeyE', 'Enter', 'Space'].includes(e.code)) adv();
      if (e.code === 'Escape') {
        i = lines.length - 1;
        shown = full.length;
        adv();
      }
    };
    m.el.addEventListener('click', adv);
    show();
    this.push(m);
  }

  radio(lines) {
    this.radioQueue.push(...lines);
    if (!this.radioBusy) this.nextRadio();
  }

  nextRadio() {
    const L = this.radioQueue.shift();
    if (!L) {
      this.radioBusy = false;
      this.subs.classList.add('hidden');
      return;
    }
    this.radioBusy = true;
    this.subs.classList.remove('hidden');
    const isMe = L.who === 'Tomás';
    this.subs.innerHTML = `<div class="rs-icon ${isMe ? 'me' : ''}"></div><div><div class="rs-who">${esc(L.who)}</div><div class="rs-text">${esc(L.text)}</div></div>`;
    const dur = 2.2 + L.text.length * 0.055;
    if (!isMe) {
      this.g.audio.play('radioSquelch');
      this.g.audio.radioVoice(dur * 0.85, L.who.includes('Marina') ? 190 : L.who.includes('???') ? 120 : 210);
    }
    setTimeout(() => this.nextRadio(), dur * 1000);
  }

  // ------------------------------------------------------------ documentos
  openDoc(id, onClose) {
    const d = DOCS[id];
    if (!d) return;
    let page = 0;
    const m = this.modal(
      `doc kind-${d.kind}`,
      `<div class="doc-paper">
        <div class="doc-kind">${KIND_LABEL[d.kind] || ''}</div>
        <div class="doc-title">${esc(d.title)}</div>
        ${d.kind === 'tape' ? '<div class="tape-ind"><span></span> reproduzindo</div>' : ''}
        <div class="doc-body"></div>
        <div class="doc-nav"><button data-p>◀</button><span class="doc-pg"></span><button data-n>▶</button><button data-x>Fechar</button></div>
      </div>`,
    );
    const body = m.q('.doc-body');
    const show = () => {
      body.innerHTML = nl(d.pages[page]);
      m.q('.doc-pg').textContent = `${page + 1} / ${d.pages.length}`;
      m.q('[data-p]').disabled = page === 0;
      m.q('[data-n]').disabled = page === d.pages.length - 1;
      if (d.kind === 'tape') this.g.audio.radioVoice(3 + d.pages[page].length * 0.02, 160);
    };
    const go = (k) => {
      const np = clamp(page + k, 0, d.pages.length - 1);
      if (np !== page) {
        page = np;
        this.sfx('paper');
        show();
      }
    };
    m.q('[data-p]').onclick = () => go(-1);
    m.q('[data-n]').onclick = () => go(1);
    m.q('[data-x]').onclick = () => this.close(m);
    m.onClose = onClose;
    m.onKey = (e) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) go(-1);
      else if (['ArrowRight', 'KeyD'].includes(e.code)) go(1);
      else if (['KeyE', 'Enter', 'Space'].includes(e.code)) {
        if (page < d.pages.length - 1) go(1);
        else this.close(m);
      } else if (['Escape', 'Tab'].includes(e.code)) this.close(m);
    };
    this.sfx('paper');
    show();
    this.push(m);
  }

  // ------------------------------------------------------------ inventário
  inventory(tab = 'items') {
    const g = this.g;
    const m = this.modal(
      'inventory',
      `<div class="inv-panel">
        <div class="inv-tabs"><button data-tab="items">ITENS</button><button data-tab="files">ARQUIVOS</button><button data-tab="map">MAPA</button><span class="inv-close">Tab / Esc — fechar</span></div>
        <div class="inv-body"></div>
      </div>`,
    );
    const body = m.q('.inv-body');
    let cur = tab;
    let sub = null;
    const setTab = (t) => {
      cur = t;
      m.qa('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
      body.innerHTML = '';
      if (t === 'items') sub = this.itemsTab(body, m);
      else if (t === 'files') sub = this.filesTab(body, m);
      else sub = this.mapTab(body, m);
    };
    m.qa('[data-tab]').forEach((b) => (b.onclick = () => (this.sfx('uiMove'), setTab(b.dataset.tab))));
    m.onKey = (e) => {
      if (sub && sub.onKey && sub.onKey(e)) return;
      if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyI') this.close(m);
      else if (e.code === 'KeyM') setTab('map');
      else if (e.code === 'KeyQ' || e.code === 'BracketLeft') setTab(cur === 'items' ? 'map' : cur === 'files' ? 'items' : 'files');
      else if (e.code === 'KeyR' || e.code === 'BracketRight') setTab(cur === 'items' ? 'files' : cur === 'files' ? 'map' : 'items');
    };
    m.onClose = () => g.hud.updateWeapon();
    setTab(tab);
    this.push(m);
    return m;
  }

  itemsTab(body, m) {
    const g = this.g;
    body.innerHTML = `
      <div class="inv-left">
        <div class="status"><canvas width="220" height="60"></canvas><div class="st-label"></div></div>
        <div class="equip"><div class="eq-label">ARMA EQUIPADA</div><div class="eq-slot"></div></div>
        <div class="inv-tip">Combine itens para economizar espaço. Itens-chave são usados automaticamente nas portas.</div>
      </div>
      <div class="inv-grid"></div>
      <div class="inv-right"><div class="it-name"></div><div class="it-desc"></div><div class="it-actions"></div><div class="it-msg"></div></div>`;
    const grid = body.querySelector('.inv-grid');
    const name = body.querySelector('.it-name');
    const desc = body.querySelector('.it-desc');
    const actions = body.querySelector('.it-actions');
    const msg = body.querySelector('.it-msg');
    const stc = body.querySelector('.status canvas').getContext('2d');
    const stl = body.querySelector('.st-label');
    let sel = 0;
    let combineFrom = -1;
    let actIdx = -1;
    let actList = [];
    const hp = g.player.hp;
    const col = hp > 66 ? '#5fae5a' : hp > 33 ? '#d8b23a' : '#c8402c';
    stl.innerHTML = `<b style="color:${col}">${hp > 66 ? 'BEM' : hp > 33 ? 'CUIDADO' : 'PERIGO'}</b>`;
    let ecgT = 0;
    const drawEcg = () => {
      if (!body.isConnected) return;
      ecgT += 0.016 * (hp > 66 ? 1 : hp > 33 ? 1.5 : 2.2);
      stc.clearRect(0, 0, 220, 60);
      stc.strokeStyle = col;
      stc.lineWidth = 2;
      stc.shadowColor = col;
      stc.shadowBlur = 8;
      stc.beginPath();
      for (let x = 0; x < 220; x++) {
        const k = ((x / 220) * 3 + ecgT) % 1;
        let y = 30;
        if (k > 0.4 && k < 0.45) y = 30 - (k - 0.4) * 500;
        else if (k >= 0.45 && k < 0.5) y = 5 + (k - 0.45) * 1000;
        else if (k >= 0.5 && k < 0.55) y = 55 - (k - 0.5) * 500;
        x ? stc.lineTo(x, y) : stc.moveTo(x, y);
      }
      stc.stroke();
      requestAnimationFrame(drawEcg);
    };
    drawEcg();

    const render = () => {
      const st = g.state;
      grid.innerHTML = '';
      for (let i = 0; i < st.invSize; i++) {
        const s = st.inv[i];
        const cell = el('div', 'slot' + (i === sel ? ' sel' : '') + (i === combineFrom ? ' comb' : '') + (s && s.id === st.equipped ? ' eq' : ''));
        if (s) {
          const d = ITEMS[s.id];
          cell.innerHTML = `<img src="${iconURL(s.id)}" alt=""><span class="nm">${esc(d.name)}</span>${s.qty > 1 || d.type === 'ammo' ? `<span class="qty">${s.qty}</span>` : ''}${d.type === 'key' ? '<span class="keyb">◆</span>' : ''}`;
          if (d.type === 'weapon' && WEAPONS[s.id] && !WEAPONS[s.id].melee) cell.innerHTML += `<span class="mag">${st.weapons[s.id].mag}</span>`;
        }
        cell.onclick = () => {
          if (sel === i && combineFrom < 0) openActions();
          else {
            sel = i;
            if (combineFrom >= 0) doCombine();
            else closeActions();
            render();
          }
        };
        grid.appendChild(cell);
      }
      const eq = st.equipped;
      body.querySelector('.eq-slot').innerHTML = eq
        ? `<img src="${iconURL(eq)}"><span>${esc(ITEMS[eq].name)}</span><b>${WEAPONS[eq].melee ? '' : st.weapons[eq].mag + ' / ' + g.inv.ammoFor(eq)}</b>`
        : '<span class="muted">nenhuma</span>';
      const s = st.inv[sel];
      if (s) {
        const d = ITEMS[s.id];
        name.textContent = d.name + (s.qty > 1 ? ` ×${s.qty}` : '');
        desc.textContent = d.desc;
      } else {
        name.textContent = combineFrom >= 0 ? 'Combinar com...' : '—';
        desc.textContent = combineFrom >= 0 ? 'Escolha o segundo item.' : 'Espaço vazio.';
      }
      if (combineFrom >= 0) {
        name.textContent = `Combinar ${ITEMS[st.inv[combineFrom].id].name} com...`;
      }
      renderActions();
    };
    const say = (t) => {
      msg.textContent = t;
      msg.classList.remove('flash');
      void msg.offsetWidth;
      msg.classList.add('flash');
    };
    const actionsFor = (s) => {
      const d = ITEMS[s.id];
      const L = [];
      if (d.type === 'weapon') L.push(g.state.equipped === s.id ? ['unequip', 'Desequipar'] : ['equip', 'Equipar']);
      if (d.type === 'heal') L.push(['use', 'Usar']);
      if (d.type === 'ammo' && d.ammoFor && g.inv.has(d.ammoFor)) L.push(['reload', 'Recarregar arma']);
      const canComb = RECIPES.some((r) => r.a === s.id || r.b === s.id) || ((d.stack || 1) > 1 && d.type !== 'ammo');
      if (canComb) L.push(['combine', 'Combinar']);
      L.push(['examine', 'Examinar']);
      if (d.type !== 'key') L.push(['drop', 'Descartar']);
      return L;
    };
    const renderActions = () => {
      actions.innerHTML = '';
      actList.forEach(([k, label], i) => {
        const b = el('button', i === actIdx ? 'sel' : '', label);
        b.onclick = (e) => {
          e.stopPropagation();
          act(k);
        };
        actions.appendChild(b);
      });
    };
    const openActions = () => {
      const s = g.state.inv[sel];
      if (!s) return;
      actList = actionsFor(s);
      actIdx = 0;
      this.sfx('uiOk');
      renderActions();
    };
    const closeActions = () => {
      actList = [];
      actIdx = -1;
      renderActions();
    };
    const doCombine = () => {
      const from = combineFrom;
      combineFrom = -1;
      if (from === sel) {
        const r = g.inv.combineSelf(sel);
        if (r) {
          say(r.msg);
          this.sfx('pickup');
        } else say('Não dá para combinar isso consigo mesmo.');
        render();
        return;
      }
      const a = g.state.inv[from];
      const b = g.state.inv[sel];
      // munição + arma = recarregar
      if (a && b) {
        const da = ITEMS[a.id];
        const db = ITEMS[b.id];
        if ((da.type === 'ammo' && db.weapon && da.ammoFor === b.id) || (db.type === 'ammo' && da.weapon && db.ammoFor === a.id)) {
          const wid = da.weapon ? a.id : b.id;
          say(g.reloadFromInventory(wid));
          render();
          return;
        }
      }
      const r = g.inv.combine(from, sel);
      say(r.msg);
      this.sfx(r.ok ? 'pickup' : 'uiError');
      render();
    };
    const act = (k) => {
      const s = g.state.inv[sel];
      if (!s) return;
      closeActions();
      const d = ITEMS[s.id];
      if (k === 'equip') {
        g.player.equip(s.id);
        say(`${d.name} equipada.`);
      } else if (k === 'unequip') {
        g.state.equipped = null;
        say('Arma guardada.');
      } else if (k === 'use') {
        say(g.useHeal(sel));
      } else if (k === 'reload') {
        say(g.reloadFromInventory(d.ammoFor));
      } else if (k === 'combine') {
        if ((d.stack || 1) > 1 && s.qty >= 2 && RECIPES.some((r) => r.a === s.id && r.b === s.id)) {
          combineFrom = sel;
          say('Escolha o outro item (ou o mesmo, para usar duas unidades).');
        } else {
          combineFrom = sel;
          say('Escolha o item para combinar.');
        }
      } else if (k === 'examine') {
        this.examine([d.desc]);
      } else if (k === 'drop') {
        this.confirm(`Descartar ${d.name}? O item será perdido.`, () => {
          g.inv.removeAt(sel, s.qty);
          g.player.validateEquip();
          render();
        });
      }
      render();
    };
    render();
    return {
      onKey: (e) => {
        const n = g.state.invSize;
        if (actList.length) {
          if (['ArrowDown', 'KeyS'].includes(e.code)) actIdx = (actIdx + 1) % actList.length;
          else if (['ArrowUp', 'KeyW'].includes(e.code)) actIdx = (actIdx - 1 + actList.length) % actList.length;
          else if (['Enter', 'KeyE', 'Space'].includes(e.code)) act(actList[actIdx][0]);
          else if (['Escape', 'Backspace'].includes(e.code)) closeActions();
          else return false;
          this.sfx('uiMove');
          renderActions();
          return true;
        }
        let ns = sel;
        if (['ArrowRight', 'KeyD'].includes(e.code)) ns = (sel + 1) % n;
        else if (['ArrowLeft', 'KeyA'].includes(e.code)) ns = (sel - 1 + n) % n;
        else if (['ArrowDown', 'KeyS'].includes(e.code)) ns = (sel + 4) % n;
        else if (['ArrowUp', 'KeyW'].includes(e.code)) ns = (sel - 4 + n) % n;
        else if (['Enter', 'KeyE', 'Space'].includes(e.code)) {
          if (combineFrom >= 0) doCombine();
          else openActions();
          return true;
        } else if (e.code === 'Escape' && combineFrom >= 0) {
          combineFrom = -1;
          render();
          return true;
        } else return false;
        sel = ns;
        this.sfx('uiMove');
        render();
        return true;
      },
    };
  }

  filesTab(body, m) {
    const g = this.g;
    const docs = g.state.docs;
    body.innerHTML = `<div class="files">${
      docs.length
        ? docs.map((id, i) => `<button data-i="${i}"><span class="fk">${KIND_LABEL[DOCS[id].kind]}</span>${esc(DOCS[id].title)}</button>`).join('')
        : '<p class="muted">Nenhum documento encontrado ainda.</p>'
    }</div><div class="files-count muted">${docs.length} de ${Object.keys(DOCS).length} arquivos</div>`;
    let sel = 0;
    const btns = [...body.querySelectorAll('[data-i]')];
    const focus = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
    btns.forEach((b) => (b.onclick = () => this.openDoc(docs[+b.dataset.i])));
    focus();
    return {
      onKey: (e) => {
        if (!btns.length) return false;
        if (['ArrowDown', 'KeyS'].includes(e.code)) sel = (sel + 1) % btns.length;
        else if (['ArrowUp', 'KeyW'].includes(e.code)) sel = (sel - 1 + btns.length) % btns.length;
        else if (['Enter', 'KeyE', 'Space'].includes(e.code)) {
          btns[sel].click();
          return true;
        } else return false;
        this.sfx('uiMove');
        focus();
        return true;
      },
    };
  }

  mapTab(body) {
    const g = this.g;
    const w = g.world;
    body.innerHTML = `<div class="map-wrap"><div class="map-head"><b>${esc(AREA_NAMES[w.id] || '')}</b><span class="muted"> · ${esc(w.zoneNow?.name || '')}</span></div><canvas class="map-cv" width="760" height="480"></canvas>
      <div class="map-side"><div class="region"></div>
      <div class="legend"><span><i class="lg-you"></i>Você</span><span><i class="lg-safe"></i>Área segura</span><span><i class="lg-lock"></i>Trancada</span><span><i class="lg-open"></i>Destrancada</span><span><i class="lg-exit"></i>Passagem</span></div></div></div>`;
    const cv = body.querySelector('.map-cv');
    const ctx = cv.getContext('2d');
    // limites a partir das salas / formas
    const shapes = [...(w.map.mapDraw || [])];
    const rooms = w.rooms.filter((r) => r.map !== false);
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const r of [...rooms, ...shapes.map((s) => ({ minX: s.x0, maxX: s.x1, minZ: s.z0, maxZ: s.z1 }))]) {
      minX = Math.min(minX, r.minX);
      maxX = Math.max(maxX, r.maxX);
      minZ = Math.min(minZ, r.minZ);
      maxZ = Math.max(maxZ, r.maxZ);
    }
    if (!isFinite(minX)) {
      ({ minX, minZ, maxX, maxZ } = w.map.bounds);
    }
    const pad = 30;
    const sc = Math.min((cv.width - pad * 2) / (maxX - minX), (cv.height - pad * 2) / (maxZ - minZ));
    const ox = (cv.width - (maxX - minX) * sc) / 2;
    const oz = (cv.height - (maxZ - minZ) * sc) / 2;
    const X = (x) => ox + (x - minX) * sc;
    const Z = (z) => oz + (z - minZ) * sc;
    ctx.fillStyle = '#0b0d0c';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = 'rgba(120,140,120,0.06)';
    for (let x = 0; x < cv.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cv.height);
      ctx.stroke();
    }
    for (let y = 0; y < cv.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cv.width, y);
      ctx.stroke();
    }
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (const s of shapes) {
      ctx.fillStyle = s.kind === 'road' ? 'rgba(90,100,95,0.35)' : s.kind === 'building' ? 'rgba(40,46,44,0.9)' : s.kind === 'trees' ? 'rgba(30,50,30,0.6)' : 'rgba(70,80,70,0.3)';
      ctx.fillRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * sc, (s.z1 - s.z0) * sc);
      if (s.kind === 'building') {
        ctx.strokeStyle = 'rgba(150,160,150,0.35)';
        ctx.strokeRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * sc, (s.z1 - s.z0) * sc);
      }
      if (s.label) {
        ctx.fillStyle = 'rgba(200,210,195,0.6)';
        ctx.fillText(s.label, X((s.x0 + s.x1) / 2), Z((s.z0 + s.z1) / 2) + 4);
      }
    }
    for (const r of rooms) {
      const visited = g.state.visited[`${w.id}:${r.id}`];
      ctx.fillStyle = r.safe ? (visited ? 'rgba(60,120,70,0.55)' : 'rgba(40,70,45,0.35)') : visited ? 'rgba(110,120,105,0.45)' : 'rgba(60,66,60,0.25)';
      ctx.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * sc, (r.maxZ - r.minZ) * sc);
      ctx.strokeStyle = visited ? 'rgba(200,210,190,0.8)' : 'rgba(120,130,120,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * sc, (r.maxZ - r.minZ) * sc);
      if (r.name && visited && (r.maxX - r.minX) * sc > 50) {
        ctx.fillStyle = 'rgba(220,225,210,0.85)';
        const label = r.name.includes('—') ? r.name.split('—')[1].trim() : r.name;
        ctx.fillText(label, X((r.minX + r.maxX) / 2), Z((r.minZ + r.maxZ) / 2) + 4);
      }
    }
    for (const d of w.doors) {
      const x = X(d.def.x);
      const z = Z(d.def.z);
      ctx.fillStyle = d.def.to ? '#d8b23a' : d.locked ? '#c8402c' : '#4a8ad8';
      ctx.beginPath();
      ctx.arc(x, z, d.def.to ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = g.player;
    ctx.save();
    ctx.translate(X(p.pos.x), Z(p.pos.z));
    ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#ff5a3a';
    ctx.shadowColor = '#ff5a3a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // mapa da região
    const order = ['town', 'police', 'hospital', 'hospital_sub', 'forest', 'tunnels', 'lab'];
    const seen = new Set(Object.keys(g.state.visited).map((k) => k.split(':')[0]));
    seen.add(w.id);
    for (const id of g.state.areas || []) seen.add(id);
    body.querySelector('.region').innerHTML = `<div class="rg-title">REGIÃO</div>` + order.map((id) => `<div class="rg ${id === w.id ? 'cur' : ''} ${seen.has(id) ? '' : 'unk'}">${seen.has(id) ? esc(AREA_NAMES[id]) : '???'}</div>`).join('<div class="rg-arrow">│</div>');
    return null;
  }

  // ------------------------------------------------------------ baú
  storage() {
    const g = this.g;
    const m = this.modal(
      'inventory storage',
      `<div class="inv-panel">
        <div class="inv-tabs"><button class="on">BAÚ</button><span class="inv-close">Clique para transferir · Tab / Esc — fechar</span></div>
        <div class="st-body"><div><h3>Bolsa</h3><div class="inv-grid bag"></div></div><div><h3>Armário (compartilhado entre pontos seguros)</h3><div class="box-list"></div></div></div>
        <div class="it-msg"></div>
      </div>`,
    );
    let pane = 0;
    let sel = 0;
    const bag = m.q('.bag');
    const box = m.q('.box-list');
    const msg = m.q('.it-msg');
    const render = () => {
      const st = g.state;
      bag.innerHTML = '';
      for (let i = 0; i < st.invSize; i++) {
        const s = st.inv[i];
        const c = el('div', 'slot' + (pane === 0 && sel === i ? ' sel' : ''));
        if (s) c.innerHTML = `<img src="${iconURL(s.id)}"><span class="nm">${esc(ITEMS[s.id].name)}</span>${s.qty > 1 || ITEMS[s.id].type === 'ammo' ? `<span class="qty">${s.qty}</span>` : ''}`;
        c.onclick = () => {
          pane = 0;
          sel = i;
          transfer();
        };
        bag.appendChild(c);
      }
      box.innerHTML = st.storage.length ? '' : '<p class="muted">Vazio.</p>';
      st.storage.forEach((e, k) => {
        const b = el('button', 'box-item' + (pane === 1 && sel === k ? ' sel' : ''), `<img src="${iconURL(e.id)}"><span>${esc(ITEMS[e.id].name)}</span><b>${e.qty > 1 || ITEMS[e.id].type === 'ammo' ? '×' + e.qty : ''}</b>`);
        b.onclick = () => {
          pane = 1;
          sel = k;
          transfer();
        };
        box.appendChild(b);
      });
    };
    const transfer = () => {
      if (pane === 0) {
        const s = g.state.inv[sel];
        if (!s) return;
        g.inv.storeFrom(sel);
        g.player.validateEquip();
        this.sfx('uiOk');
        msg.textContent = `${ITEMS[s.id].name} guardado.`;
      } else {
        const e = g.state.storage[sel];
        if (!e) return;
        const name = ITEMS[e.id].name;
        const n = g.inv.takeFromStorage(sel);
        if (n > 0) {
          this.sfx('uiOk');
          msg.textContent = `${name} ×${n} na bolsa.`;
          if (ITEMS[e.id].type === 'weapon' && !g.state.equipped) g.player.equip(e.id);
        } else {
          this.sfx('uiError');
          msg.textContent = 'A bolsa está cheia.';
        }
        sel = Math.min(sel, Math.max(0, g.state.storage.length - 1));
      }
      render();
    };
    m.onKey = (e) => {
      const st = g.state;
      if (['Escape', 'Tab', 'KeyI'].includes(e.code)) return this.close(m);
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        if (pane === 1) {
          pane = 0;
          sel = 0;
        } else sel = Math.max(0, sel - 1);
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        if (pane === 0 && (sel % 4 === 3 || sel === st.invSize - 1)) {
          pane = 1;
          sel = 0;
        } else if (pane === 0) sel = Math.min(st.invSize - 1, sel + 1);
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) sel = pane === 0 ? Math.min(st.invSize - 1, sel + 4) : Math.min(st.storage.length - 1, sel + 1);
      else if (['ArrowUp', 'KeyW'].includes(e.code)) sel = pane === 0 ? Math.max(0, sel - 4) : Math.max(0, sel - 1);
      else if (['Enter', 'KeyE', 'Space'].includes(e.code)) transfer();
      else return;
      this.sfx('uiMove');
      render();
    };
    m.onClose = () => g.hud.updateWeapon();
    render();
    this.push(m);
  }

  // ------------------------------------------------------------ enigmas
  openKeypad(opts) {
    const m = this.modal(
      'puzzle keypad',
      `<div class="panel small pz">
        <h3>${esc(opts.title || 'Painel numérico')}</h3>
        <div class="kp-display"></div>
        <div class="kp-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
        <div class="pz-foot">Teclas numéricas · Enter confirma · Esc sai</div>
      </div>`,
    );
    let val = '';
    const disp = m.q('.kp-display');
    const show = (state = '') => {
      disp.className = 'kp-display ' + state;
      disp.textContent = val.padEnd(opts.length, '·').split('').join(' ');
    };
    const press = (k) => {
      if (k === 'C') val = '';
      else if (k === 'OK') {
        if (val.length < opts.length) return;
        if (opts.check(val)) {
          show('ok');
          this.sfx('uiOk');
          setTimeout(() => {
            this.close(m);
            opts.onSolve();
          }, 450);
          return;
        }
        show('bad');
        this.sfx('uiError');
        setTimeout(() => {
          val = '';
          show();
        }, 600);
        return;
      } else if (val.length < opts.length) val += k;
      this.sfx('uiMove');
      show();
    };
    m.qa('[data-k]').forEach((b) => (b.onclick = () => press(b.dataset.k === 'C' || b.dataset.k === 'OK' ? b.dataset.k : String(b.dataset.k))));
    m.onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') this.close(m);
      else if (/^(Digit|Numpad)\d$/.test(e.code)) press(e.code.slice(-1));
      else if (e.code === 'Backspace') {
        val = val.slice(0, -1);
        show();
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK');
    };
    show();
    this.push(m);
  }

  openBreakers(opts) {
    const m = this.modal(
      'puzzle breakers',
      `<div class="panel pz">
        <h3>Painel de distribuição — gerador auxiliar</h3>
        <p class="muted small">Capacidade máxima: <b>${opts.max}</b> unidades de carga.</p>
        <div class="br-list"></div>
        <div class="br-meter"><div class="br-fill"></div><span class="br-val"></span></div>
        <div class="row"><button data-go class="primary">Acionar gerador</button><button data-x>Sair</button></div>
        <div class="it-msg"></div>
      </div>`,
    );
    const sel = new Set(opts.initial || []);
    const list = m.q('.br-list');
    const msg = m.q('.it-msg');
    const render = () => {
      list.innerHTML = '';
      for (const c of opts.circuits) {
        const b = el('button', 'br' + (sel.has(c.id) ? ' on' : ''), `<span class="lever"></span><span class="bn">${esc(c.name)}</span><span class="bl">${c.load}</span>`);
        b.onclick = () => {
          if (sel.has(c.id)) sel.delete(c.id);
          else sel.add(c.id);
          this.sfx('breaker');
          render();
        };
        list.appendChild(b);
      }
      const total = [...sel].reduce((a, id) => a + opts.circuits.find((c) => c.id === id).load, 0);
      const fill = m.q('.br-fill');
      fill.style.width = `${Math.min(1, total / opts.max) * 100}%`;
      fill.classList.toggle('over', total > opts.max);
      m.q('.br-val').textContent = `${total} / ${opts.max}`;
    };
    m.q('[data-go]').onclick = () => {
      const total = [...sel].reduce((a, id) => a + opts.circuits.find((c) => c.id === id).load, 0);
      if (total > opts.max) {
        this.sfx('spark');
        this.g.audio.play('uiError');
        msg.textContent = 'SOBRECARGA! O gerador desarmou. Reduza a carga.';
        this.g.cam.shake(0.03, 0.3);
        return;
      }
      const missing = (opts.require || []).filter((id) => !sel.has(id));
      if (missing.length) {
        msg.textContent = opts.requireMsg || 'Os circuitos essenciais continuam sem energia.';
        this.sfx('uiError');
        return;
      }
      this.close(m);
      opts.onSolve([...sel]);
    };
    m.q('[data-x]').onclick = () => this.close(m);
    m.onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') this.close(m);
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= opts.circuits.length) list.children[n - 1].click();
      if (e.code === 'Enter') m.q('[data-go]').click();
    };
    render();
    this.push(m);
  }

  openDials(opts) {
    const syms = opts.symbols;
    const cur = (opts.initial || [0, 0, 0, 0]).slice();
    let focus = 0;
    const m = this.modal(
      'puzzle dials',
      `<div class="panel pz">
        <h3>${esc(opts.title || 'Discos de ferro')}</h3>
        <p class="muted small">${esc(opts.subtitle || '')}</p>
        <div class="dl-row"></div>
        <div class="row"><button data-go class="primary">Puxar a alavanca</button><button data-x>Sair</button></div>
        <div class="pz-foot">← → escolhe o disco · ↑ ↓ gira · Enter confirma</div>
        <div class="it-msg"></div>
      </div>`,
    );
    const row = m.q('.dl-row');
    const msg = m.q('.it-msg');
    const render = () => {
      row.innerHTML = '';
      cur.forEach((v, i) => {
        const d = el('div', 'dial' + (i === focus ? ' sel' : ''), `<button class="up">▲</button><div class="sym">${SYMBOLS[syms[v]]}</div><div class="sname">${SYMBOL_NAMES[syms[v]]}</div><button class="dn">▼</button>`);
        d.querySelector('.up').onclick = () => rot(i, -1);
        d.querySelector('.dn').onclick = () => rot(i, 1);
        d.onclick = () => {
          focus = i;
          render();
        };
        row.appendChild(d);
      });
    };
    const rot = (i, k) => {
      cur[i] = (cur[i] + k + syms.length) % syms.length;
      focus = i;
      this.g.audio.play('breaker', null, 0.6);
      render();
    };
    m.q('[data-go]').onclick = () => {
      const ok = cur.every((v, i) => syms[v] === opts.solution[i]);
      if (ok) {
        this.close(m);
        opts.onSolve();
      } else {
        this.g.audio.play('doorLocked');
        msg.textContent = 'A alavanca trava. Nada acontece.';
        if (opts.onFail) opts.onFail();
      }
    };
    m.q('[data-x]').onclick = () => this.close(m);
    m.onClose = () => opts.onChange && opts.onChange(cur);
    m.onKey = (e) => {
      if (['Escape', 'Tab'].includes(e.code)) this.close(m);
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        focus = (focus + 3) % 4;
        render();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        focus = (focus + 1) % 4;
        render();
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) rot(focus, -1);
      else if (['ArrowDown', 'KeyS'].includes(e.code)) rot(focus, 1);
      else if (e.code === 'Enter') m.q('[data-go]').click();
    };
    render();
    this.push(m);
  }

  openSamples(opts) {
    const order = [];
    const m = this.modal(
      'puzzle samples',
      `<div class="panel pz">
        <h3>Leitor de amostras — Laboratório Central</h3>
        <p class="muted small">Insira as amostras-padrão nos encaixes, da esquerda para a direita.</p>
        <div class="sm-slots"><div class="sm"></div><div class="sm"></div><div class="sm"></div></div>
        <div class="sm-avail"></div>
        <div class="row"><button data-go class="primary">Confirmar</button><button data-c>Limpar</button><button data-x>Sair</button></div>
        <div class="it-msg"></div>
      </div>`,
    );
    const names = { sample_blue: 'Azul (CR-I)', sample_amber: 'Âmbar (CR-II)', sample_red: 'Vermelha (CR-III)' };
    const render = () => {
      m.qa('.sm').forEach((s, i) => (s.innerHTML = order[i] ? `<img src="${iconURL(order[i])}"><span>${names[order[i]]}</span>` : ''));
      const av = m.q('.sm-avail');
      av.innerHTML = '';
      for (const id of opts.samples) {
        if (order.includes(id)) continue;
        const b = el('button', '', `<img src="${iconURL(id)}"><span>${names[id]}</span>`);
        b.onclick = () => {
          if (order.length < 3) order.push(id);
          this.sfx('uiMove');
          render();
        };
        av.appendChild(b);
      }
    };
    m.q('[data-c]').onclick = () => {
      order.length = 0;
      render();
    };
    m.q('[data-x]').onclick = () => this.close(m);
    m.q('[data-go]').onclick = () => {
      if (order.length < 3) return;
      if (order.join() === opts.solution.join()) {
        this.close(m);
        opts.onSolve();
      } else {
        this.g.audio.play('alarm');
        m.q('.it-msg').textContent = 'SEQUÊNCIA INVÁLIDA. As amostras foram ejetadas.';
        order.length = 0;
        render();
        if (opts.onFail) opts.onFail();
      }
    };
    m.onKey = (e) => {
      if (['Escape', 'Tab'].includes(e.code)) this.close(m);
      if (e.code === 'Enter') m.q('[data-go]').click();
    };
    render();
    this.push(m);
  }
}

export { BINDINGS };
