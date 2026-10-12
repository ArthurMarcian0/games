// Núcleo do jogo: estados, ciclo principal, transições entre áreas,
// salvamento, inventário, eventos de história e condições de vitória/derrota.
import * as THREE from 'three';
import { Settings } from './Settings.js';
import { Input } from './Input.js';
import { SaveManager } from './Save.js';
import { Renderer } from '../engine/Renderer.js';
import { textureNames, getTex } from '../engine/textures.js';
import { AudioSystem } from '../audio/Audio.js';
import { CameraController } from '../entities/Camera.js';
import { Player } from '../entities/Player.js';
import { World } from '../world/World.js';
import { HUD } from '../ui/HUD.js';
import { UI } from '../ui/UI.js';
import { Inventory } from '../game/Inventory.js';
import { ITEMS, WEAPONS } from '../game/Items.js';
import { DOCS, INTRO, ENDING, RADIO } from '../game/Story.js';
import { clamp } from './utils.js';

export const DIFFICULTY = {
  easy: { dmgTaken: 0.6, enemyHp: 0.75, ammo: 1.5, struggle: 5, grabChance: 0.25 },
  normal: { dmgTaken: 1, enemyHp: 1, ammo: 1, struggle: 8, grabChance: 0.4 },
  hard: { dmgTaken: 1.4, enemyHp: 1.25, ammo: 0.7, struggle: 11, grabChance: 0.55 },
};

const HINTS = {
  move: '<kbd>W A S D</kbd> mover · <kbd>Shift</kbd> correr · mouse para olhar',
  aim: 'Segure o <kbd>botão direito</kbd> para mirar e clique para atirar. A mira se estabiliza se você ficar parado.',
  inv: '<kbd>Tab</kbd> abre o inventário · <kbd>M</kbd> o mapa · <kbd>F</kbd> liga e desliga a lanterna',
  save: 'Áreas iluminadas são seguras: as criaturas não entram. Use o gravador para salvar e o armário para guardar itens.',
  radio: 'O rádio no seu peito chia quando há criaturas por perto.',
  struggle: 'Agarrado! Aperte <kbd>E</kbd> ou <kbd>Espaço</kbd> repetidamente para se soltar.',
  combine: 'Itens podem ser combinados no inventário (<kbd>Tab</kbd> → item → Combinar). Duas ervas viram uma mistura mais forte e ocupam um só espaço.',
  weapons: 'Troque de arma com <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> ou pelo inventário. A espingarda é devastadora de perto — e cada cartucho é precioso.',
  pipe: 'O cano de ferro não gasta munição: com ele equipado, clique para golpear. Ele quebra depois de alguns golpes.',
  docs: 'Documentos lidos ficam na aba ARQUIVOS do inventário. Muitas pistas estão escondidas neles.',
};

export class Game {
  constructor() {
    this.settings = new Settings();
    this.saves = new SaveManager();
    const app = document.getElementById('app');
    const uiRoot = document.getElementById('ui');
    this.renderer = new Renderer(app, this.settings);
    this.input = new Input(this.renderer.canvas);
    this.audio = new AudioSystem(this.settings);
    this.cam = new CameraController(this);
    this.renderer.onResize = (w, h) => this.cam.resize(w, h);
    this.cam.resize(window.innerWidth, window.innerHeight);
    this.fx = { damage: 0, flash: 0 };
    this.mode = 'boot';
    this.prevMode = null;
    this.state = null;
    this.inv = null;
    this.fear = 0;
    this.radioLevel = 0;
    this.timers = [];
    this.time = 0;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.hud = new HUD(this, uiRoot);
    this.ui = new UI(this, uiRoot);
    this.player = new Player(this);
    this.world = new World(this);
    this.diff = DIFFICULTY.normal;

    this.input.onKey = (e) => this.onKey(e);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    const unlockAudio = () => this.audio.init();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    this.renderer.canvas.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.input.locked) this.resumeLock();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing' && !this.ui.open) this.ui.pause();
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  get stats() {
    return this.state ? this.state.stats : { kills: 0, shots: 0 };
  }

  // ------------------------------------------------------------ inicialização
  async boot() {
    const names = textureNames();
    for (let i = 0; i < names.length; i++) {
      this.ui.loading('Gerando texturas…', i / names.length);
      await new Promise((r) => setTimeout(r, 0));
      getTex(names[i]);
    }
    this.ui.loading('Construindo Pedra Funda…', 1);
    await new Promise((r) => setTimeout(r, 30));
    this.toTitle(true);
    this.ui.loading(null);
  }

