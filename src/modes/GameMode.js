// Classe base para modos de jogo. Novos modos (campeonato, multiplayer,
// carreira) devem estender esta classe e se registrar em ModeRegistry.
export class GameMode {
  constructor(game, config = {}) {
    this.game = game;
    this.config = config;
    this.world = null;
    this.rules = null;
    this.human = null;
    this.finished = false;
  }

  get id() {
    return 'base';
  }

  start() {}

  update() {}

  // Dados para a interface (placar, relógio etc.)
  hudState() {
    return null;
  }

  // Contexto para a câmera
  cameraContext() {
    return null;
  }

  dispose() {
    if (this.world) this.world.dispose();
    this.world = null;
  }
}
