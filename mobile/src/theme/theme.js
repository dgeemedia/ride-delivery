// mobile/src/theme/theme.js
// Diakite — 3 refined accents × 2 modes
// Dark backgrounds are neutral near-black (not color-tinted) for a premium feel.

export const ACCENT_COLORS = {

  // ── Gold — warm, premium, timeless ──────────────────────────────────────
  gold: {
    id: 'gold',
    name: 'Gold',
    emoji: '✦',
    accent: '#C9A96E',
    dark: {
      background:    '#111111',
      backgroundAlt: '#1A1A1A',
      card:          '#161616',
      border:        '#2A2A2A',
      pill:          '#1E1E1E',
      pillBorder:    '#C9A96E22',
      accent:        '#C9A96E',
      foreground:    '#F5F0E8',
      muted:         '#8A8070',
      hint:          '#444038',
      shadow:        '#C9A96E',
    },
    light: {
      background:    '#FAFAF8',
      backgroundAlt: '#FFFFFF',
      card:          '#FFFFFF',
      border:        '#E8E0D0',
      pill:          '#F5EED8',
      pillBorder:    '#C9A96E35',
      accent:        '#A07840',
      foreground:    '#1A1610',
      muted:         '#6A5840',
      hint:          '#B8A888',
      shadow:        '#A07840',
    },
  },

  // ── Ocean — composed, trustworthy, clear ────────────────────────────────
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '◈',
    accent: '#4E8DBD',
    dark: {
      background:    '#0E1117',
      backgroundAlt: '#161D27',
      card:          '#121820',
      border:        '#1E2A38',
      pill:          '#172030',
      pillBorder:    '#4E8DBD22',
      accent:        '#4E8DBD',
      foreground:    '#ECF0F6',
      muted:         '#607080',
      hint:          '#2A3848',
      shadow:        '#4E8DBD',
    },
    light: {
      background:    '#F6F9FC',
      backgroundAlt: '#FFFFFF',
      card:          '#FFFFFF',
      border:        '#D0DDE8',
      pill:          '#E4EEF6',
      pillBorder:    '#4E8DBD35',
      accent:        '#2E6A9A',
      foreground:    '#0E1824',
      muted:         '#3A5870',
      hint:          '#90A8BC',
      shadow:        '#2E6A9A',
    },
  },

  // ── Sage — grounded, calm, considered ───────────────────────────────────
  sage: {
    id: 'sage',
    name: 'Sage',
    emoji: '◇',
    accent: '#7EA882',
    dark: {
      background:    '#0F1210',
      backgroundAlt: '#171E18',
      card:          '#131813',
      border:        '#222A22',
      pill:          '#1A221A',
      pillBorder:    '#7EA88222',
      accent:        '#7EA882',
      foreground:    '#ECF2EC',
      muted:         '#607060',
      hint:          '#2E402E',
      shadow:        '#7EA882',
    },
    light: {
      background:    '#F6FAF6',
      backgroundAlt: '#FFFFFF',
      card:          '#FFFFFF',
      border:        '#C8DCC8',
      pill:          '#DFF0DF',
      pillBorder:    '#7EA88235',
      accent:        '#4E7A52',
      foreground:    '#0E180E',
      muted:         '#3A5A3E',
      hint:          '#8AAA8E',
      shadow:        '#4E7A52',
    },
  },
};

export const DEFAULT_ACCENT = 'gold';
export const DEFAULT_MODE   = 'dark';

export function getTheme(accentId = DEFAULT_ACCENT, mode = DEFAULT_MODE) {
  const base = ACCENT_COLORS[accentId] || ACCENT_COLORS.gold;
  return { ...base[mode], accentId, mode, name: base.name };
}