  toTitle(first = false) {
    this.ui.closeAll();
    this.resetTransient();
    this.mode = 'title';
    this.hud.show(false);
    this.ui.showClick(false);
    this.input.exitLock();
    // cenário de fundo: a rua na chuva
    this.state = this.freshState('normal');
    this.inv = new Inventory(this.state);
    this.player.reset();
    this.world.load('town', 'default');
    this.player.root.visible = false;
    this.player.flashlight.intensity = 0;
    this.titleT = 0;
    this.audio.setAmbient('menu');
    this.audio.setMusic('menu');
    this.ui.fade(0, first ? 2 : 0.8);
    this.ui.title();
  }

  // limpa tudo o que é temporário da sessão anterior (temporizadores, rádio, HUD)
  resetTransient() {
    this.timers = [];
    this.musicOverride = null;
    this.tense = false;
    this.cutsceneLock = false;
    this.ui.radioQueue.length = 0;
    this.ui.subs.classList.add('hidden');
    this.hud.setTimer(null);
    this.hud.setStruggle(0, false);
    this.cam.endCinematic();
    this.player.locked = false;
  }

  freshState(difficulty) {
    const inv = new Array(8).fill(null);
    inv[0] = { id: 'pistol', qty: 1 };
    inv[1] = { id: 'ammo_pistol', qty: 7 };
    inv[2] = { id: 'herb', qty: 1 };
    return {
      version: 1,
      difficulty,
      map: 'town',
      pos: null,
      hp: 100,
      inv,
      invSize: 8,
      storage: [],
      equipped: 'pistol',
      weapons: { pistol: { mag: 10 }, shotgun: { mag: 0 }, pipe: { dur: WEAPONS.pipe.durability } },
      flags: {},
      docs: [],
      visited: {},
      areas: ['town'],
      time: 0,
      stats: { kills: 0, shots: 0, saves: 0, deaths: 0 },
      hintsShown: {},
    };
  }

  async newGame(difficulty) {
    this.audio.init();
    this.ui.closeAll();
    this.mode = 'cutscene';
    this.audio.setMusic('none');
    await this.ui.fade(1, 0.8);
    this.resetTransient();
    this.state = this.freshState(difficulty);
    this.inv = new Inventory(this.state);
    this.diff = DIFFICULTY[difficulty];
    this.player.reset();
    this.player.root.visible = true;
    this.world.load('town', 'default');
    this.applyAreaAudio();
    this.audio.setAmbient('outdoor');
    // a tela da introdução já é preta: some com o fade e deixa o texto aparecer
    this.ui.fade(0, 0.05);
    await this.ui.introText(INTRO);
    this.hud.show(true);
    this.hud.updateWeapon();
    this.mode = 'playing';
    this.resumeLock();
    this.audio.play('thunder');
    this.hint('move');
    this.after(4, () => {
      this.radio(RADIO.intro);
      this.hint('radio');
    });
    this.after(14, () => this.hint('inv'));
  }

  continueGame() {
    const i = this.saves.newest();
    if (i < 0) return;
    this.loadGame(i);
  }

  async loadGame(slot) {
    const data = this.saves.read(slot);
    if (!data) return;
    this.audio.init();
    this.ui.closeAll();
    this.mode = 'cutscene';
    await this.ui.fade(1, 0.6);
    this.resetTransient();
    this.state = JSON.parse(JSON.stringify(data));
    this.state.hintsShown ||= {};
    this.inv = new Inventory(this.state);
    this.diff = DIFFICULTY[this.state.difficulty] || DIFFICULTY.normal;
    this.player.reset();
    this.player.root.visible = true;
    this.world.load(this.state.map, null);
    if (this.state.pos) {
      this.player.setPos(this.state.pos.x, this.state.pos.z, this.state.pos.ry);
      this.cam.setYaw(this.state.pos.ry);
    }
    this.player.hp = this.state.hp;
    this.applyAreaAudio();
    this.hud.show(true);
    this.hud.updateWeapon();
    this.mode = 'playing';
    this.resumeLock();
    await this.ui.fade(0, 1);
  }

