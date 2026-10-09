import { TEAMS, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, HAIR_STYLE_LABELS, BEARDS, BEARD_LABELS, EYE_COLORS, ARCHETYPES } from '../data/Teams.js';
import { profileAttrs } from '../data/PlayerProfile.js';
import { STAGES, MODIFIERS, CAMPAIGN_TITLE, CAMPAIGN_INTRO, rewardText } from '../campaign/CampaignData.js';
import { isUnlocked, resetCampaign } from '../campaign/CampaignProgress.js';

const $ = (s) => document.querySelector(s);
const ATTR_LABELS = {
  speed: 'Velocidade',
  shooting: 'Arremesso',
  three: '3 pontos',
  finishing: 'Finalização',
  passing: 'Passe',
  defense: 'Defesa',
  rebound: 'Rebote',
  stamina: 'Resistência',
};
const SHOE_COLORS = ['#ffffff', '#111111', '#e53935', '#1e88e5', '#fdd835', '#43a047', '#ff7a00', '#8e24aa'];

/**
 * Menus (DOM): principal, jogar, configuração da partida, personalização,
 * configurações, controles, pausa, fim de jogo e saída.
 */
export class Menus {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.stack = [];
    this.setup = {
      home: TEAMS[0].id,
      away: TEAMS[1].id,
      difficulty: game.settings.get('difficulty'),
      teamSize: game.settings.get('teamSize'),
      quarterLength: game.settings.get('quarterLength'),
      court: 'arena',
    };
    this.bind();
  }

  click() {
    this.game.audio.init();
    this.game.audio.play('click', { volume: 0.5 });
  }

  show(id, push = true) {
    if (this.current && push) this.stack.push(this.current);
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    if (id) {
      $(`#${id}`).classList.add('active');
      const first = $(`#${id} button.primary`) || $(`#${id} button`);
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    }
    this.current = id;
    if (id === 'settingsMenu') this.syncSettings();
  }

  back() {
    const prev = this.stack.pop();
    this.show(prev || 'mainMenu', false);
  }

  hideAll() {
    this.stack = [];
    this.show(null, false);
  }

  bind() {
    const on = (screen, action, fn) => {
      document.querySelectorAll(`#${screen} [data-action="${action}"]`).forEach((b) =>
        b.addEventListener('click', () => {
          this.click();
          fn();
        }),
      );
    };
    // principal
    on('mainMenu', 'play', () => this.show('playMenu'));
    on('mainMenu', 'training', () => this.game.startMode('training', {}));
    on('mainMenu', 'campaign', () => this.openCampaign());
    on('playMenu', 'campaign', () => this.openCampaign());
    on('campaignMenu', 'back', () => this.back());
    on('campaignMenu', 'playStage', () => this.playStage(this.campSel));
    on('campaignMenu', 'reset', () => {
      // confirmação em dois cliques
      const b = $('#campReset');
      if (!b.classList.contains('confirm')) {
        b.classList.add('confirm');
        b.textContent = 'Clique de novo para apagar o progresso';
        return;
      }
      this.game.campaign = resetCampaign();
      this.campSel = 0;
      this.renderCampaign();
    });
    on('mainMenu', 'customize', () => this.openCustomize());
    on('mainMenu', 'settings', () => this.show('settingsMenu'));
    on('mainMenu', 'controls', () => this.show('controlsMenu'));
    on('mainMenu', 'exit', () => {
      this.show('exitMenu');
      this.game.music.stop();
      try {
        window.close();
      } catch (e) {
        /* navegadores bloqueiam o fechamento */
      }
    });
    on('exitMenu', 'back', () => {
      this.game.music.play('menu');
      this.stack = [];
      this.show('mainMenu', false);
    });
    // jogar
    on('playMenu', 'quick', () => {
      const ids = TEAMS.map((t) => t.id);
      const home = ids[Math.floor(Math.random() * ids.length)];
      let away = home;
      while (away === home) away = ids[Math.floor(Math.random() * ids.length)];
      this.game.startMode('quick', {
        home,
        away,
        difficulty: this.game.settings.get('difficulty'),
        teamSize: 3,
        quarterLength: this.game.settings.get('quarterLength'),
      });
    });
    on('playMenu', 'versus', () => this.openSetup());
    on('playMenu', 'back', () => this.back());
    // configuração
    on('setupMenu', 'back', () => this.back());
    on('setupMenu', 'start', () => {
      this.game.settings.set('difficulty', this.setup.difficulty);
      this.game.settings.set('teamSize', this.setup.teamSize);
      this.game.settings.set('quarterLength', this.setup.quarterLength);
      this.game.startMode('versus', { ...this.setup });
    });
    this.bindSeg('#setupDifficulty', (v) => (this.setup.difficulty = v));
    this.bindSeg('#setupSize', (v) => (this.setup.teamSize = +v));
    this.bindSeg('#setupLength', (v) => (this.setup.quarterLength = +v));
    // configurações / controles
    on('settingsMenu', 'back', () => this.back());
    on('controlsMenu', 'back', () => this.back());
    this.bindSettings();
    // pausa
    on('pauseMenu', 'resume', () => this.game.resume());
    on('pauseMenu', 'restart', () => this.game.restart());
    on('pauseMenu', 'settings', () => this.show('settingsMenu'));
    on('pauseMenu', 'controls', () => this.show('controlsMenu'));
    on('pauseMenu', 'quit', () => this.game.quitToMenu());
    // fim de jogo
    on('gameOverMenu', 'menu', () => this.game.quitToMenu());
    on('gameOverMenu', 'again', () => this.game.restart());
    on('gameOverMenu', 'map', () => this.game.quitToMenu('campaignMenu'));
    on('gameOverMenu', 'next', () => {
      const i = this.game.mode && this.game.mode.stageIndex;
      if (i != null && STAGES[i + 1]) this.playStage(i + 1);
    });
    // personalização
    on('customizeMenu', 'cancel', () => this.game.exitCustomize(false));
    on('customizeMenu', 'save', () => this.game.exitCustomize(true));
    this.bindCustomize();

    document.addEventListener('pointerdown', () => this.game.audio.init(), { once: false });
  }

  bindSeg(sel, fn) {
    const root = $(sel);
    root.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        this.click();
        root.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        fn(b.dataset.v);
      }),
    );
  }

  setSeg(sel, value) {
    $(sel)
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('on', b.dataset.v === String(value)));
  }

  // -------------------------------------------------------------------
  openSetup() {
    const s = this.setup;
    s.difficulty = this.game.settings.get('difficulty');
    const render = () => {
      for (const [id, key, other] of [
        ['#homeTeams', 'home', 'away'],
        ['#awayTeams', 'away', 'home'],
      ]) {
        const root = $(id);
        root.innerHTML = '';
        for (const t of TEAMS) {
          const b = document.createElement('button');
          b.className = 'team-card' + (s[key] === t.id ? ' on' : '') + (s[other] === t.id ? ' disabled' : '');
          b.style.setProperty('--c1', t.primary);
          b.innerHTML = `<div class="ta">${t.abbr}</div><div class="tn">${t.name}</div><div class="tr">Geral ${t.rating}</div>`;
          b.addEventListener('click', () => {
            this.click();
            s[key] = t.id;
            render();
          });
          root.appendChild(b);
        }
      }
    };
    render();
    this.setSeg('#setupDifficulty', s.difficulty);
    this.setSeg('#setupSize', s.teamSize);
    this.setSeg('#setupLength', s.quarterLength);
    this.renderCourts();
    this.show('setupMenu');
  }

  // Quadras do jogo contra IA: as da arena e as dominadas na campanha
  renderCourts() {
    const st = this.game.campaign;
    const courts = [
      ['arena', 'Arena Central'],
      ['classic', 'Ginásio Clássico'],
      ...STAGES.filter((s) => st.rewarded[s.id]).map((s) => [s.court, s.title]),
    ];
    if (!courts.some(([id]) => id === this.setup.court)) this.setup.court = 'arena';
    const root = $('#setupCourt');
    root.innerHTML = '';
    for (const [id, label] of courts) {
      const b = document.createElement('button');
      b.dataset.v = id;
      b.textContent = label;
      b.classList.toggle('on', id === this.setup.court);
      b.addEventListener('click', () => {
        this.click();
        this.setup.court = id;
        this.renderCourts();
      });
      root.appendChild(b);
    }
    const locked = STAGES.length - courts.length + 2;
    $('#setupCourtNote').textContent = locked > 0 ? `Domine quadras na campanha para jogar nelas aqui (${locked} bloqueadas).` : '';
  }

  // -------------------------------------------------------------------
  // Campanha: mapa das fases e detalhes da fase escolhida
  openCampaign() {
    const st = this.game.campaign;
    // por padrão, seleciona a fase mais avançada liberada
    this.campSel = Math.min(st.unlocked, STAGES.length) - 1;
    const b = $('#campReset');
    b.classList.remove('confirm');
    b.textContent = 'Reiniciar campanha';
    this.renderCampaign();
    this.show('campaignMenu');
  }

  stars(n) {
    return `<span class="stars" aria-label="${n} de 3 estrelas">${[0, 1, 2].map((i) => (i < n ? '★' : '<span class="off">★</span>')).join('')}</span>`;
  }

  danger(tier) {
    const n = 1 + Math.round(tier * 4);
    return `<span class="danger" aria-label="dificuldade ${n} de 5">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  renderCampaign() {
    const st = this.game.campaign;
    $('#campTitle').textContent = CAMPAIGN_TITLE;
    $('#campIntro').textContent = CAMPAIGN_INTRO;
    const won = STAGES.filter((s) => st.rewarded[s.id]).length;
    const totalStars = STAGES.reduce((a, s) => a + (st.stars[s.id] || 0), 0);
    $('#campProgress').innerHTML = `<b>${won}/${STAGES.length}</b> quadras dominadas<br><b>${totalStars}/${STAGES.length * 3}</b> estrelas`;
    const list = $('#campStages');
    list.innerHTML = '';
    STAGES.forEach((s, i) => {
      const open = isUnlocked(st, i);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = `camp-stage${i === this.campSel ? ' on' : ''}${open ? '' : ' locked'}`;
      b.style.setProperty('--c', s.team.primary);
      b.innerHTML = `<span class="n">FASE ${i + 1}${st.rewarded[s.id] ? ' • DOMINADA' : ''}</span><span class="t">${s.title}</span><span class="g">${s.team.name}</span>
        <span class="row">${open ? this.stars(st.stars[s.id] || 0) : '<span class="lock-tag">BLOQUEADA</span>'}${this.danger(s.tier)}</span>`;
      b.addEventListener('click', () => {
        this.click();
        this.campSel = i;
        this.renderCampaign();
      });
      b.addEventListener('dblclick', () => open && this.playStage(i));
      li.appendChild(b);
      list.appendChild(li);
    });
    const s = STAGES[this.campSel];
    const open = isUnlocked(st, this.campSel);
    const fmt = (v) => String(v).replace('.', ',');
    const mods = s.modifiers.length
      ? s.modifiers.map((id) => `<span class="chip" title="${MODIFIERS[id].desc}">${MODIFIERS[id].label}: ${MODIFIERS[id].desc}</span>`).join('')
      : '<span class="chip calm">Sem regras especiais</span>';
    const periods = s.quarters === 2 ? `2 tempos de ${fmt(s.quarterLength)} min` : `4 quartos de ${fmt(s.quarterLength)} min`;
    $('#campDetail').innerHTML = `
      <div class="region">Fase ${this.campSel + 1} • ${s.region}</div>
      <h3>${s.title}</h3>
      <div class="vs" style="--c:${s.team.primary}">contra <b>${s.team.name}</b> (geral ${s.team.rating})</div>
      <p>${s.story}</p>
      <dl class="camp-facts">
        <dt>Formato</dt><dd>${s.teamSize}x${s.teamSize} • ${periods}</dd>
        <dt>Perigo</dt><dd>${this.danger(s.tier)}</dd>
        <dt>Quadra</dt><dd>${mods}</dd>
        <dt>Recompensa</dt><dd>${rewardText(s.reward)}${st.rewarded[s.id] ? ' (recebida)' : ''}</dd>
        <dt>Estrelas</dt><dd>${this.stars(st.stars[s.id] || 0)} vença por 5+ para 2, por 10+ para 3</dd>
      </dl>
      ${open ? '' : '<p><b>Bloqueada:</b> domine a quadra anterior para liberar.</p>'}`;
    const play = $('#campPlay');
    play.disabled = !open;
    play.textContent = st.rewarded[s.id] ? 'Jogar de novo' : 'Jogar fase';
  }

  playStage(i) {
    const s = STAGES[i];
    if (!s || !isUnlocked(this.game.campaign, i)) return;
    this.game.startMode('campaign', { stage: s.id, court: s.court });
  }

  // -------------------------------------------------------------------
  bindSettings() {
    const st = this.game.settings;
    document.querySelectorAll('#settingsMenu .seg[data-setting]').forEach((root) => {
      const key = root.dataset.setting;
      root.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          this.click();
          st.set(key, b.dataset.v);
          this.syncSettings();
        }),
      );
    });
    document.querySelectorAll('#settingsMenu input[data-setting]').forEach((inp) => {
      const key = inp.dataset.setting;
      inp.addEventListener('input', () => {
        st.set(key, inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value));
      });
    });
  }

  syncSettings() {
    const st = this.game.settings;
    document.querySelectorAll('#settingsMenu .seg[data-setting]').forEach((root) => {
      const v = st.get(root.dataset.setting);
      root.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
    });
    document.querySelectorAll('#settingsMenu input[data-setting]').forEach((inp) => {
      const v = st.get(inp.dataset.setting);
      if (inp.type === 'checkbox') inp.checked = !!v;
      else inp.value = v;
    });
  }

  // -------------------------------------------------------------------
  openCustomize() {
    this.draft = JSON.parse(JSON.stringify(this.game.profile));
    this.syncCustomize();
    this.game.enterCustomize(this.draft);
    this.show('customizeMenu');
  }

  swatches(sel, colors, key) {
    const root = $(sel);
    root.innerHTML = '';
    for (const c of colors) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c;
      b.dataset.v = c;
      b.addEventListener('click', () => {
        this.click();
        this.draft.appearance[key] = c;
        this.syncCustomize();
        this.game.updatePreview(this.draft);
      });
      root.appendChild(b);
    }
  }

  textSeg(sel, values, labels, key) {
    const root = $(sel);
    root.innerHTML = '';
    for (const v of values) {
      const b = document.createElement('button');
      b.dataset.v = v;
      b.textContent = labels[v];
      b.addEventListener('click', () => {
        this.click();
        this.draft.appearance[key] = v;
        this.syncCustomize();
        this.game.updatePreview(this.draft);
      });
      root.appendChild(b);
    }
  }

  bindCustomize() {
    this.swatches('#cSkin', SKIN_TONES, 'skin');
    this.swatches('#cHairColor', HAIR_COLORS, 'hairColor');
    this.swatches('#cEyes', EYE_COLORS, 'eyeColor');
    this.swatches('#cShoes', SHOE_COLORS, 'shoeColor');
    this.textSeg('#cHair', HAIR_STYLES, HAIR_STYLE_LABELS, 'hairStyle');
    this.textSeg('#cBeard', BEARDS, BEARD_LABELS, 'beard');
    this.bindSeg('#cArchetype', (v) => {
      this.draft.archetype = v;
      this.draft.appearance.height = ARCHETYPES[v].height;
      this.syncCustomize();
      this.game.updatePreview(this.draft);
    });
    const range = (sel, key, fmt) => {
      $(sel).addEventListener('input', (e) => {
        this.draft.appearance[key] = parseFloat(e.target.value);
        if (fmt) fmt();
        this.game.updatePreview(this.draft, true);
      });
    };
    range('#cHeight', 'height', () => ($('#cHeightVal').textContent = `${this.draft.appearance.height.toFixed(2)} m`));
    range('#cBuild', 'build');
    range('#cFace', 'faceWidth');
    $('#cHeadband').addEventListener('change', (e) => {
      this.draft.appearance.headband = e.target.checked;
      this.game.updatePreview(this.draft);
    });
    $('#cName').addEventListener('input', (e) => {
      this.draft.name = e.target.value.trim() || 'Você';
      this.game.updatePreview(this.draft, true);
    });
    $('#cNumber').addEventListener('change', (e) => {
      this.draft.number = Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0));
      this.game.updatePreview(this.draft);
    });
  }

  syncCustomize() {
    const d = this.draft;
    const a = d.appearance;
    $('#cName').value = d.name;
    $('#cNumber').value = d.number;
    $('#cHeight').value = a.height;
    $('#cHeightVal').textContent = `${a.height.toFixed(2)} m`;
    $('#cBuild').value = a.build;
    $('#cFace').value = a.faceWidth;
    $('#cHeadband').checked = !!a.headband;
    this.setSeg('#cArchetype', d.archetype);
    const mark = (sel, v) => document.querySelectorAll(`${sel} [data-v]`).forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
    mark('#cSkin', a.skin);
    mark('#cHairColor', a.hairColor);
    mark('#cEyes', a.eyeColor);
    mark('#cShoes', a.shoeColor);
    mark('#cHair', a.hairStyle);
    mark('#cBeard', a.beard);
    const attrs = profileAttrs(d);
    $('#cAttrs').innerHTML = Object.entries(attrs)
      .map(([k, v]) => `<div class="attr">${ATTR_LABELS[k]} <b>${v}</b><div class="bar"><div style="width:${v}%"></div></div></div>`)
      .join('');
  }

  // -------------------------------------------------------------------
  showGameOver(res, mode) {
    const w = mode.world;
    const human = 0;
    const won = res.winner === human;
    const title = $('#goTitle');
    title.textContent = won ? 'VITÓRIA!' : 'DERROTA';
    title.className = won ? 'win' : 'lose';
    const [a, b] = res.score;
    const t = mode.teams;
    $('#goScore').innerHTML = `<div class="t">${t[0].name}<b>${a}</b></div><span>x</span><div class="t">${t[1].name}<b>${b}</b></div>`;
    const table = (team) => {
      const rows = w.teams[team].players
        .map((p) => {
          const s = p.stats;
          return `<tr class="${p.isCustom ? 'me' : ''}"><td>#${p.number} ${p.name}</td><td>${s.pts}</td><td>${s.fgm}/${s.fga}</td><td>${s.tpm}/${s.tpa}</td><td>${s.ftm}/${s.fta}</td><td>${s.reb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.blk}</td><td>${s.fouls}</td></tr>`;
        })
        .join('');
      return `<table><caption>${t[team].name}</caption><tr><th>Jogador</th><th>PTS</th><th>AC</th><th>3P</th><th>LL</th><th>REB</th><th>AST</th><th>ROU</th><th>TOC</th><th>FAL</th></tr>${rows}</table>`;
    };
    $('#goBox').innerHTML = table(0) + table(1);
    // bloco da campanha: estrelas, recompensa e próxima fase
    const camp = mode.campaignResult;
    const cbox = $('#goCampaign');
    const btn = (a) => $(`#gameOverMenu [data-action="${a}"]`);
    cbox.classList.toggle('hidden', !camp);
    btn('map').classList.toggle('hidden', !camp);
    const hasNext = !!(camp && camp.won && STAGES[mode.stageIndex + 1]);
    btn('next').classList.toggle('hidden', !hasNext);
    btn('again').classList.toggle('hidden', hasNext);
    btn('again').textContent = camp ? (camp.won ? 'Jogar de novo' : 'Tentar de novo') : 'Jogar novamente';
    if (camp) {
      const st = mode.stage;
      let html = camp.won
        ? `<div class="big">${camp.finished ? 'A TERRA ARRASADA É SUA!' : 'QUADRA DOMINADA!'}</div>${this.stars(camp.stars)}`
        : `<div class="big">${st.team.name} ainda mandam aqui</div><div class="line">Vença para dominar a quadra e liberar a próxima fase.</div>`;
      if (camp.reward) html += `<div class="line">Recompensa: <b>${rewardText(camp.reward)}</b></div>`;
      if (camp.unlockedNext) html += `<div class="line">Nova quadra liberada: <b>${camp.unlockedNext.title}</b></div>`;
      if (camp.won && camp.stars < 3) html += `<div class="line">Vença por ${camp.stars < 2 ? '5' : '10'}+ pontos para mais estrelas.</div>`;
      cbox.innerHTML = html;
    }
    this.stack = [];
    this.show('gameOverMenu', false);
  }
}
