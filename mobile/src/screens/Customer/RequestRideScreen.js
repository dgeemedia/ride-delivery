// mobile/src/screens/Customer/RequestRideScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Dimensions, Animated, ScrollView, ActivityIndicator,
  StatusBar, Platform, KeyboardAvoidingView, Alert,
  FlatList, Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { rideAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// NO hardcoded coordinates. NO mock drivers. Real GPS only.
// ─────────────────────────────────────────────────────────────────────────────

const calcFare = (distanceKm) => Math.max(300, 500 + distanceKm * 120);

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

// ── DriverPin ──────────────────────────────────────────────────────────────────
const DriverPin = ({ driver, selected, onPress, accentColor }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scaleA, { toValue: selected ? 1.3 : 1, tension: 160, friction: 7, useNativeDriver: true }).start();
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

// ── DriverCard ─────────────────────────────────────────────────────────────────
const DriverCard = ({ driver, selected, onSelect, accentColor, theme }) => (
  <TouchableOpacity
    onPress={() => onSelect(driver)}
    activeOpacity={0.85}
    style={[dc.card, { backgroundColor: selected ? accentColor + '12' : theme.backgroundAlt, borderColor: selected ? accentColor : theme.border }]}
  >
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
    <View style={{ flex: 1, marginLeft: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={[dc.name, { color: theme.foreground }]} numberOfLines={1}>
          {driver.firstName} {driver.lastName}
        </Text>
        <View style={[dc.verifiedBadge, { backgroundColor: '#FFB800' }]}>
          <Ionicons name="shield-checkmark" size={9} color="#080C18" />
          <Text style={dc.verifiedTxt}>VERIFIED</Text>
        </View>
      </View>
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
    <View style={[dc.radio, { borderColor: selected ? accentColor : theme.border }]}>
      {selected && <View style={[dc.radioDot, { backgroundColor: accentColor }]} />}
    </View>
  </TouchableOpacity>
);
const dc = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 10 },
  avatarWrap:    { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden' },
  avatar:        { width: '100%', height: '100%' },
  avatarFallback:{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '800' },
  name:          { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehicle:       { fontSize: 11, marginBottom: 5 },
  meta:          { flexDirection: 'row', alignItems: 'center' },
  metaTxt:       { fontSize: 11 },
  dot:           { fontSize: 11 },
  radio:         { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  radioDot:      { width: 10, height: 10, borderRadius: 5 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFB800', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  verifiedTxt:   { fontSize: 7, fontWeight: '900', color: '#080C18', letterSpacing: 0.8 },
});

// ── LocationInput ──────────────────────────────────────────────────────────────
const LocationInput = ({ icon, iconColor, placeholder, value, onChangeText, onFocus, focused, theme }) => (
  <View style={[li.wrap, { backgroundColor: theme.backgroundAlt, borderColor: focused ? iconColor : theme.border }]}>
    <View style={[li.iconWrap, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={15} color={iconColor} />
    </View>
    <TextInput
      style={[li.input, { color: theme.foreground }]}
      placeholder={placeholder} placeholderTextColor={theme.hint}
      value={value} onChangeText={onChangeText} onFocus={onFocus} returnKeyType="done"
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

// ── StepDots ───────────────────────────────────────────────────────────────────
const StepDots = ({ step, accentColor, theme }) => (
  <View style={sd.wrap}>
    {[1, 2, 3].map(s => (
      <View key={s} style={[sd.dot,
        s === step  ? { backgroundColor: accentColor, width: 22 } :
        s < step    ? { backgroundColor: accentColor + '50' } :
                      { backgroundColor: theme.border },
      ]} />
    ))}
  </View>
);
const sd = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  dot:  { height: 6, width: 6, borderRadius: 3 },
});

const QUICK_DESTINATIONS = [
  { label: 'Victoria Island', icon: 'business-outline', lat: 6.4281, lng: 3.4219 },
  { label: 'Lekki Phase 1',   icon: 'home-outline',     lat: 6.4433, lng: 3.5077 },
  { label: 'Ikeja',           icon: 'airplane-outline', lat: 6.6018, lng: 3.3515 },
  { label: 'Surulere',        icon: 'football-outline', lat: 6.5037, lng: 3.3577 },
  { label: 'Eko Hotel',       icon: 'bed-outline',      lat: 6.4344, lng: 3.4212 },
  { label: 'Ajah',            icon: 'cart-outline',     lat: 6.4698, lng: 3.5827 },
];

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function RequestRideScreen({ navigation }) {
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const accentColor = theme.accent;

  const [myLocation,     setMyLocation]     = useState(null);
  const [locationError,  setLocationError]  = useState(null);
  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);
  const [focusedInput,   setFocusedInput]   = useState(null);

  const mapRef            = useRef(null);
  const [drivers,         setDrivers]         = useState([]);
  const [selectedDriver,  setSelectedDriver]  = useState(null);
  const [loadingDrivers,  setLoadingDrivers]  = useState(false);

  const [distanceKm,   setDistanceKm]   = useState(null);
  const [fareEstimate, setFareEstimate]  = useState(null);
  const [etaMinutes,   setEtaMinutes]   = useState(null);

  const [step,       setStep]       = useState(1);
  const [requesting, setRequesting] = useState(false);

  const fadeA = useRef(new Animated.Value(1)).current;

  // ── Real GPS on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied. Type your pickup address manually.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setMyLocation(coords);
        setPickupCoords(coords);
        console.log('[RequestRide] Customer GPS:', coords.lat, coords.lng);

        const [place] = await Location.reverseGeocodeAsync({
          latitude: coords.lat, longitude: coords.lng,
        }).catch(() => []);

        if (place) {
          const name = [place.name, place.street, place.district].filter(Boolean).join(', ');
          const coords_str = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
          setPickupAddress(
            name
              ? `${name} (${coords_str})`
              : coords_str
          );
        } else {
          setPickupAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        }
      } catch (err) {
        setLocationError('Could not get your location. Please type your pickup address.');
        console.warn('[RequestRide] GPS error:', err.message);
      }
    })();
    socketService.connect?.();
  }, []);

  // ── Find drivers ────────────────────────────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Missing locations', 'Please enter both pickup and drop-off locations.');
      return;
    }

    let pCoords = pickupCoords;
    let dCoords = dropoffCoords;

    if (!pCoords) {
      const res = await Location.geocodeAsync(pickupAddress).catch(() => []);
      if (res?.[0]) { pCoords = { lat: res[0].latitude, lng: res[0].longitude }; setPickupCoords(pCoords); }
      else { Alert.alert('Location not found', `Could not find "${pickupAddress}".`); return; }
    }
    if (!dCoords) {
      const res = await Location.geocodeAsync(dropoffAddress).catch(() => []);
      if (res?.[0]) { dCoords = { lat: res[0].latitude, lng: res[0].longitude }; setDropoffCoords(dCoords); }
      else { Alert.alert('Location not found', `Could not find "${dropoffAddress}".`); return; }
    }

    const km = haversineKm(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
    setDistanceKm(km);
    setFareEstimate(calcFare(km));
    setEtaMinutes(Math.ceil(km / 0.5));

    console.log('[RequestRide] Pickup coords:', pCoords.lat, pCoords.lng);
    console.log('[RequestRide] Dropoff coords:', dCoords.lat, dCoords.lng);

    setLoadingDrivers(true);
    try {
      const res  = await rideAPI.getNearbyDrivers({
        pickupLat: pCoords.lat,
        pickupLng: pCoords.lng,
        radiusKm:  50,  // wider radius to account for GPS variance during testing
      });
      const list = res?.data?.drivers ?? res?.drivers ?? [];

      // ── Diagnostic: log every driver returned by the API ──────────────────
      console.log('[RequestRide] API returned', list.length, 'drivers:');
      list.forEach((d, i) => console.log(`  [${i}] id=${d.driverId} name=${d.firstName} ${d.lastName} lat=${d.currentLat} lng=${d.currentLng}`));

      // ── Safety check: reject any mock/fake driver IDs ─────────────────────
      const realDrivers = list.filter(d => !String(d.driverId).startsWith('mock-'));
      if (realDrivers.length < list.length) {
        console.warn('[RequestRide] Filtered out', list.length - realDrivers.length, 'mock driver(s)');
      }

      setDrivers(realDrivers);
    } catch (err) {
      console.error('[RequestRide] getNearbyDrivers error:', err?.response?.data ?? err.message);
      Alert.alert('Drivers unavailable', err?.response?.data?.message ?? 'Could not load nearby drivers.');
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }

    Animated.timing(fadeA, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(2);
      Animated.timing(fadeA, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [{ latitude: pCoords.lat, longitude: pCoords.lng }, { latitude: dCoords.lat, longitude: dCoords.lng }],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      );
    }, 500);
  }, [pickupAddress, dropoffAddress, pickupCoords, dropoffCoords]);

  // ── Confirm ride ────────────────────────────────────────────────────────────
  const confirmRide = async () => {
    if (!selectedDriver) { Alert.alert('Select a driver', 'Please choose a driver.'); return; }

    // Final guard — should never happen after the mock filter above
    if (String(selectedDriver.driverId).startsWith('mock-')) {
      Alert.alert('Error', 'Selected driver is not a real driver. Please retry to find real drivers.');
      return;
    }

    console.log('[RequestRide] Booking driver:', selectedDriver.driverId, selectedDriver.firstName);

    setRequesting(true);
    try {
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
      if (navigation.replace) navigation.replace('RideTracking');
      else navigation.goBack();
    } catch (err) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Could not book the ride.');
    } finally {
      setRequesting(false);
    }
  };

  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
    mapRef.current?.animateToRegion({
      latitude: driver.currentLat, longitude: driver.currentLng,
      latitudeDelta: 0.015, longitudeDelta: 0.015,
    }, 600);
  };

  const mapRegion = myLocation
    ? { latitude: myLocation.lat, longitude: myLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const backBtnTop     = insets.top + 14;
  const sheetPadBottom = insets.bottom + 12;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
        {pickupCoords && (
          <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="radio-button-on" size={20} color={accentColor} />
          </Marker>
        )}
        {dropoffCoords && (
          <Marker coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="location" size={24} color="#E05555" />
          </Marker>
        )}
        {pickupCoords && dropoffCoords && (
          <Polyline
            coordinates={[
              { latitude: pickupCoords.lat,  longitude: pickupCoords.lng  },
              { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
            ]}
            strokeColor={accentColor} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {step >= 2 && drivers.map((d) => (
          <DriverPin key={d.driverId} driver={d}
            selected={selectedDriver?.driverId === d.driverId}
            onPress={() => handleSelectDriver(d)} accentColor={accentColor} />
        ))}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => step > 1 ? setStep(prev => prev - 1) : navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      <Animated.View style={[s.sheet, { backgroundColor: theme.background, borderColor: theme.border, opacity: fadeA, paddingBottom: sheetPadBottom }]}>
        <StepDots step={step} accentColor={accentColor} theme={theme} />

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text style={[s.sheetTitle, { color: theme.foreground }]}>Where to?</Text>
            <Text style={[s.sheetSub, { color: theme.hint }]}>Enter your pickup and destination</Text>

            {locationError && (
              <View style={[s.locErrBanner, { backgroundColor: '#E05555' + '18', borderColor: '#E05555' + '50' }]}>
                <Ionicons name="warning-outline" size={14} color="#E05555" />
                <Text style={[s.locErrTxt, { color: '#E05555' }]}>{locationError}</Text>
              </View>
            )}

            <View style={s.routeLine}>
              <View style={s.routeDots}>
                <View style={[s.dotGreen, { backgroundColor: accentColor }]} />
                <View style={[s.routeVert, { backgroundColor: theme.border }]} />
                <View style={s.dotRed} />
              </View>
              <View style={{ flex: 1 }}>
                <LocationInput icon="radio-button-on" iconColor={accentColor}
                  placeholder="Pickup location" value={pickupAddress} onChangeText={setPickupAddress}
                  onFocus={() => setFocusedInput('pickup')} focused={focusedInput === 'pickup'} theme={theme} />
                <LocationInput icon="location" iconColor="#E05555"
                  placeholder="Drop-off destination" value={dropoffAddress}
                  onChangeText={(t) => { setDropoffAddress(t); setDropoffCoords(null); }}
                  onFocus={() => setFocusedInput('dropoff')} focused={focusedInput === 'dropoff'} theme={theme} />
              </View>
            </View>

            <Text style={[s.quickLabel, { color: theme.hint }]}>POPULAR DESTINATIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {QUICK_DESTINATIONS.map((d) => (
                <TouchableOpacity key={d.label}
                  style={[s.quickChip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                  onPress={() => { 
                    setDropoffAddress(`${d.label} (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})`); 
                    setDropoffCoords({ lat: d.lat, lng: d.lng }); 
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={d.icon} size={13} color={accentColor} />
                  <Text style={[s.quickChipTxt, { color: theme.foreground }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: accentColor }]} onPress={proceedToMap} activeOpacity={0.88}>
              <Ionicons name="map-outline" size={18} color="#FFFFFF" />
              <Text style={s.primaryBtnTxt}>Find Available Riders</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
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
                  {'\u20A6'}{fareEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>

            <Text style={[s.sheetTitle, { color: theme.foreground, marginTop: 14 }]}>
              {loadingDrivers ? 'Finding drivers...' : `${drivers.length} driver${drivers.length !== 1 ? 's' : ''} nearby`}
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
                  <DriverCard driver={item} selected={selectedDriver?.driverId === item.driverId}
                    onSelect={handleSelectDriver} accentColor={accentColor} theme={theme} />
                )}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 220 }}
                nestedScrollEnabled
              />
            )}

            {selectedDriver && (
              <TouchableOpacity style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]} onPress={() => setStep(3)} activeOpacity={0.88}>
                <Text style={s.primaryBtnTxt}>Continue with {selectedDriver.firstName}</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && selectedDriver && (
          <View>
            <Text style={[s.sheetTitle, { color: theme.foreground }]}>Confirm Ride</Text>

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
                    {'\u20A6'}{fareEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[s.confirmFareLabel, { color: theme.hint }]}>CASH</Text>
                </View>
              </View>
            </View>

            <View style={[s.etaStrip, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}>
              <Ionicons name="time-outline" size={14} color={accentColor} />
              <Text style={[s.etaTxt, { color: accentColor }]}>
                Driver arrives in approx. {selectedDriver.etaMinutes ?? etaMinutes} minutes
              </Text>
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: requesting ? accentColor + '80' : accentColor }]}
              onPress={confirmRide} disabled={requesting} activeOpacity={0.88}
            >
              {requesting ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={s.primaryBtnTxt}>Confirm Ride</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[s.secondaryBtn, { borderColor: theme.border }]} onPress={() => setStep(2)} activeOpacity={0.8}>
              <Text style={[s.secondaryBtnTxt, { color: theme.hint }]}>Change Driver</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backBtn: { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 22, maxHeight: height * 0.72 },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:   { fontSize: 12, fontWeight: '500', marginBottom: 18 },
  locErrBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12 },
  locErrTxt:    { flex: 1, fontSize: 11, fontWeight: '500' },
  routeLine:  { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  routeDots:  { alignItems: 'center', paddingTop: 18, gap: 0 },
  dotGreen:   { width: 10, height: 10, borderRadius: 5 },
  routeVert:  { width: 1.5, height: 38 },
  dotRed:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E05555' },
  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn:  { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  secondaryBtnTxt:{ fontSize: 14, fontWeight: '600' },
  fareBadge:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fareItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  fareVal:     { fontSize: 13, fontWeight: '700' },
  fareDivider: { width: 1 },
  noDrivers:   { alignItems: 'center', paddingVertical: 24 },
  noDriversTxt:{ fontSize: 13, marginTop: 10, marginBottom: 14 },
  retryBtn:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:    { fontSize: 13, fontWeight: '700' },
  confirmRoute:     { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  confirmRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cDot:             { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmAddr:      { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  confirmRouteLine: { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 4 },
  confirmCard:           { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  confirmDriver:         { flexDirection: 'row', alignItems: 'center' },
  confirmAvatar:         { width: 52, height: 52, borderRadius: 26 },
  confirmAvatarFallback: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  confirmInitials:       { fontSize: 16, fontWeight: '800' },
  confirmName:           { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  confirmVehicle:        { fontSize: 11, marginBottom: 2 },
  confirmMeta:           { fontSize: 11 },
  confirmFareBox:        { alignItems: 'flex-end' },
  confirmFareLabel:      { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  confirmFare:           { fontSize: 18, fontWeight: '900' },
  etaStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  etaTxt:   { fontSize: 12, fontWeight: '600', flex: 1 },
});