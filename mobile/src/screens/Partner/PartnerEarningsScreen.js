// mobile/src/screens/Partner/PartnerEarningsScreen.js
// Aligned with EarningsScreen (Driver):
//   • SafeAreaView root with edges={['top','left','right']}
//   • Same header: eyebrow "PARTNER EARNINGS" + title "My Wallet" + Top Up & Withdraw buttons
//   • Same StatStrip: Wallet | Net Earned | Deliveries
//   • Same wallet actions row: Top Up, Withdraw, History (→ TransactionHistory)
//   • All Partner-specific logic preserved (deliveries, 15% fee, refresh, load more, etc.)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  RefreshControl, Platform,
} from 'react-native';
import AnimatedRN, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { Ionicons }                          from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets }   from 'react-native-safe-area-context';
import { useTheme }                          from '../../context/ThemeContext';
import { useScrollY }                        from '../../context/ScrollContext';
import { partnerAPI, walletAPI, deliveryAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');
const COURIER_ACCENT = '#34D399';
const GOLD           = '#FFB800';
const PURPLE         = '#A78BFA';
const RED            = '#E05555';
const GREEN          = '#5DAA72';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'all',   label: 'All'   },
];

const TX_CONFIG = {
  CREDIT:     { icon: 'arrow-down-circle-outline', color: GREEN,  label: 'Credit'     },
  DEBIT:      { icon: 'arrow-up-circle-outline',   color: RED,    label: 'Debit'      },
  WITHDRAWAL: { icon: 'cash-outline',              color: GOLD,   label: 'Withdrawal' },
  REFUND:     { icon: 'refresh-circle-outline',    color: PURPLE, label: 'Refund'     },
};

const filterByPeriod = (list, period) => {
  if (period === 'all') return list;
  const now  = new Date();
  const from = new Date();
  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    from.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    from.setMonth(now.getMonth() - 1);
  }
  return list.filter(d => new Date(d.requestedAt ?? d.createdAt) >= from);
};

