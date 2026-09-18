// mobile/src/components/PaymentSelector.js
//
// Drop-in replacement for the inline PaymentSelector used in
// RequestRideScreen.js and RequestDeliveryScreen.js.
//
// Supports 4 payment methods:
//   CASH        — driver collects on arrival, no upfront charge
//   WALLET      — deducted from in-app balance at trip completion
//   PAYSTACK    — card / bank / USSD payment via Paystack, charged at booking
//   FLUTTERWAVE — card / bank / USSD payment via Flutterwave, charged at booking
//
// Props:
//   value           {string}   — 'CASH' | 'WALLET' | 'PAYSTACK' | 'FLUTTERWAVE'
//   onChange        {fn}       — called with new method string
//   walletBalance   {number}   — current wallet balance (null = loading)
//   loadingWallet   {bool}
//   fare            {number}   — the fare/fee amount, used for insufficient-balance check
//   theme           {object}   — from useTheme()
//   accentColor     {string}
//
// Card/USSD payment flow (Paystack / Flutterwave):
//   The selector itself only records the chosen method.
//   The CALLER (RequestRideScreen / RequestDeliveryScreen) must call
//   handleCardPayment(method, fare) before submitting the ride/delivery request.
//   A helper hook `useCardPayment` is exported below to make this easy.

import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { walletAPI } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { useCountryConfig } from '../context/CountryConfigContext';

// ── Paystack logomark ─────────────────────────────────────────────────────────
const PaystackMark = ({ size = 18, style }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Defs>
      <LinearGradient id="psG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#00E2CC" />
        <Stop offset="1" stopColor="#00A89D" />
      </LinearGradient>
    </Defs>
    <Path d="M16 0h68a16 16 0 0116 16v68a16 16 0 01-16 16H16A16 16 0 010 84V16A16 16 0 0116 0z" fill="url(#psG)" />
    <Path d="M28 24h28c11 0 19 8 19 18s-8 18-19 18H42v16H28zm14 14v10h14c3.3 0 6-2.7 6-5s-2.7-5-6-5z" fill="#fff" />
  </Svg>
);

// ── Flutterwave logomark ──────────────────────────────────────────────────────
const FlutterwaveMark = ({ size = 18, style }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Defs>
      <LinearGradient id="flwG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0"   stopColor="#F5A623" />
        <Stop offset="0.5" stopColor="#F07030" />
        <Stop offset="1"   stopColor="#E8522A" />
      </LinearGradient>
    </Defs>
    <Path d="M16 0h68a16 16 0 0116 16v68a16 16 0 01-16 16H16A16 16 0 010 84V16A16 16 0 0116 0z" fill="url(#flwG)" />
    <Path d="M18 30 C26 20 42 18 50 22 C58 18 74 20 82 30 C74 26 62 24 50 28 C38 24 26 26 18 30Z" fill="#fff" opacity="0.95" />
    <Path d="M16 50 C24 40 40 38 50 42 C60 38 76 40 84 50 C76 46 62 44 50 48 C38 44 24 46 16 50Z" fill="#fff" opacity="0.95" />
    <Path d="M22 70 C28 62 40 58 50 62 C60 58 72 62 78 70 C72 66 62 64 50 68 C38 64 28 66 22 70Z" fill="#fff" opacity="0.90" />
  </Svg>
);

// ── Orange Money logomark ─────────────────────────────────────────────────────
const OrangeMark = ({ size = 18, style }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Path d="M0 0h100v100H0z" fill="#FF7900" />
    <Path d="M18 62h64v20H18z" fill="#fff" />
    <Path d="M30 20h12v30H30zM58 20h12v30H58z" fill="#fff" />
  </Svg>
);

// ── Method config ─────────────────────────────────────────────────────────────
// This is the catalogue of everything the app CAN render. What a given user
// actually sees is decided server-side by their country's creditMethods —
// see useVisibleMethods() below.
const METHODS = [
  {
    id:     'CASH',
    label:  'Cash',
    sub:    'Pay driver on arrival',
    icon:   'cash-outline',
    color:  '#5DAA72',
    timing: 'Pay after trip',
  },
  {
    id:     'WALLET',
    label:  'Wallet',
    sub:    null, // balance injected at render
    icon:   'wallet-outline',
    color:  '#A78BFA',
    timing: 'Pay after trip',
  },
  {
    id:     'PAYSTACK',
    label:  'Paystack',
    sub:    'Card / Bank / USSD',
    icon:   null,
    Mark:   PaystackMark,
    color:  '#00C3B5',
    timing: 'Pay now',
  },
  {
    id:     'FLUTTERWAVE',
    label:  'Flutterwave',
    sub:    'Card / Bank / USSD',
    icon:   null,
    Mark:   FlutterwaveMark,
    color:  '#F5A623',
    timing: 'Pay now',
  },
  {
    id:     'ORANGE_MONEY',
    label:  'Orange Money',
    sub:    'Pay from your Orange wallet',
    icon:   null,
    Mark:   OrangeMark,
    color:  '#FF7900',
    timing: 'Pay now',
  },
];

