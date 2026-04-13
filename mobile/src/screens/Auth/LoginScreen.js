// mobile/src/screens/Auth/LoginScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, Dimensions, StatusBar, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

// The Diakite logo is black artwork on a white canvas.
// We always use the dark-logo asset (black marks) because the badge
// background is always white — it never changes with the app theme.
const LOGO = require('../../../assets/diakite_dark.png');

// ── FloatInput ──────────────────────────────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, secureTextEntry }) => {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const labelY = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(labelY, {
      toValue:  focused || value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused, value]);

  const top      = labelY.interpolate({ inputRange: [0, 1], outputRange: [18, 7]  });
  const fontSize = labelY.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const lColor   = labelY.interpolate({
    inputRange:  [0, 1],
    outputRange: [theme.hint, theme.muted ?? theme.hint],
  });

  return (
    <View style={[s.inputBox, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <Ionicons name={iconName} size={16} color={theme.hint} style={s.inputIcon} />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={[s.inputText, { color: theme.foreground }]}
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
        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.eyeBtn}>
          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.hint} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ── MAIN ────────────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { login }       = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const hdrO = useRef(new Animated.Value(0)).current;
  const hdrY = useRef(new Animated.Value(-28)).current;
  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrO, { toValue: 1, duration: 600,             useNativeDriver: true }),
      Animated.timing(hdrY, { toValue: 0, duration: 600,             useNativeDriver: true }),
      Animated.timing(frmO, { toValue: 1, duration: 600, delay: 160, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 600, delay: 160, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    const res = await login({ email: email.trim(), password });
    setLoading(false);
    if (!res.success) Alert.alert('Login Failed', res.message ?? 'Please check your credentials.');
  };

  const accentFg = theme.accentFg ?? '#111111';

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Back ── */}
          <TouchableOpacity
            style={[s.back, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.muted ?? theme.hint} />
          </TouchableOpacity>

          {/* ── Header ── */}
          <Animated.View style={[s.header, { opacity: hdrO, transform: [{ translateY: hdrY }] }]}>

            {/*
              Logo badge — always white background so the black logo artwork
              is legible in both dark and light app modes.
              theme.logoBadgeBg is '#FFFFFF' in every theme variant.
            */}
            <View style={[
              s.logoBadge,
              {
                backgroundColor: theme.logoBadgeBg   ?? '#FFFFFF',
                borderColor:     theme.logoBadgeBorder ?? '#E5E5E5',
                shadowColor:     '#000000',
              },
            ]}>
              <Image
                source={LOGO}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>

            <Text style={[s.eyebrow,  { color: theme.accent }]}>WELCOME BACK</Text>
            <Text style={[s.title,    { color: theme.foreground }]}>Sign in</Text>
            <Text style={[s.subtitle, { color: theme.muted ?? theme.hint }]}>Good to see you again.</Text>
          </Animated.View>

          {/* ── Form ── */}
          <Animated.View style={{ opacity: frmO, transform: [{ translateY: frmY }] }}>

            <FloatInput
              label="Email"
              iconName="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <FloatInput
              label="Password"
              iconName="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={s.forgot}>
              <Text style={[s.forgotTxt, { color: theme.accent }]}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.signBtn,
                loading && s.signBtnDim,
                { backgroundColor: theme.accent, shadowColor: theme.accent },
              ]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={[s.signBtnTxt, { color: accentFg }]}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color={accentFg} />}
            </TouchableOpacity>

            <View style={s.divRow}>
              <View style={[s.divLine, { backgroundColor: theme.border }]} />
              <Text style={[s.divTxt,  { color: theme.hint }]}>or</Text>
              <View style={[s.divLine, { backgroundColor: theme.border }]} />
            </View>

            <TouchableOpacity style={s.regLink} onPress={() => navigation.navigate('Register')}>
              <Text style={[s.regTxt, { color: theme.muted ?? theme.hint }]}>
                New to Diakite?{'  '}
                <Text style={[s.regBold, { color: theme.accent }]}>Create Account</Text>
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  ambientGlow: {
    position: 'absolute',
    width: width * 1.3, height: width * 1.3,
    borderRadius: width * 0.65,
    top: -width * 0.8,
    alignSelf: 'center',
    opacity: 0.06,
  },

  scroll: { paddingHorizontal: 32, paddingBottom: 56 },

  back: {
    marginTop: Platform.OS === 'ios' ? 56 : 40,
    width: 40, height: 40,
    borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
  },

  header: { marginBottom: 40 },

  // White badge — fixed regardless of mode
  logoBadge: {
    width: 72, height: 72,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    // Subtle shadow so the white badge lifts off dark backgrounds
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },

  // Logo sized to show the full wordmark comfortably inside the badge
  logoImg: { width: 52, height: 36 },

  eyebrow:  { fontSize: 10, letterSpacing: 4, fontWeight: '700', marginBottom: 10 },
  title:    { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '300' },

  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5,
    marginBottom: 12, height: 60, paddingHorizontal: 14,
  },
  inputIcon:  { marginRight: 10 },
  floatLabel: { position: 'absolute', left: 0 },
  inputText:  { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '400' },
  eyeBtn:     { padding: 6, marginLeft: 4 },

  forgot:    { alignSelf: 'flex-end', marginBottom: 28, marginTop: 4 },
  forgotTxt: { fontSize: 13, fontWeight: '500' },

  signBtn: {
    borderRadius: 13, height: 54,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18,
    elevation: 10, marginBottom: 32,
  },
  signBtnDim: { opacity: 0.6 },
  signBtnTxt: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  divRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, gap: 12 },
  divLine:{ flex: 1, height: 1 },
  divTxt: { fontSize: 12 },

  regLink: { alignItems: 'center', paddingVertical: 4 },
  regTxt:  { fontSize: 14 },
  regBold: { fontWeight: '600' },
});