// mobile/src/screens/Customer/NearbyDriversScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl, ScrollView, Modal, PanResponder, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { rideAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');

const C = {
  brand:    '#00C896',
  surge:    '#F5A623',
  red:      '#FF4D4D',
  purple:   '#8B7CF8',
};

const T = {
  xs: 10, sm: 12, base: 14, md: 15, lg: 17, xl: 20,
};

const VEHICLE_ICON = {
  CAR: 'car-outline', BIKE: 'bicycle-outline',
  VAN: 'bus-outline', MOTORCYCLE: 'bicycle-outline',
};

// ─── reverseGeocode helper ────────────────────────────────────────────────────
const reverseGeocode = async (lat, lng) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = results?.[0];
    if (place) {
      const parts = [place.name, place.street, place.district, place.city]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 3);
      return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

// ─── StarRating ───────────────────────────────────────────────────────────────
const StarRating = ({ rating, size = 11, theme }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
    <Ionicons name="star" size={size} color={C.surge} />
    <Text style={{ fontWeight: '700', color: theme.foreground, fontSize: size + 1 }}>
      {rating?.toFixed(1) ?? '—'}
    </Text>
  </View>
);

// ─── Chip ─────────────────────────────────────────────────────────────────────
const Chip = ({ icon, label, color, theme, small }) => {
  const col = color || theme.hint;
  return (
    <View style={[chipS.wrap, {
      backgroundColor: col + '14', borderColor: col + '28',
      paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 3 : 4,
    }]}>
      {icon && <Ionicons name={icon} size={small ? 10 : 11} color={col} />}
      <Text style={[chipS.txt, { color: col, fontSize: small ? T.xs : 11 }]}>{label}</Text>
    </View>
  );
};
const chipS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1 },
  txt:  { fontWeight: '700', letterSpacing: 0.2 },
});

