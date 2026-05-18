// mobile/src/screens/Customer/NearbyDriversScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl, ScrollView, Platform,
  Modal,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { rideAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');

const C = {
  brand:      '#00C896',
  brandDim:   '#00C89622',
  surge:      '#F5A623',
  surgeDim:   '#F5A62322',
  red:        '#FF4D4D',
  purple:     '#8B7CF8',
  fare:       '#FFFFFF',
  farePos:    '#00C896',
  fareSurge:  '#F5A623',
};

const T = {
  xs:   10,
  sm:   12,
  base: 14,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  26,
  hero: 32,
};

const VEHICLE_ICON = {
  CAR:        'car-outline',
  BIKE:       'bicycle-outline',
  VAN:        'bus-outline',
  MOTORCYCLE: 'bicycle-outline',
};

// ─── StarRating ───────────────────────────────────────────────────────────────
const StarRating = ({ rating, size = 11, theme }) => (
  <View style={sr.row}>
    <Ionicons name="star" size={size} color={C.surge} />
    <Text style={[sr.txt, { color: theme.foreground, fontSize: size + 1 }]}>
      {rating?.toFixed(1) ?? '—'}
    </Text>
  </View>
);
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txt: { fontWeight: '700' },
});

// ─── Chip ──────────────────────────────────────────────────────────────────────
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

