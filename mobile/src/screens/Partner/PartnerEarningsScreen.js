// mobile/src/screens/Partner/PartnerEarningsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons }                    from '@expo/vector-icons';
import { SafeAreaView }                from 'react-native-safe-area-context';
import { useTheme }                    from '../../context/ThemeContext';
import { partnerAPI, walletAPI, deliveryAPI } from '../../services/api';

const { width } = Dimensions.get('window');
const COURIER_ACCENT = '#34D399';
const GOLD           = '#FFB800';
const PURPLE         = '#A78BFA';
const RED            = '#E05555';
const GREEN          = '#5DAA72';

// ─────────────────────────────────────────────────────────────────────────────
// Period filter tabs
// ─────────────────────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'all',   label: 'All'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tx type config
// ─────────────────────────────────────────────────────────────────────────────
const TX_CONFIG = {
  CREDIT:     { icon: 'arrow-down-circle-outline', color: GREEN,  label: 'Credit'     },
  DEBIT:      { icon: 'arrow-up-circle-outline',   color: RED,    label: 'Debit'      },
  WITHDRAWAL: { icon: 'cash-outline',              color: GOLD,   label: 'Withdrawal' },
  REFUND:     { icon: 'refresh-circle-outline',    color: PURPLE, label: 'Refund'     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter deliveries by period client-side.
 * Safe fallback if the /deliveries/history endpoint doesn't accept a period
 * param — we fetch everything and slice here so the period selector always
 * works regardless of backend support.
 */
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
// Sub-components
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
        <Text style={[tr.date, { color: theme.hint }]}>{dateStr} · {timeStr}</Text>
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

// FIX: field names now match the actual /deliveries/history response shape —
//      the same fields PartnerHistoryScreen already reads successfully.
//      Old code used delivery.partnerEarnings and delivery.fee which don't
//      exist; actual fields are payment.driverEarnings and actualFee/estimatedFee.
const DeliveryRow = ({ delivery, theme }) => {
  const gross   = Number(delivery.actualFee ?? delivery.estimatedFee ?? 0);
  const net     = Number(delivery.payment?.driverEarnings ?? 0);

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
          {[delivery.packageDescription, dateStr].filter(Boolean).join(' · ')}
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

  const [period,       setPeriod]       = useState('week');
  const [earnings,     setEarnings]     = useState(null);
  const [wallet,       setWallet]       = useState(null);
  const [deliveries,   setDeliveries]   = useState([]);   // FIX: own state, own fetch
  const [transactions, setTransactions] = useState([]);
  const [activeTab,    setActiveTab]    = useState('deliveries');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [txPage,       setTxPage]       = useState(1);
  const [txLoading,    setTxLoading]    = useState(false);
  const [txTotal,      setTxTotal]      = useState(0);

  const fadeA    = useRef(new Animated.Value(0)).current;
  const balanceA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [earningsRes, walletRes, txRes, deliveriesRes] = await Promise.allSettled([
        partnerAPI.getEarnings({ period }),
        walletAPI.getWallet(),
        walletAPI.getTransactions({ page: 1, limit: 20 }),
        // FIX: fetch deliveries from the history endpoint directly — the same
        //      source PartnerHistoryScreen uses and which is guaranteed to
        //      return completed deliveries. The earnings endpoint either omits
        //      the deliveries array entirely or returns an empty one, which
        //      caused the tab to always show "No deliveries for this period".
        deliveryAPI.getDeliveryHistory({ period, limit: 50 }),
      ]);

      if (earningsRes.status === 'fulfilled') {
        setEarnings(earningsRes.value?.data);
      }

      if (walletRes.status === 'fulfilled') {
        setWallet(walletRes.value?.data?.wallet ?? walletRes.value?.data);
      }

      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value?.data?.transactions ?? []);
        setTxTotal(txRes.value?.data?.pagination?.total ?? 0);
        setTxPage(1);
      }

      if (deliveriesRes.status === 'fulfilled') {
        // Always filter client-side as a safe fallback — if the backend
        // ignores the period param we still show the right slice.
        const all = deliveriesRes.value?.data?.deliveries ?? [];
        setDeliveries(filterByPeriod(all, period));
      } else {
        // History call failed — fall back to whatever earnings embedded
        // (likely empty, but avoids a blank crash).
        const fallback = earningsRes.value?.data?.deliveries ?? [];
        setDeliveries(filterByPeriod(fallback, period));
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA,    { toValue: 1, duration: 500, useNativeDriver: true }).start();
      Animated.timing(balanceA, { toValue: 1, duration: 800, useNativeDriver: false }).start();
    }
  }, [period]);

  useEffect(() => { load(); }, [period]);

  const loadMoreTx = async () => {
    if (txLoading || transactions.length >= txTotal) return;
    setTxLoading(true);
    try {
      const nextPage = txPage + 1;
      const res      = await walletAPI.getTransactions({ page: nextPage, limit: 20 });
      const newTx    = res?.data?.transactions ?? [];
      setTransactions(prev => [...prev, ...newTx]);
      setTxPage(nextPage);
    } catch {}
    finally { setTxLoading(false); }
  };

  const onRefresh = () => { setRefreshing(true); load(true); };

  const walletBalance   = Number(wallet?.balance ?? 0);
  const totalEarnings   = Number(earnings?.totalEarnings   ?? 0);
  const netEarnings     = Number(earnings?.netEarnings     ?? 0);
  const platformFee     = Number(earnings?.platformFee     ?? 0);
  // Prefer the count of actually-fetched deliveries over what the earnings
  // endpoint reports, so the tile stays in sync with what's shown in the list.
  const totalDeliveries = deliveries.length || Number(earnings?.totalDeliveries ?? 0);
  const avgPerDelivery  = Number(earnings?.averagePerDelivery ?? 0);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <SafeAreaView edges={['top', 'left', 'right']}>
        {/* ── Header ── */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Earnings & Wallet</Text>
            <Text style={[s.headerSub,   { color: theme.hint }]}>Track your income and payouts</Text>
          </View>
          {/* FIX: was 'PayoutRequest' which doesn't exist in EarningsStack */}
          <TouchableOpacity
            style={[s.payoutBtn, { backgroundColor: COURIER_ACCENT }]}
            onPress={() => navigation.navigate('Withdrawal')}
            activeOpacity={0.85}
          >
            <Ionicons name="cash-outline" size={15} color="#080C18" />
            <Text style={s.payoutBtnTxt}>Payout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COURIER_ACCENT} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeA }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COURIER_ACCENT} />}
        >
          {/* ── Wallet balance card ── */}
          <View style={[s.balanceCard, { backgroundColor: COURIER_ACCENT }]}>
            <View style={s.balanceCardInner}>
              <Text style={s.balanceLabel}>WALLET BALANCE</Text>
              <Text style={s.balanceAmount}>
                ₦{walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={s.balanceSub}>Available for withdrawal</Text>
            </View>
            <View style={s.balanceActions}>
              {/* FIX: was 'PayoutRequest' which doesn't exist in EarningsStack */}
              <TouchableOpacity
                style={[s.balanceAction, { backgroundColor: 'rgba(0,0,0,0.15)' }]}
                onPress={() => navigation.navigate('Withdrawal')}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-outline" size={18} color="#fff" />
                <Text style={s.balanceActionTxt}>Withdraw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.balanceAction, { backgroundColor: 'rgba(0,0,0,0.15)' }]}
                onPress={() => setActiveTab('transactions')}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={18} color="#fff" />
                <Text style={s.balanceActionTxt}>History</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Period filter ── */}
          <View style={[s.periodRow, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[s.periodBtn, period === p.key && { backgroundColor: COURIER_ACCENT }]}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.periodTxt, { color: period === p.key ? '#080C18' : theme.hint }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Summary tiles ── */}
          <View style={s.tilesRow}>
            <SummaryTile
              label="Gross Earnings"
              value={`₦${totalEarnings.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
              icon="trending-up-outline"
              color={COURIER_ACCENT}
              theme={theme}
            />
            <SummaryTile
              label="Net Earnings"
              value={`₦${netEarnings.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
              icon="wallet-outline"
              color={GREEN}
              theme={theme}
            />
          </View>
          <View style={[s.tilesRow, { marginTop: 10 }]}>
            <SummaryTile
              label="Platform Fee"
              value={`₦${platformFee.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
              icon="pie-chart-outline"
              color={PURPLE}
              theme={theme}
            />
            <SummaryTile
              label="Deliveries"
              value={totalDeliveries}
              icon="cube-outline"
              color={GOLD}
              theme={theme}
            />
          </View>

          {/* ── Avg per delivery ── */}
          {totalDeliveries > 0 && (
            <View style={[s.avgCard, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '30' }]}>
              <Ionicons name="analytics-outline" size={16} color={COURIER_ACCENT} />
              <Text style={[s.avgTxt, { color: theme.hint }]}>
                Average per delivery:{' '}
                <Text style={{ color: COURIER_ACCENT, fontWeight: '800' }}>
                  ₦{avgPerDelivery.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </Text>
            </View>
          )}

          {/* ── Platform breakdown note ── */}
          <View style={[s.noteCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.noteRow}>
              <View style={[s.noteDot, { backgroundColor: COURIER_ACCENT }]} />
              <Text style={[s.noteTxt, { color: theme.hint }]}>
                Platform takes <Text style={{ color: COURIER_ACCENT, fontWeight: '700' }}>15% commission</Text> + booking fee per delivery
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
                Minimum withdrawal: <Text style={{ color: GOLD, fontWeight: '700' }}>₦1,000</Text>
              </Text>
            </View>
          </View>

          {/* ── Tab switcher ── */}
          <View style={[s.tabRow, { borderBottomColor: theme.border }]}>
            {[
              { key: 'deliveries',   label: `Deliveries (${deliveries.length})`     },
              { key: 'transactions', label: `Transactions (${transactions.length})`  },
            ].map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.tabBtn, activeTab === t.key && { borderBottomColor: COURIER_ACCENT, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[s.tabTxt, { color: activeTab === t.key ? COURIER_ACCENT : theme.hint }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Deliveries list ── */}
          {activeTab === 'deliveries' && (
            <View style={[s.listCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              {deliveries.length > 0 ? (
                deliveries.map((d, i) => (
                  <DeliveryRow key={d.id ?? i} delivery={d} theme={theme} />
                ))
              ) : (
                <View style={s.empty}>
                  <Ionicons name="cube-outline" size={36} color={theme.hint} />
                  <Text style={[s.emptyTxt, { color: theme.hint }]}>No deliveries for this period</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Transactions list ── */}
          {activeTab === 'transactions' && (
            <View style={[s.listCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              {transactions.length > 0 ? (
                <>
                  {transactions.map((tx, i) => (
                    <TxRow key={tx.id ?? i} tx={tx} theme={theme} />
                  ))}
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
                </>
              ) : (
                <View style={s.empty}>
                  <Ionicons name="receipt-outline" size={36} color={theme.hint} />
                  <Text style={[s.emptyTxt, { color: theme.hint }]}>No transactions yet</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub:   { fontSize: 11, marginTop: 1 },
  payoutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  payoutBtnTxt:{ fontSize: 13, fontWeight: '800', color: '#080C18' },

  // Balance card
  balanceCard:      { borderRadius: 24, padding: 24, marginBottom: 16, overflow: 'hidden' },
  balanceCardInner: { marginBottom: 20 },
  balanceLabel:     { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(0,0,0,0.5)', marginBottom: 8 },
  balanceAmount:    { fontSize: 38, fontWeight: '900', color: '#080C18', letterSpacing: -1, marginBottom: 4 },
  balanceSub:       { fontSize: 12, color: 'rgba(0,0,0,0.5)', fontWeight: '600' },
  balanceActions:   { flexDirection: 'row', gap: 10 },
  balanceAction:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 10 },
  balanceActionTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Period filter
  periodRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, marginBottom: 16 },
  periodBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  periodTxt: { fontSize: 12, fontWeight: '700' },

  // Tiles
  tilesRow: { flexDirection: 'row', gap: 10 },

  // Avg card
  avgCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12, marginBottom: 4 },
  avgTxt:  { flex: 1, fontSize: 13 },

  // Note card
  noteCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 12, marginBottom: 16, gap: 8 },
  noteRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteDot:  { width: 7, height: 7, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  noteTxt:  { flex: 1, fontSize: 12, lineHeight: 18 },

  // Tab switcher
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 0 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabTxt: { fontSize: 13, fontWeight: '700' },

  // List card
  listCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, marginBottom: 16, marginTop: 2 },

  // Load more
  loadMore:    { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1 },
  loadMoreTxt: { fontSize: 13, fontWeight: '700' },

  // Empty
  empty:    { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTxt: { fontSize: 13 },
});