  saveGame(slot) {
    const st = this.state;
    st.map = this.world.id;
    st.pos = { x: this.player.pos.x, z: this.player.pos.z, ry: this.player.yaw };
    st.hp = this.player.hp;
    st.stats.saves++;
    const ok = this.saves.write(slot, st);
    this.audio.play('saveChime');
    this.hud.message(ok ? 'Diário gravado.' : 'Não foi possível salvar (armazenamento indisponível).');
  }

  // ------------------------------------------------------------ áreas
  async transition(map, spawn, sound = 'doorOpen') {
    if (this.mode === 'transition') return;
    this.mode = 'transition';
    const snd = sound === 'stairs' ? null : sound;
    if (snd) this.audio.play(snd, null, 0.9);
    this.input.clearAll();
    await this.ui.fade(1, 0.45);
    if (sound === 'stairs') for (let i = 0; i < 6; i++) setTimeout(() => this.audio.footstep('concrete', null, false, 0.6), i * 180);
    const keepHp = this.player.hp;
    const keepSt = this.player.stamina;
    this.world.load(map, spawn);
    this.player.hp = keepHp;
    this.player.stamina = keepSt;
    this.player.grabbedBy = null;
    this.player.knockT = 0;
    if (!this.state.areas.includes(map)) this.state.areas.push(map);
    this.applyAreaAudio();
    // compila shaders da nova área antes de revelar
    this.renderer.renderer.compile(this.world.scene, this.cam.camera);
    await new Promise((r) => setTimeout(r, sound === 'stairs' ? 900 : 350));
    if (snd === 'doorOpen') this.audio.play('doorClose', null, 0.5);
    this.mode = 'playing';
    this.ui.fade(0, 0.6);
    this.showAreaName();
  }

  showAreaName() {
    const names = {
      town: 'Pedra Funda',
      police: 'Delegacia',
      hospital: 'Hospital São Lázaro',
      hospital_sub: 'Hospital — Subsolo',
      forest: 'Mata da Funda',
      tunnels: 'Galerias da Mina',
      lab: 'Estação Raiz',
    };
    const k = 'areaName_' + this.world.id;
    if (this.state.flags[k]) return;
    this.state.flags[k] = 1;
    this.hud.message(`<span class="area-name">${names[this.world.id]}</span>`, 4);
  }

  applyAreaAudio() {
    const map = this.world.map;
    this.audio.setAmbient(map.ambience || 'building', { power: this.flag('power_on') });
    this.musicOverride = null;
    this.updateMusic();
  }

  setMusic(track) {
    this.musicOverride = track;
    this.updateMusic();
  }

  updateMusic() {
    if (this.mode === 'title') return;
    const zn = this.world.zoneNow;
    let track = this.world.map.music || 'explore';
    if (this.tense) track = 'tension';
    if (zn && zn.safe) track = 'safe';
    if (this.musicOverride) track = this.musicOverride;
    this.audio.setMusic(track);
  }

  onZoneChange(zn) {
    this.audio.setIndoor(this.world.isIndoor(this.player.pos.x, this.player.pos.z));
    this.renderer.fx.safe.value = zn && zn.safe ? 1 : 0;
    this.updateMusic();
    if (zn && zn.safe && !this.state.hintsShown.saveRoom) {
      this.state.hintsShown.saveRoom = 1;
      this.hint('save');
    }
  }

  // ------------------------------------------------------------ estado/flags
  flag(k) {
    return this.state ? this.state.flags[k] : undefined;
  }
  setFlag(k, v = true) {
    this.state.flags[k] = v;
  }

  hint(id) {
    if (!this.settings.get('hints') || !this.state) return;
    if (this.state.hintsShown[id]) return;
    this.state.hintsShown[id] = 1;
    this.hud.hint(HINTS[id] || id);
  }

  after(sec, fn) {
    this.timers.push({ t: sec, fn });
  }

  wait(sec) {
    return new Promise((r) => this.after(sec, r));
  }

  radio(lines) {
    this.ui.radio(lines);
  }

  readDoc(id) {
    if (!this.state.docs.includes(id)) {
      this.state.docs.push(id);
      this.hud.message(`Arquivo adicionado: ${DOCS[id].title}`);
      if (this.state.docs.length === 1) this.after(1, () => this.hint('docs'));
    }
    this.ui.openDoc(id);
  }