// ─── DriverCard ───────────────────────────────────────────────────────────────
const DriverCard = ({ driver, platformFare, onPress, theme }) => {
  const scaleA        = useRef(new Animated.Value(1)).current;
  const effectiveFare = driver.effectiveFare ?? platformFare ?? 0;
  const floorActive   = driver.floorMultiplier > 1.0 && driver.effectiveFare > (platformFare ?? 0);
  const vehicleIcon   = VEHICLE_ICON[driver.vehicleType] ?? 'car-outline';

  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.975, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,     useNativeDriver: true, tension: 300, friction: 20 }).start();

  const initials = `${driver.firstName?.[0] ?? ''}${driver.lastName?.[0] ?? ''}`;

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        style={[
          dc.card,
          {
            backgroundColor: theme.backgroundAlt,
            borderColor: floorActive ? C.surge + '55' : theme.border,
            borderWidth: floorActive ? 1.5 : 1,
          },
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {floorActive && (
          <View style={[dc.rateBadge, { backgroundColor: C.surge }]}>
            <Ionicons name="trending-up" size={9} color="#1a1208" />
            <Text style={dc.rateBadgeTxt}>DRIVER RATE</Text>
          </View>
        )}

        <View style={dc.row}>
          <View style={[dc.avatar, { backgroundColor: floorActive ? C.surge + '22' : C.brand + '18' }]}>
            <Text style={[dc.avatarTxt, { color: floorActive ? C.surge : C.brand }]}>{initials}</Text>
          </View>

          <View style={dc.info}>
            <View style={dc.nameRow}>
              <Text style={[dc.name, { color: theme.foreground }]}>
                {driver.firstName} {driver.lastName}
              </Text>
              <StarRating rating={driver.rating} theme={theme} />
            </View>
            <Text style={[dc.vehicleLine, { color: theme.hint }]}>
              {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel}
            </Text>
            <Text style={[dc.plate, { color: floorActive ? C.surge : C.brand }]}>
              {driver.vehiclePlate}
            </Text>
          </View>

          <View style={dc.fareBlock}>
            <Text style={[dc.fareMain, { color: floorActive ? C.fareSurge : C.farePos }]}>
              ₦{effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
            {floorActive && platformFare ? (
              <Text style={[dc.fareStrike, { color: theme.hint }]}>
                ₦{platformFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
            ) : null}
            <Text style={[dc.etaTxt, { color: theme.hint }]}>~{driver.etaMinutes} min</Text>
          </View>
        </View>

        <View style={dc.chips}>
          <Chip icon={vehicleIcon}        label={driver.vehicleType}            color={C.purple}   theme={theme} />
          <Chip icon="navigate-outline"   label={`${driver.distanceKm} km`}     color={theme.hint} theme={theme} />
          <Chip icon="star-outline"       label={`${driver.totalRides} rides`}  color={theme.hint} theme={theme} />
          {driver.surgeLabel && (
            <Chip icon="flash" label={driver.surgeLabel} color={C.red} theme={theme} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const dc = StyleSheet.create({
  card:        { borderRadius: 18, padding: 14, marginBottom: 10, overflow: 'hidden' },
  rateBadge:   { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderBottomLeftRadius: 14 },
  rateBadgeTxt:{ fontSize: T.xs, fontWeight: '900', color: '#1a1208', letterSpacing: 0.8 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:      { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:   { fontSize: T.lg, fontWeight: '800' },
  info:        { flex: 1, gap: 2 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:        { fontSize: T.md, fontWeight: '700' },
  vehicleLine: { fontSize: T.sm, fontWeight: '500' },
  plate:       { fontSize: T.xs, fontWeight: '800', letterSpacing: 1.2 },
  fareBlock:   { alignItems: 'flex-end', gap: 2 },
  fareMain:    { fontSize: T.xl, fontWeight: '900', letterSpacing: -0.5 },
  fareStrike:  { fontSize: T.sm, textDecorationLine: 'line-through' },
  etaTxt:      { fontSize: T.sm, fontWeight: '500' },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ─── SurgeBar ─────────────────────────────────────────────────────────────────
const SurgeBar = ({ label, theme }) => (
  <View style={[sb.wrap, { backgroundColor: C.surge + '12', borderColor: C.surge + '35' }]}>
    <Ionicons name="flash" size={13} color={C.surge} />
    <Text style={[sb.txt, { color: C.surge }]}>
      {label ?? 'Surge pricing'} — fares are higher than normal
    </Text>
  </View>
);
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  txt:  { fontSize: T.sm, fontWeight: '700', flex: 1 },
});

// ─── ConfirmSheet (FIXED: no conditional hooks) ───────────────────────────────
const ConfirmSheet = ({ driver, platformFare, routeParams, onClose, onSuccess, theme }) => {
  const [requesting, setRequesting] = useState(false);
  const insets = useSafeAreaInsets();

  // Animation refs
  const slideInY = useRef(new Animated.Value(height)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  // PanResponder – always created, independent of driver
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

  // Reset animation when driver appears
  useEffect(() => {
    if (!driver) return;
    slideInY.setValue(height);
    dragY.setValue(0);
    Animated.spring(slideInY, {
      toValue: 0,
      tension: 70,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [driver?.driverId]);

  // All hooks are now safely above this line.
  if (!driver) return null;

  // Derived values
  const effectiveFare = driver.effectiveFare ?? platformFare ?? 0;
  const floorActive = driver.floorMultiplier > 1.0 && driver.effectiveFare > (platformFare ?? 0);
  const bookingFee = driver.bookingFee ?? 100;
  const markupPct = floorActive && platformFare ? (((effectiveFare - platformFare) / platformFare) * 100).toFixed(1) : null;
  const vehicleIcon = VEHICLE_ICON[driver.vehicleType] ?? 'car-outline';
  const initials = `${driver.firstName?.[0] ?? ''}${driver.lastName?.[0] ?? ''}`;
  const accent = floorActive ? C.surge : C.brand;

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideInY, { toValue: height, duration: 220, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const res = await rideAPI.requestSpecificDriver({
        pickupAddress: routeParams.pickupAddress,
        pickupLat: routeParams.pickupLat,
        pickupLng: routeParams.pickupLng,
        dropoffAddress: routeParams.dropoffAddress,
        dropoffLat: routeParams.dropoffLat,
        dropoffLng: routeParams.dropoffLng,
        driverId: driver.driverId,
        vehicleType: driver.vehicleType,
        paymentMethod: 'CASH',
        ...(floorActive && { driverFloorPrice: driver.preferredFloorPrice }),
      });
      onSuccess(res?.data?.ride ?? res?.ride);
    } catch (err) {
      Alert.alert('Could not request', err?.response?.data?.message ?? 'Please try again.');
      setRequesting(false);
    }
  };

  return (
    <Modal
      visible={!!driver}
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
          <View
            {...panResponder.panHandlers}
            style={[cs.handle, { backgroundColor: theme.hint + '44' }]}
          />

          <View style={cs.header}>
            <Text style={[cs.title, { color: theme.foreground }]}>Review & Confirm</Text>
            <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <View style={[cs.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="close" size={16} color={theme.hint} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={cs.scroll}>
            {/* Driver card */}
            <View style={[cs.driverCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={[cs.dAvatar, { backgroundColor: accent + '20' }]}>
                <Text style={[cs.dAvatarTxt, { color: accent }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cs.dName, { color: theme.foreground }]}>
                  {driver.firstName} {driver.lastName}
                </Text>
                <Text style={[cs.dVehicle, { color: theme.hint }]}>
                  {driver.vehicleColor} {driver.vehicleMake} • <Text style={{ color: accent, fontWeight: '800' }}>{driver.vehiclePlate}</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StarRating rating={driver.rating} size={12} theme={theme} />
                <Text style={[cs.dEta, { color: theme.hint }]}>~{driver.etaMinutes} min away</Text>
              </View>
            </View>

            {/* Route card */}
            <View style={[cs.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={cs.routeRow}>
                <View style={[cs.routeDot, { backgroundColor: C.brand }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[cs.routeLabel, { color: theme.hint }]}>PICKUP</Text>
                  <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={2}>
                    {routeParams.pickupAddress}
                  </Text>
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
                </View>
              </View>
            </View>

            {/* Fare breakdown */}
            <View style={[cs.fareCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={cs.fareRow}>
                <Text style={[cs.fareLabel, { color: theme.hint }]}>Platform estimate</Text>
                <Text style={[cs.fareVal, { color: theme.foreground }]}>
                  ₦{(platformFare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </View>
              {floorActive && (
                <View style={cs.fareRow}>
                  <Text style={[cs.fareLabel, { color: theme.hint }]}>Driver floor {markupPct ? `(+${markupPct}%)` : ''}</Text>
                  <Text style={[cs.fareVal, { color: C.surge }]}>
                    ₦{effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              )}
              <View style={cs.fareRow}>
                <Text style={[cs.fareLabel, { color: theme.hint }]}>Booking fee</Text>
                <Text style={[cs.fareVal, { color: theme.foreground }]}>₦{bookingFee}</Text>
              </View>
              <View style={[cs.fareSep, { backgroundColor: theme.border }]} />
              <View style={cs.fareRow}>
                <Text style={[cs.fareLabel, { color: theme.foreground, fontWeight: '700' }]}>Estimated total</Text>
                <Text style={[cs.fareTotal, { color: accent }]}>
                  ₦{effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>

            {floorActive && (
              <View style={[cs.note, { backgroundColor: C.surge + '10', borderColor: C.surge + '30' }]}>
                <Ionicons name="information-circle-outline" size={14} color={C.surge} style={{ marginTop: 1 }} />
                <Text style={[cs.noteTxt, { color: C.surge }]}>
                  This driver's floor price exceeds the platform estimate. Final fare recalculated from actual trip distance and time.
                </Text>
              </View>
            )}

            <View style={cs.chipsRow}>
              <Chip icon={vehicleIcon}        label={driver.vehicleType}            color={C.purple}   theme={theme} />
              <Chip icon="navigate-outline"   label={`${driver.distanceKm} km`}     color={theme.hint} theme={theme} />
              <Chip icon="time-outline"       label={`~${driver.etaMinutes} min`}   color={theme.hint} theme={theme} />
              <Chip icon="star-outline"       label={`${driver.totalRides} rides`}  color={theme.hint} theme={theme} />
            </View>
          </ScrollView>

          <View style={[cs.cta, { borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={[cs.back, { borderColor: theme.border }]} onPress={closeSheet} disabled={requesting}>
              <Text style={[cs.backTxt, { color: theme.hint }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cs.confirm, { backgroundColor: accent, opacity: requesting ? 0.72 : 1 }]}
              onPress={handleRequest}
              disabled={requesting}
              activeOpacity={0.86}
            >
              {requesting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={19} color="#000" />
                  <Text style={cs.confirmTxt}>Request Driver</Text>
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
  overlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
    height: height * 0.88,        // ✅ fixed height so ScrollView can flex
    maxHeight: height * 0.88,     // optional, keep for safety
    flexDirection: 'column',
},
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title:       { fontSize: T.xl, fontWeight: '800' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  driverCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  dAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  dAvatarTxt:  { fontSize: T.lg, fontWeight: '800' },
  dName:       { fontSize: T.md, fontWeight: '700', marginBottom: 3 },
  dVehicle:    { fontSize: T.sm, fontWeight: '500' },
  dEta:        { fontSize: T.xs, fontWeight: '500' },
  routeCard:   { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  routeRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 14, flexShrink: 0 },
  routeConnector: { width: 1.5, height: 14, marginLeft: 4.25, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  routeLabel:  { fontSize: T.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  routeAddr:   { fontSize: T.base, fontWeight: '500', lineHeight: 20 },
  fareCard:    { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  fareRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel:   { fontSize: T.sm, fontWeight: '500' },
  fareVal:     { fontSize: T.sm, fontWeight: '700' },
  fareSep:     { height: 1, marginVertical: 2 },
  fareTotal:   { fontSize: T.lg, fontWeight: '900' },
  note:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  noteTxt:     { flex: 1, fontSize: T.sm, lineHeight: 18, fontWeight: '500' },
  chipsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cta:         {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  back:        { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  backTxt:     { fontSize: T.md, fontWeight: '600' },
  confirm:     { flex: 2.2, height: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmTxt:  { fontSize: T.md, fontWeight: '900', color: '#000' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function NearbyDriversScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const params          = route.params ?? {};

  const [drivers,        setDrivers]        = useState([]);
  const [platformFare,   setPlatformFare]   = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [driversRes, fareRes] = await Promise.allSettled([
        rideAPI.getNearbyDrivers({
          pickupLat:   params.pickupLat,
          pickupLng:   params.pickupLng,
          dropoffLat:  params.dropoffLat,
          dropoffLng:  params.dropoffLng,
          radiusKm:    15,
          vehicleType: params.vehicleType,
        }),
        rideAPI.getEstimate({
          pickupLat:   params.pickupLat,
          pickupLng:   params.pickupLng,
          dropoffLat:  params.dropoffLat,
          dropoffLng:  params.dropoffLng,
          vehicleType: params.vehicleType ?? 'CAR',
        }),
      ]);
      if (driversRes.status === 'fulfilled') setDrivers(driversRes.value?.data?.drivers ?? []);
      if (fareRes.status === 'fulfilled')   setPlatformFare(fareRes.value?.data?.estimatedFare ?? null);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    }
  }, [params]);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleRideRequested = (ride) => {
    setSelectedDriver(null);
    navigation.replace('RideTracking', { rideId: ride?.id, ride });
  };

  const surgeActive = drivers.some(d => d.surgeMultiplier > 1);
  const surgeLabel  = drivers.find(d => d.surgeLabel)?.surgeLabel;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: theme.background }}>
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Choose a Driver</Text>
            <Text style={[s.headerSub, { color: theme.hint }]} numberOfLines={1}>
              {params.pickupAddress?.split('(')[0]?.trim() ?? 'Nearby'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={18} color={C.brand} />
          </TouchableOpacity>
        </View>
        {surgeActive && <SurgeBar label={surgeLabel} theme={theme} />}
      </SafeAreaView>

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
        {platformFare ? (
          <View style={[s.fareChip, { backgroundColor: C.brand + '15', borderColor: C.brand + '30' }]}>
            <Text style={[s.fareChipTxt, { color: C.brand }]}>
              ₦{platformFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
          <Text style={[s.loadTxt, { color: theme.hint }]}>Finding drivers near you…</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={drivers}
            keyExtractor={d => d.driverId}
            renderItem={({ item }) => (
              <DriverCard
                driver={item}
                platformFare={platformFare}
                onPress={() => setSelectedDriver(item)}
                theme={theme}
              />
            )}
            contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
            ListHeaderComponent={drivers.length > 0 && (
              <View style={s.listHead}>
                <Text style={[s.listCount, { color: theme.hint }]}>
                  {drivers.length} driver{drivers.length !== 1 ? 's' : ''} nearby
                </Text>
                {drivers.some(d => d.preferredFloorPrice > 0) && (
                  <Chip icon="trending-up" label="DRIVER RATE = floor price set" color={C.surge} theme={theme} small />
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="car-outline" size={36} color={theme.hint} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No drivers nearby</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>Pull down to refresh or try a larger area.</Text>
                <TouchableOpacity style={[s.retryBtn, { backgroundColor: C.brand }]} onPress={onRefresh}>
                  <Text style={s.retryTxt}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>
      )}

      <ConfirmSheet
        driver={selectedDriver}
        platformFare={platformFare}
        routeParams={params}
        onClose={() => setSelectedDriver(null)}
        onSuccess={handleRideRequested}
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