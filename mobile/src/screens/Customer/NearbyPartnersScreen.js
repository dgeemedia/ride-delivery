// mobile/src/screens/Customer/NearbyPartnersScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl, ScrollView,
  Modal,          // ← NEW
  PanResponder,   // ← NEW
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { deliveryAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  brand:    '#00C896',
  brandDim: '#00C89622',
  red:      '#FF4D4D',
  purple:   '#8B7CF8',
  amber:    '#F5A623',
};

const T = {
  xs:   10,
  sm:   12,
  base: 14,
  md:   15,
  lg:   17,
  xl:   20,
};

const VEHICLE_ICON = {
  BIKE:       'bicycle-outline',
  MOTORCYCLE: 'bicycle-outline',
  CAR:        'car-outline',
  VAN:        'bus-outline',
  TRICYCLE:   'bicycle-outline',
};

// ─── StarRating ───────────────────────────────────────────────────────────────
const StarRating = ({ rating, size = 11, theme }) => (
  <View style={sr.row}>
    <Ionicons name="star" size={size} color={C.amber} />
    <Text style={[sr.txt, { color: theme.foreground, fontSize: size + 1 }]}>
      {rating?.toFixed(1) ?? '—'}
    </Text>
  </View>
);
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txt: { fontWeight: '700' },
});

// ─── Chip ─────────────────────────────────────────────────────────────────────
const Chip = ({ icon, label, color, theme, small }) => {
  const col = color || theme.hint;
  return (
    <View style={[chip.wrap, {
      backgroundColor: col + '14',
      borderColor: col + '28',
      paddingHorizontal: small ? 6 : 8,
      paddingVertical: small ? 3 : 4,
    }]}>
      {icon && <Ionicons name={icon} size={small ? 10 : 11} color={col} />}
      <Text style={[chip.txt, { color: col, fontSize: small ? T.xs : 11 }]}>{label}</Text>
    </View>
  );
};
const chip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1 },
  txt:  { fontWeight: '700', letterSpacing: 0.2 },
});

