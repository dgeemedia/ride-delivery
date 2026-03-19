// mobile/src/screens/Driver/EarningsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Alert, Animated,
  Dimensions, StatusBar, Platform,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }  from '../../context/ThemeContext';
import { driverAPI, walletAPI } from '../../services/api';

const { width } = Dimensions.get('window');
const DA     = '#FFB800';
const GREEN  = '#5DAA72';
const RED    = '#E05555';
const PURPLE = '#A78BFA';

// ─────────────────────────────────────────────────────────────────────────────
// Nigerian banks
// ─────────────────────────────────────────────────────────────────────────────
const NG_BANKS = [
  { name: 'Access Bank',            code: '044'    },
  { name: 'Citibank Nigeria',       code: '023'    },
  { name: 'Ecobank Nigeria',        code: '050'    },
  { name: 'Fidelity Bank',          code: '070'    },
  { name: 'First Bank of Nigeria',  code: '011'    },
  { name: 'First City Monument',    code: '214'    },
  { name: 'Globus Bank',            code: '00103'  },
  { name: 'Guaranty Trust Bank',    code: '058'    },
  { name: 'Heritage Bank',          code: '030'    },
  { name: 'Keystone Bank',          code: '082'    },
  { name: 'Kuda Bank',              code: '50211'  },
  { name: 'Opay',                   code: '999992' },
  { name: 'PalmPay',                code: '999991' },
  { name: 'Polaris Bank',           code: '076'    },
  { name: 'Providus Bank',          code: '101'    },
  { name: 'Stanbic IBTC',           code: '221'    },
  { name: 'Sterling Bank',          code: '232'    },
  { name: 'Union Bank',             code: '032'    },
  { name: 'United Bank for Africa', code: '033'    },
  { name: 'Wema Bank',              code: '035'    },
  { name: 'Zenith Bank',            code: '057'    },
];

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
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon:      { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  desc:      { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  date:      { fontSize: 10 },
  amount:    { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  statusPill:{ borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  statusTxt: { fontSize: 9, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// WithdrawModal — stays for quick in-screen withdrawal
// Full WithdrawalScreen is also available from navigation
// ─────────────────────────────────────────────────────────────────────────────
const WithdrawModal = ({ visible, walletBalance, onClose, onSuccess, theme }) => {
  const [amount,       setAmount]       = useState('');
  const [accountNo,    setAccountNo]    = useState('');
  const [accountName,  setAccountName]  = useState('');
  const [bankSearch,   setBankSearch]   = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [showBanks,    setShowBanks]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  const filteredBanks = NG_BANKS.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const reset = () => {
    setAmount(''); setAccountNo(''); setAccountName('');
    setBankSearch(''); setSelectedBank(null); setShowBanks(false);
  };

  const handleClose  = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1000)          return Alert.alert('Minimum ₦1,000', 'Enter at least ₦1,000 to withdraw.');
    if (amt > walletBalance)          return Alert.alert('Insufficient balance', `Your wallet has ₦${Number(walletBalance).toFixed(2)}.`);
    if (!selectedBank)                return Alert.alert('Select bank', 'Please choose your bank.');
    if (accountNo.length !== 10)      return Alert.alert('Account number', 'Enter a valid 10-digit account number.');
    if (!accountName.trim())          return Alert.alert('Account name', 'Enter your account name.');

    setSubmitting(true);
    try {
      await driverAPI.requestPayout({
        amount:        amt,
        accountNumber: accountNo,
        bankCode:      selectedBank.code,
        accountName:   accountName.trim(),
      });
      reset();
      onSuccess(amt);
    } catch (err) {
      Alert.alert('Withdrawal failed', err?.response?.data?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[wm.root, { backgroundColor: theme.background }]}>
        <View style={[wm.header, { borderBottomColor: theme.border }]}>
          <Text style={[wm.title, { color: theme.foreground }]}>Withdraw Earnings</Text>
          <TouchableOpacity
            onPress={handleClose}
            style={[wm.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          >
            <Ionicons name="close" size={18} color={theme.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={wm.scroll} keyboardShouldPersistTaps="handled">
          {/* Balance */}
          <View style={[wm.balanceCard, { backgroundColor: DA + '14', borderColor: DA + '35' }]}>
            <Text style={[wm.balanceLbl, { color: DA + '99' }]}>AVAILABLE BALANCE</Text>
            <Text style={[wm.balanceAmt, { color: DA }]}>
              ₦{Number(walletBalance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {/* Amount */}
          <Text style={[wm.lbl, { color: theme.hint }]}>AMOUNT (min ₦1,000)</Text>
          <View style={[wm.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[wm.naira, { color: DA }]}>₦</Text>
            <TextInput
              style={[wm.input, { color: theme.foreground }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={theme.hint}
            />
            <TouchableOpacity onPress={() => setAmount(String(Math.floor(walletBalance ?? 0)))}>
              <Text style={[wm.maxBtn, { color: DA }]}>MAX</Text>
            </TouchableOpacity>
          </View>

          {/* Bank */}
          <Text style={[wm.lbl, { color: theme.hint }]}>BANK</Text>
          <TouchableOpacity
            style={[wm.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => setShowBanks(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="business-outline" size={16} color={theme.hint} style={{ marginRight: 8 }} />
            <Text style={[wm.input, { color: selectedBank ? theme.foreground : theme.hint }]}>
              {selectedBank ? selectedBank.name : 'Select your bank'}
            </Text>
            <Ionicons name={showBanks ? 'chevron-up' : 'chevron-down'} size={16} color={theme.hint} />
          </TouchableOpacity>

          {showBanks && (
            <View style={[wm.bankDropdown, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={[wm.bankSearch, { borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={14} color={theme.hint} />
                <TextInput
                  style={[wm.bankSearchInput, { color: theme.foreground }]}
                  value={bankSearch}
                  onChangeText={setBankSearch}
                  placeholder="Search bank…"
                  placeholderTextColor={theme.hint}
                />
              </View>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {filteredBanks.map(b => (
                  <TouchableOpacity
                    key={b.code}
                    style={[
                      wm.bankItem,
                      { borderBottomColor: theme.border },
                      selectedBank?.code === b.code && { backgroundColor: DA + '14' },
                    ]}
                    onPress={() => { setSelectedBank(b); setShowBanks(false); setBankSearch(''); }}
                  >
                    <Text style={[wm.bankItemTxt, { color: selectedBank?.code === b.code ? DA : theme.foreground }]}>
                      {b.name}
                    </Text>
                    {selectedBank?.code === b.code && <Ionicons name="checkmark" size={14} color={DA} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Account number */}
          <Text style={[wm.lbl, { color: theme.hint }]}>ACCOUNT NUMBER</Text>
          <View style={[wm.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="card-outline" size={16} color={theme.hint} style={{ marginRight: 8 }} />
            <TextInput
              style={[wm.input, { color: theme.foreground }]}
              value={accountNo}
              onChangeText={t => setAccountNo(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="numeric"
              placeholder="0123456789"
              placeholderTextColor={theme.hint}
              maxLength={10}
            />
            <Text style={[wm.charCount, { color: accountNo.length === 10 ? DA : theme.hint }]}>
              {accountNo.length}/10
            </Text>
          </View>

          {/* Account name */}
          <Text style={[wm.lbl, { color: theme.hint }]}>ACCOUNT NAME</Text>
          <View style={[wm.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="person-outline" size={16} color={theme.hint} style={{ marginRight: 8 }} />
            <TextInput
              style={[wm.input, { color: theme.foreground }]}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="As it appears on your bank account"
              placeholderTextColor={theme.hint}
              autoCapitalize="words"
            />
          </View>

          {/* Note */}
          <View style={[wm.noteCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={theme.hint} />
            <Text style={[wm.noteTxt, { color: theme.hint }]}>
              Funds arrive within 1–2 business days after admin approval. Platform fees have already been deducted from your earnings.
            </Text>
          </View>

          <TouchableOpacity
            style={[wm.submitBtn, { backgroundColor: submitting ? DA + '80' : DA }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color="#080C18" />
            ) : (
              <>
                <Ionicons name="arrow-up-circle-outline" size={18} color="#080C18" />
                <Text style={wm.submitTxt}>
                  Withdraw {amount ? `₦${Number(amount).toLocaleString('en-NG')}` : '—'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};
const wm = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title:        { fontSize: 18, fontWeight: '900' },
  closeBtn:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:       { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 20 },
  balanceCard:  { borderRadius: 16, borderWidth: 1, padding: 18, alignItems: 'center', marginBottom: 22 },
  balanceLbl:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 6 },
  balanceAmt:   { fontSize: 28, fontWeight: '900' },
  lbl:          { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 8, marginTop: 4 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  naira:        { fontSize: 18, fontWeight: '800', marginRight: 6 },
  input:        { flex: 1, fontSize: 15, fontWeight: '500' },
  maxBtn:       { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  charCount:    { fontSize: 11, fontWeight: '600' },
  bankDropdown: { borderRadius: 13, borderWidth: 1, overflow: 'hidden', marginTop: -8, marginBottom: 14 },
  bankSearch:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1 },
  bankSearchInput: { flex: 1, fontSize: 14 },
  bankItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  bankItemTxt:  { fontSize: 13, fontWeight: '500' },
  noteCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 20 },
  noteTxt:      { flex: 1, fontSize: 11, lineHeight: 17 },
  submitBtn:    { borderRadius: 16, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  submitTxt:    { fontSize: 15, fontWeight: '900', color: '#080C18' },
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
  const [showWithdraw,  setShowWithdraw]  = useState(false);

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

  const handleWithdrawSuccess = (amt) => {
    setShowWithdraw(false);
    setWalletBalance(prev => Math.max(0, (prev ?? 0) - amt));
    Alert.alert(
      'Withdrawal Submitted ✅',
      `₦${Number(amt).toLocaleString('en-NG')} withdrawal request submitted. Our team will process it within 1–2 business days.`
    );
    fetchAll(period);
  };

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
            <Text style={[s.title, { color: theme.foreground }]}>My Wallet</Text>
          </View>
          {/* Action buttons — top up and withdraw */}
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
              onPress={() => setShowWithdraw(true)}
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
            <TouchableOpacity
              style={[s.walletActionBtn, { backgroundColor: theme.backgroundAlt, borderColor: DA + '30' }]}
              onPress={() => setShowWithdraw(true)}
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
              ['Gross Earnings',    earnings?.totalEarnings,  DA],
              ['Platform Fee (20%)', earnings?.platformFee,   RED],
              ['Net Earnings',      earnings?.netEarnings,   GREEN],
              ['Avg per Ride',      earnings?.averagePerRide, theme.foreground],
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
                    active ? { backgroundColor: DA } : { backgroundColor: theme.backgroundAlt, borderColor: theme.border },
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

      {/* ── Withdraw modal ── */}
      <WithdrawModal
        visible={showWithdraw}
        walletBalance={walletBalance}
        onClose={() => setShowWithdraw(false)}
        onSuccess={handleWithdrawSuccess}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  orb:     { position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, top: -width * 0.7, left: -width * 0.3, opacity: 0.04 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  eyebrow:         { fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 2 },
  title:           { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerBtns:      { flexDirection: 'row', gap: 8 },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  headerActionTxt: { fontSize: 12, fontWeight: '800' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 20, paddingBottom: 100 },

  // Wallet actions
  walletActions:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  walletActionBtn:   { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  walletActionIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  walletActionLbl:   { fontSize: 13, fontWeight: '700' },
  walletActionSub:   { fontSize: 10 },

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
  listCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, marginBottom: 24 },
  empty:    { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyTxt: { fontSize: 13 },
});