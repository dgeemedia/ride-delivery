// mobile/src/theme/theme.js
// Diakite — monochrome only, extracted directly from brand logo
// Dark: white mark on deep black | Light: black mark on warm cream

export const ACCENT_COLORS = {

  // ── Onyx — white on deep black (logo dark side) ─────────────────────────
  onyx: {
    id: 'onyx',
    name: 'Onyx',
    emoji: '◼',
    accent: '#FFFFFF',
    dark: {
      background:    '#111111',
      backgroundAlt: '#1A1A1A',
      card:          '#161616',
      border:        '#2A2A2A',
      pill:          '#1D1D1D',
      pillBorder:    '#FFFFFF18',
      accent:        '#FFFFFF',
      foreground:    '#F2EEE6',
      muted:         '#6A6A6A',
      hint:          '#333333',
      shadow:        '#FFFFFF',
    },
    light: {
      background:    '#EAE5DA',
      backgroundAlt: '#F4F0E8',
      card:          '#F8F5EF',
      border:        '#D4CCC0',
      pill:          '#E0D8C8',
      pillBorder:    '#11111118',
      accent:        '#111111',
      foreground:    '#0F0D0A',
      muted:         '#5A5248',
      hint:          '#A89C88',
      shadow:        '#111111',
    },
  },

  // ── Chalk — cream on deep black (inverted logo warmth) ──────────────────
  chalk: {
    id: 'chalk',
    name: 'Chalk',
    emoji: '◻',
    accent: '#EAE5DA',
    dark: {
      background:    '#111111',
      backgroundAlt: '#191919',
      card:          '#161616',
      border:        '#2A2A2A',
      pill:          '#1D1D1D',
      pillBorder:    '#EAE5DA18',
      accent:        '#EAE5DA',
      foreground:    '#F2EEE6',
      muted:         '#6A6A6A',
      hint:          '#333333',
      shadow:        '#EAE5DA',
    },
    light: {
      background:    '#EAE5DA',
      backgroundAlt: '#F4F0E8',
      card:          '#F8F5EF',
      border:        '#D4CCC0',
      pill:          '#E0D8C8',
      pillBorder:    '#11111118',
      accent:        '#2A2520',
      foreground:    '#0F0D0A',
      muted:         '#5A5248',
      hint:          '#A89C88',
      shadow:        '#2A2520',
    },
  },

};

export const DEFAULT_ACCENT = 'onyx';
export const DEFAULT_MODE   = 'dark';

export function getTheme(accentId = DEFAULT_ACCENT, mode = DEFAULT_MODE) {
  const base = ACCENT_COLORS[accentId] || ACCENT_COLORS.onyx;
  return { ...base[mode], accentId, mode, name: base.name };
}