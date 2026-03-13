// mobile/src/context/ThemeContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, DEFAULT_ACCENT, DEFAULT_MODE } from '../theme/theme';

const STORAGE_KEY_ACCENT = '@diakite_accent';
const STORAGE_KEY_MODE   = '@diakite_mode';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [accentId, setAccentId] = useState(DEFAULT_ACCENT);
  const [mode,     setMode]     = useState(DEFAULT_MODE);
  const [loaded,   setLoaded]   = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedAccent, savedMode] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ACCENT),
          AsyncStorage.getItem(STORAGE_KEY_MODE),
        ]);
        if (savedAccent) setAccentId(savedAccent);
        if (savedMode)   setMode(savedMode);
      } catch (_) {
        // Silently fall back to defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const changeAccent = async (id) => {
    setAccentId(id);
    try { await AsyncStorage.setItem(STORAGE_KEY_ACCENT, id); } catch (_) {}
  };

  const changeMode = async (m) => {
    setMode(m);
    try { await AsyncStorage.setItem(STORAGE_KEY_MODE, m); } catch (_) {}
  };

  const toggleMode = () => changeMode(mode === 'dark' ? 'light' : 'dark');

  const theme = getTheme(accentId, mode);

  return (
    <ThemeContext.Provider value={{ theme, accentId, mode, changeAccent, changeMode, toggleMode, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook — use this everywhere instead of hardcoded colors
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}