  openSave() {
    this.ui.slots('save', (slot) => this.saveGame(slot));
  }
  openStorage() {
    this.ui.storage();
  }

  // ------------------------------------------------------------ itens
  useHeal(index) {
    const s = this.state.inv[index];
    if (!s) return '';
    const d = ITEMS[s.id];
    if (d.type !== 'heal') return 'Não dá para usar isso aqui.';
    if (this.player.hp >= 100) return 'Você não está ferido.';
    this.inv.removeAt(index, 1);
    this.player.heal(d.heal);
    this.audio.play('heal');
    return `Você usou: ${d.name}.`;
  }

  quickHeal() {
    if (this.player.hp >= 100) {
      this.hud.message('Você não está ferido.');
      return;
    }
    // usa o item mais fraco que ainda ajude
    const order = ['bandage', 'herb', 'herb_mix', 'firstaid', 'medicine'];
    for (const id of order) {
      const i = this.state.inv.findIndex((s) => s && s.id === id);
      if (i >= 0) {
        this.hud.message(this.useHeal(i));
        return;
      }
    }
    this.hud.message('Nenhum item de cura no inventário.');
  }

  reloadFromInventory(wid) {
    const w = WEAPONS[wid];
    if (!w || w.melee) return '';
    const st = this.state.weapons[wid];
    if (st.mag >= w.mag) return 'A arma já está carregada.';
    const got = this.inv.remove(w.ammo, w.mag - st.mag);
    if (!got) return 'Sem munição para essa arma.';
    st.mag += got;
    this.audio.play('reload');
    return `${w.name} recarregada (${st.mag}/${w.mag}).`;
  }

  // ------------------------------------------------------------ UI / ponteiro
  enterUI() {
    if (this.mode === 'playing') {
      this.prevMode = 'playing';
      this.mode = 'ui';
      this.expectUnlock = true;
      this.input.exitLock();
      this.input.clearAll();
    }
  }

  exitUI() {
    if (this.mode === 'ui') {
      this.mode = this.prevMode || 'playing';
      this.input.clearAll();
      if (this.mode === 'playing') this.resumeLock();
    }
  }

  resumeLock() {
    if (this.debug && !document.hasFocus()) return;
    this.input.requestLock();
  }

  onLockChange(locked) {
    if (locked) {
      this._needClick = false;
      this.ui.showClick(false);
      return;
    }
    if (this.expectUnlock) {
      this.expectUnlock = false;
      return;
    }
    if (this.mode === 'playing' && !this.ui.open) this.ui.pause();
  }

  onKey(e) {
    if (this.ui.open) {
      this.ui.onKey(e);
      return;
    }
    if (this.mode !== 'playing') return;
    if (e.code === 'Escape' || e.code === 'KeyP') this.ui.pause();
    else if ((e.code === 'Tab' || e.code === 'KeyI') && !this.player.grabbedBy && !this.player.dead) this.ui.inventory('items');
    else if (e.code === 'KeyM' && !this.player.dead) this.ui.inventory('map');
  }

  // ------------------------------------------------------------ morte / final
  onPlayerDeath() {
    this.state.stats.deaths++;
    this.setMusic('none');
    this.after(2.8, async () => {
      this.mode = 'dead';
      this.input.exitLock();
      await this.ui.fade(0.85, 1.2);
      this.audio.play('stinger');
      this.ui.gameOver();
    });
  }

  async ending() {
    this.mode = 'ending';
    this.hud.show(false);
    this.input.exitLock();
    this.audio.play('elevator');
    await this.ui.fade(1, 2.5);
    this.audio.setAmbient('silent');
    this.audio.setMusic('ending');
    const st = this.state;
    this.ui.ending(ENDING, {
      time: st.time,
      difficulty: st.difficulty,
      kills: st.stats.kills,
      shots: st.stats.shots,
      saves: st.stats.saves,
      docs: st.docs.length,
      docsTotal: Object.keys(DOCS).length,
    });
    this.saves.write(9, { ...st, cleared: true });
  }

