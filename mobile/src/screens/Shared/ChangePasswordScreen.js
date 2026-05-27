// mobile/src/screens/Shared/ChangePasswordScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, StatusBar, ActivityIndicator, Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { userAPI }           from '../../services/api';

const { height } = Dimensions.get('window');

// ── Password input ────────────────────────────────────────────────────────────
const PwdInput = ({ label, iconName, value, onChangeText }) => {
  const { theme } = useTheme();
  const [focused,  setFocused]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 170, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 170, useNativeDriver: false }).start();
  }, [focused, value]);

  const borderColor = borderV.interpolate({ inputRange: [0, 1], outputRange: [theme.border, theme.accent] });
  const top         = labelY.interpolate({ inputRange: [0, 1], outputRange: [18, 7] });
  const fontSize    = labelY.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const lColor      = labelY.interpolate({ inputRange: [0, 1], outputRange: [theme.hint, focused ? theme.accent : theme.muted] });

  return (
    <Animated.View style={[s.inputBox, { backgroundColor: theme.backgroundAlt, borderColor }]}>
      <Ionicons name={iconName} size={16} color={focused ? theme.accent : theme.hint} style={s.inputIcon} />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={[s.inputText, { color: theme.foreground }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          secureTextEntry={!showPwd}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
      <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.eyeBtn}>
        <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.hint} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Strength bar ──────────────────────────────────────────────────────────────
function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)          score++;
  if (/[A-Z]/.test(pwd))        score++;
  if (/[0-9]/.test(pwd))        score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#E05555', '#C9A96E', '#5DAA72', '#5DAA72'];

const StrengthBar = ({ password, theme }) => {
  const score = password.length ? getStrength(password) : 0;
  if (!password.length) return null;
  return (
    <View style={sb.wrap}>
      <View style={sb.barRow}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[sb.seg, { backgroundColor: i <= score ? STRENGTH_COLORS[score] : theme.border }]} />
        ))}
      </View>
      <Text style={[sb.label, { color: STRENGTH_COLORS[score] }]}>{STRENGTH_LABELS[score]}</Text>
    </View>
  );
};
const sb = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, marginBottom: 14 },
  barRow: { flex: 1, flexDirection: 'row', gap: 4 },
  seg:    { flex: 1, height: 3, borderRadius: 2 },
  label:  { fontSize: 11, fontWeight: '700', width: 44, textAlign: 'right' },
});

// ── Rule row ──────────────────────────────────────────────────────────────────
const Rule = ({ met, text, theme }) => (
  <View style={r.row}>
    <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={met ? '#5DAA72' : theme.hint} />
    <Text style={[r.txt, { color: met ? '#5DAA72' : theme.hint }]}>{text}</Text>
  </View>
);
const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  txt: { fontSize: 12, fontWeight: '500' },
});

