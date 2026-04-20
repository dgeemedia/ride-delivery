// mobile/src/screens/Auth/OtpVerificationScreen.js
// ── 2FA OTP entry screen — glass / onyx theme ─────────────────────────────────
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useAuth }        from '../../context/AuthContext';
import { useTheme }       from '../../context/ThemeContext';
import { useBiometric }   from '../../hooks/useBiometric';
import { authAPI }        from '../../services/api';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

// ── Individual digit box ──────────────────────────────────────────────────────
const DigitBox = ({ value, focused, mode, theme }) => {
  const darkMode = mode === 'dark';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: value ? 1.06 : 1, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,                 duration: 120, useNativeDriver: true }),
    ]).start();
  }, [value]);

  return (
    <Animated.View style={[
      s.digitBox,
      {
        backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
        borderColor:     focused
          ? (darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)')
          : (darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'),
        transform: [{ scale: scaleAnim }],
      },
    ]}>
      {/* Subtle glass sheen */}
      <LinearGradient
        colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[s.digitTxt, { color: theme.foreground }]}>{value || ''}</Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function OtpVerificationScreen({ navigation, route }) {
  const {
    tempToken,
    method,
    maskedContact,
    purpose = 'LOGIN',   // 'LOGIN' | 'SETUP_2FA' | 'REGISTER'
    onSuccess,           // callback passed from ProfileScreen for SETUP_2FA
  } = route.params ?? {};

  const { theme, mode }                    = useTheme();
  const { verifyOtp, resendOtp, isLoading } = useAuth();
  const { isAvailable, isEnabled, enable }  = useBiometric();
  const darkMode = mode === 'dark';

  const [code,         setCode]         = useState('');
  const [loading,      setLoading]      = useState(false);
  const [resending,    setResending]    = useState(false);
  const [currentToken, setCurrentToken] = useState(tempToken);
  const [cooldown,     setCooldown]     = useState(0);
  const inputRef = useRef(null);

  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(frmO, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    inputRef.current?.focus();
  }, []);

  // ── Resend cooldown ticker ─────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Derived digit array for display boxes ─────────────────────────────────
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? '');

  const handleChangeText = (text) => {
    const sanitised = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(sanitised);
    if (sanitised.length === OTP_LENGTH) handleVerify(sanitised);
  };

  // ── Verify ─────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async (overrideCode) => {
    const finalCode = overrideCode ?? code;
    if (finalCode.length !== OTP_LENGTH) return;

    setLoading(true);

    try {
      // ── SETUP_2FA: confirm 2FA activation ──────────────────────────────────
      if (purpose === 'SETUP_2FA') {
        await authAPI.confirm2FA({
          code:      finalCode,
          tempToken: currentToken,
          method:    method ?? 'SMS',
        });
        setLoading(false);
        Alert.alert(
          '2FA Enabled',
          `Two-factor authentication is now active on your account via ${method === 'EMAIL' ? 'Email' : 'SMS'}.`,
          [{
            text: 'OK',
            onPress: () => {
              onSuccess?.();          // update ProfileScreen state
              navigation.goBack();
            },
          }]
        );
        return;
      }

      // ── LOGIN / REGISTER: standard OTP verify via AuthContext ──────────────
      const res = await verifyOtp(finalCode, currentToken);
      setLoading(false);

      if (!res.success) {
        Alert.alert('Incorrect Code', res.message ?? 'Please try again.');
        setCode('');
        inputRef.current?.focus();
        return;
      }

      // Offer biometric enrollment after first successful OTP login
      if (isAvailable && !isEnabled) {
        Alert.alert(
          'Enable Biometric Login?',
          'Sign in faster next time using Face ID or fingerprint.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Enable', onPress: () => enable(res.token) },
          ]
        );
      }

    } catch (err) {
      setLoading(false);
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
      setCode('');
      inputRef.current?.focus();
    }
  }, [code, currentToken, purpose, method, verifyOtp, isAvailable, isEnabled, enable, onSuccess, navigation]);

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);

    try {
      const res = await resendOtp(currentToken);
      setResending(false);

      if (res.success) {
        setCurrentToken(res.tempToken ?? res.data?.tempToken);
        setCode('');
        setCooldown(RESEND_COOLDOWN);
        inputRef.current?.focus();
      } else {
        Alert.alert('Could not resend', res.message ?? 'Please try again.');
      }
    } catch (err) {
      setResending(false);
      Alert.alert('Could not resend', err?.response?.data?.message ?? 'Please try again.');
    }
  };

  // ── Screen copy based on purpose ───────────────────────────────────────────
  const screenCopy = {
    LOGIN:     { eyebrow: 'VERIFICATION',   title: 'Enter code',       icon: method === 'EMAIL' ? 'mail-outline' : 'phone-portrait-outline' },
    SETUP_2FA: { eyebrow: 'ENABLE 2FA',     title: 'Confirm setup',    icon: 'shield-checkmark-outline' },
    REGISTER:  { eyebrow: 'VERIFY ACCOUNT', title: 'Confirm your account', icon: method === 'EMAIL' ? 'mail-outline' : 'phone-portrait-outline' },
  }[purpose] ?? { eyebrow: 'VERIFICATION', title: 'Enter code', icon: 'phone-portrait-outline' };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient orb */}
      <View style={[s.orb, { backgroundColor: darkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)' }]} />

      {/* Hidden native input captures keyboard */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        style={s.hiddenInput}
        caretHidden
      />

      <Animated.View style={[s.container, { opacity: frmO, transform: [{ translateY: frmY }] }]}>

        {/* Back */}
        <TouchableOpacity
          style={[s.back, { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)', borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>

        {/* Icon badge */}
        <View style={[s.badge, { backgroundColor: '#FFFFFF', borderColor: '#E5E5E5' }]}>
          <Ionicons name={screenCopy.icon} size={28} color="#111" />
        </View>

        {/* Labels */}
        <View style={[s.pill, { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)', borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
          <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
          <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>{screenCopy.eyebrow}</Text>
        </View>

        <Text style={[s.title, { color: theme.foreground }]}>{screenCopy.title}</Text>
        <Text style={[s.subtitle, { color: theme.hint }]}>
          {`A 6-digit code was sent to\n`}
          <Text style={{ color: theme.foreground, fontWeight: '600' }}>{maskedContact}</Text>
        </Text>

        {/* OTP boxes */}
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <View style={s.boxRow}>
            {digits.map((d, i) => (
              <DigitBox
                key={i}
                value={d}
                focused={i === code.length && i < OTP_LENGTH}
                mode={mode}
                theme={theme}
              />
            ))}
          </View>
        </TouchableOpacity>

        {/* Verify button */}
        <TouchableOpacity
          style={[s.verifyBtn, { opacity: (code.length === OTP_LENGTH && !loading) ? 1 : 0.45, overflow: 'hidden' }]}
          onPress={() => handleVerify()}
          disabled={code.length !== OTP_LENGTH || loading}
        >
          <LinearGradient
            colors={darkMode ? ['#ffffff', '#dcdcdc'] : ['#000000', '#1e1e1e']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[s.verifyTxt, { color: darkMode ? '#000' : '#fff' }]}>
            {loading ? 'Verifying…' : 'Verify'}
          </Text>
          {!loading && <Ionicons name="arrow-forward" size={18} color={darkMode ? '#000' : '#fff'} />}
        </TouchableOpacity>

        {/* Resend */}
        <View style={s.resendRow}>
          <Text style={[s.resendLabel, { color: theme.hint }]}>Didn't receive it? </Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || resending}>
            <Text style={[s.resendBtn, { color: cooldown > 0 ? theme.hint : theme.foreground }]}>
              {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  orb:  { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center' },

  hiddenInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },

  container: { paddingHorizontal: 32 },

  back: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },

  badge: {
    width: 68, height: 68, borderRadius: 18, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },

  pill:      { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 14 },
  pillDot:   { width: 5, height: 5, borderRadius: 3 },
  eyebrow:   { fontSize: 10, letterSpacing: 4, fontWeight: '800' },
  title:     { fontSize: 32, fontWeight: '900', letterSpacing: -0.8, marginBottom: 10 },
  subtitle:  { fontSize: 15, fontWeight: '300', lineHeight: 24, marginBottom: 36 },

  boxRow: { flexDirection: 'row', gap: 8, marginBottom: 36, justifyContent: 'center' },
  digitBox: {
    width: 46, height: 58, borderRadius: 12, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  digitTxt: { fontSize: 24, fontWeight: '700' },

  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 16, height: 56, marginBottom: 24,
  },
  verifyTxt: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  resendRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendLabel: { fontSize: 14 },
  resendBtn:   { fontSize: 14, fontWeight: '700' },
});