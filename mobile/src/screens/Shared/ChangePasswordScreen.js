// mobile/src/screens/Shared/ChangePasswordScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { userAPI } from '../../services/api';

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
  if (pwd.length >= 8)              score++;
  if (/[A-Z]/.test(pwd))            score++;
  if (/[0-9]/.test(pwd))            score++;
  if (/[^A-Za-z0-9]/.test(pwd))     score++;
  return score; // 0–4
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

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ChangePasswordScreen({ navigation }) {
  const { theme, mode }   = useTheme();
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const rules = [
    { met: next.length >= 8,              text: 'At least 8 characters' },
    { met: /[A-Z]/.test(next),            text: 'One uppercase letter'  },
    { met: /[0-9]/.test(next),            text: 'One number'            },
    { met: /[^A-Za-z0-9]/.test(next),     text: 'One special character' },
  ];

  const allRulesMet = rules.every(r => r.met);
  const passwordsMatch = next === confirm && next.length > 0;
  const canSubmit = current.length > 0 && allRulesMet && passwordsMatch;

  const handleChange = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await userAPI.updatePassword({ currentPassword: current, newPassword: next });
      setSuccess(true);
      setTimeout(() => {
        navigation.goBack();
      }, 1600);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={theme.muted} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>Change Password</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

            {/* Icon */}
            <View style={[s.iconWrap, { backgroundColor: theme.accent + '14', borderColor: theme.accent + '25' }]}>
              <Ionicons name="lock-closed-outline" size={28} color={theme.accent} />
            </View>
            <Text style={[s.intro, { color: theme.muted }]}>
              Choose a strong password you don't use elsewhere.
            </Text>

            {/* Current password */}
            <Text style={[s.sectionLabel, { color: theme.hint }]}>CURRENT PASSWORD</Text>
            <PwdInput label="Current Password" iconName="lock-closed-outline" value={current} onChangeText={setCurrent} />

            {/* New password */}
            <Text style={[s.sectionLabel, { color: theme.hint, marginTop: 4 }]}>NEW PASSWORD</Text>
            <PwdInput label="New Password" iconName="key-outline" value={next} onChangeText={setNext} />
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
                { backgroundColor: success ? '#5DAA72' : theme.accent, shadowColor: theme.accent },
                !canSubmit && !loading && { opacity: 0.4 },
              ]}
              onPress={handleChange}
              disabled={!canSubmit || loading || success}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name={success ? 'checkmark' : 'shield-checkmark-outline'} size={18} color="#FFFFFF" />
                  <Text style={s.submitTxt}>{success ? 'Password Updated!' : 'Update Password'}</Text>
                </>
              )}
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:      { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700' },
  scroll:       { paddingHorizontal: 24, paddingBottom: 56, paddingTop: 28 },

  iconWrap:     { width: 66, height: 66, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  intro:        { fontSize: 13, lineHeight: 20, marginBottom: 28 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },

  inputBox:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, marginBottom: 12, height: 60, paddingHorizontal: 14 },
  inputIcon:    { marginRight: 10 },
  floatLabel:   { position: 'absolute', left: 0 },
  inputText:    { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '400' },
  eyeBtn:       { padding: 6, marginLeft: 4 },

  matchRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 16 },
  matchTxt:     { fontSize: 12, fontWeight: '600' },

  rulesCard:    { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 24 },
  rulesTitle:   { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },

  submitBtn:    { borderRadius: 13, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 },
  submitTxt:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});