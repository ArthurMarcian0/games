import { Game } from './core/Game.js';

// Ponto de entrada. Parâmetros de depuração opcionais:
//   ?speed=4  acelera a simulação
const params = new URLSearchParams(location.search);
const game = new Game({ timeScale: parseFloat(params.get('speed')) || 1 });
window.__game = game;
