// mobile/src/screens/Auth/RegisterScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useAuth }        from '../../context/AuthContext';
import { useTheme }       from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

// ── Phone formatter for Nigerian numbers ─────────────────────────────────────
const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11)  return `+234${digits.slice(1)}`;
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (/^[7-9]\d{9}$/.test(digits))                     return `+234${digits}`;
  return raw;
};

const ROLES = [
  { id: 'CUSTOMER', label: 'Rider', emoji: '🧑‍💼', sub: 'Book rides & send packages' },
  { id: 'DRIVER', label: 'Driver', emoji: '🚗', sub: 'Drive passengers and earn' },
  { id: 'DELIVERY_PARTNER', label: 'Courier', emoji: '🛵', sub: 'Deliver packages daily' },
];

export default function RegisterScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { register } = useAuth();

  const [step,    setStep]    = useState(1);
  const [roleId,  setRoleId]  = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,   setLoading]   = useState(false);

  const slideO = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(36)).current;

  const animateIn = () => {
    slideO.setValue(0);
    slideY.setValue(36);
    Animated.parallel([
      Animated.timing(slideO, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  };
  useEffect(() => { animateIn(); }, []);

  const activeRole = ROLES.find(r => r.id === roleId);

  const handleFinalRegister = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      return Alert.alert('Missing Fields', 'Please enter your full name');
    }
    if (!email.trim() || !email.includes('@')) {
      return Alert.alert('Invalid Email', 'Please enter a valid email');
    }
    if (!phone.trim()) {
      return Alert.alert('Missing Phone', 'Please enter your phone number');
    }
    if (password.length < 8) {
      return Alert.alert('Weak Password', 'Password must be at least 8 characters');
    }
    if (password !== confirmPassword) {
      return Alert.alert('Password Mismatch', 'Passwords do not match. Please re-enter.');
    }
    if (!roleId) {
      return Alert.alert('Select Role', 'Please choose a role');
    }

    setLoading(true);
    try {
      const res = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: formatPhone(phone.trim()),
        password,
        role: roleId,
      });

      if (!res.success) {
        Alert.alert('Registration Failed', res.message || 'Please try again');
        return;
      }

      if (res.requiresOtp) {
        navigation.navigate('OtpVerification', {
          tempToken: res.tempToken,
          method: res.method,
          maskedContact: res.maskedContact,
          purpose: 'REGISTER',
        });
        return;
      }

      Alert.alert('Success 🎉', 'Your account has been created!');
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived theme helpers ──────────────────────────────────────────────────
  const isDark       = mode === 'dark';
  const cardBg        = theme.backgroundAlt || theme.card;
  const borderColor   = theme.border;
  const inputBg       = theme.backgroundAlt || theme.card;
  const primaryBg     = theme.accent;
  const primaryFg     = theme.accentFg;
  const selectedBg    = theme.accent + '15';          // subtle accent tint
  const selectedBorder= theme.accent;
  const bannerBg      = theme.backgroundAlt || theme.card;
  const bannerBorder  = theme.border;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.foreground} />
          </TouchableOpacity>

          <Text style={[s.title, { color: theme.foreground }]}>Create Account</Text>
          <Text style={[s.subtitle, { color: theme.hint }]}>Step {step} of 2</Text>

          {/* Step 1: Choose Role */}
          {step === 1 && (
            <>
              <Text style={[s.sectionTitle, { color: theme.foreground }]}>Choose your role</Text>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    s.roleCard,
                    {
                      backgroundColor: cardBg,
                      borderColor:     roleId === role.id ? selectedBorder : borderColor,
                    },
                    roleId === role.id && { backgroundColor: selectedBg },
                  ]}
                  onPress={() => setRoleId(role.id)}
                >
                  <Text style={s.roleEmoji}>{role.emoji}</Text>
                  <Text style={[s.roleLabel, { color: theme.foreground }]}>{role.label}</Text>
                  <Text style={[s.roleSub, { color: theme.hint }]}>{role.sub}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  { backgroundColor: roleId ? primaryBg : borderColor },
                  loading && s.btnDisabled,
                ]}
                onPress={() => setStep(2)}
                disabled={!roleId}
              >
                <Text style={[s.primaryBtnText, { color: roleId ? primaryFg : theme.hint }]}>Continue →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: Personal Details */}
          {step === 2 && (
            <>
              {activeRole && (
                <View style={[s.roleBanner, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
                  <Text style={s.roleBannerEmoji}>{activeRole.emoji}</Text>
                  <Text style={[s.roleBannerText, { color: theme.foreground }]}>
                    Registering as {activeRole.label}
                  </Text>
                </View>
              )}

              {[
                { placeholder: 'First Name',    value: firstName, setter: setFirstName, autoCapitalize: 'words' },
                { placeholder: 'Last Name',     value: lastName,  setter: setLastName,  autoCapitalize: 'words' },
                { placeholder: 'Email Address', value: email,     setter: setEmail,     autoCapitalize: 'none',   keyboardType: 'email-address' },
                { placeholder: 'Phone Number',  value: phone,     setter: setPhone,     autoCapitalize: 'none',   keyboardType: 'phone-pad' },
              ].map((field) => (
                <TextInput
                  key={field.placeholder}
                  style={[
                    s.input,
                    {
                      color:           theme.foreground,
                      backgroundColor: inputBg,
                      borderColor:     borderColor,
                    },
                  ]}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.hint}
                  value={field.value}
                  onChangeText={field.setter}
                  autoCapitalize={field.autoCapitalize || 'none'}
                  keyboardType={field.keyboardType || 'default'}
                  autoCorrect={false}
                />
              ))}

              <TextInput
                style={[
                  s.input,
                  {
                    color:           theme.foreground,
                    backgroundColor: inputBg,
                    borderColor:     borderColor,
                  },
                ]}
                placeholder="Password (min 8 characters)"
                placeholderTextColor={theme.hint}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />

              <TextInput
                style={[
                  s.input,
                  {
                    color:           theme.foreground,
                    backgroundColor: inputBg,
                    borderColor:     borderColor,
                  },
                ]}
                placeholder="Confirm password"
                placeholderTextColor={theme.hint}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  { backgroundColor: primaryBg },
                  loading && s.btnDisabled,
                ]}
                onPress={handleFinalRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={primaryFg} />
                ) : (
                  <Text style={[s.primaryBtnText, { color: primaryFg }]}>Create Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep(1)} style={s.backLink}>
                <Text style={{ color: theme.hint }}>← Change Role</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60 },
  back: { alignSelf: 'flex-start', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  roleCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  roleEmoji: { fontSize: 32, marginBottom: 8 },
  roleLabel: { fontSize: 18, fontWeight: '700' },
  roleSub: { fontSize: 14 },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  roleBannerEmoji: { fontSize: 28 },
  roleBannerText: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  primaryBtn: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  backLink: { marginTop: 24, alignItems: 'center' },
});