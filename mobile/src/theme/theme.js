// mobile/src/theme/theme.js

export const ACCENT_COLORS = {
  onyx: {
    id: 'onyx', name: 'Onyx', emoji: '◼', accent: '#FFFFFF',
    dark: {
      background:      '#000000',
      backgroundAlt:   '#0F0F0F',
      card:            '#0A0A0A',
      border:          '#1F1F1F',
      pill:            '#141414',
      pillBorder:      '#FFFFFF14',
      accent:          '#FFFFFF',
      accentFg:        '#000000',
      foreground:      '#FFFFFF',
      muted:           '#666666',
      hint:            '#555555',
      shadow:          '#FFFFFF',
      logoBadgeBg:     '#1A1A1A',
      logoBadgeBorder: '#2A2A2A',
    },
    light: {
      background:      '#FFFFFF',
      backgroundAlt:   '#F5F5F5',
      card:            '#FAFAFA',
      border:          '#E0E0E0',
      pill:            '#EFEFEF',
      pillBorder:      '#00000012',
      accent:          '#000000',
      accentFg:        '#FFFFFF',
      foreground:      '#000000',
      muted:           '#555555',
      hint:            '#999999',
      shadow:          '#000000',
      logoBadgeBg:     '#FFFFFF',
      logoBadgeBorder: '#E0E0E0',
    },
  },

  // chalk kept for backward compat but maps to same black/white palette
  chalk: {
    id: 'chalk', name: 'Chalk', emoji: '◻', accent: '#FFFFFF',
    dark: {
      background:      '#000000',
      backgroundAlt:   '#0F0F0F',
      card:            '#0A0A0A',
      border:          '#1F1F1F',
      pill:            '#141414',
      pillBorder:      '#FFFFFF14',
      accent:          '#FFFFFF',
      accentFg:        '#000000',
      foreground:      '#FFFFFF',
      muted:           '#666666',
      hint:            '#555555',
      shadow:          '#FFFFFF',
      logoBadgeBg:     '#1A1A1A',
      logoBadgeBorder: '#2A2A2A',
    },
    light: {
      background:      '#FFFFFF',
      backgroundAlt:   '#F5F5F5',
      card:            '#FAFAFA',
      border:          '#E0E0E0',
      pill:            '#EFEFEF',
      pillBorder:      '#00000012',
      accent:          '#000000',
      accentFg:        '#FFFFFF',
      foreground:      '#000000',
      muted:           '#555555',
      hint:            '#999999',
      shadow:          '#000000',
      logoBadgeBg:     '#FFFFFF',
      logoBadgeBorder: '#E0E0E0',
    },
  },
};

export const DEFAULT_ACCENT = 'onyx';
export const DEFAULT_MODE   = 'dark';

export function getTheme(accentId = DEFAULT_ACCENT, mode = DEFAULT_MODE) {
  const base = ACCENT_COLORS[accentId] || ACCENT_COLORS.onyx;
  return { ...base[mode], accentId, mode, name: base.name };
}