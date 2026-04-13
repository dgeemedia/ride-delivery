// mobile/src/theme/theme.js

export const ACCENT_COLORS = {
  onyx: {
    id: 'onyx', name: 'Onyx', emoji: '◼', accent: '#FFFFFF',
    dark: {
      background:    '#111111',
      backgroundAlt: '#1A1A1A',
      card:          '#161616',
      border:        '#2A2A2A',
      pill:          '#1D1D1D',
      pillBorder:    '#FFFFFF18',
      accent:        '#FFFFFF',
      accentFg:      '#111111',
      foreground:    '#F2EEE6',
      muted:         '#6A6A6A',
      hint:          '#333333',
      shadow:        '#FFFFFF',
      logoBadgeBg:   '#FFFFFF',
      logoBadgeBorder: '#E5E5E5',
    },
    light: {
      background:    '#EAE5DA',
      backgroundAlt: '#F4F0E8',
      card:          '#F8F5EF',
      border:        '#D4CCC0',
      pill:          '#E0D8C8',
      pillBorder:    '#11111118',
      accent:        '#111111',
      accentFg:      '#FFFFFF',
      foreground:    '#0F0D0A',
      muted:         '#5A5248',
      hint:          '#A89C88',
      shadow:        '#111111',
      logoBadgeBg:     '#FFFFFF',
      logoBadgeBorder: '#E5E5E5',
    },
  },

  chalk: {
    id: 'chalk', name: 'Chalk', emoji: '◻', accent: '#EAE5DA',
    dark: {
      background:    '#111111',
      backgroundAlt: '#191919',
      card:          '#161616',
      border:        '#2A2A2A',
      pill:          '#1D1D1D',
      pillBorder:    '#EAE5DA18',
      accent:        '#EAE5DA',
      accentFg:      '#111111',
      foreground:    '#F2EEE6',
      muted:         '#6A6A6A',
      hint:          '#333333',
      shadow:        '#EAE5DA',
      logoBadgeBg:     '#FFFFFF',
      logoBadgeBorder: '#E5E5E5',
    },
    light: {
      background:    '#EAE5DA',
      backgroundAlt: '#F4F0E8',
      card:          '#F8F5EF',
      border:        '#D4CCC0',
      pill:          '#E0D8C8',
      pillBorder:    '#11111118',
      accent:        '#2A2520',
      accentFg:      '#FFFFFF',
      foreground:    '#0F0D0A',
      muted:         '#5A5248',
      hint:          '#A89C88',
      shadow:        '#2A2520',
      logoBadgeBg:     '#FFFFFF',
      logoBadgeBorder: '#E5E5E5',
    },
  },
};

export const DEFAULT_ACCENT = 'onyx';
export const DEFAULT_MODE   = 'dark';

export function getTheme(accentId = DEFAULT_ACCENT, mode = DEFAULT_MODE) {
  const base = ACCENT_COLORS[accentId] || ACCENT_COLORS.onyx;
  return { ...base[mode], accentId, mode, name: base.name };
}