import * as THREE from 'three';
import { Settings } from '../config/Settings.js';
import { loadProfile, saveProfile, profileToPlayerData } from '../data/PlayerProfile.js';
import { TEAMS } from '../data/Teams.js';
import { loadCampaign } from '../campaign/CampaignProgress.js';
import { Court } from '../court/Court.js';
import { Wasteland } from '../court/Wasteland.js';
import { Arena } from '../court/Arena.js';
import { getTheme } from '../court/CourtThemes.js';
import { CameraController } from '../camera/CameraController.js';
import { InputManager } from '../controls/InputManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { MusicPlayer } from '../audio/MusicPlayer.js';
import { HUD } from '../ui/HUD.js';
import { Menus } from '../ui/Menus.js';
import { Particles } from '../fx/Particles.js';
import { createMode } from '../modes/ModeRegistry.js';
import { CharacterModel } from '../entities/CharacterModel.js';
import { Animator } from '../entities/Animator.js';
import { Ball } from '../entities/Ball.js';
import { clamp, pick } from './MathUtils.js';

const QUALITY = {
  low: { pixelRatio: 0.85, shadows: false, shadowSize: 512, reflections: false, env: false },
  medium: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, reflections: false, env: true },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, reflections: true, env: true },
};

function disposeTree(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (m.map && !seen.has(m.map)) {
        seen.add(m.map);
        m.map.dispose();
      }
      m.dispose();
    }
    if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
    if (o.getRenderTarget) o.getRenderTarget().dispose();
  });
}

/**
 * Núcleo do jogo: renderizador, cena, ciclo principal, estados
 * (menu, jogando, pausado, personalização, fim de jogo) e ligação entre sistemas.
 */
export class Game {
  constructor(options = {}) {
    this.options = options;
    this.settings = new Settings();
    this.profile = loadProfile();
    this.campaign = loadCampaign();
    this.state = 'loading';
    this.mode = null;
    this.modeId = null;
    this.modeConfig = null;
    this.timeScale = options.timeScale || 1;
    this.unbinders = [];

    const q = QUALITY[this.settings.get('quality')] || QUALITY.medium;
    this.renderer = new THREE.WebGLRenderer({ antialias: this.settings.get('quality') !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080d);
    this.scene.fog = new THREE.Fog(0x06080d, 45, 95);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 220);
    this.camera.position.set(0, 8, 18);

    this.themeId = 'arena';
    this.buildVenue();

    this.particles = new Particles(this.scene);
    this.input = new InputManager();
    this.audio = new AudioManager(this.settings);
    this.music = new MusicPlayer(this.audio);
    this.hud = new HUD(document.getElementById('hud'));
    this.menus = new Menus(this);
    this.cameraCtl = new CameraController(this.camera);

    this.input.onPausePressed = () => this.onPauseKey();
    this.settings.onChange((k) => this.onSettingChanged(k));
    window.addEventListener('resize', () => this.onResize());
    this.applyQuality();
    this.setupPreviewDrag();

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());

    // primeira interação do usuário libera o áudio e a música do menu
    const unlock = () => {
      this.audio.init();
      if (this.state === 'menu' || this.state === 'customize') this.music.play('menu');
      else if (this.state === 'playing') this.music.play('game');
      this.audio.setCrowd(this.state === 'playing' ? 0.35 : 0.15);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    setTimeout(() => {
      this.startDemo();
      this.menus.show('mainMenu', false);
      document.getElementById('loading').classList.remove('active');
    }, 300);
  }

  // ------------------------------------------------------------------
  buildVenue() {
    const theme = getTheme(this.themeId);
    // libera a quadra anterior da memória de vídeo (a campanha troca de cenário a cada fase)
    for (const old of [this.court, this.arena]) {
      if (!old) continue;
      this.scene.remove(old.group);
      disposeTree(old.group);
    }
    this.court = new Court(this.scene, theme);
    // cada tema escolhe o cenário: arena coberta ou quadra pós-apocalíptica
    const Venue = theme.venue === 'wasteland' ? Wasteland : Arena;
    this.arena = new Venue(this.scene, theme, this.settings.get('quality'));
    const fog = theme.env && theme.env.fog;
    this.scene.fog = fog ? new THREE.Fog(fog[0], fog[1], fog[2]) : new THREE.Fog(0x06080d, 45, 95);
    this.scene.background = new THREE.Color(fog ? fog[0] : 0x06080d);
    this.camera.far = fog ? 320 : 220;
    this.camera.updateProjectionMatrix();
    if (this.envMap) this.envMap.dispose();
    this.envMap = null;
  }

