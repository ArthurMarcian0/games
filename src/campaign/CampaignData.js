// Campanha "Terra Arrasada": o mundo acabou, as gangues disputam as últimas
// quadras de pé e quem domina a quadra domina o território. Cada fase é uma
// partida contra uma gangue numa quadra pós-apocalíptica (CourtThemes.js),
// ficando mais difícil a cada vitória.
//
//   tier       0..1 → interpola o perfil da IA de "fácil" até além de "difícil"
//   rating     força dos atributos da gangue adversária (80 = padrão)
//   modifiers  regras especiais da quadra (vento na bola, piso escorregadio,
//              ar tóxico que cansa mais rápido)
//   reward     pontos de atributo dados ao jogador na primeira vitória

export const CAMPAIGN_TITLE = 'Terra Arrasada';
export const CAMPAIGN_INTRO =
  'Depois do colapso, as cidades viraram ruína e as gangues disputam as últimas quadras de pé. ' +
  'Aqui, quem domina a quadra domina o território. Junte sua equipe, os Errantes, e conquiste ' +
  'uma quadra por vez até a Cidadela.';

// Sua equipe: começa fraca e recruta jogadores melhores a cada quadra dominada
export const HOME_CREW = {
  id: 'errantes',
  name: 'Os Errantes',
  abbr: 'ERR',
  primary: '#d9822b',
  secondary: '#22252b',
  accent: '#f2e3c6',
  rating: 74,
  names: ['Bento Rocha', 'Zeca Faísca', 'Tião Ventania', 'Dora Lima', 'Juca Brasa', 'Nina Poeira', 'Rui Martelo'],
};

