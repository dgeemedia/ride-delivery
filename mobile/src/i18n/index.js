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

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import fr from './locales/fr.json';

const LANGUAGE_STORAGE_KEY = 'appLanguage';

// Add an entry here once a locale file exists in ./locales and has been
// reviewed — see the "Adding a new language" note in fr.json's header.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  nativeLabel: 'English' },
  { code: 'fr', label: 'French',   nativeLabel: 'Français' },
];

const resources = {
  en: { translation: en },
  fr: { translation: fr },
};

const supportedCodes = SUPPORTED_LANGUAGES.map(l => l.code);

const detectDeviceLanguage = () => {
  try {
    const locales = Localization.getLocales();
    const deviceCode = locales?.[0]?.languageCode;
    return supportedCodes.includes(deviceCode) ? deviceCode : 'en';
  } catch {
    return 'en';
  }
};

/**
 * Call once, before the app renders (see App.js). Resolves the language to
 * start with: a saved manual choice takes priority over device detection.
 */
export const initI18n = async () => {
  let startingLanguage;
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    startingLanguage = saved && supportedCodes.includes(saved) ? saved : detectDeviceLanguage();
  } catch {
    startingLanguage = detectDeviceLanguage();
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: startingLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    compatibilityJSON: 'v4',
  });

  return i18n;
};

/**
 * Call from a language-picker UI (e.g. ProfileScreen's Settings section).
 * Persists the choice so it survives app restarts without re-detecting.
 */
export const changeLanguage = async (code) => {
  if (!supportedCodes.includes(code)) return;
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch (err) {
    console.warn('[i18n] Failed to persist language choice:', err.message);
  }
};

export default i18n;