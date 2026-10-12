// Ponto de entrada.
import { Game } from './core/Game.js';

const game = new Game();
window.__pf = game;
game.boot().catch((err) => {
  console.error(err);
  document.getElementById('ui').innerHTML = `<div class="fatal">Não foi possível iniciar o jogo.<br><small>${err.message}</small></div>`;
});
