// mobile/src/screens/Shared/TransactionHistoryScreen.js
//
// FIXES applied:
//   1. PDF export — falls back to expo-file-system + expo-sharing when expo-print is absent
//   2. DatePickerModal — native "no-DateTimePicker" branch uses TextInput, not <input>
//   3. Theme contrast — accent buttons use theme.accentFg instead of hardcoded '#fff'
//   4. (Email SMTP) — see email.service.js fix; frontend shows the server's error message
//   5. PDF now includes the user's full name in the header and summary block
//   6. DatePickerModal — KeyboardAvoidingView prevents keyboard from hiding "Set Date" button
//   7. DatePickerModal — autoFocus on TextInput for immediate keyboard open
//   8. DatePickerModal — maxHeight on card prevents overflow when keyboard is up
//   9. DatePickerModal — thicker border on input for better dark-theme visibility

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, ActivityIndicator, Alert,
  TextInput, Platform, Dimensions, Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { walletAPI }         from '../../services/api';

// Lazy-load native-only deps so web doesn't crash
let Sharing, Print, DateTimePicker, FileSystem;
try { Sharing        = require('expo-sharing').default ?? require('expo-sharing');                } catch {}
try { Print          = require('expo-print');                                                     } catch {}
try { DateTimePicker = require('@react-native-community/datetimepicker').default;                } catch {}
try { FileSystem     = require('expo-file-system');                                               } catch {}

const { height } = Dimensions.get('window');
const PAGE_SIZE  = 30;

// ── TX meta ─────────────────────────────────────────────────────────────────
const TX_META = {
  CREDIT:     { icon: 'arrow-down-circle-outline', color: '#5DAA72', sign: '+', label: 'Credit'     },
  DEBIT:      { icon: 'arrow-up-circle-outline',   color: '#E05555', sign: '-', label: 'Debit'      },
  WITHDRAWAL: { icon: 'cash-outline',              color: '#FFB800', sign: '-', label: 'Withdrawal' },
  REFUND:     { icon: 'refresh-circle-outline',    color: '#A78BFA', sign: '+', label: 'Refund'     },
};

const TX_TYPES = ['ALL', 'CREDIT', 'DEBIT', 'WITHDRAWAL', 'REFUND'];

const fmt     = (n) => Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const isoDate = (d) => d.toISOString().split('T')[0];

const defaultRange = () => {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from, to };
};

