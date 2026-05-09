// mobile/src/screens/Customer/WalletScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { walletAPI } from '../../services/api';

const TX_ICONS = {
  CREDIT:     { icon: 'arrow-down-circle-outline', color: '#5DAA72' },
  DEBIT:      { icon: 'arrow-up-circle-outline',   color: '#E05555' },
  WITHDRAWAL: { icon: 'arrow-redo-outline',         color: '#C9A96E' },
  REFUND:     { icon: 'refresh-circle-outline',     color: '#5DAA72' },
};

// ── Transaction row ──────────────────────────────────────────────────────────
const TxRow = ({ item, theme, last }) => {
  const meta  = TX_ICONS[item.type] ?? TX_ICONS.DEBIT;
  const sign  = item.type === 'CREDIT' || item.type === 'REFUND' ? '+' : '-';
  const color = meta.color;
  return (
    <View style={[tx.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[tx.iconWrap, { backgroundColor: color + '14' }]}>
        <Ionicons name={meta.icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[tx.desc, { color: theme.foreground }]} numberOfLines={1}>{item.description}</Text>
        <Text style={[tx.date, { color: theme.hint }]}>
          {new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[tx.amount, { color }]}>
          {sign}₦{Number(item.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={[tx.status, { color: item.status === 'COMPLETED' ? theme.muted : '#C9A96E' }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );
};
const tx = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  desc:     { fontSize: 13, fontWeight: '500', marginBottom: 3 },
  date:     { fontSize: 11 },
  amount:   { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  status:   { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function WalletScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const [wallet,  setWallet]  = useState(null);
  const [txns,    setTxns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('ALL');
  const fadeA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchWallet();
    Animated.timing(fadeA, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const fetchWallet = async () => {
    try {
      const [wRes, tRes] = await Promise.all([
        walletAPI.getWallet(),
        walletAPI.getTransactions(),
      ]);
      setWallet(wRes.data?.wallet);
      setTxns(tRes.data?.transactions ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  const FILTERS = ['ALL', 'CREDIT', 'DEBIT', 'WITHDRAWAL'];
  const filtered = filter === 'ALL' ? txns : txns.filter(t => t.type === filter);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.muted} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>My Wallet</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* Balance card */}
          <View style={[s.balanceCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.balanceLabel, { color: theme.hint }]}>AVAILABLE BALANCE</Text>
            {loading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 12 }} />
            ) : (
              <Text style={[s.balanceAmount, { color: theme.foreground }]}>
                ₦{Number(wallet?.balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </Text>
            )}
            <Text style={[s.currency, { color: theme.hint }]}>{wallet?.currency ?? 'NGN'}</Text>

            {/* Action buttons */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
                onPress={() => navigation.navigate('WalletTopUp')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color={theme.accentFg} />
                <Text style={[s.actionBtnTxt, { color: theme.accentFg }]}>Top Up</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtnOutline, { borderColor: theme.border, backgroundColor: theme.background }]}
                onPress={() => navigation.navigate('Transfer')}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal-outline" size={17} color={theme.muted} />
                <Text style={[s.actionBtnOutlineTxt, { color: theme.muted }]}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtnOutline, { borderColor: theme.border, backgroundColor: theme.background }]}
                onPress={() => navigation.navigate('Withdraw')}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-outline" size={17} color={theme.muted} />
                <Text style={[s.actionBtnOutlineTxt, { color: theme.muted }]}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.filterScroll}
            contentContainerStyle={s.filterRow}
          >
            {FILTERS.map(f => {
              const active = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    s.filterTab,
                    {
                      backgroundColor: active ? theme.accent + '18' : 'transparent',
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.filterTxt, { color: active ? theme.accent : theme.hint }]}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Transactions */}
          <View style={[s.txCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.txTitle, { color: theme.hint }]}>TRANSACTIONS</Text>
            {loading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 24 }} />
            ) : filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="wallet-outline" size={36} color={theme.hint} style={{ marginBottom: 10 }} />
                <Text style={[s.emptyTxt, { color: theme.muted }]}>No transactions yet</Text>
                <Text style={[s.emptyHint, { color: theme.hint }]}>Top up your wallet to get started</Text>
              </View>
            ) : (
              filtered.map((item, i) => (
                <TxRow key={item.id ?? i} item={item} theme={theme} last={i === filtered.length - 1} />
              ))
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1 },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:            { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:        { fontSize: 16, fontWeight: '700' },
  scroll:             { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 20 },
  balanceCard:        { borderRadius: 18, borderWidth: 1, padding: 24, marginBottom: 18, alignItems: 'center' },
  balanceLabel:       { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  balanceAmount:      { fontSize: 38, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  currency:           { fontSize: 12, fontWeight: '600', marginBottom: 24 },
  actionRow:          { flexDirection: 'row', gap: 10, width: '100%' },
  actionBtn:          { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  actionBtnTxt:       { fontSize: 14, fontWeight: '700' },
  actionBtnOutline:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, borderWidth: 1 },
  actionBtnOutlineTxt:{ fontSize: 13, fontWeight: '600' },
  filterScroll:       { marginBottom: 14 },
  filterRow:          { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filterTab:          { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  filterTxt:          { fontSize: 12, fontWeight: '700' },
  txCard:             { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  txTitle:            { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 6 },
  empty:              { alignItems: 'center', paddingVertical: 32 },
  emptyTxt:           { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptyHint:          { fontSize: 13 },
});