// ── Success Screen ────────────────────────────────────────────────────────────
const SuccessScreen = ({ theme, onDone }) => {
  const scaleA  = useRef(new Animated.Value(0.6)).current;
  const fadeA   = useRef(new Animated.Value(0)).current;
  const slideA  = useRef(new Animated.Value(30)).current;
  const ringA   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Icon bounces in
    Animated.spring(scaleA, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    // Text fades + slides up with a slight delay
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true }),
    ]).start();
    // Ring pulses in
    Animated.timing(ringA, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
  }, []);

  const ringScale  = ringA.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const ringOpacity = ringA.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });

  return (
    <View style={ss.root}>
      {/* Outer decorative ring */}
      <Animated.View style={[ss.ring, { borderColor: '#5DAA72', transform: [{ scale: ringScale }], opacity: ringOpacity }]} />

      {/* Icon circle */}
      <Animated.View style={[ss.iconCircle, { backgroundColor: '#5DAA7218', borderColor: '#5DAA7235', transform: [{ scale: scaleA }] }]}>
        <Ionicons name="checkmark-circle" size={64} color="#5DAA72" />
      </Animated.View>

      <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }], alignItems: 'center' }}>
        <Text style={[ss.title, { color: theme.foreground }]}>Password Changed!</Text>
        <Text style={[ss.sub, { color: theme.hint }]}>
          Your password has been updated successfully.{'\n'}Keep it safe and don't share it with anyone.
        </Text>

        {/* Security tip card */}
        <View style={[ss.tipCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <Ionicons name="shield-outline" size={15} color={theme.hint} style={{ marginTop: 1 }} />
          <Text style={[ss.tipTxt, { color: theme.hint }]}>
            You'll stay logged in on this device. Other sessions may require you to sign in again.
          </Text>
        </View>

        <TouchableOpacity
          style={[ss.btn, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back-outline" size={18} color={theme.accentFg} />
          <Text style={[ss.btnTxt, { color: theme.accentFg }]}>Back to Settings</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};
const ss = StyleSheet.create({
  root:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  ring:       { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 30 },
  iconCircle: { width: 110, height: 110, borderRadius: 35, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  title:      { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', marginBottom: 12 },
  sub:        { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  tipCard:    { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 32, alignSelf: 'stretch' },
  tipTxt:     { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  btn:        { borderRadius: 14, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, alignSelf: 'stretch', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 },
  btnTxt:     { fontSize: 16, fontWeight: '700' },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ChangePasswordScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [otpStep,     setOtpStep]     = useState(false);
  const [otpCode,     setOtpCode]     = useState('');
  const [tempToken,   setTempToken]   = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [headerH, setHeaderH] = useState(56);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const rules = [
    { met: next.length >= 8,          text: 'At least 8 characters' },
    { met: /[A-Z]/.test(next),        text: 'One uppercase letter'  },
    { met: /[0-9]/.test(next),        text: 'One number'            },
    { met: /[^A-Za-z0-9]/.test(next), text: 'One special character' },
  ];

  const allRulesMet    = rules.every(r => r.met);
  const passwordsMatch = next === confirm && next.length > 0;
  const canSubmit      = current.length > 0 && allRulesMet && passwordsMatch;

  // Pull-to-refresh just resets the form
  const onRefresh = () => {
    setRefreshing(true);
    setCurrent('');
    setNext('');
    setConfirm('');
    setOtpCode('');
    setOtpStep(false);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleChange = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await userAPI.updatePassword({ currentPassword: current, newPassword: next });
      if (res?.requiresOtp) {
        setTempToken(res.data.tempToken);
        setMaskedEmail(res.data.maskedEmail ?? '');
        setMaskedPhone(res.data.maskedPhone ?? '');
        setOtpStep(true);
      } else {
        setSuccess(true);
      }
    } catch (e) {
      Alert.alert('Error', e?.message ?? e?.error ?? 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    setLoading(true);
    try {
      await userAPI.verifyPasswordChangeOtp({ code: otpCode, tempToken, newPassword: next });
      setSuccess(true);
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const kvoOffset = headerH;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <View
        style={[s.header, {
          paddingTop:        insets.top + 10,
          backgroundColor:   theme.background,
          borderBottomColor: theme.border,
        }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>Change Password</Text>
        <View style={s.headerSpacer} />
      </View>

      {/* ── Success screen — rendered OUTSIDE the KAV/scroll so it fills the space ── */}
      {success ? (
        <SuccessScreen theme={theme} onDone={() => navigation.goBack()} />
      ) : (
        /* ── KAV wraps ONLY the scroll container below the header ─────────── */
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={kvoOffset}
        >
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.accent}
                colors={[theme.accent]}
              />
            }
          >
            {otpStep ? (
              /* ── OTP verification step ── */
              <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>
                <View style={[s.iconWrap, { backgroundColor: theme.accent + '14', borderColor: theme.accent + '25' }]}>
                  <Ionicons name="shield-checkmark-outline" size={28} color={theme.accent} />
                </View>
                <Text style={[s.intro, { color: theme.foreground, fontWeight: '700', marginBottom: 6 }]}>
                  Verify it's you
                </Text>
                <Text style={[s.intro, { color: theme.hint }]}>
                  A code was sent to{' '}
                  {maskedEmail ? <Text style={{ color: theme.foreground }}>{maskedEmail}</Text> : null}
                  {maskedEmail && maskedPhone ? ' and ' : ''}
                  {maskedPhone ? <Text style={{ color: theme.foreground }}>{maskedPhone}</Text> : null}
                </Text>

                <Text style={[s.sectionLabel, { color: theme.hint, marginTop: 12 }]}>VERIFICATION CODE</Text>
                <Animated.View style={[s.inputBox, { backgroundColor: theme.backgroundAlt, borderColor: theme.accent }]}>
                  <Ionicons name="key-outline" size={16} color={theme.accent} style={s.inputIcon} />
                  <TextInput
                    style={[s.inputText, { color: theme.foreground, paddingTop: 4 }]}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={theme.hint}
                    autoFocus
                  />
                </Animated.View>

                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    { backgroundColor: theme.accent, shadowColor: theme.accent },
                    (!otpCode.trim() || loading) && { opacity: 0.4 },
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={!otpCode.trim() || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={theme.accentFg} size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={18} color={theme.accentFg} />
                      <Text style={[s.submitTxt, { color: theme.accentFg }]}>Confirm Change</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setOtpStep(false)} style={{ alignItems: 'center', marginTop: 16 }}>
                  <Text style={{ color: theme.hint, fontSize: 13 }}>← Go back</Text>
                </TouchableOpacity>
              </Animated.View>

            ) : (
              <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

                {/* Icon */}
                <View style={[s.iconWrap, { backgroundColor: theme.accent + '14', borderColor: theme.accent + '25' }]}>
                  <Ionicons name="lock-closed-outline" size={28} color={theme.accent} />
                </View>
                <Text style={[s.intro, { color: theme.hint }]}>
                  Choose a strong password you don't use elsewhere.
                </Text>

                {/* Current password */}
                <Text style={[s.sectionLabel, { color: theme.hint }]}>CURRENT PASSWORD</Text>
                <PwdInput label="Current Password" iconName="lock-closed-outline" value={current} onChangeText={setCurrent} />

                {/* New password */}
                <Text style={[s.sectionLabel, { color: theme.hint, marginTop: 4 }]}>NEW PASSWORD</Text>
                <PwdInput label="New Password"         iconName="key-outline" value={next}    onChangeText={setNext}    />
                <StrengthBar password={next} theme={theme} />
                <PwdInput label="Confirm New Password" iconName="key-outline" value={confirm} onChangeText={setConfirm} />

                {/* Match indicator */}
                {confirm.length > 0 && (
                  <View style={s.matchRow}>
                    <Ionicons
                      name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                      size={13}
                      color={passwordsMatch ? '#5DAA72' : '#E05555'}
                    />
                    <Text style={[s.matchTxt, { color: passwordsMatch ? '#5DAA72' : '#E05555' }]}>
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}

                {/* Rules */}
                <View style={[s.rulesCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Text style={[s.rulesTitle, { color: theme.hint }]}>PASSWORD REQUIREMENTS</Text>
                  {rules.map(rule => <Rule key={rule.text} met={rule.met} text={rule.text} theme={theme} />)}
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    { backgroundColor: theme.accent, shadowColor: theme.accent },
                    !canSubmit && !loading && { opacity: 0.4 },
                  ]}
                  onPress={handleChange}
                  disabled={!canSubmit || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={theme.accentFg} size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={18} color={theme.accentFg} />
                      <Text style={[s.submitTxt, { color: theme.accentFg }]}>Update Password</Text>
                    </>
                  )}
                </TouchableOpacity>

              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Sticky header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn:      { width: 38, height: 38, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 38 },

  // ── Scroll content ─────────────────────────────────────────────────────────
  scroll: { paddingHorizontal: 24, paddingTop: 28 },

  iconWrap:     { width: 66, height: 66, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  intro:        { fontSize: 13, lineHeight: 20, marginBottom: 28 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },

  inputBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, marginBottom: 12, height: 60, paddingHorizontal: 14 },
  inputIcon:  { marginRight: 10 },
  floatLabel: { position: 'absolute', left: 0 },
  inputText:  { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '400' },
  eyeBtn:     { padding: 6, marginLeft: 4 },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 16 },
  matchTxt: { fontSize: 12, fontWeight: '600' },

  rulesCard:  { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 24 },
  rulesTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },

  submitBtn: {
    borderRadius: 13, height: 54, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8,
  },
  submitTxt: { fontSize: 16, fontWeight: '700' },
});