// ─── DriverCard (list) ────────────────────────────────────────────────────────
// Each driver already has effectiveFare (route-based, from backend getNearbyDrivers).
// We show that + bookingFee as the total. No separate estimate call needed.
const DriverCard = ({ driver, onPress, theme }) => {
  const scaleA      = useRef(new Animated.Value(1)).current;
  const effectiveFare = driver.effectiveFare ?? 0;
  const bookingFee    = driver.bookingFee ?? 100;
  const totalFare     = effectiveFare + bookingFee;
  const floorActive   = (driver.floorMultiplier ?? 1.0) > 1.0;
  const vehicleIcon   = VEHICLE_ICON[driver.vehicleType] ?? 'car-outline';
  const initials      = `${driver.firstName?.[0] ?? ''}${driver.lastName?.[0] ?? ''}`;
  const fareColor     = floorActive ? C.surge : C.brand;

  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.975, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,     useNativeDriver: true, tension: 300, friction: 20 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        style={[dc.card, {
          backgroundColor: theme.backgroundAlt,
          borderColor: floorActive ? C.surge + '55' : theme.border,
          borderWidth: floorActive ? 1.5 : 1,
        }]}
        onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}
      >
        {floorActive && (
          <View style={[dc.rateBadge, { backgroundColor: C.surge }]}>
            <Ionicons name="trending-up" size={9} color="#1a1208" />
            <Text style={dc.rateBadgeTxt}>DRIVER RATE</Text>
          </View>
        )}
        <View style={dc.row}>
          <View style={[dc.avatar, { backgroundColor: fareColor + '20' }]}>
            <Text style={[dc.avatarTxt, { color: fareColor }]}>{initials}</Text>
          </View>
          <View style={dc.info}>
            <View style={dc.nameRow}>
              <Text style={[dc.name, { color: theme.foreground }]}>{driver.firstName} {driver.lastName}</Text>
              <StarRating rating={driver.rating} theme={theme} />
            </View>
            <Text style={[dc.vehicleLine, { color: theme.hint }]}>
              {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel}
            </Text>
            <Text style={[dc.plate, { color: fareColor }]}>{driver.vehiclePlate}</Text>
          </View>
          <View style={dc.fareBlock}>
            {/* Total = effectiveFare + bookingFee — exactly what backend will charge */}
            <Text style={[dc.fareMain, { color: fareColor }]}>
              ₦{totalFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
            <Text style={[dc.fareBreakdown, { color: theme.hint }]}>
              fare + ₦{bookingFee} fee
            </Text>
            <Text style={[dc.etaTxt, { color: theme.hint }]}>~{driver.etaMinutes} min</Text>
          </View>
        </View>
        <View style={dc.chips}>
          <Chip icon={vehicleIcon}      label={driver.vehicleType}                       color={C.purple}   theme={theme} />
          <Chip icon="navigate-outline" label={`${driver.distanceKm} km away`}           color={theme.hint} theme={theme} />
          <Chip icon="road-outline"     label={`${driver.routeKm?.toFixed(1) ?? '?'} km route`} color={theme.hint} theme={theme} />
          <Chip icon="star-outline"     label={`${driver.totalRides} rides`}             color={theme.hint} theme={theme} />
          {driver.surgeLabel && <Chip icon="flash" label={driver.surgeLabel} color={C.red} theme={theme} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
const dc = StyleSheet.create({
  card:         { borderRadius: 18, padding: 14, marginBottom: 10, overflow: 'hidden' },
  rateBadge:    { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderBottomLeftRadius: 14 },
  rateBadgeTxt: { fontSize: T.xs, fontWeight: '900', color: '#1a1208', letterSpacing: 0.8 },
  row:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:       { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:    { fontSize: T.lg, fontWeight: '800' },
  info:         { flex: 1, gap: 2 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:         { fontSize: T.md, fontWeight: '700' },
  vehicleLine:  { fontSize: T.sm, fontWeight: '500' },
  plate:        { fontSize: T.xs, fontWeight: '800', letterSpacing: 1.2 },
  fareBlock:    { alignItems: 'flex-end', gap: 2 },
  fareMain:     { fontSize: T.xl, fontWeight: '900', letterSpacing: -0.5 },
  fareBreakdown:{ fontSize: 9, fontWeight: '500' },
  etaTxt:       { fontSize: T.sm, fontWeight: '500' },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ─── SurgeBar ─────────────────────────────────────────────────────────────────
const SurgeBar = ({ label, theme }) => (
  <View style={[sgS.wrap, { backgroundColor: C.surge + '12', borderColor: C.surge + '35' }]}>
    <Ionicons name="flash" size={13} color={C.surge} />
    <Text style={[sgS.txt, { color: C.surge }]}>{label ?? 'Surge pricing'} — fares are higher than normal</Text>
  </View>
);
const sgS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  txt:  { fontSize: T.sm, fontWeight: '700', flex: 1 },
});

// ─── LocationSearchSheet ──────────────────────────────────────────────────────
const LocationSearchSheet = ({ visible, type, onClose, onSelect, pickupCoords, theme }) => {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef(null);
  const slideA      = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setQuery(''); setResults([]);
      Animated.spring(slideA, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideA, { toValue: height, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const search = (text) => {
    setQuery(text);
    if (text.length < 3) { setResults([]); setLoading(false); return; }
    clearTimeout(searchTimer.current);
    setLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const bias = pickupCoords
          ? `&lat=${pickupCoords.lat}&lon=${pickupCoords.lng}`
          : '&bbox=2.68,6.35,3.70,6.70';
        const url  = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=8&lang=en${bias}`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'DiakiteApp/1.0' } });
        const data = await res.json();
        setResults(
          (data.features ?? []).map(f => ({
            id:          `${f.geometry.coordinates[0]}_${f.geometry.coordinates[1]}`,
            description: [f.properties.name, f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join(', '),
            main:        f.properties.name ?? f.properties.street ?? '',
            secondary:   [f.properties.city, f.properties.country].filter(Boolean).join(', '),
            lat:         f.geometry.coordinates[1],
            lng:         f.geometry.coordinates[0],
          }))
        );
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  };

  const isPickup = type === 'pickup';
  const accent   = isPickup ? C.brand : C.red;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={lss.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[lss.sheet, { backgroundColor: theme.background, borderColor: theme.border, transform: [{ translateY: slideA }] }]}>
          <View style={[lss.handle, { backgroundColor: theme.hint + '44' }]} />
          <View style={lss.header}>
            <View style={[lss.dotWrap, { backgroundColor: accent + '18' }]}>
              <View style={[lss.dot, { backgroundColor: accent }]} />
            </View>
            <Text style={[lss.title, { color: theme.foreground }]}>
              {isPickup ? 'Set Pickup' : 'Set Drop-off'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <View style={[lss.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="close" size={16} color={theme.hint} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[lss.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: accent + '50' }]}>
            <Ionicons name="search" size={16} color={accent} style={{ marginRight: 8 }} />
            <TextInput
              style={[lss.input, { color: theme.foreground }]}
              placeholder={isPickup ? 'Search pickup location…' : 'Search drop-off location…'}
              placeholderTextColor={theme.hint}
              value={query}
              onChangeText={search}
              autoFocus
              autoCapitalize="none"
            />
            {loading && <ActivityIndicator size="small" color={accent} />}
            {query.length > 0 && !loading && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                <Ionicons name="close-circle" size={16} color={theme.hint} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {results.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[lss.resultRow, { borderBottomColor: theme.border }]}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={[lss.resultIcon, { backgroundColor: accent + '12' }]}>
                  <Ionicons name="location-outline" size={14} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[lss.resultMain, { color: theme.foreground }]} numberOfLines={1}>{item.main}</Text>
                  <Text style={[lss.resultSub, { color: theme.hint }]} numberOfLines={1}>{item.secondary}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {results.length === 0 && query.length >= 3 && !loading && (
              <Text style={[lss.noResults, { color: theme.hint }]}>No results found</Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};
const lss = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingTop: 12, height: height * 0.82, flexDirection: 'column' },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  dotWrap:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dot:        { width: 10, height: 10, borderRadius: 5 },
  title:      { flex: 1, fontSize: T.lg, fontWeight: '800' },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  input:      { flex: 1, fontSize: T.md, fontWeight: '500' },
  resultRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  resultIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resultMain: { fontSize: T.base, fontWeight: '600', marginBottom: 2 },
  resultSub:  { fontSize: T.sm, fontWeight: '400' },
  noResults:  { textAlign: 'center', paddingVertical: 24, fontSize: T.sm },
});

// ─── ConfirmSheet ─────────────────────────────────────────────────────────────
const ConfirmSheet = ({ driver, routeParams, onClose, onSuccess, theme }) => {
  const [requesting,     setRequesting]     = useState(false);
  const [pickupAddress,  setPickupAddress]  = useState(routeParams.pickupAddress  ?? '');
  const [pickupLat,      setPickupLat]      = useState(routeParams.pickupLat      ?? null);
  const [pickupLng,      setPickupLng]      = useState(routeParams.pickupLng      ?? null);
  const [dropoffAddress, setDropoffAddress] = useState(routeParams.dropoffAddress ?? '');
  const [dropoffLat,     setDropoffLat]     = useState(routeParams.dropoffLat     ?? null);
  const [dropoffLng,     setDropoffLng]     = useState(routeParams.dropoffLng     ?? null);
  const [searchType,     setSearchType]     = useState(null);

  const insets   = useSafeAreaInsets();
  const slideInY = useRef(new Animated.Value(height)).current;
  const dragY    = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: Animated.event([null, { dy: dragY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dy }) => {
        if (dy > 100) closeSheet();
        else Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (!driver) return;
    slideInY.setValue(height); dragY.setValue(0);
    Animated.spring(slideInY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }).start();
  }, [driver?.driverId]);

  // Keep in sync when routeParams change (user edited location in main screen)
  useEffect(() => {
    setPickupAddress(routeParams.pickupAddress  ?? '');
    setPickupLat(routeParams.pickupLat      ?? null);
    setPickupLng(routeParams.pickupLng      ?? null);
    setDropoffAddress(routeParams.dropoffAddress ?? '');
    setDropoffLat(routeParams.dropoffLat     ?? null);
    setDropoffLng(routeParams.dropoffLng     ?? null);
  }, [routeParams]);

  if (!driver) return null;

  // Fare comes entirely from driver object — backend computed it from the actual route
  const effectiveFare  = driver.effectiveFare ?? 0;
  const bookingFee     = driver.bookingFee ?? 100;
  const estimatedTotal = effectiveFare + bookingFee;
  const floorActive    = (driver.floorMultiplier ?? 1.0) > 1.0;
  const accent         = floorActive ? C.surge : C.brand;
  const vehicleIcon    = VEHICLE_ICON[driver.vehicleType] ?? 'car-outline';
  const initials       = `${driver.firstName?.[0] ?? ''}${driver.lastName?.[0] ?? ''}`;

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideInY, { toValue: height, duration: 220, useNativeDriver: true }),
      Animated.timing(dragY,    { toValue: 0,      duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  const handleRequest = async () => {
    if (!pickupAddress || pickupLat == null || pickupLng == null) {
      Alert.alert('Missing Pickup', 'Please set a pickup location.'); return;
    }
    if (!dropoffAddress || dropoffLat == null || dropoffLng == null) {
      Alert.alert('Missing Drop-off', 'Please set a drop-off location.'); return;
    }
    setRequesting(true);
    try {
      const res = await rideAPI.requestSpecificDriver({
        pickupAddress,
        pickupLat:     parseFloat(pickupLat),
        pickupLng:     parseFloat(pickupLng),
        dropoffAddress,
        dropoffLat:    parseFloat(dropoffLat),
        dropoffLng:    parseFloat(dropoffLng),
        driverId:      driver.driverId,
        vehicleType:   driver.vehicleType,
        paymentMethod: 'CASH',
        ...(floorActive && driver.preferredFloorPrice
          ? { driverFloorPrice: driver.preferredFloorPrice } : {}),
      });
      onSuccess(res?.data?.ride ?? res?.ride);
    } catch (err) {
      Alert.alert(
        'Could not request',
        err?.response?.data?.message ?? err?.message ?? err?.error ?? 'Please try again.'
      );
      setRequesting(false);
    }
  };

  // Location field row — search only (no map pin on this screen, no map available)
  const LocationField = ({ label, value, accent: ac, onSearch }) => (
    <View style={[lfS.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={[lfS.dot, { backgroundColor: ac }]} />
      <View style={{ flex: 1 }}>
        <Text style={[lfS.label, { color: theme.hint }]}>{label}</Text>
        <Text style={[lfS.addr, { color: value ? theme.foreground : theme.hint }]} numberOfLines={2}>
          {value || 'Tap to set'}
        </Text>
      </View>
      <TouchableOpacity style={[lfS.btn, { backgroundColor: ac + '15', borderColor: ac + '40' }]} onPress={onSearch}>
        <Ionicons name="pencil-outline" size={13} color={ac} />
        <Text style={[lfS.btnTxt, { color: ac }]}>Change</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Modal visible={!!driver} animationType="none" transparent statusBarTranslucent onRequestClose={closeSheet}>
        <View style={csS.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeSheet} activeOpacity={1} />
          <Animated.View style={[csS.sheet, {
            backgroundColor: theme.background,
            borderColor: theme.border,
            transform: [{ translateY: Animated.add(slideInY, dragY) }],
          }]}>
            <View {...panResponder.panHandlers} style={[csS.handle, { backgroundColor: theme.hint + '44' }]} />

            <View style={csS.header}>
              <Text style={[csS.title, { color: theme.foreground }]}>Review & Confirm</Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <View style={[csS.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="close" size={16} color={theme.hint} />
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={csS.scroll}>

              {/* Driver summary */}
              <View style={[csS.driverCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={[csS.dAvatar, { backgroundColor: accent + '20' }]}>
                  <Text style={[csS.dAvatarTxt, { color: accent }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[csS.dName, { color: theme.foreground }]}>{driver.firstName} {driver.lastName}</Text>
                  <Text style={[csS.dVehicle, { color: theme.hint }]}>
                    {driver.vehicleColor} {driver.vehicleMake} •{' '}
                    <Text style={{ color: accent, fontWeight: '800' }}>{driver.vehiclePlate}</Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StarRating rating={driver.rating} size={12} theme={theme} />
                  <Text style={[csS.dEta, { color: theme.hint }]}>~{driver.etaMinutes} min away</Text>
                </View>
              </View>

              {/* Editable pickup & dropoff */}
              <Text style={[csS.sectionLabel, { color: theme.hint }]}>ROUTE</Text>
              <LocationField
                label="PICKUP"
                value={pickupAddress}
                accent={C.brand}
                onSearch={() => setSearchType('pickup')}
              />
              <View style={[csS.connector, { borderColor: theme.border }]} />
              <LocationField
                label="DROP-OFF"
                value={dropoffAddress}
                accent={C.red}
                onSearch={() => setSearchType('dropoff')}
              />

              {/* Fare breakdown — all from driver object, no assumptions */}
              <Text style={[csS.sectionLabel, { color: theme.hint, marginTop: 16 }]}>FARE BREAKDOWN</Text>
              <View style={[csS.fareCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>

                <View style={csS.fareRow}>
                  <Text style={[csS.fareLabel, { color: theme.hint }]}>Route distance</Text>
                  <Text style={[csS.fareVal, { color: theme.foreground }]}>
                    {driver.routeKm?.toFixed(2) ?? '—'} km
                  </Text>
                </View>

                <View style={csS.fareRow}>
                  <Text style={[csS.fareLabel, { color: theme.hint }]}>Ride fare</Text>
                  <Text style={[csS.fareVal, { color: theme.foreground }]}>
                    ₦{effectiveFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>

                {floorActive && (
                  <View style={csS.fareRow}>
                    <Text style={[csS.fareLabel, { color: C.surge }]}>Floor price applied (+{Math.round((driver.floorMultiplier - 1) * 100)}%)</Text>
                    <Ionicons name="trending-up" size={13} color={C.surge} />
                  </View>
                )}

                <View style={csS.fareRow}>
                  <Text style={[csS.fareLabel, { color: theme.hint }]}>Booking fee</Text>
                  <Text style={[csS.fareVal, { color: theme.foreground }]}>₦{bookingFee}</Text>
                </View>

                <View style={[csS.fareSep, { backgroundColor: theme.border }]} />

                <View style={csS.fareRow}>
                  <Text style={[csS.fareLabel, { color: theme.foreground, fontWeight: '700' }]}>Estimated total</Text>
                  <Text style={[csS.fareTotal, { color: accent }]}>
                    ₦{estimatedTotal.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>

                <View style={[csS.fareNote, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="information-circle-outline" size={13} color={theme.hint} />
                  <Text style={[csS.fareNoteTxt, { color: theme.hint }]}>
                    Final fare recalculated at trip end based on actual distance and time.
                  </Text>
                </View>
              </View>

              {driver.surgeLabel && (
                <View style={[csS.surgeNote, { backgroundColor: C.red + '10', borderColor: C.red + '30' }]}>
                  <Ionicons name="flash" size={13} color={C.red} />
                  <Text style={[csS.surgeNoteTxt, { color: C.red }]}>
                    {driver.surgeLabel} — surge pricing is active
                  </Text>
                </View>
              )}

              <View style={csS.chipsRow}>
                <Chip icon={vehicleIcon}      label={driver.vehicleType}                              color={C.purple}   theme={theme} />
                <Chip icon="navigate-outline" label={`${driver.distanceKm} km away`}                  color={theme.hint} theme={theme} />
                <Chip icon="time-outline"     label={`~${driver.etaMinutes} min`}                     color={theme.hint} theme={theme} />
                <Chip icon="star-outline"     label={`${driver.totalRides} rides`}                    color={theme.hint} theme={theme} />
              </View>
            </ScrollView>

            <View style={[csS.cta, { borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity style={[csS.back, { borderColor: theme.border }]} onPress={closeSheet} disabled={requesting}>
                <Text style={[csS.backTxt, { color: theme.hint }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[csS.confirm, { backgroundColor: accent, opacity: requesting ? 0.72 : 1 }]}
                onPress={handleRequest}
                disabled={requesting}
                activeOpacity={0.86}
              >
                {requesting
                  ? <ActivityIndicator color="#000" size="small" />
                  : (<>
                      <Ionicons name="checkmark-circle" size={19} color="#000" />
                      <Text style={csS.confirmTxt}>Request Driver</Text>
                    </>)
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Location search sheet inside confirm sheet */}
      <LocationSearchSheet
        visible={searchType !== null}
        type={searchType}
        onClose={() => setSearchType(null)}
        onSelect={(item) => {
          if (searchType === 'pickup') {
            setPickupLat(item.lat); setPickupLng(item.lng); setPickupAddress(item.description);
          } else {
            setDropoffLat(item.lat); setDropoffLng(item.lng); setDropoffAddress(item.description);
          }
        }}
        pickupCoords={pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng } : null}
        theme={theme}
      />
    </>
  );
};

const lfS = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  dot:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  label:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr:   { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, flexShrink: 0 },
  btnTxt: { fontSize: 11, fontWeight: '700' },
});

const csS = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingTop: 12, height: height * 0.9, flexDirection: 'column', shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 20 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title:       { fontSize: T.xl, fontWeight: '800' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  driverCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  dAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  dAvatarTxt:  { fontSize: T.lg, fontWeight: '800' },
  dName:       { fontSize: T.md, fontWeight: '700', marginBottom: 3 },
  dVehicle:    { fontSize: T.sm, fontWeight: '500' },
  dEta:        { fontSize: T.xs, fontWeight: '500' },
  sectionLabel:{ fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 8, marginTop: 4 },
  connector:   { width: 1.5, height: 8, marginLeft: 16, borderLeftWidth: 1.5, borderStyle: 'dashed', marginVertical: 2 },
  fareCard:    { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  fareRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel:   { fontSize: T.sm, fontWeight: '500', flex: 1 },
  fareVal:     { fontSize: T.sm, fontWeight: '700' },
  fareSep:     { height: 1, marginVertical: 2 },
  fareTotal:   { fontSize: T.lg, fontWeight: '900' },
  fareNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 8, borderWidth: 1, padding: 8, marginTop: 4 },
  fareNoteTxt: { flex: 1, fontSize: 11, lineHeight: 16 },
  surgeNote:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10 },
  surgeNoteTxt:{ flex: 1, fontSize: T.sm, fontWeight: '600' },
  chipsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cta:         { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
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

  // Editable locations — seeded from navigation params
  const [pickupAddress,  setPickupAddress]  = useState(params.pickupAddress  ?? '');
  const [pickupLat,      setPickupLat]      = useState(params.pickupLat      ?? null);
  const [pickupLng,      setPickupLng]      = useState(params.pickupLng      ?? null);
  const [dropoffAddress, setDropoffAddress] = useState(params.dropoffAddress ?? '');
  const [dropoffLat,     setDropoffLat]     = useState(params.dropoffLat     ?? null);
  const [dropoffLng,     setDropoffLng]     = useState(params.dropoffLng     ?? null);
  const [searchModal,    setSearchModal]    = useState(null); // 'pickup' | 'dropoff'

  const [drivers,        setDrivers]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  // Auto-detect pickup if not passed in
  useEffect(() => {
    if (!pickupLat || !pickupLng) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc  = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const addr = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
          setPickupLat(loc.coords.latitude);
          setPickupLng(loc.coords.longitude);
          setPickupAddress(addr);
        } catch {}
      })();
    }
  }, []);

  // Load drivers — backend returns per-driver effectiveFare from real route distance
  const load = useCallback(async (silent = false) => {
    const pLat = parseFloat(pickupLat  ?? params.pickupLat);
    const pLng = parseFloat(pickupLng  ?? params.pickupLng);
    const dLat = parseFloat(dropoffLat ?? params.dropoffLat);
    const dLng = parseFloat(dropoffLng ?? params.dropoffLng);

    if (!pLat || !pLng) return;

    if (!silent) setLoading(true);
    try {
      const res  = await rideAPI.getNearbyDrivers({
        pickupLat:   pLat,
        pickupLng:   pLng,
        dropoffLat:  dLat  || undefined,
        dropoffLng:  dLng  || undefined,
        radiusKm:    15,
        vehicleType: params.vehicleType,
      });
      // Each driver in the response already has effectiveFare, bookingFee, routeKm
      // computed by the backend from the actual pickup→dropoff distance.
      setDrivers(res?.data?.drivers ?? []);
    } catch (err) {
      Alert.alert('Could not load drivers', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, params]);

  useEffect(() => { load(); }, []);

  // Reload when locations change
  useEffect(() => {
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) load(true);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleSearchSelect = (item) => {
    if (searchModal === 'pickup') {
      setPickupLat(item.lat); setPickupLng(item.lng); setPickupAddress(item.description);
    } else {
      setDropoffLat(item.lat); setDropoffLng(item.lng); setDropoffAddress(item.description);
    }
    setSearchModal(null);
  };

  const handleRideRequested = (ride) => {
    setSelectedDriver(null);
    navigation.replace('RideTracking', { rideId: ride?.id, ride });
  };

  const routeParams = {
    pickupAddress,  pickupLat,  pickupLng,
    dropoffAddress, dropoffLat, dropoffLng,
    vehicleType: params.vehicleType,
  };

  const surgeActive = drivers.some(d => (d.surgeMultiplier ?? 1) > 1);
  const surgeLabel  = drivers.find(d => d.surgeLabel)?.surgeLabel;

  // ── Location strip at top of screen ──────────────────────────────────────
  const LocationStrip = () => (
    <View style={[lstrip.wrap, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
      <View style={lstrip.inner}>
        {/* Route dots */}
        <View style={lstrip.dotCol}>
          <View style={[lstrip.dot, { backgroundColor: C.brand }]} />
          <View style={[lstrip.line, { backgroundColor: theme.border }]} />
          <View style={[lstrip.dot, { backgroundColor: C.red }]} />
        </View>
        {/* Addresses */}
        <View style={{ flex: 1, gap: 6 }}>
          <TouchableOpacity
            style={[lstrip.field, { backgroundColor: theme.background, borderColor: C.brand + '40' }]}
            onPress={() => setSearchModal('pickup')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[lstrip.fieldLabel, { color: C.brand }]}>PICKUP</Text>
              <Text style={[lstrip.fieldAddr, { color: pickupLat ? theme.foreground : theme.hint }]} numberOfLines={1}>
                {pickupAddress || 'Set pickup location'}
              </Text>
            </View>
            <Ionicons name="pencil-outline" size={13} color={C.brand} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[lstrip.field, { backgroundColor: theme.background, borderColor: C.red + '40' }]}
            onPress={() => setSearchModal('dropoff')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[lstrip.fieldLabel, { color: C.red }]}>DROP-OFF</Text>
              <Text style={[lstrip.fieldAddr, { color: dropoffLat ? theme.foreground : theme.hint }]} numberOfLines={1}>
                {dropoffAddress || 'Set drop-off location'}
              </Text>
            </View>
            <Ionicons name="pencil-outline" size={13} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

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
            <Text style={[s.headerSub, { color: theme.hint }]}>Prices shown include booking fee</Text>
          </View>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={18} color={C.brand} />
          </TouchableOpacity>
        </View>

        <LocationStrip />
        {surgeActive && <SurgeBar label={surgeLabel} theme={theme} />}
      </SafeAreaView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
          <Text style={[s.loadTxt, { color: theme.hint }]}>Finding drivers near you…</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={drivers}
            keyExtractor={d => String(d.driverId)}
            renderItem={({ item }) => (
              <DriverCard
                driver={item}
                onPress={() => setSelectedDriver(item)}
                theme={theme}
              />
            )}
            contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
            ListHeaderComponent={drivers.length > 0 ? (
              <View style={s.listHead}>
                <Text style={[s.listCount, { color: theme.hint }]}>
                  {drivers.length} driver{drivers.length !== 1 ? 's' : ''} nearby
                </Text>
                {drivers.some(d => (d.floorMultiplier ?? 1) > 1) && (
                  <Chip icon="trending-up" label="Some drivers have floor rates" color={C.surge} theme={theme} small />
                )}
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="car-outline" size={36} color={theme.hint} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No drivers nearby</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>
                  {!dropoffLat ? 'Set a drop-off location to see accurate fares.' : 'Pull down to refresh or try a larger area.'}
                </Text>
                <TouchableOpacity style={[s.retryBtn, { backgroundColor: C.brand }]} onPress={onRefresh}>
                  <Text style={s.retryTxt}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>
      )}

      {/* Location search modal */}
      <LocationSearchSheet
        visible={searchModal !== null}
        type={searchModal}
        onClose={() => setSearchModal(null)}
        onSelect={handleSearchSelect}
        pickupCoords={pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng } : null}
        theme={theme}
      />

      {/* Confirm & request sheet */}
      <ConfirmSheet
        driver={selectedDriver}
        routeParams={routeParams}
        onClose={() => setSelectedDriver(null)}
        onSuccess={handleRideRequested}
        theme={theme}
      />
    </View>
  );
}

const lstrip = StyleSheet.create({
  wrap:       { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  inner:      { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  dotCol:     { alignItems: 'center', paddingTop: 14, paddingBottom: 14 },
  dot:        { width: 9, height: 9, borderRadius: 5 },
  line:       { width: 1.5, flex: 1, marginVertical: 3 },
  field:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  fieldLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  fieldAddr:  { fontSize: 12, fontWeight: '500' },
});

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: T.lg, fontWeight: '800' },
  headerSub:   { fontSize: T.xs, fontWeight: '500', marginTop: 1 },
  list:        { paddingHorizontal: 14, paddingTop: 12 },
  listHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  listCount:   { fontSize: T.sm, fontWeight: '700' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadTxt:     { fontSize: T.base, fontWeight: '500' },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 36, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:  { fontSize: T.lg, fontWeight: '800' },
  emptySub:    { fontSize: T.sm, textAlign: 'center', maxWidth: 240 },
  retryBtn:    { marginTop: 4, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 },
  retryTxt:    { fontSize: T.base, fontWeight: '800', color: '#000' },
});