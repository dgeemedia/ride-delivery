// mobile/src/screens/Customer/WalletScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  Modal, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { walletAPI } from '../../services/api';

const { width } = Dimensions.get('window');

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
        <Text style={[tx.date, { color: theme.hint }]}>{new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[tx.amount, { color }]}>{sign}₦{Number(item.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
        <Text style={[tx.status, { color: item.status === 'COMPLETED' ? theme.muted : '#C9A96E' }]}>{item.status}</Text>
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

// ── Top-up modal ─────────────────────────────────────────────────────────────
const TopUpModal = ({ visible, onClose, onSuccess, theme }) => {
  const [amount,  setAmount]  = useState('');
  const [loading, setLoading] = useState(false);
  const PRESETS = ['500', '1000', '2000', '5000'];

  const handleTopUp = async () => {
    const num = parseFloat(amount);
    if (!num || num < 100) return Alert.alert('Invalid Amount', 'Minimum top-up is ₦100.');
    setLoading(true);
    try {
      await walletAPI.paystackTopup({ amount: num });
      Alert.alert('Redirecting', 'You will be taken to the payment page.', [
        { text: 'OK', onPress: () => { onSuccess?.(); onClose(); } }
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not initiate top-up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={[m.sheet, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <View style={m.handle} />
          <Text style={[m.title, { color: theme.foreground }]}>Add Money</Text>
          <Text style={[m.subtitle, { color: theme.muted }]}>Choose an amount to top up your wallet</Text>

          {/* Presets */}
          <View style={m.presets}>
            {PRESETS.map(p => {
              const active = amount === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setAmount(p)}
                  style={[m.preset, { backgroundColor: active ? theme.accent + '18' : theme.background, borderColor: active ? theme.accent : theme.border }]}
                  activeOpacity={0.75}
                >
                  <Text style={[m.presetTxt, { color: active ? theme.accent : theme.muted }]}>₦{parseInt(p).toLocaleString()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom amount */}
          <View style={[m.inputBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[m.naira, { color: theme.muted }]}>₦</Text>
            <TextInput
              style={[m.input, { color: theme.foreground }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Custom amount"
              placeholderTextColor={theme.hint}
            />
          </View>

          <TouchableOpacity
            style={[m.btn, { backgroundColor: theme.accent, shadowColor: theme.accent }, loading && { opacity: 0.6 }]}
            onPress={handleTopUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={m.btnTxt}>Continue to Payment</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={m.cancel} onPress={onClose}>
            <Text style={[m.cancelTxt, { color: theme.hint }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
const m = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28 },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#555', alignSelf: 'center', marginBottom: 20 },
  title:     { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subtitle:  { fontSize: 13, marginBottom: 22 },
  presets:   { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  preset:    { flex: 1, minWidth: (width - 80) / 4 - 8, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  presetTxt: { fontSize: 13, fontWeight: '700' },
  inputBox:  { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, height: 56, paddingHorizontal: 16, marginBottom: 20 },
  naira:     { fontSize: 18, fontWeight: '700', marginRight: 6 },
  input:     { flex: 1, fontSize: 18, fontWeight: '600' },
  btn:       { borderRadius: 13, height: 54, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8, marginBottom: 12 },
  btnTxt:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancel:    { alignItems: 'center', paddingVertical: 6 },
  cancelTxt: { fontSize: 14, fontWeight: '500' },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function WalletScreen({ navigation }) {
  const { theme, mode }     = useTheme();
  const [wallet,    setWallet]    = useState(null);
  const [txns,      setTxns]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [filter,    setFilter]    = useState('ALL');

  const fadeA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchWallet();
    Animated.timing(fadeA, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const fetchWallet = async () => {
    try {
      const [wRes, tRes] = await Promise.all([walletAPI.getWallet(), walletAPI.getTransactions()]);
      setWallet(wRes.data?.wallet);
      setTxns(tRes.data?.transactions ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  const FILTERS = ['ALL', 'CREDIT', 'DEBIT', 'WITHDRAWAL'];
  const filtered = filter === 'ALL' ? txns : txns.filter(t => t.type === filter);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]} onPress={() => navigation.goBack()}>
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
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent, shadowColor: theme.accent }]} onPress={() => setShowTopUp(true)} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={s.actionBtnTxt}>Top Up</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtnOutline, { borderColor: theme.border, backgroundColor: theme.background }]} onPress={() => navigation.navigate('Transfer')} activeOpacity={0.8}>
                <Ionicons name="swap-horizontal-outline" size={17} color={theme.muted} />
                <Text style={[s.actionBtnOutlineTxt, { color: theme.muted }]}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtnOutline, { borderColor: theme.border, backgroundColor: theme.background }]} onPress={() => navigation.navigate('Withdraw')} activeOpacity={0.8}>
                <Ionicons name="arrow-up-outline" size={17} color={theme.muted} />
                <Text style={[s.actionBtnOutlineTxt, { color: theme.muted }]}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
            {FILTERS.map(f => {
              const active = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[s.filterTab, { backgroundColor: active ? theme.accent + '18' : 'transparent', borderColor: active ? theme.accent : theme.border }]}
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

      <TopUpModal
        visible={showTopUp}
        onClose={() => setShowTopUp(false)}
        onSuccess={fetchWallet}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:        { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:    { fontSize: 16, fontWeight: '700' },
  scroll:         { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 20 },

  balanceCard:    { borderRadius: 18, borderWidth: 1, padding: 24, marginBottom: 18, alignItems: 'center' },
  balanceLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  balanceAmount:  { fontSize: 38, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  currency:       { fontSize: 12, fontWeight: '600', marginBottom: 24 },
  actionRow:      { flexDirection: 'row', gap: 10, width: '100%' },
  actionBtn:      { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  actionBtnTxt:   { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  actionBtnOutline:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, borderWidth: 1 },
  actionBtnOutlineTxt: { fontSize: 13, fontWeight: '600' },

  filterScroll:   { marginBottom: 14 },
  filterRow:      { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filterTab:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  filterTxt:      { fontSize: 12, fontWeight: '700' },

  txCard:         { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  txTitle:        { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 6 },
  empty:          { alignItems: 'center', paddingVertical: 32 },
  emptyTxt:       { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptyHint:      { fontSize: 13 },
});