// Languages the app (and support replies) are available in.
// Keep in sync with backend/src/utils/supportI18n.js and mobile/src/i18n/locales.
export const SUPPORT_LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }, { code: 'ar', label: 'العربية' },
  { code: 'da', label: 'Dansk' },   { code: 'de', label: 'Deutsch' },  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },   { code: 'pt', label: 'Português' }, { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },  { code: 'zh', label: '中文' },
] as const;

export const languageLabel = (code?: string | null): string =>
  SUPPORT_LANGUAGES.find(l => l.code === String(code ?? '').toLowerCase())?.label ?? (code ? String(code).toUpperCase() : '—');

/**
 * Free translation helper: a Google Translate link with the text pre-filled
 * (no API key, no cost). Auto-detects the source language.
 */
export const translateUrl = (text: string, target: string = 'en'): string =>
  `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(target)}&op=translate&text=${encodeURIComponent(String(text ?? '').slice(0, 1500))}`;

/** ISO alpha-2 → flag emoji. */
export const flagOf = (code?: string | null): string =>
  code && code.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)))
    : '🏳️';
