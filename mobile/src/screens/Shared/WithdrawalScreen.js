// mobile/src/screens/Shared/WithdrawalScreen.js  [PATCHED]
// Changes vs original:
//   1. Added missing `formatNGN` definition (was used but never declared)
//   2. Fixed submit handler to call walletAPI.withdraw() instead of
//      driverAPI/partnerAPI.requestPayout() — all users now use the
//      unified wallet withdrawal endpoint which goes through admin approval
//   3. Minimum withdrawal updated to ₦500 (matches backend)
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Animated, ActivityIndicator,
  Alert, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { walletAPI, driverAPI, partnerAPI } from '../../services/api';

// ── FIX: formatNGN was used throughout but never defined ─────────────────────
const formatNGN = (n) =>
  Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });
// ─────────────────────────────────────────────────────────────────────────────

const BANKS = [
  { name: 'Access Bank',             code: '044'    },
  { name: 'Citibank',                code: '023'    },
  { name: 'Ecobank',                 code: '050'    },
  { name: 'Fidelity Bank',           code: '070'    },
  { name: 'First Bank',              code: '011'    },
  { name: 'First City Monument',     code: '214'    },
  { name: 'Globus Bank',             code: '00103'  },
  { name: 'Guaranty Trust Bank',     code: '058'    },
  { name: 'Heritage Bank',           code: '030'    },
  { name: 'Jaiz Bank',               code: '301'    },
  { name: 'Keystone Bank',           code: '082'    },
  { name: 'Kuda Bank',               code: '50211'  },
  { name: 'OPay',                    code: '100004' },
  { name: 'Palmpay',                 code: '100033' },
  { name: 'Polaris Bank',            code: '076'    },
  { name: 'Providus Bank',           code: '101'    },
  { name: 'Stanbic IBTC',            code: '221'    },
  { name: 'Sterling Bank',           code: '232'    },
  { name: 'Union Bank',              code: '032'    },
  { name: 'United Bank for Africa',  code: '033'    },
  { name: 'Unity Bank',              code: '215'    },
  { name: 'Wema Bank',               code: '035'    },
  { name: 'Zenith Bank',             code: '057'    },
];