// ─── PartnerCard ──────────────────────────────────────────────────────────────
const PartnerCard = ({ partner, onPress, theme }) => {
  const scaleA    = useRef(new Animated.Value(1)).current;
  const vehicleIcon = VEHICLE_ICON[partner.vehicleType] ?? 'bicycle-outline';

  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.975, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,     useNativeDriver: true, tension: 300, friction: 20 }).start();

  const etaColor = (partner.etaMinutes ?? 99) <= 5 ? C.brand
    : (partner.etaMinutes ?? 99) <= 12 ? C.amber : theme.hint;

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        style={[pc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={pc.row}>
          <View style={[pc.avatar, { backgroundColor: C.brand + '18' }]}>
            <Ionicons name={vehicleIcon} size={22} color={C.brand} />
          </View>

          <View style={pc.info}>
            <View style={pc.nameRow}>
              <Text style={[pc.name, { color: theme.foreground }]}>
                {partner.firstName} {partner.lastName}
              </Text>
              <StarRating rating={partner.rating ?? 0} theme={theme} />
            </View>
            <Text style={[pc.vehicleLine, { color: theme.hint }]}>
              {partner.vehicleType?.charAt(0) + partner.vehicleType?.slice(1).toLowerCase()} • {partner.vehiclePlate ?? '—'}
            </Text>
          </View>

          <View style={pc.etaBlock}>
            <Text style={[pc.etaMain, { color: etaColor }]}>~{partner.etaMinutes} min</Text>
            <Text style={[pc.distTxt, { color: theme.hint }]}>{partner.distanceKm} km</Text>
          </View>
        </View>

        <View style={pc.chips}>
          <Chip icon={vehicleIcon}      label={partner.vehicleType}                        color={C.purple}   theme={theme} />
          <Chip icon="navigate-outline" label={`${partner.distanceKm} km`}                 color={theme.hint} theme={theme} />
          <Chip icon="time-outline"     label={`~${partner.etaMinutes} min`}               color={theme.hint} theme={theme} />
          <Chip icon="star-outline"     label={`${partner.totalDeliveries ?? 0} deliveries`} color={theme.hint} theme={theme} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
const pc = StyleSheet.create({
  card:       { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:     { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info:       { flex: 1, gap: 2 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:       { fontSize: T.md, fontWeight: '700' },
  vehicleLine:{ fontSize: T.sm, fontWeight: '500' },
  etaBlock:   { alignItems: 'flex-end', gap: 3 },
  etaMain:    { fontSize: T.xl, fontWeight: '900', letterSpacing: -0.4 },
  distTxt:    { fontSize: T.xs, fontWeight: '500' },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ─── ConfirmSheet (NOW A MODAL – always visible, draggable) ─────────────────
const ConfirmSheet = ({ partner, routeParams, onClose, onSuccess, theme }) => {
  const [requesting, setRequesting] = useState(false);
  const insets = useSafeAreaInsets();

  // Animation refs (always declared)
  const slideInY = useRef(new Animated.Value(height)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  // PanResponder – independent of partner
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: Animated.event([null, { dy: dragY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dy }) => {
        if (dy > 100 || dy > 0.3 * height) {
          closeSheet();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!partner) return;
    slideInY.setValue(height);
    dragY.setValue(0);
    Animated.spring(slideInY, {
      toValue: 0,
      tension: 70,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [partner?.partnerId]);

  // All hooks are above – safe early return now
  if (!partner) return null;

  const feeEstimate = routeParams.feeEstimate ?? 0;
  const vehicleIcon = VEHICLE_ICON[partner.vehicleType] ?? 'bicycle-outline';

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideInY, { toValue: height, duration: 220, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const res = await deliveryAPI.requestDelivery({
        pickupAddress:      routeParams.pickupAddress,
        pickupLat:          routeParams.pickupLat,
        pickupLng:          routeParams.pickupLng,
        pickupContact:      routeParams.pickupContact,
        dropoffAddress:     routeParams.dropoffAddress,
        dropoffLat:         routeParams.dropoffLat,
        dropoffLng:         routeParams.dropoffLng,
        dropoffContact:     routeParams.dropoffContact,
        packageDescription: routeParams.packageDescription,
        packageWeight:      parseFloat(routeParams.packageWeight) || 0,
        notes:              routeParams.packageNotes,
        estimatedFee:       feeEstimate,
        partnerId:          partner.partnerId,
      });
      onSuccess(res?.data?.delivery ?? res?.delivery);
    } catch (err) {
      Alert.alert('Could not request', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
      setRequesting(false);
    }
  };

  return (
    <Modal
      visible={!!partner}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      <View style={cs.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeSheet} activeOpacity={1} />
        <Animated.View
          style={[
            cs.sheet,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              transform: [{ translateY: Animated.add(slideInY, dragY) }],
            },
          ]}
        >
          {/* Draggable handle */}
          <View
            {...panResponder.panHandlers}
            style={[cs.handle, { backgroundColor: theme.hint + '44' }]}
          />

          {/* Header */}
          <View style={cs.header}>
            <Text style={[cs.title, { color: theme.foreground }]}>Review & Confirm</Text>
            <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <View style={[cs.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="close" size={16} color={theme.hint} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={cs.scroll}>
            {/* Courier card */}
            <View style={[cs.courierCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={[cs.courierAvatar, { backgroundColor: C.brand + '18' }]}>
                <Ionicons name={vehicleIcon} size={20} color={C.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cs.courierName, { color: theme.foreground }]}>
                  {partner.firstName} {partner.lastName}
                </Text>
                <Text style={[cs.courierVehicle, { color: theme.hint }]}>
                  {partner.vehicleType} • {partner.vehiclePlate ?? '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StarRating rating={partner.rating ?? 0} size={12} theme={theme} />
                <Text style={[cs.courierEta, { color: theme.hint }]}>~{partner.etaMinutes} min away</Text>
              </View>
            </View>

            {/* Package info */}
            {routeParams.packageDescription ? (
              <View style={[cs.pkgCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={cs.pkgRow}>
                  <Ionicons name="cube-outline" size={14} color={C.brand} />
                  <Text style={[cs.pkgLabel, { color: theme.hint }]}>Package</Text>
                  <Text style={[cs.pkgVal, { color: theme.foreground }]} numberOfLines={1}>
                    {routeParams.packageDescription}
                  </Text>
                </View>
                {routeParams.packageWeight ? (
                  <View style={cs.pkgRow}>
                    <Ionicons name="scale-outline" size={14} color={C.brand} />
                    <Text style={[cs.pkgLabel, { color: theme.hint }]}>Weight</Text>
                    <Text style={[cs.pkgVal, { color: theme.foreground }]}>{routeParams.packageWeight} kg</Text>
                  </View>
                ) : null}
                {routeParams.packageNotes ? (
                  <View style={cs.pkgRow}>
                    <Ionicons name="document-text-outline" size={14} color={C.brand} />
                    <Text style={[cs.pkgLabel, { color: theme.hint }]}>Note</Text>
                    <Text style={[cs.pkgVal, { color: theme.foreground }]} numberOfLines={2}>
                      {routeParams.packageNotes}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Route */}
            {routeParams.pickupAddress ? (
              <View style={[cs.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={cs.routeRow}>
                  <View style={[cs.routeDot, { backgroundColor: C.brand }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[cs.routeLabel, { color: theme.hint }]}>PICKUP</Text>
                    <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={2}>
                      {routeParams.pickupAddress}
                    </Text>
                    {routeParams.pickupContact ? (
                      <Text style={[cs.routeContact, { color: theme.hint }]}>{routeParams.pickupContact}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={[cs.routeConnector, { borderColor: theme.border }]} />
                <View style={cs.routeRow}>
                  <View style={[cs.routeDot, { backgroundColor: C.red }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[cs.routeLabel, { color: theme.hint }]}>DROPOFF</Text>
                    <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={2}>
                      {routeParams.dropoffAddress}
                    </Text>
                    {routeParams.dropoffContact ? (
                      <Text style={[cs.routeContact, { color: theme.hint }]}>{routeParams.dropoffContact}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            {/* Fee breakdown */}
            {feeEstimate > 0 && (
              <View style={[cs.feeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                {routeParams.distanceKm ? (
                  <View style={cs.feeRow}>
                    <Text style={[cs.feeLabel, { color: theme.hint }]}>Distance</Text>
                    <Text style={[cs.feeVal, { color: theme.foreground }]}>{routeParams.distanceKm} km</Text>
                  </View>
                ) : null}
                {routeParams.etaMinutes ? (
                  <View style={cs.feeRow}>
                    <Text style={[cs.feeLabel, { color: theme.hint }]}>Est. time</Text>
                    <Text style={[cs.feeVal, { color: theme.foreground }]}>~{routeParams.etaMinutes} min</Text>
                  </View>
                ) : null}
                <View style={[cs.feeSep, { backgroundColor: theme.border }]} />
                <View style={cs.feeRow}>
                  <Text style={[cs.feeLabel, { color: theme.foreground, fontWeight: '700' }]}>Estimated fee</Text>
                  <Text style={[cs.feeTotal, { color: C.brand }]}>
                    ₦{feeEstimate.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>
            )}

            {/* Info note */}
            <View style={[cs.note, { backgroundColor: C.brand + '10', borderColor: C.brand + '28' }]}>
              <Ionicons name="information-circle-outline" size={14} color={C.brand} style={{ marginTop: 1 }} />
              <Text style={[cs.noteTxt, { color: C.brand }]}>
                Final fee may vary based on actual distance and time. Payment is cash on delivery unless otherwise agreed.
              </Text>
            </View>

            {/* Chips */}
            <View style={cs.chipsRow}>
              <Chip icon={vehicleIcon}      label={partner.vehicleType}                        color={C.purple}   theme={theme} />
              <Chip icon="navigate-outline" label={`${partner.distanceKm} km`}                 color={theme.hint} theme={theme} />
              <Chip icon="time-outline"     label={`~${partner.etaMinutes} min`}               color={theme.hint} theme={theme} />
              <Chip icon="star-outline"     label={`${partner.totalDeliveries ?? 0} deliveries`} color={theme.hint} theme={theme} />
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={[cs.cta, { borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity
              style={[cs.back, { borderColor: theme.border }]}
              onPress={closeSheet}
              disabled={requesting}
            >
              <Text style={[cs.backTxt, { color: theme.hint }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cs.confirm, { backgroundColor: C.brand, opacity: requesting ? 0.72 : 1 }]}
              onPress={handleRequest}
              disabled={requesting}
              activeOpacity={0.86}
            >
              {requesting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={19} color="#000" />
                  <Text style={cs.confirmTxt}>Request Courier</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const cs = StyleSheet.create({
  overlay:       { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:         {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
    height: height * 0.88,       // ← fixed height so ScrollView works
    maxHeight: height * 0.88,
    flexDirection: 'column',
  },
  handle:        { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title:         { fontSize: T.xl, fontWeight: '800' },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:        { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  courierCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  courierAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  courierName:   { fontSize: T.md, fontWeight: '700', marginBottom: 3 },
  courierVehicle:{ fontSize: T.sm, fontWeight: '500' },
  courierEta:    { fontSize: T.xs, fontWeight: '500' },
  pkgCard:       { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  pkgRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgLabel:      { fontSize: T.sm, fontWeight: '600', width: 56 },
  pkgVal:        { flex: 1, fontSize: T.sm, fontWeight: '600' },
  routeCard:     { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  routeRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot:      { width: 10, height: 10, borderRadius: 5, marginTop: 14, flexShrink: 0 },
  routeConnector:{ width: 1.5, height: 14, marginLeft: 4.25, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  routeLabel:    { fontSize: T.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  routeAddr:     { fontSize: T.base, fontWeight: '500', lineHeight: 20 },
  routeContact:  { fontSize: T.xs, marginTop: 2 },
  feeCard:       { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  feeRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel:      { fontSize: T.sm, fontWeight: '500' },
  feeVal:        { fontSize: T.sm, fontWeight: '700' },
  feeSep:        { height: 1, marginVertical: 2 },
  feeTotal:      { fontSize: T.lg, fontWeight: '900' },
  note:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  noteTxt:       { flex: 1, fontSize: T.sm, lineHeight: 18, fontWeight: '500' },
  chipsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cta:           { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  back:          { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  backTxt:       { fontSize: T.md, fontWeight: '600' },
  confirm:       { flex: 2.2, height: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmTxt:    { fontSize: T.md, fontWeight: '900', color: '#000' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function NearbyPartnersScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const params          = route.params ?? {};

  const isBookingMode = !!(params.dropoffAddress && params.pickupContact);

  const [partners,        setPartners]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await deliveryAPI.getNearbyPartners({
        pickupLat:  params.pickupLat,
        pickupLng:  params.pickupLng,
        dropoffLat: params.dropoffLat,
        dropoffLng: params.dropoffLng,
        radiusKm:   params.radiusKm ?? 15,
      });
      const list = (res?.data?.partners ?? res?.partners ?? [])
        .filter(p => !String(p.partnerId).startsWith('mock-'));
      setPartners(list);
    } catch (err) {
      Alert.alert('Could not load couriers', err?.message ?? 'Please try again.');
      setPartners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    }
  }, [params]);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handlePartnerPress = (partner) => {
    if (isBookingMode) {
      setSelectedPartner(partner);
    } else {
      navigation.navigate('RequestDelivery', {
        preSelectedPartnerId:   partner.partnerId,
        preSelectedPartnerName: `${partner.firstName} ${partner.lastName}`,
      });
    }
  };

  const handleDeliveryRequested = (delivery) => {
    setSelectedPartner(null);
    if (navigation.replace) {
      navigation.replace('DeliveryTracking', { deliveryId: delivery?.id, delivery });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: theme.background }}>
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>
              {isBookingMode ? 'Choose a Courier' : 'Nearby Couriers'}
            </Text>
            <Text style={[s.headerSub, { color: theme.hint }]} numberOfLines={1}>
              {params.pickupAddress?.split('(')[0]?.trim() ?? 'Your area'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={18} color={C.brand} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Route strip (booking mode only) ── */}
      {isBookingMode && params.dropoffAddress ? (
        <View style={[s.strip, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
          <View style={s.stripItem}>
            <View style={[s.stripDot, { backgroundColor: C.brand }]} />
            <Text style={[s.stripTxt, { color: theme.foreground }]} numberOfLines={1}>
              {params.pickupAddress?.split(',')[0] ?? '—'}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={12} color={theme.hint} style={{ marginHorizontal: 2, flexShrink: 0 }} />
          <View style={s.stripItem}>
            <View style={[s.stripDot, { backgroundColor: C.red }]} />
            <Text style={[s.stripTxt, { color: theme.foreground }]} numberOfLines={1}>
              {params.dropoffAddress?.split(',')[0] ?? '—'}
            </Text>
          </View>
          {params.feeEstimate ? (
            <View style={[s.fareChip, { backgroundColor: C.brand + '15', borderColor: C.brand + '30' }]}>
              <Text style={[s.fareChipTxt, { color: C.brand }]}>
                ₦{Number(params.feeEstimate).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── List ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
          <Text style={[s.loadTxt, { color: theme.hint }]}>Finding couriers near you…</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={partners}
            keyExtractor={p => p.partnerId}
            renderItem={({ item }) => (
              <PartnerCard
                partner={item}
                onPress={() => handlePartnerPress(item)}
                theme={theme}
              />
            )}
            contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
            ListHeaderComponent={partners.length > 0 && (
              <View style={s.listHead}>
                <Text style={[s.listCount, { color: theme.hint }]}>
                  {partners.length} courier{partners.length !== 1 ? 's' : ''} nearby
                </Text>
                {!isBookingMode && (
                  <Chip icon="information-circle-outline" label="TAP TO PRE-SELECT" color={C.brand} theme={theme} small />
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="bicycle-outline" size={36} color={theme.hint} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No couriers nearby</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>Pull down to refresh or try again shortly.</Text>
                <TouchableOpacity style={[s.retryBtn, { backgroundColor: C.brand }]} onPress={onRefresh}>
                  <Text style={s.retryTxt}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>
      )}

      {/* ── Confirm sheet (always rendered, modal controls visibility) ── */}
      <ConfirmSheet
        partner={selectedPartner}
        routeParams={params}
        onClose={() => setSelectedPartner(null)}
        onSuccess={handleDeliveryRequested}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: T.lg, fontWeight: '800' },
  headerSub:   { fontSize: T.sm, marginTop: 1 },
  strip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, gap: 4 },
  stripItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  stripDot:    { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  stripTxt:    { fontSize: T.sm, fontWeight: '600', flex: 1 },
  fareChip:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  fareChipTxt: { fontSize: T.sm, fontWeight: '900' },
  list:        { paddingHorizontal: 14, paddingTop: 12 },
  listHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  listCount:   { fontSize: T.sm, fontWeight: '700' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadTxt:     { fontSize: T.base, fontWeight: '500' },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:  { fontSize: T.lg, fontWeight: '800' },
  emptySub:    { fontSize: T.sm, textAlign: 'center', maxWidth: 220 },
  retryBtn:    { marginTop: 4, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 },
  retryTxt:    { fontSize: T.base, fontWeight: '800', color: '#000' },
});