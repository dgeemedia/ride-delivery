// mobile/src/screens/Auth/RegisterScreen.js
// ── Onyx Premium Edition • Compact Fit-All ───────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, StatusBar, ActivityIndicator, Image,
  Modal,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../context/AuthContext';
import { useTheme }          from '../../context/ThemeContext';
import { RegisterHeroIllustration } from '../../components/ServiceIcons';

const { width, height } = Dimensions.get('window');
const LOGO = require('../../../assets/diakite_dark.png');

// ─── Responsive breakpoints ───────────────────────────────────────────────────
const TINY   = height < 650;
const SMALL  = height < 720;
const MEDIUM = height < 820;

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.80)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
};

// ── Phone formatter ───────────────────────────────────────────────────────────
const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11)   return `+234${digits.slice(1)}`;
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (/^[7-9]\d{9}$/.test(digits))                      return `+234${digits}`;
  return raw;
};

const ROLES = [
  { id: 'CUSTOMER',         label: 'Customer', sub: 'Book rides & send packages', icon: 'person-outline',    accent: '#6366F1' },
  { id: 'DRIVER',           label: 'Driver',   sub: 'Drive passengers and earn',  icon: 'car-sport-outline', accent: '#10B981' },
  { id: 'DELIVERY_PARTNER', label: 'Courier',  sub: 'Deliver packages daily',     icon: 'bicycle-outline',   accent: '#F59E0B' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL CONTENT — full text bundled in app, no login required
// ─────────────────────────────────────────────────────────────────────────────
const TERMS_CONTENT = [
  { type: 'title',   text: 'Terms of Service' },
  { type: 'meta',    text: 'Last updated: May 2025' },
  { type: 'heading', text: '1. Acceptance of Terms' },
  { type: 'body',    text: 'By downloading, registering, or using the Diakite app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.' },
  { type: 'heading', text: '2. Who We Are' },
  { type: 'body',    text: 'Diakite is a technology platform that connects customers with independent drivers and delivery couriers in Nigeria. We do not provide transportation or delivery services directly — we facilitate connections between users.' },
  { type: 'heading', text: '3. Eligibility' },
  { type: 'body',    text: 'You must be at least 18 years old to create an account. By registering, you confirm that all information you provide is accurate and truthful.' },
  { type: 'heading', text: '4. User Accounts' },
  { type: 'bullet',  text: 'You are responsible for maintaining the security of your account and password.' },
  { type: 'bullet',  text: 'You must notify us immediately if you suspect any unauthorized use of your account.' },
  { type: 'bullet',  text: 'You may not share your account with others or create multiple accounts.' },
  { type: 'heading', text: '5. Customers' },
  { type: 'bullet',  text: 'You may request rides and deliveries through the app.' },
  { type: 'bullet',  text: 'Fares are calculated based on distance, time, and applicable surge pricing.' },
  { type: 'bullet',  text: 'Cancellation fees may apply if a trip is cancelled after a driver has accepted.' },
  { type: 'bullet',  text: 'You agree to treat drivers and couriers with respect.' },
  { type: 'heading', text: '6. Drivers & Couriers' },
  { type: 'bullet',  text: "You must hold a valid driver's licence and all required vehicle documentation." },
  { type: 'bullet',  text: 'You are an independent contractor, not an employee of Diakite.' },
  { type: 'bullet',  text: 'You are responsible for your own taxes, insurance, and compliance with Nigerian traffic laws.' },
  { type: 'bullet',  text: 'Diakite deducts a platform commission from each completed trip as disclosed in the app.' },
  { type: 'heading', text: '7. Payments & Wallet' },
  { type: 'bullet',  text: 'All transactions are processed through your in-app wallet or supported payment gateways (Paystack, Flutterwave).' },
  { type: 'bullet',  text: 'Wallet top-ups are non-refundable except in cases of verified fraud.' },
  { type: 'bullet',  text: 'Withdrawals are subject to processing times and verification requirements.' },
  { type: 'heading', text: '8. Prohibited Conduct' },
  { type: 'body',    text: 'You may not:' },
  { type: 'bullet',  text: 'Use the platform for any unlawful purpose' },
  { type: 'bullet',  text: 'Harass, threaten, or harm any other user' },
  { type: 'bullet',  text: 'Manipulate the rating or review system' },
  { type: 'bullet',  text: 'Attempt to access systems or data you are not authorised to access' },
  { type: 'bullet',  text: 'Use the app while driving' },
  { type: 'heading', text: '9. Ratings & Reviews' },
  { type: 'body',    text: 'All users (customers, drivers, couriers) may be rated after each trip. Consistently low ratings may result in account suspension.' },
  { type: 'heading', text: '10. Termination' },
  { type: 'body',    text: 'We reserve the right to suspend or permanently terminate your account for violation of these Terms, fraudulent activity, or conduct that harms other users or our platform.' },
  { type: 'heading', text: '11. Limitation of Liability' },
  { type: 'body',    text: 'Diakite is not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our liability is limited to the value of the transaction in dispute.' },
  { type: 'heading', text: '12. Changes to Terms' },
  { type: 'body',    text: 'We may update these Terms from time to time. Continued use of the app after changes are posted constitutes your acceptance of the new Terms.' },
  { type: 'heading', text: '13. Governing Law' },
  { type: 'body',    text: 'These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in Nigerian courts.' },
  { type: 'heading', text: '14. Contact' },
  { type: 'body',    text: 'If you have questions about these Terms, contact us through the Support section of the app.' },
];

const PRIVACY_CONTENT = [
  { type: 'title',   text: 'Privacy Policy' },
  { type: 'meta',    text: 'Last updated: May 2025' },
  { type: 'heading', text: '1. Introduction' },
  { type: 'body',    text: 'Diakite is committed to protecting your privacy. This Policy explains what data we collect, why we collect it, and how we use it.' },
  { type: 'heading', text: '2. Information We Collect' },
  { type: 'subheading', text: 'Account information' },
  { type: 'bullet',  text: 'Full name, email address, phone number, and password (hashed)' },
  { type: 'bullet',  text: 'Profile photo (optional)' },
  { type: 'bullet',  text: 'Role: Customer, Driver, or Courier' },
  { type: 'subheading', text: 'Identity & vehicle documents (Drivers & Couriers only)' },
  { type: 'bullet',  text: "Driver's licence, vehicle registration, and insurance documents" },
  { type: 'bullet',  text: 'These are stored securely and used solely for verification' },
  { type: 'subheading', text: 'Location data' },
  { type: 'bullet',  text: 'Precise GPS location while the app is active or a trip is in progress' },
  { type: 'bullet',  text: 'We do not collect background location when no trip is active' },
  { type: 'subheading', text: 'Transaction data' },
  { type: 'bullet',  text: 'Wallet top-ups, transfers, ride payments, and withdrawal history' },
  { type: 'subheading', text: 'Device information' },
  { type: 'bullet',  text: 'Device type, operating system, app version, and a unique device identifier' },
  { type: 'bullet',  text: 'Used for security, fraud detection, and push notifications' },
  { type: 'subheading', text: 'Usage data' },
  { type: 'bullet',  text: 'In-app actions such as ride requests, cancellations, and ratings' },
  { type: 'bullet',  text: 'Used to improve the platform and resolve disputes' },
  { type: 'heading', text: '3. How We Use Your Information' },
  { type: 'bullet',  text: 'To match customers with available drivers and couriers' },
  { type: 'bullet',  text: 'To process payments and maintain your wallet' },
  { type: 'bullet',  text: 'To send trip confirmations, OTP codes, and important notifications' },
  { type: 'bullet',  text: 'To verify the identity and documents of drivers and couriers' },
  { type: 'bullet',  text: 'To investigate disputes, fraud, or safety incidents' },
  { type: 'bullet',  text: 'To comply with Nigerian legal and regulatory requirements' },
  { type: 'heading', text: '4. Location Sharing During Trips' },
  { type: 'body',    text: 'When a trip is active, your real-time location is shared with the matched driver or customer so the trip can be completed safely. Location sharing ends when the trip is marked complete.' },
  { type: 'heading', text: '5. Data Sharing' },
  { type: 'body',    text: 'We do not sell your personal data. We may share data with:' },
  { type: 'bullet',  text: 'Payment processors (Paystack, Flutterwave) to complete transactions' },
  { type: 'bullet',  text: 'SMS/email providers to deliver OTP codes and notifications' },
  { type: 'bullet',  text: 'Regulators or law enforcement when required by Nigerian law' },
  { type: 'bullet',  text: 'Emergency services in cases of safety incidents' },
  { type: 'heading', text: '6. Data Retention' },
  { type: 'bullet',  text: 'Account data is retained for as long as your account is active' },
  { type: 'bullet',  text: 'After account deletion, we retain transaction records for 7 years as required by Nigerian financial regulations' },
  { type: 'bullet',  text: 'Document images are deleted within 90 days of account closure' },
  { type: 'heading', text: '7. Security' },
  { type: 'body',    text: 'We use industry-standard encryption (TLS in transit, AES at rest), hashed passwords, and device-based authentication tokens. Access to personal data is restricted to authorised personnel only.' },
  { type: 'heading', text: '8. Your Rights' },
  { type: 'body',    text: 'You have the right to:' },
  { type: 'bullet',  text: 'Access a copy of your personal data' },
  { type: 'bullet',  text: 'Request correction of inaccurate data' },
  { type: 'bullet',  text: 'Request deletion of your account and associated data (subject to legal retention requirements)' },
  { type: 'bullet',  text: 'Withdraw consent for marketing communications at any time' },
  { type: 'body',    text: 'To exercise these rights, contact us through the Support section of the app.' },
  { type: 'heading', text: '9. Cookies & Analytics' },
  { type: 'body',    text: 'The mobile app does not use browser cookies. We may use anonymised, aggregated analytics to understand how users interact with the app. No personally identifiable information is included in these analytics.' },
  { type: 'heading', text: '10. Children' },
  { type: 'body',    text: 'The Diakite platform is not intended for users under 18 years of age. We do not knowingly collect data from minors.' },
  { type: 'heading', text: '11. Changes to This Policy' },
  { type: 'body',    text: 'We may update this Privacy Policy periodically. We will notify you of significant changes via in-app notification or email. Continued use of the app constitutes acceptance.' },
  { type: 'heading', text: '12. Contact' },
  { type: 'body',    text: 'For privacy-related questions or requests, please use the Support section inside the app.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL MODAL — bottom sheet, no auth required
// ─────────────────────────────────────────────────────────────────────────────
const LegalModal = ({ visible, onClose, onAgree, type, darkMode, theme, mode }) => {
  const content = type === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT;
  const slideY  = useRef(new Animated.Value(height)).current;
  const bgO     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgO,    { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgO,    { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: height, duration: 260, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const bg  = darkMode ? '#111111' : '#FFFFFF';
  const sep = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const renderItem = (item, index) => {
    switch (item.type) {
      case 'title':
        return <Text key={index} style={[lm.docTitle, { color: theme.foreground }]}>{item.text}</Text>;
      case 'meta':
        return <Text key={index} style={[lm.meta, { color: theme.hint }]}>{item.text}</Text>;
      case 'heading':
        return <Text key={index} style={[lm.heading, { color: theme.foreground }]}>{item.text}</Text>;
      case 'subheading':
        return <Text key={index} style={[lm.subheading, { color: theme.foreground }]}>{item.text}</Text>;
      case 'body':
        return <Text key={index} style={[lm.body, { color: darkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.70)' }]}>{item.text}</Text>;
      case 'bullet':
        return (
          <View key={index} style={lm.bulletRow}>
            <View style={[lm.bulletDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)' }]} />
            <Text style={[lm.bulletText, { color: darkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.70)' }]}>{item.text}</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Dimmed backdrop */}
      <Animated.View style={[lm.backdrop, { opacity: bgO }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[lm.sheet, { backgroundColor: bg, transform: [{ translateY: slideY }] }]}>
        {/* Drag handle */}
        <View style={[lm.handle, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)' }]} />

        {/* Header */}
        <View style={[lm.sheetHeader, { borderBottomColor: sep }]}>
          <Text style={[lm.sheetTitle, { color: theme.foreground }]}>
            {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[lm.closeBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
          >
            <Ionicons name="close" size={16} color={theme.hint} />
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={lm.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content.map(renderItem)}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Footer — "I have read and agree" CTA */}
        <View style={[lm.footer, { borderTopColor: sep, backgroundColor: bg }]}>
          <TouchableOpacity
            style={[lm.agreeBtn, { overflow: 'hidden' }]}
            onPress={onAgree}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={darkMode
                ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)']
                : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="checkmark-circle" size={16} color={darkMode ? '#000' : '#fff'} />
            <Text style={[lm.agreeTxt, { color: darkMode ? '#000000' : '#ffffff' }]}>
              I have read and agree
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={lm.dismissBtn}>
            <Text style={[lm.dismissTxt, { color: theme.hint }]}>Close without agreeing</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const lm = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.88, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle:   { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent:{ paddingHorizontal: 22, paddingTop: 20 },

  // Typography
  docTitle:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  meta:       { fontSize: 11, fontWeight: '400', marginBottom: 20 },
  heading:    { fontSize: 13, fontWeight: '800', marginTop: 22, marginBottom: 6, letterSpacing: 0.1 },
  subheading: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 5, fontStyle: 'italic' },
  body:       { fontSize: 13, lineHeight: 21, marginBottom: 8 },
  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 7 },
  bulletDot:  { width: 5, height: 5, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 21 },

  // Footer
  footer:     { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1, gap: 10 },
  agreeBtn:   { height: 50, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  agreeTxt:   { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  dismissBtn: { alignItems: 'center', paddingVertical: 4 },
  dismissTxt: { fontSize: 12, fontWeight: '500' },
});

// ── Float Input ───────────────────────────────────────────────────────────────
const INPUT_H = TINY ? 46 : SMALL ? 50 : MEDIUM ? 54 : 58;

const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, secureTextEntry, autoCapitalize }) => {
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
  const fSize     = labelY.interpolate({ inputRange: [0, 1], outputRange: [13, 9] });
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
        name={iconName} size={14}
        color={focused ? (mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)') : theme.hint}
        style={fi.icon}
      />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[fi.label, { top: labelTop, fontSize: fSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={[fi.text, { color: theme.foreground, paddingTop: INPUT_H * 0.38, paddingBottom: 3 }]}
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
        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={fi.eye}>
          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={14} color={theme.hint} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};
const fi = StyleSheet.create({
  box:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, marginBottom: SMALL ? 7 : 9, paddingHorizontal: 12, overflow: 'hidden' },
  icon:  { marginRight: 8 },
  label: { position: 'absolute', left: 0 },
  text:  { fontSize: 13, fontWeight: '400' },
  eye:   { padding: 5, marginLeft: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { register }    = useAuth();
  const insets          = useSafeAreaInsets();
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
  const [agreedToTerms,   setAgreedToTerms]   = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  // Modal
  const [modalType,    setModalType]    = useState(null); // 'terms' | 'privacy' | null
  const [modalVisible, setModalVisible] = useState(false);

  const openModal  = (type) => { setModalType(type); setModalVisible(true); };
  const closeModal = ()     => setModalVisible(false);

  const handleModalAgree = () => {
    if (modalType === 'terms')   setAgreedToTerms(true);
    if (modalType === 'privacy') setAgreedToPrivacy(true);
    setModalVisible(false);
  };

  const bothAgreed = agreedToTerms && agreedToPrivacy;

  // Entrance animations
  const hdrO  = useRef(new Animated.Value(0)).current;
  const hdrY  = useRef(new Animated.Value(-24)).current;
  const illoO = useRef(new Animated.Value(0)).current;
  const illoS = useRef(new Animated.Value(0.94)).current;
  const frmO  = useRef(new Animated.Value(0)).current;
  const frmY  = useRef(new Animated.Value(24)).current;

  const animateIn = (delay = 0) => {
    hdrO.setValue(0); hdrY.setValue(-24);
    illoO.setValue(0); illoS.setValue(0.94);
    frmO.setValue(0); frmY.setValue(24);
    Animated.parallel([
      Animated.timing(hdrO,  { toValue: 1, duration: 500, delay,              useNativeDriver: true }),
      Animated.timing(hdrY,  { toValue: 0, duration: 500, delay,              useNativeDriver: true }),
      Animated.timing(illoO, { toValue: 1, duration: 600, delay: delay + 60,  useNativeDriver: true }),
      Animated.spring(illoS, { toValue: 1,                delay: delay + 60,  tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(frmO,  { toValue: 1, duration: 500, delay: delay + 120, useNativeDriver: true }),
      Animated.timing(frmY,  { toValue: 0, duration: 500, delay: delay + 120, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { animateIn(); }, []);

  const activeRole = ROLES.find(r => r.id === roleId);

  const goToStep2 = () => {
    if (!roleId) return;
    frmO.setValue(0); frmY.setValue(20);
    setStep(2);
    Animated.parallel([
      Animated.timing(frmO, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const goToStep1 = () => {
    frmO.setValue(0); frmY.setValue(-20);
    setStep(1);
    Animated.parallel([
      Animated.timing(frmO, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(frmY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const handleFinalRegister = async () => {
    if (!firstName.trim() || !lastName.trim()) return Alert.alert('Missing Fields',    'Please enter your full name.');
    if (!email.trim() || !email.includes('@'))  return Alert.alert('Invalid Email',    'Please enter a valid email address.');
    if (!phone.trim())                           return Alert.alert('Missing Phone',   'Please enter your phone number.');
    if (password.length < 8)                    return Alert.alert('Weak Password',   'Password must be at least 8 characters.');
    if (password !== confirmPassword)           return Alert.alert('Password Mismatch','Passwords do not match.');
    if (!roleId)                                return Alert.alert('Select Role',      'Please choose a role.');
    if (!agreedToTerms)   return Alert.alert('Terms Required',   'Please read and agree to our Terms of Service to continue.');
    if (!agreedToPrivacy) return Alert.alert('Privacy Required', 'Please read and agree to our Privacy Policy to continue.');

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
      if (!res.success) { Alert.alert('Registration Failed', res.message || 'Please try again.'); return; }
      if (res.requiresOtp) {
        navigation.navigate('OtpVerification', {
          tempToken: res.tempToken, method: res.method, maskedContact: res.maskedContact, purpose: 'REGISTER',
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

  // ── Responsive sizing ─────────────────────────────────────────────────────
  const H_PAD  = SMALL ? 20 : 26;
  const BTN_H  = TINY ? 42 : SMALL ? 46 : 50;
  const topPad = Math.max(insets.top, TINY ? 8 : SMALL ? 12 : 16);
  const botPad = Math.max(insets.bottom, 8);

  const LOGO_SZ  = TINY ? 40 : SMALL ? 46 : 52;
  const LOGO_R   = TINY ? 11 : SMALL ? 13 : 14;
  const LOGO_IMG = TINY
    ? { width: 30, height: 21 }
    : SMALL ? { width: 34, height: 23 } : { width: 38, height: 26 };

  const ROLE_PAD  = SMALL ? 11 : 14;
  const ROLE_ICON = SMALL ? 38 : 42;

  const illoWidth  = width - H_PAD * 2;
  const illoHeight = TINY ? 0 : Math.round(illoWidth * (SMALL ? 0.38 : MEDIUM ? 0.44 : 0.50));
  const showIllo   = step === 1 && !TINY && illoHeight > 50;

  // Step dots
  const StepDots = () => (
    <View style={sd.row}>
      {[1, 2].map(n => (
        <View key={n} style={[sd.dot, {
          backgroundColor: n === step ? (darkMode ? '#fff' : '#000') : G.border(mode),
          width: n === step ? 18 : 6,
        }]} />
      ))}
    </View>
  );
  const sd = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { height: 6, borderRadius: 3 },
  });

  // ── Agreement row — checkbox + label + "Read" button ─────────────────────
  const AgreementRow = ({ agreed, onToggle, onReadPress, label }) => (
    <View style={[
      s.agreementRow,
      {
        backgroundColor: G.card(mode),
        borderColor: agreed
          ? (darkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)')
          : G.border(mode),
      },
    ]}>
      <LinearGradient
        colors={darkMode
          ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']
          : ['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.72)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
      />

      {/* Tappable checkbox */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.65} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
        <View style={[
          s.checkbox,
          {
            backgroundColor: agreed ? (darkMode ? '#ffffff' : '#000000') : 'transparent',
            borderColor:      agreed ? (darkMode ? '#ffffff' : '#000000') : G.border(mode),
          },
        ]}>
          {agreed && (
            <Ionicons name="checkmark" size={11} color={darkMode ? '#000000' : '#ffffff'} />
          )}
        </View>
      </TouchableOpacity>

      {/* Label */}
      <Text style={[s.agreementLabel, { color: theme.hint, fontSize: TINY ? 10 : 11, flex: 1 }]}>
        {label}
      </Text>

      {/* Read button */}
      <TouchableOpacity
        onPress={onReadPress}
        style={[s.readBtn, { borderColor: darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }]}
        activeOpacity={0.7}
      >
        <Text style={[s.readTxt, { color: theme.foreground, fontSize: TINY ? 10 : 11 }]}>Read</Text>
        <Ionicons name="chevron-forward" size={10} color={theme.foreground} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={[s.orb1, { backgroundColor: darkMode ? 'rgba(83,74,183,0.06)' : 'rgba(83,74,183,0.04)' }]} />
      <View style={[s.orb2, { backgroundColor: darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      {/* Legal modal — lives outside the scroll so it covers everything */}
      <LegalModal
        visible={modalVisible}
        type={modalType}
        onClose={closeModal}
        onAgree={handleModalAgree}
        darkMode={darkMode}
        theme={theme}
        mode={mode}
      />

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
            <View style={[s.topRow, { marginBottom: SMALL ? 12 : 18 }]}>
              <TouchableOpacity
                style={[s.backBtn, { width: LOGO_SZ * 0.78, height: LOGO_SZ * 0.78, backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
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
                <Ionicons name="arrow-back" size={16} color={theme.foreground} />
              </TouchableOpacity>

              <View style={[s.logoBadge, { width: LOGO_SZ, height: LOGO_SZ, borderRadius: LOGO_R }]}>
                <Image source={LOGO} style={LOGO_IMG} resizeMode="contain" />
              </View>

              <StepDots />
            </View>

            <View style={[s.pill, { backgroundColor: G.card(mode), borderColor: G.border(mode), marginBottom: SMALL ? 8 : 12 }]}>
              <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
              <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>
                {step === 1 ? 'GET STARTED' : 'YOUR DETAILS'}
              </Text>
            </View>

            <Text style={[s.title, { color: theme.foreground, fontSize: TINY ? 24 : SMALL ? 26 : MEDIUM ? 29 : 32, marginBottom: TINY ? 2 : 4 }]}>
              {step === 1 ? 'Choose your\nrole' : 'Create your\naccount'}
            </Text>
            <Text style={[s.subtitle, { color: theme.hint, fontSize: TINY ? 11 : 12 }]}>
              {step === 1 ? 'How will you use Diakite?' : `Registering as ${activeRole?.label ?? ''}`}
            </Text>
          </Animated.View>

          {/* ── Illustration (Step 1 only) ───────────────────────────────── */}
          {showIllo && (
            <Animated.View
              style={[s.illoWrap, {
                height: illoHeight,
                marginBottom: SMALL ? 12 : 18,
                opacity: illoO,
                transform: [{ scale: illoS }],
                borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              }]}
            >
              <RegisterHeroIllustration
                width={illoWidth - 20}
                height={illoHeight - 14}
                selectedRole={roleId ?? 'DRIVER'}
              />
            </Animated.View>
          )}

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <Animated.View style={{ opacity: frmO, transform: [{ translateY: frmY }] }}>

            {/* ── STEP 1 ─────────────────────────────────────────────────── */}
            {step === 1 && (
              <>
                {ROLES.map((role) => {
                  const sel = roleId === role.id;
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        s.roleCard,
                        {
                          padding: ROLE_PAD,
                          marginBottom: SMALL ? 8 : 10,
                          backgroundColor: G.card(mode),
                          borderColor: sel ? role.accent : G.border(mode),
                          borderWidth: sel ? 1.5 : 1,
                          overflow: 'hidden',
                        },
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
                      {sel && <View style={[s.accentStrip, { backgroundColor: role.accent + '22' }]} />}
                      <View style={[s.roleIconBox, {
                        width: ROLE_ICON, height: ROLE_ICON,
                        backgroundColor: role.accent + (sel ? '20' : '12'),
                      }]}>
                        <Ionicons name={role.icon} size={SMALL ? 18 : 20} color={role.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.roleLabel, { color: theme.foreground, fontSize: SMALL ? 14 : 15 }]}>{role.label}</Text>
                        <Text style={[s.roleSub,   { color: theme.hint,       fontSize: SMALL ? 11 : 12 }]}>{role.sub}</Text>
                      </View>
                      <View style={[s.radioOuter, { borderColor: sel ? role.accent : G.border(mode) }]}>
                        {sel && <View style={[s.radioInner, { backgroundColor: role.accent }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[s.primaryBtn, { height: BTN_H, opacity: roleId ? 1 : 0.4, marginTop: SMALL ? 4 : 6, marginBottom: SMALL ? 8 : 10, overflow: 'hidden' }]}
                  onPress={goToStep2}
                  disabled={!roleId}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,1)', 'rgba(220,220,220,1)'] : ['rgba(0,0,0,1)', 'rgba(30,30,30,1)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[s.shimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
                  <Text style={[s.primaryBtnTxt, { color: theme.accentFg, fontSize: SMALL ? 13 : 14 }]}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.accentFg} />
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
                    Already have an account?{'  '}
                    <Text style={[s.altBold, { color: theme.foreground }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2 ─────────────────────────────────────────────────── */}
            {step === 2 && (
              <>
                {/* Role pill */}
                {activeRole && (
                  <View style={[s.rolePill, {
                    marginBottom: SMALL ? 14 : 18,
                    backgroundColor: G.card(mode),
                    borderColor: G.border(mode),
                    overflow: 'hidden',
                  }]}>
                    <LinearGradient
                      colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.7)']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[s.rolePillIcon, { backgroundColor: activeRole.accent + '20' }]}>
                      <Ionicons name={activeRole.icon} size={13} color={activeRole.accent} />
                    </View>
                    <Text style={[s.rolePillTxt, { color: theme.hint, fontSize: SMALL ? 12 : 13 }]}>{activeRole.label}</Text>
                    <TouchableOpacity onPress={goToStep1} style={s.changeBtn}>
                      <Text style={[s.changeTxt, { color: activeRole.accent, fontSize: SMALL ? 11 : 12 }]}>Change</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Name row */}
                <View style={[s.nameRow, { gap: SMALL ? 7 : 9 }]}>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="First Name" iconName="person-outline" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="Last Name" iconName="person-outline" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                  </View>
                </View>

                <FloatInput label="Email Address" iconName="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" />
                <FloatInput label="Phone Number"  iconName="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

                {/* Divider */}
                <View style={[s.divRow, { marginVertical: SMALL ? 6 : 9 }]}>
                  <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
                  <Text style={[s.divTxt, { color: theme.hint }]}>security</Text>
                  <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
                </View>

                <FloatInput label="Password (min 8 characters)"  iconName="lock-closed-outline"     value={password}        onChangeText={setPassword}        secureTextEntry />
                <FloatInput label="Confirm Password"             iconName="shield-checkmark-outline" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

                {/* Password match indicator */}
                {confirmPassword.length > 0 && (
                  <View style={[s.matchRow, { marginBottom: SMALL ? 6 : 8 }]}>
                    <Ionicons
                      name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                      size={13}
                      color={password === confirmPassword ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[s.matchTxt, { color: password === confirmPassword ? '#10B981' : '#EF4444', fontSize: SMALL ? 11 : 12 }]}>
                      {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}

                {/* ── Agreement section ──────────────────────────────────── */}
                <View style={[s.agreementSection, { marginTop: SMALL ? 8 : 12, marginBottom: SMALL ? 10 : 14 }]}>
                  <Text style={[s.agreementHint, { color: theme.hint, fontSize: TINY ? 10 : 11, marginBottom: SMALL ? 6 : 8 }]}>
                    Read and accept to continue
                  </Text>

                  <AgreementRow
                    agreed={agreedToTerms}
                    onToggle={() => setAgreedToTerms(p => !p)}
                    onReadPress={() => openModal('terms')}
                    label="Terms of Service"
                  />

                  <AgreementRow
                    agreed={agreedToPrivacy}
                    onToggle={() => setAgreedToPrivacy(p => !p)}
                    onReadPress={() => openModal('privacy')}
                    label="Privacy Policy"
                  />
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    { height: BTN_H, marginBottom: SMALL ? 6 : 10, overflow: 'hidden' },
                    (loading || !bothAgreed) && s.dimmed,
                  ]}
                  onPress={handleFinalRegister}
                  disabled={loading || !bothAgreed}
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
                        <Text style={[s.primaryBtnTxt, { color: theme.accentFg, fontSize: SMALL ? 13 : 14 }]}>Create Account</Text>
                        <Ionicons name="arrow-forward" size={16} color={theme.accentFg} />
                      </>
                  }
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

  // Header
  header:    { marginBottom: SMALL ? 12 : 16 },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:   { borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoBadge: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E5E5', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 4 },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillDot:   { width: 5, height: 5, borderRadius: 3 },
  eyebrow:   { fontSize: 9, letterSpacing: 3.5, fontWeight: '800' },
  title:     { fontWeight: '900', letterSpacing: -0.7, lineHeight: undefined },
  subtitle:  { fontWeight: '300', marginTop: 2 },

  // Illustration
  illoWrap: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },

  // Role cards
  roleCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, overflow: 'hidden' },
  accentStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  roleIconBox: { borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  roleLabel:   { fontWeight: '700', marginBottom: 1 },
  roleSub:     { fontWeight: '400' },
  radioOuter:  { width: 18, height: 18, borderRadius: 9, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner:  { width: 9,  height: 9,  borderRadius: 5 },

  // Primary button
  primaryBtn:    { borderRadius: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, overflow: 'hidden' },
  shimmer:       { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  primaryBtnTxt: { fontWeight: '800', letterSpacing: 0.3 },
  dimmed:        { opacity: 0.4 },

  // Alt button
  altBtn:  { borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  altTxt:  {},
  altBold: { fontWeight: '700' },

  // Role pill (step 2)
  rolePill:     { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  rolePillIcon: { width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  rolePillTxt:  { flex: 1, fontWeight: '600' },
  changeBtn:    { paddingHorizontal: 6, paddingVertical: 3 },
  changeTxt:    { fontWeight: '700' },

  // Name row
  nameRow: { flexDirection: 'row' },

  // Divider
  divRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1 },
  divTxt:  { fontSize: 9, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' },

  // Password match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -3 },
  matchTxt: { fontWeight: '500' },

  // Agreement section
  agreementSection: { gap: SMALL ? 7 : 9 },
  agreementHint:    { fontWeight: '500' },
  agreementRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 12, overflow: 'hidden' },
  checkbox:         { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  agreementLabel:   { fontWeight: '600' },
  readBtn:          { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  readTxt:          { fontWeight: '700' },
});