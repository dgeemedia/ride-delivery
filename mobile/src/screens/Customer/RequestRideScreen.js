// mobile/src/screens/Customer/RequestRideScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Dimensions, Animated, ScrollView, ActivityIndicator,
  StatusBar, Platform, KeyboardAvoidingView, Alert,
  FlatList, Image, Modal, SafeAreaView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../../components/SmartMapView';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }   from '../../context/ThemeContext';
import { rideAPI }    from '../../services/api';
import socketService  from '../../services/socket';
import { GOOGLE_MAPS_API_KEY } from '../../config/constants';

const { width, height } = Dimensions.get('window');

const calcFare    = (km) => Math.max(300, 500 + km * 120);
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#C9A96E' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',                elementType: 'labels',           stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            elementType: 'labels',           stylers: [{ visibility: 'off' }] },
];

const QUICK_DESTINATIONS = [
  { label: 'Victoria Island', icon: 'business-outline', lat: 6.4281, lng: 3.4219 },
  { label: 'Lekki Phase 1',   icon: 'home-outline',     lat: 6.4433, lng: 3.5077 },
  { label: 'Ikeja',           icon: 'airplane-outline', lat: 6.6018, lng: 3.3515 },
  { label: 'Surulere',        icon: 'football-outline', lat: 6.5037, lng: 3.3577 },
  { label: 'Eko Hotel',       icon: 'bed-outline',      lat: 6.4344, lng: 3.4212 },
  { label: 'Ajah',            icon: 'cart-outline',     lat: 6.4698, lng: 3.5827 },
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
        <View style={dc.verifiedBadge}>
          <Ionicons name="shield-checkmark" size={9} color="#080C18" />
          <Text style={dc.verifiedTxt}>VERIFIED</Text>
        </View>
      </View>
      <Text style={[dc.vehicle, { color: theme.hint }]} numberOfLines={1}>
        {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel} • {driver.vehiclePlate}
      </Text>
      <View style={dc.meta}>
        <Ionicons name="star" size={11} color="#C9A96E" />
        <Text style={[dc.metaTxt, { color: theme.hint }]}> {driver.rating?.toFixed(1) ?? '–'}</Text>
        <Text style={[dc.dot, { color: theme.border }]}>  •  </Text>
        <Ionicons name="time-outline" size={11} color={theme.hint} />
        <Text style={[dc.metaTxt, { color: theme.hint }]}> {driver.etaMinutes} min</Text>
        <Text style={[dc.dot, { color: theme.border }]}>  •  </Text>
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

// ── WaitingSheet ───────────────────────────────────────────────────────────────
const WaitingSheet = ({ accentColor, theme, driverName, onCancel, rideAccepted }) => {
  const dotA = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (rideAccepted) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotA, { toValue: 1,   duration: 600, useNativeDriver: true }),
      Animated.timing(dotA, { toValue: 0.3, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [rideAccepted]);

  if (rideAccepted) {
    return (
      <View style={wt.wrap}>
        <View style={[wt.iconWrap, { backgroundColor: '#5DAA7218' }]}>
          <Ionicons name="checkmark-circle" size={36} color="#5DAA72" />
        </View>
        <Text style={[wt.title, { color: theme.foreground }]}>Driver Accepted!</Text>
        <Text style={[wt.sub, { color: theme.hint }]}>{driverName} is on the way</Text>
      </View>
    );
  }

  return (
    <View style={wt.wrap}>
      <View style={[wt.iconWrap, { backgroundColor: accentColor + '18' }]}>
        <Animated.View style={{ opacity: dotA }}>
          <Ionicons name="car" size={32} color={accentColor} />
        </Animated.View>
      </View>
      <Text style={[wt.title, { color: theme.foreground }]}>Request Sent!</Text>
      <Text style={[wt.sub, { color: theme.hint }]}>Waiting for {driverName} to accept...</Text>
      <TouchableOpacity style={[wt.cancelBtn, { borderColor: theme.border }]} onPress={onCancel} activeOpacity={0.8}>
        <Text style={[wt.cancelTxt, { color: theme.hint }]}>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  );
};
const wt = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingVertical: 24 },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title:     { fontSize: 20, fontWeight: '900', marginBottom: 6, letterSpacing: -0.3 },
  sub:       { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  cancelBtn: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 10 },
  cancelTxt: { fontSize: 14, fontWeight: '600' },
});

