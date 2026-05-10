// mobile/src/screens/Driver/IncomingRideScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, Animated, ActivityIndicator, Alert, Vibration,
  ScrollView,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI, walletAPI } from '../../services/api';

const { height } = Dimensions.get('window');
const DA           = '#FFB800';
const GREEN        = '#5DAA72';
const RED          = '#E05555';
const TIMEOUT_SECS = 30;

// Fixed sheet + scroll heights — same bounded-container pattern as
// DriverDashboard (SHEET_SNAP) and ProfileScreen (SCROLL_H).
const FOOTER_H = 14 + 56 + 16; // paddingTop + button height + paddingBottom
const SHEET_H  = height * 0.82;
const SCROLL_H = SHEET_H - FOOTER_H;

// ── Countdown ring ────────────────────────────────────────────────────────────
const CountdownRing = ({ seconds, total, color, expired }) => {
  const SIZE = 80, STROKE = 5;
  const displayColor = expired ? RED : color;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[cr.track, {
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderColor: displayColor + '25', borderWidth: STROKE,
      }]} />
      <View style={[cr.arc, {
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderColor: displayColor, borderWidth: STROKE,
        borderRightColor: 'transparent',
        transform: [{ rotate: expired ? '360deg' : `${(1 - seconds / total) * 360}deg` }],
      }]} />
      {expired
        ? <Ionicons name="time-outline" size={22} color={RED} />
        : <Text style={[cr.txt, { color: displayColor }]}>{seconds}</Text>
      }
    </View>
  );
};
const cr = StyleSheet.create({
  track: { position: 'absolute' },
  arc:   { position: 'absolute' },
  txt:   { fontSize: 20, fontWeight: '900' },
});

// ── Route row ─────────────────────────────────────────────────────────────────
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

// ── Stat pill ─────────────────────────────────────────────────────────────────
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

