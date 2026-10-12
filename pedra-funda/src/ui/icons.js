// Ícones de itens desenhados em canvas (sem arquivos externos).
const cache = new Map();

function draw(id, ctx, s) {
  const c = s / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const leaf = (x, y, r, a, col) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    ctx.restore();
  };
  const box = (x, y, w, h, col, edge = 'rgba(0,0,0,0.5)') => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  };
  const vial = (col) => {
    ctx.fillStyle = 'rgba(220,230,235,0.25)';
    ctx.fillRect(c - 7, s * 0.2, 14, s * 0.6);
    ctx.fillStyle = col;
    ctx.fillRect(c - 6, s * 0.4, 12, s * 0.39);
    ctx.fillStyle = '#222';
    ctx.fillRect(c - 8, s * 0.15, 16, 8);
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.fillStyle = col;
    ctx.fillRect(c - 6, s * 0.4, 12, 4);
    ctx.shadowBlur = 0;
  };
  const key = (tag) => {
    ctx.strokeStyle = '#c8c4b0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(s * 0.32, c, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.32 + 9, c);
    ctx.lineTo(s * 0.8, c);
    ctx.moveTo(s * 0.72, c);
    ctx.lineTo(s * 0.72, c + 9);
    ctx.moveTo(s * 0.8, c);
    ctx.lineTo(s * 0.8, c + 7);
    ctx.stroke();
    ctx.fillStyle = tag;
    ctx.fillRect(s * 0.18, c + 12, 16, 10);
  };
  switch (id) {
    case 'herb':
      leaf(c - 8, c + 2, 14, -0.5, '#3f8a34');
      leaf(c + 8, c + 2, 14, 0.5, '#4a9a3a');
      leaf(c, c - 6, 15, 0, '#367a2e');
      break;
    case 'herb_mix':
      leaf(c - 10, c + 4, 13, -0.6, '#3f8a34');
      leaf(c + 10, c + 4, 13, 0.6, '#5aa040');
      leaf(c - 4, c - 6, 14, -0.15, '#367a2e');
      leaf(c + 4, c - 6, 14, 0.15, '#4a9a3a');
      break;
    case 'medicine':
      box(c - 12, s * 0.28, 24, s * 0.5, '#d8d4c8');
      box(c - 8, s * 0.2, 16, 8, '#333');
      ctx.fillStyle = '#b81c1c';
      ctx.fillRect(c - 3, s * 0.4, 6, 16);
      ctx.fillRect(c - 8, s * 0.4 + 5, 16, 6);
      break;
    case 'chem':
      vial('#3a7ad8');
      break;
    case 'bandage':
      ctx.fillStyle = '#e8e4da';
      ctx.beginPath();
      ctx.arc(c, c, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8b4aa';
      ctx.beginPath();
      ctx.arc(c, c, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(c + 6, c + 6, 16, 8);
      break;
    case 'firstaid':
      box(s * 0.2, s * 0.3, s * 0.6, s * 0.45, '#e0dcd0');
      ctx.fillStyle = '#c01818';
      ctx.fillRect(c - 3, s * 0.36, 6, s * 0.32);
      ctx.fillRect(s * 0.37, c - 1, s * 0.26, 6);
      break;
    case 'ammo_pistol':
      box(s * 0.22, s * 0.38, s * 0.56, s * 0.36, '#9a7a24');
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#c8a040';
        ctx.fillRect(s * 0.27 + i * 9, s * 0.24, 6, 12);
        ctx.fillStyle = '#7a5a20';
        ctx.fillRect(s * 0.27 + i * 9, s * 0.2, 6, 5);
      }
      break;
    case 'ammo_shotgun':
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#a82418';
        ctx.fillRect(s * 0.25 + i * 11, s * 0.28, 9, s * 0.38);
        ctx.fillStyle = '#c8a040';
        ctx.fillRect(s * 0.25 + i * 11, s * 0.6, 9, 8);
      }
      break;
    case 'gunpowder':
      ctx.fillStyle = '#7a6a4a';
      ctx.beginPath();
      ctx.ellipse(c, c + 5, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a4a32';
      ctx.fillRect(c - 5, c - 12, 10, 8);
      break;
    case 'pistol':
      ctx.fillStyle = '#2a2c30';
      ctx.fillRect(s * 0.18, s * 0.34, s * 0.6, 11);
      ctx.save();
      ctx.translate(s * 0.28, s * 0.46);
      ctx.rotate(0.25);
      ctx.fillStyle = '#3a3028';
      ctx.fillRect(0, 0, 11, 20);
      ctx.restore();
      break;
    case 'shotgun':
      ctx.fillStyle = '#2a2c30';
      ctx.fillRect(s * 0.25, s * 0.42, s * 0.65, 6);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(s * 0.05, s * 0.44, s * 0.28, 9);
      ctx.fillRect(s * 0.45, s * 0.5, s * 0.18, 6);
      break;
    case 'pipe':
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(-0.7);
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(-s * 0.36, -4, s * 0.72, 8);
      ctx.fillStyle = '#111';
      ctx.fillRect(-s * 0.36, -5, 12, 10);
      ctx.restore();
      break;
    case 'bolt_cutter':
      ctx.strokeStyle = '#3a3c40';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s * 0.2, s * 0.25);
      ctx.lineTo(s * 0.55, s * 0.6);
      ctx.moveTo(s * 0.32, s * 0.2);
      ctx.lineTo(s * 0.6, s * 0.55);
      ctx.stroke();
      ctx.strokeStyle = '#b02a1a';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(s * 0.55, s * 0.6);
      ctx.lineTo(s * 0.72, s * 0.85);
      ctx.moveTo(s * 0.6, s * 0.55);
      ctx.lineTo(s * 0.85, s * 0.72);
      ctx.stroke();
      break;
    case 'key_chief':
      key('#6a4a2a');
      break;
    case 'key_eastgate':
      key('#3a5a8a');
      break;
    case 'key_pharmacy':
      key('#2a8a3a');
      break;
    case 'fuse':
      box(s * 0.22, c - 8, s * 0.56, 16, '#e0dccf');
      ctx.fillStyle = '#b8b8b8';
      ctx.fillRect(s * 0.14, c - 9, 8, 18);
      ctx.fillRect(s * 0.78, c - 9, 8, 18);
      break;
    case 'card_exit':
      box(s * 0.18, s * 0.3, s * 0.64, s * 0.4, '#2a5a9a');
      ctx.fillStyle = '#d8c060';
      ctx.fillRect(s * 0.26, s * 0.4, 10, 8);
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(s * 0.45, s * 0.42, 20, 3);
      ctx.fillRect(s * 0.45, s * 0.5, 14, 3);
      break;
    case 'valve_wheel':
    case 'valve':
      ctx.strokeStyle = '#b02a1a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(c, c, 15, 0, Math.PI * 2);
      ctx.moveTo(c - 15, c);
      ctx.lineTo(c + 15, c);
      ctx.moveTo(c, c - 15);
      ctx.lineTo(c, c + 15);
      ctx.stroke();
      if (id === 'valve') {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(c - 3, c, 6, s * 0.45);
      }
      break;
    case 'valve_rod':
      ctx.fillStyle = '#c8c8c8';
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(0.7);
      ctx.fillRect(-3, -s * 0.38, 6, s * 0.76);
      ctx.fillStyle = '#8a8a8a';
      for (let i = 0; i < 6; i++) ctx.fillRect(-4, s * 0.1 + i * 4, 8, 2);
      ctx.restore();
      break;
    case 'sample_blue':
      vial('#2a70ff');
      break;
    case 'sample_amber':
      vial('#ffa020');
      break;
    case 'sample_red':
      vial('#ff2020');
      break;
    case 'pouch':
      box(s * 0.25, s * 0.35, s * 0.5, s * 0.35, '#5a5040');
      break;
    default:
      box(s * 0.3, s * 0.3, s * 0.4, s * 0.4, '#777');
  }
}

