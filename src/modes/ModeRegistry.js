import { MatchMode } from './MatchMode.js';
import { TrainingMode } from './TrainingMode.js';

// Registro de modos. Para adicionar "Campeonato" ou "Multiplayer", crie a
// classe do modo e registre aqui.
export const MODES = {
  quick: { label: 'Partida rápida', create: (game, cfg) => new MatchMode(game, cfg) },
  versus: { label: 'Jogo contra IA', create: (game, cfg) => new MatchMode(game, cfg) },
  training: { label: 'Treinamento', create: (game, cfg) => new TrainingMode(game, cfg) },
  demo: { label: 'Demonstração', create: (game, cfg) => new MatchMode(game, { ...cfg, demo: true }) },
  // championship: { label: 'Campeonato', create: ... }  (futuro)
  // online: { label: 'Multiplayer', create: ... }        (futuro)
};

export function createMode(id, game, cfg) {
  const m = MODES[id];
  if (!m) throw new Error('Modo desconhecido: ' + id);
  return m.create(game, cfg);
}
