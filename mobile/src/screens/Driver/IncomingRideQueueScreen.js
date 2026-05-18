// mobile/src/screens/Driver/IncomingRideQueueScreen.js
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
import { rideAPI, walletAPI } from '../../services/api';
import socketService          from '../../services/socket';

const { width, height } = Dimensions.get('window');
const H_PAD        = 20;
const REQUEST_SECS = 45;
const COMMISSION   = 0.20;
const TAB_CONTENT_H = 54;

// ── Colour helpers ────────────────────────────────────────────────────────────
const fareColor = (fare) => {
  if (fare >= 3000) return '#5DAA72';   // green  — high value
  if (fare >= 1500) return '#FFB800';   // amber  — medium
  return '#A78BFA';                     // purple — low
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

// ── Compact route strip ───────────────────────────────────────────────────────
const RouteStrip = ({ from, to, theme }) => (
  <View style={rs.wrap}>
    <View style={rs.dots}>
      <View style={[rs.dot, { backgroundColor: '#FFB800' }]} />
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

// ── Fare breakdown strip (modal) ──────────────────────────────────────────────
const FareBreakdown = ({ fare, theme, color }) => {
  const earnings = Math.round(fare * (1 - COMMISSION));
  const platform = fare - earnings;
  return (
    <View style={[fb.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={fb.col}>
        <Text style={[fb.label, { color: theme.hint }]}>CUSTOMER PAYS</Text>
        <Text style={[fb.val, { color: color }]}>₦{fmt(fare)}</Text>
      </View>
      <View style={[fb.div, { backgroundColor: theme.border }]} />
      <View style={fb.col}>
        <Text style={[fb.label, { color: theme.hint }]}>YOUR EARNINGS</Text>
        <Text style={[fb.val, { color: '#5DAA72' }]}>₦{fmt(earnings)}</Text>
      </View>
      <View style={[fb.div, { backgroundColor: theme.border }]} />
      <View style={fb.col}>
        <Text style={[fb.label, { color: theme.hint }]}>PLATFORM</Text>
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
          style={[ws.btn, { backgroundColor: '#FFB800' }]}
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
  const color     = fareColor(req.estimatedFare);
  const canAfford = walletBalance === null || walletBalance >= req.estimatedFare;
  const scaleA    = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.spring(scaleA, {
      toValue: 1, tension: 100, friction: 9, useNativeDriver: true,
    }).start();
  }, []);

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
          {/* Top row: fare + timer */}
          <View style={rc.topRow}>
            <View>
              <Text style={[rc.fareLabel, { color: theme.hint }]}>FARE (YOU + PLATFORM)</Text>
              <Text style={[rc.fare, { color: color }]}>₦{fmt(req.estimatedFare)}</Text>
              <Text style={[rc.earningHint, { color: theme.hint }]}>
                Your cut: ₦{fmt(Math.round(req.estimatedFare * (1 - COMMISSION)))}
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
            <View style={[rc.pill, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="cash-outline" size={11} color={theme.hint} />
              <Text style={[rc.pillTxt, { color: theme.hint }]}>{req.paymentMethod ?? 'CASH'}</Text>
            </View>
            {req.surgeLabel && (
              <View style={[rc.pill, { backgroundColor: '#FFB800' + '18', borderColor: '#FFB800' + '40' }]}>
                <Ionicons name="flash" size={11} color="#FFB800" />
                <Text style={[rc.pillTxt, { color: '#FFB800' }]}>{req.surgeLabel}</Text>
              </View>
            )}
            {req.targeted && (
              <View style={[rc.pill, { backgroundColor: '#5DAA72' + '18', borderColor: '#5DAA72' + '40' }]}>
                <Ionicons name="person-circle-outline" size={11} color="#5DAA72" />
                <Text style={[rc.pillTxt, { color: '#5DAA72' }]}>Chose you</Text>
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
  card:       { flexDirection: 'row', borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', marginBottom: 12 },
  stripe:     { width: 6 },
  body:       { flex: 1, padding: 16 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  fareLabel:  { fontSize: 8, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  fare:       { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 1 },
  earningHint:{ fontSize: 11, fontWeight: '600' },
  metaRow:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  pillTxt:    { fontSize: 10, fontWeight: '700' },
  chevron:    { width: 38, justifyContent: 'center', alignItems: 'center' },
});

// ── Detail modal ──────────────────────────────────────────────────────────────
const DetailModal = ({
  req, theme, walletBalance, loadingWallet,
  accepting, onAccept, onDecline, onClose, onNavigateTopUp,
}) => {
  if (!req) return null;
  const color     = fareColor(req.estimatedFare);
  const canAfford = !loadingWallet && walletBalance >= req.estimatedFare;
  const slideA    = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.spring(slideA, {
      toValue: 0, tension: 68, friction: 11, useNativeDriver: true,
    }).start();
  }, []);

  const close = () =>
    Animated.timing(slideA, {
      toValue: height, duration: 240, useNativeDriver: true,
    }).start(onClose);

  const insets = useSafeAreaInsets();

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
            {/* Fare header */}
            <View style={dm.fareRow}>
              <View style={[dm.colorBar, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[dm.fareTopLabel, { color: theme.hint }]}>
                  TOTAL FARE (SAME PRICE CUSTOMER SEES)
                </Text>
                <Text style={[dm.fareAmt, { color: color }]}>₦{fmt(req.estimatedFare)}</Text>
              </View>
              {req.surgeLabel && (
                <View style={[dm.surgeBadge, { backgroundColor: '#FFB800' + '20', borderColor: '#FFB800' + '40' }]}>
                  <Ionicons name="flash" size={11} color="#FFB800" />
                  <Text style={[dm.surgeTxt, { color: '#FFB800' }]}>{req.surgeLabel}</Text>
                </View>
              )}
            </View>

            {/* Fare breakdown — same total, transparent split */}
            <FareBreakdown fare={req.estimatedFare} theme={theme} color={color} />

            {/* Stats row */}
            <View style={dm.statsRow}>
              {[
                { icon: 'navigate-outline', val: `${req.distance?.toFixed(1)} km`, lbl: 'Distance' },
                { icon: 'time-outline',     val: `~${req.etaMinutes} min`,         lbl: 'ETA' },
                { icon: 'cash-outline',     val: req.paymentMethod ?? 'CASH',      lbl: 'Payment' },
              ].map(({ icon, val, lbl }) => (
                <View key={lbl} style={[dm.stat, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name={icon} size={16} color={color} />
                  <Text style={[dm.statVal, { color: theme.foreground }]}>{val}</Text>
                  <Text style={[dm.statLbl, { color: theme.hint }]}>{lbl}</Text>
                </View>
              ))}
            </View>

            {/* Route card */}
            <View style={[dm.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={dm.routeRow}>
                <View style={[dm.routeDot, { backgroundColor: '#FFB800' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[dm.routeLabel, { color: theme.hint }]}>PICKUP</Text>
                  <Text style={[dm.routeAddr,  { color: theme.foreground }]}>{req.pickupAddress}</Text>
                </View>
              </View>
              <View style={[dm.routeLine, { backgroundColor: theme.border }]} />
              <View style={dm.routeRow}>
                <View style={[dm.routeDot, { backgroundColor: '#E05555' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[dm.routeLabel, { color: theme.hint }]}>DROP-OFF</Text>
                  <Text style={[dm.routeAddr,  { color: theme.foreground }]}>{req.dropoffAddress}</Text>
                </View>
              </View>
            </View>

            {/* Customer card */}
            {req.customer && (
              <View style={[dm.customerCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={[dm.cAvatar, { backgroundColor: color + '18' }]}>
                  <Text style={[dm.cInitials, { color }]}>
                    {req.customer.firstName?.[0]}{req.customer.lastName?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[dm.cName, { color: theme.foreground }]}>
                    {req.customer.firstName} {req.customer.lastName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Ionicons name="shield-checkmark" size={11} color="#5DAA72" />
                    <Text style={[dm.cVerified, { color: '#5DAA72' }]}>Verified rider</Text>
                  </View>
                </View>
                {req.targeted && (
                  <View style={[dm.choseBadge, { backgroundColor: '#5DAA72' + '18', borderColor: '#5DAA72' + '40' }]}>
                    <Text style={[dm.choseTxt, { color: '#5DAA72' }]}>Chose you</Text>
                  </View>
                )}
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
                required={req.estimatedFare}
                theme={theme}
                onTopUp={() => { close(); setTimeout(onNavigateTopUp, 280); }}
              />
            )}

            {/* Expired note */}
            {req.expired && (
              <View style={[dm.expiredBar, { backgroundColor: '#E05555' + '12', borderColor: '#E05555' + '35' }]}>
                <Ionicons name="time-outline" size={14} color="#E05555" />
                <Text style={[dm.expiredTxt, { color: '#E05555' }]}>
                  Timer expired — ride may still be available. Try accepting!
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
                      {req.expired ? 'Try Accept' : 'Accept'} · ₦{fmt(req.estimatedFare)}
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
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  sheet:       {
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    maxHeight: height * 0.92, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 24,
  },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 20 },
  scroll:      { paddingHorizontal: H_PAD, paddingBottom: 8 },
  fareRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  colorBar:    { width: 5, height: 56, borderRadius: 3, flexShrink: 0 },
  fareTopLabel:{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  fareAmt:     { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  surgeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 'auto' },
  surgeTxt:    { fontSize: 10, fontWeight: '800' },
  statsRow:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat:        { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingVertical: 14, gap: 5 },
  statVal:     { fontSize: 12, fontWeight: '800' },
  statLbl:     { fontSize: 9, fontWeight: '600' },
  routeCard:   { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  routeRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot:    { width: 9, height: 9, borderRadius: 5, marginTop: 5, flexShrink: 0 },
  routeLine:   { width: 1.5, height: 14, marginLeft: 4, marginVertical: 4 },
  routeLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  routeAddr:   { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  customerCard:{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  cAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cInitials:   { fontSize: 16, fontWeight: '800' },
  cName:       { fontSize: 14, fontWeight: '700' },
  cVerified:   { fontSize: 11, fontWeight: '600' },
  choseBadge:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  choseTxt:    { fontSize: 10, fontWeight: '800' },
  expiredBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  expiredTxt:  { fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  footer:      { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: H_PAD },
  footerRow:   { flexDirection: 'row', gap: 10 },
  declineBtn:  { flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  declineTxt:  { fontSize: 15, fontWeight: '700' },
  acceptBtn:   { flex: 2, height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  acceptTxt:   { fontSize: 15, fontWeight: '900', color: '#080C18' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomingRideQueueScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';
  const initReq         = route?.params?.initialRequest;

  // ── Build a queue entry from a raw socket payload ─────────────────────────
  const makeEntry = useCallback((req) => ({
    id:            req.rideId ?? req.id ?? String(Date.now()),
    rideId:        req.rideId ?? req.id,
    pickupAddress: req.pickupAddress  ?? '—',
    dropoffAddress:req.dropoffAddress ?? '—',
    estimatedFare: Number(req.estimatedFare ?? 0),
    bookingFee:    Number(req.bookingFee    ?? 0),
    distance:      Number(req.distance      ?? 0),
    etaMinutes:    req.etaMinutes ?? Math.ceil((req.distance ?? 0) / 0.5),
    paymentMethod: req.paymentMethod,
    surgeMultiplier: req.surgeMultiplier,
    surgeLabel:    req.surgeLabel,
    customer:      req.customer,
    targeted:      req.targeted ?? false,
    timeLeft:      REQUEST_SECS,
    expired:       false,
    receivedAt:    Date.now(),
  }), []);

  const [requests,      setRequests]      = useState(() => initReq ? [makeEntry(initReq)] : []);
  const [expandedReq,   setExpandedReq]   = useState(null);
  const [accepting,     setAccepting]     = useState(false);
  const [walletBal,     setWalletBal]     = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  const actingRef = useRef(new Set());
  const headerA   = useRef(new Animated.Value(0)).current;
  const listA     = useRef(new Animated.Value(0)).current;

// ── Ensure socket is connected + REST fallback for missed requests ────────
  useEffect(() => {
    socketService.connect().catch(() => {});

    // Fallback: fetch any requests missed during a disconnect
    driverAPI.getNearbyRequests()
      .then(res => {
        const list = res?.data?.requests ?? [];
        list.forEach(r => {
          const entry = makeEntry(r);
          setRequests(prev =>
            prev.some(x => x.rideId === entry.rideId) ? prev : [entry, ...prev]
          );
        });
      })
      .catch(() => {}); // silently ignore if offline — socket will cover it
  }, [makeEntry]);

  // ── Wallet load ───────────────────────────────────────────────────────────
  useEffect(() => {
    walletAPI.getWallet()
      .then(res => setWalletBal(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
      .catch(() => setWalletBal(0))
      .finally(() => setLoadingWallet(false));
  }, []);

  // ── Entry animation ───────────────────────────────────────────────────────
  useEffect(() => {
    Vibration.vibrate([0, 250, 100, 250]);
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
        if (prev.some(r => r.rideId === entry.rideId)) return prev;
        Vibration.vibrate([0, 150, 80, 150]);
        return [entry, ...prev];
      });
    };
    socketService.on('ride:new_request', handleNew);
    return () => socketService.off('ride:new_request', handleNew);
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
      await rideAPI.acceptRide(req.rideId);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      navigation.replace('ActiveRide', { rideId: req.rideId });
    } catch (err) {
      actingRef.current.delete(req.id);
      setAccepting(false);
      const status  = err?.status ?? err?.statusCode;
      const message = err?.message ?? 'This ride may no longer be available.';

      if (status === 402) {
        Alert.alert('Top-Up Required 💰', message, [
          { text: 'Dismiss', style: 'cancel' },
          { text: 'Top Up', onPress: () => navigation.navigate('Earnings') },
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
  const totalCount   = requests.length;

  // Sort: non-expired first → highest fare first within each group
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? 1 : -1;
    return b.estimatedFare - a.estimatedFare;
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
        {/* Back / close */}
        <TouchableOpacity
          style={[s.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Incoming Requests</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>
            {activeCount} active{expiredCount > 0 ? `  ·  ${expiredCount} expired` : ''}
            {totalCount > 1 ? '  ·  Scroll to compare' : ''}
          </Text>
        </View>

        {/* Live count badge */}
        {activeCount > 0 && (
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveTxt}>{activeCount}</Text>
          </View>
        )}

        {/* Clear expired button */}
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
          onPress={() => navigation.navigate('Earnings')}
          activeOpacity={0.85}
        >
          <Ionicons name="wallet-outline" size={14} color="#E05555" />
          <Text style={[s.walletBannerTxt, { color: '#E05555' }]}>
            Low wallet balance (₦{fmt(walletBal)}) — some rides locked
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#E05555" />
        </TouchableOpacity>
      )}

      {/* ── Hint strip when multiple requests ─────────────────────────────── */}
      {activeCount > 1 && (
        <View style={[s.hintStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <Ionicons name="swap-vertical-outline" size={13} color={theme.hint} />
          <Text style={[s.hintTxt, { color: theme.hint }]}>
            Highest-paying rides are shown first. Tap any card to see full details.
          </Text>
        </View>
      )}

      {/* ── Request list ───────────────────────────────────────────────────── */}
      <Animated.View style={[{ flex: 1 }, { opacity: listA }]}>
        <ScrollView
          contentContainerStyle={[
            s.list,
            { paddingBottom: insets.bottom + TAB_CONTENT_H + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Empty state */}
          {requests.length === 0 && (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="car-outline" size={36} color={theme.hint} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.foreground }]}>No pending requests</Text>
              <Text style={[s.emptySub,   { color: theme.hint }]}>
                New ride requests will appear here
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
            <ActivityIndicator color="#FFB800" size="large" />
            <Text style={[s.acceptingTxt, { color: '#FFB800' }]}>Accepting ride…</Text>
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
          onNavigateTopUp={() => navigation.navigate('Earnings')}
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

  // Header
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

  // Low wallet banner
  walletBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: H_PAD, marginTop: 10,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  walletBannerTxt: { flex: 1, fontSize: 11, fontWeight: '700' },

  // Hint strip
  hintStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: H_PAD, marginTop: 10,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  hintTxt: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },

  // List
  list: { paddingHorizontal: H_PAD, paddingTop: 16 },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: height * 0.18 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub:   { fontSize: 13, textAlign: 'center' },

  // Accepting overlay
  acceptingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100,
  },
  acceptingCard: {
    borderRadius: 24, borderWidth: 1,
    padding: 32, alignItems: 'center', gap: 12,
    minWidth: 220,
  },
  acceptingTxt: { fontSize: 17, fontWeight: '800' },
  acceptingSub: { fontSize: 12 },
});