// Parâmetros de dificuldade da IA. Cada valor é usado diretamente pelos
// controladores de IA e pelo modelo de arremesso.
export const DIFFICULTY = {
  easy: {
    id: 'easy',
    label: 'Fácil',
    speed: 0.84, // multiplicador de velocidade
    reaction: 0.55, // segundos entre decisões
    shotTiming: 0.11, // desvio do tempo de soltura na barra
    shotSigma: 0.06, // erro extra de arremesso (m)
    stealRate: 0.02,
    stealSkill: 0.6,
    blockRate: 0.2,
    contestDist: 1.6,
    defenseGap: 1.9,
    positionError: 1.1,
    passError: 0.5,
    decision: 0.55, // qualidade das escolhas (0..1)
    foulRate: 1.3,
    interceptSkill: 0.4,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    speed: 0.95,
    reaction: 0.33,
    shotTiming: 0.07,
    shotSigma: 0.025,
    stealRate: 0.028,
    stealSkill: 0.85,
    blockRate: 0.32,
    contestDist: 2.0,
    defenseGap: 1.4,
    positionError: 0.55,
    passError: 0.25,
    decision: 0.75,
    foulRate: 1.0,
    interceptSkill: 0.7,
  },
  hard: {
    id: 'hard',
    label: 'Difícil',
    speed: 1.03,
    reaction: 0.18,
    shotTiming: 0.045,
    shotSigma: 0.0,
    stealRate: 0.05,
    stealSkill: 1.1,
    blockRate: 0.45,
    contestDist: 2.4,
    defenseGap: 1.05,
    positionError: 0.2,
    passError: 0.1,
    decision: 0.92,
    foulRate: 0.75,
    interceptSkill: 1.0,
  },
};

// Perfil usado pelos companheiros de equipe controlados pela IA do jogador humano
export const TEAMMATE_PROFILE = { ...DIFFICULTY.normal, id: 'teammate' };

export function getDifficulty(id) {
  return DIFFICULTY[id] || DIFFICULTY.normal;
}