const BY_ID = Object.fromEntries(METHODS.map(m => [m.id, m]));

// Methods that take the customer out to a hosted checkout and charge up
// front, as opposed to CASH/WALLET which settle at trip completion.
const UPFRONT = ['PAYSTACK', 'FLUTTERWAVE', 'ORANGE_MONEY'];

// ── PaymentSelector component ─────────────────────────────────────────────────
export const PaymentSelector = ({
  value,
  onChange,
  walletBalance,
  loadingWallet,
  fare,
  theme,
  accentColor,
}) => {
  const { formatMoney } = useCurrency();
  const { creditMethods, defaultMethod, loading: loadingConfig } = useCountryConfig();

  // Only render what this user's country can actually settle. An Orange
  // market never sees Paystack; Nigeria never sees Orange Money.
  const visible = creditMethods
    .map(id => BY_ID[id])
    .filter(Boolean);

  const payLater = visible.filter(m => !UPFRONT.includes(m.id));
  const payNow   = visible.filter(m =>  UPFRONT.includes(m.id));

  // If the current selection isn't offered here (e.g. a user who changed
  // country, or a screen defaulting to 'PAYSTACK' in an Orange market),
  // move them to the country's own default rather than leaving the form in
  // a state that will fail at submit.
  useEffect(() => {
    if (loadingConfig || !visible.length) return;
    if (!creditMethods.includes(value)) onChange(defaultMethod);
  }, [loadingConfig, creditMethods, value, defaultMethod, onChange, visible.length]);

  const walletInsufficient = value === 'WALLET' && walletBalance !== null && walletBalance < fare;

  if (loadingConfig) {
    return (
      <View style={[ps.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border, alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={theme.hint} />
      </View>
    );
  }

  const renderOption = (m) => {
    const selected = value === m.id;
    const isWallet = m.id === 'WALLET';
    const disabled = isWallet && walletBalance === null;
    const insuf    = isWallet && walletInsufficient;
    const borderClr = selected ? m.color : theme.border;
    const bgClr     = selected ? m.color + '14' : 'transparent';

    return (
      <TouchableOpacity
        key={m.id}
        style={[ps.option, { borderColor: borderClr, backgroundColor: bgClr, opacity: disabled ? 0.5 : 1 }]}
        onPress={() => !disabled && onChange(m.id)}
        activeOpacity={0.8}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={m.label}
      >
        {m.Mark
          ? <m.Mark size={20} />
          : <Ionicons name={m.icon} size={18} color={selected ? m.color : theme.hint} />}

        <View style={{ flex: 1 }}>
          <Text style={[ps.optionTxt, { color: selected ? m.color : theme.foreground }]}>{m.label}</Text>
          {isWallet ? (
            loadingWallet
              ? <ActivityIndicator size="small" color={theme.hint} style={{ marginTop: 2, alignSelf: 'flex-start' }} />
              : <Text style={[ps.optionSub, { color: insuf ? '#E05555' : (selected ? m.color : theme.hint) }]}>
                  {insuf ? `Insufficient (${formatMoney(walletBalance)})` : formatMoney(walletBalance ?? 0)}
                </Text>
          ) : (
            <Text style={[ps.optionSub, { color: theme.hint }]} numberOfLines={1}>{m.sub}</Text>
          )}
        </View>

        {selected && !insuf && (
          <View style={[ps.check, { backgroundColor: m.color }]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
        {insuf && <Ionicons name="alert-circle" size={16} color="#E05555" />}
      </TouchableOpacity>
    );
  };

  // Two per row; an odd count leaves the last option full-width rather than
  // stranding a half-width card next to empty space.
  const rows = (list) => {
    const out = [];
    for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
    return out;
  };

  return (
    <View style={[ps.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <Text style={[ps.label, { color: theme.hint }]}>PAYMENT METHOD</Text>

      {rows(payLater).map((row, i) => (
        <View style={ps.row} key={`later-${i}`}>{row.map(renderOption)}</View>
      ))}

      {payNow.length > 0 && (
        <View style={ps.dividerRow}>
          <View style={[ps.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[ps.dividerTxt, { color: theme.hint }]}>PAY NOW</Text>
          <View style={[ps.dividerLine, { backgroundColor: theme.border }]} />
        </View>
      )}

      {rows(payNow).map((row, i) => (
        <View style={ps.row} key={`now-${i}`}>{row.map(renderOption)}</View>
      ))}

      {UPFRONT.includes(value) && (
        <View style={[ps.timingNote, { backgroundColor: '#C9A96E' + '14', borderColor: '#C9A96E' + '40' }]}>
          <Ionicons name="information-circle-outline" size={13} color="#C9A96E" />
          <Text style={[ps.timingNoteTxt, { color: '#C9A96E' }]}>
            {value === 'ORANGE_MONEY'
              ? "You'll approve the payment in Orange Money before the driver is confirmed."
              : "You'll complete payment (card, bank transfer, or USSD) before the driver is confirmed."}
          </Text>
        </View>
      )}
    </View>
  );
};

const ps = StyleSheet.create({
  wrap:          { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  label:         { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  row:           { flexDirection: 'row', gap: 10, marginBottom: 8 },
  option:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 10 },
  optionTxt:     { fontSize: 12, fontWeight: '700' },
  optionSub:     { fontSize: 10, marginTop: 1 },
  check:         { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dividerLine:   { flex: 1, height: 1 },
  dividerTxt:    { fontSize: 8, fontWeight: '700', letterSpacing: 2 },
  timingNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  timingNoteTxt: { flex: 1, fontSize: 10, lineHeight: 15 },
});

// ── useCardPayment hook ───────────────────────────────────────────────────────
//
// Call handleCardPayment(method, fare) inside your confirmRide / confirmDelivery
// BEFORE calling the ride/delivery API.
// Returns { transactionId, method } on success, throws on failure/cancel.
//
// Usage:
//   const { handleCardPayment } = useCardPayment();
//   ...
//   const result = await handleCardPayment(paymentMethod, fare);
//   // result is null  → CASH or WALLET (no upfront payment needed)
//   // result is { transactionId, method } → payment completed
//   await rideAPI.requestSpecificDriver({ ..., paymentMethod, transactionId: result?.transactionId });

export const useCardPayment = () => {
  const { formatMoney } = useCurrency();
  const { config } = useCountryConfig();

  const handleCardPayment = async (method, fare) => {
    if (method === 'CASH' || method === 'WALLET') return null;
    if (method === 'PAYSTACK')     return _handlePaystack(fare, formatMoney);
    if (method === 'FLUTTERWAVE')  return _handleFlutterwave(fare, formatMoney);
    if (method === 'ORANGE_MONEY') return _handleOrange(fare, formatMoney, config);
    return null;
  };

  return { handleCardPayment };
};

// ── Orange Money flow (hosted Orange Web Payment page) ────────────────────────
//
// Unlike the Paystack/Flutterwave flows above, this one POLLS rather than
// asking the user to paste a transaction ID. Orange settles asynchronously
// and our /verify endpoint answers 202 while the payment is still pending,
// so we retry a bounded number of times and give the user an explicit
// "check again" escape hatch instead of an indefinite spinner.
const ORANGE_POLL_ATTEMPTS = 10;
const ORANGE_POLL_DELAY_MS = 3000;

const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

const _pollOrange = async (orderId) => {
  for (let attempt = 0; attempt < ORANGE_POLL_ATTEMPTS; attempt++) {
    try {
      const res = await walletAPI.verifyOrangeTopup({ orderId });
      // Axios resolves 202, so a pending result arrives here, not in catch.
      if (res?.status === 202 || res?.data?.pending) {
        await _sleep(ORANGE_POLL_DELAY_MS);
        continue;
      }
      return true;
    } catch (e) {
      // A real failure (Orange said FAILED/EXPIRED) — stop retrying.
      const pending = e?.response?.status === 202 || e?.response?.data?.pending;
      if (!pending) throw new Error(e?.response?.data?.message ?? e?.message ?? 'Orange verification failed');
      await _sleep(ORANGE_POLL_DELAY_MS);
    }
  }
  return false;
};

const _handleOrange = (fare, formatMoney, config) =>
  new Promise(async (resolve, reject) => {
    try {
      if (!config?.orangeReady) {
        throw new Error('Orange Money is not available yet. Please choose another payment method.');
      }

      const res = await walletAPI.orangeTopup({ amount: Math.round(fare) });
      const paymentUrl = res?.data?.paymentUrl ?? res?.data?.data?.paymentUrl;
      const orderId    = res?.data?.orderId    ?? res?.data?.data?.orderId;

      if (!paymentUrl) throw new Error('No payment URL returned from Orange Money');

      await Linking.openURL(paymentUrl);

      Alert.alert(
        'Complete Payment',
        `Approve ${formatMoney(fare)} in Orange Money, then tap Continue. We'll confirm it automatically.`,
        [
          {
            text: 'Continue',
            onPress: async () => {
              try {
                const settled = await _pollOrange(orderId);
                if (settled) {
                  resolve({ transactionId: orderId, method: 'ORANGE_MONEY' });
                } else {
                  reject(new Error("Orange hasn't confirmed this payment yet. If you've paid, it will credit shortly — check your wallet before retrying."));
                }
              } catch (e) {
                reject(e);
              }
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('CANCELLED')) },
        ],
        { cancelable: false }
      );
    } catch (e) {
      reject(e);
    }
  });

// ── Paystack flow (card / bank / USSD via Paystack checkout) ─────────────────
const _handlePaystack = (fare, formatMoney) =>
  new Promise(async (resolve, reject) => {
    try {
      const res       = await walletAPI.initializeTopUp({ amount: fare });
      const authUrl   = res?.data?.authorizationUrl ?? res?.data?.data?.authorization_url;
      const reference = res?.data?.reference;

      if (!authUrl) throw new Error('No payment URL returned from Paystack');

      await Linking.openURL(authUrl);

      Alert.alert(
        'Complete Payment 💳',
        `Pay ${formatMoney(fare)} in your browser (card, bank transfer, or USSD), then tap Verify.`,
        [
          {
            text: 'Verify & Confirm',
            onPress: async () => {
              try {
                await walletAPI.verifyPaystackTopup({ reference });
                resolve({ transactionId: reference, method: 'PAYSTACK' });
              } catch (e) {
                reject(new Error(e?.message ?? 'Paystack verification failed'));
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => reject(new Error('CANCELLED')),
          },
        ],
        { cancelable: false }
      );
    } catch (e) {
      reject(e);
    }
  });

// ── Flutterwave flow (card / bank / USSD via Flutterwave checkout) ────────────
const _handleFlutterwave = (fare, formatMoney) =>
  new Promise(async (resolve, reject) => {
    try {
      const res = await walletAPI.flutterwaveTopup({ amount: fare });
      const paymentLink =
        res?.data?.paymentLink ?? res?.data?.data?.link ?? res?.paymentLink ?? res?.data?.link;
      const txRef =
        res?.data?.txRef ?? res?.data?.tx_ref ?? res?.txRef;

      if (!paymentLink) throw new Error('No payment link returned from Flutterwave');

      await Linking.openURL(paymentLink);

      if (Platform.OS === 'ios') {
        Alert.prompt(
          'Verify Flutterwave Payment',
          `After paying ${formatMoney(fare)} (card, bank, or USSD), paste your Flutterwave transaction ID:`,
          [
            {
              text: 'Verify & Confirm',
              onPress: async (id) => {
                if (!id?.trim()) { reject(new Error('No transaction ID entered')); return; }
                try {
                  await walletAPI.verifyFlutterwaveTopup({ transactionId: id.trim() });
                  resolve({ transactionId: id.trim(), method: 'FLUTTERWAVE' });
                } catch (e) {
                  reject(new Error(e?.message ?? 'Flutterwave verification failed'));
                }
              },
            },
            { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('CANCELLED')) },
          ],
          'plain-text',
          txRef ?? ''
        );
      } else {
        // Android: webhook credits the wallet; pass txRef along
        Alert.alert(
          'Complete Payment 💳',
          `Pay ${formatMoney(fare)} in your browser (card, bank, or USSD).\n\nOnce done, tap Confirm below.`,
          [
            {
              text: "I've Paid — Confirm",
              onPress: () => resolve({ transactionId: txRef ?? `FLW-${Date.now()}`, method: 'FLUTTERWAVE' }),
            },
            { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('CANCELLED')) },
          ],
          { cancelable: false }
        );
      }
    } catch (e) {
      reject(e);
    }
  });

export default PaymentSelector;