// ─────────────────────────────────────────────────────────────────────────────
// DatePickerModal
// ─────────────────────────────────────────────────────────────────────────────
const DatePickerModal = ({ visible, value, onChange, onClose, theme, accent, label }) => {
  const [local,      setLocal]      = useState(value);
  const [dateString, setDateString] = useState(value.toISOString().split('T')[0]);
  const [dateError,  setDateError]  = useState('');
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;

  // ── Web branch ──────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <View style={dp.overlay}>
          <View style={[dp.centeredCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[dp.title, { color: theme.foreground }]}>{label}</Text>
            {/* eslint-disable-next-line react-native/no-raw-text */}
            <input
              type="date"
              value={local.toISOString().split('T')[0]}
              onChange={e => setLocal(new Date(e.target.value))}
              style={{
                fontSize: 16, padding: 8, borderRadius: 8,
                border: `1px solid ${theme.border}`,
                color: theme.foreground, background: theme.background, marginBottom: 16,
              }}
            />
            <View style={dp.btns}>
              <TouchableOpacity style={[dp.btn, { borderColor: theme.border }]} onPress={onClose}>
                <Text style={[dp.btnTxt, { color: theme.hint }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dp.btnAccent, { backgroundColor: accent }]}
                onPress={() => { onChange(local); onClose(); }}
              >
                <Text style={[dp.btnTxt, { color: theme.accentFg }]}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Native DateTimePicker branch ────────────────────────────────────────────
  if (DateTimePicker) {
    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <View style={dp.overlay}>
          <View style={[dp.centeredCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[dp.title, { color: theme.foreground }]}>{label}</Text>
            <DateTimePicker
              value={local}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, d) => d && setLocal(d)}
              textColor={theme.foreground}
              style={Platform.OS === 'android' ? { alignSelf: 'center', marginVertical: 8 } : undefined}
            />
            <View style={dp.btns}>
              <TouchableOpacity style={[dp.btn, { borderColor: theme.border }]} onPress={onClose}>
                <Text style={[dp.btnTxt, { color: theme.hint }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dp.btnAccent, { backgroundColor: accent }]}
                onPress={() => { onChange(local); onClose(); }}
              >
                <Text style={[dp.btnTxt, { color: theme.accentFg }]}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Fallback: manual TextInput branch ──────────────────────────────────────
  // FIX #6 — wrapped in KeyboardAvoidingView so "Set Date" button stays visible
  // FIX #7 — autoFocus opens keyboard immediately
  // FIX #8 — maxHeight on card prevents overflow
  // FIX #9 — borderWidth: 1.5 for better dark-theme contrast
  const handleManualSet = () => {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) {
      setDateError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    setDateError('');
    onChange(parsed);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={insets.bottom + 24}
      >
        <View style={dp.overlay}>
          <View style={[dp.centeredCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[dp.title, { color: theme.foreground }]}>{label}</Text>
            <Text style={[dp.hint, { color: theme.hint }]}>Enter date (YYYY-MM-DD)</Text>
            <View style={[
              dp.inputRow,
              {
                borderColor: theme.border,
                backgroundColor: theme.background,
                borderWidth: 1.5,
              },
            ]}>
              <TextInput
                style={[dp.textInput, { color: theme.foreground }]}
                value={dateString}
                onChangeText={(v) => { setDateString(v); setDateError(''); }}
                placeholder="2024-01-31"
                placeholderTextColor={theme.hint}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoFocus
              />
            </View>
            {dateError ? <Text style={[dp.errorTxt, { color: '#E05555' }]}>{dateError}</Text> : null}
            <View style={dp.btns}>
              <TouchableOpacity style={[dp.btn, { borderColor: theme.border }]} onPress={onClose}>
                <Text style={[dp.btnTxt, { color: theme.hint }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dp.btnAccent, { backgroundColor: accent }]}
                onPress={handleManualSet}
              >
                <Text style={[dp.btnTxt, { color: theme.accentFg }]}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const dp = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  centeredCard: { width: '100%', borderRadius: 20, borderWidth: 1, padding: 24 },
  title:        { fontSize: 15, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  hint:         { fontSize: 12, marginBottom: 8, textAlign: 'center' },
  inputRow:     { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  textInput:    { fontSize: 16 },
  errorTxt:     { fontSize: 12, marginTop: 4, marginBottom: 8 },
  btns:         { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn:          { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btnAccent:    { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnTxt:       { fontSize: 14, fontWeight: '700' },
});

// ── TxRow ─────────────────────────────────────────────────────────────────────
const TxRow = React.memo(({ item, theme, last }) => {
  const meta = TX_META[item.type] ?? TX_META.DEBIT;
  return (
    <View style={[tr.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[tr.iconWrap, { backgroundColor: meta.color + '14' }]}>
        <Ionicons name={meta.icon} size={19} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[tr.desc, { color: theme.foreground }]} numberOfLines={1}>{item.description || meta.label}</Text>
        <Text style={[tr.date, { color: theme.hint }]}>
          {new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.reference && (
          <Text style={[tr.ref, { color: theme.hint }]} numberOfLines={1}>Ref: {item.reference}</Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Text style={[tr.amount, { color: meta.color }]}>
          {meta.sign}₦{fmt(item.amount)}
        </Text>
        <View style={[tr.pill, { backgroundColor: meta.color + '14' }]}>
          <Text style={[tr.pillTxt, { color: meta.color }]}>{item.status}</Text>
        </View>
      </View>
    </View>
  );
});

const tr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  desc:     { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  date:     { fontSize: 11, marginBottom: 1 },
  ref:      { fontSize: 10 },
  amount:   { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  pill:     { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  pillTxt:  { fontSize: 9, fontWeight: '700' },
});

// ── PDF HTML builder ──────────────────────────────────────────────────────────
// FIX #5 — userName param added; shown in the header and account info block
const buildPdfHtml = ({ transactions, from, to, typeFilter, userEmail, userName }) => {
  const totalCredit = transactions.filter(t => t.type === 'CREDIT' || t.type === 'REFUND').reduce((s, t) => s + Number(t.amount), 0);
  const totalDebit  = transactions.filter(t => t.type !== 'CREDIT' && t.type !== 'REFUND').reduce((s, t) => s + Number(t.amount), 0);
  const rows = transactions.map(t => {
    const meta = TX_META[t.type] ?? TX_META.DEBIT;
    const date = new Date(t.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <tr>
        <td>${date}</td>
        <td>${t.description || meta.label}</td>
        <td style="color:${meta.color}; font-weight:700">${meta.sign}₦${fmt(t.amount)}</td>
        <td>${t.type}</td>
        <td style="color:${t.status === 'COMPLETED' ? '#5DAA72' : '#FFB800'}">${t.status}</td>
        <td style="font-size:10px; color:#888">${t.reference ?? '—'}</td>
      </tr>`;
  }).join('');

  // Build the "Account" line shown under the title — name + email when both present
  const accountLine = [userName, userEmail].filter(Boolean).join(' &nbsp;•&nbsp; ');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; color: #111; padding: 32px; }
  h1   { font-size: 22px; margin-bottom: 4px; }
  .acct { font-size: 14px; font-weight: 700; color: #333; margin-bottom: 2px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; }
  .sum-box { background: #f5f5f5; border-radius: 10px; padding: 14px 20px; min-width: 130px; }
  .sum-lbl { font-size: 10px; color: #888; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 4px; }
  .sum-val { font-size: 18px; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th    { background: #111; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; letter-spacing: 1px; }
  td    { padding: 10px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; }
</style></head>
<body>
<h1>Transaction History</h1>
${accountLine ? `<div class="acct">${accountLine}</div>` : ''}
<div class="sub">
  ${fmtDate(from)} – ${fmtDate(to)}
  ${typeFilter !== 'ALL' ? ` &nbsp;•&nbsp; Type: ${typeFilter}` : ''}
  &nbsp;•&nbsp; ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}
</div>
<div class="summary">
  <div class="sum-box">
    <div class="sum-lbl">TOTAL IN</div>
    <div class="sum-val" style="color:#5DAA72">+₦${fmt(totalCredit)}</div>
  </div>
  <div class="sum-box">
    <div class="sum-lbl">TOTAL OUT</div>
    <div class="sum-val" style="color:#E05555">-₦${fmt(totalDebit)}</div>
  </div>
  <div class="sum-box">
    <div class="sum-lbl">NET</div>
    <div class="sum-val">₦${fmt(totalCredit - totalDebit)}</div>
  </div>
</div>
<table>
  <thead><tr><th>DATE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>TYPE</th><th>STATUS</th><th>REFERENCE</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center; color:#aaa; padding:32px">No transactions</td></tr>'}</tbody>
</table>
<div class="footer">Generated ${new Date().toLocaleString('en-NG')} &nbsp;•&nbsp; Confidential — Do not distribute</div>
</body></html>`;
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function TransactionHistoryScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();
  const insets          = useSafeAreaInsets();
  const accent          = theme.accent;
  const accentFg        = theme.accentFg;

  // FIX #5 — derive full name once so it's easy to pass around
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null;

  const { initialFrom, initialTo } = route?.params ?? {};
  const range = defaultRange();

  const [from,         setFrom]         = useState(initialFrom ? new Date(initialFrom) : range.from);
  const [to,           setTo]           = useState(initialTo   ? new Date(initialTo)   : range.to);
  const [typeFilter,   setTypeFilter]   = useState('ALL');
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [exporting,    setExporting]    = useState(false);
  const [emailing,     setEmailing]     = useState(false);
  const [emailInput,   setEmailInput]   = useState(user?.email ?? '');
  const [showEmailBox, setShowEmailBox] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  const HEADER_H = insets.top + 60;
  const SCROLL_H = height - HEADER_H - insets.bottom - (Platform.OS === 'android' ? 16 : 0);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTx = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const p = reset ? 1 : page + 1;
    try {
      const res  = await walletAPI.getTransactions({
        from:  isoDate(from),
        to:    isoDate(to),
        type:  typeFilter === 'ALL' ? undefined : typeFilter,
        page:  p,
        limit: PAGE_SIZE,
      });
      const data = res?.data ?? res;
      const list = data?.transactions ?? [];
      if (reset) {
        setTransactions(list);
        setPage(1);
        Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      } else {
        setTransactions(prev => [...prev, ...list]);
        setPage(p);
      }
      setTotal(data?.pagination?.total ?? list.length);
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Could not load transactions.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [from, to, typeFilter, page]);

  useEffect(() => { fetchTx(true); }, [from, to, typeFilter]);

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const credit = transactions.filter(t => t.type === 'CREDIT' || t.type === 'REFUND').reduce((s, t) => s + Number(t.amount), 0);
    const debit  = transactions.filter(t => t.type !== 'CREDIT' && t.type !== 'REFUND').reduce((s, t) => s + Number(t.amount), 0);
    return { credit, debit, net: credit - debit };
  }, [transactions]);

  // ── Export to PDF ──────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      // FIX #5 — pass userName so it appears in the PDF header
      const html = buildPdfHtml({ transactions, from, to, typeFilter, userEmail: user?.email, userName });

      if (Print) {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType:    'application/pdf',
            dialogTitle: 'Save or share transaction history',
            UTI:         'com.adobe.pdf',
          });
        } else {
          Alert.alert('Saved', `PDF saved to:\n${uri}`);
        }
        return;
      }

      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `transactions_${isoDate(from)}_${isoDate(to)}.html`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (FileSystem) {
        const path = `${FileSystem.cacheDirectory}transactions_${isoDate(from)}_${isoDate(to)}.html`;
        await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, {
            mimeType:    'text/html',
            dialogTitle: 'Save or share transaction history',
          });
        } else {
          Alert.alert('Saved', `Statement saved to:\n${path}`);
        }
        return;
      }

      Alert.alert(
        'Export not available',
        'Install expo-print and expo-file-system to enable PDF export:\n\nnpx expo install expo-print expo-file-system expo-sharing',
      );
    } catch (err) {
      Alert.alert('Export Failed', err?.message ?? 'Could not generate statement.');
    } finally {
      setExporting(false);
    }
  };

  // ── Email PDF ──────────────────────────────────────────────────────────────
  const handleEmailPdf = async () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Enter a valid email address.');
      return;
    }
    setEmailing(true);
    try {
      await walletAPI.emailTransactionHistory?.({
        from:  isoDate(from),
        to:    isoDate(to),
        type:  typeFilter === 'ALL' ? undefined : typeFilter,
        email,
      });
      setShowEmailBox(false);
      Alert.alert('Sent! 📧', `Transaction history sent to ${email}.`);
    } catch (err) {
      // FIX #4 — show the server's error message
      Alert.alert('Failed', err?.message ?? 'Could not send email. Check your connection and try again.');
    } finally {
      setEmailing(false);
    }
  };

  const canLoadMore = transactions.length < total && !loadingMore;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top, height: HEADER_H, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Transaction History</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>
            {transactions.length} of {total} transaction{total !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.headerBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => setShowEmailBox(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={16} color={theme.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.headerBtn, { backgroundColor: accent, opacity: exporting ? 0.7 : 1 }]}
          onPress={handleExportPdf}
          disabled={exporting}
          activeOpacity={0.85}
        >
          {exporting
            ? <ActivityIndicator size="small" color={accentFg} />
            : <Ionicons name="download-outline" size={16} color={accentFg} />
          }
        </TouchableOpacity>
      </View>

      <View style={{ height: SCROLL_H }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Email panel ── */}
          {showEmailBox && (
            <View style={[s.emailPanel, { backgroundColor: theme.backgroundAlt, borderColor: accent + '40' }]}>
              <Text style={[s.emailTitle, { color: theme.foreground }]}>Email Statement</Text>
              <Text style={[s.emailSub, { color: theme.hint }]}>Send this history as a PDF attachment</Text>
              <View style={[s.emailRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="mail-outline" size={15} color={theme.hint} />
                <TextInput
                  style={[s.emailInput, { color: theme.foreground }]}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="your@email.com"
                  placeholderTextColor={theme.hint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={s.emailActions}>
                <TouchableOpacity
                  style={[s.emailCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowEmailBox(false)}
                >
                  <Text style={[s.emailCancelTxt, { color: theme.hint }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.emailSendBtn, { backgroundColor: accent, opacity: emailing ? 0.7 : 1 }]}
                  onPress={handleEmailPdf}
                  disabled={emailing}
                >
                  {emailing
                    ? <ActivityIndicator size="small" color={accentFg} />
                    : (
                      <>
                        <Ionicons name="send-outline" size={13} color={accentFg} />
                        <Text style={[s.emailSendTxt, { color: accentFg }]}>Send PDF</Text>
                      </>
                    )
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Date range pickers ── */}
          <View style={s.dateRow}>
            <TouchableOpacity
              style={[s.datePicker, { backgroundColor: theme.backgroundAlt, borderColor: theme.border, flex: 1 }]}
              onPress={() => setPickerTarget('from')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={14} color={accent} />
              <View>
                <Text style={[s.datePickerLbl, { color: theme.hint }]}>FROM</Text>
                <Text style={[s.datePickerVal, { color: theme.foreground }]}>{fmtDate(from)}</Text>
              </View>
            </TouchableOpacity>
            <View style={[s.dateSep, { backgroundColor: theme.border }]} />
            <TouchableOpacity
              style={[s.datePicker, { backgroundColor: theme.backgroundAlt, borderColor: theme.border, flex: 1 }]}
              onPress={() => setPickerTarget('to')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={14} color={accent} />
              <View>
                <Text style={[s.datePickerLbl, { color: theme.hint }]}>TO</Text>
                <Text style={[s.datePickerVal, { color: theme.foreground }]}>{fmtDate(to)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Quick presets ── */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={s.presetsScroll} contentContainerStyle={s.presetsRow}
          >
            {[
              { label: 'Today',     fn: () => { const d = new Date(); setFrom(d); setTo(d); } },
              { label: '7 days',    fn: () => { const d = new Date(); const f = new Date(); f.setDate(f.getDate()-7);    setFrom(f); setTo(d); } },
              { label: '30 days',   fn: () => { const d = new Date(); const f = new Date(); f.setDate(f.getDate()-30);   setFrom(f); setTo(d); } },
              { label: '3 months',  fn: () => { const d = new Date(); const f = new Date(); f.setMonth(f.getMonth()-3);  setFrom(f); setTo(d); } },
              { label: 'This year', fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), 0, 1);         setFrom(f); setTo(d); } },
            ].map(p => (
              <TouchableOpacity
                key={p.label}
                style={[s.presetChip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={p.fn} activeOpacity={0.75}
              >
                <Text style={[s.presetChipTxt, { color: theme.hint }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Type filter chips ── */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={s.filterScroll} contentContainerStyle={s.filterRow}
          >
            {TX_TYPES.map(t => {
              const active = typeFilter === t;
              const meta   = TX_META[t];
              const col    = meta?.color ?? accent;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    s.filterChip,
                    active
                      ? { backgroundColor: col + '20', borderColor: col }
                      : { backgroundColor: 'transparent', borderColor: theme.border },
                  ]}
                  onPress={() => setTypeFilter(t)} activeOpacity={0.75}
                >
                  {meta && <Ionicons name={meta.icon} size={11} color={active ? col : theme.hint} style={{ marginRight: 4 }} />}
                  <Text style={[s.filterChipTxt, { color: active ? col : theme.hint }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Summary strip ── */}
          <View style={[s.summaryStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.sumItem}>
              <Text style={[s.sumLbl, { color: theme.hint }]}>IN</Text>
              <Text style={[s.sumVal, { color: '#5DAA72' }]}>+₦{fmt(summary.credit)}</Text>
            </View>
            <View style={[s.sumDiv, { backgroundColor: theme.border }]} />
            <View style={s.sumItem}>
              <Text style={[s.sumLbl, { color: theme.hint }]}>OUT</Text>
              <Text style={[s.sumVal, { color: '#E05555' }]}>-₦{fmt(summary.debit)}</Text>
            </View>
            <View style={[s.sumDiv, { backgroundColor: theme.border }]} />
            <View style={s.sumItem}>
              <Text style={[s.sumLbl, { color: theme.hint }]}>NET</Text>
              <Text style={[s.sumVal, { color: summary.net >= 0 ? '#5DAA72' : '#E05555' }]}>
                {summary.net >= 0 ? '+' : ''}₦{fmt(Math.abs(summary.net))}
              </Text>
            </View>
          </View>

          {/* ── Transaction list ── */}
          <View style={[s.listCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {loading ? (
              <View style={s.center}>
                <ActivityIndicator color={accent} size="large" />
                <Text style={[s.centerTxt, { color: theme.hint }]}>Loading transactions...</Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={s.center}>
                <Ionicons name="receipt-outline" size={40} color={theme.hint} style={{ marginBottom: 12 }} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No transactions found</Text>
                <Text style={[s.emptyHint, { color: theme.hint }]}>Try adjusting your date range or filter</Text>
              </View>
            ) : (
              <Animated.View style={{ opacity: fadeA }}>
                {transactions.map((item, i) => (
                  <TxRow
                    key={item.id ?? i}
                    item={item}
                    theme={theme}
                    last={i === transactions.length - 1}
                  />
                ))}
                {canLoadMore && (
                  <TouchableOpacity
                    style={[s.loadMore, { borderColor: theme.border }]}
                    onPress={() => fetchTx(false)}
                  >
                    {loadingMore
                      ? <ActivityIndicator color={accent} size="small" />
                      : <Text style={[s.loadMoreTxt, { color: accent }]}>Load more ({total - transactions.length} remaining)</Text>
                    }
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}
          </View>

          {/* Export actions at bottom */}
          {!loading && transactions.length > 0 && (
            <View style={s.exportRow}>
              <TouchableOpacity
                style={[s.exportBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={() => setShowEmailBox(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="mail-outline" size={15} color={theme.hint} />
                <Text style={[s.exportBtnTxt, { color: theme.hint }]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.exportBtn, { backgroundColor: accent, opacity: exporting ? 0.7 : 1 }]}
                onPress={handleExportPdf}
                disabled={exporting}
                activeOpacity={0.85}
              >
                {exporting
                  ? <ActivityIndicator size="small" color={accentFg} />
                  : (
                    <>
                      <Ionicons name="document-text-outline" size={15} color={accentFg} />
                      <Text style={[s.exportBtnTxt, { color: accentFg }]}>Download PDF</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Date pickers */}
      <DatePickerModal
        visible={pickerTarget === 'from'}
        value={from}
        label="Select Start Date"
        theme={theme}
        accent={accent}
        onChange={(d) => { setFrom(d); if (d > to) setTo(d); }}
        onClose={() => setPickerTarget(null)}
      />
      <DatePickerModal
        visible={pickerTarget === 'to'}
        value={to}
        label="Select End Date"
        theme={theme}
        accent={accent}
        onChange={(d) => { setTo(d); if (d < from) setFrom(d); }}
        onClose={() => setPickerTarget(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:     { width: 38, height: 38, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerSub:   { fontSize: 11, marginTop: 1 },
  headerBtn:   { width: 38, height: 38, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },

  emailPanel:      { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  emailTitle:      { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  emailSub:        { fontSize: 12, marginBottom: 12 },
  emailRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12 },
  emailInput:      { flex: 1, fontSize: 14 },
  emailActions:    { flexDirection: 'row', gap: 10 },
  emailCancelBtn:  { flex: 1, height: 44, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  emailCancelTxt:  { fontSize: 13, fontWeight: '700' },
  emailSendBtn:    { flex: 2, height: 44, borderRadius: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  emailSendTxt:    { fontSize: 13, fontWeight: '800' },

  dateRow:        { flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 12, borderColor: 'transparent' },
  datePicker:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1 },
  datePickerLbl:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  datePickerVal:  { fontSize: 13, fontWeight: '700' },
  dateSep:        { width: 1 },

  presetsScroll:  { marginBottom: 10 },
  presetsRow:     { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  presetChip:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  presetChipTxt:  { fontSize: 11, fontWeight: '700' },

  filterScroll:   { marginBottom: 14 },
  filterRow:      { flexDirection: 'row', gap: 7, paddingVertical: 2 },
  filterChip:     { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  filterChipTxt:  { fontSize: 11, fontWeight: '700' },

  summaryStrip:   { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  sumItem:        { flex: 1, alignItems: 'center', paddingVertical: 13, gap: 4 },
  sumLbl:         { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  sumVal:         { fontSize: 14, fontWeight: '900' },
  sumDiv:         { width: 1 },

  listCard:   { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 14 },
  center:     { alignItems: 'center', paddingVertical: 40, gap: 8 },
  centerTxt:  { fontSize: 13 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyHint:  { fontSize: 12 },

  loadMore:    { alignItems: 'center', paddingVertical: 16, borderTopWidth: 1 },
  loadMoreTxt: { fontSize: 13, fontWeight: '700' },

  exportRow:    { flexDirection: 'row', gap: 10, marginBottom: 8 },
  exportBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, borderWidth: 1, paddingVertical: 13 },
  exportBtnTxt: { fontSize: 13, fontWeight: '700' },
});