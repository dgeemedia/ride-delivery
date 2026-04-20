// mobile/src/screens/Driver/EarningsScreen.js
// FIXES applied:
//   1. Removed WithdrawModal (which called driverAPI.requestPayout bypassing admin).
//   2. All "Withdraw" buttons now navigate to the shared WithdrawalScreen which
//      routes through walletAPI.withdraw() → admin approval queue.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons }    from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }    from '../../context/ThemeContext';
import { driverAPI, walletAPI } from '../../services/api';

const { width } = Dimensions.get('window');
const DA     = '#FFB800';
const GREEN  = '#5DAA72';
const RED    = '#E05555';
const PURPLE = '#A78BFA';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'all',   label: 'All'   },
];

const TX_CONFIG = {
  CREDIT:     { color: GREEN,  icon: 'arrow-down-circle-outline', prefix: '+' },
  DEBIT:      { color: RED,    icon: 'arrow-up-circle-outline',   prefix: '-' },
  WITHDRAWAL: { color: DA,     icon: 'cash-outline',              prefix: '-' },
  REFUND:     { color: PURPLE, icon: 'refresh-circle-outline',    prefix: '+' },
};

// ─────────────────────────────────────────────────────────────────────────────
// StatStrip
// ─────────────────────────────────────────────────────────────────────────────
const StatStrip = ({ earnings, walletBalance, theme }) => (
  <View style={[ss.card, { backgroundColor: theme.backgroundAlt, borderColor: DA + '30' }]}>
    <View style={ss.item}>
      <Text style={[ss.lbl, { color: theme.hint }]}>WALLET</Text>
      <Text style={[ss.val, { color: GREEN }]}>
        ₦{Number(walletBalance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
      </Text>
    </View>
    <View style={[ss.div, { backgroundColor: theme.border }]} />
    <View style={ss.item}>
      <Text style={[ss.lbl, { color: theme.hint }]}>NET EARNED</Text>
      <Text style={[ss.val, { color: DA }]}>
        ₦{Number(earnings?.netEarnings ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
      </Text>
    </View>
    <View style={[ss.div, { backgroundColor: theme.border }]} />
    <View style={ss.item}>
      <Text style={[ss.lbl, { color: theme.hint }]}>RIDES</Text>
      <Text style={[ss.val, { color: theme.foreground }]}>{earnings?.totalRides ?? 0}</Text>
    </View>
  </View>
);
const ss = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 14 },
  item: { flex: 1, alignItems: 'center', gap: 5 },
  lbl:  { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  val:  { fontSize: 18, fontWeight: '900' },
  div:  { width: 1, height: 36 },
});

// ─────────────────────────────────────────────────────────────────────────────
// EarningRow
// ─────────────────────────────────────────────────────────────────────────────
const EarningRow = ({ item, theme, last }) => (
  <View style={[er.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
    <View style={[er.icon, { backgroundColor: DA + '18' }]}>
      <Ionicons name="car-outline" size={16} color={DA} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={[er.from, { color: theme.foreground }]} numberOfLines={1}>{item.pickupAddress}</Text>
      <Text style={[er.to,   { color: theme.hint }]}      numberOfLines={1}>{item.dropoffAddress}</Text>
      <Text style={[er.date, { color: theme.hint }]}>
        {item.completedAt
          ? new Date(item.completedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </Text>
    </View>
    <Text style={[er.fare, { color: DA }]}>
      +₦{Number(item.driverEarnings ?? item.fare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
    </Text>
  </View>
);
const er = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  icon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  from: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  to:   { fontSize: 11, marginBottom: 2 },
  date: { fontSize: 10 },
  fare: { fontSize: 14, fontWeight: '800', flexShrink: 0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TxRow
// ─────────────────────────────────────────────────────────────────────────────
const TxRow = ({ item, theme, last }) => {
  const cfg = TX_CONFIG[item.type] ?? TX_CONFIG.DEBIT;
  return (
    <View style={[tr.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[tr.icon, { backgroundColor: cfg.color + '18' }]}>
        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[tr.desc, { color: theme.foreground }]} numberOfLines={1}>{item.description}</Text>
        <Text style={[tr.date, { color: theme.hint }]}>
          {item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Text style={[tr.amount, { color: cfg.color }]}>
          {cfg.prefix}₦{Number(item.amount ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
        </Text>
        <View style={[tr.statusPill, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[tr.statusTxt, { color: cfg.color }]}>{item.status}</Text>
        </View>
      </View>
    </View>
  );
};
const tr = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon:       { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  desc:       { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  date:       { fontSize: 10 },
  amount:     { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  statusPill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  statusTxt:  { fontSize: 9, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function EarningsScreen({ navigation }) {
  const { theme, mode } = useTheme();

  const [period,        setPeriod]        = useState('week');
  const [earnings,      setEarnings]      = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [transactions,  setTransactions]  = useState([]);
  const [activeTab,     setActiveTab]     = useState('rides');
  const [loading,       setLoading]       = useState(true);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(18)).current;

  const fetchAll = useCallback(async (p = period) => {
    setLoading(true);
    try {
      const [earningsRes, walletRes, txRes] = await Promise.allSettled([
        driverAPI.getEarnings({ period: p }),
        walletAPI.getWallet(),
        walletAPI.getTransactions({ limit: 30 }),
      ]);
      if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value?.data);
      if (walletRes.status   === 'fulfilled') setWalletBalance(walletRes.value?.data?.wallet?.balance ?? 0);
      if (txRes.status       === 'fulfilled') setTransactions(txRes.value?.data?.transactions ?? []);
    } catch {}
    finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [period]);

  useEffect(() => { fetchAll(period); }, [period]);

  const rides = earnings?.rides ?? [];

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.orb, { backgroundColor: DA }]} />

      {/* ── Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={18} color={theme.foreground} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: DA + '80' }]}>DRIVER EARNINGS</Text>
            <Text style={[s.title,   { color: theme.foreground }]}>My Wallet</Text>
          </View>
          {/* FIX: both actions navigate to shared WithdrawalScreen (admin-gated) */}
          <View style={s.headerBtns}>
            <TouchableOpacity
              style={[s.headerActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              onPress={() => navigation.navigate('WalletTopUp')}
              activeOpacity={0.88}
            >
              <Ionicons name="add-circle-outline" size={15} color={theme.foreground} />
              <Text style={[s.headerActionTxt, { color: theme.foreground }]}>Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.headerActionBtn, { backgroundColor: DA }]}
              onPress={() => navigation.navigate('Withdrawal')}
              activeOpacity={0.88}
            >
              <Ionicons name="arrow-up-circle-outline" size={15} color="#080C18" />
              <Text style={[s.headerActionTxt, { color: '#080C18' }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={DA} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}
        >
          {/* ── Stats ── */}
          <StatStrip earnings={earnings} walletBalance={walletBalance} theme={theme} />

          {/* ── Wallet actions row ── */}
          <View style={s.walletActions}>
            <TouchableOpacity
              style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: DA + '30' }]}
              onPress={() => navigation.navigate('WalletTopUp')}
              activeOpacity={0.85}
            >
              <View style={[s.walletActionIcon, { backgroundColor: GREEN + '20' }]}>
                <Ionicons name="add-circle-outline" size={20} color={GREEN} />
              </View>
              <Text style={[s.walletActionLbl, { color: theme.foreground }]}>Top Up</Text>
              <Text style={[s.walletActionSub, { color: theme.hint }]}>Add money</Text>
            </TouchableOpacity>

            {/* FIX: navigates to WithdrawalScreen instead of opening inline modal */}
            <TouchableOpacity
              style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: DA + '30' }]}
              onPress={() => navigation.navigate('Withdrawal')}
              activeOpacity={0.85}
            >
              <View style={[s.walletActionIcon, { backgroundColor: DA + '20' }]}>
                <Ionicons name="arrow-up-circle-outline" size={20} color={DA} />
              </View>
              <Text style={[s.walletActionLbl, { color: theme.foreground }]}>Withdraw</Text>
              <Text style={[s.walletActionSub, { color: theme.hint }]}>To bank</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: DA + '30' }]}
              onPress={() => navigation.navigate('DriverHistory')}
              activeOpacity={0.85}
            >
              <View style={[s.walletActionIcon, { backgroundColor: PURPLE + '20' }]}>
                <Ionicons name="time-outline" size={20} color={PURPLE} />
              </View>
              <Text style={[s.walletActionLbl, { color: theme.foreground }]}>History</Text>
              <Text style={[s.walletActionSub, { color: theme.hint }]}>All rides</Text>
            </TouchableOpacity>
          </View>

          {/* ── Breakdown card ── */}
          <View style={[s.breakdownCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.sectionEyebrow, { color: theme.hint }]}>EARNINGS BREAKDOWN</Text>
            {[
              ['Gross Earnings',     earnings?.totalEarnings,  DA],
              ['Platform Fee (20%)', earnings?.platformFee,    RED],
              ['Net Earnings',       earnings?.netEarnings,    GREEN],
              ['Avg per Ride',       earnings?.averagePerRide, theme.foreground],
            ].map(([lbl, val, col]) => (
              <View key={lbl} style={[s.breakRow, { borderBottomColor: theme.border }]}>
                <Text style={[s.breakLbl, { color: theme.hint }]}>{lbl}</Text>
                <Text style={[s.breakVal, { color: col }]}>
                  ₦{Number(val ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Period filter ── */}
          <View style={s.periodRow}>
            {PERIODS.map(p => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    s.periodBtn,
                    active
                      ? { backgroundColor: DA }
                      : { backgroundColor: theme.backgroundAlt, borderColor: theme.border },
                  ]}
                  onPress={() => setPeriod(p.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.periodTxt, { color: active ? '#080C18' : theme.hint }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Tab switcher ── */}
          <View style={[s.tabRow, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {[['rides', 'Ride History'], ['transactions', 'Wallet Txns']].map(([key, lbl]) => (
              <TouchableOpacity
                key={key}
                style={[
                  s.tabBtn,
                  activeTab === key && { backgroundColor: DA + '20', borderBottomColor: DA, borderBottomWidth: 2 },
                ]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabTxt, { color: activeTab === key ? DA : theme.hint }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Content list ── */}
          <View style={[s.listCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {activeTab === 'rides' ? (
              rides.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="car-outline" size={32} color={theme.hint} />
                  <Text style={[s.emptyTxt, { color: theme.hint }]}>No rides for this period</Text>
                </View>
              ) : (
                rides.map((item, i) => (
                  <EarningRow key={item.id ?? i} item={item} theme={theme} last={i === rides.length - 1} />
                ))
              )
            ) : (
              transactions.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="wallet-outline" size={32} color={theme.hint} />
                  <Text style={[s.emptyTxt, { color: theme.hint }]}>No transactions yet</Text>
                </View>
              ) : (
                transactions.map((item, i) => (
                  <TxRow key={item.id ?? i} item={item} theme={theme} last={i === transactions.length - 1} />
                ))
              )
            )}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  orb:     { position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, top: -width * 0.7, left: -width * 0.3, opacity: 0.04 },

  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  eyebrow:         { fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 2 },
  title:           { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerBtns:      { flexDirection: 'row', gap: 8 },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  headerActionTxt: { fontSize: 12, fontWeight: '800' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 20, paddingBottom: 100 },

  walletActions:    { flexDirection: 'row', gap: 10, marginBottom: 14 },
  walletActionBtn:  { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  walletActionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  walletActionLbl:  { fontSize: 13, fontWeight: '700' },
  walletActionSub:  { fontSize: 10 },

  breakdownCard:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, marginBottom: 16 },
  sectionEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  breakRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1 },
  breakLbl:       { fontSize: 13, fontWeight: '500' },
  breakVal:       { fontSize: 14, fontWeight: '800' },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodBtn: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 9, alignItems: 'center' },
  periodTxt: { fontSize: 12, fontWeight: '700' },

  tabRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabTxt: { fontSize: 12, fontWeight: '700' },

  listCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, marginBottom: 24 },
  empty:    { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyTxt: { fontSize: 13 },
});