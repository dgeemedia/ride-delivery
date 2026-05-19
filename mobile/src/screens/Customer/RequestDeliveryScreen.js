// mobile/src/screens/Customer/RequestDeliveryScreen.js
//
// Changes from previous version:
//   • RadarPulse JSX child REMOVED from inside <MapView>
//   • useRadarPulse hook added — calls mapRef.current.startRadar/stopRadar imperatively
//     Works on OSM (Leaflet CSS animation) and is a no-op on Google Maps native
//   • scanning useEffect drives start/stop via the hook
//   • RadarPulse removed from RideDeliveryShared import (no longer needed here)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Dimensions, Animated, ScrollView, ActivityIndicator,
  StatusBar, Platform, KeyboardAvoidingView, Alert,
  Image, Modal, SafeAreaView,
} from 'react-native';
import MapView, { Marker, Polyline } from '../../components/SmartMapView';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }               from '../../context/ThemeContext';
import { deliveryAPI, walletAPI } from '../../services/api';
import socketService              from '../../services/socket';

// ── Shared components ─────────────────────────────────────────────────────────
import { useRadarPulse, ScanningBar, StepDots, LocationSearchModal } from '../../components/RideDeliveryShared';
import { PaymentSelector, useCardPayment }                           from '../../components/PaymentSelector';

const { height } = Dimensions.get('window');

const SHEET_SNAP    = height * 0.75;
const LAGOS_DEFAULT = { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.012, longitudeDelta: 0.012 };

const calcFee = (distanceKm, weightKg = 0) => Math.max(400, 600 + distanceKm * 100 + weightKg * 50);
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const VEHICLE_ICONS = { BIKE: 'bicycle-outline', MOTORCYCLE: 'bicycle-outline', CAR: 'car-outline', VAN: 'bus-outline' };

// ── PartnerPin ────────────────────────────────────────────────────────────────
const PartnerPin = ({ partner, selected, onPress, accentColor }) => {
  const scaleA = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(scaleA, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }).start(); }, []);
  useEffect(() => { Animated.spring(scaleA, { toValue: selected ? 1.25 : 1, tension: 160, friction: 7, useNativeDriver: true }).start(); }, [selected]);

  return (
    <Marker
      coordinate={{ latitude: partner.currentLat, longitude: partner.currentLng }}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View style={[pp.wrap, selected && { borderColor: accentColor }, { transform: [{ scale: scaleA }] }]}>
        <View style={[pp.inner, selected && { backgroundColor: accentColor + '22' }]}>
          <Ionicons name={VEHICLE_ICONS[partner.vehicleType] ?? 'bicycle-outline'} size={13} color={selected ? accentColor : '#FFFFFF'} />
        </View>
        {selected && <View style={[pp.pulse, { borderColor: accentColor }]} />}
      </Animated.View>
    </Marker>
  );
};
const pp = StyleSheet.create({
  wrap:  { alignItems: 'center' },
  inner: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
  pulse: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, opacity: 0.4 },
});

