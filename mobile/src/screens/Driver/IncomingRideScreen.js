// mobile/src/screens/Driver/IncomingRideScreen.js
//
// Full-screen modal that slides up when a ride request arrives.
// Registered in DashboardStack so it covers the tab bar entirely.
// Navigated to from DriverDashboardScreen when ride:new_request fires.
// On Accept  → navigates to ActiveRide (replacing this screen)
// On Decline → goes back to Dashboard

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, Animated, ActivityIndicator, Alert, Vibration,
} from 'react-native';
import { Ionicons }              from '@expo/vector-icons';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useTheme }              from '../../context/ThemeContext';
import { rideAPI }               from '../../services/api';

const { width, height } = Dimensions.get('window');
const DA = '#FFB800';

// ── Countdown ring ─────────────────────────────────────────────────────────────
// Gives the driver 30 seconds to respond before auto-declining.
const TIMEOUT_SECS = 30;

const CountdownRing = ({ seconds, total, color }) => {
  const SIZE   = 88;
  const STROKE = 5;
  const R      = (SIZE - STROKE) / 2;
  const CIRC   = 2 * Math.PI * R;
  const dash   = CIRC * (seconds / total);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background track */}
      <View style={[cr.track, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderColor: color + '25', borderWidth: STROKE }]} />
      {/* SVG-less approach: rotate a border arc */}
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
  txt:   { fontSize: 22, fontWeight: '900' },
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
  <View style={[sp.pill, { backgroundColor: theme.background, borderColor: theme.border }]}>
    <Ionicons name={icon} size={13} color={theme.hint} />
    <Text style={[sp.txt, { color: theme.foreground }]}>{value}</Text>
  </View>
);
const sp = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  txt:  { fontSize: 12, fontWeight: '700' },
});

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function IncomingRideScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  // The ride request payload passed from DriverDashboardScreen
  const request = route?.params?.request ?? {};

  const [accepting,  setAccepting]  = useState(false);
  const [declining,  setDeclining]  = useState(false);
  const [countdown,  setCountdown]  = useState(TIMEOUT_SECS);

  // Animations
  const slideA  = useRef(new Animated.Value(height)).current;
  const glowA   = useRef(new Animated.Value(0)).current;
  const pulseA  = useRef(new Animated.Value(1)).current;

  // ── Entry animation + vibration ─────────────────────────────────────────────
  useEffect(() => {
    Vibration.vibrate([0, 250, 100, 250, 100, 250]);

    Animated.spring(slideA, {
      toValue: 0, tension: 70, friction: 11, useNativeDriver: true,
    }).start();

    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowA, { toValue: 1, duration: 800, useNativeDriver: false }),
      Animated.timing(glowA, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]));
    glowLoop.start();

    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    pulseLoop.start();

    // Countdown timer — auto-decline at 0
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleDecline(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      glowLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  // ── Accept ──────────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (accepting || declining) return;
    setAccepting(true);
    try {
      await rideAPI.acceptRide(request.rideId);
      // Replace this screen with ActiveRide so back doesn't return here
      navigation.replace('ActiveRide', { rideId: request.rideId });
    } catch (err) {
      Alert.alert(
        'Could not accept',
        err?.response?.data?.message ?? 'Ride may have been cancelled.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setAccepting(false);
    }
  };

  // ── Decline ─────────────────────────────────────────────────────────────────
  const handleDecline = (auto = false) => {
    if (accepting) return;
    setDeclining(true);
    // Slide back down then go back
    Animated.timing(slideA, { toValue: height, duration: 280, useNativeDriver: true }).start(() => {
      navigation.goBack();
    });
  };

  const fareStr = Number(request.estimatedFare ?? 0)
    .toLocaleString('en-NG', { maximumFractionDigits: 0 });

  const distStr = request.distance?.toFixed(1) ?? '—';
  const etaStr  = request.etaMinutes
    ?? (request.distance ? Math.ceil(request.distance / 0.5) : '—');

  const glowColor = glowA.interpolate({
    inputRange: [0, 1], outputRange: [DA + '30', DA + 'CC'],
  });

  return (
    <View style={[s.root, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View
        style={[s.sheet, {
          backgroundColor: theme.background,
          paddingBottom: insets.bottom + 20,
          transform: [{ translateY: slideA }],
        }]}
      >
        {/* ── Drag handle ── */}
        <View style={[s.handle, { backgroundColor: theme.border }]} />

        {/* ── Top row: badge + fare ── */}
        <View style={s.topRow}>
          <Animated.View style={[s.badge, { backgroundColor: DA, transform: [{ scale: pulseA }] }]}>
            <Ionicons name="flash" size={12} color="#080C18" />
            <Text style={s.badgeTxt}>NEW RIDE REQUEST</Text>
          </Animated.View>
          <CountdownRing seconds={countdown} total={TIMEOUT_SECS} color={DA} />
        </View>

        {/* ── Fare ── */}
        <Animated.Text style={[s.fare, { color: DA }]}>
          {'\u20A6'}{fareStr}
        </Animated.Text>
        <Text style={[s.fareSub, { color: theme.hint }]}>Estimated fare</Text>

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          <StatPill icon="navigate-outline" value={`${distStr} km`}  theme={theme} />
          <StatPill icon="time-outline"     value={`~${etaStr} min`} theme={theme} />
          <StatPill icon="cash-outline"     value={request.paymentMethod ?? 'CASH'} theme={theme} />
        </View>

        {/* ── Divider ── */}
        <View style={[s.divider, { backgroundColor: theme.border }]} />

        {/* ── Customer ── */}
        {request.customer && (
          <View style={[s.customerRow, { borderColor: theme.border }]}>
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

        {/* ── Route ── */}
        <RouteRow
          icon="radio-button-on" iconColor={DA}
          label="PICKUP" address={request.pickupAddress ?? '—'}
          theme={theme}
        />
        <RouteRow
          icon="location" iconColor="#E05555"
          label="DROP-OFF" address={request.dropoffAddress ?? '—'}
          theme={theme}
        />

        {/* ── Divider ── */}
        <View style={[s.divider, { backgroundColor: theme.border }]} />

        {/* ── Action buttons ── */}
        <View style={s.actions}>
          {/* Decline */}
          <TouchableOpacity
            style={[s.declineBtn, { borderColor: theme.border }]}
            onPress={() => handleDecline(false)}
            disabled={accepting || declining}
            activeOpacity={0.75}
          >
            {declining ? (
              <ActivityIndicator color={theme.hint} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={theme.hint} />
                <Text style={[s.declineTxt, { color: theme.hint }]}>Decline</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Accept */}
          <Animated.View style={[s.acceptWrap, { transform: [{ scale: pulseA }] }]}>
            <TouchableOpacity
              style={[s.acceptBtn, { backgroundColor: DA }]}
              onPress={handleAccept}
              disabled={accepting || declining}
              activeOpacity={0.88}
            >
              {accepting ? (
                <ActivityIndicator color="#080C18" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#080C18" />
                  <Text style={s.acceptTxt}>Accept Ride</Text>
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
  root:  { flex: 1, justifyContent: 'flex-end' },

  sheet: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 14,
    // Shadow
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 20,
  },

  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  badgeTxt: { fontSize: 10, fontWeight: '900', color: '#080C18', letterSpacing: 1 },

  fare:    { fontSize: 42, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  fareSub: { fontSize: 12, fontWeight: '500', marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },

  divider: { height: 1, marginBottom: 18 },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cInitials:   { fontSize: 16, fontWeight: '800' },
  cName:       { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cVerified:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cVerifiedTxt:{ fontSize: 11, fontWeight: '600' },

  actions:    { flexDirection: 'row', gap: 12, marginTop: 4 },
  declineBtn: {
    flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  declineTxt: { fontSize: 15, fontWeight: '700' },
  acceptWrap: { flex: 2 },
  acceptBtn:  {
    height: 56, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  acceptTxt:  { fontSize: 16, fontWeight: '900', color: '#080C18' },
});