// mobile/src/screens/Partner/IncomingDeliveryQueueScreen.js
//
// InDrive-style multi-request queue for delivery partners — full screen, no map.
//
// ── What this does ────────────────────────────────────────────────────────────
//   • All pending delivery requests stack as scrollable cards (full screen)
//   • Partner scrolls to compare fees (highest fee floated to top)
//   • Taps a card → expands full detail modal (route, package, breakdown, wallet)
//   • Accepts → ActiveDelivery; Declines → removed from queue
//   • Per-card 45s countdown ring; expired cards dimmed with "Clear expired"
//   • Customer and partner see the same estimatedFee; breakdown shows split
//
// ── Price flow (mirrors ride queue) ──────────────────────────────────────────
//   Customer sees:  estimatedFee (base + distance + weight)
//   Partner sees:   same estimatedFee + breakdown (partnerEarnings / platformFee)
//   Platform gets:  15% commission on estimatedFee
//
// ── Wire-up (PartnerDashboard socket handler) ─────────────────────────────────
//   const currentRoute = navigation.getState()?.routes?.slice(-1)[0]?.name;
//   if (currentRoute === 'IncomingDeliveryQueue') return;
//   navigation.navigate('IncomingDeliveryQueue', { initialRequest: data });
//
// ── Navigator (DashboardStack in PartnerNavigator.js) ────────────────────────
//   <Stack.Screen name="IncomingDeliveryQueue" component={IncomingDeliveryQueueScreen}
//     options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, ActivityIndicator, Alert, Vibration,
  Modal, Dimensions, Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { deliveryAPI, walletAPI } from '../../services/api';
import socketService          from '../../services/socket';

const { width, height } = Dimensions.get('window');
const H_PAD          = 20;
const REQUEST_SECS   = 45;
const CA             = '#34D399';   // courier accent — teal-green
const COMMISSION     = 0.15;        // delivery platform commission

// ── Colour helpers ────────────────────────────────────────────────────────────
const feeColor = (fee) => {
  if (fee >= 3000) return '#5DAA72';   // green  — high value
  if (fee >= 1500) return CA;          // teal   — medium
  return '#A78BFA';                    // purple — low
};
const fmt = (n) =>
  Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });

// ── Countdown ring ────────────────────────────────────────────────────────────
const TinyRing = ({ seconds, total, color }) => {
  const expired = seconds <= 0;
  const c       = expired ? '#E05555' : color;
  const pct     = seconds / total;
  return (
    <View style={tr.wrap}>
      <View style={[tr.track, { borderColor: c + '30' }]} />
      {!expired && (
        <View style={[tr.arc, {
          borderColor: c,
          borderRightColor:  'transparent',
          borderBottomColor: pct < 0.5 ? 'transparent' : c,
          transform: [{ rotate: `${(1 - pct) * 360}deg` }],
        }]} />
      )}
      <Text style={[tr.txt, { color: c }]}>{expired ? '!' : seconds}</Text>
    </View>
  );
};
const tr = StyleSheet.create({
  wrap:  { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  track: { ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 3 },
  arc:   {
    ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 3,
    borderLeftColor: 'transparent',
  },
  txt: { fontSize: 13, fontWeight: '900' },
});

// ── Route strip ───────────────────────────────────────────────────────────────
const RouteStrip = ({ from, to, theme }) => (
  <View style={rs.wrap}>
    <View style={rs.dots}>
      <View style={[rs.dot, { backgroundColor: CA }]} />
      <View style={[rs.line, { backgroundColor: theme.border }]} />
      <View style={[rs.dot, { backgroundColor: '#E05555' }]} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[rs.addr, { color: theme.foreground }]} numberOfLines={1}>{from}</Text>
      <View style={{ height: 10 }} />
      <Text style={[rs.addr, { color: theme.hint }]}       numberOfLines={1}>{to}</Text>
    </View>
  </View>
);
const rs = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  dots: { alignItems: 'center', gap: 0 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  line: { width: 1.5, height: 18, marginVertical: 2 },
  addr: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});

