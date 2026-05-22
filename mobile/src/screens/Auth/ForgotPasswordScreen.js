// mobile/src/screens/Auth/ForgotPasswordScreen.js
// ── Premium Glass Edition • Onyx Theme • Matches LoginScreen ─────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  Animated, Dimensions, StatusBar, Image, ActivityIndicator,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { authAPI }           from '../../services/api';

const { width, height } = Dimensions.get('window');
const LOGO = require('../../../assets/diakite_dark.png');

const TINY   = height < 650;
const SMALL  = height < 720;
const MEDIUM = height < 820;

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.80)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
};

const INPUT_H = TINY ? 48 : SMALL ? 52 : MEDIUM ? 56 : 60;

// ── Floating label input (same as LoginScreen) ────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType }) => {
  const { theme, mode } = useTheme();
  const [focused, setFocused] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 180, useNativeDriver: false }),
      Animated.timing(borderA, { toValue: focused ? 1 : 0,          duration: 200, useNativeDriver: false }),
    ]).start();
  }, [focused, value]);

  const labelTop  = labelY.interpolate({ inputRange: [0, 1], outputRange: [INPUT_H * 0.28, 5] });
  const fSize     = labelY.interpolate({ inputRange: [0, 1], outputRange: [14, 10] });
  const lColor    = labelY.interpolate({ inputRange: [0, 1], outputRange: [theme.hint, mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'] });
  const borderCol = borderA.interpolate({ inputRange: [0, 1], outputRange: [G.border(mode), mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.20)'] });

  return (
    <Animated.View style={[fi.box, { height: INPUT_H, backgroundColor: G.card(mode), borderColor: borderCol }]}>
      <LinearGradient
        colors={mode === 'dark'
          ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
          : ['rgba(255,255,255,0.9)',  'rgba(255,255,255,0.75)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons
        name={iconName} size={15}
        color={focused ? (mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)') : theme.hint}
        style={fi.icon}
      />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[fi.label, { top: labelTop, fontSize: fSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={[fi.text, { color: theme.foreground, paddingTop: INPUT_H * 0.38, paddingBottom: 4 }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType || 'email-address'}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
    </Animated.View>
  );
};
const fi = StyleSheet.create({
  box:   { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1.5, marginBottom: SMALL ? 8 : 10, paddingHorizontal: 13, overflow: 'hidden' },
  icon:  { marginRight: 9 },
  label: { position: 'absolute', left: 0 },
  text:  { fontSize: 14, fontWeight: '400' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ForgotPasswordScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  // Entrance animations
  const hdrO = useRef(new Animated.Value(0)).current;
  const hdrY = useRef(new Animated.Value(-24)).current;
  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(24)).current;

  const animateIn = () => {
    hdrO.setValue(0); hdrY.setValue(-24);
    frmO.setValue(0); frmY.setValue(24);
    Animated.parallel([
      Animated.timing(hdrO, { toValue: 1, duration: 500,             useNativeDriver: true }),
      Animated.timing(hdrY, { toValue: 0, duration: 500,             useNativeDriver: true }),
      Animated.timing(frmO, { toValue: 1, duration: 500, delay: 120, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 500, delay: 120, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { animateIn(); }, []);

  // Transition to the success state
  const transitionToSent = () => {
    Animated.parallel([
      Animated.timing(frmO, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setSent(true);
      frmY.setValue(20);
      Animated.parallel([
        Animated.timing(frmO, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(frmY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // The backend always responds with the same message whether the email
      // exists or not (security best practice) so we always show success.
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
    } catch {
      // Swallow — backend may be unreachable but we still transition to the
      // "check your email" screen to avoid leaking whether an account exists.
    } finally {
      setLoading(false);
      transitionToSent();
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
    } catch {}
    finally { setLoading(false); }
  };

  // ── Sizing ────────────────────────────────────────────────────────────────
  const H_PAD   = SMALL ? 24 : 28;
  const LOGO_SZ = TINY ? 52 : SMALL ? 58 : 66;
  const LOGO_R  = TINY ? 14 : SMALL ? 16 : 18;
  const LOGO_IMG = TINY ? { width: 38, height: 26 } : SMALL ? { width: 44, height: 30 } : { width: 50, height: 34 };
  const BTN_H   = TINY ? 44 : SMALL ? 48 : 52;
  const topPad  = Math.max(insets.top, TINY ? 12 : 16);
  const botPad  = Math.max(insets.bottom, 8);

  // ── Step data (renamed from `step` to avoid Hermes reserved word clash) ───
  const RECOVERY_STEPS = [
    { icon: 'mail-outline',      text: 'Open the email from Diakite'      },
    { icon: 'link-outline',      text: 'Tap the "Reset Password" button'  },
    { icon: 'lock-open-outline', text: 'Choose a new password'            },
  ];

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={[s.orb1, { backgroundColor: darkMode ? 'rgba(83,74,183,0.06)' : 'rgba(83,74,183,0.04)' }]} />
      <View style={[s.orb2, { backgroundColor: darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingHorizontal: H_PAD, paddingTop: topPad, paddingBottom: botPad + 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <Animated.View style={[s.header, { opacity: hdrO, transform: [{ translateY: hdrY }], marginBottom: TINY ? 14 : SMALL ? 20 : 28 }]}>
            {/* Back + Logo row */}
            <View style={[s.topRow, { marginBottom: TINY ? 14 : 20 }]}>
              <TouchableOpacity
                style={[s.backBtn, { width: LOGO_SZ * 0.7, height: LOGO_SZ * 0.7, backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="arrow-back" size={16} color={theme.foreground} />
              </TouchableOpacity>

              <View style={[s.logoBadge, { width: LOGO_SZ, height: LOGO_SZ, borderRadius: LOGO_R }]}>
                <Image source={LOGO} style={LOGO_IMG} resizeMode="contain" />
              </View>
            </View>

            {/* Pill */}
            <View style={[s.pill, { backgroundColor: G.card(mode), borderColor: G.border(mode), marginBottom: SMALL ? 8 : 12 }]}>
              <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
              <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>
                {sent ? 'CHECK YOUR EMAIL' : 'ACCOUNT RECOVERY'}
              </Text>
            </View>

            <Text style={[s.title, { color: theme.foreground, fontSize: TINY ? 26 : SMALL ? 28 : MEDIUM ? 31 : 34 }]}>
              {sent ? 'Email sent!' : 'Forgot\npassword?'}
            </Text>
            <Text style={[s.subtitle, { color: theme.hint, fontSize: TINY ? 12 : 13, marginTop: TINY ? 3 : 6 }]}>
              {sent
                ? `We sent a reset link to\n${email}`
                : "Enter your email and we'll send\nyou a reset link."}
            </Text>
          </Animated.View>

          {/* ── Form / Success ───────────────────────────────────────────── */}
          <Animated.View style={{ opacity: frmO, transform: [{ translateY: frmY }] }}>

            {!sent ? (
              // ── Email form ───────────────────────────────────────────────
              <>
                <FloatInput
                  label="Email address"
                  iconName="mail-outline"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                />

                {error ? (
                  <View style={[s.errorBox, { backgroundColor: darkMode ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}>
                    <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                    <Text style={s.errorTxt}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[s.primaryBtn, { height: BTN_H, marginTop: SMALL ? 4 : 8, overflow: 'hidden' }, loading && s.dimmed]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)'] : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[s.shimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
                  {loading
                    ? <ActivityIndicator color={theme.accentFg} />
                    : <>
                        <Text style={[s.primaryBtnTxt, { color: theme.accentFg, fontSize: SMALL ? 13 : 14 }]}>Send Reset Link</Text>
                        <Ionicons name="arrow-forward" size={16} color={theme.accentFg} />
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.altBtn, { height: BTN_H, marginTop: SMALL ? 8 : 10, backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden' }]}
                  onPress={() => navigation.goBack()}
                >
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[s.altTxt, { color: theme.hint, fontSize: SMALL ? 12 : 13 }]}>
                    Remember it?{'  '}
                    <Text style={[s.altBold, { color: theme.foreground }]}>Back to Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              // ── Success state ────────────────────────────────────────────
              <>
                {/* Mail icon badge */}
                <View style={[s.successBadge, { backgroundColor: G.card(mode), borderColor: G.border(mode), alignSelf: 'center', marginBottom: SMALL ? 24 : 32, overflow: 'hidden' }]}>
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.75)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="mail-open-outline" size={SMALL ? 38 : 44} color={theme.foreground} />
                </View>

                {/* Step list — `item` used instead of `step` to avoid Hermes reserved word clash on Android */}
                {RECOVERY_STEPS.map((item, i) => (
                  <View key={i} style={[s.stepRow, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden', marginBottom: SMALL ? 8 : 10 }]}>
                    <LinearGradient
                      colors={darkMode ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[s.stepNum, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                      <Text style={[s.stepNumTxt, { color: theme.foreground }]}>{i + 1}</Text>
                    </View>
                    <Ionicons name={item.icon} size={16} color={theme.hint} style={{ marginRight: 10 }} />
                    <Text style={[s.stepTxt, { color: theme.foreground, fontSize: SMALL ? 13 : 14 }]}>{item.text}</Text>
                  </View>
                ))}

                {/* Spam note */}
                <View style={[s.noteBox, { backgroundColor: darkMode ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', marginTop: SMALL ? 4 : 8, marginBottom: SMALL ? 18 : 24 }]}>
                  <Ionicons name="information-circle-outline" size={15} color="#F59E0B" />
                  <Text style={[s.noteTxt, { color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }]}>
                    Can't find it? Check your spam or junk folder.
                  </Text>
                </View>

                {/* Resend */}
                <TouchableOpacity
                  style={[s.primaryBtn, { height: BTN_H, marginBottom: SMALL ? 8 : 10, overflow: 'hidden' }, loading && s.dimmed]}
                  onPress={handleResend}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)'] : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[s.shimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
                  {loading
                    ? <ActivityIndicator color={theme.accentFg} />
                    : <>
                        <Ionicons name="refresh-outline" size={16} color={theme.accentFg} />
                        <Text style={[s.primaryBtnTxt, { color: theme.accentFg, fontSize: SMALL ? 13 : 14 }]}>Resend Email</Text>
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.altBtn, { height: BTN_H, backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden' }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[s.altTxt, { color: theme.hint, fontSize: SMALL ? 12 : 13 }]}>
                    Back to{'  '}
                    <Text style={[s.altBold, { color: theme.foreground }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
  orb1:   { position: 'absolute', width: width * 1.3, height: width * 1.3, borderRadius: width * 0.65, top: -width * 0.8, alignSelf: 'center' },
  orb2:   { position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, bottom: -width * 0.2, right: -width * 0.1 },
  scroll: { flexGrow: 1 },

  header:    { },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:   { borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoBadge: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E5E5', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 5 },

  pill:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillDot:   { width: 5, height: 5, borderRadius: 3 },
  eyebrow:   { fontSize: 9, letterSpacing: 3.5, fontWeight: '800' },
  title:     { fontWeight: '900', letterSpacing: -0.8, lineHeight: undefined },
  subtitle:  { fontWeight: '300', lineHeight: 20 },

  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  errorTxt:  { flex: 1, fontSize: 13, color: '#EF4444', fontWeight: '500' },

  primaryBtn:    { borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  shimmer:       { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  primaryBtnTxt: { fontWeight: '800', letterSpacing: 0.3 },
  dimmed:        { opacity: 0.5 },

  altBtn:  { borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  altTxt:  {},
  altBold: { fontWeight: '700' },

  successBadge: { width: 90, height: 90, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  stepRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12 },
  stepNum:    { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  stepNumTxt: { fontSize: 11, fontWeight: '800' },
  stepTxt:    { flex: 1, fontWeight: '500' },

  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  noteTxt: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '400' },
});