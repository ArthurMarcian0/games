// Catálogo de dribles. Cada movimento define duração, troca de mão, impulso
// (em metros/s, relativo à direção do atleta), proteção da bola contra roubos,
// poder de desequilibrar o marcador e custo de energia.
//
//   lateral  > 0 empurra para o lado da mão que fica com a bola
//   forward  > 0 empurra para frente (< 0 para trás)
//   protect  multiplica a chance de roubo durante o movimento (menor = mais seguro)
//   ankle    multiplica a chance de desequilibrar o marcador
export const DRIBBLE_MOVES = {
  crossover: {
    label: 'Crossover',
    duration: 0.38,
    switchAt: 0.18,
    switchHand: true,
    lateral: 3.4,
    forward: 0.6,
    control: 0.75,
    protect: 0.6,
    ankle: 1.0,
    cost: 0.012,
    cooldown: 0.5,
  },
  inOut: {
    label: 'Finta in-and-out',
    duration: 0.36,
    switchAt: null,
    switchHand: false,
    lateral: 2.9,
    forward: 0.8,
    control: 0.75,
    protect: 0.7,
    ankle: 0.85,
    cost: 0.01,
    cooldown: 0.45,
  },
  behindBack: {
    label: 'Por trás das costas',
    duration: 0.44,
    switchAt: 0.24,
    switchHand: true,
    lateral: 2.8,
    forward: 2.2,
    control: 0.8,
    protect: 0.45,
    ankle: 0.95,
    cost: 0.014,
    cooldown: 0.55,
  },
  betweenLegs: {
    label: 'Entre as pernas',
    duration: 0.4,
    switchAt: 0.2,
    switchHand: true,
    lateral: 0.9,
    forward: -0.4,
    control: 0.45,
    protect: 0.35,
    ankle: 0.55,
    cost: 0.008,
    cooldown: 0.4,
  },
  spin: {
    label: 'Giro',
    duration: 0.56,
    switchAt: 0.42,
    switchHand: true,
    lateral: 2.6,
    forward: 2.4,
    control: 0.3,
    protect: 0.8,
    ankle: 1.55,
    cost: 0.022,
    cooldown: 0.85,
  },
  hesitation: {
    label: 'Hesitação',
    duration: 0.52,
    switchAt: null,
    switchHand: false,
    lateral: 0,
    forward: 0,
    control: 0.25,
    burstAt: 0.28,
    burstPush: 3.2,
    burstMul: 1.32,
    burstTime: 0.75,
    protect: 0.75,
    ankle: 0.8,
    cost: 0.012,
    cooldown: 0.7,
  },
  stepback: {
    label: 'Step-back',
    duration: 0.46,
    switchAt: null,
    switchHand: false,
    lateral: 0,
    forward: -4.3,
    hop: 1.7,
    control: 0,
    protect: 0.7,
    ankle: 0.3,
    cost: 0.016,
    cooldown: 0.75,
  },
};

export const COMBO_WINDOW = 0.55; // s após o fim de um drible para encadear outro

export function getMove(kind) {
  return DRIBBLE_MOVES[kind] || DRIBBLE_MOVES.crossover;
}

/**
 * Escolhe o drible a partir da direção do comando, relativa ao atleta.
 *   fwd/side: componentes da direção (side > 0 = direita do atleta)
 *   hand: mão atual da bola (1 = direita, -1 = esquerda)
 *   sprint: correndo
 *   spin: botão de giro
 * Retorna { kind, side } onde side é o lado para onde o atleta vai.
 */
export function chooseMove({ fwd, side, hand, sprint, spin }) {
  const mag = Math.hypot(fwd, side);
  if (spin) {
    // giro para o lado pedido ou, sem direção, para o lado da mão livre
    const s = mag > 0.2 && Math.abs(side) > 0.15 ? Math.sign(side) : -hand;
    return { kind: 'spin', side: s };
  }
  if (mag < 0.2) return { kind: 'betweenLegs', side: -hand };
  const nf = fwd / mag;
  const ns = side / mag;
  if (nf < -0.55) return { kind: 'stepback', side: hand };
  if (Math.abs(ns) < 0.45) return { kind: 'hesitation', side: hand };
  const s = Math.sign(ns);
  if (s === hand) return { kind: 'inOut', side: s };
  return { kind: sprint ? 'behindBack' : 'crossover', side: s };
}