// ── Wallet strip ──────────────────────────────────────────────────────────────
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
          Balance:{' '}
          <Text style={{ fontWeight: '800', color }}>
            ₦{Number(balance).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
          {' '}/ Required:{' '}
          <Text style={{ fontWeight: '800' }}>
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
        <TouchableOpacity style={[ws.topupBtn, { backgroundColor: DA }]} onPress={onTopUp} activeOpacity={0.85}>
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

// ── Expired banner ────────────────────────────────────────────────────────────
const ExpiredBanner = ({ theme }) => (
  <View style={[eb.wrap, { backgroundColor: RED + '12', borderColor: RED + '35' }]}>
    <Ionicons name="time-outline" size={15} color={RED} />
    <Text style={[eb.txt, { color: RED }]}>
      Timer expired — ride may still be available. Try accepting!
    </Text>
  </View>
);
const eb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 14 },
  txt:  { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomingRideScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const request   = route?.params?.request ?? {};

  const [accepting,     setAccepting]     = useState(false);
  const [countdown,     setCountdown]     = useState(TIMEOUT_SECS);
  const [timedOut,      setTimedOut]      = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const isActingRef = useRef(false);

  const slideA = useRef(new Animated.Value(height)).current;
  const pulseA = useRef(new Animated.Value(1)).current;

  const estimatedFare = Number(request.estimatedFare ?? 0);
  const hasSufficient = walletBalance !== null && walletBalance >= estimatedFare;

  useEffect(() => {
    Vibration.vibrate([0, 250, 100, 250, 100, 250]);

    Animated.spring(slideA, {
      toValue: 0, tension: 70, friction: 11, useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    pulse.start();

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    walletAPI.getWallet()
      .then(res => setWalletBalance(
        res?.data?.wallet?.balance ?? res?.data?.balance ?? 0
      ))
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
        `Please top up first.`,
        [
          { text: 'Decline Ride',  style: 'cancel', onPress: doDecline },
          { text: 'Top Up Wallet', onPress: () => slideOut(() => navigation.navigate('Earnings')) },
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

      const status  = err?.status;
      const message = err?.message ?? 'Ride may have been cancelled.';

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
          { text: 'OK', onPress: () => slideOut(() => navigation.goBack()) },
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

      {/* Dimmed backdrop — tapping it declines */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={doDecline} />

      {/* ── Sheet: fixed height — bounded container pattern ── */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        height: SHEET_H,
        transform: [{ translateY: slideA }],
      }]}>
        <View style={[s.handle, { backgroundColor: theme.border }]} />

        {/* ── Bounded scroll area: explicit pixel height so ScrollView has a
             concrete boundary — mirrors DriverDashboard SHEET_SNAP / ProfileScreen SCROLL_H ── */}
        <View style={{ height: SCROLL_H }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Badge + countdown */}
            <View style={s.topRow}>
              <Animated.View style={[s.badge, { backgroundColor: DA, transform: [{ scale: pulseA }] }]}>
                <Ionicons name="flash" size={12} color="#080C18" />
                <Text style={s.badgeTxt}>NEW RIDE REQUEST</Text>
              </Animated.View>
              <CountdownRing seconds={countdown} total={TIMEOUT_SECS} color={DA} expired={timedOut} />
            </View>

            {timedOut && <ExpiredBanner theme={theme} />}

            <Text style={[s.fare, { color: DA }]}>₦{fareStr}</Text>
            <Text style={[s.fareSub, { color: theme.hint }]}>Estimated fare</Text>

            <View style={s.statsRow}>
              <StatPill icon="navigate-outline" value={`${distStr} km`}  theme={theme} />
              <StatPill icon="time-outline"     value={`~${etaStr} min`} theme={theme} />
              <StatPill icon="cash-outline"     value={request.paymentMethod ?? 'CASH'} theme={theme} />
            </View>

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
                    <Ionicons name="shield-checkmark" size={11} color={GREEN} />
                    <Text style={[s.cVerifiedTxt, { color: GREEN }]}>Verified rider</Text>
                  </View>
                </View>
              </View>
            )}

            <RouteRow icon="radio-button-on" iconColor={DA}  label="PICKUP"   address={request.pickupAddress  ?? '—'} theme={theme} />
            <RouteRow icon="location"        iconColor={RED} label="DROP-OFF" address={request.dropoffAddress ?? '—'} theme={theme} />
          </ScrollView>
        </View>

        {/* ── Actions footer: pinned below bounded scroll area, inside the sheet ── */}
        <View style={[s.actionsFooter, {
          borderTopColor: theme.border,
          paddingBottom: insets.bottom + 16,
        }]}>
          <View style={s.actionsRow}>
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
                    <Text style={s.acceptTxt}>{timedOut ? 'Try Accept' : 'Accept Ride'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Sheet: position absolute, fixed height — the bounded container
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 20 },

  handle:           { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 20 },
  scrollContent:    { paddingHorizontal: 24, paddingBottom: 8 },
  topRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badge:            { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  badgeTxt:         { fontSize: 10, fontWeight: '900', color: '#080C18', letterSpacing: 1 },
  fare:             { fontSize: 40, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  fareSub:          { fontSize: 12, fontWeight: '500', marginBottom: 16 },
  statsRow:         { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  walletLoading:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 16 },
  walletLoadingTxt: { fontSize: 12, fontWeight: '500' },
  divider:          { height: 1, marginBottom: 18 },
  customerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  cAvatar:          { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cInitials:        { fontSize: 16, fontWeight: '800' },
  cName:            { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cVerified:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cVerifiedTxt:     { fontSize: 11, fontWeight: '600' },

  // Footer pinned below scroll area, inside the sheet
  actionsFooter:    { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: 24 },
  actionsRow:       { flexDirection: 'row', gap: 12 },
  declineBtn:       { flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  declineTxt:       { fontSize: 15, fontWeight: '700' },
  acceptWrap:       { flex: 2 },
  acceptBtn:        { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  acceptTxt:        { fontSize: 16, fontWeight: '900', color: '#080C18' },
});