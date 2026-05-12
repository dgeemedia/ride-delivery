// mobile/src/screens/Shared/WalletTopUpScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Animated, ActivityIndicator,
  Alert, Keyboard, Linking, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { walletAPI } from '../../services/api';

const { height } = Dimensions.get('window');

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const formatNGN = (n) => Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// Paystack "P" logomark — teal gradient square + white P
// ─────────────────────────────────────────────────────────────────────────────
const PaystackMark = ({ size = 36 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="psG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#00E2CC" />
        <Stop offset="1" stopColor="#00A89D" />
      </LinearGradient>
    </Defs>
    {/* Rounded square */}
    <Path d="M16 0h68a16 16 0 0116 16v68a16 16 0 01-16 16H16A16 16 0 010 84V16A16 16 0 0116 0z" fill="url(#psG)" />
    {/* White P */}
    <Path d="M28 24h28c11 0 19 8 19 18s-8 18-19 18H42v16H28zm14 14v10h14c3.3 0 6-2.7 6-5s-2.7-5-6-5z" fill="#fff" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Flutterwave logomark — orange/red gradient square + 3 white wave arcs
// Based on Flutterwave's actual brand wave motif
// ─────────────────────────────────────────────────────────────────────────────
const FlutterwaveMark = ({ size = 36 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="flwG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0"   stopColor="#F5A623" />
        <Stop offset="0.5" stopColor="#F07030" />
        <Stop offset="1"   stopColor="#E8522A" />
      </LinearGradient>
    </Defs>
    {/* Rounded square */}
    <Path d="M16 0h68a16 16 0 0116 16v68a16 16 0 01-16 16H16A16 16 0 010 84V16A16 16 0 0116 0z" fill="url(#flwG)" />
    {/* Wave 1 — top, widest */}
    <Path
      d="M18 30 C26 20 42 18 50 22 C58 18 74 20 82 30 C74 26 62 24 50 28 C38 24 26 26 18 30Z"
      fill="#fff"
      opacity="0.95"
    />
    {/* Wave 2 — middle */}
    <Path
      d="M16 50 C24 40 40 38 50 42 C60 38 76 40 84 50 C76 46 62 44 50 48 C38 44 24 46 16 50Z"
      fill="#fff"
      opacity="0.95"
    />
    {/* Wave 3 — bottom, narrowest */}
    <Path
      d="M22 70 C28 62 40 58 50 62 C60 58 72 62 78 70 C72 66 62 64 50 68 C38 64 28 66 22 70Z"
      fill="#fff"
      opacity="0.90"
    />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Provider config
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id:      'paystack',
    name:    'Paystack',
    tagline: 'Most popular in Nigeria',
    color:   '#00C3B5',
    Mark:    PaystackMark,
  },
  {
    id:      'flutterwave',
    name:    'Flutterwave',
    tagline: 'Pan-African payments',
    color:   '#F5A623',
    Mark:    FlutterwaveMark,
  },
];

export default function WalletTopUpScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const accent          = theme.accent;

  const [amount,   setAmount]   = useState('');
  const [provider, setProvider] = useState('paystack');
  const [loading,  setLoading]  = useState(false);
  const [limits,   setLimits]   = useState({ min: 100, max: 1000000 });

  const shakeA = useRef(new Animated.Value(0)).current;

  const HEADER_INNER_H = 68;
  const HEADER_H       = insets.top + HEADER_INNER_H;
  const SCROLL_H       = height - HEADER_H - insets.bottom;

  useEffect(() => {
    walletAPI.getDepositLimits?.()
      .then(res => {
        const { min, max } = res?.data ?? {};
        if (min && max) setLimits({ min, max });
      })
      .catch(() => {});
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeA, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 5,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // ── Paystack ────────────────────────────────────────────────────────────────
  const handlePaystack = async (num) => {
    const res       = await walletAPI.initializeTopUp({ amount: num });
    const authUrl   = res?.data?.authorizationUrl ?? res?.data?.data?.authorization_url;
    const reference = res?.data?.reference;
    if (!authUrl) throw new Error('No payment URL returned from Paystack');

    const verify = async (ref) => {
      try {
        await walletAPI.verifyPaystackTopup({ reference: ref });
        Alert.alert('Success! 🎉', 'Your wallet has been credited.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (e) {
        Alert.alert('Verification Failed', e?.message ?? 'Contact support if payment was deducted.');
      }
    };

    await Linking.openURL(authUrl);
    Alert.alert(
      'Payment Initiated 🚀',
      `Complete the ₦${formatNGN(num)} payment in your browser, then tap Verify.`,
      [
        { text: 'Verify Payment', onPress: () => verify(reference) },
        { text: 'Later',          onPress: () => navigation.goBack() },
      ]
    );
  };

  // ── Flutterwave ─────────────────────────────────────────────────────────────
  const handleFlutterwave = async (num) => {
    const res = await walletAPI.flutterwaveTopup({ amount: num });

    // Handles both response shapes the backend may return
    const paymentLink =
      res?.data?.paymentLink ??
      res?.data?.data?.link  ??
      res?.paymentLink       ??
      res?.data?.link;

    const txRef =
      res?.data?.txRef    ??
      res?.data?.tx_ref   ??
      res?.txRef;

    if (!paymentLink) throw new Error('No payment link returned from Flutterwave');

    await Linking.openURL(paymentLink);

    const verify = async (transactionId) => {
      if (!transactionId?.trim()) {
        Alert.alert('Invalid ID', 'Please enter your Flutterwave transaction ID.');
        return;
      }
      try {
        await walletAPI.verifyFlutterwaveTopup({ transactionId: transactionId.trim() });
        Alert.alert('Success! 🎉', 'Your wallet has been credited.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (e) {
        Alert.alert('Verification Failed', e?.message ?? 'Contact support if payment was deducted.');
      }
    };

    if (Platform.OS === 'ios') {
      // iOS supports Alert.prompt for inline text input
      Alert.prompt(
        'Verify Flutterwave Payment',
        `After completing your ₦${formatNGN(num)} payment, paste the transaction ID from your Flutterwave receipt:`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
          { text: 'Verify', onPress: (id) => verify(id) },
        ],
        'plain-text',
        txRef ?? ''
      );
    } else {
      // Android: webhook handles crediting; inform the user
      Alert.alert(
        'Payment Opened 🚀',
        `Complete the ₦${formatNGN(num)} payment in your browser.\n\nYour wallet will be credited automatically. If not updated within 5 minutes, contact support with ref: ${txRef ?? 'N/A'}`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    }
  };

  // ── Main ────────────────────────────────────────────────────────────────────
  const handleTopUp = async () => {
    Keyboard.dismiss();
    const num = parseFloat(amount);
    if (!num || num < limits.min) { shake(); Alert.alert('Minimum amount', `Please enter at least ₦${formatNGN(limits.min)}.`); return; }
    if (num > limits.max)         { shake(); Alert.alert('Maximum exceeded', `Maximum top-up is ₦${formatNGN(limits.max)}.`); return; }

    setLoading(true);
    try {
      provider === 'paystack' ? await handlePaystack(num) : await handleFlutterwave(num);
    } catch (err) {
      Alert.alert(
        'Top Up Failed',
        err?.response?.data?.message ?? err?.message ?? 'Could not initialize payment. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const amtNum         = parseFloat(amount) || 0;
  const activeProvider = PROVIDERS.find(p => p.id === provider);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top, height: HEADER_H, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Top Up Wallet</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>via {activeProvider.name}</Text>
        </View>
        <activeProvider.Mark size={34} />
      </View>

      <View style={{ height: SCROLL_H }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces>

          {/* ── Provider selector ── */}
          <Text style={[s.sectionLabel, { color: theme.hint }]}>PAYMENT PROVIDER</Text>
          <View style={s.providerRow}>
            {PROVIDERS.map(p => {
              const selected = provider === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.providerCard, { backgroundColor: selected ? p.color + '14' : theme.backgroundAlt, borderColor: selected ? p.color : theme.border, borderWidth: selected ? 2 : 1 }]}
                  onPress={() => setProvider(p.id)}
                  activeOpacity={0.82}
                >
                  <p.Mark size={42} />
                  <Text style={[s.providerName, { color: selected ? p.color : theme.foreground }]}>{p.name}</Text>
                  <Text style={[s.providerTagline, { color: theme.hint }]} numberOfLines={1}>{p.tagline}</Text>
                  {selected && (
                    <View style={[s.providerCheck, { backgroundColor: p.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Info card ── */}
          <View style={[s.infoCard, { backgroundColor: accent + '0D', borderColor: accent + '30' }]}>
            <Ionicons name="information-circle-outline" size={18} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={[s.infoTitle, { color: accent }]}>Why top up?</Text>
              <Text style={[s.infoBody, { color: theme.hint }]}>Use your wallet for faster, cashless payments on every ride and delivery.</Text>
            </View>
          </View>

          {/* ── Limit hint ── */}
          <View style={[s.limitHint, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={theme.hint} />
            <Text style={[s.limitHintTxt, { color: theme.hint }]}>Min: ₦{formatNGN(limits.min)} • Max: ₦{formatNGN(limits.max)} per transaction</Text>
          </View>

          {/* ── Amount input ── */}
          <Text style={[s.sectionLabel, { color: theme.hint }]}>ENTER AMOUNT</Text>
          <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
            <View style={[s.inputCard, { backgroundColor: theme.backgroundAlt, borderColor: amtNum > 0 ? accent + '80' : theme.border }]}>
              <Text style={[s.currency, { color: accent }]}>₦</Text>
              <TextInput
                style={[s.input, { color: theme.foreground }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.hint}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                maxLength={8}
              />
              {amtNum > 0 && (
                <TouchableOpacity onPress={() => setAmount('')}>
                  <Ionicons name="close-circle" size={20} color={theme.hint} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* ── Quick amounts ── */}
          <Text style={[s.sectionLabel, { color: theme.hint }]}>QUICK SELECT</Text>
          <View style={s.quickGrid}>
            {QUICK_AMOUNTS.map(q => {
              const selected     = parseFloat(amount) === q;
              const withinLimits = q >= limits.min && q <= limits.max;
              return (
                <TouchableOpacity
                  key={q}
                  style={[s.quickBtn, { backgroundColor: selected ? accent : theme.backgroundAlt, borderColor: selected ? accent : theme.border, opacity: withinLimits ? 1 : 0.35 }]}
                  onPress={() => withinLimits && setAmount(String(q))}
                  disabled={!withinLimits}
                >
                  <Text style={[s.quickTxt, { color: selected ? theme.accentFg : theme.foreground }]}>₦{formatNGN(q)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Breakdown ── */}
          {amtNum >= limits.min && (
            <View style={[s.breakdownCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.breakdownRow}>
                <Text style={[s.breakdownLbl, { color: theme.hint }]}>Amount</Text>
                <Text style={[s.breakdownVal, { color: theme.foreground }]}>₦{formatNGN(amtNum)}</Text>
              </View>
              <View style={s.breakdownRow}>
                <Text style={[s.breakdownLbl, { color: theme.hint }]}>Processing fee</Text>
                <Text style={[s.breakdownVal, { color: theme.accent }]}>FREE</Text>
              </View>
              <View style={[s.breakdownDivider, { backgroundColor: theme.border }]} />
              <View style={s.breakdownRow}>
                <Text style={[s.breakdownLbl, { color: accent, fontWeight: '800' }]}>Wallet credit</Text>
                <Text style={[s.breakdownVal, { color: accent, fontWeight: '900', fontSize: 16 }]}>₦{formatNGN(amtNum)}</Text>
              </View>
            </View>
          )}

          {/* ── Security ── */}
          <View style={[s.securityRow, { borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color={accent} />
            <Text style={[s.securityTxt, { color: theme.hint }]}>256-bit SSL • {activeProvider.name} • PCI-DSS compliant</Text>
          </View>

          {/* ── Pay button ── */}
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: activeProvider.color, opacity: loading || amtNum < limits.min ? 0.7 : 1 }]}
            onPress={handleTopUp}
            disabled={loading || amtNum < limits.min}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#fff" />
                <Text style={s.payBtnTxt}>
                  {amtNum >= limits.min ? `Pay ₦${formatNGN(amtNum)} via ${activeProvider.name}` : `Min ₦${formatNGN(limits.min)}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub:   { fontSize: 11, marginTop: 1 },

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 12 },

  providerRow:    { flexDirection: 'row', gap: 12, marginBottom: 20 },
  providerCard:   { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, position: 'relative' },
  providerName:   { fontSize: 14, fontWeight: '800' },
  providerTagline:{ fontSize: 10, textAlign: 'center' },
  providerCheck:  { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  infoCard:     { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  infoTitle:    { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  infoBody:     { fontSize: 12, lineHeight: 18 },
  limitHint:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20 },
  limitHintTxt: { fontSize: 11, fontWeight: '600' },

  inputCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 24 },
  currency:  { fontSize: 28, fontWeight: '900', marginRight: 6 },
  input:     { flex: 1, fontSize: 40, fontWeight: '900', paddingVertical: 14 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickBtn:  { borderRadius: 12, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 11 },
  quickTxt:  { fontSize: 14, fontWeight: '700' },

  breakdownCard:    { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 10 },
  breakdownRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLbl:     { fontSize: 13 },
  breakdownVal:     { fontSize: 14, fontWeight: '700' },
  breakdownDivider: { height: 1, marginVertical: 4 },

  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 14, marginBottom: 20 },
  securityTxt: { flex: 1, fontSize: 11, lineHeight: 17 },

  payBtn:    { borderRadius: 18, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  payBtnTxt: { fontSize: 16, fontWeight: '900', color: '#fff' },
});