// ── Fee breakdown (modal) ─────────────────────────────────────────────────────
const FeeBreakdown = ({ fee, theme, color }) => {
  const earnings = Math.round(fee * (1 - COMMISSION));
  const platform = fee - earnings;
  return (
    <View style={[fb.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={fb.col}>
        <Text style={[fb.label, { color: theme.hint }]}>CUSTOMER PAYS</Text>
        <Text style={[fb.val, { color: color }]}>₦{fmt(fee)}</Text>
      </View>
      <View style={[fb.div, { backgroundColor: theme.border }]} />
      <View style={fb.col}>
        <Text style={[fb.label, { color: theme.hint }]}>YOUR EARNINGS</Text>
        <Text style={[fb.val, { color: '#5DAA72' }]}>₦{fmt(earnings)}</Text>
      </View>
      <View style={[fb.div, { backgroundColor: theme.border }]} />
      <View style={fb.col}>
        <Text style={[fb.label, { color: theme.hint }]}>PLATFORM (15%)</Text>
        <Text style={[fb.val, { color: '#A78BFA' }]}>₦{fmt(platform)}</Text>
      </View>
    </View>
  );
};
const fb = StyleSheet.create({
  wrap:  { flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  col:   { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 5 },
  label: { fontSize: 7, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  val:   { fontSize: 15, fontWeight: '900' },
  div:   { width: 1 },
});

// ── Wallet strip ──────────────────────────────────────────────────────────────
const WalletStrip = ({ balance, required, theme, onTopUp }) => {
  const ok       = balance >= required;
  const col      = ok ? '#5DAA72' : '#E05555';
  const shortfall = required - balance;
  return (
    <View style={[ws.wrap, { backgroundColor: col + '10', borderColor: col + '30' }]}>
      <Ionicons name="wallet-outline" size={16} color={col} />
      <View style={{ flex: 1 }}>
        <Text style={[ws.title, { color: col }]}>
          {ok ? `Wallet OK ✓  ₦${fmt(balance)}` : `Balance ₦${fmt(balance)}`}
        </Text>
        {!ok && (
          <Text style={[ws.sub, { color: '#E05555' }]}>
            Top up ₦{fmt(shortfall)} to accept
          </Text>
        )}
      </View>
      {!ok && (
        <TouchableOpacity
          style={[ws.btn, { backgroundColor: CA }]}
          onPress={onTopUp}
          activeOpacity={0.85}
        >
          <Text style={ws.btnTxt}>Top Up</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
const ws = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  title:  { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  sub:    { fontSize: 11, fontWeight: '700' },
  btn:    { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0 },
  btnTxt: { fontSize: 12, fontWeight: '900', color: '#080C18' },
});

// ── Collapsed request card ────────────────────────────────────────────────────
const RequestCard = React.memo(({ req, onTap, theme, walletBalance }) => {
  const color     = feeColor(req.estimatedFee);
  const canAfford = walletBalance === null || walletBalance >= req.estimatedFee;
  const scaleA    = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.spring(scaleA, {
      toValue: 1, tension: 100, friction: 9, useNativeDriver: true,
    }).start();
  }, []);

  const hasWeight = !!req.packageWeight && Number(req.packageWeight) > 0;

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        onPress={() => onTap(req.id)}
        activeOpacity={0.88}
        style={[
          rc.card,
          {
            backgroundColor: theme.backgroundAlt,
            borderColor:     req.expired ? '#E05555' + '35' : theme.border,
            opacity:         req.expired ? 0.6 : 1,
          },
        ]}
      >
        {/* Left coloured stripe */}
        <View style={[rc.stripe, { backgroundColor: color }]} />

        <View style={rc.body}>
          {/* Top row: fee + timer */}
          <View style={rc.topRow}>
            <View>
              <Text style={[rc.feeLabel, { color: theme.hint }]}>DELIVERY FEE</Text>
              <Text style={[rc.fee, { color: color }]}>₦{fmt(req.estimatedFee)}</Text>
              <Text style={[rc.earningHint, { color: theme.hint }]}>
                Your cut: ₦{fmt(Math.round(req.estimatedFee * (1 - COMMISSION)))}
              </Text>
            </View>
            <TinyRing seconds={req.timeLeft} total={REQUEST_SECS} color={color} />
          </View>

          {/* Route */}
          <RouteStrip from={req.pickupAddress} to={req.dropoffAddress} theme={theme} />

          {/* Meta pills */}
          <View style={rc.metaRow}>
            <View style={[rc.pill, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="navigate-outline" size={11} color={theme.hint} />
              <Text style={[rc.pillTxt, { color: theme.hint }]}>{req.distance?.toFixed(1)} km</Text>
            </View>
            <View style={[rc.pill, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="time-outline" size={11} color={theme.hint} />
              <Text style={[rc.pillTxt, { color: theme.hint }]}>~{req.etaMinutes} min</Text>
            </View>
            {hasWeight && (
              <View style={[rc.pill, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="scale-outline" size={11} color={theme.hint} />
                <Text style={[rc.pillTxt, { color: theme.hint }]}>{req.packageWeight} kg</Text>
              </View>
            )}
            {req.packageDescription && (
              <View style={[rc.pill, { backgroundColor: CA + '12', borderColor: CA + '35' }]}>
                <Ionicons name="cube-outline" size={11} color={CA} />
                <Text style={[rc.pillTxt, { color: CA }]} numberOfLines={1}>
                  {req.packageDescription.length > 12
                    ? req.packageDescription.slice(0, 12) + '…'
                    : req.packageDescription}
                </Text>
              </View>
            )}
            {!canAfford && (
              <View style={[rc.pill, { backgroundColor: '#E05555' + '18', borderColor: '#E05555' + '40' }]}>
                <Ionicons name="wallet-outline" size={11} color="#E05555" />
                <Text style={[rc.pillTxt, { color: '#E05555' }]}>Low balance</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tap cue */}
        <View style={[rc.chevron, { backgroundColor: color + '12' }]}>
          <Ionicons name="chevron-forward" size={16} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const rc = StyleSheet.create({
  card:        { flexDirection: 'row', borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', marginBottom: 12 },
  stripe:      { width: 6 },
  body:        { flex: 1, padding: 16 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  feeLabel:    { fontSize: 8, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  fee:         { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 1 },
  earningHint: { fontSize: 11, fontWeight: '600' },
  metaRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  pillTxt:     { fontSize: 10, fontWeight: '700' },
  chevron:     { width: 38, justifyContent: 'center', alignItems: 'center' },
});

// ── Detail modal ──────────────────────────────────────────────────────────────
const DetailModal = ({
  req, theme, walletBalance, loadingWallet,
  accepting, onAccept, onDecline, onClose, onNavigateTopUp,
}) => {
  if (!req) return null;
  const color     = feeColor(req.estimatedFee);
  const canAfford = !loadingWallet && walletBalance >= req.estimatedFee;
  const slideA    = useRef(new Animated.Value(height)).current;
  const insets    = useSafeAreaInsets();

  useEffect(() => {
    Animated.spring(slideA, {
      toValue: 0, tension: 68, friction: 11, useNativeDriver: true,
    }).start();
  }, []);

  const close = () =>
    Animated.timing(slideA, {
      toValue: height, duration: 240, useNativeDriver: true,
    }).start(onClose);

  const hasWeight = !!req.packageWeight && Number(req.packageWeight) > 0;

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      <View style={dm.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={close} />
        <Animated.View style={[dm.sheet, {
          backgroundColor: theme.background,
          transform: [{ translateY: slideA }],
          paddingBottom: insets.bottom + 16,
        }]}>
          <View style={[dm.handle, { backgroundColor: theme.border }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={dm.scroll}
            bounces={false}
          >
            {/* Fee header */}
            <View style={dm.feeRow}>
              <View style={[dm.colorBar, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[dm.feeTopLabel, { color: theme.hint }]}>
                  TOTAL FEE (SAME PRICE CUSTOMER SEES)
                </Text>
                <Text style={[dm.feeAmt, { color: color }]}>₦{fmt(req.estimatedFee)}</Text>
              </View>
            </View>

            {/* Fee breakdown — same total, transparent split */}
            <FeeBreakdown fee={req.estimatedFee} theme={theme} color={color} />

            {/* Stats row */}
            <View style={dm.statsRow}>
              {[
                { icon: 'navigate-outline', val: `${req.distance?.toFixed(1)} km`, lbl: 'Distance' },
                { icon: 'time-outline',     val: `~${req.etaMinutes} min`,          lbl: 'ETA' },
                ...(hasWeight ? [{ icon: 'scale-outline', val: `${req.packageWeight} kg`, lbl: 'Weight' }] : []),
              ].map(({ icon, val, lbl }) => (
                <View key={lbl} style={[dm.stat, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name={icon} size={16} color={color} />
                  <Text style={[dm.statVal, { color: theme.foreground }]}>{val}</Text>
                  <Text style={[dm.statLbl, { color: theme.hint }]}>{lbl}</Text>
                </View>
              ))}
            </View>

            {/* Package info */}
            {req.packageDescription && (
              <View style={[dm.pkgCard, { backgroundColor: color + '10', borderColor: color + '30' }]}>
                <Ionicons name="cube-outline" size={16} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={[dm.pkgLabel, { color: theme.hint }]}>PACKAGE</Text>
                  <Text style={[dm.pkgDesc, { color: theme.foreground }]}>{req.packageDescription}</Text>
                </View>
              </View>
            )}

            {/* Route card */}
            <View style={[dm.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={dm.routeRow}>
                <View style={[dm.routeDot, { backgroundColor: CA }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[dm.routeLabel, { color: theme.hint }]}>PICKUP</Text>
                  <Text style={[dm.routeAddr,  { color: theme.foreground }]}>{req.pickupAddress}</Text>
                  {req.pickupContact && (
                    <Text style={[dm.routeContact, { color: theme.hint }]}>{req.pickupContact}</Text>
                  )}
                </View>
              </View>
              <View style={[dm.routeLine, { backgroundColor: theme.border }]} />
              <View style={dm.routeRow}>
                <View style={[dm.routeDot, { backgroundColor: '#E05555' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[dm.routeLabel, { color: theme.hint }]}>DROP-OFF</Text>
                  <Text style={[dm.routeAddr,  { color: theme.foreground }]}>{req.dropoffAddress}</Text>
                  {req.dropoffContact && (
                    <Text style={[dm.routeContact, { color: theme.hint }]}>{req.dropoffContact}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Customer */}
            {req.customer && (
              <View style={[dm.customerCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={[dm.cAvatar, { backgroundColor: color + '18' }]}>
                  <Text style={[dm.cInitials, { color }]}>
                    {req.customer.firstName?.[0] ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[dm.cName, { color: theme.foreground }]}>
                    {req.customer.firstName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Ionicons name="shield-checkmark" size={11} color="#5DAA72" />
                    <Text style={[dm.cVerified, { color: '#5DAA72' }]}>Verified customer</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Wallet */}
            {loadingWallet ? (
              <View style={[ws.wrap, { borderColor: theme.border, backgroundColor: theme.backgroundAlt }]}>
                <ActivityIndicator color={color} size="small" />
                <Text style={[ws.title, { color: theme.hint }]}>Checking wallet…</Text>
              </View>
            ) : (
              <WalletStrip
                balance={walletBalance}
                required={req.estimatedFee}
                theme={theme}
                onTopUp={() => { close(); setTimeout(onNavigateTopUp, 280); }}
              />
            )}

            {/* Expired note */}
            {req.expired && (
              <View style={[dm.expiredBar, { backgroundColor: '#E05555' + '12', borderColor: '#E05555' + '35' }]}>
                <Ionicons name="time-outline" size={14} color="#E05555" />
                <Text style={[dm.expiredTxt, { color: '#E05555' }]}>
                  Timer expired — delivery may still be available. Try accepting!
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={[dm.footer, { borderTopColor: theme.border }]}>
            <View style={dm.footerRow}>
              <TouchableOpacity
                style={[dm.declineBtn, { borderColor: theme.border }]}
                onPress={() => { close(); setTimeout(() => onDecline(req.id), 200); }}
                disabled={accepting}
                activeOpacity={0.75}
              >
                <Ionicons name="close-circle-outline" size={20} color={theme.hint} />
                <Text style={[dm.declineTxt, { color: theme.hint }]}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[dm.acceptBtn, {
                  backgroundColor: canAfford ? color : theme.border,
                  opacity: (accepting || loadingWallet) ? 0.7 : 1,
                }]}
                onPress={() => onAccept(req)}
                disabled={accepting || loadingWallet || !canAfford}
                activeOpacity={0.88}
              >
                {accepting ? (
                  <ActivityIndicator color="#080C18" size="small" />
                ) : canAfford ? (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#080C18" />
                    <Text style={dm.acceptTxt}>
                      {req.expired ? 'Try Accept' : 'Accept'} · ₦{fmt(req.estimatedFee)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="wallet-outline" size={20} color={theme.hint} />
                    <Text style={[dm.acceptTxt, { color: theme.hint }]}>Top Up First</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const dm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  sheet:        {
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    maxHeight: height * 0.92, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 24,
  },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 20 },
  scroll:       { paddingHorizontal: H_PAD, paddingBottom: 8 },
  feeRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  colorBar:     { width: 5, height: 56, borderRadius: 3, flexShrink: 0 },
  feeTopLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  feeAmt:       { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  statsRow:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat:         { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 14, gap: 5 },
  statVal:      { fontSize: 12, fontWeight: '800' },
  statLbl:      { fontSize: 9, fontWeight: '600' },
  pkgCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  pkgLabel:     { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginBottom: 3 },
  pkgDesc:      { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  routeCard:    { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  routeRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot:     { width: 9, height: 9, borderRadius: 5, marginTop: 5, flexShrink: 0 },
  routeLine:    { width: 1.5, height: 14, marginLeft: 4, marginVertical: 4 },
  routeLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  routeAddr:    { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  routeContact: { fontSize: 11, marginTop: 2 },
  customerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  cAvatar:      { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cInitials:    { fontSize: 16, fontWeight: '800' },
  cName:        { fontSize: 14, fontWeight: '700' },
  cVerified:    { fontSize: 11, fontWeight: '600' },
  expiredBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  expiredTxt:   { fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  footer:       { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: H_PAD },
  footerRow:    { flexDirection: 'row', gap: 10 },
  declineBtn:   { flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  declineTxt:   { fontSize: 15, fontWeight: '700' },
  acceptBtn:    { flex: 2, height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  acceptTxt:    { fontSize: 15, fontWeight: '900', color: '#080C18' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomingDeliveryQueueScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';
  const initReq         = route?.params?.initialRequest;

  // ── Build a queue entry from a raw socket payload ─────────────────────────
  const makeEntry = useCallback((req) => ({
    id:                 req.deliveryId ?? req.id ?? String(Date.now()),
    deliveryId:         req.deliveryId ?? req.id,
    pickupAddress:      req.pickupAddress  ?? '—',
    pickupContact:      req.pickupContact  ?? null,
    dropoffAddress:     req.dropoffAddress ?? '—',
    dropoffContact:     req.dropoffContact ?? null,
    estimatedFee:       Number(req.estimatedFee ?? 0),
    distance:           Number(req.distance      ?? 0),
    etaMinutes:         req.etaMinutes ?? Math.ceil((req.distance ?? 0) / 0.4),
    packageDescription: req.packageDescription ?? null,
    packageWeight:      req.packageWeight ?? null,
    customer:           req.customer ?? null,
    timeLeft:           REQUEST_SECS,
    expired:            false,
    receivedAt:         Date.now(),
  }), []);

  const [requests,      setRequests]      = useState(() => initReq ? [makeEntry(initReq)] : []);
  const [expandedReq,   setExpandedReq]   = useState(null);
  const [accepting,     setAccepting]     = useState(false);
  const [walletBal,     setWalletBal]     = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  const actingRef = useRef(new Set());
  const headerA   = useRef(new Animated.Value(0)).current;
  const listA     = useRef(new Animated.Value(0)).current;

  // ── Wallet ────────────────────────────────────────────────────────────────
  useEffect(() => {
    walletAPI.getWallet()
      .then(res => setWalletBal(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
      .catch(() => setWalletBal(0))
      .finally(() => setLoadingWallet(false));
  }, []);

  // ── Entry animation ───────────────────────────────────────────────────────
  useEffect(() => {
    Vibration.vibrate([0, 200, 80, 200]);
    Animated.parallel([
      Animated.spring(headerA, { toValue: 1, tension: 70, friction: 12, useNativeDriver: true }),
      Animated.timing(listA,   { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Incoming socket requests ──────────────────────────────────────────────
  useEffect(() => {
    const handleNew = (data) => {
      const entry = makeEntry(data);
      setRequests(prev => {
        if (prev.some(r => r.deliveryId === entry.deliveryId)) return prev;
        Vibration.vibrate([0, 150, 80, 150]);
        return [entry, ...prev];
      });
    };
    socketService.on('delivery:incoming_request', handleNew);
    return () => socketService.off('delivery:incoming_request', handleNew);
  }, [makeEntry]);

  // ── Per-second countdown ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setRequests(prev =>
        prev.map(r =>
          r.expired ? r : {
            ...r,
            timeLeft: Math.max(0, r.timeLeft - 1),
            expired:  r.timeLeft <= 1,
          }
        )
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Auto-exit when queue empties ──────────────────────────────────────────
  useEffect(() => {
    if (requests.length === 0) {
      const t = setTimeout(() => navigation.goBack(), 350);
      return () => clearTimeout(t);
    }
  }, [requests.length, navigation]);

  // ── Accept ────────────────────────────────────────────────────────────────
  const handleAccept = useCallback(async (req) => {
    if (actingRef.current.has(req.id)) return;
    actingRef.current.add(req.id);
    setAccepting(true);
    setExpandedReq(null);

    try {
      await deliveryAPI.acceptDelivery(req.deliveryId);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      navigation.replace('ActiveDelivery', { deliveryId: req.deliveryId });
    } catch (err) {
      actingRef.current.delete(req.id);
      setAccepting(false);
      const status  = err?.status ?? err?.statusCode;
      const message = err?.message ?? 'This delivery may no longer be available.';

      if (status === 402) {
        Alert.alert('Top-Up Required 💰', message, [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'Top Up', onPress: () => navigation.navigate('EarningsHome') },
        ]);
      } else {
        Alert.alert('Could not accept', message);
        setRequests(prev => prev.filter(r => r.id !== req.id));
      }
    }
  }, [navigation]);

  // ── Decline ───────────────────────────────────────────────────────────────
  const handleDecline = useCallback((id) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  // ── Dismiss expired ───────────────────────────────────────────────────────
  const dismissExpired = useCallback(() => {
    setRequests(prev => prev.filter(r => !r.expired));
  }, []);

  const activeCount  = requests.filter(r => !r.expired).length;
  const expiredCount = requests.filter(r => r.expired).length;

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? 1 : -1;
    return b.estimatedFee - a.estimatedFee;
  });

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.header, {
        paddingTop:        insets.top + 16,
        borderBottomColor: theme.border,
        opacity:           headerA,
        transform:         [{ translateY: headerA.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }]}>
        <TouchableOpacity
          style={[s.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Incoming Deliveries</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>
            {activeCount} active{expiredCount > 0 ? `  ·  ${expiredCount} expired` : ''}
            {requests.length > 1 ? '  ·  Scroll to compare' : ''}
          </Text>
        </View>

        {activeCount > 0 && (
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveTxt}>{activeCount}</Text>
          </View>
        )}

        {expiredCount > 0 && (
          <TouchableOpacity
            style={[s.clearBtn, { backgroundColor: '#E05555' + '14', borderColor: '#E05555' + '35' }]}
            onPress={dismissExpired}
            activeOpacity={0.8}
          >
            <Text style={[s.clearTxt, { color: '#E05555' }]}>Clear expired</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Low wallet banner ──────────────────────────────────────────────── */}
      {!loadingWallet && walletBal !== null && walletBal < 500 && (
        <TouchableOpacity
          style={[s.walletBanner, { backgroundColor: '#E05555' + '12', borderColor: '#E05555' + '40' }]}
          onPress={() => navigation.navigate('EarningsHome')}
          activeOpacity={0.85}
        >
          <Ionicons name="wallet-outline" size={14} color="#E05555" />
          <Text style={[s.walletBannerTxt, { color: '#E05555' }]}>
            Low wallet balance (₦{fmt(walletBal)}) — some deliveries locked
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#E05555" />
        </TouchableOpacity>
      )}

      {/* ── Hint strip ─────────────────────────────────────────────────────── */}
      {activeCount > 1 && (
        <View style={[s.hintStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <Ionicons name="swap-vertical-outline" size={13} color={theme.hint} />
          <Text style={[s.hintTxt, { color: theme.hint }]}>
            Highest-paying deliveries shown first. Tap any card to see full details.
          </Text>
        </View>
      )}

      {/* ── Request list ───────────────────────────────────────────────────── */}
      <Animated.View style={[{ flex: 1 }, { opacity: listA }]}>
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {requests.length === 0 && (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="cube-outline" size={36} color={theme.hint} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.foreground }]}>No pending deliveries</Text>
              <Text style={[s.emptySub,   { color: theme.hint }]}>
                New delivery requests will appear here
              </Text>
            </View>
          )}

          {sortedRequests.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              onTap={(id) => {
                const r = requests.find(x => x.id === id);
                if (r) setExpandedReq(r);
              }}
              theme={theme}
              walletBalance={walletBal}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── Accepting overlay ──────────────────────────────────────────────── */}
      {accepting && (
        <View style={s.acceptingOverlay}>
          <View style={[s.acceptingCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ActivityIndicator color={CA} size="large" />
            <Text style={[s.acceptingTxt, { color: CA }]}>Accepting delivery…</Text>
            <Text style={[s.acceptingSub, { color: theme.hint }]}>Connecting you to the customer</Text>
          </View>
        </View>
      )}

      {/* ── Detail modal ───────────────────────────────────────────────────── */}
      {expandedReq && (
        <DetailModal
          req={expandedReq}
          theme={theme}
          walletBalance={walletBal ?? 0}
          loadingWallet={loadingWallet}
          accepting={accepting}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onClose={() => setExpandedReq(null)}
          onNavigateTopUp={() => navigation.navigate('EarningsHome')}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: H_PAD, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  headerSub:   { fontSize: 11, marginTop: 2 },

  liveBadge: {
    backgroundColor: '#5DAA72', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { fontSize: 13, fontWeight: '900', color: '#fff' },

  clearBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 },
  clearTxt: { fontSize: 10, fontWeight: '800' },

  walletBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: H_PAD, marginTop: 10,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  walletBannerTxt: { flex: 1, fontSize: 11, fontWeight: '700' },

  hintStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: H_PAD, marginTop: 10,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  hintTxt: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },

  list: { paddingHorizontal: H_PAD, paddingTop: 16 },

  empty:      { alignItems: 'center', paddingTop: height * 0.18 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub:   { fontSize: 13, textAlign: 'center' },

  acceptingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100,
  },
  acceptingCard: {
    borderRadius: 24, borderWidth: 1,
    padding: 32, alignItems: 'center', gap: 12, minWidth: 220,
  },
  acceptingTxt: { fontSize: 17, fontWeight: '800' },
  acceptingSub: { fontSize: 12 },
});