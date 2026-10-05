// Dimensões oficiais (FIBA) em metros e constantes globais de simulação.
// O eixo X percorre o comprimento da quadra, Z a largura e Y é a altura.

export const COURT = {
  length: 28,
  width: 15,
  halfL: 14,
  halfW: 7.5,
  rimHeight: 3.05,
  rimRadius: 0.225,
  rimTube: 0.018,
  basketX: 12.425, // centro do aro (1,575 m da linha de fundo)
  boardX: 12.8, // face da tabela (1,2 m da linha de fundo)
  boardHalfW: 0.9,
  boardBottom: 2.9,
  boardTop: 3.95,
  boardThick: 0.05,
  threeRadius: 6.75,
  threeSideZ: 6.6,
  keyHalfW: 2.45,
  ftLineX: 8.2, // linha de lance livre (5,8 m da linha de fundo)
  ftCircleR: 1.8,
  centerCircleR: 1.8,
  restrictedR: 1.25,
};

export const BALL = {
  radius: 0.12,
  restitution: 0.78,
  rimRestitution: 0.55,
  boardRestitution: 0.62,
  floorFriction: 0.86,
};

export const GRAVITY = 9.81;

export const PLAYER = {
  radius: 0.36,
  walkSpeed: 3.4,
  runSpeed: 6.4,
  accel: 26,
  decel: 20,
  turnRate: 12,
  jumpVel: 3.6,
  catchRadius: 0.75,
  stealRange: 1.45,
};

export const SHOT = {
  meterTime: 0.95, // tempo para encher a barra (s)
  sweetSpot: 0.82,
  perfectWindow: 0.045,
  goodWindow: 0.13,
  jumpAt: 0.42, // ponto da barra em que o jogador salta
  pumpFake: 0.14, // soltar antes disso cancela (finta)
  layupRange: 2.9,
  dunkRange: 2.4,
};

export const MATCH = {
  shotClock: 24,
  offRebShotClock: 14,
  bonusFouls: 5,
};

export const TEAM_HOME = 0;
export const TEAM_AWAY = 1;
