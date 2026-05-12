// mobile/src/screens/Auth/LoginScreen.js
// ── Premium Glass Edition • Onyx Theme • Compact Fit-All ─────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, Dimensions, StatusBar, Image,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }         from '../../context/AuthContext';
import { useTheme }        from '../../context/ThemeContext';
import { useBiometric }    from '../../hooks/useBiometric';
import { LoginHeroIllustration } from '../../components/ServiceIcons';

const { width, height } = Dimensions.get('window');
const LOGO = require('../../../assets/diakite_dark.png');

// ─── Responsive breakpoints ───────────────────────────────────────────────────
const TINY   = height < 650;   // iPhone 5/SE 1st gen
const SMALL  = height < 720;   // iPhone SE 2nd/3rd, 8
const MEDIUM = height < 820;   // iPhone X, 11 Pro, 12 Mini
// >= 820 → large (iPhone 12/13/14/15, Plus, Pro Max)

// Scale a size relative to iPhone 13 (812pt) — never exceeds original
const rs = (size, min) => {
  const scaled = Math.round(size * (height / 812));
  return min !== undefined ? Math.max(scaled, min) : scaled;
};

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.80)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
};

// ── Float Input (unchanged logic, responsive height) ─────────────────────────
const INPUT_H = TINY ? 48 : SMALL ? 52 : MEDIUM ? 56 : 60;

const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, secureTextEntry }) => {
  const { theme, mode } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
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
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry && !showPwd}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={fi.eye}>
          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={15} color={theme.hint} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};
