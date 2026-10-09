import { MatchMode } from './MatchMode.js';
import { getStage, stageIndex, starsFor, MODIFIERS, HOME_CREW, STAGES } from '../campaign/CampaignData.js';
import { recordResult } from '../campaign/CampaignProgress.js';
import { profileForTier } from '../config/Difficulty.js';
import { saveProfile } from '../data/PlayerProfile.js';

/**
 * Fase da campanha: uma partida contra a gangue dona da quadra, com o perfil
 * de IA e os atributos ficando mais fortes a cada fase e regras especiais
 * da quadra (vento, piso escorregadio, ar tóxico, torcida hostil).
 * config: { stage: id }
 */
export class CampaignMode extends MatchMode {
  constructor(game, config) {
    const stage = getStage(config.stage);
    const index = stageIndex(stage.id);
    // a equipe do jogador melhora conforme as quadras dominadas
    const crew = { ...HOME_CREW, rating: HOME_CREW.rating + Math.round((index / (STAGES.length - 1)) * 10) };
    super(game, {
      ...config,
      homeTeam: crew,
      awayTeam: stage.team,
      awayProfile: profileForTier(stage.tier),
      teamSize: stage.teamSize,
      quarters: stage.quarters,
      quarterLength: stage.quarterLength,
      court: stage.court,
    });
    this.stage = stage;
    this.stageIndex = index;
    this.campaignResult = null;
  }

  get campaign() {
    return true;
  }

  start() {
    super.start();
    const w = this.world;
    for (const id of this.stage.modifiers) {
      const m = MODIFIERS[id];
      if (m.grip) w.mods.grip = Math.min(w.mods.grip, m.grip);
      if (m.drain) w.mods.drain = m.drain;
      if (m.homeShotSigma) w.mods.homeShotSigma = m.homeShotSigma;
      if (m.wind) w.physics.wind = { ...m.wind };
    }
    // apresentação da fase
    const mods = this.stage.modifiers.map((id) => MODIFIERS[id].label).join(' • ');
    setTimeout(() => {
      if (this.game.mode === this && !this.finished) {
        this.game.hud.message(this.stage.title.toUpperCase(), `${this.stage.team.name}${mods ? ' • ' + mods : ''}`, 'period', 3.2);
      }
    }, 600);
  }

  onGameOver(res) {
    const margin = res.score[0] - res.score[1];
    const stars = starsFor(margin);
    const g = this.game;
    const r = recordResult(g.campaign, this.stage, this.stageIndex, margin, stars);
    r.reward = null;
    if (r.firstWin) {
      // recompensa: pontos de atributo permanentes no jogador
      const bonus = g.profile.bonusAttrs || (g.profile.bonusAttrs = {});
      for (const [k, v] of Object.entries(this.stage.reward)) bonus[k] = (bonus[k] || 0) + v;
      g.profile.xp = (g.profile.xp || 0) + 100 * (this.stageIndex + 1);
      g.profile.level = 1 + Object.keys(g.campaign.rewarded).length;
      saveProfile(g.profile);
      r.reward = this.stage.reward;
    }
    this.campaignResult = r;
    super.onGameOver(res);
  }
}
