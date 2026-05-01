// mobile/src/screens/Auth/RegisterScreen.js
// ── Onyx Premium Edition — matches & elevates LoginScreen ────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useAuth }        from '../../context/AuthContext';
import { useTheme }       from '../../context/ThemeContext';

const { width } = Dimensions.get('window');
const LOGO = require('../../../assets/diakite_dark.png');

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.80)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
};

// ── Phone formatter for Nigerian numbers ──────────────────────────────────────
const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11)   return `+234${digits.slice(1)}`;
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (/^[7-9]\d{9}$/.test(digits))                      return `+234${digits}`;
  return raw;
};

const ROLES = [
  {
    id: 'CUSTOMER',
    label: 'Rider',
    sub: 'Book rides & send packages',
    icon: 'person-outline',
    accent: '#6366F1',
  },
  {
    id: 'DRIVER',
    label: 'Driver',
    sub: 'Drive passengers and earn',
    icon: 'car-sport-outline',
    accent: '#10B981',
  },
  {
    id: 'DELIVERY_PARTNER',
    label: 'Courier',
    sub: 'Deliver packages daily',
    icon: 'bicycle-outline',
    accent: '#F59E0B',
  },
];

// ── Glass Float Input (mirrors LoginScreen) ───────────────────────────────────
const FloatInput = ({
  label, iconName, value, onChangeText,
  keyboardType, secureTextEntry, autoCapitalize,
}) => {
  const { theme, mode } = useTheme();
  const [focused,  setFocused]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 180, useNativeDriver: false }),
      Animated.timing(borderA, { toValue: focused ? 1 : 0,          duration: 200, useNativeDriver: false }),
    ]).start();
  }, [focused, value]);

  const top    = labelY.interpolate({ inputRange: [0, 1], outputRange: [19, 7] });
  const fSize  = labelY.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const lColor = labelY.interpolate({ inputRange: [0, 1], outputRange: [theme.hint, mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'] });
  const borderC = borderA.interpolate({ inputRange: [0, 1], outputRange: [G.border(mode), mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.20)'] });

  return (
    <Animated.View style={[s.inputBox, { backgroundColor: G.card(mode), borderColor: borderC }]}>
      <LinearGradient
        colors={mode === 'dark'
          ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
          : ['rgba(255,255,255,0.9)',  'rgba(255,255,255,0.75)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons
        name={iconName} size={16}
        color={focused
          ? (mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)')
          : theme.hint}
        style={s.inputIcon}
      />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize: fSize, color: lColor }]}>
          {label}
        </Animated.Text>
        <TextInput
          style={[s.inputText, { color: theme.foreground }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          secureTextEntry={secureTextEntry && !showPwd}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.eyeBtn}>
          <Ionicons
            name={showPwd ? 'eye-off-outline' : 'eye-outline'}
            size={16} color={theme.hint}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { register }    = useAuth();
  const darkMode        = mode === 'dark';

  const [step,            setStep]            = useState(1);
  const [roleId,          setRoleId]          = useState(null);
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);

  // ── Entrance animation ────────────────────────────────────────────────────
  const hdrO = useRef(new Animated.Value(0)).current;
  const hdrY = useRef(new Animated.Value(-32)).current;
  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(32)).current;

  const animateIn = () => {
    hdrO.setValue(0); hdrY.setValue(-32);
    frmO.setValue(0); frmY.setValue(32);
    Animated.parallel([
      Animated.timing(hdrO, { toValue: 1, duration: 600,             useNativeDriver: true }),
      Animated.timing(hdrY, { toValue: 0, duration: 600,             useNativeDriver: true }),
      Animated.timing(frmO, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { animateIn(); }, []);

  const activeRole = ROLES.find(r => r.id === roleId);

  // ── Step transition animation ─────────────────────────────────────────────
  const goToStep2 = () => {
    if (!roleId) return;
    frmO.setValue(0);
    frmY.setValue(24);
    setStep(2);
    Animated.parallel([
      Animated.timing(frmO, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const goToStep1 = () => {
    frmO.setValue(0);
    frmY.setValue(-24);
    setStep(1);
    Animated.parallel([
      Animated.timing(frmO, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleFinalRegister = async () => {
    if (!firstName.trim() || !lastName.trim())
      return Alert.alert('Missing Fields', 'Please enter your full name.');
    if (!email.trim() || !email.includes('@'))
      return Alert.alert('Invalid Email', 'Please enter a valid email address.');
    if (!phone.trim())
      return Alert.alert('Missing Phone', 'Please enter your phone number.');
    if (password.length < 8)
      return Alert.alert('Weak Password', 'Password must be at least 8 characters.');
    if (password !== confirmPassword)
      return Alert.alert('Password Mismatch', 'Passwords do not match. Please re-enter.');
    if (!roleId)
      return Alert.alert('Select Role', 'Please choose a role.');

    setLoading(true);
    try {
      const res = await register({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim().toLowerCase(),
        phone:     formatPhone(phone.trim()),
        password,
        role:      roleId,
      });

      if (!res.success) {
        Alert.alert('Registration Failed', res.message || 'Please try again.');
        return;
      }

      if (res.requiresOtp) {
        navigation.navigate('OtpVerification', {
          tempToken:     res.tempToken,
          method:        res.method,
          maskedContact: res.maskedContact,
          purpose:       'REGISTER',
        });
        return;
      }

      Alert.alert('Welcome to Diakite 🎉', 'Your account has been created!');
    } catch (err) {
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator ────────────────────────────────────────────────────────
  const StepDots = () => (
    <View style={s.stepDots}>
      {[1, 2].map(n => (
        <View
          key={n}
          style={[
            s.stepDot,
            {
              backgroundColor: n === step
                ? (darkMode ? '#fff' : '#000')
                : G.border(mode),
              width: n === step ? 20 : 6,
            },
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Ambient orbs — same as LoginScreen */}
      <View style={[s.orb1, { backgroundColor: darkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)' }]} />
      <View style={[s.orb2, { backgroundColor: darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <Animated.View style={[s.header, { opacity: hdrO, transform: [{ translateY: hdrY }] }]}>
            {/* Back + Logo row */}
            <View style={s.topRow}>
              <TouchableOpacity
                style={[s.backBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={darkMode
                    ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']
                    : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="arrow-back" size={18} color={theme.foreground} />
              </TouchableOpacity>

              <View style={[s.logoBadge, { backgroundColor: '#FFFFFF', borderColor: '#E5E5E5' }]}>
                <Image source={LOGO} style={s.logoImg} resizeMode="contain" />
              </View>

              <StepDots />
            </View>

            <View style={[s.pill, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
              <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
              <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>
                {step === 1 ? 'GET STARTED' : 'YOUR DETAILS'}
              </Text>
            </View>

            <Text style={[s.title, { color: theme.foreground }]}>
              {step === 1 ? 'Choose your\nrole' : 'Create your\naccount'}
            </Text>
            <Text style={[s.subtitle, { color: theme.hint }]}>
              {step === 1
                ? 'How will you use Diakite?'
                : `Registering as ${activeRole?.label ?? ''}`}
            </Text>
          </Animated.View>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <Animated.View style={{ opacity: frmO, transform: [{ translateY: frmY }] }}>

            {/* ── STEP 1: Role selection ─────────────────────────────────── */}
            {step === 1 && (
              <>
                {ROLES.map((role, idx) => {
                  const sel = roleId === role.id;
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        s.roleCard,
                        {
                          backgroundColor: G.card(mode),
                          borderColor: sel ? role.accent : G.border(mode),
                          overflow: 'hidden',
                        },
                        sel && { borderWidth: 1.5 },
                      ]}
                      onPress={() => setRoleId(role.id)}
                      activeOpacity={0.82}
                    >
                      <LinearGradient
                        colors={darkMode
                          ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']
                          : ['rgba(255,255,255,0.9)',  'rgba(255,255,255,0.7)']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      {/* Accent strip */}
                      {sel && (
                        <View style={[s.roleAccentStrip, { backgroundColor: role.accent + '22' }]} />
                      )}
                      <View style={[s.roleIconBox, { backgroundColor: role.accent + (sel ? '20' : '12') }]}>
                        <Ionicons name={role.icon} size={22} color={role.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.roleLabel, { color: theme.foreground }]}>{role.label}</Text>
                        <Text style={[s.roleSub,   { color: theme.hint       }]}>{role.sub}</Text>
                      </View>
                      <View style={[
                        s.radioOuter,
                        { borderColor: sel ? role.accent : G.border(mode) },
                      ]}>
                        {sel && <View style={[s.radioInner, { backgroundColor: role.accent }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    { overflow: 'hidden', opacity: roleId ? 1 : 0.4 },
                  ]}
                  onPress={goToStep2}
                  disabled={!roleId}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={darkMode
                      ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)']
                      : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[s.btnShimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
                  <Text style={[s.primaryBtnTxt, { color: theme.accentFg }]}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.accentFg} />
                </TouchableOpacity>

                {/* Sign in link */}
                <TouchableOpacity
                  style={[s.altBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden' }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <LinearGradient
                    colors={darkMode
                      ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']
                      : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[s.altTxt, { color: theme.hint }]}>
                    Already have an account?{'  '}
                    <Text style={[s.altBold, { color: theme.foreground }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2: Personal details ───────────────────────────────── */}
            {step === 2 && (
              <>
                {/* Role badge */}
                {activeRole && (
                  <View style={[s.rolePill, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow: 'hidden' }]}>
                    <LinearGradient
                      colors={darkMode
                        ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']
                        : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[s.rolePillIcon, { backgroundColor: activeRole.accent + '20' }]}>
                      <Ionicons name={activeRole.icon} size={14} color={activeRole.accent} />
                    </View>
                    <Text style={[s.rolePillTxt, { color: theme.hint }]}>
                      {activeRole.label}
                    </Text>
                    <TouchableOpacity onPress={goToStep1} style={s.changeRoleBtn}>
                      <Text style={[s.changeRoleTxt, { color: activeRole.accent }]}>Change</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Name row */}
                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}>
                    <FloatInput
                      label="First Name"
                      iconName="person-outline"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatInput
                      label="Last Name"
                      iconName="person-outline"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <FloatInput
                  label="Email Address"
                  iconName="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                <FloatInput
                  label="Phone Number"
                  iconName="call-outline"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                {/* Divider */}
                <View style={s.divRow}>
                  <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
                  <Text style={[s.divTxt, { color: theme.hint }]}>security</Text>
                  <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
                </View>

                <FloatInput
                  label="Password (min 8 characters)"
                  iconName="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <FloatInput
                  label="Confirm Password"
                  iconName="shield-checkmark-outline"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />

                {/* Password match indicator */}
                {confirmPassword.length > 0 && (
                  <View style={s.matchRow}>
                    <Ionicons
                      name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                      size={14}
                      color={password === confirmPassword ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[
                      s.matchTxt,
                      { color: password === confirmPassword ? '#10B981' : '#EF4444' },
                    ]}>
                      {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[s.primaryBtn, { overflow: 'hidden' }, loading && s.btnDim]}
                  onPress={handleFinalRegister}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={darkMode
                      ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)']
                      : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[s.btnShimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
                  {loading
                    ? <ActivityIndicator color={theme.accentFg} />
                    : (
                      <>
                        <Text style={[s.primaryBtnTxt, { color: theme.accentFg }]}>Create Account</Text>
                        <Ionicons name="arrow-forward" size={18} color={theme.accentFg} />
                      </>
                    )
                  }
                </TouchableOpacity>

                <Text style={[s.terms, { color: theme.hint }]}>
                  By creating an account you agree to our{' '}
                  <Text style={{ color: theme.foreground, fontWeight: '600' }}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={{ color: theme.foreground, fontWeight: '600' }}>Privacy Policy</Text>.
                </Text>
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
  scroll: { paddingHorizontal: 32, paddingBottom: 60 },

  // ── Header
  header: { marginTop: Platform.OS === 'ios' ? 72 : 56, marginBottom: 36 },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, gap: 12 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },

  logoBadge: {
    width: 52, height: 52, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  logoImg: { width: 36, height: 26 },

  stepDots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  stepDot:  { height: 6, borderRadius: 3 },

  pill:    { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 16 },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  eyebrow: { fontSize: 10, letterSpacing: 4, fontWeight: '800' },
  title:   { fontSize: 36, fontWeight: '900', letterSpacing: -1, marginBottom: 8, lineHeight: 42 },
  subtitle:{ fontSize: 15, fontWeight: '300' },

  // ── Float input (mirrors LoginScreen)
  inputBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, marginBottom: 12, height: 62, paddingHorizontal: 14, overflow: 'hidden' },
  inputIcon:  { marginRight: 10 },
  floatLabel: { position: 'absolute', left: 0 },
  inputText:  { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '400' },
  eyeBtn:     { padding: 6, marginLeft: 4 },

  // ── Role cards
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, overflow: 'hidden',
  },
  roleAccentStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  roleIconBox:     { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roleLabel:       { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  roleSub:         { fontSize: 12, fontWeight: '400' },
  radioOuter:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner:      { width: 10, height: 10, borderRadius: 5 },

  // ── Primary button (mirrors LoginScreen signBtn)
  primaryBtn: {
    borderRadius: 16, height: 56,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginTop: 8, marginBottom: 14, overflow: 'hidden',
  },
  btnShimmer:  { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  btnDim:      { opacity: 0.5 },

  // ── Alt / Sign in button
  altBtn: { borderRadius: 16, height: 54, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  altTxt: { fontSize: 14 },
  altBold:{ fontWeight: '700' },

  // ── Role pill (step 2)
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20, overflow: 'hidden',
  },
  rolePillIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rolePillTxt:  { flex: 1, fontSize: 14, fontWeight: '600' },
  changeRoleBtn:{ paddingHorizontal: 8, paddingVertical: 4 },
  changeRoleTxt:{ fontSize: 13, fontWeight: '700' },

  // ── Name row
  nameRow: { flexDirection: 'row', gap: 10 },

  // ── Divider
  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 12 },
  divLine:{ flex: 1, height: 1 },
  divTxt: { fontSize: 10, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' },

  // ── Password match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: -4 },
  matchTxt: { fontSize: 12, fontWeight: '500' },

  // ── Terms
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 16, paddingHorizontal: 8 },
});