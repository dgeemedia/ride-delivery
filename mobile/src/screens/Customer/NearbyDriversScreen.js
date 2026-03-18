// mobile/src/screens/Customer/NearbyDriversScreen.js
//
// Customer browses online drivers near their pickup point.
// Each card shows the driver's vehicle, rating, ETA, platform fare estimate,
// and their floor price if they have one set.
//
// Tapping a driver opens a bottom-sheet confirmation with a full fare breakdown.
// "Request This Driver" calls rideAPI.requestSpecificDriver, passing the floor
// price so the backend encodes it for accurate final-fare calculation.
//
// Navigation params expected:
//   pickupAddress, pickupLat, pickupLng
//   dropoffAddress, dropoffLat, dropoffLng
//   vehicleType (optional, default 'CAR')

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI }           from '../../services/api';

const { width, height } = Dimensions.get('window');
const DA     = '#FFB800';
const GREEN  = '#5DAA72';
const PURPLE = '#A78BFA';
const RED    = '#E05555';

const VEHICLE_ICON = {
  CAR:        'car-outline',
  BIKE:       'bicycle-outline',
  VAN:        'bus-outline',
  MOTORCYCLE: 'bicycle-outline',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const StarRating = ({ rating, theme }) => (
  <View style={sr.row}>
    <Ionicons name="star" size={11} color={DA} />
    <Text style={[sr.txt, { color: theme.foreground }]}>{rating.toFixed(1)}</Text>
  </View>
);
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txt: { fontSize: 12, fontWeight: '700' },
});

const Pill = ({ icon, label, color, theme }) => (
  <View style={[pill.wrap, { backgroundColor: (color || theme.hint) + '18', borderColor: (color || theme.hint) + '30' }]}>
    <Ionicons name={icon} size={11} color={color || theme.hint} />
    <Text style={[pill.txt, { color: color || theme.hint }]}>{label}</Text>
  </View>
);
const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  txt:  { fontSize: 11, fontWeight: '700' },
});

