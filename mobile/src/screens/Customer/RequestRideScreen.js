// mobile/src/screens/Customer/RequestRideScreen.js
//
// Full ride-booking flow:
//   Step 1 → Enter pickup / drop-off  (+ auto-detect location)
//   Step 2 → Map with nearby drivers + fare estimate
//   Step 3 → Choose a driver card → Confirm → requestSpecificDriver()
//
// Dependencies already in the project:
//   expo-location, react-native-maps, @expo/vector-icons,
//   ../../context/ThemeContext, ../../services/api (rideAPI),
//   ../../services/socket (socketService)

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Dimensions, Animated, ScrollView, ActivityIndicator,
  StatusBar, Platform, KeyboardAvoidingView, Alert,
  FlatList, Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { rideAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Lagos, Nigeria default region — shown before GPS resolves
// ─────────────────────────────────────────────────────────────────────────────
const LAGOS_DEFAULT = {
  latitude:      6.5244,
  longitude:     3.3792,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// ─────────────────────────────────────────────────────────────────────────────
// Fare calculation (mirrors backend helpers.js)
// BASE = ₦500, ₦120/km, minimum ₦300
// ─────────────────────────────────────────────────────────────────────────────
const calcFare = (distanceKm) => {
  const base = 500;
  const perKm = 120;
  return Math.max(300, base + distanceKm * perKm);
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─────────────────────────────────────────────────────────────────────────────
// Dark map style — deep charcoal, gold road highlights (matches app palette)
// ─────────────────────────────────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
  { featureType: 'road',               elementType: 'geometry',           stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',    stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway',       elementType: 'geometry',           stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',    stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill',   stylers: [{ color: '#C9A96E' }] },
  { featureType: 'water',              elementType: 'geometry',           stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'water',              elementType: 'labels.text.fill',   stylers: [{ color: '#515c6d' }] },
  { featureType: 'poi',                elementType: 'labels',             stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            elementType: 'labels',             stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',     elementType: 'geometry',           stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// DriverPin — custom animated map marker for each nearby driver
// ─────────────────────────────────────────────────────────────────────────────
const DriverPin = ({ driver, selected, onPress, accentColor }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scaleA, {
      toValue: selected ? 1.3 : 1,
      tension: 160, friction: 7,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  return (
    <Marker
      coordinate={{ latitude: driver.currentLat, longitude: driver.currentLng }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <Animated.View style={[dp.wrap, selected && { borderColor: accentColor }, { transform: [{ scale: scaleA }] }]}>
        <View style={[dp.inner, selected && { backgroundColor: accentColor + '22' }]}>
          <Ionicons name="car" size={14} color={selected ? accentColor : '#FFFFFF'} />
        </View>
        {selected && <View style={[dp.pulse, { borderColor: accentColor }]} />}
      </Animated.View>
    </Marker>
  );
};
const dp = StyleSheet.create({
  wrap:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
  inner: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  pulse: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, opacity: 0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// DriverCard — bottom sheet card for a single available driver
// ─────────────────────────────────────────────────────────────────────────────
const DriverCard = ({ driver, selected, onSelect, accentColor, theme }) => {
  const borderColor = selected ? accentColor : theme.border;
  const bg          = selected ? accentColor + '12' : theme.backgroundAlt;

  return (
    <TouchableOpacity
      onPress={() => onSelect(driver)}
      activeOpacity={0.85}
      style={[dc.card, { backgroundColor: bg, borderColor }]}
    >
      {/* Avatar */}
      <View style={[dc.avatarWrap, { borderColor: selected ? accentColor : theme.border }]}>
        {driver.profileImage ? (
          <Image source={{ uri: driver.profileImage }} style={dc.avatar} />
        ) : (
          <View style={[dc.avatarFallback, { backgroundColor: accentColor + '22' }]}>
            <Text style={[dc.avatarInitial, { color: accentColor }]}>
              {driver.firstName?.[0]}{driver.lastName?.[0]}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[dc.name, { color: theme.foreground }]} numberOfLines={1}>
          {driver.firstName} {driver.lastName}
        </Text>
        <Text style={[dc.vehicle, { color: theme.hint }]} numberOfLines={1}>
          {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel} · {driver.vehiclePlate}
        </Text>
        <View style={dc.meta}>
          <Ionicons name="star" size={11} color="#C9A96E" />
          <Text style={[dc.metaTxt, { color: theme.hint }]}> {driver.rating?.toFixed(1) ?? '–'}</Text>
          <Text style={[dc.dot, { color: theme.border }]}>  ·  </Text>
          <Ionicons name="time-outline" size={11} color={theme.hint} />
          <Text style={[dc.metaTxt, { color: theme.hint }]}> {driver.etaMinutes} min</Text>
          <Text style={[dc.dot, { color: theme.border }]}>  ·  </Text>
          <Ionicons name="location-outline" size={11} color={theme.hint} />
          <Text style={[dc.metaTxt, { color: theme.hint }]}> {driver.distanceKm?.toFixed(1)} km</Text>
        </View>
      </View>

      {/* Select indicator */}
      <View style={[dc.radio, { borderColor: selected ? accentColor : theme.border }]}>
        {selected && <View style={[dc.radioDot, { backgroundColor: accentColor }]} />}
      </View>
    </TouchableOpacity>
  );
};
const dc = StyleSheet.create({
  card:         { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 10 },
  avatarWrap:   { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden' },
  avatar:       { width: '100%', height: '100%' },
  avatarFallback:{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '800' },
  name:         { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehicle:      { fontSize: 11, marginBottom: 5 },
  meta:         { flexDirection: 'row', alignItems: 'center' },
  metaTxt:      { fontSize: 11 },
  dot:          { fontSize: 11 },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  radioDot:     { width: 10, height: 10, borderRadius: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LocationInput row — used for both pickup and dropoff
// ─────────────────────────────────────────────────────────────────────────────
const LocationInput = ({ icon, iconColor, placeholder, value, onChangeText, onFocus, focused, theme }) => (
  <View style={[li.wrap, focused && { borderColor: iconColor }, { backgroundColor: theme.backgroundAlt, borderColor: focused ? iconColor : theme.border }]}>
    <View style={[li.iconWrap, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={15} color={iconColor} />
    </View>
    <TextInput
      style={[li.input, { color: theme.foreground }]}
      placeholder={placeholder}
      placeholderTextColor={theme.hint}
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      returnKeyType="done"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={16} color={theme.hint} />
      </TouchableOpacity>
    )}
  </View>
);
const li = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11, gap: 10, marginBottom: 10 },
  iconWrap:{ width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  input:   { flex: 1, fontSize: 14, fontWeight: '500' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP indicators (top strip)
// ─────────────────────────────────────────────────────────────────────────────
const StepDots = ({ step, accentColor, theme }) => (
  <View style={sd.wrap}>
    {[1, 2, 3].map(s => (
      <View
        key={s}
        style={[
          sd.dot,
          s === step
            ? { backgroundColor: accentColor, width: 22 }
            : s < step
            ? { backgroundColor: accentColor + '50' }
            : { backgroundColor: theme.border },
        ]}
      />
    ))}
  </View>
);
const sd = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  dot:  { height: 6, width: 6, borderRadius: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestRideScreen({ navigation }) {
  const { theme } = useTheme();
  const accentColor = theme.accent;

  // ── Location state ────────────────────────────────────────────────────────
  const [myLocation,      setMyLocation]      = useState(null);
  const [pickupAddress,   setPickupAddress]   = useState('');
  const [dropoffAddress,  setDropoffAddress]  = useState('');
  const [pickupCoords,    setPickupCoords]    = useState(null);   // { lat, lng }
  const [dropoffCoords,   setDropoffCoords]   = useState(null);
  const [focusedInput,    setFocusedInput]    = useState(null);   // 'pickup' | 'dropoff'

  // ── Map & drivers ─────────────────────────────────────────────────────────
  const mapRef            = useRef(null);
  const [drivers,         setDrivers]         = useState([]);
  const [selectedDriver,  setSelectedDriver]  = useState(null);
  const [loadingDrivers,  setLoadingDrivers]  = useState(false);

  // ── Fare ──────────────────────────────────────────────────────────────────
  const [distanceKm,      setDistanceKm]      = useState(null);
  const [fareEstimate,    setFareEstimate]     = useState(null);
  const [etaMinutes,      setEtaMinutes]       = useState(null);
  const [loadingFare,     setLoadingFare]      = useState(false);

  // ── Flow ──────────────────────────────────────────────────────────────────
  const [step,            setStep]            = useState(1);   // 1=inputs, 2=map+drivers, 3=confirm
  const [requesting,      setRequesting]      = useState(false);

  // ── Animations ────────────────────────────────────────────────────────────
  const sheetY   = useRef(new Animated.Value(0)).current;
  const fadeA    = useRef(new Animated.Value(1)).current;

  // ─────────────────────────────────────────────────────────────────────────
  // On mount: get GPS, join socket
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setMyLocation(coords);
      setPickupCoords(coords);

      // Reverse geocode for pickup label
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.lat, longitude: coords.lng,
      }).catch(() => []);
      if (place) {
        const label = [place.name, place.street, place.district].filter(Boolean).join(', ');
        setPickupAddress(label || 'Current Location');
      } else {
        setPickupAddress('Current Location');
      }
    })();

    socketService.connect?.();
    return () => {};
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Proceed to Step 2: fetch fare + nearby drivers
  // ─────────────────────────────────────────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Missing locations', 'Please enter both pickup and drop-off locations.');
      return;
    }

    // If coords not resolved yet, geocode them
    let pCoords = pickupCoords;
    let dCoords = dropoffCoords;

    if (!pCoords) {
      const res = await Location.geocodeAsync(pickupAddress).catch(() => []);
      if (res?.[0]) pCoords = { lat: res[0].latitude, lng: res[0].longitude };
      else {
        Alert.alert('Location not found', `Could not find "${pickupAddress}". Try a more specific address.`);
        return;
      }
      setPickupCoords(pCoords);
    }
    if (!dCoords) {
      const res = await Location.geocodeAsync(dropoffAddress).catch(() => []);
      if (res?.[0]) dCoords = { lat: res[0].latitude, lng: res[0].longitude };
      else {
        Alert.alert('Location not found', `Could not find "${dropoffAddress}". Try a more specific address.`);
        return;
      }
      setDropoffCoords(dCoords);
    }

    // Calc fare
    const km = haversineKm(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
    const fare = calcFare(km);
    const eta  = Math.ceil(km / 0.5);
    setDistanceKm(km);
    setFareEstimate(fare);
    setEtaMinutes(eta);

    // Fetch nearby drivers from backend — real API call
    setLoadingDrivers(true);
    try {
      const res = await rideAPI.getNearbyDrivers({
        pickupLat: pCoords.lat,
        pickupLng: pCoords.lng,
        radiusKm:  15,
      });
      // Backend returns: { success, data: { drivers: [...], total } }
      const list = res?.data?.drivers ?? res?.drivers ?? [];
      setDrivers(list);
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Could not load nearby drivers.';
      Alert.alert('Drivers unavailable', msg);
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }

    // Animate transition
    Animated.timing(fadeA, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(2);
      Animated.timing(fadeA, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    // Pan map to show both pins
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: pCoords.lat, longitude: pCoords.lng },
          { latitude: dCoords.lat, longitude: dCoords.lng },
        ],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      );
    }, 500);
  }, [pickupAddress, dropoffAddress, pickupCoords, dropoffCoords]);

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm & request ride
  // ─────────────────────────────────────────────────────────────────────────
  const confirmRide = async () => {
    if (!selectedDriver) {
      Alert.alert('Select a driver', 'Please choose a driver from the list.');
      return;
    }
    setRequesting(true);
    try {
      // POST /api/rides/request-driver → targeted request to chosen driver
      await rideAPI.requestSpecificDriver({
        pickupAddress,
        pickupLat:     pickupCoords.lat,
        pickupLng:     pickupCoords.lng,
        dropoffAddress,
        dropoffLat:    dropoffCoords.lat,
        dropoffLng:    dropoffCoords.lng,
        driverId:      selectedDriver.driverId,
        estimatedFare: fareEstimate,
        paymentMethod: 'CASH',
      });

      // Navigate to live tracking screen — defined in HomeStack navigator
      if (navigation.replace) {
        navigation.replace('RideTracking');
      } else {
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Could not book the ride. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Select a driver → pan map to them
  // ─────────────────────────────────────────────────────────────────────────
  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
    mapRef.current?.animateToRegion({
      latitude:      driver.currentLat,
      longitude:     driver.currentLng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 600);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const mapRegion = myLocation
    ? { latitude: myLocation.lat, longitude: myLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : LAGOS_DEFAULT;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── FULL-SCREEN MAP ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Pickup pin */}
        {pickupCoords && (
          <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.pickupPin}>
              <Ionicons name="radio-button-on" size={20} color={accentColor} />
            </View>
          </Marker>
        )}

        {/* Dropoff pin */}
        {dropoffCoords && (
          <Marker coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.dropoffPin}>
              <Ionicons name="location" size={24} color="#E05555" />
            </View>
          </Marker>
        )}

        {/* Route line */}
        {pickupCoords && dropoffCoords && (
          <Polyline
            coordinates={[
              { latitude: pickupCoords.lat,  longitude: pickupCoords.lng  },
              { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
            ]}
            strokeColor={accentColor}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}

        {/* Nearby driver pins */}
        {step >= 2 && drivers.map((d) => (
          <DriverPin
            key={d.driverId}
            driver={d}
            selected={selectedDriver?.driverId === d.driverId}
            onPress={() => handleSelectDriver(d)}
            accentColor={accentColor}
          />
        ))}
      </MapView>

      {/* Ambient top gradient */}
      <View style={s.topGradient} pointerEvents="none" />

      {/* ── BACK BUTTON ── */}
      <TouchableOpacity
        style={[s.backBtn, { backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* ── BOTTOM SHEET ── */}
      <Animated.View
        style={[s.sheet, { backgroundColor: theme.background, borderColor: theme.border, opacity: fadeA }]}
      >
        {/* Step dots */}
        <StepDots step={step} accentColor={accentColor} theme={theme} />

        {/* ── STEP 1: Location inputs ── */}
        {step === 1 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text style={[s.sheetTitle, { color: theme.foreground }]}>Where to?</Text>
            <Text style={[s.sheetSub, { color: theme.hint }]}>Enter your pickup and destination</Text>

            <View style={s.routeLine}>
              <View style={s.routeDots}>
                <View style={[s.dotGreen, { backgroundColor: accentColor }]} />
                <View style={[s.routeVert, { backgroundColor: theme.border }]} />
                <View style={s.dotRed} />
              </View>
              <View style={{ flex: 1 }}>
                <LocationInput
                  icon="radio-button-on"
                  iconColor={accentColor}
                  placeholder="Pickup location"
                  value={pickupAddress}
                  onChangeText={setPickupAddress}
                  onFocus={() => setFocusedInput('pickup')}
                  focused={focusedInput === 'pickup'}
                  theme={theme}
                />
                <LocationInput
                  icon="location"
                  iconColor="#E05555"
                  placeholder="Drop-off destination"
                  value={dropoffAddress}
                  onChangeText={(t) => { setDropoffAddress(t); setDropoffCoords(null); }}
                  onFocus={() => setFocusedInput('dropoff')}
                  focused={focusedInput === 'dropoff'}
                  theme={theme}
                />
              </View>
            </View>

            {/* Quick Lagos destinations */}
            <Text style={[s.quickLabel, { color: theme.hint }]}>POPULAR DESTINATIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {QUICK_DESTINATIONS.map((d) => (
                <TouchableOpacity
                  key={d.label}
                  style={[s.quickChip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                  onPress={() => { setDropoffAddress(d.label); setDropoffCoords({ lat: d.lat, lng: d.lng }); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={d.icon} size={13} color={accentColor} />
                  <Text style={[s.quickChipTxt, { color: theme.foreground }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: accentColor }]}
              onPress={proceedToMap}
              activeOpacity={0.88}
            >
              <Ionicons name="map-outline" size={18} color="#FFFFFF" />
              <Text style={s.primaryBtnTxt}>Find Available Riders</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}

        {/* ── STEP 2: Nearby drivers + fare ── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            {/* Fare summary strip */}
            <View style={[s.fareBadge, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.fareItem}>
                <Ionicons name="navigate-outline" size={14} color={theme.hint} />
                <Text style={[s.fareVal, { color: theme.foreground }]}>{distanceKm?.toFixed(1)} km</Text>
              </View>
              <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
              <View style={s.fareItem}>
                <Ionicons name="time-outline" size={14} color={theme.hint} />
                <Text style={[s.fareVal, { color: theme.foreground }]}>~{etaMinutes} min</Text>
              </View>
              <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
              <View style={s.fareItem}>
                <Ionicons name="cash-outline" size={14} color={theme.hint} />
                <Text style={[s.fareVal, { color: accentColor }]}>
                  ₦{fareEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>

            <Text style={[s.sheetTitle, { color: theme.foreground, marginTop: 14 }]}>
              {loadingDrivers ? 'Finding drivers…' : `${drivers.length} driver${drivers.length !== 1 ? 's' : ''} nearby`}
            </Text>
            <Text style={[s.sheetSub, { color: theme.hint }]}>Tap a driver to select them</Text>

            {loadingDrivers ? (
              <ActivityIndicator color={accentColor} style={{ marginTop: 24 }} />
            ) : drivers.length === 0 ? (
              <View style={s.noDrivers}>
                <Ionicons name="car-outline" size={36} color={theme.hint} />
                <Text style={[s.noDriversTxt, { color: theme.hint }]}>No drivers available right now</Text>
                <TouchableOpacity onPress={proceedToMap} style={[s.retryBtn, { borderColor: accentColor + '50' }]}>
                  <Text style={[s.retryTxt, { color: accentColor }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={drivers}
                keyExtractor={(d) => d.driverId}
                renderItem={({ item }) => (
                  <DriverCard
                    driver={item}
                    selected={selectedDriver?.driverId === item.driverId}
                    onSelect={handleSelectDriver}
                    accentColor={accentColor}
                    theme={theme}
                  />
                )}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 220 }}
                nestedScrollEnabled
              />
            )}

            {selectedDriver && (
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]}
                onPress={() => setStep(3)}
                activeOpacity={0.88}
              >
                <Text style={s.primaryBtnTxt}>Continue with {selectedDriver.firstName}</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP 3: Confirm ride ── */}
        {step === 3 && selectedDriver && (
          <View>
            <Text style={[s.sheetTitle, { color: theme.foreground }]}>Confirm Ride</Text>

            {/* Route summary */}
            <View style={[s.confirmRoute, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.confirmRow}>
                <View style={[s.cDot, { backgroundColor: accentColor }]} />
                <Text style={[s.confirmAddr, { color: theme.foreground }]} numberOfLines={2}>{pickupAddress}</Text>
              </View>
              <View style={[s.confirmRouteLine, { backgroundColor: theme.border }]} />
              <View style={s.confirmRow}>
                <View style={[s.cDot, { backgroundColor: '#E05555' }]} />
                <Text style={[s.confirmAddr, { color: theme.foreground }]} numberOfLines={2}>{dropoffAddress}</Text>
              </View>
            </View>

            {/* Driver + fare */}
            <View style={[s.confirmCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.confirmDriver}>
                {selectedDriver.profileImage ? (
                  <Image source={{ uri: selectedDriver.profileImage }} style={s.confirmAvatar} />
                ) : (
                  <View style={[s.confirmAvatarFallback, { backgroundColor: accentColor + '22' }]}>
                    <Text style={[s.confirmInitials, { color: accentColor }]}>
                      {selectedDriver.firstName?.[0]}{selectedDriver.lastName?.[0]}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.confirmName, { color: theme.foreground }]}>
                    {selectedDriver.firstName} {selectedDriver.lastName}
                  </Text>
                  <Text style={[s.confirmVehicle, { color: theme.hint }]}>
                    {selectedDriver.vehicleColor} {selectedDriver.vehicleMake} · {selectedDriver.vehiclePlate}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="star" size={12} color="#C9A96E" />
                    <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedDriver.rating?.toFixed(1) ?? '–'}</Text>
                    <Text style={[s.confirmMeta, { color: theme.border }]}>·</Text>
                    <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedDriver.totalRides} trips</Text>
                  </View>
                </View>
                <View style={s.confirmFareBox}>
                  <Text style={[s.confirmFareLabel, { color: theme.hint }]}>FARE</Text>
                  <Text style={[s.confirmFare, { color: accentColor }]}>
                    ₦{fareEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[s.confirmFareLabel, { color: theme.hint }]}>CASH</Text>
                </View>
              </View>
            </View>

            {/* ETA strip */}
            <View style={[s.etaStrip, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}>
              <Ionicons name="time-outline" size={14} color={accentColor} />
              <Text style={[s.etaTxt, { color: accentColor }]}>
                Driver arrives in approx. {selectedDriver.etaMinutes ?? etaMinutes} minutes
              </Text>
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: requesting ? accentColor + '80' : accentColor }]}
              onPress={confirmRide}
              disabled={requesting}
              activeOpacity={0.88}
            >
              {requesting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={s.primaryBtnTxt}>Confirm Ride</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryBtn, { borderColor: theme.border }]}
              onPress={() => setStep(2)}
              activeOpacity={0.8}
            >
              <Text style={[s.secondaryBtnTxt, { color: theme.hint }]}>Change Driver</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick destination chips (common Lagos spots)
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_DESTINATIONS = [
  { label: 'Victoria Island', icon: 'business-outline',    lat: 6.4281,  lng: 3.4219 },
  { label: 'Lekki Phase 1',   icon: 'home-outline',        lat: 6.4433,  lng: 3.5077 },
  { label: 'Ikeja',           icon: 'airplane-outline',    lat: 6.6018,  lng: 3.3515 },
  { label: 'Surulere',        icon: 'football-outline',    lat: 6.5037,  lng: 3.3577 },
  { label: 'Eko Hotel',       icon: 'bed-outline',         lat: 6.4344,  lng: 3.4212 },
  { label: 'Ajah',            icon: 'cart-outline',        lat: 6.4698,  lng: 3.5827 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock nearby drivers for fallback / demo
// ─────────────────────────────────────────────────────────────────────────────
const NAMES = [
  { firstName: 'Emeka',   lastName: 'Okonkwo' },
  { firstName: 'Tunde',   lastName: 'Adeyemi' },
  { firstName: 'Chidi',   lastName: 'Nwosu'   },
  { firstName: 'Babatunde', lastName: 'Alabi' },
  { firstName: 'Segun',   lastName: 'Fadare'  },
];
const CARS = [
  { make: 'Toyota', model: 'Camry',  color: 'Black', plate: 'LND-432-AA' },
  { make: 'Honda',  model: 'Accord', color: 'Silver', plate: 'EKY-881-BA' },
  { make: 'Toyota', model: 'Corolla',color: 'White',  plate: 'KTU-209-CA' },
  { make: 'Hyundai',model: 'Elantra',color: 'Grey',   plate: 'OGS-001-DA' },
  { make: 'Nissan', model: 'Sentra', color: 'Blue',   plate: 'RBS-556-EA' },
];

function generateMockDrivers(center) {
  return NAMES.map((n, i) => {
    const spread = 0.005 + Math.random() * 0.015;
    const angle  = (i / NAMES.length) * 2 * Math.PI;
    const car    = CARS[i];
    const dist   = haversineKm(
      center.lat, center.lng,
      center.lat + Math.sin(angle) * spread,
      center.lng + Math.cos(angle) * spread
    );
    return {
      driverId:    `mock-driver-${i}`,
      firstName:   n.firstName,
      lastName:    n.lastName,
      profileImage: null,
      vehicleMake:  car.make,
      vehicleModel: car.model,
      vehicleColor: car.color,
      vehiclePlate: car.plate,
      vehicleType:  'CAR',
      rating:       3.8 + Math.random() * 1.2,
      totalRides:   40 + Math.floor(Math.random() * 200),
      distanceKm:   parseFloat(dist.toFixed(2)),
      etaMinutes:   Math.max(2, Math.ceil(dist / 0.5)),
      currentLat:   center.lat + Math.sin(angle) * spread,
      currentLng:   center.lng + Math.cos(angle) * spread,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 42,
    left: 20, width: 42, height: 42, borderRadius: 13,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    zIndex: 99,
  },

  pickupPin:  { alignItems: 'center' },
  dropoffPin: { alignItems: 'center' },

  // Bottom sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    maxHeight: height * 0.72,
  },

  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:   { fontSize: 12, fontWeight: '500', marginBottom: 18 },

  // Route input layout
  routeLine:  { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  routeDots:  { alignItems: 'center', paddingTop: 18, gap: 0 },
  dotGreen:   { width: 10, height: 10, borderRadius: 5 },
  routeVert:  { width: 1.5, height: 38 },
  dotRed:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E05555' },

  // Quick chips
  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },

  // Buttons
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn:  { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  secondaryBtnTxt:{ fontSize: 14, fontWeight: '600' },

  // Fare badge
  fareBadge:    { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fareItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  fareVal:      { fontSize: 13, fontWeight: '700' },
  fareDivider:  { width: 1 },

  // No drivers
  noDrivers:   { alignItems: 'center', paddingVertical: 24 },
  noDriversTxt:{ fontSize: 13, marginTop: 10, marginBottom: 14 },
  retryBtn:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:    { fontSize: 13, fontWeight: '700' },

  // Confirm step
  confirmRoute:     { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  confirmRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cDot:             { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmAddr:      { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  confirmRouteLine: { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 4 },

  confirmCard:      { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  confirmDriver:    { flexDirection: 'row', alignItems: 'center' },
  confirmAvatar:    { width: 52, height: 52, borderRadius: 26 },
  confirmAvatarFallback: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  confirmInitials:  { fontSize: 16, fontWeight: '800' },
  confirmName:      { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  confirmVehicle:   { fontSize: 11, marginBottom: 2 },
  confirmMeta:      { fontSize: 11 },
  confirmFareBox:   { alignItems: 'flex-end' },
  confirmFareLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  confirmFare:      { fontSize: 18, fontWeight: '900' },

  etaStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  etaTxt:   { fontSize: 12, fontWeight: '600', flex: 1 },
});