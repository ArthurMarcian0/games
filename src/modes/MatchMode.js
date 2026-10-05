import * as THREE from 'three';
import { GameMode } from './GameMode.js';
import { World } from '../core/World.js';
import { MatchRules } from '../rules/MatchRules.js';
import { TeamAI } from '../ai/TeamAI.js';
import { AIController } from '../ai/AIController.js';
import { HumanController } from '../controls/HumanController.js';
import { getDifficulty, TEAMMATE_PROFILE } from '../config/Difficulty.js';
import { getTeam, getLineup, TEAMS } from '../data/Teams.js';
import { profileToPlayerData } from '../data/PlayerProfile.js';
import { distXZ } from '../core/MathUtils.js';

function colorDist(a, b) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b);
}

/**
 * Partida completa (partida rápida, jogo contra IA e demonstração do menu).
 * config: { home, away, difficulty, teamSize, quarterLength (min), demo }
 */
export class MatchMode extends GameMode {
  get id() {
    return this.config.demo ? 'demo' : 'match';
  }

  start() {
    const g = this.game;
    const cfg = this.config;
    const world = new World(g);
    this.world = world;
    const home = getTeam(cfg.home);
    let away = getTeam(cfg.away);
    if (away.id === home.id) away = TEAMS.find((t) => t.id !== home.id);
    world.teams[0].def = home;
    world.teams[1].def = away;
    this.teams = [home, away];

    const homeKit = { primary: home.primary, secondary: home.secondary, accent: home.accent };
    let awayKit = { primary: away.primary, secondary: away.secondary, accent: away.accent };
    if (colorDist(home.primary, away.primary) < 0.45) awayKit = { primary: away.secondary, secondary: away.primary, accent: away.accent };
    this.kits = [homeKit, awayKit];
    g.arena.setTeamColors(homeKit.primary, awayKit.primary);

    const size = cfg.teamSize || 3;
    const homeLineup = getLineup(home, size).slice();
    if (!cfg.demo) {
      // o jogador personalizado entra no lugar do titular da mesma posição
      const me = profileToPlayerData(g.profile);
      let idx = homeLineup.findIndex((p) => p.archetype === me.archetype);
      if (idx < 0) idx = 0;
      homeLineup[idx] = me;
      this.myIndex = idx;
    }
    homeLineup.forEach((d) => world.addPlayer(d, 0, homeKit));
    getLineup(away, size).forEach((d) => world.addPlayer(d, 1, awayKit));

    const diff = getDifficulty(cfg.difficulty);
    this.difficulty = diff;
    this.teamAI = [new TeamAI(world, 0), new TeamAI(world, 1)];
    for (const p of world.teams[0].players) p.setController(new AIController(this.teamAI[0], cfg.demo ? diff : TEAMMATE_PROFILE));
    for (const p of world.teams[1].players) p.setController(new AIController(this.teamAI[1], diff));
    this.aiControllers = new Map(world.players.map((p) => [p, p.controller]));

    this.humanController = cfg.demo ? null : new HumanController(g.input, g.camera);
    if (!cfg.demo) this.setHuman(world.teams[0].players[this.myIndex]);

    this.rules = new MatchRules(
      world,
      { quarterLength: (cfg.quarterLength || 2) * 60, introTime: cfg.demo ? 0.5 : 2.8 },
      {
        transition: (fn) => g.transition(fn, cfg.demo),
        onGameOver: (res) => this.onGameOver(res),
      },
    );
    world.rules = this.rules;
    this.rules.start();
    world.on('catch', ({ player }) => this.onCatch(player));
    world.on('possession', ({ team }) => this.onPossession(team));
    world.on('inbound', ({ team, player }) => {
      if (team === 0 && this.humanController) this.setHuman(player);
    });
    world.on('freeThrowSetup', ({ shooter }) => {
      if (shooter.team === 0 && this.humanController) this.setHuman(shooter);
    });
  }

  setHuman(p) {
    if (!this.humanController || !p || p === this.human) return;
    if (this.human) {
      this.human.setController(this.aiControllers.get(this.human));
      this.human.setMarker(false);
    }
    this.human = p;
    p.setController(this.humanController);
  }

  onCatch(player) {
    if (player.team === 0 && this.humanController && this.game.settings.get('autoSwitch')) this.setHuman(player);
  }

  onPossession(team) {
    if (team === 1 && this.humanController && this.game.settings.get('autoSwitch')) {
      // na defesa, assume o jogador mais próximo da bola
      const ball = this.world.ball;
      const mates = this.world.teams[0].players;
      const near = mates.reduce((a, b) => (distXZ(b.pos, ball.pos) < distXZ(a.pos, ball.pos) ? b : a), mates[0]);
      if (near && !this.human?.hasBall) this.setHuman(near);
    }
  }

  switchPlayer() {
    if (!this.humanController || !this.human) return;
    if (this.human.hasBall) return;
    const ball = this.world.ball;
    const mates = this.world.teams[0].players.filter((p) => p !== this.human);
    if (!mates.length) return;
    mates.sort((a, b) => distXZ(a.pos, ball.pos) - distXZ(b.pos, ball.pos));
    this.setHuman(mates[0]);
    this.game.audio.play('click', { volume: 0.4 });
  }

  onGameOver(res) {
    this.finished = true;
    if (this.config.demo) {
      setTimeout(() => this.game.restartDemo && this.game.restartDemo(), 3000);
      return;
    }
    this.game.onMatchOver(res, this);
  }

  update(dt) {
    const g = this.game;
    if (this.humanController && g.input.wasPressed('switch')) this.switchPlayer();
    this.rules.update(dt);
    this.teamAI[0].update(dt);
    this.teamAI[1].update(dt);
    this.world.update(dt);

    // indicador de passe para o companheiro
    if (this.humanController) {
      const preview = this.human && this.human.hasBall ? this.humanController.passPreview : null;
      for (const p of this.world.teams[0].players) p.setMarker(p === preview, '#ffd54a');
    }
  }

  hudState() {
    const r = this.rules;
    return {
      type: 'match',
      teams: this.teams,
      kits: this.kits,
      score: r.score,
      clock: r.clock,
      shotClock: r.shotClock,
      shotClockOff: r.shotClockOff,
      period: r.shortPeriod(),
      possession: r.possession,
      fouls: r.teamFouls,
      phase: r.phase,
      human: this.human,
    };
  }

  cameraContext() {
    const r = this.rules;
    const ball = this.world.ball;
    const p = this.human || ball.holder || this.world.players[0];
    const offense = r.possession === (p ? p.team : 0);
    const sign = this.world.attackSign(p ? p.team : 0);
    return { player: p, ball, goalSign: offense ? sign : -sign, world: this.world };
  }
}