// ── Driver card ───────────────────────────────────────────────────────────────
const DriverCard = ({ driver, platformFare, onPress, theme }) => {
  const hasFloor       = driver.preferredFloorPrice > 0;
  const effectiveFare  = hasFloor
    ? Math.max(platformFare ?? 0, driver.preferredFloorPrice)
    : (platformFare ?? 0);
  const floorActive    = hasFloor && driver.preferredFloorPrice > (platformFare ?? 0);
  const scaleA         = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        style={[dc.card, { backgroundColor: theme.backgroundAlt, borderColor: floorActive ? DA + '40' : theme.border }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Floor price badge */}
        {floorActive && (
          <View style={[dc.floorBadge, { backgroundColor: DA }]}>
            <Ionicons name="trending-up" size={10} color="#080C18" />
            <Text style={dc.floorBadgeTxt}>DRIVER RATE</Text>
          </View>
        )}

        <View style={dc.top}>
          {/* Avatar */}
          <View style={[dc.avatar, { backgroundColor: DA + '18' }]}>
            <Text style={[dc.avatarTxt, { color: DA }]}>
              {driver.firstName?.[0]}{driver.lastName?.[0]}
            </Text>
          </View>

          {/* Name + vehicle */}
          <View style={{ flex: 1 }}>
            <View style={dc.nameRow}>
              <Text style={[dc.name, { color: theme.foreground }]}>
                {driver.firstName} {driver.lastName}
              </Text>
              <StarRating rating={driver.rating} theme={theme} />
            </View>
            <Text style={[dc.vehicle, { color: theme.hint }]}>
              {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel}
            </Text>
            <Text style={[dc.plate, { color: DA }]}>{driver.vehiclePlate}</Text>
          </View>

          {/* Fare */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[dc.fare, { color: floorActive ? DA : GREEN }]}>
              ₦{effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
            {floorActive && (
              <Text style={[dc.fareBase, { color: theme.hint }]}>
                est. ₦{(platformFare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
            )}
          </View>
        </View>

        {/* Pills row */}
        <View style={dc.pills}>
          <Pill icon={VEHICLE_ICON[driver.vehicleType] ?? 'car-outline'} label={driver.vehicleType} color={PURPLE} theme={theme} />
          <Pill icon="navigate-outline" label={`${driver.distanceKm} km`}   color={theme.hint} theme={theme} />
          <Pill icon="time-outline"     label={`~${driver.etaMinutes} min`} color={theme.hint} theme={theme} />
          <Pill icon="star-outline"     label={`${driver.totalRides} rides`} color={theme.hint} theme={theme} />
          {driver.surgeLabel && (
            <Pill icon="flash" label={driver.surgeLabel} color={RED} theme={theme} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
const dc = StyleSheet.create({
  card:        { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12, overflow: 'hidden' },
  floorBadge:  { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderBottomLeftRadius: 12 },
  floorBadgeTxt:{ fontSize: 8, fontWeight: '900', color: '#080C18', letterSpacing: 1 },
  top:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:      { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:   { fontSize: 17, fontWeight: '800' },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  name:        { fontSize: 15, fontWeight: '800' },
  vehicle:     { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  plate:       { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  fare:        { fontSize: 20, fontWeight: '900' },
  fareBase:    { fontSize: 11, fontWeight: '500', textDecorationLine: 'line-through', marginTop: 1 },
  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ── Confirm bottom sheet ───────────────────────────────────────────────────────
const ConfirmSheet = ({ driver, platformFare, routeParams, onClose, onSuccess, theme }) => {
  const [requesting, setRequesting] = useState(false);
  const slideA = useRef(new Animated.Value(height)).current;

  const hasFloor      = driver.preferredFloorPrice > 0;
  const effectiveFare = hasFloor
    ? Math.max(platformFare ?? 0, driver.preferredFloorPrice)
    : (platformFare ?? 0);
  const floorActive   = hasFloor && driver.preferredFloorPrice > (platformFare ?? 0);
  const bookingFee    = driver.bookingFee ?? 100;
  const driverEarnings= Math.round((effectiveFare - bookingFee) * 0.80);
  const markupPct     = floorActive && platformFare
    ? (((effectiveFare - platformFare) / platformFare) * 100).toFixed(1)
    : null;

  useEffect(() => {
    Animated.spring(slideA, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, []);

  const close = () =>
    Animated.timing(slideA, { toValue: height, duration: 250, useNativeDriver: true }).start(onClose);

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const res = await rideAPI.requestSpecificDriver({
        pickupAddress:  routeParams.pickupAddress,
        pickupLat:      routeParams.pickupLat,
        pickupLng:      routeParams.pickupLng,
        dropoffAddress: routeParams.dropoffAddress,
        dropoffLat:     routeParams.dropoffLat,
        dropoffLng:     routeParams.dropoffLng,
        driverId:       driver.driverId,
        vehicleType:    driver.vehicleType,
        paymentMethod:  'CASH',
        // Pass the floor price so the backend can encode it into the ride
        ...(floorActive && { driverFloorPrice: driver.preferredFloorPrice }),
      });
      onSuccess(res?.data?.ride ?? res?.ride);
    } catch (err) {
      Alert.alert('Could not request', err?.response?.data?.message ?? 'Please try again.');
      setRequesting(false);
    }
  };

  const FareRow = ({ label, value, bold, color }) => (
    <View style={cs.fareRow}>
      <Text style={[cs.fareLabel, { color: theme.hint, fontWeight: bold ? '700' : '400' }]}>{label}</Text>
      <Text style={[cs.fareValue, { color: color ?? theme.foreground, fontWeight: bold ? '800' : '600' }]}>{value}</Text>
    </View>
  );

  return (
    <View style={cs.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={close} activeOpacity={1} />
      <Animated.View style={[cs.sheet, { backgroundColor: theme.background, transform: [{ translateY: slideA }] }]}>
        <View style={[cs.handle, { backgroundColor: theme.border }]} />

        <Text style={[cs.sheetTitle, { color: theme.foreground }]}>Confirm Driver</Text>

        {/* Driver mini-card */}
        <View style={[cs.miniCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <View style={[cs.miniAvatar, { backgroundColor: DA + '18' }]}>
            <Text style={[cs.miniAvatarTxt, { color: DA }]}>
              {driver.firstName?.[0]}{driver.lastName?.[0]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.miniName, { color: theme.foreground }]}>
              {driver.firstName} {driver.lastName}
            </Text>
            <Text style={[cs.miniVehicle, { color: theme.hint }]}>
              {driver.vehicleColor} {driver.vehicleMake} • {driver.vehiclePlate}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <StarRating rating={driver.rating} theme={theme} />
            <Text style={[cs.miniEta, { color: theme.hint }]}>~{driver.etaMinutes} min away</Text>
          </View>
        </View>

        {/* Fare breakdown */}
        <View style={[cs.fareCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <FareRow label="Platform estimate"  value={`₦${(platformFare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`} />
          {floorActive && (
            <FareRow
              label={`Driver floor (+${markupPct}%)`}
              value={`₦${effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
              color={DA}
            />
          )}
          <FareRow label="Booking fee (non-refundable)" value={`₦${bookingFee}`} />
          <View style={[cs.fareDivider, { backgroundColor: theme.border }]} />
          <FareRow label="Estimated total" value={`₦${effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`} bold color={floorActive ? DA : GREEN} />
        </View>

        {floorActive && (
          <View style={[cs.floorNote, { backgroundColor: DA + '10', borderColor: DA + '30' }]}>
            <Ionicons name="information-circle-outline" size={14} color={DA} />
            <Text style={[cs.floorNoteTxt, { color: DA }]}>
              This driver's floor price is above the standard estimate. The final fare will be recalculated using actual trip time — it may be higher in heavy traffic.
            </Text>
          </View>
        )}

        {/* Route summary */}
        <View style={[cs.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <View style={cs.routeRow}>
            <View style={[cs.routeDot, { backgroundColor: DA }]} />
            <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={1}>
              {routeParams.pickupAddress}
            </Text>
          </View>
          <View style={[cs.routeLine, { backgroundColor: theme.border }]} />
          <View style={cs.routeRow}>
            <View style={[cs.routeDot, { backgroundColor: RED }]} />
            <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={1}>
              {routeParams.dropoffAddress}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={cs.actions}>
          <TouchableOpacity
            style={[cs.cancelBtn, { borderColor: theme.border }]}
            onPress={close}
            disabled={requesting}
          >
            <Text style={[cs.cancelTxt, { color: theme.hint }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cs.confirmBtn, { backgroundColor: DA, opacity: requesting ? 0.75 : 1 }]}
            onPress={handleRequest}
            disabled={requesting}
            activeOpacity={0.88}
          >
            {requesting
              ? <ActivityIndicator color="#080C18" size="small" />
              : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#080C18" />
                  <Text style={cs.confirmTxt}>Request Driver</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const cs = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:      { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 18 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', marginBottom: 16 },

  miniCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  miniAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  miniAvatarTxt:  { fontSize: 16, fontWeight: '800' },
  miniName:       { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  miniVehicle:    { fontSize: 11, fontWeight: '500' },
  miniEta:        { fontSize: 11, marginTop: 3 },

  fareCard:    { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  fareRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  fareLabel:   { fontSize: 13 },
  fareValue:   { fontSize: 13 },
  fareDivider: { height: 1, marginVertical: 6 },

  floorNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  floorNoteTxt: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },

  routeCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 18 },
  routeRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:  { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeLine: { width: 2, height: 18, marginLeft: 4, marginVertical: 4 },
  routeAddr: { flex: 1, fontSize: 13, fontWeight: '600' },

  actions:    { flexDirection: 'row', gap: 12 },
  cancelBtn:  { flex: 1, height: 54, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:  { fontSize: 15, fontWeight: '700' },
  confirmBtn: { flex: 2, height: 54, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmTxt: { fontSize: 15, fontWeight: '900', color: '#080C18' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function NearbyDriversScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const params = route.params ?? {};

  const [drivers,       setDrivers]       = useState([]);
  const [platformFare,  setPlatformFare]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [selectedDriver,setSelectedDriver]= useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [driversRes, fareRes] = await Promise.allSettled([
        rideAPI.getNearbyDrivers({
          pickupLat:   params.pickupLat,
          pickupLng:   params.pickupLng,
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

      if (driversRes.status === 'fulfilled') {
        setDrivers(driversRes.value?.data?.drivers ?? []);
      }
      if (fareRes.status === 'fulfilled') {
        setPlatformFare(fareRes.value?.data?.estimatedFare ?? null);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [params]);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleDriverSelected = (driver) => setSelectedDriver(driver);

  const handleRideRequested = (ride) => {
    setSelectedDriver(null);
    // Navigate to ride tracking
    navigation.replace('RideTracking', { rideId: ride?.id, ride });
  };

  const surgeActive  = drivers.some(d => d.surgeMultiplier > 1);
  const surgeLabel   = drivers.find(d => d.surgeLabel)?.surgeLabel;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <SafeAreaView edges={['top', 'left', 'right']}>
        {/* ── Header ── */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Choose a Driver</Text>
            <Text style={[s.headerSub,   { color: theme.hint }]} numberOfLines={1}>
              {params.pickupAddress?.split('(')[0]?.trim() ?? 'Nearby pickup'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.refreshBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={18} color={DA} />
          </TouchableOpacity>
        </View>

        {/* ── Surge banner ── */}
        {surgeActive && (
          <View style={[s.surgeBanner, { backgroundColor: DA + '12', borderColor: DA + '30' }]}>
            <Ionicons name="flash" size={13} color={DA} />
            <Text style={[s.surgeTxt, { color: DA }]}>
              {surgeLabel ?? 'Surge pricing'} is active · Fares are higher than normal
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── Route summary strip ── */}
      <View style={[s.routeStrip, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
        <View style={s.routeItem}>
          <View style={[s.routeDot, { backgroundColor: DA }]} />
          <Text style={[s.routeText, { color: theme.foreground }]} numberOfLines={1}>
            {params.pickupAddress?.split(',')[0] ?? '—'}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={13} color={theme.hint} style={{ marginHorizontal: 4 }} />
        <View style={s.routeItem}>
          <View style={[s.routeDot, { backgroundColor: RED }]} />
          <Text style={[s.routeText, { color: theme.foreground }]} numberOfLines={1}>
            {params.dropoffAddress?.split(',')[0] ?? '—'}
          </Text>
        </View>
        {platformFare && (
          <Text style={[s.fareChip, { color: GREEN }]}>
            ₦{platformFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
        )}
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={DA} size="large" />
          <Text style={[s.loadingTxt, { color: theme.hint }]}>Finding drivers near you...</Text>
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
                onPress={() => handleDriverSelected(item)}
                theme={theme}
              />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DA} />
            }
            ListHeaderComponent={
              drivers.length > 0 && (
                <View style={s.listHeader}>
                  <Text style={[s.listCount, { color: theme.hint }]}>
                    {drivers.length} driver{drivers.length !== 1 ? 's' : ''} nearby
                  </Text>
                  {drivers.some(d => d.preferredFloorPrice > 0) && (
                    <View style={[s.legendItem, { backgroundColor: DA + '15', borderColor: DA + '30' }]}>
                      <Ionicons name="trending-up" size={10} color={DA} />
                      <Text style={[s.legendTxt, { color: DA }]}>DRIVER RATE = floor price set</Text>
                    </View>
                  )}
                </View>
              )
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="car-outline" size={48} color={theme.hint} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No drivers nearby</Text>
                <Text style={[s.emptySub,   { color: theme.hint }]}>
                  Pull down to refresh or try a larger radius.
                </Text>
                <TouchableOpacity
                  style={[s.retryBtn, { backgroundColor: DA }]}
                  onPress={onRefresh}
                >
                  <Text style={s.retryTxt}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>
      )}

      {/* ── Confirm sheet ── */}
      {selectedDriver && (
        <ConfirmSheet
          driver={selectedDriver}
          platformFare={platformFare}
          routeParams={params}
          onClose={() => setSelectedDriver(null)}
          onSuccess={handleRideRequested}
          theme={theme}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:    { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:{ fontSize: 17, fontWeight: '900' },
  headerSub:  { fontSize: 12, marginTop: 1 },

  // Surge banner
  surgeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  surgeTxt:    { fontSize: 12, fontWeight: '700', flex: 1 },

  // Route strip
  routeStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  routeItem:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText:  { fontSize: 12, fontWeight: '600', flex: 1 },
  fareChip:   { fontSize: 13, fontWeight: '900', marginLeft: 8 },

  // List
  list:       { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  listCount:  { fontSize: 12, fontWeight: '700' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  legendTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // States
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt: { fontSize: 13, fontWeight: '500', marginTop: 8 },
  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub:   { fontSize: 13, textAlign: 'center', maxWidth: 240 },
  retryBtn:   { marginTop: 8, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 },
  retryTxt:   { fontSize: 14, fontWeight: '800', color: '#080C18' },
});