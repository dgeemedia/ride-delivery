// mobile/src/screens/Partner/CourierFloorPriceScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Animated, ActivityIndicator,
  Switch, Alert, Keyboard,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { partnerAPI, deliveryAPI } from '../../services/api';

const COURIER_ACCENT = '#34D399';
const GREEN          = '#5DAA72';
const RED            = '#E05555';
const MAX_MARKUP     = 1.30;
const SAMPLE_KM      = 5;
const SAMPLE_WEIGHT  = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Delivery fee engine (mirrors backend calculateDeliveryFee)
// ─────────────────────────────────────────────────────────────────────────────
const DELIVERY_RATES = {
  BIKE:       { base: 400,  perKm: 80,  perKg: 30, bookingFee: 50,  min: 400  },
  MOTORCYCLE: { base: 400,  perKm: 80,  perKg: 30, bookingFee: 50,  min: 400  },
  CAR:        { base: 700,  perKm: 120, perKg: 50, bookingFee: 100, min: 700  },
  VAN:        { base: 1200, perKm: 180, perKg: 80, bookingFee: 150, min: 1200 },
};

const calcDeliveryFee = (km, vehicleType = 'BIKE', kg = 0) => {
  const r = DELIVERY_RATES[vehicleType] ?? DELIVERY_RATES.BIKE;
  const fee = Math.max(r.min, r.base + km * r.perKm + kg * r.perKg) + r.bookingFee;
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

  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [enabled,     setEnabled]     = useState(false);
  const [floorInput,  setFloorInput]  = useState('');
  const [platformEst, setPlatformEst] = useState(null);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const shakeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const profileRes = await partnerAPI.getProfile();
      const p = profileRes?.data?.profile;
      setProfile(p);
      const saved = p?.preferredFloorPrice ?? 0;
      if (saved > 0) { setEnabled(true); setFloorInput(String(saved)); }

      const vehicleType = p?.vehicleType ?? 'BIKE';
      const est = calcDeliveryFee(SAMPLE_KM, vehicleType, SAMPLE_WEIGHT);
      setPlatformEst(est);
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

  const floorNum      = parseFloat(floorInput) || 0;
  const markupPct     = platformEst ? Math.max(0, ((floorNum - platformEst) / platformEst) * 100) : 0;
  const isClamped     = floorNum > 0 && platformEst && floorNum > platformEst * MAX_MARKUP;
  const clampedMax    = platformEst ? Math.round((platformEst * MAX_MARKUP) / 50) * 50 : 0;
  const effectiveFloor= isClamped ? clampedMax : floorNum;
  const vehicleType   = profile?.vehicleType ?? 'BIKE';
  const rate          = DELIVERY_RATES[vehicleType] ?? DELIVERY_RATES.BIKE;
  const partnerEarnings = effectiveFloor > 0
    ? Math.round((effectiveFloor - rate.bookingFee) * 0.85)
    : platformEst
    ? Math.round((platformEst - rate.bookingFee) * 0.85)
    : null;

  const handleSave = async () => {
    Keyboard.dismiss();
    if (enabled && (!floorNum || floorNum < 100)) {
      shake();
      Alert.alert('Invalid Amount', 'Please enter a floor price of at least ₦100.');
      return;
    }
    const saveValue = enabled ? effectiveFloor : 0;
    setSaving(true);
    try {
      await partnerAPI.updateProfile({
        vehicleType: profile?.vehicleType,
        preferredFloorPrice: saveValue,
      });
      Alert.alert(
        saveValue > 0 ? 'Floor Price Set ✅' : 'Floor Price Disabled',
        saveValue > 0
          ? `Customers will see your minimum fee of ₦${saveValue.toLocaleString('en-NG')} when booking a delivery.`
          : 'You will now receive deliveries at the standard platform rate.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to save. Please try again.');
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
        <Animated.ScrollView
          style={{ opacity: fadeA }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
              Platform takes <Text style={{ color: COURIER_ACCENT, fontWeight: '800' }}>15% commission</Text> + booking fee.
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
              <SectionLabel text={`EARNINGS PREVIEW • ${SAMPLE_KM}KM ${vehicleType} • ${SAMPLE_WEIGHT}KG PACKAGE`} theme={theme} />
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
                  After 15% platform commission + ₦{rate.bookingFee} booking fee.
                </Text>
              </View>
            </>
          )}

          {/* Rate table */}
          <SectionLabel text="PLATFORM DELIVERY RATES" theme={theme} />
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {Object.entries(DELIVERY_RATES).map(([type, r], i, arr) => (
              <View key={type}>
                <View style={[s.rateRow, { opacity: type === vehicleType ? 1 : 0.45 }]}>
                  <View style={[s.rateTypePill, {
                    backgroundColor: type === vehicleType ? COURIER_ACCENT + '20' : theme.border + '60',
                  }]}>
                    <Text style={[s.rateType, { color: type === vehicleType ? COURIER_ACCENT : theme.hint }]}>{type}</Text>
                  </View>
                  <Text style={[s.rateVal, { color: theme.foreground }]}>₦{r.base}</Text>
                  <Text style={[s.rateVal, { color: theme.foreground }]}>₦{r.perKm}/km</Text>
                  <Text style={[s.rateVal, { color: theme.foreground }]}>₦{r.perKg}/kg</Text>
                </View>
                {i < arr.length - 1 && <View style={[s.divider, { backgroundColor: theme.border }]} />}
              </View>
            ))}
            <Text style={[s.earningsNote, { color: theme.hint, marginTop: 8 }]}>
              Booking fee: ₦50–₦150 (non-refundable). Platform takes 15% commission.
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
        </Animated.ScrollView>
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
  rateRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  rateTypePill:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rateType:    { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rateVal:     { flex: 1, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  earningsNote:{ fontSize: 11, lineHeight: 17 },
  saveBtn:     { borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveTxt:     { fontSize: 16, fontWeight: '900', color: '#080C18' },
});