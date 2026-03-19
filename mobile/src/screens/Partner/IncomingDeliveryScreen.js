// mobile/src/screens/Partner/IncomingDeliveryScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, Animated, ActivityIndicator, Alert, Vibration, ScrollView,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { deliveryAPI, walletAPI } from '../../services/api';

const { height }     = Dimensions.get('window');
const COURIER_ACCENT = '#34D399';
const RED            = '#E05555';
const GREEN          = '#5DAA72';
const GOLD           = '#FFB800';
const TIMEOUT_SECS   = 35;

// ── Countdown ring ─────────────────────────────────────────────────────────────
const CountdownRing = ({ seconds, total }) => {
  const SIZE = 76, STROKE = 5;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[cr.track, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderColor: COURIER_ACCENT + '25', borderWidth: STROKE }]} />
      <View style={[cr.arc, {
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderColor: COURIER_ACCENT, borderWidth: STROKE,
        borderRightColor: 'transparent',
        transform: [{ rotate: `${(1 - seconds / total) * 360}deg` }],
      }]} />
      <Text style={[cr.txt, { color: COURIER_ACCENT }]}>{seconds}</Text>
    </View>
  );
};
const cr = StyleSheet.create({
  track: { position: 'absolute' },
  arc:   { position: 'absolute' },
  txt:   { fontSize: 20, fontWeight: '900' },
});

// ── Route row ──────────────────────────────────────────────────────────────────
const RouteRow = ({ icon, iconColor, label, address, contact, theme }) => (
  <View style={rr.row}>
    <View style={[rr.iconWrap, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={15} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[rr.label, { color: theme.hint }]}>{label}</Text>
      <Text style={[rr.addr, { color: theme.foreground }]} numberOfLines={2}>{address}</Text>
      {contact && <Text style={[rr.contact, { color: theme.hint }]}>{contact}</Text>}
    </View>
  </View>
);
const rr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  label:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr:     { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  contact:  { fontSize: 11, marginTop: 1 },
});

// ── Stat pill ──────────────────────────────────────────────────────────────────
const StatPill = ({ icon, value, theme }) => (
  <View style={[sp.pill, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <Ionicons name={icon} size={12} color={theme.hint} />
    <Text style={[sp.txt, { color: theme.foreground }]}>{value}</Text>
  </View>
);
const sp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  txt:  { fontSize: 11, fontWeight: '700' },
});