  buildEnvMap() {
    if (this.envMap) return this.envMap;
    const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const cube = new THREE.CubeCamera(0.5, 120, rt);
    cube.position.set(0, 2.5, 0);
    this.court.floor.visible = false;
    const fog = this.scene.fog;
    this.scene.fog = null;
    cube.update(this.renderer, this.scene);
    this.scene.fog = fog;
    this.court.floor.visible = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromCubemap(rt.texture).texture;
    pmrem.dispose();
    rt.dispose();
    return this.envMap;
  }

  applyQuality() {
    const id = this.settings.get('quality');
    const q = QUALITY[id] || QUALITY.medium;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.arena.setShadows(q.shadows, q.shadowSize);
    if (q.env) {
      const env = this.buildEnvMap();
      this.court.floorMaterial.envMap = env;
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.3;
    } else {
      this.court.floorMaterial.envMap = null;
      this.scene.environment = null;
    }
    this.court.setReflections(q.reflections, this.renderer);
    this.scene.traverse((o) => {
      if (o.material && o.material.isMaterial) o.material.needsUpdate = true;
    });
  }

  onSettingChanged(key) {
    if (key === 'quality') this.applyQuality();
    if (key.endsWith('Volume')) this.audio.applyVolumes();
    if (key === 'cameraMode' && (this.state === 'playing' || this.state === 'paused')) this.cameraCtl.setMode(this.settings.get('cameraMode'));
    if (key === 'showHints') this.hud.setHints(this.settings.get('showHints') && this.state !== 'menu', this.mode && this.mode.id);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------------
  // Modos
  disposeMode() {
    for (const u of this.unbinders) u();
    this.unbinders = [];
    if (this.mode) this.mode.dispose();
    this.mode = null;
  }

  startDemo() {
    this.disposeMode();
    const a = pick(TEAMS);
    let b = pick(TEAMS);
    while (b === a) b = pick(TEAMS);
    this.mode = createMode('demo', this, { home: a.id, away: b.id, difficulty: 'normal', teamSize: 3, quarterLength: 1 });
    this.mode.start();
    this.bindWorld(this.mode.world, true);
    this.state = 'menu';
    this.modeId = null;
    this.hud.show(false);
    this.cameraCtl.setMode('menu');
    this.audio.setSfxScale(0.35);
    this.audio.setCrowd(0.15);
    if (this.audio.ctx) this.music.play('menu');
  }

  restartDemo() {
    if (this.state === 'menu' && this.mode && this.mode.id === 'demo') this.startDemo();
  }

  startMode(id, cfg) {
    this.audio.init();
    this.menus.hideAll();
    this.hud.fade(() => {
      this.disposeMode();
      const wantTheme = cfg.court || 'arena';
      if (wantTheme !== this.themeId) {
        this.themeId = wantTheme;
        this.buildVenue();
        this.applyQuality();
      }
      this.modeId = id;
      this.modeConfig = cfg;
      this.mode = createMode(id, this, cfg);
      this.mode.start();
      this.bindWorld(this.mode.world, false);
      this.state = 'playing';
      this.hud.show(true);
      this.hud.setHints(this.settings.get('showHints'), this.mode.id);
      this.cameraCtl.setMode(this.settings.get('cameraMode'), true);
      if (this.mode.id === 'match') {
        this.cameraCtl.cinematic({ center: new THREE.Vector3(0, 0, 0), radius: 11, height: 4.5, lookY: 1.5, speed: 0.35, duration: 2.6, fov: 50 });
      }
      this.audio.setSfxScale(1);
      this.audio.setCrowd(0.35);
      this.music.play('game');
    });
  }

  restart() {
    if (this.modeId) this.startMode(this.modeId, this.modeConfig);
  }

  quitToMenu(screen = 'mainMenu') {
    this.menus.hideAll();
    this.hud.fade(() => {
      if (this.themeId !== 'arena') {
        this.disposeMode();
        this.themeId = 'arena';
        this.buildVenue();
        this.applyQuality();
      }
      this.startDemo();
      this.menus.show('mainMenu', false);
      if (screen === 'campaignMenu') this.menus.openCampaign();
      this.music.play('menu');
    });
  }

  onPauseKey() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') {
      if (this.menus.current === 'pauseMenu') this.resume();
      else this.menus.back();
    } else if (this.state === 'menu' && this.menus.current && this.menus.current !== 'mainMenu') this.menus.back();
  }

  pause() {
    this.state = 'paused';
    this.menus.stack = [];
    this.menus.show('pauseMenu', false);
    this.audio.setCrowd(0.1);
  }

  resume() {
    this.menus.hideAll();
    this.state = 'playing';
    this.audio.setCrowd(0.35);
    this.input.down.clear();
  }

  transition(fn, quick) {
    if (quick || this.state === 'menu') {
      fn();
      return;
    }
    this.hud.fade(fn, false);
  }

  onMatchOver(res, mode) {
    this.state = 'over';
    const won = res.winner === 0;
    const winners = mode.world.teams[res.winner].players;
    const center = winners[0] ? winners[0].pos.clone() : new THREE.Vector3();
    for (const p of winners) p.celebrate(6);
    this.cameraCtl.cinematic({ center, follow: winners[0], radius: 5, height: 1.8, speed: 0.4, duration: 3, fov: 45 });
    this.audio.cheer(won ? 1.2 : 0.4);
    this.arena.cheer(won ? 1 : 0.3);
    if (won) {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => this.confetti(new THREE.Vector3((Math.random() - 0.5) * 16, 9, (Math.random() - 0.5) * 8), mode.kits[0]), i * 250);
      }
    }
    setTimeout(() => {
      if (this.mode === mode) {
        this.hud.show(false);
        this.menus.showGameOver(res, mode);
      }
    }, 3000);
  }

  confetti(pos, kit) {
    this.particles.emit(pos, { count: 60, colors: [kit.primary, kit.secondary, kit.accent, '#ffffff'], speed: 3, spread: 1, up: 1, life: 3, gravity: 2.2, size: 0.12 });
  }

  // ------------------------------------------------------------------
  // Ligação de eventos do mundo com áudio, efeitos, interface e câmera
  bindWorld(world, demo) {
    const A = this.audio;
    const on = (t, fn) => this.unbinders.push(world.on(t, fn));
    const rate = () => 0.92 + Math.random() * 0.16;
    on('bounce', ({ pos, impact }) => A.playAt('bounce', pos, { volume: clamp(impact / 6, 0.15, 1), rate: rate() }));
    on('dribble', ({ pos }) => A.playAt('bounce', pos, { volume: 0.5, rate: rate() }));
    on('rim', ({ pos, impact }) => {
      A.playAt('rim', pos, { volume: clamp(impact / 5, 0.2, 1), rate: rate() });
      if (!demo) this.cameraCtl.shake(0.05);
    });
    on('board', ({ pos, impact }) => A.playAt('board', pos, { volume: clamp(impact / 6, 0.3, 1), rate: rate() }));
    on('net', ({ side }) => A.playAt('swish', { x: side * 12.4, z: 0 }, { volume: 0.9, rate: rate() }));
    on('squeak', ({ player }) => A.playAt('squeak' + Math.floor(Math.random() * 3), player.pos, { volume: 0.32, rate: rate() }));
    on('whistle', () => A.play('whistle', { volume: 0.45 }));
    on('buzzer', ({ short }) => A.play('buzzer', { volume: short ? 0.35 : 0.55, rate: short ? 1.2 : 1 }));
    on('pass', ({ from }) => A.playAt('whoosh', from.pos, { volume: 0.4, rate: rate() }));
    on('catch', ({ player }) => A.playAt('catch', player.pos, { volume: 0.35, rate: rate() }));
    on('message', ({ text, sub, kind, duration }) => {
      if (!demo) this.hud.message(text, sub, kind, duration);
    });
    on('shotReleased', ({ player, info }) => {
      if (player.isHuman && info.timing) this.hud.showTiming(info.timing);
    });
    on('dunk', ({ player }) => {
      A.playAt('dunk', player.pos, { volume: 1 });
      this.cameraCtl.shake(demo ? 0.1 : 0.5);
      this.arena.cheer(0.8);
    });
    on('block', ({ player }) => {
      A.playAt('board', player.pos, { volume: 0.6, rate: 1.4 });
      if (!demo) this.cameraCtl.shake(0.2);
      A.cheer(player.team === 0 ? 0.7 : 0.3);
      this.arena.cheer(0.4);
    });
    on('steal', ({ player }) => {
      A.cheer(player.team === 0 ? 0.5 : 0.2);
    });
    on('dribbleMove', ({ player, label, combo }) => {
      A.playAt('whoosh', player.pos, { volume: 0.18 + combo * 0.05, rate: 1.5 + combo * 0.1 });
      if (!demo && player.isHuman) this.hud.moveLabel(label, combo);
    });
    on('ankleBreaker', ({ player, victim }) => {
      if (!demo) this.hud.message('DESEQUILIBROU!', `${player.name} deixou ${victim.name} no chão`, 'steal', 1.3);
      A.cheer(0.8);
      this.arena.cheer(0.6);
    });
    on('possession', ({ team }) => {
      if (team === 1 && Math.random() < 0.35) A.chant();
    });
    on('scored', ({ team, points, shooter, swish, type }) => {
      const kit = this.mode && this.mode.kits ? this.mode.kits[team] : this.mode && this.mode.kit;
      const label = type === 'dunk' ? 'ENTERRADA!' : points === 3 ? 'CESTA DE 3!' : type === 'ft' ? 'LANCE LIVRE' : swish ? 'CHUÁ!' : type === 'layup' ? 'BANDEJA!' : 'CESTA!';
      if (!demo) this.hud.points(points, kit ? kit.primary : '#ff8a1f', label);
      const home = team === 0;
      A.cheer(home ? (points === 3 || type === 'dunk' ? 1.1 : 0.8) : 0.35);
      if (home && !demo) A.scoreJingle(points);
      this.arena.cheer(home ? 1 : 0.4);
      const rimPos = new THREE.Vector3(team === 0 ? 12.425 : -12.425, 3.0, 0);
      const colors = kit ? [kit.primary, kit.accent, '#ffffff'] : ['#ffffff'];
      this.particles.emit(rimPos, { count: points === 3 || type === 'dunk' ? 50 : 26, colors, speed: 2.2, up: 2.5, life: 1.3, gravity: 5, size: 0.07 });
      if (!demo && shooter && type !== 'ft' && this.settings.get('cameraMode') === 'follow') {
        this.cameraCtl.cinematic({ center: shooter.pos.clone(), follow: shooter, radius: 4.8, height: 1.7, speed: 0.5, duration: 1.5, fov: 46 });
      }
    });
  }

  // ------------------------------------------------------------------
  // Personalização com pré-visualização 3D
  enterCustomize(draft) {
    this.disposeMode();
    this.state = 'customize';
    this.cameraCtl.setMode('preview');
    this.previewBall = new Ball(this.scene);
    this.previewYaw = 0.4;
    this.previewTime = 0;
    this.updatePreview(draft);
  }

  updatePreview(draft, throttle = false) {
    const now = performance.now();
    if (throttle && this.lastPreviewBuild && now - this.lastPreviewBuild < 60) {
      this.pendingDraft = draft;
      return;
    }
    this.lastPreviewBuild = now;
    this.pendingDraft = null;
    if (this.preview) this.preview.model.dispose();
    const team = TEAMS[0];
    const data = profileToPlayerData(draft);
    const model = new CharacterModel(data.appearance, { primary: team.primary, secondary: team.secondary, accent: team.accent }, data.number, data.name);
    model.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.scene.add(model.root);
    const animator = new Animator(model);
    this.preview = {
      model,
      animator,
      state: { speed: 0, onGround: true, hasBall: true, dribblePhase: 0, dribbleHand: 1, stance: 'normal', action: null, actionTime: 0, actionData: {} },
    };
  }

  exitCustomize(save) {
    if (save) {
      this.profile = JSON.parse(JSON.stringify(this.menus.draft));
      saveProfile(this.profile);
    }
    if (this.preview) this.preview.model.dispose();
    this.preview = null;
    if (this.previewBall) this.previewBall.dispose();
    this.previewBall = null;
    this.menus.stack = [];
    this.startDemo();
    this.menus.show('mainMenu', false);
  }

  setupPreviewDrag() {
    let dragging = false;
    let lastX = 0;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (this.state !== 'customize') return;
      dragging = true;
      lastX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.previewYaw += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => (dragging = false));
  }

  updatePreviewModel(dt) {
    const pv = this.preview;
    if (!pv) return;
    if (this.pendingDraft && performance.now() - this.lastPreviewBuild > 60) this.updatePreview(this.pendingDraft);
    this.previewTime += dt;
    const s = pv.state;
    const cycle = this.previewTime % 9;
    s.actionTime += dt;
    if (cycle < 5) {
      if (s.action) {
        s.action = null;
        s.actionTime = 0;
      }
      s.hasBall = true;
    } else if (cycle < 7.2) {
      if (s.action !== 'celebrate') {
        s.action = 'celebrate';
        s.actionTime = 0;
        s.actionData = { variant: Math.floor(Math.random() * 3) };
      }
      s.hasBall = false;
    } else {
      s.action = null;
      s.hasBall = false;
      s.stance = 'defense';
    }
    if (cycle < 7.2) s.stance = 'normal';
    const prev = s.dribblePhase;
    s.dribblePhase = (s.dribblePhase + dt * 1.5) % 1;
    pv.model.root.position.set(0, 0, 0);
    pv.model.root.rotation.y = this.previewYaw;
    pv.animator.update(dt, s);
    pv.model.root.updateMatrixWorld(true);
    const b = this.previewBall;
    if (s.hasBall) {
      const sc = pv.model.scale;
      const h = this.previewYaw;
      const f = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
      const r = new THREE.Vector3(-Math.cos(h), 0, Math.sin(h));
      const y = 0.12 + (0.9 * sc - 0.12) * Math.abs(Math.cos(Math.PI * s.dribblePhase));
      b.pos.set(0, 0, 0).addScaledVector(f, 0.34 * sc).addScaledVector(r, 0.3 * sc);
      b.pos.y = y;
      b.spin.set(r.x, 0, r.z).multiplyScalar(-6);
      b.setVisible(true);
      if (prev < 0.5 && s.dribblePhase >= 0.5) this.audio.play('bounce', { volume: 0.25 });
    } else {
      b.setVisible(false);
    }
    b.update(dt);
  }

  // ------------------------------------------------------------------
  frame() {
    const rawDt = Math.min(this.clock.getDelta(), 1 / 20);
    const dt = rawDt * this.timeScale;
    this.input.poll();

    if (this.state === 'playing' && this.input.wasPressed('hints')) {
      this.settings.set('showHints', !this.settings.get('showHints'));
    }

    const running = this.state === 'playing' || this.state === 'menu' || this.state === 'over';
    if (running && this.mode) this.mode.update(dt);
    if (this.state === 'customize') this.updatePreviewModel(rawDt);

    const camCtx = this.mode ? this.mode.cameraContext() : null;
    this.cameraCtl.update(rawDt, camCtx || {});
    this.arena.update(rawDt);
    this.particles.update(rawDt, this.renderer.domElement.clientHeight);

    if (this.mode) {
      const hs = this.mode.hudState();
      if (this.state === 'playing' || this.state === 'over' || this.state === 'paused') this.hud.update(rawDt, hs, this.camera, this.renderer);
      this.updateVenueDisplays(hs);
    }

    this.audio.setListener(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  updateVenueDisplays(hs) {
    if (!hs) return;
    if (hs.type === 'match') {
      const c = hs.clock;
      const clock = c < 60 ? c.toFixed(1) : `${Math.floor(c / 60)}:${String(Math.floor(c % 60)).padStart(2, '0')}`;
      this.arena.updateScoreboard({
        home: hs.teams[0].abbr,
        away: hs.teams[1].abbr,
        homeScore: hs.score[0],
        awayScore: hs.score[1],
        clock,
        period: hs.period,
        homeColor: hs.kits[0].primary,
        awayColor: hs.kits[1].primary,
      });
      for (const h of this.court.hoops) h.setShotClock(hs.shotClockOff ? null : hs.shotClock);
    } else if (hs.type === 'training') {
      const s = hs.stats;
      this.arena.updateScoreboard({ home: 'TREINO', away: '%', homeScore: s.makes, awayScore: s.attempts ? Math.round((s.makes / s.attempts) * 100) : 0, clock: `${s.makes}/${s.attempts}`, period: 'TREINAMENTO', homeColor: hs.kits[0].primary, awayColor: '#333333' });
      for (const h of this.court.hoops) h.setShotClock(null);
    }
  }
}
