// mobile/src/screens/Shared/WalletTopUpScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Animated, ActivityIndicator,
  Alert, Keyboard, Linking,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTheme }        from '../../context/ThemeContext';
import { useAuth }         from '../../context/AuthContext';
import { walletAPI }       from '../../services/api';

const DA     = '#FFB800';
const GREEN  = '#5DAA72';
const PURPLE = '#A78BFA';
const RED    = '#E05555';

const ROLE_COLOR = { DRIVER: DA, DELIVERY_PARTNER: '#34D399', CUSTOMER: '#4E8DBD' };

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

const formatNGN = (n) =>
  Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function WalletTopUpScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();

  const accent = ROLE_COLOR[user?.role] ?? DA;

  const [amount,   setAmount]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const shakeA = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeA, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 5,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleTopUp = async () => {
    Keyboard.dismiss();
    const num = parseFloat(amount);
    if (!num || num < 100) {
      shake();
      Alert.alert('Minimum amount', 'Please enter at least ₦100.');
      return;
    }
    if (num > 1000000) {
      shake();
      Alert.alert('Maximum exceeded', 'Maximum top-up is ₦1,000,000 per transaction.');
      return;
    }

    setLoading(true);
    try {
      // Initialize Paystack payment
      const res = await walletAPI.initializeTopUp({ amount: num });
      const authUrl = res?.data?.authorizationUrl ?? res?.data?.data?.authorization_url;

      if (!authUrl) throw new Error('No payment URL returned');

      // Open Paystack checkout in browser
      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
        // Show success note — Paystack webhook will credit the wallet
        Alert.alert(
          'Payment Initiated 🚀',
          `Complete the payment of ₦${formatNGN(num)} in your browser. Your wallet will be credited automatically within a few seconds.`,
          [{ text: 'Done', onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error('Cannot open payment URL');
      }
    } catch (err) {
      Alert.alert(
        'Top Up Failed',
        err?.response?.data?.message ?? err?.message ?? 'Could not initialize payment. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const amtNum = parseFloat(amount) || 0;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Top Up Wallet</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>Secure payment via Paystack</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Why top up card */}
        <View style={[s.infoCard, { backgroundColor: accent + '0D', borderColor: accent + '30' }]}>
          <Ionicons name="information-circle-outline" size={18} color={accent} />
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: accent }]}>Why top up?</Text>
            <Text style={[s.infoBody, { color: theme.hint }]}>
              {user?.role === 'CUSTOMER'
                ? 'Use your wallet for faster, cashless payments on every ride and delivery.'
                : 'You need a wallet balance ≥ the estimated fare to accept rides or deliveries. This protects customers from cancellations.'}
            </Text>
          </View>
        </View>

        {/* Amount input */}
        <Text style={[s.sectionLabel, { color: theme.hint }]}>ENTER AMOUNT</Text>
        <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
          <View style={[s.inputCard, {
            backgroundColor: theme.backgroundAlt,
            borderColor: amtNum > 0 ? accent + '80' : theme.border,
          }]}>
            <Text style={[s.currency, { color: accent }]}>₦</Text>
            <TextInput
              style={[s.input, { color: theme.foreground }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.hint}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              maxLength={7}
            />
            {amtNum > 0 && (
              <TouchableOpacity onPress={() => setAmount('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={theme.hint} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Quick amounts */}
        <Text style={[s.sectionLabel, { color: theme.hint }]}>QUICK SELECT</Text>
        <View style={s.quickGrid}>
          {QUICK_AMOUNTS.map(q => (
            <TouchableOpacity
              key={q}
              style={[
                s.quickBtn,
                {
                  backgroundColor: parseFloat(amount) === q ? accent : theme.backgroundAlt,
                  borderColor:     parseFloat(amount) === q ? accent : theme.border,
                }
              ]}
              onPress={() => setAmount(String(q))}
              activeOpacity={0.8}
            >
              <Text style={[s.quickTxt, { color: parseFloat(amount) === q ? '#080C18' : theme.foreground }]}>
                ₦{formatNGN(q)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment breakdown */}
        {amtNum >= 100 && (
          <View style={[s.breakdownCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.breakdownRow}>
              <Text style={[s.breakdownLbl, { color: theme.hint }]}>Amount</Text>
              <Text style={[s.breakdownVal, { color: theme.foreground }]}>₦{formatNGN(amtNum)}</Text>
            </View>
            <View style={s.breakdownRow}>
              <Text style={[s.breakdownLbl, { color: theme.hint }]}>Processing fee</Text>
              <Text style={[s.breakdownVal, { color: GREEN }]}>FREE</Text>
            </View>
            <View style={[s.breakdownDivider, { backgroundColor: theme.border }]} />
            <View style={s.breakdownRow}>
              <Text style={[s.breakdownLbl, { color: accent, fontWeight: '800' }]}>Wallet credit</Text>
              <Text style={[s.breakdownVal, { color: accent, fontWeight: '900', fontSize: 16 }]}>
                ₦{formatNGN(amtNum)}
              </Text>
            </View>
          </View>
        )}

        {/* Security note */}
        <View style={[s.securityRow, { borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark-outline" size={14} color={GREEN} />
          <Text style={[s.securityTxt, { color: theme.hint }]}>
            256-bit SSL encryption · Powered by Paystack · PCI-DSS compliant
          </Text>
        </View>

        {/* Pay button */}
        <TouchableOpacity
          style={[s.payBtn, {
            backgroundColor: amtNum >= 100 ? accent : theme.border,
            opacity: loading ? 0.75 : 1,
          }]}
          onPress={handleTopUp}
          disabled={loading || amtNum < 100}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#080C18" size="small" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#080C18" />
              <Text style={s.payBtnTxt}>
                {amtNum >= 100 ? `Pay ₦${formatNGN(amtNum)}` : 'Enter an amount'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
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
  scroll:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  infoCard:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 24 },
  infoTitle:      { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  infoBody:       { fontSize: 12, lineHeight: 18 },
  sectionLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 12 },
  inputCard:      { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 4, marginBottom: 24 },
  currency:       { fontSize: 28, fontWeight: '900', marginRight: 6 },
  input:          { flex: 1, fontSize: 40, fontWeight: '900', paddingVertical: 14 },
  quickGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickBtn:       { borderRadius: 12, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 11 },
  quickTxt:       { fontSize: 14, fontWeight: '700' },
  breakdownCard:  { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 10 },
  breakdownRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLbl:   { fontSize: 13 },
  breakdownVal:   { fontSize: 14, fontWeight: '700' },
  breakdownDivider:{ height: 1, marginVertical: 4 },
  securityRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 14, marginBottom: 20 },
  securityTxt:    { flex: 1, fontSize: 11, lineHeight: 17 },
  payBtn:         { borderRadius: 18, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  payBtnTxt:      { fontSize: 17, fontWeight: '900', color: '#080C18' },
});