  // câmera dirigida rapidamente para algo (apresentação de chefes)
  cinematicLook(target, dur = 2.2, h = 2) {
    const p = this.player.pos;
    const tp = target.pos;
    const dir = new THREE.Vector3(tp.x - p.x, 0, tp.z - p.z).normalize();
    const camPos = new THREE.Vector3(p.x - dir.x * 2.0 + dir.z * 0.9, 1.75, p.z - dir.z * 2.0 - dir.x * 0.9);
    this.cam.cinematic(camPos, new THREE.Vector3(tp.x, h, tp.z), 0.7);
    this.player.locked = true;
    this.cutsceneLock = true;
    this.after(dur, () => {
      this.cam.endCinematic();
      this.cam.setYaw(Math.atan2(dir.x, dir.z));
      this.player.locked = false;
      this.cutsceneLock = false;
    });
  }

  // avança a simulação sem renderizar (usado em testes automatizados)
  simulate(sec, dt = 1 / 30) {
    for (let t = 0; t < sec; t += dt) this.step(dt, false);
  }

  // ------------------------------------------------------------ ciclo
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    try {
      this.step(dt);
    } catch (err) {
      console.error(err);
      if (!this._errShown) {
        this._errShown = true;
        this.hud.message('Erro: ' + err.message, 8);
      }
    }
    this.input.endFrame();
  }

  step(dt, render = true) {
    const w = this.world;
    if (!w.scene) return;
    const mode = this.mode;
    if (mode === 'playing') {
      this.state.time += dt;
      this.player.update(dt, this.input);
      w.update(dt);
      this.cam.update(dt, this.input, this.player, w);
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) {
          this.timers.splice(i, 1);
          tm.fn();
        }
      }
      if (this.player.grabbedBy) this.hint('struggle');
      // trilha adaptativa: tensão quando há criaturas alertas por perto
      const wantTense = this.fear > 0.45;
      this.tenseT = wantTense === !!this.tense ? 0 : (this.tenseT || 0) + dt;
      if (this.tenseT > (wantTense ? 1 : 5)) {
        this.tense = wantTense;
        this.tenseT = 0;
        this.updateMusic();
      }
    } else if (mode === 'title') {
      this.titleT += dt;
      const t = this.titleT * 0.05;
      const pos = new THREE.Vector3(Math.sin(t) * 2.5 + 0.5, 1.7 + Math.sin(t * 0.7) * 0.2, 40 - (this.titleT * 0.4) % 30);
      this.cam.camera.position.copy(pos);
      this.cam.camera.lookAt(pos.x - 1, 1.4, pos.z - 12);
      w.weather.update(dt, w.time += dt, this.cam.camera, pos);
      w.particles.update(dt);
      w.updateLights(dt);
      for (const e of w.enemies) e.update(dt * 0.0);
    } else if (mode === 'dead') {
      w.update(dt);
      this.player.update(dt, this.input);
      this.cam.update(dt, null, this.player, w);
    } else {
      // ui / transição / cena: mundo congelado, clima e câmera seguem
      w.weather.update(dt, w.time, this.cam.camera, this.player.pos);
      w.particles.update(dt);
      if (mode === 'cutscene') {
        for (const n of w.npcs) n.update(dt);
        for (const e of w.enemies) e.update(dt);
        this.player.animate(dt);
        this.player.updateLights(dt);
        w.updateLights(dt);
        for (let i = this.timers.length - 1; i >= 0; i--) {
          const tm = this.timers[i];
          tm.t -= dt;
          if (tm.t <= 0) {
            this.timers.splice(i, 1);
            tm.fn();
          }
        }
      }
      this.cam.update(dt, null, this.player, w);
    }
    // efeitos de tela
    this.fx.damage = Math.max(0, this.fx.damage - dt * 1.6);
    const u = this.renderer.fx;
    u.damage.value = this.fx.damage;
    u.lowHealth.value = this.state && mode !== 'title' ? clamp((35 - this.player.hp) / 35, 0, 1) : 0;
    u.flash.value = this.fx.flash || 0;
    if (!render) return;
    // sem o ponteiro travado a câmera não responde: mostra o aviso de clique
    const unlocked = mode === 'playing' && !this.input.locked && !this.debug && !this.ui.open;
    this._unlockedT = unlocked ? (this._unlockedT || 0) + dt : 0;
    const needClick = this._unlockedT > 0.4;
    if (needClick !== this._needClick) {
      this._needClick = needClick;
      this.ui.showClick(needClick);
    }
    const cam = this.cam.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    this.audio.update(dt, { pos: cam.position, fwd });
    if (mode !== 'title') this.hud.update(dt);
    this.renderer.render(w.scene, cam, this.time);
  }
}
