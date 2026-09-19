// mobile/src/i18n/index.js
//
// i18next setup. Detects the device's language automatically on first
// launch (via expo-localization), then remembers any manual override the
// user picks in Settings (via AsyncStorage) so it sticks across app
// restarts and isn't re-guessed from the device every time.
//
// Falls back to English for any language we haven't translated yet, and
// for any individual missing key within a language we do support — so a
// partially-translated locale never shows blank text.

// IMPORTANT: these two polyfills must be imported BEFORE i18next.
// Hermes (the default RN engine) ships without Intl.PluralRules, and
// i18next's JSON v4 plural resolution is built directly on it. Without the
// polyfill, suffixes like _few / _many / _two / _zero never resolve, so
// Arabic (6 forms) and Russian (4 forms) silently fall back to English —
// and Chinese, which correctly has only _other, breaks for count === 1.
//   yarn add intl-pluralrules @formatjs/intl-getcanonicallocales
import '@formatjs/intl-getcanonicallocales/polyfill';
import 'intl-pluralrules';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { I18nManager } from 'react-native';

import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import es from './locales/es.json';
import tr from './locales/tr.json';
import da from './locales/da.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import ru from './locales/ru.json';

const LANGUAGE_STORAGE_KEY = 'appLanguage';

// Add an entry here once a locale file exists in ./locales and has been
// reviewed — see the "Adding a new language" note in fr.json's header.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    nativeLabel: 'English' },
  { code: 'fr', label: 'French',     nativeLabel: 'Français' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'es', label: 'Spanish',    nativeLabel: 'Español' },
  { code: 'tr', label: 'Turkish',    nativeLabel: 'Türkçe' },
  { code: 'da', label: 'Danish',     nativeLabel: 'Dansk' },
  { code: 'de', label: 'German',     nativeLabel: 'Deutsch' },
  { code: 'zh', label: 'Chinese',    nativeLabel: '简体中文' },
  { code: 'ar', label: 'Arabic',     nativeLabel: 'العربية', rtl: true }, // right-to-left
  { code: 'hi', label: 'Hindi',      nativeLabel: 'हिन्दी' },
  { code: 'ru', label: 'Russian',    nativeLabel: 'Русский' },
];

// The locale files carry a "_comment" key with review notes for translators.
// Strip it so it never resolves as a translatable key or ships as UI text.
const stripMeta = ({ _comment, ...rest }) => rest;

const resources = {
  en: { translation: stripMeta(en) },
  fr: { translation: stripMeta(fr) },
  pt: { translation: stripMeta(pt) },
  es: { translation: stripMeta(es) },
  tr: { translation: stripMeta(tr) },
  da: { translation: stripMeta(da) },
  de: { translation: stripMeta(de) },
  zh: { translation: stripMeta(zh) },
  ar: { translation: stripMeta(ar) },
  hi: { translation: stripMeta(hi) },
  ru: { translation: stripMeta(ru) },
};

const supportedCodes = SUPPORTED_LANGUAGES.map(l => l.code);

const isRtlLanguage = (code) =>
  SUPPORTED_LANGUAGES.find(l => l.code === code)?.rtl === true;

/**
 * Keeps React Native's layout direction in sync with the chosen language
 * (Arabic is right-to-left, everything else left-to-right).
 *
 * React Native only applies a direction change after the app restarts, so this
 * returns true when the direction actually changed and a restart is needed for
 * the layout to flip — see restartForLayoutDirection() below.
 */
const applyLayoutDirection = (code) => {
  const shouldBeRtl = isRtlLanguage(code);
  if (I18nManager.isRTL === shouldBeRtl) return false;
  I18nManager.allowRTL(shouldBeRtl);
  I18nManager.forceRTL(shouldBeRtl);
  return true;
};

const detectDeviceLanguage = () => {
  try {
    const locales = Localization.getLocales() ?? [];
    for (const locale of locales) {
      // languageCode is already the base subtag ('pt' for 'pt-BR'); fall back
      // to splitting the full tag in case a platform omits it.
      const code = locale?.languageCode ?? locale?.languageTag?.split('-')[0];
      if (code && supportedCodes.includes(code)) return code;
    }
    return 'en';
  } catch {
    return 'en';
  }
};

/**
 * Call once, before the app renders (see App.js). Resolves the language to
 * start with: a saved manual choice takes priority over device detection.
 */
export const initI18n = async () => {
  if (i18n.isInitialized) return i18n;

  let startingLanguage;
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    startingLanguage = saved && supportedCodes.includes(saved) ? saved : detectDeviceLanguage();
  } catch {
    startingLanguage = detectDeviceLanguage();
  }

  applyLayoutDirection(startingLanguage);

  await i18n.use(initReactI18next).init({
    resources,
    lng: startingLanguage,
    fallbackLng: 'en',
    supportedLngs: supportedCodes,
    load: 'languageOnly',
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false },         // no Suspense boundary at the RN entry point
  });

  return i18n;
};

/**
 * Call from a language-picker UI (e.g. ProfileScreen's Settings section).
 * Persists the choice so it survives app restarts without re-detecting.
 *
 * Resolves to true if switching changed the layout direction (to or from
 * Arabic) — the text switches immediately, but the mirrored layout only
 * appears after the app is restarted, so the caller may want to prompt for it.
 *
 * Resolves to false for an unsupported code, and for a successful switch that
 * did not change direction. Callers that need to tell those apart should
 * validate against SUPPORTED_LANGUAGES first.
 */
export const changeLanguage = async (code) => {
  if (!supportedCodes.includes(code)) return false;

  // Persist first: if storage fails we must not leave the native layout
  // direction flipped to a language that won't be restored on next launch.
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch (err) {
    console.warn('[i18n] Failed to persist language choice:', err.message);
    await i18n.changeLanguage(code);
    return false;
  }

  await i18n.changeLanguage(code);
  return applyLayoutDirection(code);
};

/**
 * Reloads the JS bundle so a pending right-to-left flip actually takes effect.
 * Call this only after changeLanguage() has resolved to true, and only once the
 * user has confirmed — it tears down the current screen without warning.
 *
 * Resolves to false if the reload could not be performed (for example in Expo
 * Go, or if expo-updates is unavailable), in which case fall back to asking the
 * user to close and reopen the app manually.
 */
export const restartForLayoutDirection = async () => {
  try {
    await Updates.reloadAsync();
    return true;
  } catch (err) {
    console.warn('[i18n] Could not reload to apply layout direction:', err.message);
    return false;
  }
};

export default i18n;