// ─────────────────────────────────────────────────────────────────────────────
// StatStrip — mirrors Driver's layout: Wallet | Net Earned | Deliveries
// ─────────────────────────────────────────────────────────────────────────────
const StatStrip = ({ earnings, walletBalance, totalDeliveries, theme }) => (
  <View style={[ss.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '30' }]}>
    <View style={ss.item}>
      <Text style={[ss.lbl, { color: theme.hint }]}>WALLET</Text>
      <Text style={[ss.val, { color: GREEN }]}>
        ₦{Number(walletBalance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
      </Text>
    </View>
    <View style={[ss.div, { backgroundColor: theme.border }]} />
    <View style={ss.item}>
      <Text style={[ss.lbl, { color: theme.hint }]}>NET EARNED</Text>
      <Text style={[ss.val, { color: COURIER_ACCENT }]}>
        ₦{Number(earnings?.netEarnings ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
      </Text>
    </View>
    <View style={[ss.div, { backgroundColor: theme.border }]} />
    <View style={ss.item}>
      <Text style={[ss.lbl, { color: theme.hint }]}>DELIVERIES</Text>
      <Text style={[ss.val, { color: theme.foreground }]}>{totalDeliveries}</Text>
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
// SummaryTile
// ─────────────────────────────────────────────────────────────────────────────
const SummaryTile = ({ label, value, icon, color, theme }) => (
  <View style={[st.tile, { backgroundColor: theme.backgroundAlt, borderColor: color + '25' }]}>
    <View style={[st.iconWrap, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[st.value, { color }]}>{value}</Text>
    <Text style={[st.label, { color: theme.hint }]}>{label}</Text>
  </View>
);
const st = StyleSheet.create({
  tile:     { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  value:    { fontSize: 17, fontWeight: '900' },
  label:    { fontSize: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TxRow
// ─────────────────────────────────────────────────────────────────────────────
const TxRow = ({ tx, theme }) => {
  const cfg     = TX_CONFIG[tx.type] ?? TX_CONFIG.CREDIT;
  const sign    = tx.type === 'CREDIT' || tx.type === 'REFUND' ? '+' : '-';
  const date    = new Date(tx.createdAt);
  const dateStr = date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[tr.row, { borderBottomColor: theme.border }]}>
      <View style={[tr.iconWrap, { backgroundColor: cfg.color + '15' }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[tr.desc, { color: theme.foreground }]} numberOfLines={1}>
          {tx.description || cfg.label}
        </Text>
        <Text style={[tr.date, { color: theme.hint }]}>{dateStr} • {timeStr}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[tr.amount, { color: cfg.color }]}>
          {sign}₦{Number(tx.amount).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={[tr.status, {
          color: tx.status === 'COMPLETED' ? GREEN : tx.status === 'PENDING' ? GOLD : RED,
        }]}>
          {tx.status}
        </Text>
      </View>
    </View>
  );
};
const tr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  desc:     { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  date:     { fontSize: 11 },
  amount:   { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  status:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// DeliveryRow
// ─────────────────────────────────────────────────────────────────────────────
const DeliveryRow = ({ delivery, theme }) => {
  const gross = Number(
    delivery.grossFee ??
    delivery.actualFee ??
    delivery.estimatedFee ??
    0
  );
  const net = Number(
    delivery.partnerEarnings ??
    delivery.payment?.driverEarnings ??
    0
  );
  const rawDate = delivery.deliveredAt ?? delivery.requestedAt ?? delivery.createdAt;
  const dateStr = rawDate
    ? new Date(rawDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
    : '—';

  return (
    <View style={[dr.row, { borderBottomColor: theme.border }]}>
      <View style={[dr.iconWrap, { backgroundColor: COURIER_ACCENT + '15' }]}>
        <Ionicons name="cube-outline" size={16} color={COURIER_ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[dr.addr, { color: theme.foreground }]} numberOfLines={1}>
          {delivery.pickupAddress?.split(',')[0]} → {delivery.dropoffAddress?.split(',')[0]}
        </Text>
        <Text style={[dr.meta, { color: theme.hint }]} numberOfLines={1}>
          {[delivery.packageDescription, dateStr].filter(Boolean).join(' • ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[dr.net, { color: COURIER_ACCENT }]}>
          +₦{net.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={[dr.gross, { color: theme.hint }]}>
          ₦{gross.toLocaleString('en-NG', { maximumFractionDigits: 0 })} gross
        </Text>
      </View>
    </View>
  );
};
const dr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  addr:     { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  meta:     { fontSize: 11 },
  net:      { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  gross:    { fontSize: 10 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function PartnerEarningsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const scrollY         = useScrollY();
  const insets          = useSafeAreaInsets();

  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;

  const [period,       setPeriod]       = useState('week');
  const [earnings,     setEarnings]     = useState(null);
  const [wallet,       setWallet]       = useState(null);
  const [deliveries,   setDeliveries]   = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab,    setActiveTab]    = useState('deliveries');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [txPage,       setTxPage]       = useState(1);
  const [txLoading,    setTxLoading]    = useState(false);
  const [txTotal,      setTxTotal]      = useState(0);
  const [headerH,      setHeaderH]      = useState(80);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(18)).current;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const SCROLL_H = height - insets.top - headerH - insets.bottom - EXTRA_BOTTOM;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [earningsRes, walletRes, txRes, deliveriesRes] = await Promise.allSettled([
        partnerAPI.getEarnings({ period }),
        walletAPI.getWallet(),
        walletAPI.getTransactions({ page: 1, limit: 20 }),
        deliveryAPI.getDeliveryHistory({ period, limit: 50 }),
      ]);

      if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value?.data);
      if (walletRes.status   === 'fulfilled') setWallet(walletRes.value?.data?.wallet ?? walletRes.value?.data);
      if (txRes.status       === 'fulfilled') {
        setTransactions(txRes.value?.data?.transactions ?? []);
        setTxTotal(txRes.value?.data?.pagination?.total ?? 0);
        setTxPage(1);
      }
      if (deliveriesRes.status === 'fulfilled') {
        setDeliveries(filterByPeriod(deliveriesRes.value?.data?.deliveries ?? [], period));
      } else {
        setDeliveries(filterByPeriod(earningsRes.value?.data?.deliveries ?? [], period));
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [period]);

  useEffect(() => { load(); }, [period]);

  const loadMoreTx = async () => {
    if (txLoading || transactions.length >= txTotal) return;
    setTxLoading(true);
    try {
      const nextPage = txPage + 1;
      const res      = await walletAPI.getTransactions({ page: nextPage, limit: 20 });
      setTransactions(prev => [...prev, ...(res?.data?.transactions ?? [])]);
      setTxPage(nextPage);
    } catch {}
    finally { setTxLoading(false); }
  };

  const onRefresh = () => { setRefreshing(true); load(true); };

  const walletBalance   = Number(wallet?.balance ?? 0);
  const totalDeliveries = deliveries.length || Number(earnings?.totalDeliveries ?? 0);
  const totalEarnings   = Number(earnings?.totalEarnings   ?? 0);
  const netEarnings     = Number(earnings?.netEarnings     ?? 0);
  const platformFee     = Number(earnings?.platformFee     ?? 0);
  const avgPerDelivery  = Number(earnings?.averagePerDelivery ?? 0);

  const darkMode    = mode === 'dark';
  const inputBg     = darkMode ? 'rgba(255,255,255,0.07)' : '#F2F2F7';
  const inputBorder = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  return (
    <SafeAreaView
      style={[s.root, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* ── Header — mirrors Driver EarningsScreen exactly ── */}
      <View
        style={[s.header, { borderBottomColor: theme.border }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        {navigation?.canGoBack?.() && (
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: COURIER_ACCENT + '99' }]}>PARTNER EARNINGS</Text>
          <Text style={[s.title,   { color: theme.foreground }]}>My Wallet</Text>
        </View>
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
            style={[s.headerActionBtn, { backgroundColor: COURIER_ACCENT }]}
            onPress={() => navigation.navigate('Withdrawal')}
            activeOpacity={0.88}
          >
            <Ionicons name="arrow-up-circle-outline" size={15} color="#080C18" />
            <Text style={[s.headerActionTxt, { color: '#080C18' }]}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={[s.loadingWrap, { height: SCROLL_H }]}>
          <ActivityIndicator color={COURIER_ACCENT} size="large" />
        </View>
      ) : (
        <View style={{ height: SCROLL_H }}>
          <AnimatedRN.ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            overScrollMode="never"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COURIER_ACCENT} />
            }
          >
            <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

              {/* ── StatStrip ── */}
              <StatStrip
                earnings={earnings}
                walletBalance={walletBalance}
                totalDeliveries={totalDeliveries}
                theme={theme}
              />

              {/* ── Wallet actions row — mirrors Driver ── */}
              <View style={s.walletActions}>
                <TouchableOpacity
                  style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '30' }]}
                  onPress={() => navigation.navigate('WalletTopUp')}
                  activeOpacity={0.85}
                >
                  <View style={[s.walletActionIcon, { backgroundColor: GREEN + '20' }]}>
                    <Ionicons name="add-circle-outline" size={20} color={GREEN} />
                  </View>
                  <Text style={[s.walletActionLbl, { color: theme.foreground }]}>Top Up</Text>
                  <Text style={[s.walletActionSub, { color: theme.hint }]}>Add money</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '30' }]}
                  onPress={() => navigation.navigate('Withdrawal')}
                  activeOpacity={0.85}
                >
                  <View style={[s.walletActionIcon, { backgroundColor: COURIER_ACCENT + '20' }]}>
                    <Ionicons name="arrow-up-circle-outline" size={20} color={COURIER_ACCENT} />
                  </View>
                  <Text style={[s.walletActionLbl, { color: theme.foreground }]}>Withdraw</Text>
                  <Text style={[s.walletActionSub, { color: theme.hint }]}>To bank</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '30' }]}
                  onPress={() => navigation.navigate('TransactionHistory')}
                  activeOpacity={0.85}
                >
                  <View style={[s.walletActionIcon, { backgroundColor: PURPLE + '20' }]}>
                    <Ionicons name="time-outline" size={20} color={PURPLE} />
                  </View>
                  <Text style={[s.walletActionLbl, { color: theme.foreground }]}>History</Text>
                  <Text style={[s.walletActionSub, { color: theme.hint }]}>& Export</Text>
                </TouchableOpacity>
              </View>

              {/* ── Breakdown card — mirrors Driver ── */}
              <View style={[s.breakdownCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Text style={[s.sectionEyebrow, { color: theme.hint }]}>EARNINGS BREAKDOWN</Text>
                {[
                  ['Gross Earnings',     earnings?.totalEarnings,   COURIER_ACCENT],
                  ['Platform Fee (15%)', earnings?.platformFee,     RED],
                  ['Net Earnings',       earnings?.netEarnings,     GREEN],
                  ['Avg per Delivery',   earnings?.averagePerDelivery, theme.foreground],
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
                          ? { backgroundColor: COURIER_ACCENT }
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
                {[
                  ['deliveries',   `Deliveries (${deliveries.length})`    ],
                  ['transactions', `Wallet Txns (${transactions.length})` ],
                ].map(([key, lbl]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      s.tabBtn,
                      activeTab === key && { backgroundColor: COURIER_ACCENT + '20', borderBottomColor: COURIER_ACCENT, borderBottomWidth: 2 },
                    ]}
                    onPress={() => setActiveTab(key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.tabTxt, { color: activeTab === key ? COURIER_ACCENT : theme.hint }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Content list ── */}
              <View style={[s.listCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                {activeTab === 'deliveries' ? (
                  deliveries.length === 0 ? (
                    <View style={s.empty}>
                      <Ionicons name="cube-outline" size={32} color={theme.hint} />
                      <Text style={[s.emptyTxt, { color: theme.hint }]}>No deliveries for this period</Text>
                    </View>
                  ) : (
                    deliveries.map((d, i) => (
                      <DeliveryRow key={d.id ?? i} delivery={d} theme={theme} />
                    ))
                  )
                ) : (
                  transactions.length === 0 ? (
                    <View style={s.empty}>
                      <Ionicons name="wallet-outline" size={32} color={theme.hint} />
                      <Text style={[s.emptyTxt, { color: theme.hint }]}>No transactions yet</Text>
                    </View>
                  ) : (
                    <>
                      {transactions.map((tx, i) => (
                        <TxRow key={tx.id ?? i} tx={tx} theme={theme} />
                      ))}

                      {/* Load more */}
                      {transactions.length < txTotal && (
                        <TouchableOpacity
                          style={[s.loadMore, { borderColor: COURIER_ACCENT + '40' }]}
                          onPress={loadMoreTx}
                          disabled={txLoading}
                        >
                          {txLoading
                            ? <ActivityIndicator color={COURIER_ACCENT} size="small" />
                            : <Text style={[s.loadMoreTxt, { color: COURIER_ACCENT }]}>Load more</Text>
                          }
                        </TouchableOpacity>
                      )}

                      {/* Full history CTA */}
                      <TouchableOpacity
                        style={[s.historyLink, { borderTopColor: theme.border }]}
                        onPress={() => navigation.navigate('TransactionHistory')}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="calendar-outline" size={13} color={COURIER_ACCENT} />
                        <Text style={[s.historyLinkTxt, { color: COURIER_ACCENT }]}>
                          Full history · date filter · PDF export
                        </Text>
                        <Ionicons name="chevron-forward" size={12} color={COURIER_ACCENT} />
                      </TouchableOpacity>
                    </>
                  )
                )}
              </View>

              {/* ── Platform note ── */}
              <View style={[s.noteCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={s.noteRow}>
                  <View style={[s.noteDot, { backgroundColor: COURIER_ACCENT }]} />
                  <Text style={[s.noteTxt, { color: theme.hint }]}>
                    Platform takes{' '}
                    <Text style={{ color: COURIER_ACCENT, fontWeight: '700' }}>15% commission</Text>{' '}
                    + booking fee per delivery
                  </Text>
                </View>
                <View style={s.noteRow}>
                  <View style={[s.noteDot, { backgroundColor: GREEN }]} />
                  <Text style={[s.noteTxt, { color: theme.hint }]}>
                    Net earnings = gross − 15% commission − booking fee
                  </Text>
                </View>
                <View style={s.noteRow}>
                  <View style={[s.noteDot, { backgroundColor: GOLD }]} />
                  <Text style={[s.noteTxt, { color: theme.hint }]}>
                    Minimum withdrawal:{' '}
                    <Text style={{ color: GOLD, fontWeight: '700' }}>₦500</Text>
                  </Text>
                </View>
              </View>

            </Animated.View>
          </AnimatedRN.ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles — mirrors Driver EarningsScreen ────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  eyebrow:         { fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 2 },
  title:           { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerBtns:      { flexDirection: 'row', gap: 8 },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  headerActionTxt: { fontSize: 12, fontWeight: '800' },

  loadingWrap: { justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 20, paddingTop: 16 },

  // Wallet actions
  walletActions:    { flexDirection: 'row', gap: 10, marginBottom: 14 },
  walletActionBtn:  { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  walletActionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  walletActionLbl:  { fontSize: 13, fontWeight: '700' },
  walletActionSub:  { fontSize: 10 },

  // Breakdown
  breakdownCard:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, marginBottom: 16 },
  sectionEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  breakRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1 },
  breakLbl:       { fontSize: 13, fontWeight: '500' },
  breakVal:       { fontSize: 14, fontWeight: '800' },

  // Period
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodBtn: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 9, alignItems: 'center' },
  periodTxt: { fontSize: 12, fontWeight: '700' },

  // Tabs
  tabRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabTxt: { fontSize: 12, fontWeight: '700' },

  // List
  listCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, marginBottom: 16 },
  empty:    { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyTxt: { fontSize: 13 },

  // Load more
  loadMore:    { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1 },
  loadMoreTxt: { fontSize: 13, fontWeight: '700' },

  // History CTA
  historyLink:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, borderTopWidth: 1, marginTop: 4 },
  historyLinkTxt: { flex: 1, fontSize: 11, fontWeight: '600' },

  // Platform note
  noteCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 8 },
  noteRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteDot:  { width: 7, height: 7, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  noteTxt:  { flex: 1, fontSize: 12, lineHeight: 18 },
});