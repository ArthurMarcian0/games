// Perfil do jogador personalizado. Inclui campos de progressão (nível/xp)
// para a futura evolução de atributos.
import { ARCHETYPES } from './Teams.js';

const KEY = 'skyhoop.profile.v1';

export function defaultProfile() {
  return {
    name: 'Você',
    number: 7,
    archetype: 'wing',
    appearance: {
      skin: '#c68857',
      height: 1.96,
      build: 1.0,
      hairStyle: 'short',
      hairColor: '#1b1209',
      beard: 'stubble',
      eyeColor: '#3b2414',
      faceWidth: 1.0,
      headband: false,
      shoeColor: '#ffffff',
    },
    // Progressão (estrutura para evolução futura de atributos)
    level: 1,
    xp: 0,
    bonusAttrs: {},
  };
}

export function profileAttrs(profile) {
  const base = ARCHETYPES[profile.archetype]?.attrs || ARCHETYPES.wing.attrs;
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.min(99, v + 2 + (profile.bonusAttrs?.[k] || 0));
  return out;
}

export function loadProfile() {
  const p = defaultProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(p, saved);
      p.appearance = { ...defaultProfile().appearance, ...(saved.appearance || {}) };
    }
  } catch (e) {
    /* ignora */
  }
  return p;
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch (e) {
    /* ignora */
  }
}

// Converte o perfil para o formato de jogador usado nas partidas
export function profileToPlayerData(profile) {
  return {
    name: profile.name || 'Você',
    number: profile.number,
    archetype: profile.archetype,
    attrs: profileAttrs(profile),
    appearance: { ...profile.appearance },
    isCustom: true,
  };
}
