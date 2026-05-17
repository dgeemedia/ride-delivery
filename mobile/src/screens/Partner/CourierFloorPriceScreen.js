// mobile/src/screens/Partner/CourierFloorPriceScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Animated, ActivityIndicator,
  Switch, Alert, Keyboard,
} from 'react-native';
import AnimatedRN, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useScrollY }        from '../../context/ScrollContext';
import { partnerAPI, rideAPI } from '../../services/api';

const COURIER_ACCENT = '#34D399';
const GREEN          = '#5DAA72';
const RED            = '#E05555';
const MAX_MARKUP     = 1.30;
const SAMPLE_KM      = 5;
const SAMPLE_WEIGHT  = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Fallback delivery rates (used only if API call fails)
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_DELIVERY = {
  baseFee:        500,
  perKm:          80,
  weightFeePerKg: 50,
};

// Per-vehicle booking fees (not in delivery settings, come from ride rates)
const FALLBACK_BOOKING_FEES = {
  BIKE:       50,
  MOTORCYCLE: 50,
  CAR:        100,
  VAN:        150,
};

// ─────────────────────────────────────────────────────────────────────────────
// Fee calculator — uses live rates from backend
// ─────────────────────────────────────────────────────────────────────────────
const calcDeliveryFee = (km, kg = 0, deliveryRates = FALLBACK_DELIVERY) => {
  const fee = deliveryRates.baseFee + km * deliveryRates.perKm + kg * deliveryRates.weightFeePerKg;
  return Math.round(fee / 50) * 50;
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
  const color = pct > 25 ? RED : pct > 15 ? '#FFB800' : GREEN;
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
export default function CourierFloorPriceScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const scrollY         = useScrollY();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [enabled,        setEnabled]        = useState(false);
  const [floorInput,     setFloorInput]     = useState('');
  const [platformEst,    setPlatformEst]    = useState(null);
  const [deliveryRates,  setDeliveryRates]  = useState(FALLBACK_DELIVERY);
  const [bookingFees,    setBookingFees]    = useState(FALLBACK_BOOKING_FEES);
  const [commissionRate, setCommissionRate] = useState(0.15);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const shakeA = useRef(new Animated.Value(0)).current;

  const vehicleType = profile?.vehicleType ?? 'BIKE';
  const bookingFee  = bookingFees[vehicleType] ?? 50;

  const load = useCallback(async () => {
    try {
      const [profileRes, ratesRes] = await Promise.allSettled([
        partnerAPI.getProfile(),
        rideAPI.getPlatformRates(),
      ]);

      let resolvedVehicleType = 'BIKE';

      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value?.data?.profile ?? profileRes.value?.data;
        setProfile(p);
        resolvedVehicleType = p?.vehicleType ?? 'BIKE';
        const saved = p?.preferredFloorPrice ?? 0;
        if (saved > 0) { setEnabled(true); setFloorInput(String(saved)); }
      }

      // Apply live admin-set rates
      if (ratesRes.status === 'fulfilled') {
        const { rates, delivery } = ratesRes.value?.data ?? {};

        if (delivery) {
          setDeliveryRates({
            baseFee:        delivery.baseFee        ?? FALLBACK_DELIVERY.baseFee,
            perKm:          delivery.perKm          ?? FALLBACK_DELIVERY.perKm,
            weightFeePerKg: delivery.weightFeePerKg ?? FALLBACK_DELIVERY.weightFeePerKg,
          });
          if (delivery.platformCommission) setCommissionRate(delivery.platformCommission);
        }

        // Extract booking fees per vehicle type from ride rates
        if (rates) {
          setBookingFees({
            BIKE:       rates.BIKE?.bookingFee       ?? 50,
            MOTORCYCLE: rates.MOTORCYCLE?.bookingFee ?? 50,
            CAR:        rates.CAR?.bookingFee        ?? 100,
            VAN:        rates.VAN?.bookingFee        ?? 150,
          });
        }

        // Compute platform estimate from live rates
        const dr = delivery ?? FALLBACK_DELIVERY;
        const est = calcDeliveryFee(SAMPLE_KM, SAMPLE_WEIGHT, {
          baseFee:        dr.baseFee        ?? FALLBACK_DELIVERY.baseFee,
          perKm:          dr.perKm          ?? FALLBACK_DELIVERY.perKm,
          weightFeePerKg: dr.weightFeePerKg ?? FALLBACK_DELIVERY.weightFeePerKg,
        });
        setPlatformEst(est);
      } else {
        // Fallback estimate
        setPlatformEst(calcDeliveryFee(SAMPLE_KM, SAMPLE_WEIGHT, FALLBACK_DELIVERY));
      }
    } catch {}
    finally {
      setLoading(false);
      Animated.timing(fadeA, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => { load(); }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeA, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeA, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const floorNum        = parseFloat(floorInput) || 0;
  const markupPct       = platformEst ? Math.max(0, ((floorNum - platformEst) / platformEst) * 100) : 0;
  const isClamped       = floorNum > 0 && platformEst && floorNum > platformEst * MAX_MARKUP;
  const clampedMax      = platformEst ? Math.round((platformEst * MAX_MARKUP) / 50) * 50 : 0;
  const effectiveFloor  = isClamped ? clampedMax : floorNum;
  const baseFareForCalc = effectiveFloor > 0 ? effectiveFloor : (platformEst ?? 0);
  const partnerEarnings = baseFareForCalc > 0
    ? Math.round((baseFareForCalc - bookingFee) * (1 - commissionRate))
    : null;

  const handleSave = async () => {
    Keyboard.dismiss();
    if (enabled && (!floorNum || floorNum < 100)) {
      shake();
      Alert.alert('Invalid Amount', 'Please enter a floor price of at least ₦100.');
      return;
    }
    if (!platformEst && saveValue > 0) {
      Alert.alert('Not ready', 'Platform rates are still loading. Please wait a moment.');
      return;
    }
    const saveValue = enabled ? effectiveFloor : 0;
    setSaving(true);
    try {
      await partnerAPI.setFloorMultiplier({
        floorMultiplier: saveValue > 0
          ? parseFloat((saveValue / platformEst).toFixed(6))
          : 1.0,
      });
      Alert.alert(
        saveValue > 0 ? 'Floor Price Set ✅' : 'Floor Price Disabled',
        saveValue > 0
          ? `Customers will see your minimum fee of ₦${saveValue.toLocaleString('en-NG')} when booking a delivery.`
          : 'You will now receive deliveries at the standard platform rate.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Floor Price</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>Set your minimum delivery fee</Text>
        </View>
        {enabled && floorNum > 0 && (
          <View style={[s.activePill, { backgroundColor: COURIER_ACCENT + '20', borderColor: COURIER_ACCENT + '50' }]}>
            <View style={[s.activeDot, { backgroundColor: COURIER_ACCENT }]} />
            <Text style={[s.activeTxt, { color: COURIER_ACCENT }]}>ACTIVE</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COURIER_ACCENT} style={{ marginTop: 60 }} />
      ) : (
        <AnimatedRN.ScrollView
          style={{ opacity: fadeA }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={scrollHandler}
        >
          {/* How it works */}
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '25' }]}>
            <View style={s.cardTitleRow}>
              <Ionicons name="information-circle" size={16} color={COURIER_ACCENT} />
              <Text style={[s.cardTitle, { color: COURIER_ACCENT }]}>How Floor Pricing Works</Text>
            </View>
            <Text style={[s.cardBody, { color: theme.hint }]}>
              Customers booking a delivery will see your floor price. If they choose you, the higher of{' '}
              <Text style={{ color: theme.foreground, fontWeight: '700' }}>your floor</Text> or the{' '}
              <Text style={{ color: theme.foreground, fontWeight: '700' }}>platform estimate</Text> applies.
              Maximum markup is <Text style={{ color: COURIER_ACCENT, fontWeight: '800' }}>+30%</Text> above platform rate.
              Platform takes <Text style={{ color: COURIER_ACCENT, fontWeight: '800' }}>{Math.round(commissionRate * 100)}% commission</Text> + booking fee.
            </Text>
          </View>

          {/* Toggle */}
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.toggleLabel, { color: theme.foreground }]}>Enable Floor Price</Text>
                <Text style={[s.toggleSub, { color: theme.hint }]}>
                  {enabled ? 'Your floor price is shown to customers' : 'Accept deliveries at the platform rate'}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: theme.border, true: COURIER_ACCENT + '70' }}
                thumbColor={enabled ? COURIER_ACCENT : theme.hint}
                ios_backgroundColor={theme.border}
              />
            </View>
          </View>

          {/* Input */}
          {enabled && (
            <Animated.View style={{ transform: [{ translateX: shakeA }] }}>
              <SectionLabel text="YOUR MINIMUM FEE" theme={theme} />
              <View style={[s.inputCard, {
                backgroundColor: theme.backgroundAlt,
                borderColor: isClamped ? RED + '60' : floorNum > 0 ? COURIER_ACCENT + '60' : theme.border,
              }]}>
                <Text style={[s.currency, { color: COURIER_ACCENT }]}>₦</Text>
                <TextInput
                  style={[s.input, { color: theme.foreground }]}
                  value={floorInput}
                  onChangeText={setFloorInput}
                  keyboardType="numeric"
                  placeholder="e.g. 800"
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

          {/* Preview */}
          {platformEst && (
            <>
              <SectionLabel text={`EARNINGS PREVIEW • ${SAMPLE_KM}KM ${vehicleType} • ${SAMPLE_WEIGHT}KG`} theme={theme} />
              <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <InfoRow icon="calculator-outline" label="Platform estimate"  value={`₦${platformEst.toLocaleString('en-NG')}`} valueColor={theme.foreground} theme={theme} />
                {enabled && effectiveFloor > platformEst && (
                  <InfoRow icon="trending-up-outline" label="Your floor price" value={`₦${effectiveFloor.toLocaleString('en-NG')}`} valueColor={COURIER_ACCENT} theme={theme} />
                )}
                <View style={[s.divider, { backgroundColor: theme.border }]} />
                <InfoRow
                  icon="wallet-outline"
                  label="Your net earnings"
                  value={`₦${(partnerEarnings ?? 0).toLocaleString('en-NG')}`}
                  valueColor={GREEN}
                  theme={theme}
                />
                <Text style={[s.earningsNote, { color: theme.hint }]}>
                  After {Math.round(commissionRate * 100)}% platform commission + ₦{bookingFee} booking fee.
                </Text>
              </View>
            </>
          )}

          {/* Rate table — live from admin settings */}
          <SectionLabel text="PLATFORM DELIVERY RATES (ADMIN-SET)" theme={theme} />
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {[
              { label: 'Base fee',         value: `₦${deliveryRates.baseFee}` },
              { label: 'Per kilometre',    value: `₦${deliveryRates.perKm}/km` },
              { label: 'Per kg (weight)',  value: `₦${deliveryRates.weightFeePerKg}/kg` },
              { label: 'Booking fee',      value: `₦${bookingFee} (${vehicleType})` },
              { label: 'Commission',       value: `${Math.round(commissionRate * 100)}%` },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={s.rateRow}>
                  <Text style={[s.rateLabel, { color: theme.hint }]}>{row.label}</Text>
                  <Text style={[s.rateVal, { color: theme.foreground }]}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: theme.border }]} />}
              </View>
            ))}
            <Text style={[s.earningsNote, { color: theme.hint, marginTop: 8 }]}>
              Rates are set by admin and updated in real time.
            </Text>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: COURIER_ACCENT, opacity: saving ? 0.75 : 1 }]}
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
          <View style={{ height: 32 }} />
        </AnimatedRN.ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub:   { fontSize: 11, marginTop: 1 },
  activePill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  activeDot:   { width: 6, height: 6, borderRadius: 3 },
  activeTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  card:        { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 20 },
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
  rateRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rateLabel:   { flex: 1, fontSize: 12, fontWeight: '500' },
  rateTypePill:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rateType:    { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rateVal:     { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  earningsNote:{ fontSize: 11, lineHeight: 17 },
  saveBtn:     { borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveTxt:     { fontSize: 16, fontWeight: '900', color: '#080C18' },
});