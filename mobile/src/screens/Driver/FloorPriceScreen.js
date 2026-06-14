// mobile/src/screens/Driver/FloorPriceScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Animated, ActivityIndicator, KeyboardAvoidingView,
  Switch, Alert, Keyboard, ScrollView, RefreshControl, Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { driverAPI, rideAPI } from '../../services/api';

const DA         = '#FFB800';
const GREEN      = '#5DAA72';
const RED        = '#E05555';
const MAX_MARKUP = 1.30;
const SAMPLE_KM  = 5;
const H_PAD      = 24;

// ─────────────────────────────────────────────────────────────────────────────
// Fallback rates
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_RATES = {
  CAR:        { baseFare: 500,  perKm: 130, perMinute: 15, minimumFare: 500,  bookingFee: 100 },
  BIKE:       { baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 250,  bookingFee: 50  },
  VAN:        { baseFare: 800,  perKm: 180, perMinute: 20, minimumFare: 1000, bookingFee: 150 },
  MOTORCYCLE: { baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 250,  bookingFee: 50  },
  TRICYCLE:   { baseFare: 300,  perKm: 100, perMinute: 10, minimumFare: 300,  bookingFee: 75  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
const SectionLabel = ({ text, theme }) => (
  <Text style={[sl.txt, { color: theme.hint }]}>{text}</Text>
);
const sl = StyleSheet.create({
  txt: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 12 },
});

const InfoRow = ({ icon, label, value, valueColor, theme }) => (
  <View style={ir.row}>
    <View style={[ir.iconWrap, { backgroundColor: (valueColor || theme.hint) + '18' }]}>
      <Ionicons name={icon} size={15} color={valueColor || theme.hint} />
    </View>
    <Text style={[ir.label, { color: theme.hint }]}>{label}</Text>
    <Text style={[ir.value, { color: valueColor || theme.foreground }]}>{value}</Text>
  </View>
);
const ir = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  label:    { flex: 1, fontSize: 13, fontWeight: '500' },
  value:    { fontSize: 14, fontWeight: '800' },
});