export const STAGES = [
  {
    id: 'junkyard',
    court: 'junkyard',
    title: 'Pátio do Ferro-Velho',
    region: 'Periferia Leste',
    story: 'Carros empilhados, sol de poeira e uma tabela de compensado. Os Catadores acham que a quadra é deles. Mostre que não é.',
    team: { id: 'catadores', name: 'Os Catadores', abbr: 'CAT', primary: '#8a6a3a', secondary: '#2a2420', accent: '#e0c080', rating: 70, names: ['Prego', 'Lata', 'Ferrugem', 'Parafuso', 'Sucata', 'Arame', 'Pino'] },
    teamSize: 2,
    quarters: 2,
    quarterLength: 1.5,
    tier: 0.0,
    modifiers: [],
    reward: { speed: 2, shooting: 1 },
  },
  {
    id: 'overpass',
    court: 'overpass',
    title: 'Viaduto Desabado',
    region: 'Rodovia Norte',
    story: 'Embaixo do viaduto partido, os Ratos do Asfalto jogam rápido e roubam qualquer bola solta. Proteja a bola com dribles.',
    team: { id: 'ratos', name: 'Ratos do Asfalto', abbr: 'RAT', primary: '#5a5a62', secondary: '#e0c040', accent: '#e0c040', rating: 74, names: ['Rato', 'Pixe', 'Faixa', 'Buraco', 'Guincho', 'Retrovisor', 'Pneu'] },
    teamSize: 3,
    quarters: 2,
    quarterLength: 2,
    tier: 0.18,
    modifiers: [],
    reward: { passing: 2, three: 1 },
  },
  {
    id: 'port',
    court: 'port',
    title: 'Porto Enferrujado',
    region: 'Cais 9',
    story: 'Chuva fina, contêineres tombados e o piso molhado. A Maré Negra adora ver o adversário escorregar.',
    team: { id: 'mare', name: 'Maré Negra', abbr: 'MAR', primary: '#1d3f5a', secondary: '#d8e0e6', accent: '#3ab0d0', rating: 77, names: ['Âncora', 'Maresia', 'Guindaste', 'Casco', 'Corrente', 'Lodo', 'Farol'] },
    teamSize: 3,
    quarters: 4,
    quarterLength: 1.5,
    tier: 0.33,
    modifiers: ['wet'],
    reward: { finishing: 2, rebound: 1 },
  },
  {
    id: 'toxic',
    court: 'toxic',
    title: 'Zona Química',
    region: 'Setor Industrial',
    story: 'O ar verde queima os pulmões: todo mundo cansa mais rápido. Os Contaminados já se acostumaram. Você não.',
    team: { id: 'contaminados', name: 'Os Contaminados', abbr: 'CNT', primary: '#c9b51c', secondary: '#2a3a1a', accent: '#9aff4a', rating: 80, names: ['Ácido', 'Mofo', 'Vapor', 'Neon', 'Esporo', 'Chumbo', 'Cloro'] },
    teamSize: 3,
    quarters: 4,
    quarterLength: 2,
    tier: 0.48,
    modifiers: ['toxic'],
    reward: { stamina: 3 },
  },
  {
    id: 'ash',
    court: 'ash',
    title: 'Cidade Cinza',
    region: 'Centro Antigo',
    story: 'Cinzas caem sem parar entre os prédios tortos. A Legião das Cinzas marca forte e não perdoa erro de passe.',
    team: { id: 'legiao', name: 'Legião das Cinzas', abbr: 'LEG', primary: '#3a3a3a', secondary: '#c0281e', accent: '#d8d4cc', rating: 82, names: ['Brasa', 'Fuligem', 'Carvão', 'Pavio', 'Cinzel', 'Tição', 'Lápide'] },
    teamSize: 4,
    quarters: 4,
    quarterLength: 2,
    tier: 0.62,
    modifiers: [],
    reward: { defense: 2, shooting: 1 },
  },
  {
    id: 'plant',
    court: 'plant',
    title: 'Usina Fantasma',
    region: 'Reator 4',
    story: 'À noite, sob as torres de resfriamento, só os holofotes iluminam a quadra. Os Faíscas são rápidos como curto-circuito.',
    team: { id: 'faiscas', name: 'Os Faíscas', abbr: 'FAI', primary: '#2a3a8a', secondary: '#9ad0ff', accent: '#ffe04a', rating: 84, names: ['Volt', 'Ampere', 'Curto', 'Raio', 'Bobina', 'Fusível', 'Ohm'] },
    teamSize: 4,
    quarters: 4,
    quarterLength: 2,
    tier: 0.76,
    modifiers: [],
    reward: { speed: 2, three: 2 },
  },
  {
    id: 'desert',
    court: 'desert',
    title: 'Deserto de Vidro',
    region: 'Estrada 66',
    story: 'A tempestade de areia empurra a bola no ar e a areia no piso tira a firmeza dos pés. Os Nômades jogam aqui desde sempre.',
    team: { id: 'nomades', name: 'Nômades da Tempestade', abbr: 'NOM', primary: '#a0602a', secondary: '#f0d8a8', accent: '#3a2a1a', rating: 86, names: ['Duna', 'Miragem', 'Siroco', 'Cacto', 'Areia', 'Escorpião', 'Oásis'] },
    teamSize: 5,
    quarters: 4,
    quarterLength: 2,
    tier: 0.88,
    modifiers: ['wind', 'sand'],
    reward: { finishing: 2, passing: 2 },
  },
  {
    id: 'citadel',
    court: 'citadel',
    title: 'A Cidadela',
    region: 'Trono de Sucata',
    story: 'A última quadra. Os Soberanos nunca perderam em casa e a multidão inteira está contra você. Vença e a Terra Arrasada é sua.',
    team: { id: 'soberanos', name: 'Os Soberanos', abbr: 'SOB', primary: '#7a0a0a', secondary: '#d4a020', accent: '#f4d9a0', rating: 89, names: ['Rei Ferro', 'Duque', 'Barão', 'Coroa', 'Cetro', 'Trono', 'Regente'] },
    teamSize: 5,
    quarters: 4,
    quarterLength: 2.5,
    tier: 1.0,
    modifiers: ['hostile'],
    reward: { shooting: 3, three: 3, defense: 3 },
  },
];

// Descrição dos modificadores (efeitos aplicados em CampaignMode)
export const MODIFIERS = {
  wet: { label: 'Piso molhado', desc: 'menos aderência: acelerar e frear demora mais', grip: 0.78 },
  toxic: { label: 'Ar tóxico', desc: 'a energia acaba mais rápido', drain: 1.7 },
  wind: { label: 'Tempestade', desc: 'o vento desvia a bola no ar', wind: { x: 0.9, z: 0.45 } },
  sand: { label: 'Areia no piso', desc: 'menos aderência', grip: 0.85 },
  hostile: { label: 'Torcida hostil', desc: 'a pressão deixa os arremessos do seu time menos precisos', homeShotSigma: 0.025 },
};

export const ATTR_NAMES = {
  speed: 'Velocidade',
  shooting: 'Arremesso',
  three: '3 pontos',
  finishing: 'Finalização',
  passing: 'Passe',
  defense: 'Defesa',
  rebound: 'Rebote',
  stamina: 'Resistência',
};

export function getStage(id) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}

export function stageIndex(id) {
  return STAGES.findIndex((s) => s.id === id);
}

// Estrelas pela margem de vitória
export function starsFor(margin) {
  if (margin <= 0) return 0;
  if (margin >= 10) return 3;
  if (margin >= 5) return 2;
  return 1;
}

export function rewardText(reward) {
  return Object.entries(reward)
    .map(([k, v]) => `+${v} ${ATTR_NAMES[k]}`)
    .join(' • ');
}