// ── LocationSearchModal ────────────────────────────────────────────────────────
const LocationSearchModal = ({
  visible, type, query, results, loading,
  onChangeText, onSelect, onClose, onSwitchToPin,
  accentColor, theme,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const pinColor = type === 'dropoff' ? '#E05555' : accentColor;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[lsm.root, { backgroundColor: theme.background }]}>
        {/* ── Header ── */}
        <View style={[lsm.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity onPress={onClose} style={[lsm.backBtn, { backgroundColor: theme.card }]} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={theme.foreground} />
          </TouchableOpacity>
          <View style={[lsm.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: pinColor + '60' }]}>
            <Ionicons
              name={type === 'pickup' ? 'radio-button-on' : 'location'}
              size={16}
              color={pinColor}
            />
            <TextInput
              ref={inputRef}
              style={[lsm.input, { color: theme.foreground }]}
              placeholder={type === 'pickup' ? 'Search pickup location…' : 'Search drop-off location…'}
              placeholderTextColor={theme.hint}
              value={query}
              onChangeText={onChangeText}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            {loading && <ActivityIndicator color={pinColor} size="small" />}
            {!loading && query.length > 0 && (
              <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Switch to map pin ── */}
        <TouchableOpacity style={lsm.mapPinRow} onPress={onSwitchToPin} activeOpacity={0.8}>
          <View style={[lsm.mapPinIcon, { backgroundColor: pinColor + '18' }]}>
            <Ionicons name="map-outline" size={16} color={pinColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[lsm.mapPinLabel, { color: pinColor }]}>Place pin on map</Text>
            <Text style={[lsm.mapPinSub, { color: theme.muted }]}>Drag the map to set your exact location</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>

        <View style={[lsm.divider, { backgroundColor: theme.border }]} />

        {/* ── Results ── */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.place_id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[lsm.resultRow, { borderBottomColor: theme.border }]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <View style={[lsm.resultIcon, { backgroundColor: theme.card }]}>
                <Ionicons name="location-outline" size={16} color={theme.hint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[lsm.resultMain, { color: theme.foreground }]} numberOfLines={1}>
                  {item.structured_formatting?.main_text ?? item.description}
                </Text>
                {item.structured_formatting?.secondary_text ? (
                  <Text style={[lsm.resultSub, { color: theme.hint }]} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length === 0 ? (
              <View style={lsm.emptyWrap}>
                <Ionicons name="search-outline" size={40} color={theme.border} />
                <Text style={[lsm.emptyTitle, { color: theme.muted }]}>Search for a location</Text>
                <Text style={[lsm.emptySub, { color: theme.muted }]}>Type an address, landmark, or area</Text>
              </View>
            ) : query.length < 3 ? (
              <Text style={[lsm.hintTxt, { color: theme.muted }]}>Keep typing to see results…</Text>
            ) : !loading ? (
              <View style={lsm.emptyWrap}>
                <Ionicons name="alert-circle-outline" size={36} color={theme.border} />
                <Text style={[lsm.emptyTitle, { color: theme.muted }]}>No results found</Text>
                <Text style={[lsm.emptySub, { color: theme.muted }]}>Try a different search or use the map pin</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const lsm = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  inputWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, height: 44 },
  input:      { flex: 1, fontSize: 14, fontWeight: '500', height: 44 },
  mapPinRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  mapPinIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  mapPinLabel:{ fontSize: 14, fontWeight: '700', marginBottom: 2 },
  mapPinSub:  { fontSize: 11 },
  divider:    { height: 1, marginHorizontal: 16 },
  resultRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  resultIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resultMain: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  resultSub:  { fontSize: 12 },
  emptyWrap:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  hintTxt:    { fontSize: 13, textAlign: 'center', paddingTop: 40 },
});

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function RequestRideScreen({ navigation }) {
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const accentColor = theme.accent;
  const accentFg    = theme.accentFg ?? '#111111';

  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);

  const [placingPin,    setPlacingPin]    = useState(null);
  const [resolvingAddr, setResolvingAddr] = useState(false);
  const [liveAddress,   setLiveAddress]   = useState('');
  const [mapCenter,     setMapCenter]     = useState(null);

  const [searchModal,   setSearchModal]   = useState(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  const mapRef           = useRef(null);
  const geocodeTimer     = useRef(null);
  const [drivers,        setDrivers]        = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const [distanceKm,    setDistanceKm]   = useState(null);
  const [fareEstimate,  setFareEstimate] = useState(null);
  const [etaMinutes,    setEtaMinutes]   = useState(null);

  const [step,          setStep]          = useState(1);
  const [requesting,    setRequesting]    = useState(false);
  const [pendingRideId, setPendingRideId] = useState(null);
  const [rideAccepted,  setRideAccepted]  = useState(false);
  const [mapReady,      setMapReady]      = useState(false);

  const fadeA     = useRef(new Animated.Value(1)).current;
  const pinBounce = useRef(new Animated.Value(0)).current;

  const TAB_CONTENT_H  = 54;
  const sheetPadBottom = insets.bottom + TAB_CONTENT_H + 24;
  const backBtnTop     = insets.top + 14;
  const sheetTop       = insets.top + 70;

  // ── Location permission + initial position ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const coords = { lat: 6.5244, lng: 3.3792 };
          setPickupCoords(coords);
          setPickupAddress('Lagos, Nigeria');
          return;
        }
        const loc    = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setPickupCoords(coords);
        reverseGeocode(coords.lat, coords.lng, setPickupAddress);
      } catch {
        const coords = { lat: 6.5244, lng: 3.3792 };
        setPickupCoords(coords);
        setPickupAddress('Lagos, Nigeria');
      }
    })();
    socketService.connect().catch(() => {});
  }, []);

  useEffect(() => {
    if (pickupCoords && mapReady && step === 1 && !placingPin) {
      mapRef.current?.animateToRegion({
        latitude: pickupCoords.lat, longitude: pickupCoords.lng,
        latitudeDelta: 0.012, longitudeDelta: 0.012,
      }, 600);
    }
  }, [pickupCoords, mapReady]);

  // ── Reverse geocode helper ─────────────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat, lng, setter) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const place   = results?.[0];
      if (place) {
        const parts = [place.name, place.street, place.district, place.city]
          .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
        setter(parts.length > 0 ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleStatus = (data) => {
      if (data.rideId === pendingRideId && data.status === 'ACCEPTED') {
        setRideAccepted(true);
        setTimeout(() => navigation.replace('RideTracking', { rideId: data.rideId }), 1800);
      }
    };
    const handleCancelled = (data) => {
      if (data.rideId === pendingRideId) {
        setPendingRideId(null); setRideAccepted(false); setStep(2);
        Alert.alert('Request Cancelled', 'The driver cancelled this request. Please choose another driver.');
      }
    };
    socketService.on('ride:status:update', handleStatus);
    socketService.on('ride:cancelled',     handleCancelled);
    return () => {
      socketService.off('ride:status:update', handleStatus);
      socketService.off('ride:cancelled',     handleCancelled);
    };
  }, [pendingRideId, navigation]);

  // ── Search helpers ─────────────────────────────────────────────────────────
  const searchPlaces = useCallback(async (text) => {
    setSearchQuery(text);
    if (text.length < 3) { setSearchResults([]); setSearchLoading(false); return; }
    clearTimeout(searchTimer.current);
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const locationBias = pickupCoords
          ? `&location=${pickupCoords.lat},${pickupCoords.lng}&radius=50000`
          : '&components=country:ng';
        const url  = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}${locationBias}&language=en`;
        const res  = await fetch(url);
        const data = await res.json();
        setSearchResults(data.predictions ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, [pickupCoords]);

  const selectPlace = useCallback(async (place) => {
    try {
      const url  = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${GOOGLE_MAPS_API_KEY}&fields=geometry,formatted_address`;
      const res  = await fetch(url);
      const data = await res.json();
      const loc  = data.result?.geometry?.location;
      if (!loc) { Alert.alert('Error', 'Could not get location details. Please try again.'); return; }
      const coords  = { lat: loc.lat, lng: loc.lng };
      const address = data.result.formatted_address ?? place.description;
      if (searchModal === 'pickup') {
        setPickupCoords(coords); setPickupAddress(address);
        mapRef.current?.animateToRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
      } else {
        setDropoffCoords(coords); setDropoffAddress(address);
        if (pickupCoords) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(
              [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: coords.lat, longitude: coords.lng }],
              { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
            );
          }, 300);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not load location. Please try again.');
    } finally {
      setSearchModal(null); setSearchQuery(''); setSearchResults([]);
    }
  }, [searchModal, pickupCoords]);

  const openSearchModal  = useCallback((type) => { setSearchModal(type); setSearchQuery(''); setSearchResults([]); setSearchLoading(false); }, []);
  const closeSearchModal = useCallback(() => { clearTimeout(searchTimer.current); setSearchModal(null); setSearchQuery(''); setSearchResults([]); setSearchLoading(false); }, []);
  const switchToMapPin   = useCallback(() => { const type = searchModal; closeSearchModal(); setTimeout(() => startPickingLocation(type), 300); }, [searchModal]);

  // ── Map pin-placing callbacks ──────────────────────────────────────────────
  const onRegionChange = useCallback((region) => {
    if (!placingPin) return;
    setMapCenter({ lat: region.latitude, lng: region.longitude });
    setResolvingAddr(true);
    setLiveAddress('Locating…');
    Animated.spring(pinBounce, { toValue: -14, tension: 200, friction: 8, useNativeDriver: true }).start();
    clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
        const place   = results?.[0];
        if (place) {
          const parts = [place.name, place.street, place.district, place.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
          setLiveAddress(parts.length > 0 ? parts.join(', ') : `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
        } else { setLiveAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`); }
      } catch { setLiveAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`); }
      setResolvingAddr(false);
    }, 400);
  }, [placingPin]);

  const onRegionChangeComplete = useCallback((region) => {
    if (!placingPin) return;
    Animated.spring(pinBounce, { toValue: 0, tension: 160, friction: 7, useNativeDriver: true }).start();
    setMapCenter({ lat: region.latitude, lng: region.longitude });
    clearTimeout(geocodeTimer.current);
    setResolvingAddr(true);
    reverseGeocode(region.latitude, region.longitude, (addr) => { setLiveAddress(addr); setResolvingAddr(false); });
  }, [placingPin, reverseGeocode]);

  const confirmPin = () => {
    if (!mapCenter) return;
    if (placingPin === 'pickup') { setPickupCoords(mapCenter); setPickupAddress(liveAddress); }
    else { setDropoffCoords(mapCenter); setDropoffAddress(liveAddress); }
    setPlacingPin(null); setLiveAddress(''); setMapCenter(null);
  };

  const startPickingLocation = useCallback((type) => {
    setPlacingPin(type);
    const current = type === 'pickup' ? pickupCoords : dropoffCoords;
    const center  = current ?? pickupCoords ?? { lat: 6.5244, lng: 3.3792 };
    setLiveAddress(type === 'pickup' ? pickupAddress : dropoffAddress);
    setMapCenter(center);
    mapRef.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  }, [pickupCoords, dropoffCoords, pickupAddress, dropoffAddress]);

  const setQuickDestination = (dest) => {
    setDropoffCoords({ lat: dest.lat, lng: dest.lng });
    setDropoffAddress(dest.label);
    if (pickupCoords) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dest.lat, longitude: dest.lng }],
          { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
        );
      }, 300);
    }
  };

  // ── Proceed to step 2 (find drivers) ──────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) { Alert.alert('Set both locations', 'Please set both pickup and drop-off locations.'); return; }
    const km = haversineKm(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);
    setDistanceKm(km); setFareEstimate(calcFare(km)); setEtaMinutes(Math.ceil(km / 0.5));
    setLoadingDrivers(true);
    try {
      const res  = await rideAPI.getNearbyDrivers({ pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng, radiusKm: 50 });
      const list = res?.data?.drivers ?? res?.drivers ?? [];
      setDrivers(list.filter(d => !String(d.driverId).startsWith('mock-')));
    } catch (err) {
      Alert.alert('Drivers unavailable', err?.response?.data?.message ?? 'Could not load nearby drivers.');
      setDrivers([]);
    } finally { setLoadingDrivers(false); }
    Animated.timing(fadeA, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(2); Animated.timing(fadeA, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      );
    }, 500);
  }, [pickupCoords, dropoffCoords]);

  // ── Confirm ride request ───────────────────────────────────────────────────
  const confirmRide = async () => {
    if (!selectedDriver) { Alert.alert('Select a driver', 'Please choose a driver.'); return; }
    if (String(selectedDriver.driverId).startsWith('mock-')) { Alert.alert('Error', 'Invalid driver. Please retry.'); return; }
    setRequesting(true);
    try {
      const res = await rideAPI.requestSpecificDriver({
        pickupAddress, pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng,
        dropoffAddress, dropoffLat: dropoffCoords.lat, dropoffLng: dropoffCoords.lng,
        driverId: selectedDriver.driverId, estimatedFare: fareEstimate, paymentMethod: 'CASH',
      });
      const rideId = res?.data?.ride?.id ?? res?.ride?.id;
      setPendingRideId(rideId);
      if (rideId) socketService.joinRide(rideId);
      Animated.timing(fadeA, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setStep(4); Animated.timing(fadeA, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    } catch (err) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Could not book the ride.');
    } finally { setRequesting(false); }
  };

  const cancelPendingRide = async () => {
    if (!pendingRideId) { navigation.goBack(); return; }
    try {
      await rideAPI.cancelRide(pendingRideId, { reason: 'Customer cancelled before acceptance' });
      socketService.leaveRide(pendingRideId);
    } catch {}
    setPendingRideId(null); setRideAccepted(false); setStep(2);
  };

  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
    if (driver.currentLat && driver.currentLng) {
      mapRef.current?.animateToRegion({ latitude: driver.currentLat, longitude: driver.currentLng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
    }
  };

  const isPickingLocation = placingPin !== null;
  const pinColor          = placingPin === 'dropoff' ? '#E05555' : accentColor;

  const mapRegion = pickupCoords
    ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }
    : undefined;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={!isPickingLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
        onRegionChange={isPickingLocation ? onRegionChange : undefined}
        onRegionChangeComplete={isPickingLocation ? onRegionChangeComplete : undefined}
        scrollEnabled={isPickingLocation || step >= 2}
        zoomEnabled={isPickingLocation || step >= 2}
      >
        {pickupCoords && !isPickingLocation && (
          <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="radio-button-on" size={26} color={accentColor} />
          </Marker>
        )}
        {dropoffCoords && !isPickingLocation && (
          <Marker coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="location" size={30} color="#E05555" />
          </Marker>
        )}
        {pickupCoords && dropoffCoords && !isPickingLocation && (
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

      {/* ── Back button ── */}
      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop, backgroundColor: theme.card + 'CC', borderColor: theme.border }]}
        onPress={() => {
          if (isPickingLocation) { setPlacingPin(null); setLiveAddress(''); setMapCenter(null); }
          else if (step === 4)   { cancelPendingRide(); }
          else if (step > 1)     { setStep(prev => prev - 1); }
          else                   { navigation.goBack(); }
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* ══════════════════════════════════════════════════════════════════════
          PIN-PLACING MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {isPickingLocation && (
        <>
          <View style={s.crosshairWrap} pointerEvents="none">
            <View style={[s.pinShadow, { backgroundColor: pinColor + '40' }]} />
            <Animated.View style={[s.pinAnimWrap, { transform: [{ translateY: pinBounce }] }]}>
              <View style={[s.pinCircle, { backgroundColor: pinColor, shadowColor: pinColor }]}>
                <Ionicons name={placingPin === 'dropoff' ? 'location' : 'radio-button-on'} size={20} color="#FFFFFF" />
              </View>
              <View style={[s.pinPoint, { borderTopColor: pinColor }]} />
            </Animated.View>
          </View>

          <View style={[s.pinLabelBar, { top: backBtnTop, backgroundColor: theme.card + 'EE' }]}>
            <View style={[s.pinLabelDot, { backgroundColor: pinColor }]} />
            <Text style={[s.pinLabelTxt, { color: theme.foreground }]}>
              {placingPin === 'pickup' ? 'Move map to set pickup' : 'Move map to set drop-off'}
            </Text>
          </View>

          <View style={[s.confirmBar, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: sheetPadBottom }]}>
            <View style={s.confirmBarInner}>
              <View style={[s.confirmBarDot, { backgroundColor: pinColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.confirmBarLabel, { color: theme.hint }]}>
                  {placingPin === 'pickup' ? 'PICKUP LOCATION' : 'DROP-OFF LOCATION'}
                </Text>
                <Text style={[s.confirmBarAddr, { color: theme.foreground }]} numberOfLines={2}>
                  {resolvingAddr ? 'Locating…' : (liveAddress || 'Move the map to select')}
                </Text>
              </View>
              {resolvingAddr && <ActivityIndicator color={pinColor} size="small" style={{ marginLeft: 8 }} />}
            </View>
            <TouchableOpacity
              style={[s.confirmBarBtn, { backgroundColor: pinColor, opacity: resolvingAddr ? 0.6 : 1 }]}
              onPress={confirmPin}
              disabled={resolvingAddr || !liveAddress}
              activeOpacity={0.88}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={s.confirmBarBtnTxt}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          NORMAL BOTTOM SHEET
      ══════════════════════════════════════════════════════════════════════ */}
      {!isPickingLocation && (
        <Animated.View style={[s.sheet, {
          backgroundColor: theme.background,
          borderColor:     theme.border,
          opacity:         fadeA,
          paddingBottom:   sheetPadBottom,
          top:             sheetTop,
          overflow:        'hidden',
        }]}>
          <StepDots step={Math.min(step, 3)} accentColor={accentColor} theme={theme} />

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[s.sheetTitle, { color: theme.foreground }]}>Where to?</Text>
                <Text style={[s.sheetSub, { color: theme.hint }]}>Search or tap the map icon to pin your location</Text>

                <View style={s.locationRow}>
                  <View style={s.routeDots}>
                    <View style={[s.routeDot, { backgroundColor: accentColor }]} />
                    <View style={[s.routeLine, { backgroundColor: theme.border }]} />
                    <View style={[s.routeDot, { backgroundColor: '#E05555' }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={[s.locBtn, { backgroundColor: theme.card, borderColor: accentColor + '50' }]}
                      onPress={() => openSearchModal('pickup')}
                      activeOpacity={0.85}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.locBtnLabel, { color: accentColor }]}>PICKUP</Text>
                        <Text style={[s.locBtnAddr, { color: pickupCoords ? theme.foreground : theme.hint }]} numberOfLines={1}>
                          {pickupAddress || 'Search or pin pickup location'}
                        </Text>
                      </View>
                      <View style={[s.locBtnIcon, { backgroundColor: accentColor + '18' }]}>
                        <Ionicons name="search" size={14} color={accentColor} />
                      </View>
                      <TouchableOpacity
                        style={[s.locBtnIconSecondary, { backgroundColor: accentColor + '10' }]}
                        onPress={(e) => { e.stopPropagation(); startPickingLocation('pickup'); }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Ionicons name="map-outline" size={14} color={accentColor} />
                      </TouchableOpacity>
                    </TouchableOpacity>

                    <View style={{ height: 6 }} />

                    <TouchableOpacity
                      style={[s.locBtn, { backgroundColor: theme.card, borderColor: '#E05555' + '50' }]}
                      onPress={() => openSearchModal('dropoff')}
                      activeOpacity={0.85}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.locBtnLabel, { color: '#E05555' }]}>DROP-OFF</Text>
                        <Text style={[s.locBtnAddr, { color: dropoffCoords ? theme.foreground : theme.hint }]} numberOfLines={1}>
                          {dropoffAddress || 'Search or pin drop-off location'}
                        </Text>
                      </View>
                      <View style={[s.locBtnIcon, { backgroundColor: '#E05555' + '18' }]}>
                        <Ionicons name="search" size={14} color="#E05555" />
                      </View>
                      <TouchableOpacity
                        style={[s.locBtnIconSecondary, { backgroundColor: '#E05555' + '10' }]}
                        onPress={(e) => { e.stopPropagation(); startPickingLocation('dropoff'); }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Ionicons name="map-outline" size={14} color="#E05555" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[s.quickLabel, { color: theme.hint }]}>POPULAR DESTINATIONS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {QUICK_DESTINATIONS.map((d) => (
                    <TouchableOpacity key={d.label}
                      style={[s.quickChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => setQuickDestination(d)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={d.icon} size={13} color={accentColor} />
                      <Text style={[s.quickChipTxt, { color: theme.foreground }]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: (pickupCoords && dropoffCoords) ? accentColor : theme.border }]}
                  onPress={proceedToMap}
                  activeOpacity={0.88}
                >
                  <Ionicons name="map-outline" size={18} color={(pickupCoords && dropoffCoords) ? accentFg : theme.muted} />
                  <Text style={[s.primaryBtnTxt, { color: (pickupCoords && dropoffCoords) ? accentFg : theme.muted }]}>
                    Find Available Riders
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={[s.fareBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
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

              <Text style={[s.sheetTitle, { marginTop: 14, color: theme.foreground }]}>
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
                  <Text style={[s.primaryBtnTxt, { color: accentFg }]}>Continue with {selectedDriver.firstName}</Text>
                  <Ionicons name="arrow-forward" size={16} color={accentFg} />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === 3 && selectedDriver && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.sheetTitle, { color: theme.foreground }]}>Confirm Ride</Text>

              <View style={[s.confirmRoute, { backgroundColor: theme.card, borderColor: theme.border }]}>
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

              <View style={[s.confirmCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
                      {selectedDriver.vehicleColor} {selectedDriver.vehicleMake} • {selectedDriver.vehiclePlate}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="star" size={12} color="#C9A96E" />
                      <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedDriver.rating?.toFixed(1) ?? '–'}</Text>
                      <Text style={[s.confirmMeta, { color: theme.border }]}>•</Text>
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
                {requesting ? <ActivityIndicator color={accentFg} /> : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color={accentFg} />
                    <Text style={[s.primaryBtnTxt, { color: accentFg }]}>Confirm Ride</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[s.secondaryBtn, { borderColor: theme.border }]} onPress={() => setStep(2)} activeOpacity={0.8}>
                <Text style={[s.secondaryBtnTxt, { color: theme.hint }]}>Change Driver</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP 4: Waiting ── */}
          {step === 4 && (
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              <WaitingSheet
                accentColor={accentColor}
                theme={theme}
                driverName={selectedDriver?.firstName ?? 'the driver'}
                onCancel={cancelPendingRide}
                rideAccepted={rideAccepted}
              />
            </ScrollView>
          )}
        </Animated.View>
      )}

      {/* ── Location Search Modal ── */}
      <LocationSearchModal
        visible={searchModal !== null}
        type={searchModal}
        query={searchQuery}
        results={searchResults}
        loading={searchLoading}
        onChangeText={searchPlaces}
        onSelect={selectPlace}
        onClose={closeSearchModal}
        onSwitchToPin={switchToMapPin}
        accentColor={accentColor}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.4)' },

  backBtn: {
    position: 'absolute', left: 20, width: 42, height: 42,
    borderRadius: 13, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', zIndex: 99,
  },

  crosshairWrap: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -56, marginLeft: -20,
    alignItems: 'center', zIndex: 50,
  },
  pinShadow:   { width: 16, height: 8, borderRadius: 8, marginTop: 4 },
  pinAnimWrap: { alignItems: 'center', position: 'absolute', bottom: 8 },
  pinCircle:   {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  pinPoint: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },

  pinLabelBar: {
    position: 'absolute', left: 70, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, zIndex: 99,
  },
  pinLabelDot: { width: 8, height: 8, borderRadius: 4 },
  pinLabelTxt: { fontSize: 13, fontWeight: '600' },

  confirmBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 18,
    borderTopWidth: 1, zIndex: 99,
  },
  confirmBarInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  confirmBarDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmBarLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  confirmBarAddr:  { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  confirmBarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, height: 52,
  },
  confirmBarBtnTxt: { fontSize: 15, fontWeight: '800'},

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1,
    paddingHorizontal: 24, paddingTop: 22,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:   { fontSize: 12, fontWeight: '500', marginBottom: 18 },

  locationRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginBottom: 20 },
  routeDots:   { alignItems: 'center', paddingTop: 18, paddingBottom: 18 },
  routeDot:    { width: 10, height: 10, borderRadius: 5 },
  routeLine:   { width: 1.5, flex: 1, marginVertical: 4 },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  locBtnLabel:          { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  locBtnAddr:           { fontSize: 13, fontWeight: '500' },
  locBtnIcon:           { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  locBtnIconSecondary:  { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },

  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt:  { fontSize: 15, fontWeight: '800' },
  secondaryBtn:   { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
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