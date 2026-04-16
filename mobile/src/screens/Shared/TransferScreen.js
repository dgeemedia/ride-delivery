// mobile/src/screens/Shared/TransferScreen.js
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Animated, ActivityIndicator,
  Alert, Keyboard, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { walletAPI } from '../../services/api';

const formatNGN = (n) =>
  Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

// ── Step indicator ────────────────────────────────────────────────────────────
const StepDots = ({ current, accent, border }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    {[1, 2, 3].map(n => (
      <View
        key={n}
        style={{
          height: 8,
          width: n === current ? 20 : 8,
          borderRadius: 4,
          backgroundColor: n <= current ? accent : border,
        }}
      />
    ))}
  </View>
);

export default function TransferScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const accent   = theme.accent;
  const isDark   = mode === 'dark';

  // Form state
  const [step,          setStep]          = useState(1);
  const [recipientPhone,setRecipientPhone]= useState('');
  const [recipientInfo, setRecipientInfo] = useState(null); // { name, phone }
  const [amount,        setAmount]        = useState('');
  const [note,          setNote]          = useState('');
  const [walletBalance, setWalletBalance] = useState(null);
  const [lookingUp,     setLookingUp]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  const shakeA = useRef(new Animated.Value(0)).current;
  const phoneRef = useRef(null);

  // Load balance once
  React.useEffect(() => {
    walletAPI.getWallet()
      .then(r => setWalletBalance(r?.data?.wallet?.balance ?? r?.data?.balance ?? 0))
      .catch(() => {});
  }, []);

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeA, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 4,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();

  // ── Step 1 — Recipient lookup ────────────────────────────────────────────
  const lookUpRecipient = useCallback(async () => {
    Keyboard.dismiss();
    const phone = recipientPhone.trim();
    if (phone.length < 10) {
      shake();
      Alert.alert('Invalid number', 'Enter a valid Nigerian phone number.');
      return;
    }
    setLookingUp(true);
    try {
      // walletAPI.lookupUser searches by phone and returns basic user info
      const res = await walletAPI.lookupUser(phone);
      const user = res?.data?.user;
      if (!user) throw new Error('User not found');
      setRecipientInfo({ name: `${user.firstName} ${user.lastName}`, phone });
      setStep(2);
    } catch (err) {
      shake();
      Alert.alert('User Not Found', err?.response?.data?.message ?? 'No account linked to this number.');
    } finally {
      setLookingUp(false);
    }
  }, [recipientPhone]);

  // ── Step 2 — Amount entry ────────────────────────────────────────────────
  const handleAmountNext = () => {
    Keyboard.dismiss();
    const num = parseFloat(amount);
    if (!num || num < 50) { shake(); Alert.alert('Minimum', 'Minimum transfer is ₦50.'); return; }
    if (num > (walletBalance ?? 0)) {
      shake();
      Alert.alert('Insufficient Balance', `Your balance is ₦${formatNGN(walletBalance ?? 0)}.`);
      return;
    }
    setStep(3);
  };

  // ── Step 3 — Confirm & submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await walletAPI.transfer({
        recipientPhone: recipientInfo.phone,
        amount: parseFloat(amount),
        note: note.trim() || undefined,
      });
      Alert.alert(
        'Transfer Submitted ✅',
        `₦${formatNGN(parseFloat(amount))} to ${recipientInfo.name} is pending admin approval.\n\nFunds are held from your balance and will be released to the recipient once approved.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Transfer Failed', err?.response?.data?.message ?? 'Could not submit transfer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const amtNum  = parseFloat(amount) || 0;
  const balance = walletBalance ?? 0;

  const btnBg   = isDark ? '#FFFFFF' : accent;
  const btnText = isDark ? '#000000' : '#FFFFFF';

  const headerSub = step === 1 ? 'Find recipient' : step === 2 ? 'Enter amount' : 'Confirm transfer';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => step > 1 ? setStep(p => p - 1) : navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Send Money</Text>
          <Text style={[s.headerSub,   { color: theme.hint }]}>{headerSub}</Text>
        </View>
        <StepDots current={step} accent={accent} border={theme.border} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Admin-approval notice */}
        <View style={[s.noticeCard, { backgroundColor: accent + '10', borderColor: accent + '30' }]}>
          <Ionicons name="shield-checkmark-outline" size={15} color={accent} />
          <Text style={[s.noticeTxt, { color: theme.hint }]}>
            Transfers are reviewed by admin before the recipient receives funds. Your balance is held instantly.
          </Text>
        </View>

        {/* Balance pill */}
        <View style={[s.balancePill, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <Text style={[s.balanceLbl, { color: theme.hint }]}>Balance</Text>
          <Text style={[s.balanceAmt, { color: accent }]}>₦{formatNGN(balance)}</Text>
        </View>

        <Animated.View style={{ transform: [{ translateX: shakeA }] }}>

          {/* ── STEP 1: Phone lookup ─────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Text style={[s.label, { color: theme.hint }]}>RECIPIENT'S PHONE NUMBER</Text>
              <View style={[s.fieldCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="call-outline" size={16} color={theme.hint} />
                <TextInput
                  ref={phoneRef}
                  style={[s.field, { color: theme.foreground }]}
                  value={recipientPhone}
                  onChangeText={t => setRecipientPhone(t.replace(/\D/g, '').slice(0, 11))}
                  keyboardType="phone-pad"
                  placeholder="08012345678"
                  placeholderTextColor={theme.hint}
                  maxLength={11}
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={lookUpRecipient}
                />
                {recipientPhone.length > 0 && (
                  <TouchableOpacity onPress={() => setRecipientPhone('')}>
                    <Ionicons name="close-circle" size={18} color={theme.hint} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={[s.infoBox, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={s.infoRow}>
                  <Ionicons name="people-outline" size={13} color={theme.hint} />
                  <Text style={[s.infoTxt, { color: theme.hint }]}>Recipient must have a registered account</Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="lock-closed-outline" size={13} color={theme.hint} />
                  <Text style={[s.infoTxt, { color: theme.hint }]}>Transfer requires admin approval (1–2 hrs)</Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="cash-outline" size={13} color={accent} />
                  <Text style={[s.infoTxt, { color: theme.hint }]}>Minimum ₦50 • No fee</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.nextBtn, {
                  backgroundColor: recipientPhone.length >= 10 ? accent : theme.border,
                  opacity: lookingUp ? 0.7 : 1,
                }]}
                onPress={lookUpRecipient}
                disabled={recipientPhone.length < 10 || lookingUp}
              >
                {lookingUp
                  ? <ActivityIndicator color={recipientPhone.length >= 10 ? '#fff' : theme.hint} />
                  : <Text style={[s.nextBtnTxt, { color: recipientPhone.length >= 10 ? '#fff' : theme.hint }]}>
                      Find Recipient →
                    </Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Amount ───────────────────────────────────────────── */}
          {step === 2 && (
            <View>
              {/* Recipient badge */}
              <View style={[s.recipientBadge, { backgroundColor: '#5DAA7212', borderColor: '#5DAA7240' }]}>
                <View style={[s.recipientAvatar, { backgroundColor: accent + '20' }]}>
                  <Ionicons name="person" size={18} color={accent} />
                </View>
                <View>
                  <Text style={[s.recipientName, { color: theme.foreground }]}>{recipientInfo?.name}</Text>
                  <Text style={[s.recipientPhone, { color: theme.hint }]}>{recipientInfo?.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(1)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="pencil-outline" size={14} color={theme.hint} />
                </TouchableOpacity>
              </View>

              <Text style={[s.label, { color: theme.hint }]}>AMOUNT TO SEND</Text>
              <View style={[s.amountCard, {
                backgroundColor: theme.backgroundAlt,
                borderColor: amtNum > 0 ? accent + '70' : theme.border,
              }]}>
                <Text style={[s.currencySymbol, { color: accent }]}>₦</Text>
                <TextInput
                  style={[s.amountInput, { color: theme.foreground }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.hint}
                  maxLength={7}
                  autoFocus
                />
                {amtNum > 0 && (
                  <TouchableOpacity onPress={() => setAmount('')}>
                    <Ionicons name="close-circle" size={20} color={theme.hint} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.quickGrid}>
                {QUICK_AMOUNTS.map(q => {
                  const sel = parseFloat(amount) === q;
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[s.quickBtn, {
                        backgroundColor: sel ? accent : theme.backgroundAlt,
                        borderColor:     sel ? accent : theme.border,
                      }]}
                      onPress={() => setAmount(String(q))}
                    >
                      <Text style={[s.quickTxt, { color: sel ? '#fff' : theme.foreground }]}>
                        ₦{q.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Note field */}
              <Text style={[s.label, { color: theme.hint }]}>NOTE (OPTIONAL)</Text>
              <View style={[s.noteField, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <TextInput
                  style={[s.field, { color: theme.foreground }]}
                  value={note}
                  onChangeText={t => setNote(t.slice(0, 200))}
                  placeholder="What's this for?"
                  placeholderTextColor={theme.hint}
                  multiline
                  returnKeyType="done"
                />
              </View>

              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: amtNum >= 50 && amtNum <= balance ? accent : theme.border }]}
                onPress={handleAmountNext}
                disabled={amtNum < 50 || amtNum > balance}
              >
                <Text style={[s.nextBtnTxt, { color: amtNum >= 50 && amtNum <= balance ? '#fff' : theme.hint }]}>
                  Review →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 3: Confirm ──────────────────────────────────────────── */}
          {step === 3 && (
            <View>
              <View style={[s.confirmCard, { backgroundColor: theme.backgroundAlt, borderColor: accent + '30' }]}>
                <Text style={[s.confirmTitle, { color: theme.foreground }]}>Review Transfer</Text>

                {[
                  { label: 'To',           value: recipientInfo?.name,           color: accent },
                  { label: 'Phone',         value: recipientInfo?.phone,          color: undefined },
                  { label: 'Amount',        value: `₦${formatNGN(amtNum)}`,       color: accent },
                  { label: 'Fee',           value: 'FREE',                        color: '#5DAA72' },
                  { label: 'They receive',  value: `₦${formatNGN(amtNum)}`,       color: accent },
                  ...(note ? [{ label: 'Note', value: note, color: undefined }] : []),
                ].map(({ label, value, color }) => (
                  <View key={label} style={[s.confirmRow, { borderBottomColor: theme.border }]}>
                    <Text style={[s.confirmLbl, { color: theme.hint }]}>{label}</Text>
                    <Text style={[s.confirmVal, { color: color ?? theme.foreground }]} numberOfLines={2}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[s.pendingNote, { backgroundColor: '#A78BFA0D', borderColor: '#A78BFA30' }]}>
                <Ionicons name="time-outline" size={16} color={theme.accent} />
                <Text style={[s.pendingNoteTxt, { color: theme.hint }]}>
                  This transfer will be held and reviewed by our team. The recipient will be credited once approved — typically within 1–2 hours.
                </Text>
              </View>

              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: btnBg, opacity: submitting ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={btnText} />
                  : <>
                      <Ionicons name="paper-plane-outline" size={18} color={btnText} />
                      <Text style={[s.nextBtnTxt, { color: btnText }]}>Send ₦{formatNGN(amtNum)}</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:        { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:    { fontSize: 17, fontWeight: '900' },
  headerSub:      { fontSize: 11, marginTop: 1 },
  scroll:         { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },

  noticeCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  noticeTxt:      { flex: 1, fontSize: 12, lineHeight: 18 },

  balancePill:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 22 },
  balanceLbl:     { fontSize: 11, fontWeight: '600' },
  balanceAmt:     { fontSize: 16, fontWeight: '900' },

  label:          { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 },

  fieldCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 18 },
  field:          { flex: 1, fontSize: 15, fontWeight: '600' },

  infoBox:        { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 22 },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTxt:        { fontSize: 12, flex: 1 },

  recipientBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  recipientAvatar:{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  recipientName:  { fontSize: 14, fontWeight: '800' },
  recipientPhone: { fontSize: 11, marginTop: 2 },

  amountCard:     { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 18 },
  currencySymbol: { fontSize: 28, fontWeight: '900', marginRight: 6 },
  amountInput:    { flex: 1, fontSize: 38, fontWeight: '900', paddingVertical: 14 },

  quickGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  quickBtn:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  quickTxt:       { fontSize: 13, fontWeight: '700' },

  noteField:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 22, minHeight: 60 },

  confirmCard:    { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 16 },
  confirmTitle:   { fontSize: 15, fontWeight: '900', marginBottom: 14 },
  confirmRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1 },
  confirmLbl:     { fontSize: 13, flex: 1 },
  confirmVal:     { fontSize: 14, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },

  pendingNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  pendingNoteTxt: { flex: 1, fontSize: 12, lineHeight: 18 },

  nextBtn:        { borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextBtnTxt:     { fontSize: 16, fontWeight: '900' },
});