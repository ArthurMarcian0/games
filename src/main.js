import { Game } from './core/Game.js';

// Ponto de entrada. Parâmetros de depuração opcionais:
//   ?speed=4  acelera a simulação
const params = new URLSearchParams(location.search);
try {
  const game = new Game({ timeScale: parseFloat(params.get('speed')) || 1 });
  window.__game = game;
} catch (e) {
  console.error(e);
  const msg = /WebGL/i.test(String(e && e.message))
    ? 'Não foi possível criar o contexto <b>WebGL</b> (gráficos 3D).<br>Ative a <b>aceleração de hardware</b> no navegador ou atualize o driver de vídeo.'
    : 'Erro ao iniciar o jogo:<br><code>' + String((e && e.message) || e).replace(/</g, '&lt;') + '</code>';
  if (window.__bootFail) window.__bootFail(msg);
}
