// mobile/src/i18n/countryLanguage.js
//
// Which language a country speaks, so the app can open in the right one for
// someone who has just installed it in Mali, Cameroon or Madagascar.
//
// Pure module (no React Native imports) so it's trivial to unit test.
//
// ── What "the country" means here ────────────────────────────────────────────
// Neither Google Play nor the App Store tells an app which store the user
// downloaded from (iOS needs a native StoreKit call; Android has no API at all).
// So we use the next-best signals, in order:
//   1. the region set on the phone (Settings → Region) — normally the same
//      country as the store account, and what expo-localization exposes;
//   2. once the person registers or signs in, their account's country, which is
//      authoritative (see applyCountryLanguage in ./index.js).
// A manual choice from the language picker beats both, always.
//
// `default`  — used when the phone's own language isn't one of the country's
//              official languages (an English-language phone in Mali → French)
// `official` — languages we keep if the phone is already set to one of them
//              (a French phone in Cameroon stays French; an English one stays
//              English, because Cameroon is officially bilingual)

export const COUNTRY_LANGUAGE = {
  // English-speaking
  NG: { default: 'en', official: ['en'] },
  GH: { default: 'en', official: ['en'] },
  GM: { default: 'en', official: ['en'] },
  SL: { default: 'en', official: ['en'] },
  LR: { default: 'en', official: ['en'] },
  BW: { default: 'en', official: ['en'] },          // Setswana isn't translated yet
  // French-speaking
  CI: { default: 'fr', official: ['fr'] },
  SN: { default: 'fr', official: ['fr'] },
  ML: { default: 'fr', official: ['fr'] },
  BF: { default: 'fr', official: ['fr'] },
  NE: { default: 'fr', official: ['fr'] },
  GN: { default: 'fr', official: ['fr'] },
  BJ: { default: 'fr', official: ['fr'] },
  CD: { default: 'fr', official: ['fr'] },
  CF: { default: 'fr', official: ['fr'] },          // Sango isn't translated yet
  MG: { default: 'fr', official: ['fr'] },          // Malagasy isn't translated yet
  // Bilingual
  CM: { default: 'fr', official: ['fr', 'en'] },
  TG: { default: 'fr', official: ['fr'] },
  // Portuguese-speaking
  CV: { default: 'pt', official: ['pt'] },
  GW: { default: 'pt', official: ['pt'] },
};

/**
 * @param {string} regionCode  ISO country code, e.g. 'ML'
 * @param {string} deviceLang  the phone's language, e.g. 'en'
 * @param {string[]} supported language codes we actually have translations for
 * @returns {string|null} a language code, or null if we know nothing about the country
 */
export const languageForCountry = (regionCode, deviceLang, supported) => {
  const entry = COUNTRY_LANGUAGE[String(regionCode || '').toUpperCase()];
  if (!entry) return null;

  const usable = (code) => supported.includes(code);
  if (deviceLang && entry.official.includes(deviceLang) && usable(deviceLang)) return deviceLang;
  if (usable(entry.default)) return entry.default;
  return null;
};

/**
 * Full startup decision, minus the saved manual choice (the caller checks that
 * first because it needs AsyncStorage).
 *
 *   phone region is a market we know → that country's language
 *   otherwise                        → the phone's language, if we have it
 *   otherwise                        → English
 */
export const resolveAutoLanguage = ({ regionCode, deviceLanguages = [], supported }) => {
  const primary = deviceLanguages[0];
  const fromCountry = languageForCountry(regionCode, primary, supported);
  if (fromCountry) return fromCountry;

  for (const code of deviceLanguages) {
    if (code && supported.includes(code)) return code;
  }
  return 'en';
};
