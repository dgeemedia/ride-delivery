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
import { useTheme }   from '../../context/ThemeContext';
import { rideAPI }    from '../../services/api';
import socketService  from '../../services/socket';

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
        <View style={[wt.iconWrap, { backgroundColor: '#5DAA72' + '18' }]}>
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

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function RequestRideScreen({ navigation }) {
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const accentColor = theme.accent;
  const accentFg    = theme.accentFg ?? '#111111';

  // ── Location state ─────────────────────────────────────────────────────────
  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);

  // 'pickup' | 'dropoff' | null
  const [placingPin,    setPlacingPin]    = useState(null);
  const [resolvingAddr, setResolvingAddr] = useState(false);
  const [liveAddress,   setLiveAddress]   = useState('');
  const [mapCenter,     setMapCenter]     = useState(null);

  // ── Drivers & ride ─────────────────────────────────────────────────────────
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

// ── GPS on mount (update here) ─────────────────────────────────────────────
useEffect(() => {
  (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const coords = { lat: 6.5244, lng: 3.3792 };
        setPickupCoords(coords);
        setPickupAddress(formatAddrWithCoords('Lagos, Nigeria', coords.lat, coords.lng));
        return;
      }
      const loc    = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setPickupCoords(coords);
      reverseGeocode(coords.lat, coords.lng, setPickupAddress);
    } catch {
      const coords = { lat: 6.5244, lng: 3.3792 };
      setPickupCoords(coords);
      setPickupAddress(formatAddrWithCoords('Lagos, Nigeria', coords.lat, coords.lng));
    }
  })();
  socketService.connect().catch(() => {});
}, []);

  // ── Animate map to pickup once GPS lands ──────────────────────────────────
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
      console.log('[RequestRide] ride:status:update', data);
      if (data.rideId === pendingRideId && data.status === 'ACCEPTED') {
        setRideAccepted(true);
        setTimeout(() => navigation.replace('RideTracking', { rideId: data.rideId }), 1800);
      }
    };
    const handleCancelled = (data) => {
      console.log('[RequestRide] ride:cancelled', data);
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

  // ── Map drag handlers ──────────────────────────────────────────────────────
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
          const parts = [place.name, place.street, place.district, place.city]
            .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
          setLiveAddress(parts.length > 0 ? parts.join(', ') : `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
        } else {
          setLiveAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
        }
      } catch {
        setLiveAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
      }
      setResolvingAddr(false);
    }, 400);
  }, [placingPin]);

  const onRegionChangeComplete = useCallback((region) => {
    if (!placingPin) return;
    Animated.spring(pinBounce, { toValue: 0, tension: 160, friction: 7, useNativeDriver: true }).start();
    const coords = { lat: region.latitude, lng: region.longitude };
    setMapCenter(coords);
    clearTimeout(geocodeTimer.current);
    setResolvingAddr(true);
    reverseGeocode(region.latitude, region.longitude, (addr) => {
      setLiveAddress(addr);
      setResolvingAddr(false);
    });
  }, [placingPin, reverseGeocode]);

  // ── Confirm pin placement ──────────────────────────────────────────────────
  const confirmPin = () => {
    if (!mapCenter) return;
    if (placingPin === 'pickup') {
      setPickupCoords(mapCenter);
      setPickupAddress(liveAddress);
    } else {
      setDropoffCoords(mapCenter);
      setDropoffAddress(liveAddress);
    }
    setPlacingPin(null);
    setLiveAddress('');
    setMapCenter(null);
  };

  // ── Start placing a pin ────────────────────────────────────────────────────
  const startPickingLocation = (type) => {
    setPlacingPin(type);
    const current = type === 'pickup' ? pickupCoords : dropoffCoords;
    const center  = current ?? pickupCoords ?? { lat: 6.5244, lng: 3.3792 };
    setLiveAddress(type === 'pickup' ? pickupAddress : dropoffAddress);
    setMapCenter(center);
    mapRef.current?.animateToRegion({
      latitude: center.lat, longitude: center.lng,
      latitudeDelta: 0.008, longitudeDelta: 0.008,
    }, 500);
  };

  // ── Set a quick destination directly ──────────────────────────────────────
  const setQuickDestination = (dest) => {
    setDropoffCoords({ lat: dest.lat, lng: dest.lng });
    setDropoffAddress(dest.label);
    // Animate map to show both points
    if (pickupCoords) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
            { latitude: dest.lat,         longitude: dest.lng         },
          ],
          { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
        );
      }, 300);
    }
  };

  // ── Find drivers ───────────────────────────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) {
      Alert.alert('Set both locations', 'Please set both pickup and drop-off locations on the map.');
      return;
    }

    const km = haversineKm(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);
    setDistanceKm(km);
    setFareEstimate(calcFare(km));
    setEtaMinutes(Math.ceil(km / 0.5));

    setLoadingDrivers(true);
    try {
      const res  = await rideAPI.getNearbyDrivers({ pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng, radiusKm: 50 });
      const list = res?.data?.drivers ?? res?.drivers ?? [];
      console.log('[RequestRide] API returned', list.length, 'drivers');
      list.forEach((d, i) =>
        console.log(`  [${i}] id=${d.driverId} name=${d.firstName} ${d.lastName} lat=${d.currentLat} lng=${d.currentLng}`)
      );
      const realDrivers = list.filter(d => !String(d.driverId).startsWith('mock-'));
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
        [
          { latitude: pickupCoords.lat,  longitude: pickupCoords.lng  },
          { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
        ],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      );
    }, 500);
  }, [pickupCoords, dropoffCoords]);

  // ── Confirm ride ───────────────────────────────────────────────────────────
  const confirmRide = async () => {
    if (!selectedDriver) { Alert.alert('Select a driver', 'Please choose a driver.'); return; }
    if (String(selectedDriver.driverId).startsWith('mock-')) {
      Alert.alert('Error', 'Invalid driver. Please retry.'); return;
    }
    console.log('[RequestRide] Booking driver:', selectedDriver.driverId, selectedDriver.firstName);
    setRequesting(true);
    try {
      const res = await rideAPI.requestSpecificDriver({
        pickupAddress,  pickupLat:  pickupCoords.lat,  pickupLng:  pickupCoords.lng,
        dropoffAddress, dropoffLat: dropoffCoords.lat, dropoffLng: dropoffCoords.lng,
        driverId:      selectedDriver.driverId,
        estimatedFare: fareEstimate,
        paymentMethod: 'CASH',
      });
      const rideId = res?.data?.ride?.id ?? res?.ride?.id;
      console.log('[RequestRide] Request sent, rideId:', rideId);
      setPendingRideId(rideId);
      if (rideId) socketService.joinRide(rideId);
      Animated.timing(fadeA, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setStep(4);
        Animated.timing(fadeA, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    } catch (err) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Could not book the ride.');
    } finally {
      setRequesting(false);
    }
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
      mapRef.current?.animateToRegion({
        latitude: driver.currentLat, longitude: driver.currentLng,
        latitudeDelta: 0.015, longitudeDelta: 0.015,
      }, 600);
    }
  };

  const isPickingLocation = placingPin !== null;
  const pinColor          = placingPin === 'dropoff' ? '#E05555' : accentColor;
  const backBtnTop        = insets.top + 14;
  const sheetPadBottom    = insets.bottom + 12;

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
        style={[s.backBtn, { top: backBtnTop, backgroundColor: '#111111CC', borderColor: '#2A2A2A' }]}
        onPress={() => {
          if (isPickingLocation) { setPlacingPin(null); setLiveAddress(''); setMapCenter(null); }
          else if (step === 4)   { cancelPendingRide(); }
          else if (step > 1)     { setStep(prev => prev - 1); }
          else                   { navigation.goBack(); }
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ══════════════════════════════════════════════════════════════════════
          PIN-PLACING MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {isPickingLocation && (
        <>
          {/* Fixed crosshair pin at screen centre */}
          <View style={s.crosshairWrap} pointerEvents="none">
            <View style={[s.pinShadow, { backgroundColor: pinColor + '40' }]} />
            <Animated.View style={[s.pinAnimWrap, { transform: [{ translateY: pinBounce }] }]}>
              <View style={[s.pinCircle, { backgroundColor: pinColor, shadowColor: pinColor }]}>
                <Ionicons name={placingPin === 'dropoff' ? 'location' : 'radio-button-on'} size={20} color="#FFFFFF" />
              </View>
              <View style={[s.pinPoint, { borderTopColor: pinColor }]} />
            </Animated.View>
          </View>

          {/* Top label */}
          <View style={[s.pinLabelBar, { top: backBtnTop, backgroundColor: '#111111EE' }]}>
            <View style={[s.pinLabelDot, { backgroundColor: pinColor }]} />
            <Text style={s.pinLabelTxt}>
              {placingPin === 'pickup' ? 'Move map to set pickup' : 'Move map to set drop-off'}
            </Text>
          </View>

          {/* Bottom confirm bar */}
          <View style={[s.confirmBar, { backgroundColor: '#111111', paddingBottom: sheetPadBottom }]}>
            <View style={s.confirmBarInner}>
              <View style={[s.confirmBarDot, { backgroundColor: pinColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.confirmBarLabel}>
                  {placingPin === 'pickup' ? 'PICKUP LOCATION' : 'DROP-OFF LOCATION'}
                </Text>
                <Text style={s.confirmBarAddr} numberOfLines={2}>
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
          backgroundColor: '#111111',
          borderColor:     '#2A2A2A',
          opacity:         fadeA,
          paddingBottom:   sheetPadBottom,
        }]}>
          <StepDots step={Math.min(step, 3)} accentColor={accentColor} theme={theme} />

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Text style={s.sheetTitle}>Where to?</Text>
              <Text style={[s.sheetSub, { color: '#6A6A6A' }]}>Tap a pin to set your location on the map</Text>

              {/* Location pickers */}
              <View style={s.locationRow}>
                <View style={s.routeDots}>
                  <View style={[s.routeDot, { backgroundColor: accentColor }]} />
                  <View style={[s.routeLine, { backgroundColor: '#2A2A2A' }]} />
                  <View style={[s.routeDot, { backgroundColor: '#E05555' }]} />
                </View>
                <View style={{ flex: 1 }}>
                  {/* Pickup button */}
                  <TouchableOpacity
                    style={[s.locBtn, { backgroundColor: '#1A1A1A', borderColor: accentColor + '50' }]}
                    onPress={() => startPickingLocation('pickup')}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.locBtnLabel, { color: accentColor }]}>PICKUP</Text>
                      <Text style={[s.locBtnAddr, { color: pickupCoords ? '#F2EEE6' : '#6A6A6A' }]} numberOfLines={1}>
                        {pickupAddress || 'Tap to set pickup on map'}
                      </Text>
                    </View>
                    <View style={[s.locBtnIcon, { backgroundColor: accentColor + '18' }]}>
                      <Ionicons name="map-outline" size={14} color={accentColor} />
                    </View>
                  </TouchableOpacity>

                  <View style={{ height: 6 }} />

                  {/* Dropoff button */}
                  <TouchableOpacity
                    style={[s.locBtn, { backgroundColor: '#1A1A1A', borderColor: '#E05555' + '50' }]}
                    onPress={() => startPickingLocation('dropoff')}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.locBtnLabel, { color: '#E05555' }]}>DROP-OFF</Text>
                      <Text style={[s.locBtnAddr, { color: dropoffCoords ? '#F2EEE6' : '#6A6A6A' }]} numberOfLines={1}>
                        {dropoffAddress || 'Tap to set destination on map'}
                      </Text>
                    </View>
                    <View style={[s.locBtnIcon, { backgroundColor: '#E05555' + '18' }]}>
                      <Ionicons name="map-outline" size={14} color="#E05555" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick destinations */}
              <Text style={[s.quickLabel, { color: '#6A6A6A' }]}>POPULAR DESTINATIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {QUICK_DESTINATIONS.map((d) => (
                  <TouchableOpacity key={d.label}
                    style={[s.quickChip, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}
                    onPress={() => setQuickDestination(d)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={d.icon} size={13} color={accentColor} />
                    <Text style={[s.quickChipTxt, { color: '#F2EEE6' }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[s.primaryBtn, {
                  backgroundColor: (pickupCoords && dropoffCoords) ? accentColor : '#2A2A2A',
                }]}
                onPress={proceedToMap}
                activeOpacity={0.88}
              >
                <Ionicons name="map-outline" size={18} color={(pickupCoords && dropoffCoords) ? accentFg : '#6A6A6A'} />
                <Text style={[s.primaryBtnTxt, { color: (pickupCoords && dropoffCoords) ? accentFg : '#6A6A6A' }]}>
                  Find Available Riders
                </Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <View style={{ flex: 1 }}>
              <View style={[s.fareBadge, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
                <View style={s.fareItem}>
                  <Ionicons name="navigate-outline" size={14} color="#6A6A6A" />
                  <Text style={[s.fareVal, { color: '#F2EEE6' }]}>{distanceKm?.toFixed(1)} km</Text>
                </View>
                <View style={[s.fareDivider, { backgroundColor: '#2A2A2A' }]} />
                <View style={s.fareItem}>
                  <Ionicons name="time-outline" size={14} color="#6A6A6A" />
                  <Text style={[s.fareVal, { color: '#F2EEE6' }]}>~{etaMinutes} min</Text>
                </View>
                <View style={[s.fareDivider, { backgroundColor: '#2A2A2A' }]} />
                <View style={s.fareItem}>
                  <Ionicons name="cash-outline" size={14} color="#6A6A6A" />
                  <Text style={[s.fareVal, { color: accentColor }]}>
                    {'\u20A6'}{fareEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>

              <Text style={[s.sheetTitle, { marginTop: 14 }]}>
                {loadingDrivers ? 'Finding drivers...' : `${drivers.length} driver${drivers.length !== 1 ? 's' : ''} nearby`}
              </Text>
              <Text style={[s.sheetSub, { color: '#6A6A6A' }]}>Tap a driver to select them</Text>

              {loadingDrivers ? (
                <ActivityIndicator color={accentColor} style={{ marginTop: 24 }} />
              ) : drivers.length === 0 ? (
                <View style={s.noDrivers}>
                  <Ionicons name="car-outline" size={36} color="#6A6A6A" />
                  <Text style={[s.noDriversTxt, { color: '#6A6A6A' }]}>No drivers available right now</Text>
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
            </View>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === 3 && selectedDriver && (
            <View>
              <Text style={s.sheetTitle}>Confirm Ride</Text>

              <View style={[s.confirmRoute, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
                <View style={s.confirmRow}>
                  <View style={[s.cDot, { backgroundColor: accentColor }]} />
                  <Text style={[s.confirmAddr, { color: '#F2EEE6' }]} numberOfLines={2}>{pickupAddress}</Text>
                </View>
                <View style={[s.confirmRouteLine, { backgroundColor: '#2A2A2A' }]} />
                <View style={s.confirmRow}>
                  <View style={[s.cDot, { backgroundColor: '#E05555' }]} />
                  <Text style={[s.confirmAddr, { color: '#F2EEE6' }]} numberOfLines={2}>{dropoffAddress}</Text>
                </View>
              </View>

              <View style={[s.confirmCard, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
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
                    <Text style={[s.confirmName, { color: '#F2EEE6' }]}>
                      {selectedDriver.firstName} {selectedDriver.lastName}
                    </Text>
                    <Text style={[s.confirmVehicle, { color: '#6A6A6A' }]}>
                      {selectedDriver.vehicleColor} {selectedDriver.vehicleMake} · {selectedDriver.vehiclePlate}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="star" size={12} color="#C9A96E" />
                      <Text style={[s.confirmMeta, { color: '#6A6A6A' }]}>{selectedDriver.rating?.toFixed(1) ?? '–'}</Text>
                      <Text style={[s.confirmMeta, { color: '#2A2A2A' }]}>·</Text>
                      <Text style={[s.confirmMeta, { color: '#6A6A6A' }]}>{selectedDriver.totalRides} trips</Text>
                    </View>
                  </View>
                  <View style={s.confirmFareBox}>
                    <Text style={[s.confirmFareLabel, { color: '#6A6A6A' }]}>FARE</Text>
                    <Text style={[s.confirmFare, { color: accentColor }]}>
                      {'\u20A6'}{fareEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={[s.confirmFareLabel, { color: '#6A6A6A' }]}>CASH</Text>
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

              <TouchableOpacity style={[s.secondaryBtn, { borderColor: '#2A2A2A' }]} onPress={() => setStep(2)} activeOpacity={0.8}>
                <Text style={[s.secondaryBtnTxt, { color: '#6A6A6A' }]}>Change Driver</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 4: Waiting ── */}
          {step === 4 && (
            <WaitingSheet
              accentColor={accentColor}
              theme={theme}
              driverName={selectedDriver?.firstName ?? 'the driver'}
              onCancel={cancelPendingRide}
              rideAccepted={rideAccepted}
            />
          )}
        </Animated.View>
      )}
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

  // ── Crosshair pin ──────────────────────────────────────────────────────────
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

  // ── Pin label bar ──────────────────────────────────────────────────────────
  pinLabelBar: {
    position: 'absolute', left: 70, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, zIndex: 99,
  },
  pinLabelDot: { width: 8, height: 8, borderRadius: 4 },
  pinLabelTxt: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  // ── Confirm bar ────────────────────────────────────────────────────────────
  confirmBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: '#2A2A2A', zIndex: 99,
  },
  confirmBarInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  confirmBarDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmBarLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#6A6A6A', marginBottom: 4 },
  confirmBarAddr:  { fontSize: 14, fontWeight: '600', color: '#F2EEE6', lineHeight: 20 },
  confirmBarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, height: 52,
  },
  confirmBarBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1,
    paddingHorizontal: 24, paddingTop: 22,
    maxHeight: height * 0.72,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4, color: '#F2EEE6' },
  sheetSub:   { fontSize: 12, fontWeight: '500', marginBottom: 18 },

  // ── Location pickers ───────────────────────────────────────────────────────
  locationRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginBottom: 20 },
  routeDots:   { alignItems: 'center', paddingTop: 18, paddingBottom: 18 },
  routeDot:    { width: 10, height: 10, borderRadius: 5 },
  routeLine:   { width: 1.5, flex: 1, marginVertical: 4 },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  locBtnLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  locBtnAddr:  { fontSize: 13, fontWeight: '500' },
  locBtnIcon:  { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },

  // ── Quick chips ────────────────────────────────────────────────────────────
  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },

  // ── Buttons ────────────────────────────────────────────────────────────────
  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt:  { fontSize: 15, fontWeight: '800' },
  secondaryBtn:   { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  secondaryBtnTxt:{ fontSize: 14, fontWeight: '600' },

  // ── Fare badge ─────────────────────────────────────────────────────────────
  fareBadge:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fareItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  fareVal:     { fontSize: 13, fontWeight: '700' },
  fareDivider: { width: 1 },

  // ── No drivers ─────────────────────────────────────────────────────────────
  noDrivers:   { alignItems: 'center', paddingVertical: 24 },
  noDriversTxt:{ fontSize: 13, marginTop: 10, marginBottom: 14 },
  retryBtn:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:    { fontSize: 13, fontWeight: '700' },

  // ── Confirm step ───────────────────────────────────────────────────────────
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