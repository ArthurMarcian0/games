import * as THREE from 'three';
import { GameMode } from './GameMode.js';
import { World } from '../core/World.js';
import { TrainingRules } from '../rules/TrainingRules.js';
import { TeamAI } from '../ai/TeamAI.js';
import { AIController } from '../ai/AIController.js';
import { HumanController } from '../controls/HumanController.js';
import { getDifficulty } from '../config/Difficulty.js';
import { getTeam, getLineup, TEAMS } from '../data/Teams.js';
import { profileToPlayerData } from '../data/PlayerProfile.js';
import { COURT } from '../config/Constants.js';

// Treinamento livre: arremessos, bandejas, enterradas e lances livres,
// com defensor opcional controlado pela IA.
export class TrainingMode extends GameMode {
  get id() {
    return 'training';
  }

  start() {
    const g = this.game;
    const world = new World(g);
    this.world = world;
    const home = getTeam(this.config.home || TEAMS[0].id);
    const opp = TEAMS.find((t) => t.id !== home.id);
    world.teams[0].def = home;
    world.teams[1].def = opp;
    this.teams = [home, opp];
    this.kit = { primary: home.primary, secondary: home.secondary, accent: home.accent };
    this.oppKit = { primary: opp.primary, secondary: opp.secondary, accent: opp.accent };
    g.arena.setTeamColors(home.primary, opp.primary);

    const me = world.addPlayer(profileToPlayerData(g.profile), 0, this.kit);
    this.human = me;
    this.humanController = new HumanController(g.input, g.camera);
    me.setController(this.humanController);

    this.teamAI = new TeamAI(world, 1);
    this.rules = new TrainingRules(world);
    world.rules = this.rules;
    this.rules.start();
    this.defender = null;
  }

  toggleDefender() {
    const w = this.world;
    if (this.defender) {
      this.defender.dispose();
      w.players = w.players.filter((p) => p !== this.defender);
      w.teams[1].players = [];
      if (w.ball.holder === this.defender) this.rules.resetPlayer();
      this.defender = null;
      w.emit('message', { text: 'DEFENSOR REMOVIDO', sub: '', kind: 'info', duration: 1 });
      return;
    }
    const data = getLineup(this.teams[1], 3)[1];
    const d = w.addPlayer(data, 1, this.oppKit);
    d.teleport(COURT.basketX - 3, 0, -Math.PI / 2);
    d.setController(new AIController(this.teamAI, getDifficulty(this.game.settings.get('difficulty'))));
    this.defender = d;
    this.teamAI.assignDefense();
    w.emit('message', { text: 'DEFENSOR ATIVADO', sub: `Dificuldade: ${getDifficulty(this.game.settings.get('difficulty')).label}`, kind: 'info', duration: 1.2 });
  }

  update(dt) {
    const g = this.game;
    if (g.input.wasPressed('defender')) this.toggleDefender();
    if (g.input.wasPressed('reset')) this.rules.resetPlayer(new THREE.Vector3(this.human.pos.x, 0, this.human.pos.z));
    if (g.input.wasPressed('freethrow')) this.rules.freeThrow();
    // o defensor de treino sempre marca o jogador
    this.rules.possession = this.world.ball.holder && this.world.ball.holder.team === 1 ? 1 : 0;
    this.rules.update(dt);
    this.teamAI.update(dt);
    this.world.update(dt);
  }

  hudState() {
    return {
      type: 'training',
      teams: this.teams,
      kits: [this.kit, this.oppKit],
      stats: this.rules.stats,
      human: this.human,
      defender: !!this.defender,
    };
  }

  cameraContext() {
    return { player: this.human, ball: this.world.ball, goalSign: 1, world: this.world };
  }
}
