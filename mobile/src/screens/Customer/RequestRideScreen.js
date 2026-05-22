// mobile/src/screens/Customer/RequestRideScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, ScrollView, ActivityIndicator, StatusBar,
  Platform, KeyboardAvoidingView, Alert, Image,
} from 'react-native';
import MapView, { Marker, Polyline } from '../../components/SmartMapView';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }           from '../../context/ThemeContext';
import { rideAPI, walletAPI } from '../../services/api';
import socketService          from '../../services/socket';

import { useRadarPulse, ScanningBar, StepDots, LocationSearchModal } from '../../components/RideDeliveryShared';
import { PaymentSelector, useCardPayment }                           from '../../components/PaymentSelector';

const { height } = Dimensions.get('window');
const SHEET_SNAP = height * 0.75;

const calcFare    = (km) => Math.max(300, 500 + km * 120);
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fareColor = (fare) => {
  if (fare >= 3000) return '#5DAA72';
  if (fare >= 1500) return '#FFB800';
  return '#A78BFA';
};

// ── DriverPin ─────────────────────────────────────────────────────────────────
const DriverPin = ({ driver, selected, onPress, accentColor }) => {
  const scaleA = useRef(new Animated.Value(0)).current;
  const color  = fareColor(driver.effectiveFare ?? driver.estimatedFare ?? 0);

  useEffect(() => {
    Animated.spring(scaleA, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }).start();
  }, []);
  useEffect(() => {
    Animated.spring(scaleA, { toValue: selected ? 1.25 : 1, tension: 160, friction: 7, useNativeDriver: true }).start();
  }, [selected]);

  return (
    <Marker
      coordinate={{ latitude: driver.currentLat, longitude: driver.currentLng }}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View style={[dp.wrap, { borderColor: selected ? color : '#3A3A3A', transform: [{ scale: scaleA }] }]}>
        <View style={[dp.inner, { backgroundColor: selected ? color + '22' : 'transparent' }]}>
          <Ionicons name="car" size={13} color={selected ? color : '#FFFFFF'} />
        </View>
        <View style={[dp.fareBadge, { backgroundColor: color }]}>
          <Text style={dp.fareText}>
            ₦{Number(driver.effectiveFare ?? driver.estimatedFare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        {selected && <View style={[dp.pulse, { borderColor: color }]} />}
      </Animated.View>
    </Marker>
  );
};
const dp = StyleSheet.create({
  wrap:      { alignItems: 'center' },
  inner:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
  fareBadge: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginTop: 3 },
  fareText:  { fontSize: 9, fontWeight: '900', color: '#080C18' },
  pulse:     { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, opacity: 0.4 },
});

