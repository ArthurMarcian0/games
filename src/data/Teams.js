// Equipes fictícias. Nenhum nome, marca ou uniforme real é utilizado.
// Estrutura preparada para futuras expansões (campeonatos, elencos, etc).
import { pick, rand } from '../core/MathUtils.js';

export const SKIN_TONES = ['#f1c9a5', '#e0ac7e', '#c68857', '#a5683f', '#8a5634', '#6b4128', '#4a2c1c'];
export const HAIR_COLORS = ['#1b1209', '#2f1e10', '#5a3a1e', '#8c5a2b', '#c99a5b', '#e3c27a', '#b33a1e', '#9aa0a6'];
export const HAIR_STYLES = ['short', 'buzz', 'afro', 'mohawk', 'bun', 'braids', 'bald', 'long'];
export const HAIR_STYLE_LABELS = {
  short: 'Curto',
  buzz: 'Raspado',
  afro: 'Black power',
  mohawk: 'Moicano',
  bun: 'Coque',
  braids: 'Tranças',
  bald: 'Careca',
  long: 'Longo',
};
export const BEARDS = ['none', 'stubble', 'goatee', 'full'];
export const BEARD_LABELS = { none: 'Nenhuma', stubble: 'Por fazer', goatee: 'Cavanhaque', full: 'Cheia' };
export const EYE_COLORS = ['#3b2414', '#5b3a1a', '#2f6f3e', '#3a6ea5', '#6b6b6b'];

export const ARCHETYPES = {
  guard: {
    label: 'Armador',
    attrs: { speed: 88, shooting: 80, three: 82, finishing: 72, passing: 88, defense: 70, rebound: 55, stamina: 86 },
    height: 1.88,
  },
  wing: {
    label: 'Ala',
    attrs: { speed: 80, shooting: 82, three: 76, finishing: 80, passing: 72, defense: 78, rebound: 68, stamina: 82 },
    height: 1.98,
  },
  big: {
    label: 'Pivô',
    attrs: { speed: 68, shooting: 70, three: 50, finishing: 90, passing: 64, defense: 84, rebound: 90, stamina: 76 },
    height: 2.1,
  },
};

const FIRST = ['Caio', 'Rafael', 'Diego', 'Bruno', 'Thiago', 'Lucas', 'Mateus', 'André', 'Igor', 'Vitor', 'Renan', 'Otávio', 'Davi', 'Samuel', 'Nicolas', 'Heitor', 'Enzo', 'Gael', 'Murilo', 'Breno', 'Yuri', 'Tomás', 'Iago', 'Levi', 'Ruan'];
const LAST = ['Arantes', 'Bastos', 'Correia', 'Duarte', 'Esteves', 'Farias', 'Galvão', 'Holanda', 'Leme', 'Macedo', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Valadares', 'Xavier', 'Moura', 'Brandão', 'Coutinho', 'Prates'];

export const TEAMS = [
  {
    id: 'tubaroes',
    name: 'Tubarões do Atlântico',
    abbr: 'TUB',
    primary: '#1666c5',
    secondary: '#f4f7fb',
    accent: '#ffc928',
    rating: 80,
  },
  {
    id: 'fenix',
    name: 'Fênix Rubra',
    abbr: 'FNX',
    primary: '#c4262e',
    secondary: '#1d1d22',
    accent: '#ffb02e',
    rating: 81,
  },
  {
    id: 'lobos',
    name: 'Lobos da Serra',
    abbr: 'LOB',
    primary: '#34444f',
    secondary: '#c9d4db',
    accent: '#22d3ee',
    rating: 79,
  },
  {
    id: 'jaguares',
    name: 'Jaguares do Cerrado',
    abbr: 'JAG',
    primary: '#1f7a3a',
    secondary: '#f1d23b',
    accent: '#ffffff',
    rating: 78,
  },
  {
    id: 'trovoes',
    name: 'Trovões do Norte',
    abbr: 'TRV',
    primary: '#6a2ea0',
    secondary: '#ffffff',
    accent: '#f472b6',
    rating: 80,
  },
];

const JERSEY_NUMBERS = [0, 1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 21, 22, 23, 24, 30, 32, 33, 34, 44, 55, 77];
const ROSTER_ARCHETYPES = ['guard', 'wing', 'big', 'guard', 'wing', 'big', 'wing'];

function randomAppearance(archetype) {
  const base = ARCHETYPES[archetype].height;
  return {
    skin: pick(SKIN_TONES),
    height: +(base + rand(-0.06, 0.06)).toFixed(2),
    build: +rand(0.92, 1.1).toFixed(2),
    hairStyle: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLORS.slice(0, 6)),
    beard: pick(BEARDS),
    eyeColor: pick(EYE_COLORS),
    faceWidth: +rand(0.92, 1.08).toFixed(2),
    headband: Math.random() < 0.25,
    shoeColor: pick(['#ffffff', '#111111', '#e53935', '#1e88e5', '#fdd835', '#43a047']),
  };
}

function jitterAttrs(attrs, rating) {
  const out = {};
  const shift = rating - 80;
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = Math.max(40, Math.min(99, Math.round(v + shift + rand(-6, 6))));
  }
  return out;
}

// Gera um elenco determinístico por sessão (cache) para cada equipe
const rosterCache = new Map();

export function getRoster(team) {
  if (rosterCache.has(team.id)) return rosterCache.get(team.id);
  const used = new Set();
  const roster = ROSTER_ARCHETYPES.map((arch) => {
    let name;
    do {
      name = `${pick(FIRST)} ${pick(LAST)}`;
    } while (used.has(name));
    used.add(name);
    const number = pick(JERSEY_NUMBERS);
    return {
      name,
      number,
      archetype: arch,
      attrs: jitterAttrs(ARCHETYPES[arch].attrs, team.rating),
      appearance: randomAppearance(arch),
    };
  });
  // garante números únicos
  const nums = new Set();
  for (const p of roster) {
    while (nums.has(p.number)) p.number = (p.number + 1) % 100;
    nums.add(p.number);
  }
  rosterCache.set(team.id, roster);
  return roster;
}

// Escolhe os titulares conforme o tamanho do time (1 a 5 jogadores)
export function getLineup(team, size) {
  const roster = getRoster(team);
  const order = {
    1: [0],
    2: [0, 2],
    3: [0, 1, 2],
    4: [0, 1, 4, 2],
    5: [0, 3, 1, 4, 2],
  }[size] || [0, 1, 2];
  return order.map((i) => roster[i]);
}

export function getTeam(id) {
  return TEAMS.find((t) => t.id === id) || TEAMS[0];
}
