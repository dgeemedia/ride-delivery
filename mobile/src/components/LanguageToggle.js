// mobile/src/components/LanguageToggle.js
//
// Compact language switcher designed to sit next to the profile avatar in the
// map top bars on HomeScreen, DriverDashboardScreen and PartnerDashboardScreen.
//
// Why this exists separately from the picker in ProfileScreen: the language a
// user needs is most often wrong on the very first screen they land on (the
// app guesses from the device locale at first launch — see src/i18n/index.js),
// and that's exactly the screen where burying the switch three taps deep in
// Settings hurts most. The ProfileScreen row stays as-is for discoverability;
// this is the fast path.
//
// Props:
//   theme       {object}  — from useTheme()
//   darkMode    {bool}    — from useTheme()
//   variant     {string}  — 'pill' (default, shows the language code) | 'icon'
//   size        {number}  — button height; defaults to 42 to line up with the
//                           42px avatars on the driver/partner dashboards

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, changeLanguage } from '../i18n';

const LanguageToggle = ({
  theme,
  darkMode,
  variant = 'pill',
  size = 42,
  style,
}) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0];

  const select = async (code) => {
    if (code === i18n.language) { setOpen(false); return; }
    setBusy(true);
    try {
      await changeLanguage(code);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const surface = darkMode ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)';
  const hairline = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const fg = darkMode ? '#fff' : '#000';

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        disabled={busy}
        // The control is a globe icon, which is meaningless to a screen
        // reader on its own — announce the current language instead.
        accessibilityRole="button"
        accessibilityLabel={t('languagePicker.title')}
        accessibilityValue={{ text: current.nativeLabel }}
        style={[
          lt.btn,
          {
            height: size,
            minWidth: size,
            borderRadius: size / 2,
            backgroundColor: surface,
            borderColor: hairline,
            paddingHorizontal: variant === 'pill' ? 10 : 0,
          },
          style,
        ]}
      >
        <Ionicons name="globe-outline" size={17} color={fg} />
        {variant === 'pill' && (
          <Text style={[lt.code, { color: fg }]}>
            {current.code.toUpperCase()}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Tapping the scrim dismisses; the sheet itself swallows the press
            so a tap on a row doesn't also close through to the backdrop. */}
        <Pressable style={lt.scrim} onPress={() => setOpen(false)}>
          <Pressable
            style={[lt.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => {}}
          >
            <Text style={[lt.title, { color: theme.foreground }]}>
              {t('languagePicker.title')}
            </Text>
            <Text style={[lt.subtitle, { color: theme.hint }]}>
              {t('languagePicker.subtitle')}
            </Text>

            {SUPPORTED_LANGUAGES.map(l => {
              const active = l.code === i18n.language;
              return (
                <TouchableOpacity
                  key={l.code}
                  onPress={() => select(l.code)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    lt.row,
                    {
                      borderColor: active ? theme.accent : theme.border,
                      backgroundColor: active ? theme.accent + '14' : 'transparent',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[lt.rowLabel, { color: active ? theme.accent : theme.foreground }]}>
                      {l.nativeLabel}
                    </Text>
                    {/* Show the English name too, so someone who switched
                        into a language they can't read can find their way
                        back out. */}
                    {l.nativeLabel !== l.label && (
                      <Text style={[lt.rowSub, { color: theme.hint }]}>{l.label}</Text>
                    )}
                  </View>
                  {active && <Ionicons name="checkmark" size={18} color={theme.accent} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity onPress={() => setOpen(false)} activeOpacity={0.8} style={lt.close}>
              <Text style={[lt.closeTxt, { color: theme.hint }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const lt = StyleSheet.create({
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1 },
  code:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  scrim:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet:    { borderRadius: 20, borderWidth: 1, padding: 20 },
  title:    { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 4, marginBottom: 16, lineHeight: 17 },
  row:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowSub:   { fontSize: 11, marginTop: 1 },
  close:    { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  closeTxt: { fontSize: 13, fontWeight: '600' },
});

export default LanguageToggle;