// ── DriverCard ────────────────────────────────────────────────────────────────
const DriverCard = ({ driver, selected, onSelect, accentColor, theme }) => {
  const fare  = driver.effectiveFare ?? driver.estimatedFare ?? 0;
  const color = fareColor(fare);
  return (
    <TouchableOpacity
      onPress={() => onSelect(driver)} activeOpacity={0.85}
      style={[dc.card, { backgroundColor: selected ? accentColor + '12' : theme.backgroundAlt, borderColor: selected ? accentColor : theme.border }]}
    >
      <View style={[dc.stripe, { backgroundColor: color }]} />
      <View style={[dc.avatarWrap, { borderColor: selected ? accentColor : theme.border }]}>
        {driver.profileImage ? (
          <Image source={{ uri: driver.profileImage }} style={dc.avatar} />
        ) : (
          <View style={[dc.avatarFallback, { backgroundColor: accentColor + '22' }]}>
            <Text style={[dc.avatarInitial, { color: accentColor }]}>{driver.firstName?.[0]}{driver.lastName?.[0]}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={[dc.name, { color: theme.foreground }]} numberOfLines={1}>{driver.firstName} {driver.lastName}</Text>
          {driver.floorMultiplier > 1.0 && (
            <View style={[dc.floorBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
              <Text style={[dc.floorTxt, { color }]}>FLOOR</Text>
            </View>
          )}
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
          <Ionicons name="navigate-outline" size={11} color={theme.hint} />
          <Text style={[dc.metaTxt, { color: theme.hint }]}> {driver.distanceKm?.toFixed(1)} km</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        <Text style={[dc.fare, { color }]}>₦{Number(fare).toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text>
        <View style={[dc.radio, { borderColor: selected ? accentColor : theme.border }]}>
          {selected && <View style={[dc.radioDot, { backgroundColor: accentColor }]} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};
const dc = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', marginBottom: 10 },
  stripe:        { width: 5, alignSelf: 'stretch' },
  avatarWrap:    { width: 48, height: 48, borderRadius: 24, borderWidth: 2, overflow: 'hidden', marginLeft: 10 },
  avatar:        { width: '100%', height: '100%' },
  avatarFallback:{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 15, fontWeight: '800' },
  name:          { fontSize: 13, fontWeight: '700' },
  vehicle:       { fontSize: 10, marginBottom: 4 },
  meta:          { flexDirection: 'row', alignItems: 'center' },
  metaTxt:       { fontSize: 10 },
  dot:           { fontSize: 10 },
  fare:          { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioDot:      { width: 9, height: 9, borderRadius: 5 },
  floorBadge:    { borderRadius: 5, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1 },
  floorTxt:      { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
});

// ── WaitingSheet ──────────────────────────────────────────────────────────────
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
      <Text style={[wt.sub, { color: theme.hint }]}>Waiting for {driverName} to accept…</Text>
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestRideScreen({ navigation }) {
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const accentColor = theme.accent;
  const accentFg    = theme.accentFg ?? '#111111';

  const { handleCardPayment } = useCardPayment();

  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);
  const [placingPin,     setPlacingPin]     = useState(null);
  const [resolvingAddr,  setResolvingAddr]  = useState(false);
  const [liveAddress,    setLiveAddress]    = useState('');
  const [mapCenter,      setMapCenter]      = useState(null);

  const [searchModal,   setSearchModal]   = useState(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer  = useRef(null);
  const geocodeTimer = useRef(null);

  const [drivers,        setDrivers]        = useState([]);
  const [visibleDrivers, setVisibleDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [scanning,       setScanning]       = useState(false);
  const [scanDone,       setScanDone]       = useState(false);

  const [distanceKm,   setDistanceKm]   = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [etaMinutes,   setEtaMinutes]   = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const [nearbyPlaces,  setNearbyPlaces]  = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  const [step,          setStep]          = useState(1);
  const [requesting,    setRequesting]    = useState(false);
  const [pendingRideId, setPendingRideId] = useState(null);
  const [rideAccepted,  setRideAccepted]  = useState(false);
  const [mapReady,      setMapReady]      = useState(false);

  const sheetH    = useRef(new Animated.Value(height * 0.55)).current;
  const pinBounce = useRef(new Animated.Value(0)).current;
  const mapRef    = useRef(null);

  // ── Radar — imperative, works on OSM + Google Maps ───────────────────────
  const radar = useRadarPulse(mapRef, accentColor);

  useEffect(() => {
    if (scanning && pickupCoords) {
      radar.start(pickupCoords.lat, pickupCoords.lng);
    } else {
      radar.stop();
    }
  }, [scanning, pickupCoords]);

  const TAB_CONTENT_H  = 54;
  const sheetPadBottom = insets.bottom + TAB_CONTENT_H + 24;
  const backBtnTop     = insets.top + 14;
  const sheetTop       = insets.top + 70;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setPickupCoords({ lat: 6.5244, lng: 3.3792 }); setPickupAddress('Lagos, Nigeria'); return; }
        const loc    = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setPickupCoords(coords);
        reverseGeocode(coords.lat, coords.lng, setPickupAddress);
      } catch { setPickupCoords({ lat: 6.5244, lng: 3.3792 }); setPickupAddress('Lagos, Nigeria'); }
    })();
    socketService.connect().catch(() => {});
  }, []);

  useEffect(() => {
    if (pickupCoords && mapReady && step === 1 && !placingPin) {
      mapRef.current?.animateToRegion({ latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
    }
  }, [pickupCoords, mapReady]);

  useEffect(() => {
    if (step === 3) {
      setLoadingWallet(true);
      walletAPI.getWallet()
        .then(res => setWalletBalance(res?.data?.wallet?.balance ?? res?.data?.balance ?? 0))
        .catch(() => setWalletBalance(0))
        .finally(() => setLoadingWallet(false));
    }
  }, [step]);

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
    finally { setLoadingNearby(false); }
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
        Alert.alert('Request Cancelled', 'The driver cancelled. Please choose another driver.');
      }
    };
    socketService.on('ride:status:update', handleStatus);
    socketService.on('ride:cancelled',     handleCancelled);
    return () => { socketService.off('ride:status:update', handleStatus); socketService.off('ride:cancelled', handleCancelled); };
  }, [pendingRideId, navigation]);

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
      finally { setSearchLoading(false); }
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
    if (placingPin === 'pickup') { setPickupCoords(mapCenter); setPickupAddress(liveAddress); }
    else { setDropoffCoords(mapCenter); setDropoffAddress(liveAddress); }
    setPlacingPin(null); setLiveAddress(''); setMapCenter(null);
  };

  const startPickingLocation = useCallback((type) => {
    setPlacingPin(type);
    const center = (type === 'pickup' ? pickupCoords : dropoffCoords) ?? pickupCoords ?? { lat: 6.5244, lng: 3.3792 };
    setLiveAddress(type === 'pickup' ? pickupAddress : dropoffAddress);
    setMapCenter(center);
    mapRef.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
  }, [pickupCoords, dropoffCoords, pickupAddress, dropoffAddress]);

  const setQuickDestination = (dest) => {
    setDropoffCoords({ lat: dest.lat, lng: dest.lng }); setDropoffAddress(dest.label);
    if (pickupCoords) {
      setTimeout(() => mapRef.current?.fitToCoordinates(
        [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dest.lat, longitude: dest.lng }],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      ), 300);
    }
  };

  const proceedToMap = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) { Alert.alert('Set both locations', 'Please set both pickup and drop-off locations.'); return; }
    const km = haversineKm(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);
    setDistanceKm(km); setFareEstimate(calcFare(km)); setEtaMinutes(Math.ceil(km / 0.5));
    setStep(2); setScanning(true); setScanDone(false);  // radar starts via useEffect
    setDrivers([]); setVisibleDrivers([]); setSelectedDriver(null);
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }],
        { edgePadding: { top: 100, right: 60, bottom: 280, left: 60 }, animated: true }
      );
    }, 300);
    Animated.timing(sheetH, { toValue: 200, duration: 300, useNativeDriver: false }).start();
    try {
      const res  = await rideAPI.getNearbyDrivers({ pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng, dropoffLat: dropoffCoords.lat, dropoffLng: dropoffCoords.lng, radiusKm: 50 });
      const list = (res?.data?.drivers ?? res?.drivers ?? []).filter(d => !String(d.driverId).startsWith('mock-'));
      setDrivers(list);
      list.forEach((_, i) => { setTimeout(() => setVisibleDrivers(prev => [...prev, list[i]]), i * 200 + 500); });
      setTimeout(() => {
        setScanDone(true); setScanning(false); // radar stops via useEffect
        Animated.spring(sheetH, { toValue: height * 0.55, tension: 60, friction: 12, useNativeDriver: false }).start();
      }, list.length * 200 + 1200);
    } catch (err) {
      setScanning(false); setScanDone(true);
      Animated.spring(sheetH, { toValue: height * 0.55, tension: 60, friction: 12, useNativeDriver: false }).start();
      Alert.alert('Drivers unavailable', err?.message ?? 'Could not load nearby drivers.');
    }
  }, [pickupCoords, dropoffCoords]);

  const confirmRide = async () => {
    if (!selectedDriver) { Alert.alert('Select a driver', 'Please choose a driver.'); return; }
    if (paymentMethod === 'WALLET' && walletBalance < (selectedDriver.effectiveFare ?? fareEstimate)) {
      Alert.alert('Insufficient Balance', 'Your wallet balance is less than the fare. Please top up or choose another payment method.');
      return;
    }
    setRequesting(true);
    try {
      const cardResult = await handleCardPayment(paymentMethod, selectedDriver.effectiveFare ?? fareEstimate);
      const res    = await rideAPI.requestSpecificDriver({
        pickupAddress, pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng,
        dropoffAddress, dropoffLat: dropoffCoords.lat, dropoffLng: dropoffCoords.lng,
        driverId: selectedDriver.driverId,
        estimatedFare: selectedDriver.effectiveFare ?? fareEstimate,
        paymentMethod,
        transactionId: cardResult?.transactionId ?? null,
      });
      const rideId = res?.data?.ride?.id ?? res?.ride?.id;
      setPendingRideId(rideId);
      if (rideId) socketService.joinRide(rideId);
      setStep(4);
      Animated.timing(sheetH, { toValue: SHEET_SNAP, duration: 300, useNativeDriver: false }).start();
    } catch (err) {
      if (err?.message !== 'CANCELLED') Alert.alert('Request failed', err?.message ?? 'Could not book the ride.');
    } finally { setRequesting(false); }
  };

