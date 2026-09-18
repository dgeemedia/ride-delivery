// mobile/src/screens/Shared/WithdrawalScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Animated, ActivityIndicator,
  Alert, Keyboard, Platform, Dimensions,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useCurrency }       from '../../context/CurrencyContext';
import { useCountryConfig }  from '../../context/CountryConfigContext';
import { useAuth }           from '../../context/AuthContext';
import { useTranslation }    from 'react-i18next';
import { walletAPI, driverAPI, partnerAPI, paymentAPI } from '../../services/api';
const { height } = Dimensions.get('window');

const formatNGN = (n) =>
  Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });

const FALLBACK_BANKS = [
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

const BankPicker = ({ selected, onSelect, theme, banks }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const bank   = banks.find(b => b.code === selected);
  const accent = theme.accent;

  return (
    <View>
      <TouchableOpacity
        style={[bp.btn, { backgroundColor: theme.backgroundAlt, borderColor: selected ? accent + '60' : theme.border }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.85}
      >
        <Ionicons name="business-outline" size={16} color={selected ? accent : theme.hint} />
        <Text style={[bp.btnTxt, { color: selected ? theme.foreground : theme.hint, flex: 1 }]}>
          {bank?.name ?? t('withdrawal.selectYourBank')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.hint} />
      </TouchableOpacity>

      {open && (
        <ScrollView
          style={[bp.dropdown, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {banks.map(b => (
            <TouchableOpacity
              key={b.code}
              style={[bp.option, { borderBottomColor: theme.border }]}
              onPress={() => { onSelect(b.code); setOpen(false); }}
            >
              <Text style={[bp.optionTxt, {
                color:      b.code === selected ? accent : theme.foreground,
                fontWeight: b.code === selected ? '800'  : '500',
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
  btn:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  btnTxt:   { fontSize: 14, fontWeight: '600' },
  dropdown: { maxHeight: 220, borderRadius: 12, borderWidth: 1, marginTop: 4, marginBottom: 8 },
  option:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  optionTxt:{ fontSize: 14 },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function WithdrawalScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { formatMoney, currencySymbol } = useCurrency();
  const { user }        = useAuth();
  const { t }            = useTranslation();
  const insets          = useSafeAreaInsets();

  // FIX: derive all selected-state colors from theme tokens so every accent
  // variant (onyx dark → white accent / onyx light → black accent, etc.)
  // renders readable text automatically.
  //   accent    → button / chip background when active
  //   accentFg  → text ON TOP of accent background
  const accent   = theme.accent;
  const accentFg = theme.accentFg ?? '#FFFFFF';

  // ── Bounded scroll height (mirrors ProfileScreen) ──────────────────────────
  const TAB_H          = 54;
  const EXTRA_BOTTOM   = Platform.OS === 'android' ? 16 : 0;
  const HEADER_INNER_H = 64;
  const HEADER_H       = insets.top + HEADER_INNER_H;
  const SCROLL_H       = height - HEADER_H - TAB_H - insets.bottom - EXTRA_BOTTOM;

  const [walletBalance, setWalletBalance] = useState(null);
  const [amount,        setAmount]        = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode,      setBankCode]      = useState('');
  const [accountName,   setAccountName]   = useState('');
  const [verifying,     setVerifying]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [step,          setStep]          = useState(1);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [banks, setBanks] = useState(FALLBACK_BANKS);

  // Orange markets pay out to a wallet number, not a bank account, so the
  // whole of step 2 changes shape. The server decides which — the client
  // must never guess a payout rail from the country code alone.
  const { config, isMobileMoneyPayout } = useCountryConfig();
  const [mobileNumber, setMobileNumber] = useState('');

  useEffect(() => {
    paymentAPI.listBanks()
      .then(res => {
        const list = res?.data?.banks ?? [];
        const normalized = list
          .map(b => ({ name: b.name, code: String(b.code ?? b.id) }))
          .filter(b => b.name && b.code);
        if (normalized.length > 0) setBanks(normalized);
      })
      .catch(() => {}); // keeps FALLBACK_BANKS on failure
  }, []);

  const shakeA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    walletAPI.getWallet()
      .then(res => setWalletBalance(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
      .catch(() => {});

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
    // Name lookup is a bank-rail feature. Orange exposes no subscriber-name
    // endpoint, so firing this for a wallet number would always fail and
    // block the form.
    if (isMobileMoneyPayout) return;
    if (accountNumber.length === 10 && bankCode) verifyAccount();
    else if (accountNumber.length < 10) setAccountName('');
  }, [accountNumber, bankCode, isMobileMoneyPayout]);

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
  const MIN_WITHDRAWAL = 500;

  const handleStep1 = () => {
    Keyboard.dismiss();
    if (amtNum < MIN_WITHDRAWAL) {
      shake();
      Alert.alert(t('withdrawal.minimumWithdrawal'), t('withdrawal.minimumIs', { amount: formatMoney(MIN_WITHDRAWAL) })); // NOTE: 500 is a fixed NG minimum-withdrawal business rule
      return;
    }
    if (amtNum > balance) {
      shake();
      Alert.alert(t('withdrawal.insufficientBalance'), t('withdrawal.balanceIs', { amount: formatMoney(balance) }));
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    Keyboard.dismiss();
    if (isMobileMoneyPayout) {
      // Accept any reasonable national or international form; the server
      // normalises to a full MSISDN and rejects anything it can't route.
      const digits = mobileNumber.replace(/\D/g, '');
      if (digits.length < 8) {
        shake();
        Alert.alert(t('withdrawal.invalidMobileTitle'), t('withdrawal.invalidMobileMsg'));
        return;
      }
    } else {
      if (accountNumber.length !== 10) { shake(); Alert.alert(t('withdrawal.invalidAccount'), t('withdrawal.enter10Digit')); return; }
      if (!bankCode)                   { shake(); Alert.alert(t('withdrawal.selectBankTitle'),     t('withdrawal.pleaseSelectBank'));        return; }
      if (!accountName)                { shake(); Alert.alert(t('withdrawal.verifyAccount'),  t('withdrawal.verificationFailed'));   return; }
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await walletAPI.withdraw(
        isMobileMoneyPayout
          ? { amount: amtNum, mobileNumber, accountName: accountName || undefined }
          : { amount: amtNum, accountNumber, bankCode, accountName }
      );
      Alert.alert(
        t('withdrawal.requestedTitle'),
        t('withdrawal.requestedMsg', { amount: formatMoney(amtNum), name: accountName }),
        [{ text: t('walletTopUp.done'), onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      // FIX: axios interceptor already unwraps error.response.data
      Alert.alert(t('withdrawal.requestFailed'), err?.message ?? err?.error ?? t('withdrawal.submitErrorMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers for active-state readability ───────────────────────────────────
  // Any button whose background becomes `accent` needs its text to be `accentFg`.
  // These two helpers keep every call-site clean and consistent.
  const activeStyle   = { backgroundColor: accent,    borderColor: accent    };
  const inactiveStyle = { backgroundColor: theme.backgroundAlt, borderColor: theme.border };
  const activeTxtColor   = accentFg;
  const inactiveTxtColor = theme.foreground;

  const step1Ready = amtNum >= MIN_WITHDRAWAL && amtNum <= balance;
  // Mobile-money payouts have no name to verify, so readiness is just a
  // plausible number — otherwise step 2 could never be completed.
  const step2Ready = isMobileMoneyPayout
    ? mobileNumber.replace(/\D/g, '').length >= 8
    : (!!accountName && !!bankCode);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <View style={[s.header, {
        paddingTop:        insets.top,
        height:            HEADER_H,
        backgroundColor:   theme.background,
        borderBottomColor: theme.border,
      }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => step > 1 ? setStep(p => p - 1) : navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>{t('withdrawal.headerTitle')}</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>
            {step === 1 ? t('withdrawal.stepEnterAmount') : step === 2 ? t('withdrawal.stepBankDetails') : t('withdrawal.stepConfirm')}
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

      {/* ── Bounded scroll container ────────────────────────────────────────── */}
      <View style={{ height: SCROLL_H }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces
          overScrollMode="always"
        >
          <View style={[s.balanceCard, { backgroundColor: accent + '12', borderColor: accent + '30' }]}>
            <Text style={[s.balanceLbl, { color: accent }]}>{t('withdrawal.availableBalance')}</Text>
            <Text style={[s.balanceAmt, { color: accent }]}>{formatMoney(balance)}</Text>
            {amtNum > 0 && amtNum <= balance && (
              <Text style={[s.balanceAfter, { color: theme.hint }]}>{t('withdrawal.after', { amount: formatMoney(balance - amtNum) })}</Text>
            )}
          </View>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
              <Text style={[s.sectionLabel, { color: theme.hint }]}>{t('withdrawal.withdrawalAmount')}</Text>
              <View style={[s.inputCard, {
                backgroundColor: theme.backgroundAlt,
                borderColor: amtNum > 0 ? accent + '70' : theme.border,
              }]}>
                <Text style={[s.currency, { color: accent }]}>{currencySymbol}</Text>
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

              {/* FIX: quick-amount chips use accentFg for text when selected,
                   so black-accent (light onyx) → white text, and
                   white-accent (dark onyx) → black text.                    */}
              <View style={s.quickRow}>
                {[1000, 2000, 5000, 10000].map(q => {
                  const isActive = amtNum === q;
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[s.quickBtn, isActive ? activeStyle : inactiveStyle]}
                      onPress={() => setAmount(String(q))}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.quickTxt, { color: isActive ? activeTxtColor : inactiveTxtColor }]}>
                        {formatMoney(q)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[s.noteBox, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={s.noteRow}><Ionicons name="time-outline"             size={13} color={theme.hint} /><Text style={[s.noteTxt, { color: theme.hint }]}>{t('withdrawal.businessDays')}</Text></View>
                <View style={s.noteRow}><Ionicons name="shield-checkmark-outline" size={13} color={accent}     /><Text style={[s.noteTxt, { color: theme.hint }]}>{t('withdrawal.adminReviewRequired')}</Text></View>
                <View style={s.noteRow}><Ionicons name="cash-outline"             size={13} color={accent}     /><Text style={[s.noteTxt, { color: theme.hint }]}>{t('withdrawal.minNoFee', { amount: formatMoney(MIN_WITHDRAWAL) })}</Text></View>
              </View>

              {/* FIX: Continue button uses accentFg when active */}
              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: step1Ready ? accent : theme.border }]}
                onPress={handleStep1}
                disabled={!step1Ready}
                activeOpacity={0.88}
              >
                <Text style={[s.nextBtnTxt, { color: step1Ready ? accentFg : theme.hint }]}>
                  {t('withdrawal.continueBtn')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
              {isMobileMoneyPayout ? (
                <>
                  {/* ── Mobile-money rail (Orange Money) ──────────────────
                      No bank picker and no name lookup: Orange settles to a
                      wallet number and exposes no subscriber-name endpoint,
                      so the number itself is the whole destination. */}
                  <Text style={[s.sectionLabel, { color: theme.hint }]}>
                    {t('withdrawal.mobileMoneyNumber')}
                  </Text>
                  <View style={[s.fieldCard, {
                    backgroundColor: theme.backgroundAlt,
                    borderColor: step2Ready ? '#FF790060' : theme.border,
                  }]}>
                    <Ionicons name="phone-portrait-outline" size={16} color={theme.hint} />
                    <Text style={[s.field, { color: theme.hint, flex: 0, marginRight: 2 }]}>
                      {config.countryCode ? '' : ''}
                    </Text>
                    <TextInput
                      style={[s.field, { color: theme.foreground }]}
                      value={mobileNumber}
                      onChangeText={val => setMobileNumber(val.replace(/[^\d+ ]/g, '').slice(0, 20))}
                      keyboardType="phone-pad"
                      placeholder={t('withdrawal.mobileMoneyPlaceholder')}
                      placeholderTextColor={theme.hint}
                    />
                    {step2Ready && <Ionicons name="checkmark-circle" size={18} color="#5DAA72" />}
                  </View>

                  {/* Standing in for the verified-name badge the bank rail
                      shows. Since we genuinely cannot confirm the owner,
                      say so rather than implying a check happened. */}
                  <View style={[s.verifiedBadge, { backgroundColor: '#FF790012', borderColor: '#FF790040' }]}>
                    <Ionicons name="information-circle-outline" size={16} color="#FF7900" />
                    <Text style={[s.verifiedTxt, { color: '#FF7900' }]}>
                      {t('withdrawal.mobileMoneyUnverified')}
                    </Text>
                  </View>
                </>
              ) : (
                <>
              <Text style={[s.sectionLabel, { color: theme.hint }]}>{t('withdrawal.selectBank')}</Text>
              <BankPicker selected={bankCode} onSelect={setBankCode} theme={theme} banks={banks} />

              <Text style={[s.sectionLabel, { color: theme.hint }]}>{t('withdrawal.accountNumber')}</Text>
              <View style={[s.fieldCard, {
                backgroundColor: theme.backgroundAlt,
                borderColor: accountName
                  ? '#5DAA7260'
                  : accountNumber.length === 10
                  ? '#E0555560'
                  : theme.border,
              }]}>
                <Ionicons name="card-outline" size={16} color={theme.hint} />
                <TextInput
                  style={[s.field, { color: theme.foreground }]}
                  value={accountNumber}
                  onChangeText={val => setAccountNumber(val.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="numeric"
                  placeholder={t('withdrawal.accountNumberPlaceholder')}
                  placeholderTextColor={theme.hint}
                  maxLength={10}
                />
                {verifying && <ActivityIndicator size="small" color={accent} />}
                {!verifying && accountName                               && <Ionicons name="checkmark-circle" size={18} color="#5DAA72" />}
                {!verifying && !accountName && accountNumber.length === 10 && <Ionicons name="close-circle"    size={18} color="#E05555" />}
              </View>

              {accountName && (
                <View style={[s.verifiedBadge, { backgroundColor: '#5DAA7212', borderColor: '#5DAA7240' }]}>
                  <Ionicons name="person-circle-outline" size={16} color="#5DAA72" />
                  <Text style={[s.verifiedTxt, { color: '#5DAA72' }]}>{accountName}</Text>
                </View>
              )}
                </>
              )}

              {/* FIX: Review button uses accentFg when active */}
              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: step2Ready ? accent : theme.border, marginTop: 24 }]}
                onPress={handleStep2}
                disabled={!step2Ready}
                activeOpacity={0.88}
              >
                <Text style={[s.nextBtnTxt, { color: step2Ready ? accentFg : theme.hint }]}>
                  {t('withdrawal.reviewBtn')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <View>
              <View style={[s.confirmCard, { backgroundColor: theme.backgroundAlt, borderColor: accent + '30' }]}>
                <Text style={[s.confirmTitle, { color: theme.foreground }]}>{t('withdrawal.reviewYourWithdrawal')}</Text>
                {[
                  { label: t('withdrawal.confirmAmount'), value: formatMoney(amtNum), color: accent },
                  // The destination rows differ by rail: a mobile-money
                  // payout has a wallet number and no verified account name,
                  // so showing empty "Account name" rows would look broken.
                  ...(isMobileMoneyPayout
                    ? [
                        { label: t('withdrawal.confirmMethod'),       value: 'Orange Money', color: '#FF7900' },
                        { label: t('withdrawal.confirmMobileNumber'), value: mobileNumber,   color: undefined },
                      ]
                    : [
                        { label: t('withdrawal.confirmBank'),        value: banks.find(b => b.code === bankCode)?.name ?? bankCode, color: undefined },
                        { label: t('withdrawal.confirmAccountNo'),   value: accountNumber, color: undefined },
                        { label: t('withdrawal.confirmAccountName'), value: accountName,   color: undefined },
                      ]),
                  { label: t('withdrawal.confirmProcessing'), value: t('withdrawal.businessDays'), color: undefined },
                ].map(({ label, value, color }) => (
                  <View key={label} style={[s.confirmRow, { borderBottomColor: theme.border }]}>
                    <Text style={[s.confirmLbl, { color: theme.hint }]}>{label}</Text>
                    <Text style={[s.confirmVal, { color: color ?? theme.foreground }]}>{value}</Text>
                  </View>
                ))}
              </View>

              <View style={[s.adminNote, { backgroundColor: accent + '0D', borderColor: accent + '30' }]}>
                <Ionicons name="information-circle-outline" size={16} color={accent} />
                <Text style={[s.adminNoteTxt, { color: theme.hint }]}>
                  {t('withdrawal.adminNoteTxt')}
                </Text>
              </View>

              {/* FIX: Submit button uses accent + accentFg — works for all
                   theme variants without any mode === 'dark' branching.    */}
              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: accent, opacity: submitting ? 0.75 : 1 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color={accentFg} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={accentFg} />
                    <Text style={[s.nextBtnTxt, { color: accentFg }]}>{t('withdrawal.submitWithdrawal')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Recent payouts (step 1 only) */}
          {payoutHistory.length > 0 && step === 1 && (
            <>
              <Text style={[s.sectionLabel, { color: theme.hint, marginTop: 24 }]}>{t('withdrawal.recentWithdrawals')}</Text>
              <View style={[s.historyCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                {payoutHistory.slice(0, 5).map((p, i) => (
                  <View key={p.id ?? i} style={[s.histRow, { borderBottomColor: theme.border, borderBottomWidth: i < 4 ? 1 : 0 }]}>
                    <View style={[s.histIcon, { backgroundColor: accent + '18' }]}>
                      <Ionicons name="cash-outline" size={14} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.histBank, { color: theme.foreground }]}>{banks.find(b => b.code === p.bankCode)?.name ?? p.bankCode}</Text>
                      <Text style={[s.histDate, { color: theme.hint }]}>{new Date(p.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.histAmt, { color: theme.foreground }]}>{formatMoney(p.amount)}</Text>
                      <Text style={[s.histStatus, { color: theme.hint }]}>{p.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Sticky header ──────────────────────────────────────────────────────────
  header:      { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub:   { fontSize: 11, marginTop: 1 },
  stepRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot:     { height: 8, borderRadius: 4 },

  // ── Scroll content ─────────────────────────────────────────────────────────
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