export function iconURL(id) {
  if (cache.has(id)) return cache.get(id);
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  draw(id, ctx, s);
  const url = cv.toDataURL();
  cache.set(id, url);
  return url;
}

// símbolos da porta da mina (SVG)
export const SYMBOLS = {
  LUA: '<svg viewBox="0 0 40 40"><path d="M26 6a14 14 0 1 0 0 28a11 11 0 1 1 0-28z" fill="currentColor"/></svg>',
  OLHO: '<svg viewBox="0 0 40 40"><path d="M3 20q17-16 34 0q-17 16-34 0z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="currentColor"/></svg>',
  SERPENTE: '<svg viewBox="0 0 40 40"><path d="M30 6q-14 0-14 8t12 8t-2 12q-6 2-16-2" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="30" cy="6" r="3" fill="currentColor"/></svg>',
  RAIZ: '<svg viewBox="0 0 40 40"><path d="M20 4v16M20 20l-10 14M20 20l10 14M20 26l-4 10M20 26l4 10M14 30l-8 2M26 30l8 2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  MAO: '<svg viewBox="0 0 40 40"><path d="M12 36V18M17 36V8M22 36V7M27 36V10M32 36V20M12 36h20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  SOL: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="7" fill="currentColor"/><path d="M20 3v6M20 31v6M3 20h6M31 20h6M8 8l4 4M28 28l4 4M32 8l-4 4M12 28l-4 4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
};
export const SYMBOL_NAMES = { LUA: 'Lua', OLHO: 'Olho', SERPENTE: 'Serpente', RAIZ: 'Raiz', MAO: 'Mão', SOL: 'Sol' };
