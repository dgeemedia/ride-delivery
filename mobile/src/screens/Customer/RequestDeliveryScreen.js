// mobile/src/screens/Customer/RequestDeliveryScreen.js
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
import { useTheme }    from '../../context/ThemeContext';
import { deliveryAPI } from '../../services/api';
import socketService   from '../../services/socket';

const { width, height } = Dimensions.get('window');

const LAGOS_DEFAULT = {
  latitude: 6.5244, longitude: 3.3792,
  latitudeDelta: 0.012, longitudeDelta: 0.012,
};

const calcFee = (distanceKm, weightKg = 0) => {
  const base = 600, perKm = 100, perKg = 50;
  return Math.max(400, base + distanceKm * perKm + weightKg * perKg);
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

const DARK_MAP_STYLE = [
  { elementType: 'geometry',                       stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke',             stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',               stylers: [{ color: '#746855' }] },
  { featureType: 'road',       elementType: 'geometry',           stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road',       elementType: 'geometry.stroke',    stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway', elementType: 'geometry',         stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#C9A96E' }] },
  { featureType: 'water',      elementType: 'geometry',           stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',        elementType: 'labels',             stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',    elementType: 'labels',             stylers: [{ visibility: 'off' }] },
];

const VEHICLE_ICONS = {
  BIKE: 'bicycle-outline', MOTORCYCLE: 'bicycle-outline',
  CAR:  'car-outline',     VAN: 'bus-outline',
};

// ── Mock fallback ──────────────────────────────────────────────────────────────
const PARTNER_NAMES = [
  { firstName: 'Kunle',  lastName: 'Balogun' },
  { firstName: 'Ifeanyi',lastName: 'Eze'     },
  { firstName: 'Musa',   lastName: 'Ibrahim' },
  { firstName: 'Taiwo',  lastName: 'Akinola' },
  { firstName: 'Chukwu', lastName: 'Okafor'  },
];
const VEHICLE_TYPES = ['BIKE', 'MOTORCYCLE', 'VAN', 'BIKE', 'CAR'];
const PLATES        = ['LND-221-KJ', 'EKY-440-TZ', 'KTU-110-MA', 'OGS-775-BD', 'RBS-003-VQ'];

function generateMockPartners(center) {
  return PARTNER_NAMES.map((n, i) => {
    const spread = 0.004 + Math.random() * 0.012;
    const angle  = (i / PARTNER_NAMES.length) * 2 * Math.PI;
    const dist   = haversineKm(
      center.lat, center.lng,
      center.lat + Math.sin(angle) * spread,
      center.lng + Math.cos(angle) * spread
    );
    return {
      partnerId:       `mock-partner-${i}`,
      firstName:       n.firstName,
      lastName:        n.lastName,
      profileImage:    null,
      vehicleType:     VEHICLE_TYPES[i],
      vehiclePlate:    PLATES[i],
      rating:          3.7 + Math.random() * 1.3,
      totalDeliveries: 30 + Math.floor(Math.random() * 150),
      distanceKm:      parseFloat(dist.toFixed(2)),
      etaMinutes:      Math.max(2, Math.ceil(dist / 0.4)),
      currentLat:      center.lat + Math.sin(angle) * spread,
      currentLng:      center.lng + Math.cos(angle) * spread,
    };
  });
}

// ── PartnerPin ─────────────────────────────────────────────────────────────────
const PartnerPin = ({ partner, selected, onPress, accentColor }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scaleA, { toValue: selected ? 1.3 : 1, tension: 160, friction: 7, useNativeDriver: true }).start();
  }, [selected]);
  return (
    <Marker
      coordinate={{ latitude: partner.currentLat, longitude: partner.currentLng }}
      onPress={onPress}
      tracksViewChanges={false}
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
  wrap:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#3A3A3A', justifyContent: 'center', alignItems: 'center' },
  inner: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  pulse: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, opacity: 0.4 },
});

