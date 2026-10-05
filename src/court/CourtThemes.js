// Temas de quadra. Novas quadras podem ser adicionadas aqui sem alterar
// o restante do código (base para "diferentes quadras").
export const COURT_THEMES = {
  arena: {
    id: 'arena',
    name: 'Arena Central',
    woodBase: [186, 128, 76],
    woodVar: 26,
    apron: '#7a2a1c',
    paint: 'rgba(22, 74, 160, 0.82)',
    centerFill: 'rgba(22, 74, 160, 0.9)',
    lines: '#ffffff',
    centerText: 'SKYHOOP',
    baselineText: 'ARENA CENTRAL',
    standColor: '#1c2230',
    seatColors: ['#24324f', '#2b3c60'],
    padColor: '#1458b8',
    wallColor: '#0d1018',
  },
  classic: {
    id: 'classic',
    name: 'Ginásio Clássico',
    woodBase: [220, 176, 120],
    woodVar: 20,
    apron: '#1f5a36',
    paint: 'rgba(31, 110, 60, 0.85)',
    centerFill: 'rgba(31, 110, 60, 0.9)',
    lines: '#fafafa',
    centerText: 'CLÁSSICO',
    baselineText: 'GINÁSIO MUNICIPAL',
    standColor: '#2a2a2a',
    seatColors: ['#3a5a40', '#2f4733'],
    padColor: '#1f6e3c',
    wallColor: '#141414',
  },
};

export function getTheme(id) {
  return COURT_THEMES[id] || COURT_THEMES.arena;
}
