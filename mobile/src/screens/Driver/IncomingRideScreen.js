// mobile/src/screens/Driver/IncomingRideScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, Animated, ActivityIndicator, Alert, Vibration,
} from 'react-native';
import AnimatedRN, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useScrollY }        from '../../context/ScrollContext';
import { rideAPI, walletAPI } from '../../services/api';

const { height } = Dimensions.get('window');
const DA         = '#FFB800';
const GREEN      = '#5DAA72';
const RED        = '#E05555';
const TIMEOUT_SECS = 30;

// ── Countdown ring ─────────────────────────────────────────────────────────────
const CountdownRing = ({ seconds, total, color }) => {
  const SIZE = 80, STROKE = 5;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[cr.track, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderColor: color + '25', borderWidth: STROKE }]} />
      <View style={[cr.arc, {
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderColor: color, borderWidth: STROKE,
        borderRightColor: 'transparent',
        transform: [{ rotate: `${(1 - seconds / total) * 360}deg` }],
      }]} />
      <Text style={[cr.txt, { color }]}>{seconds}</Text>
    </View>
  );
};
const cr = StyleSheet.create({
  track: { position: 'absolute' },
  arc:   { position: 'absolute' },
  txt:   { fontSize: 20, fontWeight: '900' },
});

// ── Route row ──────────────────────────────────────────────────────────────────
const RouteRow = ({ icon, iconColor, label, address, theme }) => (
  <View style={rr.row}>
    <View style={[rr.iconWrap, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={16} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[rr.label, { color: theme.hint }]}>{label}</Text>
      <Text style={[rr.addr, { color: theme.foreground }]} numberOfLines={2}>{address}</Text>
    </View>
  </View>
);
const rr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  label:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 3 },
  addr:     { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});

// ── Stat pill ──────────────────────────────────────────────────────────────────
const StatPill = ({ icon, value, theme }) => (
  <View style={[sp.pill, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <Ionicons name={icon} size={13} color={theme.hint} />
    <Text style={[sp.txt, { color: theme.foreground }]}>{value}</Text>
  </View>
);
const sp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  txt:  { fontSize: 12, fontWeight: '700' },
});