// ── Wallet balance strip ───────────────────────────────────────────────────────
const WalletStrip = ({ balance, required, theme, onTopUp }) => {
  const hasSufficient = balance >= required;
  const color         = hasSufficient ? GREEN : RED;
  const shortfall     = required - balance;

  return (
    <View style={[ws.wrap, { backgroundColor: color + '10', borderColor: color + '30' }]}>
      <View style={[ws.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name="wallet-outline" size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ws.title, { color }]}>
          {hasSufficient ? 'Wallet OK ✓' : 'Insufficient Balance'}
        </Text>
        <Text style={[ws.sub, { color: theme.hint }]}>
          Balance: <Text style={{ fontWeight: '800', color }}>
            ₦{Number(balance).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
          {'  '}Required: <Text style={{ fontWeight: '800' }}>
            ₦{Number(required).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
        </Text>
        {!hasSufficient && (
          <Text style={[ws.shortfall, { color: RED }]}>
            Need ₦{Number(shortfall).toLocaleString('en-NG', { maximumFractionDigits: 0 })} more to accept
          </Text>
        )}
      </View>
      {!hasSufficient && (
        <TouchableOpacity
          style={[ws.topupBtn, { backgroundColor: COURIER_ACCENT }]}
          onPress={onTopUp}
          activeOpacity={0.85}
        >
          <Text style={ws.topupTxt}>Top Up</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
const ws = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 11, marginBottom: 14 },
  iconWrap: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  title:    { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  sub:      { fontSize: 11, lineHeight: 17 },
  shortfall:{ fontSize: 11, fontWeight: '700', marginTop: 2 },
  topupBtn: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6, flexShrink: 0 },
  topupTxt: { fontSize: 12, fontWeight: '800', color: '#080C18' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomingDeliveryScreen({ route, navigation }) {
  const { theme }  = useTheme();
  const insets     = useSafeAreaInsets();
  const request    = route?.params?.request ?? {};

  const [accepting,      setAccepting]      = useState(false);
  const [countdown,      setCountdown]      = useState(TIMEOUT_SECS);
  const [walletBalance,  setWalletBalance]  = useState(null);
  const [loadingWallet,  setLoadingWallet]  = useState(true);
  const isActingRef = useRef(false);

  const slideA = useRef(new Animated.Value(height)).current;
  const pulseA = useRef(new Animated.Value(1)).current;

  const estimatedFee  = Number(request.estimatedFee ?? 0);
  const hasSufficient = walletBalance !== null && walletBalance >= estimatedFee;

  useEffect(() => {
    Vibration.vibrate([0, 200, 80, 200, 80, 200]);
    Animated.spring(slideA, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }).start();

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 1.06, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    pulse.start();

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); doDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);

    // Fetch wallet balance immediately
    walletAPI.getWallet()
      .then(res => setWalletBalance(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
      .catch(() => setWalletBalance(0))
      .finally(() => setLoadingWallet(false));

    return () => { clearInterval(timer); pulse.stop(); };
  }, []);

  const slideOut = (cb) =>
    Animated.timing(slideA, { toValue: height, duration: 250, useNativeDriver: true }).start(cb);

  const doDecline = () => {
    if (isActingRef.current) return;
    isActingRef.current = true;
    slideOut(() => navigation.goBack());
  };

  const doAccept = async () => {
    // Guard: wallet must be sufficient
    if (!hasSufficient) {
      Alert.alert(
        'Wallet Balance Required',
        `You need ₦${estimatedFee.toLocaleString('en-NG')} in your wallet to accept this delivery. ` +
        `Please top up your wallet first.`,
        [
          { text: 'Decline',    style: 'cancel', onPress: doDecline },
          { text: 'Top Up Now', onPress: () => slideOut(() => navigation.navigate('EarningsHome')) },
        ]
      );
      return;
    }

    if (isActingRef.current) return;
    isActingRef.current = true;
    setAccepting(true);

    try {
      await deliveryAPI.acceptDelivery(request.deliveryId);
      navigation.replace('ActiveDelivery', { deliveryId: request.deliveryId });
    } catch (err) {
      isActingRef.current = false;
      setAccepting(false);

      const status  = err?.response?.status;
      const message = err?.response?.data?.message ?? 'This delivery may have been cancelled.';

      if (status === 402) {
        Alert.alert(
          'Wallet Top-Up Required 💰',
          message,
          [
            { text: 'Decline',    style: 'cancel', onPress: () => slideOut(() => navigation.goBack()) },
            { text: 'Top Up Now', onPress: () => slideOut(() => navigation.navigate('EarningsHome')) },
          ]
        );
      } else {
        Alert.alert('Could not accept', message, [
          { text: 'OK', onPress: () => slideOut(() => navigation.goBack()) }
        ]);
      }
    }
  };

  const feeStr  = estimatedFee.toLocaleString('en-NG', { maximumFractionDigits: 0 });
  const distStr = request.distance?.toFixed(1) ?? '—';
  const etaStr  = request.etaMinutes ?? (request.distance ? Math.ceil(request.distance / 0.4) : '—');

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={s.backdrop} />

      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        paddingBottom: insets.bottom + 20,
        transform: [{ translateY: slideA }],
      }]}>
        <View style={[s.handle, { backgroundColor: theme.border }]} />

        {/* Top row */}
        <View style={s.topRow}>
          <Animated.View style={[s.badge, { backgroundColor: COURIER_ACCENT, transform: [{ scale: pulseA }] }]}>
            <Ionicons name="flash" size={12} color="#080C18" />
            <Text style={s.badgeTxt}>NEW DELIVERY</Text>
          </Animated.View>
          <CountdownRing seconds={countdown} total={TIMEOUT_SECS} />
        </View>

        {/* Fee */}
        <Text style={[s.fee, { color: COURIER_ACCENT }]}>₦{feeStr}</Text>
        <Text style={[s.feeSub, { color: theme.hint }]}>Estimated delivery fee</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatPill icon="navigate-outline" value={`${distStr} km`}  theme={theme} />
          <StatPill icon="time-outline"     value={`~${etaStr} min`} theme={theme} />
          {request.packageWeight && (
            <StatPill icon="scale-outline" value={`${request.packageWeight} kg`} theme={theme} />
          )}
        </View>

        {/* ── Wallet balance strip ── */}
        {loadingWallet ? (
          <View style={[s.walletLoading, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <ActivityIndicator color={COURIER_ACCENT} size="small" />
            <Text style={[s.walletLoadingTxt, { color: theme.hint }]}>Checking wallet...</Text>
          </View>
        ) : (
          <WalletStrip
            balance={walletBalance}
            required={estimatedFee}
            theme={theme}
            onTopUp={() => slideOut(() => navigation.navigate('EarningsHome'))}
          />
        )}

        <View style={[s.divider, { backgroundColor: theme.border }]} />

        {/* Package info + route */}
        <ScrollView style={{ maxHeight: height * 0.22 }} showsVerticalScrollIndicator={false}>
          {request.packageDescription && (
            <View style={[s.pkgCard, { backgroundColor: COURIER_ACCENT + '10', borderColor: COURIER_ACCENT + '30' }]}>
              <Ionicons name="cube-outline" size={15} color={COURIER_ACCENT} />
              <Text style={[s.pkgTxt, { color: theme.foreground }]}>{request.packageDescription}</Text>
            </View>
          )}
          <RouteRow
            icon="radio-button-on" iconColor={COURIER_ACCENT}
            label="PICKUP" address={request.pickupAddress ?? '—'}
            contact={request.pickupContact} theme={theme}
          />
          <RouteRow
            icon="location" iconColor={RED}
            label="DROP-OFF" address={request.dropoffAddress ?? '—'}
            contact={request.dropoffContact} theme={theme}
          />
        </ScrollView>

        <View style={[s.divider, { backgroundColor: theme.border }]} />

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.declineBtn, { borderColor: theme.border }]}
            onPress={doDecline}
            disabled={accepting}
            activeOpacity={0.75}
          >
            <Ionicons name="close-circle-outline" size={19} color={theme.hint} />
            <Text style={[s.declineTxt, { color: theme.hint }]}>Decline</Text>
          </TouchableOpacity>

          <Animated.View style={[s.acceptWrap, { transform: [{ scale: pulseA }] }]}>
            <TouchableOpacity
              style={[s.acceptBtn, {
                backgroundColor: hasSufficient ? COURIER_ACCENT : theme.border,
                opacity: accepting ? 0.7 : 1,
              }]}
              onPress={doAccept}
              disabled={accepting || loadingWallet}
              activeOpacity={0.88}
            >
              {accepting ? (
                <ActivityIndicator color="#080C18" size="small" />
              ) : !hasSufficient && !loadingWallet ? (
                <>
                  <Ionicons name="wallet-outline" size={18} color={theme.hint} />
                  <Text style={[s.acceptTxt, { color: theme.hint }]}>Top Up First</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#080C18" />
                  <Text style={s.acceptTxt}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, justifyContent: 'flex-end' },
  backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:           { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 20 },
  handle:          { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  badgeTxt:        { fontSize: 10, fontWeight: '900', color: '#080C18', letterSpacing: 1 },
  fee:             { fontSize: 38, fontWeight: '900', letterSpacing: -1, marginBottom: 3 },
  feeSub:          { fontSize: 12, marginBottom: 14 },
  statsRow:        { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  walletLoading:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 11, marginBottom: 14 },
  walletLoadingTxt:{ fontSize: 12 },
  divider:         { height: 1, marginBottom: 12 },
  pkgCard:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 10 },
  pkgTxt:          { flex: 1, fontSize: 13, fontWeight: '600' },
  actions:         { flexDirection: 'row', gap: 12, marginTop: 4 },
  declineBtn:      { flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  declineTxt:      { fontSize: 14, fontWeight: '700' },
  acceptWrap:      { flex: 2 },
  acceptBtn:       { height: 54, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  acceptTxt:       { fontSize: 16, fontWeight: '900', color: '#080C18' },
});