const fi = StyleSheet.create({
  box:   { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1.5, marginBottom: SMALL ? 8 : 10, paddingHorizontal: 13, overflow: 'hidden' },
  icon:  { marginRight: 9 },
  label: { position: 'absolute', left: 0 },
  text:  { fontSize: 14, fontWeight: '400' },
  eye:   { padding: 6, marginLeft: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { theme, mode }                   = useTheme();
  const { login, biometricLogin }         = useAuth();
  const insets                            = useSafeAreaInsets();
  const darkMode                          = mode === 'dark';

  const {
    isAvailable: bioAvailable,
    isEnabled:   bioEnabled,
    biometricType,
    authenticate,
    getSecureToken,
    updateSecureToken,
    enable:  enableBiometric,
    disable: disableBiometric,
  } = useBiometric();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // Entrance animations
  const hdrO = useRef(new Animated.Value(0)).current;
  const hdrY = useRef(new Animated.Value(-24)).current;
  const illoO = useRef(new Animated.Value(0)).current;
  const illoS = useRef(new Animated.Value(0.94)).current;
  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrO,  { toValue: 1, duration: 600,             useNativeDriver: true }),
      Animated.timing(hdrY,  { toValue: 0, duration: 600,             useNativeDriver: true }),
      Animated.timing(illoO, { toValue: 1, duration: 700, delay: 80,  useNativeDriver: true }),
      Animated.spring(illoS, { toValue: 1,                delay: 80, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(frmO,  { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(frmY,  { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Login handlers (all original logic preserved) ─────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    const res = await login({ email: email.trim(), password });
    setLoading(false);
    if (!res.success) {
      Alert.alert('Login Failed', res.message ?? 'Please check your credentials.');
      return;
    }
    if (res.requiresOtp) {
      navigation.navigate('OtpVerification', { tempToken: res.tempToken, method: res.method, maskedContact: res.maskedContact });
      return;
    }
    if (res.token) await updateSecureToken(res.token);
    if (bioAvailable && !bioEnabled && res.token) {
      Alert.alert(
        `Enable ${bioLabel} Login?`,
        'Sign in faster next time without typing your password.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Enable', onPress: () => enableBiometric(res.token) },
        ]
      );
    }
  };

  const handleBiometricLogin = async () => {
    if (bioLoading) return;
    const verified = await authenticate();
    if (!verified) return;
    setBioLoading(true);
    const storedToken = await getSecureToken();
    if (!storedToken) {
      setBioLoading(false);
      Alert.alert('Setup Required', 'Please sign in with your password to re-enable biometric login.');
      return;
    }
    const res = await biometricLogin(storedToken);
    setBioLoading(false);
    if (!res.success) {
      await disableBiometric();
      Alert.alert('Session Expired', res.message || 'Please sign in with your password to continue.');
    }
  };

  const bioLabel = biometricType === 'faceid' ? 'Face ID' : biometricType === 'iris' ? 'Iris' : 'Fingerprint';
  const bioIcon  = biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline';

  // ── Responsive sizing ─────────────────────────────────────────────────────
  const H_PAD    = SMALL ? 24 : 28;
  const LOGO_SZ  = TINY ? 52 : SMALL ? 58 : 66;
  const LOGO_R   = TINY ? 14 : SMALL ? 16 : 18;
  const LOGO_IMG = TINY ? { width: 38, height: 26 } : SMALL ? { width: 44, height: 30 } : { width: 50, height: 34 };
  const BTN_H    = TINY ? 44 : SMALL ? 48 : 52;

  // Illustration: scales with remaining space, hidden on tiny screens
  const illoWidth  = width - H_PAD * 2;
  const illoHeight = TINY ? 0 : Math.round(illoWidth * (SMALL ? 0.42 : MEDIUM ? 0.50 : 0.56));
  const showIllo   = !TINY && illoHeight > 60;

  // Vertical padding — derived from safe area
  const topPad = Math.max(insets.top, TINY ? 12 : SMALL ? 16 : 20);
  const botPad = Math.max(insets.bottom, 8);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient orbs */}
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
          <Animated.View style={[s.header, { opacity: hdrO, transform: [{ translateY: hdrY }] }]}>
            {/* Logo badge */}
            <View style={[s.logoBadge, { width: LOGO_SZ, height: LOGO_SZ, borderRadius: LOGO_R }]}>
              <Image source={LOGO} style={LOGO_IMG} resizeMode="contain" />
            </View>

            {/* Pill + title row: side by side on tiny screens */}
            <View style={[s.pillTitleRow, { marginTop: TINY ? 10 : 14 }]}>
              <View style={{ flex: 1 }}>
                <View style={[s.pill, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
                  <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
                  <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>WELCOME BACK</Text>
                </View>
                <Text style={[s.title, { color: theme.foreground, fontSize: TINY ? 26 : SMALL ? 28 : MEDIUM ? 31 : 34, marginTop: TINY ? 6 : 10 }]}>Sign in</Text>
                <Text style={[s.subtitle, { color: theme.hint, fontSize: TINY ? 12 : 13, marginTop: TINY ? 2 : 4 }]}>Good to see you again.</Text>
              </View>
            </View>
          </Animated.View>

          {/* ── Illustration ─────────────────────────────────────────────── */}
          {showIllo && (
            <Animated.View
              style={[s.illoWrap, {
                height: illoHeight,
                marginBottom: SMALL ? 16 : 22,
                opacity: illoO,
                transform: [{ scale: illoS }],
                borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              }]}
            >
              <LoginHeroIllustration width={illoWidth - 24} height={illoHeight - 16} />
            </Animated.View>
          )}

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <Animated.View style={{ opacity: frmO, transform: [{ translateY: frmY }] }}>

            <FloatInput label="Email"    iconName="mail-outline"        value={email}    onChangeText={setEmail}    keyboardType="email-address" />
            <FloatInput label="Password" iconName="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />

            {/* Forgot password */}
            <TouchableOpacity
              style={[s.forgot, { marginBottom: TINY ? 14 : SMALL ? 18 : 22 }]}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={[s.forgotTxt, { color: theme.hint, fontSize: TINY ? 11 : 12 }]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In */}
            <TouchableOpacity
              style={[s.signBtn, { height: BTN_H, marginBottom: TINY ? 8 : 10 }, loading && s.dimmed, { overflow: 'hidden' }]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading || bioLoading}
            >
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)'] : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.shimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
              <Text style={[s.signBtnTxt, { color: theme.accentFg, fontSize: TINY ? 13 : 14 }]}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={16} color={theme.accentFg} />}
            </TouchableOpacity>

            {/* Biometric */}
            {bioAvailable && bioEnabled && (
              <TouchableOpacity
                style={[
                  s.bioBtn,
                  { height: BTN_H, marginBottom: TINY ? 14 : 20, backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden' },
                  bioLoading && s.dimmed,
                ]}
                onPress={handleBiometricLogin}
                disabled={bioLoading || loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name={bioLoading ? 'hourglass-outline' : bioIcon} size={18} color={theme.foreground} />
                <Text style={[s.bioTxt, { color: theme.foreground, fontSize: TINY ? 12 : 13 }]}>
                  {bioLoading ? 'Verifying…' : `Sign in with ${bioLabel}`}
                </Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            {(!bioAvailable || !bioEnabled) && (
              <View style={[s.divRow, { marginVertical: TINY ? 10 : 14 }]}>
                <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
                <Text style={[s.divTxt, { color: theme.hint }]}>or</Text>
                <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
              </View>
            )}
            {bioAvailable && bioEnabled && (
              <View style={[s.divRow, { marginBottom: TINY ? 10 : 14, marginTop: 0 }]}>
                <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
                <Text style={[s.divTxt, { color: theme.hint }]}>or</Text>
                <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
              </View>
            )}

            {/* Register */}
            <TouchableOpacity
              style={[
                s.regBtn,
                { height: BTN_H, backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden' },
              ]}
              onPress={() => navigation.navigate('Register')}
            >
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[s.regTxt, { color: theme.hint, fontSize: TINY ? 12 : 13 }]}>
                New to Diakite?{'  '}
                <Text style={[s.regBold, { color: theme.foreground }]}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:  { flex: 1 },
  orb1:  { position: 'absolute', width: width * 1.3, height: width * 1.3, borderRadius: width * 0.65, top: -width * 0.8, alignSelf: 'center' },
  orb2:  { position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, bottom: -width * 0.2, left: -width * 0.1 },
  scroll: { flexGrow: 1 },

  // Header
  header:       { marginBottom: TINY ? 14 : SMALL ? 18 : 22 },
  logoBadge:    { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E5E5', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 5 },
  pillTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillDot:      { width: 5, height: 5, borderRadius: 3 },
  eyebrow:      { fontSize: 9, letterSpacing: 3.5, fontWeight: '800' },
  title:        { fontWeight: '900', letterSpacing: -0.8 },
  subtitle:     { fontWeight: '300' },

  // Illustration
  illoWrap: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },

  // Form
  forgot:    { alignSelf: 'flex-end' },
  forgotTxt: { fontWeight: '500' },

  signBtn:    { borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, overflow: 'hidden' },
  shimmer:    { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  dimmed:     { opacity: 0.5 },
  signBtnTxt: { fontWeight: '800', letterSpacing: 0.3 },

  bioBtn: { borderRadius: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  bioTxt: { fontWeight: '700' },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divLine:{ flex: 1, height: 1 },
  divTxt: { fontSize: 12 },

  regBtn: { borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  regTxt: {},
  regBold:{ fontWeight: '700' },
});