const BankPicker = ({ selected, onSelect, theme, accent }) => {
  const [open, setOpen] = useState(false);
  const bank = BANKS.find(b => b.code === selected);

  return (
    <View>
      <TouchableOpacity
        style={[bp.btn, { backgroundColor: theme.backgroundAlt, borderColor: selected ? accent + '60' : theme.border }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
      >
        <Ionicons name="business-outline" size={16} color={selected ? accent : theme.hint} />
        <Text style={[bp.btnTxt, { color: selected ? theme.foreground : theme.hint, flex: 1 }]}>
          {bank?.name ?? 'Select your bank'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.hint} />
      </TouchableOpacity>

      {open && (
        <ScrollView
          style={[bp.dropdown, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {BANKS.map(b => (
            <TouchableOpacity
              key={b.code}
              style={[bp.option, { borderBottomColor: theme.border }]}
              onPress={() => { onSelect(b.code); setOpen(false); }}
            >
              <Text style={[bp.optionTxt, {
                color:      b.code === selected ? accent : theme.foreground,
                fontWeight: b.code === selected ? '800' : '500',
              }]}>
                {b.name}
              </Text>
              {b.code === selected && <Ionicons name="checkmark-circle" size={16} color={accent} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const bp = StyleSheet.create({
  btn:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  btnTxt:    { fontSize: 14, fontWeight: '600' },
  dropdown:  { maxHeight: 220, borderRadius: 12, borderWidth: 1, marginTop: 4, marginBottom: 8 },
  option:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  optionTxt: { fontSize: 14 },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function WithdrawalScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();
  const accent          = theme.accent;

  const [walletBalance, setWalletBalance] = useState(null);
  const [amount,        setAmount]        = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode,      setBankCode]      = useState('');
  const [accountName,   setAccountName]   = useState('');
  const [verifying,     setVerifying]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [step,          setStep]          = useState(1);
  const [payoutHistory, setPayoutHistory] = useState([]);

  const shakeA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    walletAPI.getWallet()
      .then(res => setWalletBalance(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
      .catch(() => {});

    // Load payout history if available for the role
    const api = user?.role === 'DRIVER' ? driverAPI : partnerAPI;
    api.getPayoutHistory?.()
      .then(res => setPayoutHistory(res?.data?.payouts ?? []))
      .catch(() => {});
  }, []);

  const shake = () => Animated.sequence([
    Animated.timing(shakeA, { toValue:  8, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeA, { toValue: -8, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeA, { toValue:  5, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeA, { toValue:  0, duration: 55, useNativeDriver: true }),
  ]).start();

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) verifyAccount();
    else if (accountNumber.length < 10) setAccountName('');
  }, [accountNumber, bankCode]);

  const verifyAccount = async () => {
    setVerifying(true);
    setAccountName('');
    try {
      const res = await walletAPI.verifyBankAccount({ accountNumber, bankCode });
      setAccountName(res?.data?.accountName ?? res?.data?.account_name ?? '');
    } catch {
      setAccountName('');
    } finally {
      setVerifying(false);
    }
  };

  const amtNum  = parseFloat(amount) || 0;
  const balance = walletBalance ?? 0;

  // ── Step guards ─────────────────────────────────────────────────────────────
  const MIN_WITHDRAWAL = 500; // matches backend

  const handleStep1 = () => {
    Keyboard.dismiss();
    if (amtNum < MIN_WITHDRAWAL) {
      shake();
      Alert.alert('Minimum withdrawal', `Minimum is ₦${formatNGN(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (amtNum > balance) {
      shake();
      Alert.alert('Insufficient balance', `Balance is ₦${formatNGN(balance)}`);
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    Keyboard.dismiss();
    if (accountNumber.length !== 10) { shake(); Alert.alert('Invalid account', 'Enter 10-digit account number'); return; }
    if (!bankCode)                   { shake(); Alert.alert('Select bank', 'Please select your bank');           return; }
    if (!accountName)                { shake(); Alert.alert('Verify account', 'Account verification failed');    return; }
    setStep(3);
  };

  // ── FIX: use unified walletAPI.withdraw → goes through admin approval ───────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await walletAPI.withdraw({ amount: amtNum, accountNumber, bankCode, accountName });
      Alert.alert(
        'Withdrawal Requested ✅',
        `₦${formatNGN(amtNum)} to ${accountName} submitted.\n\nOur team will review and process within 1–2 business days.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Request Failed', err?.response?.data?.message ?? 'Could not submit withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const isDarkMode  = mode === 'dark';
  const btnBgColor  = isDarkMode ? '#FFFFFF' : accent;
  const btnTextColor = isDarkMode ? '#000000' : '#FFFFFF';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => step > 1 ? setStep(p => p - 1) : navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Withdraw Funds</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>
            {step === 1 ? 'Enter amount' : step === 2 ? 'Bank details' : 'Confirm withdrawal'}
          </Text>
        </View>
        <View style={s.stepRow}>
          {[1, 2, 3].map(n => (
            <View key={n} style={[s.stepDot, {
              backgroundColor: n <= step ? accent : theme.border,
              width: n === step ? 20 : 8,
            }]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[s.balanceCard, { backgroundColor: accent + '12', borderColor: accent + '30' }]}>
          <Text style={[s.balanceLbl, { color: accent }]}>AVAILABLE BALANCE</Text>
          <Text style={[s.balanceAmt, { color: accent }]}>₦{formatNGN(balance)}</Text>
          {amtNum > 0 && amtNum <= balance && (
            <Text style={[s.balanceAfter, { color: theme.hint }]}>After: ₦{formatNGN(balance - amtNum)}</Text>
          )}
        </View>

        {/* STEP 1 */}
        {step === 1 && (
          <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
            <Text style={[s.sectionLabel, { color: theme.hint }]}>WITHDRAWAL AMOUNT</Text>
            <View style={[s.inputCard, { backgroundColor: theme.backgroundAlt, borderColor: amtNum > 0 ? accent + '70' : theme.border }]}>
              <Text style={[s.currency, { color: accent }]}>₦</Text>
              <TextInput
                style={[s.input, { color: theme.foreground }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.hint}
                maxLength={7}
                autoFocus
              />
            </View>

            <View style={s.quickRow}>
              {[1000, 2000, 5000, 10000].map(q => (
                <TouchableOpacity
                  key={q}
                  style={[s.quickBtn, {
                    backgroundColor: amtNum === q ? accent : theme.backgroundAlt,
                    borderColor:     amtNum === q ? accent : theme.border,
                  }]}
                  onPress={() => setAmount(String(q))}
                >
                  <Text style={[s.quickTxt, { color: amtNum === q ? '#080C18' : theme.foreground }]}>
                    ₦{formatNGN(q)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[s.noteBox, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.noteRow}><Ionicons name="time-outline"             size={13} color={theme.hint}  /><Text style={[s.noteTxt, { color: theme.hint }]}>1–2 business days</Text></View>
              <View style={s.noteRow}><Ionicons name="shield-checkmark-outline" size={13} color={accent}      /><Text style={[s.noteTxt, { color: theme.hint }]}>Admin review required</Text></View>
              <View style={s.noteRow}><Ionicons name="cash-outline"             size={13} color={accent}      /><Text style={[s.noteTxt, { color: theme.hint }]}>Min ₦{formatNGN(MIN_WITHDRAWAL)} • No fee</Text></View>
            </View>

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: amtNum >= MIN_WITHDRAWAL && amtNum <= balance ? accent : theme.border }]}
              onPress={handleStep1}
              disabled={amtNum < MIN_WITHDRAWAL || amtNum > balance}
            >
              <Text style={[s.nextBtnTxt, { color: amtNum >= MIN_WITHDRAWAL && amtNum <= balance ? '#080C18' : theme.hint }]}>
                Continue →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
            <Text style={[s.sectionLabel, { color: theme.hint }]}>SELECT BANK</Text>
            <BankPicker selected={bankCode} onSelect={setBankCode} theme={theme} accent={accent} />

            <Text style={[s.sectionLabel, { color: theme.hint }]}>ACCOUNT NUMBER</Text>
            <View style={[s.fieldCard, { backgroundColor: theme.backgroundAlt, borderColor: accountName ? '#5DAA7260' : accountNumber.length === 10 ? '#E0555560' : theme.border }]}>
              <Ionicons name="card-outline" size={16} color={theme.hint} />
              <TextInput
                style={[s.field, { color: theme.foreground }]}
                value={accountNumber}
                onChangeText={t => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="numeric"
                placeholder="10-digit account number"
                placeholderTextColor={theme.hint}
                maxLength={10}
              />
              {verifying && <ActivityIndicator size="small" color={accent} />}
              {!verifying && accountName                              && <Ionicons name="checkmark-circle" size={18} color="#5DAA72" />}
              {!verifying && !accountName && accountNumber.length === 10 && <Ionicons name="close-circle"    size={18} color="#E05555" />}
            </View>

            {accountName && (
              <View style={[s.verifiedBadge, { backgroundColor: '#5DAA7212', borderColor: '#5DAA7240' }]}>
                <Ionicons name="person-circle-outline" size={16} color="#5DAA72" />
                <Text style={[s.verifiedTxt, { color: '#5DAA72' }]}>{accountName}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: accountName && bankCode ? accent : theme.border, marginTop: 24 }]}
              onPress={handleStep2}
              disabled={!accountName || !bankCode}
            >
              <Text style={[s.nextBtnTxt, { color: accountName && bankCode ? '#080C18' : theme.hint }]}>
                Review →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <View>
            <View style={[s.confirmCard, { backgroundColor: theme.backgroundAlt, borderColor: accent + '30' }]}>
              <Text style={[s.confirmTitle, { color: theme.foreground }]}>Review Your Withdrawal</Text>
              {[
                { label: 'Amount',      value: `₦${formatNGN(amtNum)}`,                               color: accent },
                { label: 'Bank',        value: BANKS.find(b => b.code === bankCode)?.name ?? bankCode, color: undefined },
                { label: 'Account No.', value: accountNumber,                                          color: undefined },
                { label: 'Account Name',value: accountName,                                            color: undefined },
                { label: 'Processing',  value: '1–2 business days',                                   color: undefined },
              ].map(({ label, value, color }) => (
                <View key={label} style={[s.confirmRow, { borderBottomColor: theme.border }]}>
                  <Text style={[s.confirmLbl, { color: theme.hint }]}>{label}</Text>
                  <Text style={[s.confirmVal, { color: color ?? theme.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={[s.adminNote, { backgroundColor: '#A78BFA0D', borderColor: '#A78BFA30' }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.accent} />
              <Text style={[s.adminNoteTxt, { color: theme.hint }]}>
                Your request will be reviewed by our admin team and processed within 1–2 business days.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: btnBgColor, opacity: submitting ? 0.75 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color={btnTextColor} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={btnTextColor} />
                  <Text style={[s.nextBtnTxt, { color: btnTextColor }]}>Submit Withdrawal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Recent payouts (step 1 only) */}
        {payoutHistory.length > 0 && step === 1 && (
          <>
            <Text style={[s.sectionLabel, { color: theme.hint, marginTop: 24 }]}>RECENT WITHDRAWALS</Text>
            <View style={[s.historyCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              {payoutHistory.slice(0, 5).map((p, i) => (
                <View key={p.id ?? i} style={[s.histRow, { borderBottomColor: theme.border, borderBottomWidth: i < 4 ? 1 : 0 }]}>
                  <View style={[s.histIcon, { backgroundColor: theme.accent + '18' }]}>
                    <Ionicons name="cash-outline" size={14} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.histBank, { color: theme.foreground }]}>{BANKS.find(b => b.code === p.bankCode)?.name ?? p.bankCode}</Text>
                    <Text style={[s.histDate, { color: theme.hint }]}>{new Date(p.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.histAmt, { color: theme.foreground }]}>₦{formatNGN(p.amount)}</Text>
                    <Text style={[s.histStatus, { color: theme.hint }]}>{p.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '900' },
  headerSub:    { fontSize: 11, marginTop: 1 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot:      { height: 8, borderRadius: 4 },
  scroll:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  balanceCard:  { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24, alignItems: 'center' },
  balanceLbl:   { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  balanceAmt:   { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  balanceAfter: { fontSize: 11, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 12 },
  inputCard:    { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 20 },
  currency:     { fontSize: 28, fontWeight: '900', marginRight: 6 },
  input:        { flex: 1, fontSize: 40, fontWeight: '900', paddingVertical: 14 },
  quickRow:     { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  quickBtn:     { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  quickTxt:     { fontSize: 13, fontWeight: '700' },
  noteBox:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 24 },
  noteRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTxt:      { fontSize: 12 },
  fieldCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  field:        { flex: 1, fontSize: 16, fontWeight: '600' },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  verifiedTxt:  { fontSize: 13, fontWeight: '700' },
  confirmCard:  { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 16 },
  confirmTitle: { fontSize: 16, fontWeight: '900', marginBottom: 14 },
  confirmRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1 },
  confirmLbl:   { fontSize: 13 },
  confirmVal:   { fontSize: 14, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  adminNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  adminNoteTxt: { flex: 1, fontSize: 12, lineHeight: 18 },
  nextBtn:      { borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextBtnTxt:   { fontSize: 16, fontWeight: '900' },
  historyCard:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, marginBottom: 16 },
  histRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  histIcon:     { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  histBank:     { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  histDate:     { fontSize: 11 },
  histAmt:      { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  histStatus:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});