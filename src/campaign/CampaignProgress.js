import { STAGES } from './CampaignData.js';

// Progresso da campanha salvo no navegador (localStorage, quando disponível)
const KEY = 'skyhoop.campaign.v1';

function fresh() {
  return { unlocked: 1, stars: {}, best: {}, rewarded: {}, completed: false };
}

export function loadCampaign() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) {
    /* armazenamento indisponível */
  }
  return fresh();
}

export function saveCampaign(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* ignora */
  }
}

export function resetCampaign() {
  const s = fresh();
  saveCampaign(s);
  return s;
}

export function isUnlocked(state, index) {
  return index < state.unlocked;
}

/**
 * Registra o resultado de uma fase. Retorna o que mudou para a tela final:
 * { won, stars, newBest, firstWin, unlockedNext, finished }
 */
export function recordResult(state, stage, index, margin, stars) {
  const won = margin > 0;
  const prevStars = state.stars[stage.id] || 0;
  const out = { won, stars, newBest: false, firstWin: false, unlockedNext: null, finished: false };
  if (!won) return out;
  out.firstWin = !state.rewarded[stage.id];
  if (stars > prevStars) {
    state.stars[stage.id] = stars;
    out.newBest = prevStars > 0;
  }
  state.best[stage.id] = Math.max(state.best[stage.id] || 0, margin);
  if (index + 1 >= state.unlocked && index + 1 < STAGES.length) {
    state.unlocked = index + 2;
    out.unlockedNext = STAGES[index + 1];
  }
  if (index === STAGES.length - 1) {
    out.finished = !state.completed;
    state.completed = true;
  }
  state.rewarded[stage.id] = true;
  saveCampaign(state);
  return out;
}