const MarkupBar = ({ pct, theme }) => {
  const ratio = Math.min(pct, 30) / 30;
  const color = pct > 25 ? RED : pct > 15 ? DA : GREEN;
  return (
    <View style={mb.wrap}>
      <View style={[mb.track, { backgroundColor: theme.border }]}>
        <View style={[mb.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[mb.label, { color }]}>
        {pct <= 0 ? 'Platform rate' : `+${pct.toFixed(1)}% above platform`}
      </Text>
    </View>
  );
};
const mb = StyleSheet.create({
  wrap:  { marginBottom: 18 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  fill:  { height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function FloorPriceScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [enabled,     setEnabled]     = useState(false);
  const [floorInput,  setFloorInput]  = useState('');
  const [platformEst, setPlatformEst] = useState(null);
  const [liveRates,   setLiveRates]   = useState(FALLBACK_RATES);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const shakeA = useRef(new Animated.Value(0)).current;

  // ── Derived values ──────────────────────────────────────────────────────────
  const vehicleType    = profile?.vehicleType ?? 'CAR';
  const rate           = liveRates[vehicleType] ?? liveRates.CAR;
  const floorNum       = parseFloat(floorInput) || 0;
  const markupPct      = platformEst ? Math.max(0, ((floorNum - platformEst) / platformEst) * 100) : 0;
  const isClamped      = floorNum > 0 && platformEst && floorNum > platformEst * MAX_MARKUP;
  const clampedMax     = platformEst ? Math.round((platformEst * MAX_MARKUP) / 50) * 50 : 0;
  const effectiveFloor = isClamped ? clampedMax : floorNum;
  const driverEarnings = platformEst
    ? Math.round(
        (effectiveFloor > platformEst ? effectiveFloor : platformEst) - rate.bookingFee -
        ((effectiveFloor > platformEst ? effectiveFloor : platformEst) - rate.bookingFee) * 0.20
      )
    : null;

  // ── Load data ───────────────────────────────────────────────────────────────
  const load = useCallback(async (isPullRefresh = false) => {
    try {
      const [profileRes, ratesRes, estRes] = await Promise.allSettled([
        driverAPI.getProfile(),
        rideAPI.getPlatformRates(),
        rideAPI.getEstimate({
          pickupLat: 6.5244, pickupLng: 3.3792,
          dropoffLat: 6.5689, dropoffLng: 3.3632,
          vehicleType: profile?.vehicleType ?? 'CAR',
        }),
      ]);

      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value?.data?.profile ?? profileRes.value?.data;
        setProfile(p);
        const saved = p?.preferredFloorPrice ?? 0;
        if (saved > 0) { setEnabled(true); setFloorInput(String(saved)); }
      }
      if (ratesRes.status === 'fulfilled') {
        const r = ratesRes.value?.data?.rates;
        if (r && Object.keys(r).length > 0) setLiveRates(r);
      }
      if (estRes.status === 'fulfilled') {
        setPlatformEst(estRes.value?.data?.estimatedFare ?? null);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      if (!isPullRefresh) {
        Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    }
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load(false));
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeA, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    if (enabled && (!floorNum || floorNum < 100)) {
      shake();
      Alert.alert('Invalid Amount', 'Please enter a floor price of at least ₦100.');
      return;
    }
    const saveValue = enabled ? effectiveFloor : 0;
    if (!platformEst && saveValue > 0) {
      Alert.alert('Not ready', 'Platform rates are still loading. Please wait a moment.');
      return;
    }
    setSaving(true);
    try {
      await driverAPI.setFloorMultiplier({
        floorMultiplier: saveValue > 0
          ? parseFloat((saveValue / platformEst).toFixed(6))
          : 1.0,
      });
      Alert.alert(
        saveValue > 0 ? 'Floor Price Set ✅' : 'Floor Price Disabled',
        saveValue > 0
          ? `Customers will see your minimum fare of ₦${saveValue.toLocaleString('en-NG')} when browsing nearby drivers.`
          : 'You will now receive rides at the standard platform rate.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputBg     = darkMode ? 'rgba(255,255,255,0.07)' : '#F2F2F7';
  const inputBorder = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Floor Price</Text>
          <Text style={[s.headerSub,   { color: theme.hint }]}>Set your minimum acceptable fare</Text>
        </View>
        {enabled && floorNum > 0 && (
          <View style={[s.activePill, { backgroundColor: GREEN + '20', borderColor: GREEN + '50' }]}>
            <View style={[s.activeDot, { backgroundColor: GREEN }]} />
            <Text style={[s.activeTxt, { color: GREEN }]}>ACTIVE</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={DA}
            colors={[DA]}
            progressBackgroundColor={darkMode ? '#1C1C1E' : '#FFFFFF'}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={DA} style={{ marginTop: 60 }} />
        ) : (
          <Animated.View style={{ opacity: fadeA }}>

            {/* ── How it works ── */}
            <View style={[s.card, { backgroundColor: inputBg, borderColor: DA + '25' }]}>
              <View style={s.cardTitleRow}>
                <Ionicons name="information-circle" size={16} color={DA} />
                <Text style={[s.cardTitle, { color: DA }]}>How Floor Pricing Works</Text>
              </View>
              <Text style={[s.cardBody, { color: theme.hint }]}>
                When customers browse nearby drivers, they'll see your floor price. If they choose you, the higher of{' '}
                <Text style={{ color: theme.foreground, fontWeight: '700' }}>your floor</Text> or the{' '}
                <Text style={{ color: theme.foreground, fontWeight: '700' }}>platform estimate</Text> is used.
                Maximum markup is <Text style={{ color: DA, fontWeight: '800' }}>+30%</Text> above the platform rate.
              </Text>
            </View>

            {/* ── Toggle ── */}
            <View style={[s.card, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.toggleLabel, { color: theme.foreground }]}>Enable Floor Price</Text>
                  <Text style={[s.toggleSub, { color: theme.hint }]}>
                    {enabled ? 'Your floor price is shown to customers' : 'Accept rides at the platform rate'}
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: theme.border, true: DA + '70' }}
                  thumbColor={enabled ? DA : theme.hint}
                  ios_backgroundColor={theme.border}
                />
              </View>
            </View>

            {/* ── Input ── */}
            {enabled && (
              <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
                <SectionLabel text="YOUR MINIMUM FARE" theme={theme} />
                <View style={[s.inputCard, {
                  backgroundColor: inputBg,
                  borderColor: isClamped ? RED + '60' : floorNum > 0 ? DA + '60' : inputBorder,
                }]}>
                  <Text style={[s.currency, { color: DA }]}>₦</Text>
                  <TextInput
                    style={[s.input, { color: theme.foreground }]}
                    value={floorInput}
                    onChangeText={setFloorInput}
                    keyboardType="numeric"
                    placeholder="e.g. 1500"
                    placeholderTextColor={theme.hint}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    maxLength={6}
                  />
                  {floorNum > 0 && (
                    <TouchableOpacity onPress={() => setFloorInput('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={theme.hint} />
                    </TouchableOpacity>
                  )}
                </View>

                {isClamped && (
                  <View style={[s.clampWarn, { backgroundColor: RED + '12', borderColor: RED + '40' }]}>
                    <Ionicons name="warning-outline" size={14} color={RED} />
                    <Text style={[s.clampTxt, { color: RED }]}>
                      Capped at ₦{clampedMax.toLocaleString('en-NG')} (+30% max). Your effective floor will be ₦{clampedMax.toLocaleString('en-NG')}.
                    </Text>
                  </View>
                )}

                {platformEst && floorNum > 0 && (
                  <MarkupBar pct={markupPct} theme={theme} />
                )}
              </Animated.View>
            )}

            {/* ── Live preview ── */}
            {platformEst && (
              <>
                <SectionLabel text={`EARNINGS PREVIEW • ${SAMPLE_KM}KM ${vehicleType} RIDE`} theme={theme} />
                <View style={[s.card, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <InfoRow
                    icon="calculator-outline"
                    label="Platform estimate"
                    value={`₦${platformEst.toLocaleString('en-NG')}`}
                    valueColor={theme.foreground}
                    theme={theme}
                  />
                  {enabled && effectiveFloor > platformEst && (
                    <InfoRow
                      icon="trending-up-outline"
                      label="Your floor price"
                      value={`₦${effectiveFloor.toLocaleString('en-NG')}`}
                      valueColor={DA}
                      theme={theme}
                    />
                  )}
                  <View style={[s.divider, { backgroundColor: inputBorder }]} />
                  <InfoRow
                    icon="wallet-outline"
                    label="Your net earnings"
                    value={`₦${(driverEarnings ?? 0).toLocaleString('en-NG')}`}
                    valueColor={GREEN}
                    theme={theme}
                  />
                  <Text style={[s.earningsNote, { color: theme.hint }]}>
                    After 20% platform commission + ₦{rate.bookingFee} booking fee. Actual earnings vary with traffic time.
                  </Text>
                </View>
              </>
            )}

            {/* ── Rate table ── */}
            <SectionLabel text="PLATFORM BASE RATES (ADMIN-SET)" theme={theme} />
            <View style={[s.card, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              {Object.entries(liveRates).map(([type, r], i, arr) => (
                <View key={type}>
                  <View style={[s.rateRow, { opacity: type === vehicleType ? 1 : 0.5 }]}>
                    <View style={[s.rateTypePill, {
                      backgroundColor: type === vehicleType ? DA + '20' : inputBorder + '60',
                    }]}>
                      <Text style={[s.rateType, { color: type === vehicleType ? DA : theme.hint }]}>
                        {type}
                      </Text>
                    </View>
                    <Text style={[s.rateVal, { color: theme.foreground }]}>₦{r.baseFare}</Text>
                    <Text style={[s.rateVal, { color: theme.foreground }]}>₦{r.perKm}/km</Text>
                    <Text style={[s.rateVal, { color: theme.foreground }]}>₦{r.perMinute}/min</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: inputBorder }]} />}
                </View>
              ))}
              <Text style={[s.earningsNote, { color: theme.hint, marginTop: 8 }]}>
                Surge multipliers (1.2–1.6×) apply during peak hours. Your floor is applied before surge.
              </Text>
            </View>

            {/* ── Save ── */}
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: DA, opacity: saving ? 0.75 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#080C18" size="small" />
                : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#080C18" />
                    <Text style={s.saveTxt}>{enabled ? 'Save Floor Price' : 'Save (No Floor)'}</Text>
                  </>
                )
              }
            </TouchableOpacity>

          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: H_PAD, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub:   { fontSize: 11, marginTop: 1 },
  activePill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  activeDot:   { width: 6, height: 6, borderRadius: 3 },
  activeTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  scroll:      { paddingHorizontal: H_PAD, paddingTop: 20 },
  card:        { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  cardTitle:   { fontSize: 13, fontWeight: '800' },
  cardBody:    { fontSize: 13, lineHeight: 20 },
  divider:     { height: 1, marginVertical: 10 },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  toggleSub:   { fontSize: 12 },
  inputCard:   { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 14 },
  currency:    { fontSize: 22, fontWeight: '900', marginRight: 6 },
  input:       { flex: 1, fontSize: 28, fontWeight: '900', paddingVertical: 12 },
  clampWarn:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  clampTxt:    { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  rateRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  rateTypePill:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rateType:    { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rateVal:     { flex: 1, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  earningsNote:{ fontSize: 11, lineHeight: 17 },
  saveBtn:     { borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  saveTxt:     { fontSize: 16, fontWeight: '900', color: '#080C18' },
});