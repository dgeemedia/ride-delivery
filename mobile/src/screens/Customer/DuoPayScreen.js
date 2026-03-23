// mobile/src/screens/Customer/DuoPayScreen.js
//
// Main DuoPay screen. Shows:
//  - Eligibility or account status
//  - Credit limit / used / available
//  - Activate flow (Paystack card tokenisation)
//  - Outstanding transactions and repayment
//  - Transaction history

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { duopayAPI, walletAPI } from '../../services/api';

const DUOPAY_GREEN = '#4CAF50';

// ── Credit gauge ──────────────────────────────────────────────────────────────
const CreditGauge = ({ used, limit, theme }) => {
  const pct        = limit > 0 ? Math.min(used / limit, 1) : 0;
  const available  = Math.max(limit - used, 0);
  const barColor   = pct > 0.8 ? '#E05555' : pct > 0.5 ? '#FFB800' : DUOPAY_GREEN;

  return (
    <View style={[cg.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={cg.row}>
        <View>
          <Text style={[cg.label, { color: theme.hint }]}>AVAILABLE CREDIT</Text>
          <Text style={[cg.big, { color: DUOPAY_GREEN }]}>
            ₦{available.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[cg.label, { color: theme.hint }]}>LIMIT</Text>
          <Text style={[cg.limit, { color: theme.foreground }]}>
            ₦{limit.toLocaleString('en-NG')}
          </Text>
        </View>
      </View>
      <View style={[cg.track, { backgroundColor: theme.border }]}>
        <View style={[cg.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <View style={cg.row}>
        <Text style={[cg.small, { color: theme.hint }]}>Used: ₦{used.toLocaleString('en-NG')}</Text>
        <Text style={[cg.small, { color: theme.hint }]}>{(pct * 100).toFixed(0)}% used</Text>
      </View>
    </View>
  );
};
const cg = StyleSheet.create({
  wrap:  { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 20 },
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  big:   { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  limit: { fontSize: 16, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 4 },
  small: { fontSize: 11 },
});

// ── Transaction row ───────────────────────────────────────────────────────────
const TxRow = ({ tx, theme, last }) => {
  const meta = {
    PENDING: { color: '#FFB800', label: 'Due',     icon: 'time-outline' },
    PAID:    { color: DUOPAY_GREEN, label: 'Paid', icon: 'checkmark-circle-outline' },
    OVERDUE: { color: '#E05555', label: 'Overdue', icon: 'alert-circle-outline' },
    WAIVED:  { color: theme.hint, label: 'Waived', icon: 'remove-circle-outline' },
  }[tx.status] ?? { color: theme.hint, label: tx.status, icon: 'help-circle-outline' };

  return (
    <View style={[tr.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[tr.icon, { backgroundColor: meta.color + '18' }]}>
        <Ionicons name={meta.icon} size={16} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[tr.addr, { color: theme.foreground }]} numberOfLines={1}>
          {tx.ride?.pickupAddress ? `Ride — ${tx.ride.pickupAddress.split(',')[0]}` : 'Ride'}
        </Text>
        <Text style={[tr.date, { color: theme.hint }]}>
          Due: {new Date(tx.dueDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
          {tx.paidAt ? `  ·  Paid: ${new Date(tx.paidAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[tr.amount, { color: meta.color }]}>₦{tx.amount.toLocaleString('en-NG')}</Text>
        <View style={[tr.badge, { backgroundColor: meta.color + '15' }]}>
          <Text style={[tr.badgeTxt, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
};
const tr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon:     { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  addr:     { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  date:     { fontSize: 11 },
  amount:   { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  badge:    { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
});

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function DuoPayScreen({ navigation }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();

  const [account,      setAccount]      = useState(null);
  const [eligibility,  setEligibility]  = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [repaying,     setRepaying]     = useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [eligRes, accRes] = await Promise.allSettled([
        duopayAPI.getEligibility(),
        duopayAPI.getAccount(),
      ]);
      if (eligRes.status === 'fulfilled') setEligibility(eligRes.value?.data);
      if (accRes.status  === 'fulfilled') {
        const d = accRes.value?.data;
        if (d?.account) {
          setAccount(d);
          const txRes = await duopayAPI.getTransactions({ limit: 20 });
          setTransactions(txRes?.data?.transactions ?? []);
        }
      }
    } catch {}
    finally {
      setLoading(false);
      Animated.timing(fadeA, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }
  };

  const handleRepay = () => {
    const overdue = account?.overdueAmount ?? 0;
    const balance = account?.account?.usedBalance ?? 0;
    const amount  = overdue > 0 ? overdue : balance;

    if (amount <= 0) {
      Alert.alert('Nothing to repay', 'Your DuoPay balance is clear!');
      return;
    }

    Alert.alert(
      'Repay DuoPay',
      `Pay ₦${amount.toLocaleString('en-NG')} from your wallet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setRepaying(true);
            try {
              await duopayAPI.manualRepay({ amount });
              Alert.alert('✅ Repayment Successful', 'Your DuoPay balance has been updated.');
              fetchData();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message ?? 'Repayment failed.');
            } finally { setRepaying(false); }
          },
        },
      ]
    );
  };

  const accentFg = theme.accentFg ?? '#111';

  if (loading) return (
    <View style={[s.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={DUOPAY_GREEN} size="large" />
    </View>
  );

  const isActive    = account?.account?.status === 'ACTIVE';
  const isSuspended = account?.account?.status === 'SUSPENDED';
  const isDefaulted = account?.account?.status === 'DEFAULTED';
  const hasOverdue  = account?.hasOverdue;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.foreground }]}>DuoPay</Text>
          <Text style={[s.sub, { color: theme.hint }]}>Ride now, pay later</Text>
        </View>
        {isActive && (
          <View style={[s.activeBadge, { backgroundColor: DUOPAY_GREEN + '20', borderColor: DUOPAY_GREEN + '50' }]}>
            <View style={[s.activeDot, { backgroundColor: DUOPAY_GREEN }]} />
            <Text style={[s.activeTxt, { color: DUOPAY_GREEN }]}>ACTIVE</Text>
          </View>
        )}
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeA }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active account */}
        {isActive && account?.account && (
          <>
            <CreditGauge
              used={account.account.usedBalance}
              limit={account.account.creditLimit}
              theme={theme}
            />

            {/* Overdue alert */}
            {hasOverdue && (
              <View style={[s.alertCard, { backgroundColor: '#E0555510', borderColor: '#E05555' }]}>
                <Ionicons name="alert-circle" size={18} color="#E05555" />
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>Overdue Balance</Text>
                  <Text style={[s.alertSub, { color: theme.hint }]}>
                    ₦{account.overdueAmount.toLocaleString('en-NG')} overdue. DuoPay suspended until cleared.
                  </Text>
                </View>
              </View>
            )}

            {/* Repay button */}
            {account.account.usedBalance > 0 && (
              <TouchableOpacity
                style={[s.repayBtn, { backgroundColor: hasOverdue ? '#E05555' : DUOPAY_GREEN, opacity: repaying ? 0.7 : 1 }]}
                onPress={handleRepay}
                disabled={repaying}
              >
                {repaying ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="card-outline" size={18} color="#FFF" />
                    <Text style={s.repayBtnTxt}>
                      {hasOverdue ? 'Clear Overdue Balance' : 'Repay from Wallet'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Info row */}
            <View style={[s.infoRow, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.infoItem}>
                <Text style={[s.infoLabel, { color: theme.hint }]}>REPAYMENT DAY</Text>
                <Text style={[s.infoVal, { color: theme.foreground }]}>
                  {account.account.repaymentDay}{getDaySuffix(account.account.repaymentDay)} of month
                </Text>
              </View>
              <View style={[s.infoDivider, { backgroundColor: theme.border }]} />
              <View style={s.infoItem}>
                <Text style={[s.infoLabel, { color: theme.hint }]}>CARD</Text>
                <Text style={[s.infoVal, { color: theme.foreground }]}>
                  {account.account.cardBrand ?? '—'} ••••{account.account.cardLast4 ?? ''}
                </Text>
              </View>
              <View style={[s.infoDivider, { backgroundColor: theme.border }]} />
              <View style={s.infoItem}>
                <Text style={[s.infoLabel, { color: theme.hint }]}>ON-TIME</Text>
                <Text style={[s.infoVal, { color: DUOPAY_GREEN }]}>{account.account.consecutiveOnTime} 🔥</Text>
              </View>
            </View>
          </>
        )}

        {/* Suspended */}
        {isSuspended && (
          <View style={[s.alertCard, { backgroundColor: '#FFB80010', borderColor: '#FFB800', marginBottom: 20 }]}>
            <Ionicons name="pause-circle" size={18} color="#FFB800" />
            <View style={{ flex: 1 }}>
              <Text style={[s.alertTitle, { color: '#FFB800' }]}>DuoPay Suspended</Text>
              <Text style={[s.alertSub, { color: theme.hint }]}>
                Clear your outstanding balance to reactivate DuoPay.
              </Text>
            </View>
          </View>
        )}

        {/* Not activated — eligibility */}
        {!account?.account && eligibility && (
          <View style={[s.eligCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={[s.eligIcon, { backgroundColor: DUOPAY_GREEN + '15' }]}>
              <Ionicons name="flash" size={28} color={DUOPAY_GREEN} />
            </View>
            <Text style={[s.eligTitle, { color: theme.foreground }]}>DuoPay — Ride Now, Pay Later</Text>
            <Text style={[s.eligSub, { color: theme.hint }]}>
              Start with ₦2,000 credit. Grow to ₦15,000. Repay weekly, automatically.
            </Text>

            {eligibility.eligible ? (
              <>
                <View style={s.eligFeatures}>
                  {[
                    '₦2,000 starting credit, up to ₦15,000',
                    'No interest — flat repayment only',
                    'Auto-debit weekly from your saved card',
                    'Limit grows with on-time repayments',
                  ].map((f, i) => (
                    <View key={i} style={s.eligFeatureRow}>
                      <Ionicons name="checkmark-circle" size={14} color={DUOPAY_GREEN} />
                      <Text style={[s.eligFeatureTxt, { color: theme.hint }]}>{f}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.activateBtn, { backgroundColor: DUOPAY_GREEN }]}
                  onPress={() => navigation.navigate('DuoPayActivate')}
                >
                  <Ionicons name="flash" size={18} color="#FFF" />
                  <Text style={s.activateBtnTxt}>Activate DuoPay</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[s.progressCard, { backgroundColor: DUOPAY_GREEN + '10', borderColor: DUOPAY_GREEN + '40' }]}>
                <Text style={[s.progressTxt, { color: DUOPAY_GREEN }]}>
                  Complete {eligibility.ridesNeeded} more ride{eligibility.ridesNeeded !== 1 ? 's' : ''} to unlock
                </Text>
                <View style={[s.progressTrack, { backgroundColor: theme.border }]}>
                  <View style={[s.progressFill, {
                    width: `${(eligibility.completedRides / 5) * 100}%`,
                    backgroundColor: DUOPAY_GREEN,
                  }]} />
                </View>
                <Text style={[s.progressCount, { color: theme.hint }]}>
                  {eligibility.completedRides} / 5 rides completed
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Transaction history */}
        {transactions.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: theme.hint }]}>TRANSACTION HISTORY</Text>
            <View style={[s.txCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              {transactions.map((tx, i) => (
                <TxRow key={tx.id} tx={tx} theme={theme} last={i === transactions.length - 1} />
              ))}
            </View>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const getDaySuffix = (d) => {
  if (d === 1 || d === 21) return 'st';
  if (d === 2 || d === 22) return 'nd';
  if (d === 3 || d === 23) return 'rd';
  return 'th';
};

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  sub:     { fontSize: 11, fontWeight: '500' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  activeDot:   { width: 7, height: 7, borderRadius: 4 },
  activeTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  scroll:  { paddingHorizontal: 20, paddingTop: 22 },

  alertCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#E05555', marginBottom: 2 },
  alertSub:   { fontSize: 12, lineHeight: 17 },

  repayBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  repayBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFF' },

  infoRow:     { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  infoItem:    { flex: 1, alignItems: 'center', paddingVertical: 12 },
  infoLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  infoVal:     { fontSize: 13, fontWeight: '700' },
  infoDivider: { width: 1 },

  eligCard:     { borderRadius: 18, borderWidth: 1, padding: 20, marginBottom: 24, alignItems: 'center' },
  eligIcon:     { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  eligTitle:    { fontSize: 16, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  eligSub:      { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  eligFeatures: { width: '100%', gap: 10, marginBottom: 20 },
  eligFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eligFeatureTxt: { fontSize: 13 },

  progressCard:  { width: '100%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', gap: 10 },
  progressTxt:   { fontSize: 13, fontWeight: '700' },
  progressTrack: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },
  progressCount: { fontSize: 11 },

  activateBtn:    { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 14 },
  activateBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFF' },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  txCard:       { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, marginBottom: 24 },
});