// ── PartnerCard ───────────────────────────────────────────────────────────────
const PartnerCard = ({ partner, selected, onSelect, accentColor, theme }) => (
  <TouchableOpacity
    onPress={() => onSelect(partner)}
    activeOpacity={0.85}
    style={[pc.card, { backgroundColor: selected ? accentColor + '12' : theme.backgroundAlt, borderColor: selected ? accentColor : theme.border }]}
  >
    <View style={[pc.avatarWrap, { borderColor: selected ? accentColor : theme.border }]}>
      {partner.profileImage ? (
        <Image source={{ uri: partner.profileImage }} style={pc.avatar} />
      ) : (
        <View style={[pc.avatarFallback, { backgroundColor: accentColor + '22' }]}>
          <Ionicons name={VEHICLE_ICONS[partner.vehicleType] ?? 'bicycle-outline'} size={20} color={accentColor} />
        </View>
      )}
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[pc.name, { color: theme.foreground }]} numberOfLines={1}>{partner.firstName} {partner.lastName}</Text>
      <Text style={[pc.vehicle, { color: theme.hint }]} numberOfLines={1}>
        {partner.vehicleType?.charAt(0) + partner.vehicleType?.slice(1).toLowerCase()} • {partner.vehiclePlate ?? '—'}
      </Text>
      <View style={pc.meta}>
        <Ionicons name="star" size={11} color="#C9A96E" />
        <Text style={[pc.metaTxt, { color: theme.hint }]}> {partner.rating?.toFixed(1) ?? '–'}</Text>
        <Text style={[pc.dot, { color: theme.border }]}>  •  </Text>
        <Ionicons name="time-outline" size={11} color={theme.hint} />
        <Text style={[pc.metaTxt, { color: theme.hint }]}> {partner.etaMinutes} min</Text>
        <Text style={[pc.dot, { color: theme.border }]}>  •  </Text>
        <Ionicons name="location-outline" size={11} color={theme.hint} />
        <Text style={[pc.metaTxt, { color: theme.hint }]}> {partner.distanceKm?.toFixed(1)} km</Text>
      </View>
    </View>
    <View style={[pc.radio, { borderColor: selected ? accentColor : theme.border }]}>
      {selected && <View style={[pc.radioDot, { backgroundColor: accentColor }]} />}
    </View>
  </TouchableOpacity>
);
const pc = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 10 },
  avatarWrap:    { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden' },
  avatar:        { width: '100%', height: '100%' },
  avatarFallback:{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  name:          { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehicle:       { fontSize: 11, marginBottom: 5 },
  meta:          { flexDirection: 'row', alignItems: 'center' },
  metaTxt:       { fontSize: 11 },
  dot:           { fontSize: 11 },
  radio:         { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  radioDot:      { width: 10, height: 10, borderRadius: 5 },
});

// ── PackageInput ──────────────────────────────────────────────────────────────
const PackageInput = ({ label, icon, placeholder, value, onChangeText, keyboardType, multiline, theme, accentColor }) => (
  <View style={[pi.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <View style={[pi.iconWrap, { backgroundColor: accentColor + '18' }]}>
      <Ionicons name={icon} size={14} color={accentColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[pi.label, { color: theme.hint }]}>{label}</Text>
      <TextInput
        style={[pi.input, { color: theme.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={theme.hint + '80'}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        underlineColorAndroid="transparent"
      />
    </View>
  </View>
);
const pi = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, gap: 10, marginBottom: 10 },
  iconWrap:{ width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  label:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  input:   { fontSize: 13, fontWeight: '500', minHeight: 20, outlineWidth: 0, borderWidth: 0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestDeliveryScreen({ navigation }) {
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const accentColor = theme.accent;
  const accentFg    = theme.accentFg ?? '#111111';

  const { handleCardPayment } = useCardPayment();

  // ── Location state ───────────────────────────────────────────────────────
  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);
  const [placingPin,     setPlacingPin]     = useState(null);
  const [resolvingAddr,  setResolvingAddr]  = useState(false);
  const [liveAddress,    setLiveAddress]    = useState('');
  const [mapCenter,      setMapCenter]      = useState(null);

  // ── Search modal ─────────────────────────────────────────────────────────
  const [searchModal,   setSearchModal]   = useState(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  // ── Package form ─────────────────────────────────────────────────────────
  const [pickupContact,      setPickupContact]      = useState('');
  const [dropoffContact,     setDropoffContact]     = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [packageWeight,      setPackageWeight]      = useState('');
  const [packageNotes,       setPackageNotes]       = useState('');

  // ── Partner / scanning state ─────────────────────────────────────────────
  const [partners,        setPartners]        = useState([]);
  const [visiblePartners, setVisiblePartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [scanning,        setScanning]        = useState(false);
  const [scanDone,        setScanDone]        = useState(false);

  // ── Fare / distance ──────────────────────────────────────────────────────
  const [distanceKm,  setDistanceKm]  = useState(null);
  const [feeEstimate, setFeeEstimate] = useState(null);
  const [etaMinutes,  setEtaMinutes]  = useState(null);

  // ── Payment ──────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // ── Nearby quick-destinations ────────────────────────────────────────────
  const [nearbyPlaces,  setNearbyPlaces]  = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // ── Flow ─────────────────────────────────────────────────────────────────
  const [step,       setStep]       = useState(1);
  const [requesting, setRequesting] = useState(false);
  const [mapReady,   setMapReady]   = useState(false);

  const sheetH    = useRef(new Animated.Value(SHEET_SNAP)).current;
  const pinBounce = useRef(new Animated.Value(0)).current;
  const mapRef       = useRef(null);
  const geocodeTimer = useRef(null);

  // ── Radar — imperative, works on OSM + Google Maps ───────────────────────
  const radar = useRadarPulse(mapRef, accentColor);

  useEffect(() => {
    if (scanning && pickupCoords) {
      radar.start(pickupCoords.lat, pickupCoords.lng);
    } else {
      radar.stop();
    }
  }, [scanning, pickupCoords]);

  const TAB_CONTENT_H   = 54;
  const scrollPadBottom = insets.bottom + TAB_CONTENT_H + 24;
  const backBtnTop      = insets.top + 14;

  // ── Location permission ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setPickupCoords({ lat: LAGOS_DEFAULT.latitude, lng: LAGOS_DEFAULT.longitude }); setPickupAddress('Lagos, Nigeria'); return; }
        const loc    = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setPickupCoords(coords);
        reverseGeocode(coords.lat, coords.lng, setPickupAddress);
      } catch { setPickupCoords({ lat: LAGOS_DEFAULT.latitude, lng: LAGOS_DEFAULT.longitude }); setPickupAddress('Lagos, Nigeria'); }
    })();
    socketService.connect?.();
  }, []);

  useEffect(() => {
    if (pickupCoords && mapReady && step === 1 && !placingPin) {
      mapRef.current?.animateToRegion({ latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
    }
  }, [pickupCoords, mapReady]);

  // ── Wallet fetch when entering confirm step ──────────────────────────────
  useEffect(() => {
    if (step === 3) {
      setLoadingWallet(true);
      walletAPI.getWallet()
        .then(res => setWalletBalance(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
        .catch(() => setWalletBalance(0))
        .finally(() => setLoadingWallet(false));
    }
  }, [step]);

  // ── Nearby places ────────────────────────────────────────────────────────
  const fetchNearbyPlaces = useCallback(async (coords) => {
    setLoadingNearby(true);
    try {
      const geoResults = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
      const place      = geoResults?.[0];
      const searchTerm = place?.city ?? place?.district ?? place?.region ?? '';
      if (!searchTerm) { setNearbyPlaces([]); return; }
      const url  = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchTerm)}&lat=${coords.lat}&lon=${coords.lng}&limit=12&lang=en`;
      const res  = await fetch(url, { headers: { 'User-Agent': 'DiakiteApp/1.0' } });
      const data = await res.json();
      const places = (data.features ?? [])
        .filter(f => f.properties.name && Math.abs(f.geometry.coordinates[1] - coords.lat) < 0.5 && Math.abs(f.geometry.coordinates[0] - coords.lng) < 0.5)
        .slice(0, 7)
        .map(f => ({ label: f.properties.name, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
      setNearbyPlaces(places);
    } catch { setNearbyPlaces([]); }
    finally  { setLoadingNearby(false); }
  }, []);

  useEffect(() => { if (pickupCoords) fetchNearbyPlaces(pickupCoords); }, [pickupCoords]);

  const reverseGeocode = useCallback(async (lat, lng, setter) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const place   = results?.[0];
      if (place) {
        const parts = [place.name, place.street, place.district, place.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
        setter(parts.length > 0 ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch { setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────
  const searchPlaces = useCallback(async (text) => {
    setSearchQuery(text);
    if (text.length < 3) { setSearchResults([]); setSearchLoading(false); return; }
    clearTimeout(searchTimer.current);
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const bias = pickupCoords ? `&lat=${pickupCoords.lat}&lon=${pickupCoords.lng}` : '&bbox=2.68,6.35,3.70,6.70';
        const url  = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=8&lang=en${bias}`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'DiakiteApp/1.0' } });
        const data = await res.json();
        setSearchResults((data.features ?? []).map(f => ({
          place_id: `${f.geometry.coordinates[0]}_${f.geometry.coordinates[1]}`,
          description: [f.properties.name, f.properties.street, f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(', '),
          structured_formatting: { main_text: f.properties.name ?? f.properties.street ?? '', secondary_text: [f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(', ') },
          _lat: f.geometry.coordinates[1], _lng: f.geometry.coordinates[0],
        })));
      } catch { setSearchResults([]); }
      finally  { setSearchLoading(false); }
    }, 400);
  }, [pickupCoords]);

  const selectPlace = useCallback(async (place) => {
    const coords = { lat: place._lat, lng: place._lng };
    if (searchModal === 'pickup') {
      setPickupCoords(coords); setPickupAddress(place.description);
      mapRef.current?.animateToRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
    } else {
      setDropoffCoords(coords); setDropoffAddress(place.description);
      if (pickupCoords) {
        setTimeout(() => mapRef.current?.fitToCoordinates(
          [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: coords.lat, longitude: coords.lng }],
          { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
        ), 300);
      }
    }
    setSearchModal(null); setSearchQuery(''); setSearchResults([]);
  }, [searchModal, pickupCoords]);

  const openSearchModal  = useCallback((type) => { setSearchModal(type); setSearchQuery(''); setSearchResults([]); setSearchLoading(false); }, []);
  const closeSearchModal = useCallback(() => { clearTimeout(searchTimer.current); setSearchModal(null); setSearchQuery(''); setSearchResults([]); setSearchLoading(false); }, []);
  const switchToMapPin   = useCallback(() => { const type = searchModal; closeSearchModal(); setTimeout(() => startPickingLocation(type), 300); }, [searchModal]);

  const setQuickDestination = (dest) => {
    setDropoffCoords({ lat: dest.lat, lng: dest.lng }); setDropoffAddress(dest.label);
    if (pickupCoords) {
      setTimeout(() => mapRef.current?.fitToCoordinates(
        [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dest.lat, longitude: dest.lng }],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      ), 300);
    }
  };

  // ── Map pin callbacks ────────────────────────────────────────────────────
  const onRegionChange = useCallback((region) => {
    if (!placingPin) return;
    setMapCenter({ lat: region.latitude, lng: region.longitude });
    setResolvingAddr(true); setLiveAddress('Locating…');
    Animated.spring(pinBounce, { toValue: -14, tension: 200, friction: 8, useNativeDriver: true }).start();
    clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
        const place   = results?.[0];
        if (place) { const parts = [place.name, place.street, place.district, place.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3); setLiveAddress(parts.length > 0 ? parts.join(', ') : `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`); }
        else setLiveAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
      } catch { setLiveAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`); }
      setResolvingAddr(false);
    }, 400);
  }, [placingPin]);

  const onRegionChangeComplete = useCallback((region) => {
    if (!placingPin) return;
    Animated.spring(pinBounce, { toValue: 0, tension: 160, friction: 7, useNativeDriver: true }).start();
    setMapCenter({ lat: region.latitude, lng: region.longitude });
    clearTimeout(geocodeTimer.current); setResolvingAddr(true);
    reverseGeocode(region.latitude, region.longitude, (addr) => { setLiveAddress(addr); setResolvingAddr(false); });
  }, [placingPin, reverseGeocode]);

  const confirmPin = () => {
    if (!mapCenter) return;
    if (placingPin === 'pickup')  { setPickupCoords(mapCenter);  setPickupAddress(liveAddress); }
    if (placingPin === 'dropoff') { setDropoffCoords(mapCenter); setDropoffAddress(liveAddress); }
    setPlacingPin(null); setLiveAddress(''); setMapCenter(null);
  };

  const startPickingLocation = useCallback((type) => {
    setPlacingPin(type);
    const current = type === 'pickup' ? pickupCoords : dropoffCoords;
    const center  = current ?? pickupCoords ?? { lat: LAGOS_DEFAULT.latitude, lng: LAGOS_DEFAULT.longitude };
    setLiveAddress(type === 'pickup' ? pickupAddress : dropoffAddress);
    setMapCenter(center);
    mapRef.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  }, [pickupCoords, dropoffCoords, pickupAddress, dropoffAddress]);

  // ── Proceed — radar scan phase ───────────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) { Alert.alert('Set both locations', 'Please set both pickup and drop-off locations.'); return; }
    if (!pickupContact || !dropoffContact) { Alert.alert('Missing contacts', 'Please enter phone numbers for both pickup and drop-off contacts.'); return; }
    if (!packageDescription) { Alert.alert('Missing package info', 'Please describe what you are sending.'); return; }
    const km  = haversineKm(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);
    const wKg = parseFloat(packageWeight) || 0;
    setDistanceKm(km); setFeeEstimate(calcFee(km, wKg)); setEtaMinutes(Math.ceil(km / 0.4));
    setStep(2); setScanning(true); setScanDone(false); // radar starts via useEffect
    setPartners([]); setVisiblePartners([]); setSelectedPartner(null);
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }],
        { edgePadding: { top: 100, right: 60, bottom: 280, left: 60 }, animated: true }
      );
    }, 300);
    Animated.timing(sheetH, { toValue: 110, duration: 300, useNativeDriver: false }).start();
    try {
      const res  = await deliveryAPI.getNearbyPartners({ pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng, dropoffLat: dropoffCoords.lat, dropoffLng: dropoffCoords.lng, radiusKm: 15 });
      const list = (res?.data?.partners ?? res?.partners ?? []).filter(p => !String(p.partnerId).startsWith('mock-'));
      setPartners(list);
      list.forEach((_, i) => { setTimeout(() => setVisiblePartners(prev => [...prev, list[i]]), i * 200 + 500); });
      setTimeout(() => {
        setScanDone(true); setScanning(false); // radar stops via useEffect
        Animated.spring(sheetH, { toValue: SHEET_SNAP, tension: 60, friction: 12, useNativeDriver: false }).start();
      }, list.length * 200 + 1200);
    } catch {
      setScanning(false); setScanDone(true); setPartners([]);
      Animated.spring(sheetH, { toValue: SHEET_SNAP, tension: 60, friction: 12, useNativeDriver: false }).start();
    }
  }, [pickupCoords, dropoffCoords, pickupContact, dropoffContact, packageDescription, packageWeight]);

  // ── Confirm delivery ─────────────────────────────────────────────────────
const confirmDelivery = async () => {
    if (!selectedPartner) { Alert.alert('Select a partner', 'Please choose a delivery partner.'); return; }
    if (paymentMethod === 'WALLET' && walletBalance < feeEstimate) {
      Alert.alert('Insufficient Balance', 'Your wallet balance is less than the fee. Please top up or choose another payment method.');
      return;
    }
    setRequesting(true);
    try {
      const cardResult = await handleCardPayment(paymentMethod, feeEstimate);
      const res = await deliveryAPI.requestDelivery({
        pickupAddress,  pickupLat: pickupCoords.lat,  pickupLng: pickupCoords.lng,  pickupContact,
        dropoffAddress, dropoffLat: dropoffCoords.lat, dropoffLng: dropoffCoords.lng, dropoffContact,
        packageDescription, packageWeight: parseFloat(packageWeight) || 0,
        notes: packageNotes, estimatedFee: feeEstimate,
        partnerId: selectedPartner.partnerId,
        paymentMethod,
        transactionId: cardResult?.transactionId ?? null,
      });
      const newDeliveryId = res?.data?.delivery?.id ?? res?.data?.id ?? null;
      if (navigation.replace) navigation.replace('DeliveryTracking', { deliveryId: newDeliveryId });
      else navigation.navigate('DeliveryTracking', { deliveryId: newDeliveryId });
    } catch (err) {
      if (err?.message !== 'CANCELLED') Alert.alert('Request failed', err?.message ?? 'Could not place delivery.');
    } finally { setRequesting(false); }
  };

  const handleSelectPartner = (partner) => {
    setSelectedPartner(partner);
    mapRef.current?.animateToRegion({ latitude: partner.currentLat, longitude: partner.currentLng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
  };

  const isPickingLocation = placingPin !== null;
  const pinColor          = placingPin === 'dropoff' ? '#E05555' : accentColor;
  const pinFg             = placingPin === 'dropoff' ? '#FFFFFF' : accentFg;
  const mapRegion         = pickupCoords ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 } : LAGOS_DEFAULT;

  const confirmBtnLabel =
    paymentMethod === 'WALLET'      ? 'Confirm • Pay via Wallet'      :
    paymentMethod === 'PAYSTACK'    ? 'Confirm • Pay via Paystack'    :
    paymentMethod === 'FLUTTERWAVE' ? 'Confirm • Pay via Flutterwave' :
                                      'Confirm • Pay Cash';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── FULL-SCREEN MAP ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
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
            coordinates={[{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }]}
            strokeColor={accentColor} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {/* Partner pins — revealed one-by-one */}
        {step >= 2 && visiblePartners.map((p) => (
          <PartnerPin key={p.partnerId} partner={p} selected={selectedPartner?.partnerId === p.partnerId} onPress={() => handleSelectPartner(p)} accentColor={accentColor} />
        ))}
        {/* NOTE: No <RadarPulse> here — radar is driven imperatively via useRadarPulse */}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      {/* Back button */}
      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop, backgroundColor: theme.card + 'CC', borderColor: theme.border }]}
        onPress={() => {
          if (isPickingLocation) { setPlacingPin(null); setLiveAddress(''); setMapCenter(null); }
          else if (step > 1) {
            setStep(prev => prev - 1);
            if (step === 2) Animated.timing(sheetH, { toValue: SHEET_SNAP, duration: 200, useNativeDriver: false }).start();
          }
          else navigation.goBack();
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* ── PIN-PLACING MODE ── */}
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
            <Text style={[s.pinLabelTxt, { color: theme.foreground }]}>{placingPin === 'pickup' ? 'Move map to set pickup' : 'Move map to set drop-off'}</Text>
          </View>
          <View style={[s.confirmBar, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + TAB_CONTENT_H + 24 }]}>
            <View style={s.confirmBarInner}>
              <View style={[s.confirmBarDot, { backgroundColor: pinColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.confirmBarLabel, { color: theme.hint }]}>{placingPin === 'pickup' ? 'PICKUP LOCATION' : 'DROP-OFF LOCATION'}</Text>
                <Text style={[s.confirmBarAddr, { color: theme.foreground }]} numberOfLines={2}>{resolvingAddr ? 'Locating…' : (liveAddress || 'Move the map to select')}</Text>
              </View>
              {resolvingAddr && <ActivityIndicator color={pinColor} size="small" style={{ marginLeft: 8 }} />}
            </View>
            <TouchableOpacity
              style={[s.confirmBarBtn, { backgroundColor: pinColor, opacity: resolvingAddr ? 0.6 : 1 }]}
              onPress={confirmPin} disabled={resolvingAddr || !liveAddress} activeOpacity={0.88}
            >
              <Ionicons name="checkmark" size={18} color={pinFg} />
              <Text style={[s.confirmBarBtnTxt, { color: pinFg }]}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── KEYBOARD-AWARE SHEET WRAPPER ── */}
      {!isPickingLocation && (
        <KeyboardAvoidingView style={s.kavWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
          <Animated.View style={[s.sheet, { backgroundColor: theme.background, borderColor: theme.border, height: step === 2 ? sheetH : SHEET_SNAP }]}>

            {/* Handle + step dots — hidden during compact scan bar */}
            {!(step === 2 && !scanDone) && (
              <View style={s.sheetTop}>
                <View style={[s.handle, { backgroundColor: theme.border }]} />
                <StepDots step={step} accentColor={accentColor} theme={theme} />
              </View>
            )}

            {/* ── STEP 1 — locations + package info ── */}
            {step === 1 && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={[s.scrollContent, { paddingBottom: scrollPadBottom }]}
              >
                <Text style={[s.sheetTitle, { color: theme.foreground }]}>Send a Package</Text>
                <Text style={[s.sheetSub, { color: theme.hint }]}>Search or tap the map icon to pin your location</Text>

                <View style={s.locationRow}>
                  <View style={s.routeDots}>
                    <View style={[s.routeDot, { backgroundColor: accentColor }]} />
                    <View style={[s.routeLine, { backgroundColor: theme.border }]} />
                    <View style={[s.routeDot, { backgroundColor: '#E05555' }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity style={[s.locBtn, { backgroundColor: theme.card, borderColor: accentColor + '50' }]} onPress={() => openSearchModal('pickup')} activeOpacity={0.85}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.locBtnLabel, { color: accentColor }]}>PICKUP</Text>
                        <Text style={[s.locBtnAddr, { color: pickupCoords ? theme.foreground : theme.hint }]} numberOfLines={1}>{pickupAddress || 'Search or pin pickup location'}</Text>
                      </View>
                      <View style={[s.locBtnIcon, { backgroundColor: accentColor + '18' }]}><Ionicons name="search" size={14} color={accentColor} /></View>
                      <TouchableOpacity style={[s.locBtnIconSecondary, { backgroundColor: accentColor + '10' }]} onPress={(e) => { e.stopPropagation(); startPickingLocation('pickup'); }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Ionicons name="map-outline" size={14} color={accentColor} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    <View style={{ height: 6 }} />
                    <TouchableOpacity style={[s.locBtn, { backgroundColor: theme.card, borderColor: '#E05555' + '50' }]} onPress={() => openSearchModal('dropoff')} activeOpacity={0.85}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.locBtnLabel, { color: '#E05555' }]}>DROP-OFF</Text>
                        <Text style={[s.locBtnAddr, { color: dropoffCoords ? theme.foreground : theme.hint }]} numberOfLines={1}>{dropoffAddress || 'Search or pin drop-off location'}</Text>
                      </View>
                      <View style={[s.locBtnIcon, { backgroundColor: '#E05555' + '18' }]}><Ionicons name="search" size={14} color="#E05555" /></View>
                      <TouchableOpacity style={[s.locBtnIconSecondary, { backgroundColor: '#E05555' + '10' }]} onPress={(e) => { e.stopPropagation(); startPickingLocation('dropoff'); }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                        <Ionicons name="map-outline" size={14} color="#E05555" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                </View>

                {(loadingNearby || nearbyPlaces.length > 0) && (
                  <>
                    <Text style={[s.quickLabel, { color: theme.hint }]}>NEARBY PLACES</Text>
                    {loadingNearby
                      ? <ActivityIndicator color={accentColor} style={{ marginBottom: 20, alignSelf: 'flex-start' }} size="small" />
                      : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                          {nearbyPlaces.map(d => (
                            <TouchableOpacity key={`${d.lat}_${d.lng}`} style={[s.quickChip, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setQuickDestination(d)} activeOpacity={0.8}>
                              <Ionicons name="location-outline" size={13} color={accentColor} />
                              <Text style={[s.quickChipTxt, { color: theme.foreground }]}>{d.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                    }
                  </>
                )}

                <Text style={[s.sectionLabel, { color: theme.hint }]}>CONTACT & PACKAGE</Text>
                <PackageInput label="PICKUP CONTACT"      icon="call-outline"          placeholder="+234 801 234 5678"                    value={pickupContact}      onChangeText={setPickupContact}      keyboardType="phone-pad" theme={theme} accentColor={accentColor} />
                <PackageInput label="DROP-OFF CONTACT"    icon="call-outline"          placeholder="+234 801 234 5678"                    value={dropoffContact}     onChangeText={setDropoffContact}     keyboardType="phone-pad" theme={theme} accentColor={accentColor} />
                <PackageInput label="PACKAGE DESCRIPTION" icon="cube-outline"          placeholder="e.g. Documents, Clothes, Electronics" value={packageDescription} onChangeText={setPackageDescription}                         theme={theme} accentColor={accentColor} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PackageInput label="WEIGHT (kg)" icon="scale-outline" placeholder="Optional" value={packageWeight} onChangeText={setPackageWeight} keyboardType="numeric" theme={theme} accentColor={accentColor} />
                  </View>
                </View>
                <PackageInput label="SPECIAL NOTES" icon="document-text-outline" placeholder="Handle with care, fragile..." value={packageNotes} onChangeText={setPackageNotes} multiline theme={theme} accentColor={accentColor} />

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: (pickupCoords && dropoffCoords) ? accentColor : theme.border }]}
                  onPress={proceedToMap} activeOpacity={0.88}
                >
                  <Ionicons name="bicycle-outline" size={18} color={(pickupCoords && dropoffCoords) ? accentFg : theme.muted} />
                  <Text style={[s.primaryBtnTxt, { color: (pickupCoords && dropoffCoords) ? accentFg : theme.muted }]}>Find Delivery Partners</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* ── STEP 2 — scanning + partner list ── */}
            {step === 2 && (
              <>
                <ScanningBar theme={theme} accentColor={accentColor} count={partners.length} done={scanDone} label="partner" />
                {scanDone && (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scrollContent, { paddingBottom: scrollPadBottom, paddingTop: 8 }]}>
                    <View style={[s.feeBadge, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 14 }]}>
                      <View style={s.feeItem}><Ionicons name="navigate-outline" size={13} color={theme.hint} /><Text style={[s.feeVal, { color: theme.foreground }]}>{distanceKm?.toFixed(1)} km</Text></View>
                      <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
                      <View style={s.feeItem}><Ionicons name="time-outline" size={13} color={theme.hint} /><Text style={[s.feeVal, { color: theme.foreground }]}>~{etaMinutes} min</Text></View>
                      <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
                      <View style={s.feeItem}><Ionicons name="cash-outline" size={13} color={theme.hint} /><Text style={[s.feeVal, { color: accentColor }]}>₦{feeEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text></View>
                    </View>
                    <Text style={[s.sheetSub, { color: theme.hint, marginBottom: 12 }]}>Tap a pin on the map or select a partner below.</Text>
                    {partners.length === 0 ? (
                      <View style={s.empty}>
                        <Ionicons name="bicycle-outline" size={36} color={theme.hint} />
                        <Text style={[s.emptyTxt, { color: theme.hint }]}>No partners available right now</Text>
                        <TouchableOpacity onPress={proceedToMap} style={[s.retryBtn, { borderColor: accentColor + '50' }]}>
                          <Text style={[s.retryTxt, { color: accentColor }]}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      partners.map((item) => (
                        <PartnerCard key={item.partnerId} partner={item} selected={selectedPartner?.partnerId === item.partnerId} onSelect={handleSelectPartner} accentColor={accentColor} theme={theme} />
                      ))
                    )}
                    {selectedPartner && (
                      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]} onPress={() => setStep(3)} activeOpacity={0.88}>
                        <Text style={[s.primaryBtnTxt, { color: accentFg }]}>Continue with {selectedPartner.firstName}</Text>
                        <Ionicons name="arrow-forward" size={16} color={accentFg} />
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}
              </>
            )}

            {/* ── STEP 3 — confirm delivery ── */}
            {step === 3 && selectedPartner && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scrollContent, { paddingBottom: scrollPadBottom }]}>
                <Text style={[s.sheetTitle, { color: theme.foreground }]}>Confirm Delivery</Text>

                <View style={[s.confirmRoute, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={s.confirmRow}>
                    <View style={[s.cDot, { backgroundColor: accentColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.confirmAddr, { color: theme.foreground }]} numberOfLines={2}>{pickupAddress}</Text>
                      <Text style={[s.confirmContact, { color: theme.hint }]}>{pickupContact}</Text>
                    </View>
                  </View>
                  <View style={[s.confirmRouteLine, { backgroundColor: theme.border }]} />
                  <View style={s.confirmRow}>
                    <View style={[s.cDot, { backgroundColor: '#E05555' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.confirmAddr, { color: theme.foreground }]} numberOfLines={2}>{dropoffAddress}</Text>
                      <Text style={[s.confirmContact, { color: theme.hint }]}>{dropoffContact}</Text>
                    </View>
                  </View>
                </View>

                <View style={[s.packageSummary, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={s.pkgRow}><Ionicons name="cube-outline" size={14} color={theme.hint} /><Text style={[s.pkgTxt, { color: theme.foreground }]}>{packageDescription}</Text></View>
                  {packageWeight ? <View style={s.pkgRow}><Ionicons name="scale-outline" size={14} color={theme.hint} /><Text style={[s.pkgTxt, { color: theme.foreground }]}>{packageWeight} kg</Text></View> : null}
                  {packageNotes  ? <View style={s.pkgRow}><Ionicons name="document-text-outline" size={14} color={theme.hint} /><Text style={[s.pkgTxt, { color: theme.hint }]} numberOfLines={2}>{packageNotes}</Text></View> : null}
                </View>

                <View style={[s.confirmCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={s.confirmDriver}>
                    <View style={[s.confirmAvatarFallback, { backgroundColor: accentColor + '22' }]}>
                      <Ionicons name={VEHICLE_ICONS[selectedPartner.vehicleType] ?? 'bicycle-outline'} size={20} color={accentColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.confirmName, { color: theme.foreground }]}>{selectedPartner.firstName} {selectedPartner.lastName}</Text>
                      <Text style={[s.confirmVehicle, { color: theme.hint }]}>{selectedPartner.vehicleType} • {selectedPartner.vehiclePlate ?? '—'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="star" size={12} color="#C9A96E" />
                        <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedPartner.rating?.toFixed(1) ?? '–'}</Text>
                        <Text style={[s.confirmMeta, { color: theme.border }]}>•</Text>
                        <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedPartner.totalDeliveries} deliveries</Text>
                      </View>
                    </View>
                    <View style={s.confirmFareBox}>
                      <Text style={[s.confirmFareLabel, { color: theme.hint }]}>FEE</Text>
                      <Text style={[s.confirmFare, { color: accentColor }]}>₦{feeEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text>
                    </View>
                  </View>
                </View>

                <PaymentSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  walletBalance={walletBalance}
                  loadingWallet={loadingWallet}
                  fare={feeEstimate ?? 0}
                  theme={theme}
                  accentColor={accentColor}
                />

                <View style={[s.etaStrip, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}>
                  <Ionicons name="time-outline" size={14} color={accentColor} />
                  <Text style={[s.etaTxt, { color: accentColor }]}>Partner arrives in approx. {selectedPartner.etaMinutes ?? etaMinutes} minutes</Text>
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: requesting ? accentColor + '80' : accentColor }]}
                  onPress={confirmDelivery} disabled={requesting} activeOpacity={0.88}
                >
                  {requesting ? <ActivityIndicator color={accentFg} /> : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color={accentFg} />
                      <Text style={[s.primaryBtnTxt, { color: accentFg }]}>{confirmBtnLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={[s.secondaryBtn, { borderColor: theme.border }]} onPress={() => setStep(2)} activeOpacity={0.8}>
                  <Text style={[s.secondaryBtnTxt, { color: theme.hint }]}>Change Partner</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      <LocationSearchModal
        visible={searchModal !== null} type={searchModal} query={searchQuery}
        results={searchResults} loading={searchLoading}
        onChangeText={searchPlaces} onSelect={selectPlace}
        onClose={closeSearchModal} onSwitchToPin={switchToMapPin}
        accentColor={accentColor} theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.4)' },
  backBtn:     { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  crosshairWrap: { position: 'absolute', top: '50%', left: '50%', marginTop: -56, marginLeft: -20, alignItems: 'center', zIndex: 50 },
  pinShadow:   { width: 16, height: 8, borderRadius: 8, marginTop: 4 },
  pinAnimWrap: { alignItems: 'center', position: 'absolute', bottom: 8 },
  pinCircle:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  pinPoint:    { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  pinLabelBar: { position: 'absolute', left: 70, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, zIndex: 99 },
  pinLabelDot: { width: 8, height: 8, borderRadius: 4 },
  pinLabelTxt: { fontSize: 13, fontWeight: '600' },
  confirmBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, borderTopWidth: 1, zIndex: 99 },
  confirmBarInner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  confirmBarDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmBarLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  confirmBarAddr:   { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  confirmBarBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, height: 52 },
  confirmBarBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  kavWrapper:  { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:       { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 22 },
  sheetTop:    { alignItems: 'center', paddingTop: 10, paddingHorizontal: 24, paddingBottom: 0 },
  handle:      { width: 38, height: 4, borderRadius: 2, marginBottom: 14 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 6 },
  sheetTitle:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:    { fontSize: 12, fontWeight: '500', marginBottom: 18 },
  locationRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginBottom: 20 },
  routeDots:   { alignItems: 'center', paddingTop: 18, paddingBottom: 18 },
  routeDot:    { width: 10, height: 10, borderRadius: 5 },
  routeLine:   { width: 1.5, flex: 1, marginVertical: 4 },
  locBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12 },
  locBtnLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  locBtnAddr:  { fontSize: 13, fontWeight: '500' },
  locBtnIcon:          { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  locBtnIconSecondary: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800' },
  secondaryBtn:    { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  secondaryBtnTxt: { fontSize: 14, fontWeight: '600' },
  feeBadge:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  feeItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  feeVal:     { fontSize: 13, fontWeight: '700' },
  feeDivider: { width: 1 },
  empty:    { alignItems: 'center', paddingVertical: 24 },
  emptyTxt: { fontSize: 13, marginTop: 10, marginBottom: 14 },
  retryBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt: { fontSize: 13, fontWeight: '700' },
  confirmRoute:     { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  confirmRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cDot:             { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmAddr:      { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  confirmContact:   { fontSize: 11, marginTop: 1 },
  confirmRouteLine: { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 4 },
  packageSummary:   { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 8 },
  pkgRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pkgTxt:           { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },
  confirmCard:           { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  confirmDriver:         { flexDirection: 'row', alignItems: 'center' },
  confirmAvatarFallback: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  confirmName:     { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  confirmVehicle:  { fontSize: 11, marginBottom: 2 },
  confirmMeta:     { fontSize: 11 },
  confirmFareBox:   { alignItems: 'flex-end' },
  confirmFareLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  confirmFare:      { fontSize: 18, fontWeight: '900' },
  etaStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  etaTxt:   { fontSize: 12, fontWeight: '600', flex: 1 },
});