// ── PartnerCard ────────────────────────────────────────────────────────────────
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
      <Text style={[pc.name, { color: theme.foreground }]} numberOfLines={1}>
        {partner.firstName} {partner.lastName}
      </Text>
      <Text style={[pc.vehicle, { color: theme.hint }]} numberOfLines={1}>
        {partner.vehicleType?.charAt(0) + partner.vehicleType?.slice(1).toLowerCase()} · {partner.vehiclePlate ?? '—'}
      </Text>
      <View style={pc.meta}>
        <Ionicons name="star" size={11} color="#C9A96E" />
        <Text style={[pc.metaTxt, { color: theme.hint }]}> {partner.rating?.toFixed(1) ?? '–'}</Text>
        <Text style={[pc.dot, { color: theme.border }]}>  ·  </Text>
        <Ionicons name="time-outline" size={11} color={theme.hint} />
        <Text style={[pc.metaTxt, { color: theme.hint }]}> {partner.etaMinutes} min</Text>
        <Text style={[pc.dot, { color: theme.border }]}>  ·  </Text>
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

// ── PackageInput ───────────────────────────────────────────────────────────────
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
        returnKeyType="done"
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

// ── StepDots ───────────────────────────────────────────────────────────────────
const StepDots = ({ step, accentColor, theme }) => (
  <View style={sd.wrap}>
    {[1, 2, 3].map(s => (
      <View key={s} style={[sd.dot,
        s === step  ? { backgroundColor: accentColor, width: 22 } :
        s < step    ? { backgroundColor: accentColor + '50' }     :
                      { backgroundColor: theme.border }
      ]} />
    ))}
  </View>
);
const sd = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  dot:  { height: 6, width: 6, borderRadius: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestDeliveryScreen({ navigation }) {
  const { theme }   = useTheme();
  const insets      = useSafeAreaInsets();
  const accentColor = theme.accent;
  const accentFg    = theme.accentFg ?? '#111111';

  // ── Location state ─────────────────────────────────────────────────────────
  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);

  // 'pickup' | 'dropoff' | null — which pin is being placed right now
  const [placingPin,     setPlacingPin]     = useState(null);
  // address being resolved while map is moving
  const [resolvingAddr,  setResolvingAddr]  = useState(false);
  // live address text shown in the "drag to confirm" bar
  const [liveAddress,    setLiveAddress]    = useState('');
  // current map center while user is dragging
  const [mapCenter,      setMapCenter]      = useState(null);

  // ── Package ────────────────────────────────────────────────────────────────
  const [pickupContact,      setPickupContact]      = useState('');
  const [dropoffContact,     setDropoffContact]      = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [packageWeight,      setPackageWeight]      = useState('');
  const [packageNotes,       setPackageNotes]       = useState('');

  // ── Map & partners ─────────────────────────────────────────────────────────
  const mapRef             = useRef(null);
  const geocodeTimer       = useRef(null);
  const [partners,         setPartners]         = useState([]);
  const [selectedPartner,  setSelectedPartner]  = useState(null);
  const [loadingPartners,  setLoadingPartners]  = useState(false);

  // ── Fee ────────────────────────────────────────────────────────────────────
  const [distanceKm,  setDistanceKm]  = useState(null);
  const [feeEstimate, setFeeEstimate] = useState(null);
  const [etaMinutes,  setEtaMinutes]  = useState(null);

  // ── Flow ───────────────────────────────────────────────────────────────────
  const [step,       setStep]       = useState(1);
  const [requesting, setRequesting] = useState(false);
  const [mapReady,   setMapReady]   = useState(false);
  const fadeA = useRef(new Animated.Value(1)).current;

  // Pin bounce animation
  const pinBounce = useRef(new Animated.Value(0)).current;

  // ── GPS on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Fall back to Lagos centre — user can drag to correct
        setPickupCoords({ lat: LAGOS_DEFAULT.latitude, lng: LAGOS_DEFAULT.longitude });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setPickupCoords(coords);
      reverseGeocode(coords.lat, coords.lng, setPickupAddress);
    })();
    socketService.connect?.();
  }, []);

  // ── Animate map to pickup once we have coords ──────────────────────────────
  useEffect(() => {
    if (pickupCoords && mapReady && step === 1 && !placingPin) {
      mapRef.current?.animateToRegion({
        latitude:      pickupCoords.lat,
        longitude:     pickupCoords.lng,
        latitudeDelta: 0.012,
        longitudeDelta:0.012,
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
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 3);
        setter(parts.length > 0 ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setter(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, []);

  // ── Map drag: called while map is scrolling ────────────────────────────────
  const onRegionChange = useCallback((region) => {
    if (!placingPin) return;
    setMapCenter({ lat: region.latitude, lng: region.longitude });
    setResolvingAddr(true);
    setLiveAddress('Locating…');

    // Bounce pin up while dragging
    Animated.spring(pinBounce, { toValue: -14, tension: 200, friction: 8, useNativeDriver: true }).start();

    // Debounce reverse geocode while dragging
    clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
        const place   = results?.[0];
        if (place) {
          const parts = [place.name, place.street, place.district, place.city]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 3);
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

  // ── Map drag end: pin drops ────────────────────────────────────────────────
  const onRegionChangeComplete = useCallback((region) => {
    if (!placingPin) return;

    // Drop the pin back down
    Animated.spring(pinBounce, { toValue: 0, tension: 160, friction: 7, useNativeDriver: true }).start();

    const coords = { lat: region.latitude, lng: region.longitude };
    setMapCenter(coords);

    // Final geocode
    clearTimeout(geocodeTimer.current);
    setResolvingAddr(true);
    reverseGeocode(region.latitude, region.longitude, (addr) => {
      setLiveAddress(addr);
      setResolvingAddr(false);
    });
  }, [placingPin, reverseGeocode]);

  // ── Confirm the pin placement ──────────────────────────────────────────────
  const confirmPin = () => {
    if (!mapCenter) return;
    if (placingPin === 'pickup') {
      setPickupCoords(mapCenter);
      setPickupAddress(liveAddress);
    } else if (placingPin === 'dropoff') {
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
    const center  = current ?? pickupCoords ?? { lat: LAGOS_DEFAULT.latitude, lng: LAGOS_DEFAULT.longitude };
    setLiveAddress(type === 'pickup' ? pickupAddress : dropoffAddress);
    setMapCenter(center);

    mapRef.current?.animateToRegion({
      latitude:      center.lat,
      longitude:     center.lng,
      latitudeDelta: 0.008,
      longitudeDelta:0.008,
    }, 500);
  };

  // ── Proceed to partner selection ───────────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) {
      Alert.alert('Set both locations', 'Please set both pickup and drop-off locations on the map.'); return;
    }
    if (!pickupContact || !dropoffContact) {
      Alert.alert('Missing contacts', 'Please enter phone numbers for both pickup and drop-off contacts.'); return;
    }
    if (!packageDescription) {
      Alert.alert('Missing package info', 'Please describe what you are sending.'); return;
    }

    const km  = haversineKm(pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);
    const wKg = parseFloat(packageWeight) || 0;
    setDistanceKm(km);
    setFeeEstimate(calcFee(km, wKg));
    setEtaMinutes(Math.ceil(km / 0.4));

    setLoadingPartners(true);
    try {
      const res  = await deliveryAPI.getNearbyPartners({
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        radiusKm:  15,
      });
      const list = res?.data?.partners ?? res?.partners ?? [];
      setPartners(list.length > 0 ? list : generateMockPartners(pickupCoords));
    } catch {
      setPartners(generateMockPartners(pickupCoords));
    } finally {
      setLoadingPartners(false);
    }

    Animated.timing(fadeA, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(2);
      Animated.timing(fadeA, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    // Fit both markers in view
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: pickupCoords.lat,  longitude: pickupCoords.lng  },
          { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
        ],
        { edgePadding: { top: 120, right: 60, bottom: 420, left: 60 }, animated: true }
      );
    }, 500);
  }, [pickupCoords, dropoffCoords, pickupContact, dropoffContact, packageDescription, packageWeight]);

  // ── Confirm & submit ───────────────────────────────────────────────────────
  const confirmDelivery = async () => {
    if (!selectedPartner) {
      Alert.alert('Select a partner', 'Please choose a delivery partner.'); return;
    }
    setRequesting(true);
    try {
      await deliveryAPI.requestDelivery({
        pickupAddress,
        pickupLat:          pickupCoords.lat,
        pickupLng:          pickupCoords.lng,
        pickupContact,
        dropoffAddress,
        dropoffLat:         dropoffCoords.lat,
        dropoffLng:         dropoffCoords.lng,
        dropoffContact,
        packageDescription,
        packageWeight:      parseFloat(packageWeight) || 0,
        notes:              packageNotes,
        estimatedFee:       feeEstimate,
        partnerId:          selectedPartner.partnerId,
      });
      navigation.replace ? navigation.replace('DeliveryTracking') : navigation.goBack();
    } catch (err) {
      Alert.alert('Request failed', err?.response?.data?.message ?? 'Could not place delivery. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const handleSelectPartner = (partner) => {
    setSelectedPartner(partner);
    mapRef.current?.animateToRegion({
      latitude: partner.currentLat, longitude: partner.currentLng,
      latitudeDelta: 0.015, longitudeDelta: 0.015,
    }, 600);
  };

  const mapRegion = pickupCoords
    ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }
    : LAGOS_DEFAULT;

  const isPickingLocation = placingPin !== null;
  const sheetPadBottom    = insets.bottom + 12;
  const backBtnTop        = insets.top + 14;

  // ── PIN colour based on which type is being placed ─────────────────────────
  const pinColor = placingPin === 'dropoff' ? '#E05555' : accentColor;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── MAP — always full screen ── */}
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
        // Only listen to region changes while placing a pin
        onRegionChange={isPickingLocation ? onRegionChange : undefined}
        onRegionChangeComplete={isPickingLocation ? onRegionChangeComplete : undefined}
        // Disable scrolling when NOT in pin-placing mode (sheet controls UX)
        scrollEnabled={isPickingLocation || step >= 2}
        zoomEnabled={isPickingLocation || step >= 2}
      >
        {/* Confirmed pickup marker */}
        {pickupCoords && !isPickingLocation && (
          <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="radio-button-on" size={26} color={accentColor} />
          </Marker>
        )}
        {/* Confirmed dropoff marker */}
        {dropoffCoords && !isPickingLocation && (
          <Marker coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="location" size={30} color="#E05555" />
          </Marker>
        )}
        {/* Route line once both are set */}
        {pickupCoords && dropoffCoords && !isPickingLocation && (
          <Polyline
            coordinates={[
              { latitude: pickupCoords.lat,  longitude: pickupCoords.lng  },
              { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
            ]}
            strokeColor={accentColor} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {/* Delivery partner pins — step 2 */}
        {step >= 2 && partners.map((p) => (
          <PartnerPin key={p.partnerId} partner={p}
            selected={selectedPartner?.partnerId === p.partnerId}
            onPress={() => handleSelectPartner(p)}
            accentColor={accentColor}
          />
        ))}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      {/* ── Back / cancel button ── */}
      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop, backgroundColor: '#111111CC', borderColor: '#2A2A2A' }]}
        onPress={() => {
          if (isPickingLocation) { setPlacingPin(null); setLiveAddress(''); setMapCenter(null); }
          else if (step > 1) { setStep(s => s - 1); }
          else { navigation.goBack(); }
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ══════════════════════════════════════════════════════════════════════
          PIN-PLACING MODE — crosshair + confirm bar
      ══════════════════════════════════════════════════════════════════════ */}
      {isPickingLocation && (
        <>
          {/* Fixed centre crosshair pin */}
          <View style={s.crosshairWrap} pointerEvents="none">
            {/* Shadow dot on the map surface */}
            <View style={[s.pinShadow, { backgroundColor: pinColor + '40' }]} />
            {/* Animated pin that lifts while dragging */}
            <Animated.View style={[s.pinAnimWrap, { transform: [{ translateY: pinBounce }] }]}>
              <View style={[s.pinCircle, { backgroundColor: pinColor, shadowColor: pinColor }]}>
                <Ionicons
                  name={placingPin === 'dropoff' ? 'location' : 'radio-button-on'}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              {/* Triangle pointer */}
              <View style={[s.pinPoint, { borderTopColor: pinColor }]} />
            </Animated.View>
          </View>

          {/* Top label bar — shows which location is being set */}
          <View style={[s.pinLabelBar, { top: backBtnTop, backgroundColor: '#111111EE' }]}>
            <View style={[s.pinLabelDot, { backgroundColor: pinColor }]} />
            <Text style={s.pinLabelTxt}>
              {placingPin === 'pickup' ? 'Move map to set pickup' : 'Move map to set drop-off'}
            </Text>
          </View>

          {/* Bottom confirm bar — shows live address */}
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
          NORMAL BOTTOM SHEET — step 1 / 2 / 3
      ══════════════════════════════════════════════════════════════════════ */}
      {!isPickingLocation && (
        <Animated.View style={[s.sheet, {
          backgroundColor: '#111111',
          borderColor:     '#2A2A2A',
          opacity:         fadeA,
          paddingBottom:   sheetPadBottom,
        }]}>

          <StepDots step={step} accentColor={accentColor} theme={theme} />

          {/* ── STEP 1 — location + package ── */}
          {step === 1 && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.sheetTitle}>Send a Package</Text>
                <Text style={[s.sheetSub, { color: '#6A6A6A' }]}>Tap a location pin to set it on the map</Text>

                {/* ── Location pickers ── */}
                <View style={s.locationRow}>

                  {/* Route dots */}
                  <View style={s.routeDots}>
                    <View style={[s.routeDot, { backgroundColor: accentColor }]} />
                    <View style={[s.routeLine, { backgroundColor: '#2A2A2A' }]} />
                    <View style={[s.routeDot, { backgroundColor: '#E05555' }]} />
                  </View>

                  <View style={{ flex: 1 }}>
                    {/* Pickup */}
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

                    {/* Dropoff */}
                    <TouchableOpacity
                      style={[s.locBtn, { backgroundColor: '#1A1A1A', borderColor: '#E05555' + '50' }]}
                      onPress={() => startPickingLocation('dropoff')}
                      activeOpacity={0.85}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.locBtnLabel, { color: '#E05555' }]}>DROP-OFF</Text>
                        <Text style={[s.locBtnAddr, { color: dropoffCoords ? '#F2EEE6' : '#6A6A6A' }]} numberOfLines={1}>
                          {dropoffAddress || 'Tap to set drop-off on map'}
                        </Text>
                      </View>
                      <View style={[s.locBtnIcon, { backgroundColor: '#E05555' + '18' }]}>
                        <Ionicons name="map-outline" size={14} color="#E05555" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Contact & package details ── */}
                <Text style={[s.sectionLabel, { color: '#6A6A6A' }]}>CONTACT & PACKAGE</Text>
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
                  style={[s.primaryBtn, {
                    backgroundColor: (pickupCoords && dropoffCoords) ? accentColor : '#2A2A2A',
                  }]}
                  onPress={proceedToMap}
                  activeOpacity={0.88}
                >
                  <Ionicons name="bicycle-outline" size={18} color={(pickupCoords && dropoffCoords) ? accentFg : '#6A6A6A'} />
                  <Text style={[s.primaryBtnTxt, { color: (pickupCoords && dropoffCoords) ? accentFg : '#6A6A6A' }]}>
                    Find Delivery Partners
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* ── STEP 2 — choose partner ── */}
          {step === 2 && (
            <View style={{ flex: 1 }}>
              {/* Fee summary */}
              <View style={[s.feeBadge, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
                <View style={s.feeItem}>
                  <Ionicons name="navigate-outline" size={13} color="#6A6A6A" />
                  <Text style={[s.feeVal, { color: '#F2EEE6' }]}>{distanceKm?.toFixed(1)} km</Text>
                </View>
                <View style={[s.feeDivider, { backgroundColor: '#2A2A2A' }]} />
                <View style={s.feeItem}>
                  <Ionicons name="time-outline" size={13} color="#6A6A6A" />
                  <Text style={[s.feeVal, { color: '#F2EEE6' }]}>~{etaMinutes} min</Text>
                </View>
                <View style={[s.feeDivider, { backgroundColor: '#2A2A2A' }]} />
                <View style={s.feeItem}>
                  <Ionicons name="cash-outline" size={13} color="#6A6A6A" />
                  <Text style={[s.feeVal, { color: accentColor }]}>
                    ₦{feeEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>

              <Text style={s.sheetTitle}>
                {loadingPartners ? 'Finding partners…' : `${partners.length} partner${partners.length !== 1 ? 's' : ''} nearby`}
              </Text>
              <Text style={[s.sheetSub, { color: '#6A6A6A' }]}>Choose who handles your package</Text>

              {loadingPartners ? (
                <ActivityIndicator color={accentColor} style={{ marginTop: 24 }} />
              ) : partners.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="bicycle-outline" size={36} color="#6A6A6A" />
                  <Text style={[s.emptyTxt, { color: '#6A6A6A' }]}>No partners available right now</Text>
                  <TouchableOpacity onPress={proceedToMap} style={[s.retryBtn, { borderColor: accentColor + '50' }]}>
                    <Text style={[s.retryTxt, { color: accentColor }]}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={partners}
                  keyExtractor={(p) => p.partnerId}
                  renderItem={({ item }) => (
                    <PartnerCard partner={item}
                      selected={selectedPartner?.partnerId === item.partnerId}
                      onSelect={handleSelectPartner}
                      accentColor={accentColor}
                      theme={theme}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 240 }}
                  nestedScrollEnabled
                />
              )}

              {selectedPartner && (
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]}
                  onPress={() => setStep(3)} activeOpacity={0.88}
                >
                  <Text style={[s.primaryBtnTxt, { color: accentFg }]}>Continue with {selectedPartner.firstName}</Text>
                  <Ionicons name="arrow-forward" size={16} color={accentFg} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 3 — confirm ── */}
          {step === 3 && selectedPartner && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.sheetTitle}>Confirm Delivery</Text>

              {/* Route summary */}
              <View style={[s.confirmRoute, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
                <View style={s.confirmRow}>
                  <View style={[s.cDot, { backgroundColor: accentColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.confirmAddr, { color: '#F2EEE6' }]} numberOfLines={2}>{pickupAddress}</Text>
                    <Text style={[s.confirmContact, { color: '#6A6A6A' }]}>{pickupContact}</Text>
                  </View>
                </View>
                <View style={[s.confirmRouteLine, { backgroundColor: '#2A2A2A' }]} />
                <View style={s.confirmRow}>
                  <View style={[s.cDot, { backgroundColor: '#E05555' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.confirmAddr, { color: '#F2EEE6' }]} numberOfLines={2}>{dropoffAddress}</Text>
                    <Text style={[s.confirmContact, { color: '#6A6A6A' }]}>{dropoffContact}</Text>
                  </View>
                </View>
              </View>

              {/* Package summary */}
              <View style={[s.packageSummary, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
                <View style={s.pkgRow}>
                  <Ionicons name="cube-outline" size={14} color="#6A6A6A" />
                  <Text style={[s.pkgTxt, { color: '#F2EEE6' }]}>{packageDescription}</Text>
                </View>
                {packageWeight ? (
                  <View style={s.pkgRow}>
                    <Ionicons name="scale-outline" size={14} color="#6A6A6A" />
                    <Text style={[s.pkgTxt, { color: '#F2EEE6' }]}>{packageWeight} kg</Text>
                  </View>
                ) : null}
                {packageNotes ? (
                  <View style={s.pkgRow}>
                    <Ionicons name="document-text-outline" size={14} color="#6A6A6A" />
                    <Text style={[s.pkgTxt, { color: '#6A6A6A' }]} numberOfLines={2}>{packageNotes}</Text>
                  </View>
                ) : null}
              </View>

              {/* Partner + fee */}
              <View style={[s.confirmCard, { backgroundColor: '#1A1A1A', borderColor: '#2A2A2A' }]}>
                <View style={s.confirmDriver}>
                  <View style={[s.confirmAvatarFallback, { backgroundColor: accentColor + '22' }]}>
                    <Ionicons name={VEHICLE_ICONS[selectedPartner.vehicleType] ?? 'bicycle-outline'} size={20} color={accentColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.confirmName, { color: '#F2EEE6' }]}>
                      {selectedPartner.firstName} {selectedPartner.lastName}
                    </Text>
                    <Text style={[s.confirmVehicle, { color: '#6A6A6A' }]}>
                      {selectedPartner.vehicleType} · {selectedPartner.vehiclePlate ?? '—'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="star" size={12} color="#C9A96E" />
                      <Text style={[s.confirmMeta, { color: '#6A6A6A' }]}>{selectedPartner.rating?.toFixed(1) ?? '–'}</Text>
                      <Text style={[s.confirmMeta, { color: '#2A2A2A' }]}>·</Text>
                      <Text style={[s.confirmMeta, { color: '#6A6A6A' }]}>{selectedPartner.totalDeliveries} deliveries</Text>
                    </View>
                  </View>
                  <View style={s.confirmFareBox}>
                    <Text style={[s.confirmFareLabel, { color: '#6A6A6A' }]}>FEE</Text>
                    <Text style={[s.confirmFare, { color: accentColor }]}>
                      ₦{feeEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={[s.confirmFareLabel, { color: '#6A6A6A' }]}>CASH</Text>
                  </View>
                </View>
              </View>

              <View style={[s.etaStrip, { backgroundColor: accentColor + '12', borderColor: accentColor + '30' }]}>
                <Ionicons name="time-outline" size={14} color={accentColor} />
                <Text style={[s.etaTxt, { color: accentColor }]}>
                  Partner arrives in approx. {selectedPartner.etaMinutes ?? etaMinutes} minutes
                </Text>
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: requesting ? accentColor + '80' : accentColor }]}
                onPress={confirmDelivery}
                disabled={requesting}
                activeOpacity={0.88}
              >
                {requesting ? (
                  <ActivityIndicator color={accentFg} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color={accentFg} />
                    <Text style={[s.primaryBtnTxt, { color: accentFg }]}>Confirm Delivery</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.secondaryBtn, { borderColor: '#2A2A2A' }]}
                onPress={() => setStep(2)} activeOpacity={0.8}
              >
                <Text style={[s.secondaryBtnTxt, { color: '#6A6A6A' }]}>Change Partner</Text>
              </TouchableOpacity>
            </ScrollView>
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
    position: 'absolute',
    top: '50%', left: '50%',
    // shift so the pin tip sits exactly at centre
    marginTop: -56, marginLeft: -20,
    alignItems: 'center',
    zIndex: 50,
  },
  pinShadow: {
    width: 16, height: 8, borderRadius: 8,
    marginTop: 4,
  },
  pinAnimWrap: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
  },
  pinCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  pinPoint: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },

  // ── Pin label bar (top) ────────────────────────────────────────────────────
  pinLabelBar: {
    position: 'absolute', left: 70, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    zIndex: 99,
  },
  pinLabelDot: { width: 8, height: 8, borderRadius: 4 },
  pinLabelTxt: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  // ── Confirm bar (bottom) ───────────────────────────────────────────────────
  confirmBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
    zIndex: 99,
  },
  confirmBarInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  confirmBarDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmBarLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#6A6A6A', marginBottom: 4 },
  confirmBarAddr:  { fontSize: 14, fontWeight: '600', color: '#F2EEE6', lineHeight: 20 },
  confirmBarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, height: 52,
  },
  confirmBarBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1,
    paddingHorizontal: 24, paddingTop: 22,
    maxHeight: height * 0.75,
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4, color: '#F2EEE6' },
  sheetSub:   { fontSize: 12, fontWeight: '500', marginBottom: 16 },

  // ── Location row ───────────────────────────────────────────────────────────
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

  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },

  // ── Buttons ────────────────────────────────────────────────────────────────
  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt:  { fontSize: 15, fontWeight: '800' },
  secondaryBtn:   { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  secondaryBtnTxt:{ fontSize: 14, fontWeight: '600' },

  // ── Fee badge ──────────────────────────────────────────────────────────────
  feeBadge:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  feeItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  feeVal:     { fontSize: 13, fontWeight: '700' },
  feeDivider: { width: 1 },

  // ── Empty state ────────────────────────────────────────────────────────────
  empty:    { alignItems: 'center', paddingVertical: 24 },
  emptyTxt: { fontSize: 13, marginTop: 10, marginBottom: 14 },
  retryBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt: { fontSize: 13, fontWeight: '700' },

  // ── Confirm step ──────────────────────────────────────────────────────────
  confirmRoute:     { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  confirmRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cDot:             { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  confirmAddr:      { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  confirmContact:   { fontSize: 11, marginTop: 1 },
  confirmRouteLine: { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 4 },
  packageSummary:   { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 8 },
  pkgRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pkgTxt:           { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },
  confirmCard:       { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  confirmDriver:     { flexDirection: 'row', alignItems: 'center' },
  confirmAvatarFallback: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  confirmName:       { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  confirmVehicle:    { fontSize: 11, marginBottom: 2 },
  confirmMeta:       { fontSize: 11 },
  confirmFareBox:    { alignItems: 'flex-end' },
  confirmFareLabel:  { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  confirmFare:       { fontSize: 18, fontWeight: '900' },
  etaStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  etaTxt:   { fontSize: 12, fontWeight: '600', flex: 1 },
});