const cancelPendingRide = async () => {
  if (!pendingRideId) { navigation.goBack(); return; }
  try {
    await rideAPI.cancelRide(pendingRideId, { reason: 'Customer cancelled before acceptance' });
    socketService.leaveRide(pendingRideId);
  } catch (err) {
    // If already cancelled or not found, still proceed to clean up locally
    const msg = err?.message ?? '';
    if (!msg.includes('Cannot cancel') && !msg.includes('not found')) {
      Alert.alert('Note', 'Could not reach server, but your request has been removed locally.');
    }
  }
  setPendingRideId(null);
  setRideAccepted(false);
  setStep(2);
};

  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
    if (driver.currentLat && driver.currentLng) {
      mapRef.current?.animateToRegion({ latitude: driver.currentLat, longitude: driver.currentLng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
    }
  };

  const isPickingLocation = placingPin !== null;
  const pinColor          = placingPin === 'dropoff' ? '#E05555' : accentColor;
  const pinFg             = placingPin === 'dropoff' ? '#FFFFFF' : accentFg;
  const mapRegion         = pickupCoords ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 } : undefined;
  const sheetStyle = step === 2 ? { height: sheetH } : { height: SHEET_SNAP };

  const confirmBtnLabel =
    paymentMethod === 'WALLET'      ? 'Confirm • Pay via Wallet'      :
    paymentMethod === 'PAYSTACK'    ? 'Confirm • Pay via Paystack'    :
    paymentMethod === 'FLUTTERWAVE' ? 'Confirm • Pay via Flutterwave' :
                                      'Confirm • Pay Cash';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
        {/* Pickup landmark */}
        {pickupCoords && !isPickingLocation && (
          <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 1 }} pinColor={accentColor} />
        )}
        {/* Dropoff landmark */}
        {dropoffCoords && !isPickingLocation && (
          <Marker coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }} anchor={{ x: 0.5, y: 1 }} pinColor="#E05555" />
        )}
        {/* Route line */}
        {pickupCoords && dropoffCoords && !isPickingLocation && (
          <Polyline
            coordinates={[{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }, { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }]}
            strokeColor={accentColor} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {/* Driver pins — revealed one-by-one */}
        {step >= 2 && visibleDrivers.map((d) => (
          <DriverPin
            key={d.driverId} driver={d}
            selected={selectedDriver?.driverId === d.driverId}
            onPress={() => handleSelectDriver(d)}
            accentColor={accentColor}
          />
        ))}
        {/* NOTE: No <RadarPulse> here — radar is driven imperatively via useRadarPulse */}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop, backgroundColor: theme.card + 'CC', borderColor: theme.border }]}
        onPress={() => {
          if (isPickingLocation) { setPlacingPin(null); setLiveAddress(''); setMapCenter(null); }
          else if (step === 4)   { cancelPendingRide(); }
          else if (step > 1)     { setStep(1); setScanning(false); setScanDone(false); setVisibleDrivers([]); Animated.timing(sheetH, { toValue: height * 0.55, duration: 200, useNativeDriver: false }).start(); }
          else                   { navigation.goBack(); }
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

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
          <View style={[s.confirmBar, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: sheetPadBottom }]}>
            <View style={s.confirmBarInner}>
              <View style={[s.confirmBarDot, { backgroundColor: pinColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.confirmBarLabel, { color: theme.hint }]}>{placingPin === 'pickup' ? 'PICKUP LOCATION' : 'DROP-OFF LOCATION'}</Text>
                <Text style={[s.confirmBarAddr, { color: theme.foreground }]} numberOfLines={2}>{resolvingAddr ? 'Locating…' : (liveAddress || 'Move the map to select')}</Text>
              </View>
              {resolvingAddr && <ActivityIndicator color={pinColor} size="small" style={{ marginLeft: 8 }} />}
            </View>
            <TouchableOpacity style={[s.confirmBarBtn, { backgroundColor: pinColor, opacity: resolvingAddr ? 0.6 : 1 }]} onPress={confirmPin} disabled={resolvingAddr || !liveAddress} activeOpacity={0.88}>
              <Ionicons name="checkmark" size={18} color={pinFg} />
              <Text style={[s.confirmBarBtnTxt, { color: pinFg }]}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {!isPickingLocation && (
        <Animated.View style={[s.sheet, { backgroundColor: theme.background, borderColor: theme.border, top: step === 1 ? sheetTop : undefined, bottom: step !== 1 ? 0 : undefined, ...sheetStyle }]}>

          {step === 1 && (
            <>
              <StepDots current={1} accentColor={accentColor} theme={theme} />
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
                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: (pickupCoords && dropoffCoords) ? accentColor : theme.border }]}
                    onPress={proceedToMap} activeOpacity={0.88}
                  >
                    <Ionicons name="radio-outline" size={18} color={(pickupCoords && dropoffCoords) ? accentFg : theme.muted} />
                    <Text style={[s.primaryBtnTxt, { color: (pickupCoords && dropoffCoords) ? accentFg : theme.muted }]}>Find Available Riders</Text>
                  </TouchableOpacity>
                </ScrollView>
              </KeyboardAvoidingView>
            </>
          )}

          {step === 2 && (
            <>
              <ScanningBar theme={theme} accentColor={accentColor} count={drivers.length} done={scanDone} label="driver" />
              {scanDone && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: sheetPadBottom, paddingTop: 8 }}>
                  <View style={[s.fareBadge, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 14 }]}>
                    <View style={s.fareItem}><Ionicons name="navigate-outline" size={14} color={theme.hint} /><Text style={[s.fareVal, { color: theme.foreground }]}>{distanceKm?.toFixed(1)} km</Text></View>
                    <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
                    <View style={s.fareItem}><Ionicons name="time-outline" size={14} color={theme.hint} /><Text style={[s.fareVal, { color: theme.foreground }]}>~{etaMinutes} min</Text></View>
                    <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
                    <View style={s.fareItem}><Ionicons name="cash-outline" size={14} color={theme.hint} /><Text style={[s.fareVal, { color: accentColor }]}>from ₦{Number(Math.min(...drivers.map(d => d.effectiveFare ?? fareEstimate))).toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text></View>
                  </View>
                  <Text style={[s.sheetSub, { color: theme.hint, marginBottom: 12 }]}>Tap a pin on the map or select a driver below.</Text>
                  {drivers.length === 0 ? (
                    <View style={s.noDrivers}>
                      <Ionicons name="car-outline" size={36} color={theme.hint} />
                      <Text style={[s.noDriversTxt, { color: theme.hint }]}>No drivers available right now</Text>
                      <TouchableOpacity onPress={proceedToMap} style={[s.retryBtn, { borderColor: accentColor + '50' }]}>
                        <Text style={[s.retryTxt, { color: accentColor }]}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    [...drivers].sort((a, b) => (a.effectiveFare ?? 0) - (b.effectiveFare ?? 0)).map((item) => (
                      <DriverCard key={item.driverId} driver={item} selected={selectedDriver?.driverId === item.driverId} onSelect={handleSelectDriver} accentColor={accentColor} theme={theme} />
                    ))
                  )}
                  {selectedDriver && (
                    <TouchableOpacity style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]} onPress={() => setStep(3)} activeOpacity={0.88}>
                      <Text style={[s.primaryBtnTxt, { color: accentFg }]}>Continue with {selectedDriver.firstName}</Text>
                      <Ionicons name="arrow-forward" size={16} color={accentFg} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </>
          )}

          {step === 3 && selectedDriver && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: sheetPadBottom }}>
             <StepDots current={3} accentColor={accentColor} theme={theme} />
              <Text style={[s.sheetTitle, { color: theme.foreground }]}>Confirm Ride</Text>
              <View style={[s.confirmRoute, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.confirmRow}><View style={[s.cDot, { backgroundColor: accentColor }]} /><Text style={[s.confirmAddr, { color: theme.foreground }]} numberOfLines={2}>{pickupAddress}</Text></View>
                <View style={[s.confirmRouteLine, { backgroundColor: theme.border }]} />
                <View style={s.confirmRow}><View style={[s.cDot, { backgroundColor: '#E05555' }]} /><Text style={[s.confirmAddr, { color: theme.foreground }]} numberOfLines={2}>{dropoffAddress}</Text></View>
              </View>
              <View style={[s.confirmCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.confirmDriver}>
                  {selectedDriver.profileImage ? (
                    <Image source={{ uri: selectedDriver.profileImage }} style={s.confirmAvatar} />
                  ) : (
                    <View style={[s.confirmAvatarFallback, { backgroundColor: accentColor + '22' }]}>
                      <Text style={[s.confirmInitials, { color: accentColor }]}>{selectedDriver.firstName?.[0]}{selectedDriver.lastName?.[0]}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.confirmName, { color: theme.foreground }]}>{selectedDriver.firstName} {selectedDriver.lastName}</Text>
                    <Text style={[s.confirmVehicle, { color: theme.hint }]}>{selectedDriver.vehicleColor} {selectedDriver.vehicleMake} • {selectedDriver.vehiclePlate}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="star" size={12} color="#C9A96E" />
                      <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedDriver.rating?.toFixed(1) ?? '–'}</Text>
                      <Text style={[s.confirmMeta, { color: theme.border }]}>•</Text>
                      <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedDriver.totalRides} trips</Text>
                    </View>
                  </View>
                  <View style={s.confirmFareBox}>
                    <Text style={[s.confirmFareLabel, { color: theme.hint }]}>FARE</Text>
                    <Text style={[s.confirmFare, { color: fareColor(selectedDriver.effectiveFare ?? fareEstimate) }]}>
                      ₦{Number(selectedDriver.effectiveFare ?? fareEstimate).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              </View>
              <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} walletBalance={walletBalance} loadingWallet={loadingWallet} fare={selectedDriver?.effectiveFare ?? fareEstimate ?? 0} theme={theme} accentColor={accentColor} />
              <View style={[s.etaStrip, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}>
                <Ionicons name="time-outline" size={14} color={accentColor} />
                <Text style={[s.etaTxt, { color: accentColor }]}>Driver arrives in approx. {selectedDriver.etaMinutes ?? etaMinutes} minutes</Text>
              </View>
              <TouchableOpacity style={[s.primaryBtn, { backgroundColor: requesting ? accentColor + '80' : accentColor }]} onPress={confirmRide} disabled={requesting} activeOpacity={0.88}>
                {requesting ? <ActivityIndicator color={accentFg} /> : (
                  <><Ionicons name="checkmark-circle-outline" size={18} color={accentFg} /><Text style={[s.primaryBtnTxt, { color: accentFg }]}>{confirmBtnLabel}</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.secondaryBtn, { borderColor: theme.border }]} onPress={() => setStep(2)} activeOpacity={0.8}>
                <Text style={[s.secondaryBtnTxt, { color: theme.hint }]}>Change Driver</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === 4 && (
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 22 }}>
              <WaitingSheet accentColor={accentColor} theme={theme} driverName={selectedDriver?.firstName ?? 'the driver'} onCancel={cancelPendingRide} rideAccepted={rideAccepted} />
            </ScrollView>
          )}
        </Animated.View>
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
  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 22, paddingTop: 12 },
  sheetTitle:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:    { fontSize: 12, fontWeight: '500', marginBottom: 18 },
  locationRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginBottom: 20, paddingHorizontal: 24 },
  routeDots:   { alignItems: 'center', paddingTop: 18, paddingBottom: 18 },
  routeDot:    { width: 10, height: 10, borderRadius: 5 },
  routeLine:   { width: 1.5, flex: 1, marginVertical: 4 },
  locBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12 },
  locBtnLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  locBtnAddr:  { fontSize: 13, fontWeight: '500' },
  locBtnIcon:          { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  locBtnIconSecondary: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10, paddingHorizontal: 24 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4, marginHorizontal: 24 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800' },
  secondaryBtn:    { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8, marginHorizontal: 24 },
  secondaryBtnTxt: { fontSize: 14, fontWeight: '600' },
  fareBadge:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fareItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  fareVal:     { fontSize: 12, fontWeight: '700' },
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
  confirmCard:           { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  confirmDriver:         { flexDirection: 'row', alignItems: 'center' },
  confirmAvatar:         { width: 52, height: 52, borderRadius: 26 },
  confirmAvatarFallback: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  confirmInitials: { fontSize: 16, fontWeight: '800' },
  confirmName:     { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  confirmVehicle:  { fontSize: 11, marginBottom: 2 },
  confirmMeta:     { fontSize: 11 },
  confirmFareBox:   { alignItems: 'flex-end' },
  confirmFareLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  confirmFare:      { fontSize: 20, fontWeight: '900' },
  etaStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  etaTxt:   { fontSize: 12, fontWeight: '600', flex: 1 },
});