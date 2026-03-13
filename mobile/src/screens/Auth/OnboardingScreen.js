// mobile/src/screens/Auth/OnboardingScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const ACCENT_OPTIONS = [
  { id: 'gold',  label: 'Gold',  color: '#C9A96E' },
  { id: 'ocean', label: 'Ocean', color: '#4E8DBD' },
  { id: 'sage',  label: 'Sage',  color: '#7EA882' },
];

// Resolved at module level — Metro bundler requires static require() paths
const LOGO_DARK  = require('../../../assets/diakite_light.png'); // white logo → dark backgrounds
const LOGO_LIGHT = require('../../../assets/diakite_dark.png');  // black logo → light backgrounds

export default function OnboardingScreen({ navigation }) {
  const { theme, accentId, mode, changeAccent, changeMode } = useTheme();

  const logoS  = useRef(new Animated.Value(0)).current;
  const logoO  = useRef(new Animated.Value(0)).current;
  const titleO = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(24)).current;
  const subO   = useRef(new Animated.Value(0)).current;
  const subY   = useRef(new Animated.Value(16)).current;
  const ftrO   = useRef(new Animated.Value(0)).current;
  const ftrY   = useRef(new Animated.Value(16)).current;
  const glowS  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(140, [
      Animated.parallel([
        Animated.spring(logoS, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoO, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleO, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subO, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ftrO, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(ftrY, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glowS, { toValue: 1.15, duration: 2400, useNativeDriver: true }),
      Animated.timing(glowS, { toValue: 1,    duration: 2400, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={[styles.ambientGlow, { backgroundColor: theme.accent }]} />

      {/* ── HERO ── */}
      <View style={styles.hero}>

        <Animated.View style={[styles.logoWrap, { opacity: logoO, transform: [{ scale: logoS }] }]}>
          <Animated.View style={[styles.glowRing, { backgroundColor: theme.accent, transform: [{ scale: glowS }] }]} />
          <View style={[styles.logoBadge, { backgroundColor: theme.backgroundAlt, borderColor: theme.border, shadowColor: theme.accent }]}>
            <Image
              source={mode === 'dark' ? LOGO_DARK : LOGO_LIGHT}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.brandRow, { opacity: titleO, transform: [{ translateY: titleY }] }]}>
          <Text style={[styles.brand, { color: theme.foreground }]}>Diakite</Text>
          <View style={[styles.accentDot, { backgroundColor: theme.accent }]} />
        </Animated.View>

        <Animated.Text style={[styles.tagline, { color: theme.muted, opacity: subO, transform: [{ translateY: subY }] }]}>
          Rides & deliveries,{'\n'}built around you.
        </Animated.Text>

        <Animated.View style={[styles.features, { opacity: subO, transform: [{ translateY: subY }] }]}>
          {[
            ['arrow-forward-circle-outline', 'Book a ride in seconds'],
            ['cube-outline',                 'Send packages city-wide'],
            ['wallet-outline',               'Earn on your schedule'],
          ].map(([icon, label]) => (
            <View key={label} style={styles.featureRow}>
              <Ionicons name={icon} size={16} color={theme.accent} />
              <Text style={[styles.featureTxt, { color: theme.muted }]}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* ── THEME PICKER ── */}
      <Animated.View style={[styles.picker, { opacity: ftrO, transform: [{ translateY: ftrY }] }]}>
        <Text style={[styles.pickerLabel, { color: theme.hint }]}>APPEARANCE</Text>

        <View style={styles.swatchRow}>
          {ACCENT_OPTIONS.map(opt => {
            const active = accentId === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => changeAccent(opt.id)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: active ? opt.color + '18' : 'transparent',
                    borderColor:     active ? opt.color        : theme.border,
                  },
                ]}
                activeOpacity={0.75}
              >
                <View style={[styles.swatchDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.swatchTxt, { color: active ? opt.color : theme.hint }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.modeToggle, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          {['dark', 'light'].map(m => {
            const active = mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => changeMode(m)}
                style={[styles.modeBtn, active && { backgroundColor: theme.accent + '22' }]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={m === 'dark' ? 'moon-outline' : 'sunny-outline'}
                  size={14}
                  color={active ? theme.accent : theme.hint}
                />
                <Text style={[styles.modeTxt, { color: active ? theme.accent : theme.hint }]}>
                  {m === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* ── FOOTER ── */}
      <Animated.View style={[styles.footer, { opacity: ftrO, transform: [{ translateY: ftrY }] }]}>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.ctaTxt}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghost} onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.ghostTxt, { color: theme.hint }]}>
            Have an account?{' '}
            <Text style={[styles.ghostAccent, { color: theme.accent }]}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: {
    position: 'absolute', width: width * 1.4, height: width * 1.4,
    borderRadius: width * 0.7, top: -width * 0.85, alignSelf: 'center',
    opacity: 0.07,
  },
  hero:        { flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 36 },
  logoWrap:    { marginBottom: 32, position: 'relative', alignItems: 'center', justifyContent: 'center', width: 76, height: 76 },
  glowRing:    { position: 'absolute', width: 76, height: 76, borderRadius: 38, opacity: 0.10 },
  logoBadge:   {
    width: 76, height: 76, borderRadius: 20, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.20, shadowRadius: 16, elevation: 8,
  },
  logoImg:     { width: 48, height: 34 },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  brand:       { fontSize: 34, fontWeight: '800', letterSpacing: 6 },
  accentDot:   { width: 7, height: 7, borderRadius: 3.5, marginTop: 6 },
  tagline:     { fontSize: 20, lineHeight: 30, fontWeight: '300', letterSpacing: 0.2, marginBottom: 28 },
  features:    { gap: 14 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureTxt:  { fontSize: 14, fontWeight: '400', letterSpacing: 0.1 },
  picker:      { paddingHorizontal: 36, paddingBottom: 14, gap: 12 },
  pickerLabel: { fontSize: 10, letterSpacing: 3.5, fontWeight: '600' },
  swatchRow:   { flexDirection: 'row', gap: 8 },
  swatch:      {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  swatchDot:   { width: 8, height: 8, borderRadius: 4 },
  swatchTxt:   { fontSize: 12, fontWeight: '600' },
  modeToggle:  { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', height: 40 },
  modeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modeTxt:     { fontSize: 12, fontWeight: '600' },
  footer:      { paddingHorizontal: 36, paddingBottom: Platform.OS === 'ios' ? 48 : 32, gap: 12 },
  cta:         {
    borderRadius: 14, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10,
  },
  ctaTxt:      { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  ghost:       { alignItems: 'center', paddingVertical: 4 },
  ghostTxt:    { fontSize: 14 },
  ghostAccent: { fontWeight: '600' },
});