// ── Wallet balance strip ───────────────────────────────────────────────────────
const WalletStrip = ({ balance, required, theme, onTopUp }) => {
  const hasSufficient = balance >= required;
  const color         = hasSufficient ? GREEN : RED;
  const shortfall     = required - balance;

  return (
    <View style={[ws.wrap, { backgroundColor: color + '10', borderColor: color + '30' }]}>
      <View style={[ws.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name="wallet-outline" size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ws.title, { color }]}>
          {hasSufficient ? 'Wallet OK ✓' : 'Insufficient Wallet Balance'}
        </Text>
        <Text style={[ws.sub, { color: theme.hint }]}>
          Balance: <Text style={{ fontWeight: '800', color }}>
            ₦{Number(balance).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
          {' '}/ Required: <Text style={{ fontWeight: '800' }}>
            ₦{Number(required).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
        </Text>
        {!hasSufficient && (
          <Text style={[ws.shortfall, { color: RED }]}>
            Top up ₦{Number(shortfall).toLocaleString('en-NG', { maximumFractionDigits: 0 })} to accept
          </Text>
        )}
      </View>
      {!hasSufficient && (
        <TouchableOpacity
          style={[ws.topupBtn, { backgroundColor: DA }]}
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
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 16 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  title:    { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  sub:      { fontSize: 11, lineHeight: 17 },
  shortfall:{ fontSize: 11, fontWeight: '700', marginTop: 2 },
  topupBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  topupTxt: { fontSize: 12, fontWeight: '800', color: '#080C18' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomingRideScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const request   = route?.params?.request ?? {};

  // ── Auto-hide footer nav ──────────────────────────────────────────────────
  const scrollY      = useScrollY();
  const scrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    scrollY.value = event.contentOffset.y;
  });

  const [accepting,      setAccepting]      = useState(false);
  const [countdown,      setCountdown]      = useState(TIMEOUT_SECS);
  const [walletBalance,  setWalletBalance]  = useState(null);
  const [loadingWallet,  setLoadingWallet]  = useState(true);
  const isActingRef = useRef(false);

  const slideA = useRef(new Animated.Value(height)).current;
  const pulseA = useRef(new Animated.Value(1)).current;

  const estimatedFare = Number(request.estimatedFare ?? 0);
  const hasSufficient = walletBalance !== null && walletBalance >= estimatedFare;

  useEffect(() => {
    Vibration.vibrate([0, 250, 100, 250, 100, 250]);
    Animated.spring(slideA, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }).start();

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    pulse.start();

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); doDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);

    walletAPI.getWallet()
      .then(res => setWalletBalance(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
      .catch(() => setWalletBalance(0))
      .finally(() => setLoadingWallet(false));

    return () => { clearInterval(timer); pulse.stop(); };
  }, []);

  const slideOut = (cb) =>
    Animated.timing(slideA, { toValue: height, duration: 260, useNativeDriver: true }).start(cb);

  const doDecline = () => {
    if (isActingRef.current) return;
    isActingRef.current = true;
    slideOut(() => navigation.goBack());
  };

  const doAccept = async () => {
    if (!hasSufficient) {
      Alert.alert(
        'Wallet Balance Required',
        `You need ₦${estimatedFare.toLocaleString('en-NG')} in your wallet to accept this ride. ` +
        `Please top up your wallet first.`,
        [
          { text: 'Decline Ride', style: 'cancel', onPress: doDecline },
          { text: 'Top Up Wallet', onPress: () => {
            slideOut(() => navigation.navigate('Earnings'));
          }},
        ]
      );
      return;
    }

    if (isActingRef.current) return;
    isActingRef.current = true;
    setAccepting(true);

    try {
      await rideAPI.acceptRide(request.rideId);
      navigation.replace('ActiveRide', { rideId: request.rideId });
    } catch (err) {
      isActingRef.current = false;
      setAccepting(false);

      const status  = err?.response?.status;
      const message = err?.response?.data?.message ?? 'Ride may have been cancelled.';

      if (status === 402) {
        Alert.alert(
          'Wallet Top-Up Required 💰',
          message,
          [
            { text: 'Decline Ride', style: 'cancel', onPress: () => slideOut(() => navigation.goBack()) },
            { text: 'Top Up Now',   onPress: () => slideOut(() => navigation.navigate('Earnings')) },
          ]
        );
      } else {
        Alert.alert('Could not accept', message, [
          { text: 'OK', onPress: () => slideOut(() => navigation.goBack()) }
        ]);
      }
    }
  };

  const fareStr = estimatedFare.toLocaleString('en-NG', { maximumFractionDigits: 0 });
  const distStr = request.distance?.toFixed(1) ?? '—';
  const etaStr  = request.etaMinutes ?? (request.distance ? Math.ceil(request.distance / 0.5) : '—');

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={s.backdrop} />

      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        maxHeight: height * 0.88,
        transform: [{ translateY: slideA }],
      }]}>
        {/* ── Scrollable content ── */}
        <AnimatedRN.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          bounces={false}
        >
          <View style={[s.handle, { backgroundColor: theme.border }]} />

          {/* Top row: badge + countdown */}
          <View style={s.topRow}>
            <Animated.View style={[s.badge, { backgroundColor: DA, transform: [{ scale: pulseA }] }]}>
              <Ionicons name="flash" size={12} color="#080C18" />
              <Text style={s.badgeTxt}>NEW RIDE REQUEST</Text>
            </Animated.View>
            <CountdownRing seconds={countdown} total={TIMEOUT_SECS} color={DA} />
          </View>

          {/* Fare */}
          <Text style={[s.fare, { color: DA }]}>₦{fareStr}</Text>
          <Text style={[s.fareSub, { color: theme.hint }]}>Estimated fare</Text>

          {/* Stats */}
          <View style={s.statsRow}>
            <StatPill icon="navigate-outline" value={`${distStr} km`}  theme={theme} />
            <StatPill icon="time-outline"     value={`~${etaStr} min`} theme={theme} />
            <StatPill icon="cash-outline"     value={request.paymentMethod ?? 'CASH'} theme={theme} />
          </View>

          {/* Wallet balance strip */}
          {loadingWallet ? (
            <View style={[s.walletLoading, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <ActivityIndicator color={DA} size="small" />
              <Text style={[s.walletLoadingTxt, { color: theme.hint }]}>Checking wallet balance...</Text>
            </View>
          ) : (
            <WalletStrip
              balance={walletBalance}
              required={estimatedFare}
              theme={theme}
              onTopUp={() => slideOut(() => navigation.navigate('Earnings'))}
            />
          )}

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          {/* Customer */}
          {request.customer && (
            <View style={s.customerRow}>
              <View style={[s.cAvatar, { backgroundColor: DA + '18' }]}>
                <Text style={[s.cInitials, { color: DA }]}>
                  {request.customer.firstName?.[0]}{request.customer.lastName?.[0]}
                </Text>
              </View>
              <View>
                <Text style={[s.cName, { color: theme.foreground }]}>
                  {request.customer.firstName} {request.customer.lastName}
                </Text>
                <View style={s.cVerified}>
                  <Ionicons name="shield-checkmark" size={11} color="#5DAA72" />
                  <Text style={[s.cVerifiedTxt, { color: '#5DAA72' }]}>Verified rider</Text>
                </View>
              </View>
            </View>
          )}

          {/* Route */}
          <RouteRow icon="radio-button-on" iconColor={DA}    label="PICKUP"   address={request.pickupAddress  ?? '—'} theme={theme} />
          <RouteRow icon="location"        iconColor={RED}   label="DROP-OFF" address={request.dropoffAddress ?? '—'} theme={theme} />

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.declineBtn, { borderColor: theme.border }]}
              onPress={doDecline}
              disabled={accepting}
              activeOpacity={0.75}
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.hint} />
              <Text style={[s.declineTxt, { color: theme.hint }]}>Decline</Text>
            </TouchableOpacity>

            <Animated.View style={[s.acceptWrap, { transform: [{ scale: pulseA }] }]}>
              <TouchableOpacity
                style={[s.acceptBtn, {
                  backgroundColor: hasSufficient ? DA : theme.border,
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
                    <Ionicons name="wallet-outline" size={20} color={theme.hint} />
                    <Text style={[s.acceptTxt, { color: theme.hint }]}>Top Up First</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#080C18" />
                    <Text style={s.acceptTxt}>Accept Ride</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </AnimatedRN.ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, justifyContent: 'flex-end' },
  backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:           { borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 20 },
  scrollContent:   { paddingHorizontal: 24, paddingTop: 14 },
  handle:          { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  badgeTxt:        { fontSize: 10, fontWeight: '900', color: '#080C18', letterSpacing: 1 },
  fare:            { fontSize: 40, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  fareSub:         { fontSize: 12, fontWeight: '500', marginBottom: 16 },
  statsRow:        { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  walletLoading:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 16 },
  walletLoadingTxt:{ fontSize: 12, fontWeight: '500' },
  divider:         { height: 1, marginBottom: 18 },
  customerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  cAvatar:         { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cInitials:       { fontSize: 16, fontWeight: '800' },
  cName:           { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cVerified:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cVerifiedTxt:    { fontSize: 11, fontWeight: '600' },
  actions:         { flexDirection: 'row', gap: 12, marginTop: 4 },
  declineBtn:      { flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  declineTxt:      { fontSize: 15, fontWeight: '700' },
  acceptWrap:      { flex: 2 },
  acceptBtn:       { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  acceptTxt:       { fontSize: 16, fontWeight: '900', color: '#080C18' },
});