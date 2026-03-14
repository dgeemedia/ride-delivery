// mobile/src/screens/Customer/RequestDeliveryScreen.js
//
// Full delivery-booking flow (mirrors RequestRideScreen):
//   Step 1 → Pickup / drop-off + package details
//   Step 2 → Map with nearby partners + fee estimate
//   Step 3 → Confirm → deliveryAPI.requestDelivery()

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
import { useTheme } from '../../context/ThemeContext';
import { deliveryAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width, height } = Dimensions.get('window');

const LAGOS_DEFAULT = {
  latitude: 6.5244, longitude: 3.3792,
  latitudeDelta: 0.05, longitudeDelta: 0.05,
};

// ─────────────────────────────────────────────────────────────────────────────
// Delivery fee calc: BASE ₦600, ₦100/km, +₦50/kg, min ₦400
// Mirrors backend calculateDeliveryFee()
// ─────────────────────────────────────────────────────────────────────────────
const calcFee = (distanceKm, weightKg = 0) => {
  const base = 600;
  const perKm = 100;
  const perKg = 50;
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

// ─────────────────────────────────────────────────────────────────────────────
// Dark map style (same as RequestRideScreen)
// ─────────────────────────────────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry',                     stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke',           stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',             stylers: [{ color: '#746855' }] },
  { featureType: 'road',       elementType: 'geometry',        stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road',       elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway', elementType: 'geometry',      stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#C9A96E' }] },
  { featureType: 'water',      elementType: 'geometry',        stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',        elementType: 'labels',          stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',    elementType: 'labels',          stylers: [{ visibility: 'off' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle type icon map
// ─────────────────────────────────────────────────────────────────────────────
const VEHICLE_ICONS = {
  BIKE:       'bicycle-outline',
  MOTORCYCLE: 'bicycle-outline',
  CAR:        'car-outline',
  VAN:        'bus-outline',
};

// ─────────────────────────────────────────────────────────────────────────────
// PartnerPin — map marker for each nearby delivery partner
// ─────────────────────────────────────────────────────────────────────────────
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
          <Ionicons
            name={VEHICLE_ICONS[partner.vehicleType] ?? 'bicycle-outline'}
            size={13}
            color={selected ? accentColor : '#FFFFFF'}
          />
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

// ─────────────────────────────────────────────────────────────────────────────
// PartnerCard — bottom list card
// ─────────────────────────────────────────────────────────────────────────────
const PartnerCard = ({ partner, selected, onSelect, accentColor, theme }) => {
  const borderColor = selected ? accentColor : theme.border;
  const bg          = selected ? accentColor + '12' : theme.backgroundAlt;
  const vehicleIcon = VEHICLE_ICONS[partner.vehicleType] ?? 'bicycle-outline';

  return (
    <TouchableOpacity
      onPress={() => onSelect(partner)}
      activeOpacity={0.85}
      style={[pc.card, { backgroundColor: bg, borderColor }]}
    >
      {/* Avatar / vehicle icon */}
      <View style={[pc.avatarWrap, { borderColor: selected ? accentColor : theme.border }]}>
        {partner.profileImage ? (
          <Image source={{ uri: partner.profileImage }} style={pc.avatar} />
        ) : (
          <View style={[pc.avatarFallback, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name={vehicleIcon} size={20} color={accentColor} />
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
};
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

// ─────────────────────────────────────────────────────────────────────────────
// LocationInput
// ─────────────────────────────────────────────────────────────────────────────
const LocationInput = ({ icon, iconColor, placeholder, value, onChangeText, onFocus, focused, theme }) => (
  <View style={[li.wrap, { backgroundColor: theme.backgroundAlt, borderColor: focused ? iconColor : theme.border }]}>
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
// PackageInput — single line text field for package form
// ─────────────────────────────────────────────────────────────────────────────
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
      />
    </View>
  </View>
);
const pi = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, gap: 10, marginBottom: 10 },
  iconWrap:{ width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  label:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  input:   { fontSize: 13, fontWeight: '500', minHeight: 20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Step dots
// ─────────────────────────────────────────────────────────────────────────────
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
// Quick Lagos destination chips
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_DESTINATIONS = [
  { label: 'Victoria Island', icon: 'business-outline', lat: 6.4281, lng: 3.4219 },
  { label: 'Lekki Phase 1',   icon: 'home-outline',     lat: 6.4433, lng: 3.5077 },
  { label: 'Ikeja',           icon: 'airplane-outline', lat: 6.6018, lng: 3.3515 },
  { label: 'Surulere',        icon: 'football-outline', lat: 6.5037, lng: 3.3577 },
  { label: 'Ajah',            icon: 'cart-outline',     lat: 6.4698, lng: 3.5827 },
  { label: 'Yaba',            icon: 'school-outline',   lat: 6.5096, lng: 3.3742 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock nearby delivery partners (fallback — should not show in production)
// ─────────────────────────────────────────────────────────────────────────────
const PARTNER_NAMES = [
  { firstName: 'Kunle',  lastName: 'Balogun' },
  { firstName: 'Ifeanyi',lastName: 'Eze'     },
  { firstName: 'Musa',   lastName: 'Ibrahim' },
  { firstName: 'Taiwo',  lastName: 'Akinola' },
  { firstName: 'Chukwu', lastName: 'Okafor'  },
];
const VEHICLE_TYPES = ['BIKE', 'MOTORCYCLE', 'VAN', 'BIKE', 'CAR'];
const PLATES = ['LND-221-KJ', 'EKY-440-TZ', 'KTU-110-MA', 'OGS-775-BD', 'RBS-003-VQ'];

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
      partnerId:   `mock-partner-${i}`,
      firstName:   n.firstName,
      lastName:    n.lastName,
      profileImage:null,
      vehicleType: VEHICLE_TYPES[i],
      vehiclePlate:PLATES[i],
      rating:      3.7 + Math.random() * 1.3,
      totalDeliveries: 30 + Math.floor(Math.random() * 150),
      distanceKm:  parseFloat(dist.toFixed(2)),
      etaMinutes:  Math.max(2, Math.ceil(dist / 0.4)),
      currentLat:  center.lat + Math.sin(angle) * spread,
      currentLng:  center.lng + Math.cos(angle) * spread,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestDeliveryScreen({ navigation }) {
  const { theme } = useTheme();
  const accentColor = theme.accent;

  // ── Location ──────────────────────────────────────────────────────────────
  const [myLocation,     setMyLocation]     = useState(null);
  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords,   setPickupCoords]   = useState(null);
  const [dropoffCoords,  setDropoffCoords]  = useState(null);
  const [focusedInput,   setFocusedInput]   = useState(null);

  // ── Package details ───────────────────────────────────────────────────────
  const [pickupContact,       setPickupContact]       = useState('');
  const [dropoffContact,      setDropoffContact]      = useState('');
  const [packageDescription,  setPackageDescription]  = useState('');
  const [packageWeight,       setPackageWeight]        = useState('');
  const [packageNotes,        setPackageNotes]         = useState('');

  // ── Map & partners ────────────────────────────────────────────────────────
  const mapRef             = useRef(null);
  const [partners,         setPartners]         = useState([]);
  const [selectedPartner,  setSelectedPartner]  = useState(null);
  const [loadingPartners,  setLoadingPartners]  = useState(false);

  // ── Fee ───────────────────────────────────────────────────────────────────
  const [distanceKm,  setDistanceKm]  = useState(null);
  const [feeEstimate, setFeeEstimate] = useState(null);
  const [etaMinutes,  setEtaMinutes]  = useState(null);

  // ── Flow ──────────────────────────────────────────────────────────────────
  const [step,       setStep]       = useState(1);
  const [requesting, setRequesting] = useState(false);
  const fadeA = useRef(new Animated.Value(1)).current;

  // ─────────────────────────────────────────────────────────────────────────
  // Mount: GPS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setMyLocation(coords);
      setPickupCoords(coords);
      const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng }).catch(() => []);
      if (place) {
        setPickupAddress([place.name, place.street, place.district].filter(Boolean).join(', ') || 'Current Location');
      } else {
        setPickupAddress('Current Location');
      }
    })();
    socketService.connect?.();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1 validation → Step 2
  // ─────────────────────────────────────────────────────────────────────────
  const proceedToMap = useCallback(async () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Missing locations', 'Please enter both pickup and drop-off addresses.');
      return;
    }
    if (!pickupContact || !dropoffContact) {
      Alert.alert('Missing contacts', 'Please enter phone numbers for both pickup and drop-off contacts.');
      return;
    }
    if (!packageDescription) {
      Alert.alert('Missing package info', 'Please describe what you are sending.');
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

    const km   = haversineKm(pCoords.lat, pCoords.lng, dCoords.lat, dCoords.lng);
    const wKg  = parseFloat(packageWeight) || 0;
    const fee  = calcFee(km, wKg);
    const eta  = Math.ceil(km / 0.4);
    setDistanceKm(km);
    setFeeEstimate(fee);
    setEtaMinutes(eta);

    // Fetch nearby delivery partners
    setLoadingPartners(true);
    try {
      const res = await deliveryAPI.getNearbyPartners({
        pickupLat: pCoords.lat,
        pickupLng: pCoords.lng,
        radiusKm:  15,
      });
      const list = res?.data?.partners ?? res?.partners ?? [];
      setPartners(list);
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Could not load nearby partners.';
      Alert.alert('Partners unavailable', msg);
      setPartners([]);
    } finally {
      setLoadingPartners(false);
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
  }, [pickupAddress, dropoffAddress, pickupCoords, dropoffCoords, pickupContact, dropoffContact, packageDescription, packageWeight]);

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm & submit
  // ─────────────────────────────────────────────────────────────────────────
  const confirmDelivery = async () => {
    if (!selectedPartner) {
      Alert.alert('Select a partner', 'Please choose a delivery partner from the list.');
      return;
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

      if (navigation.replace) {
        navigation.replace('DeliveryTracking');
      } else {
        navigation.goBack();
      }
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

  const mapRegion = myLocation
    ? { latitude: myLocation.lat, longitude: myLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : LAGOS_DEFAULT;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* MAP */}
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
            <Ionicons name="radio-button-on" size={22} color={accentColor} />
          </Marker>
        )}
        {dropoffCoords && (
          <Marker coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="location" size={26} color="#E05555" />
          </Marker>
        )}
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
        {step >= 2 && partners.map((p) => (
          <PartnerPin
            key={p.partnerId}
            partner={p}
            selected={selectedPartner?.partnerId === p.partnerId}
            onPress={() => handleSelectPartner(p)}
            accentColor={accentColor}
          />
        ))}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      {/* BACK */}
      <TouchableOpacity
        style={[s.backBtn, { backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* BOTTOM SHEET */}
      <Animated.View style={[s.sheet, { backgroundColor: theme.background, borderColor: theme.border, opacity: fadeA }]}>
        <StepDots step={step} accentColor={accentColor} theme={theme} />

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[s.sheetTitle, { color: theme.foreground }]}>Send a Package</Text>
              <Text style={[s.sheetSub, { color: theme.hint }]}>Where is it going?</Text>

              {/* Route inputs */}
              <View style={s.routeLine}>
                <View style={s.routeDots}>
                  <View style={[s.dotGold, { backgroundColor: accentColor }]} />
                  <View style={[s.routeVert, { backgroundColor: theme.border }]} />
                  <View style={s.dotRed} />
                </View>
                <View style={{ flex: 1 }}>
                  <LocationInput
                    icon="radio-button-on" iconColor={accentColor}
                    placeholder="Pickup location"
                    value={pickupAddress} onChangeText={setPickupAddress}
                    onFocus={() => setFocusedInput('pickup')}
                    focused={focusedInput === 'pickup'} theme={theme}
                  />
                  <LocationInput
                    icon="location" iconColor="#E05555"
                    placeholder="Drop-off destination"
                    value={dropoffAddress}
                    onChangeText={(t) => { setDropoffAddress(t); setDropoffCoords(null); }}
                    onFocus={() => setFocusedInput('dropoff')}
                    focused={focusedInput === 'dropoff'} theme={theme}
                  />
                </View>
              </View>

              {/* Quick destinations */}
              <Text style={[s.quickLabel, { color: theme.hint }]}>POPULAR DESTINATIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {QUICK_DESTINATIONS.map((d) => (
                  <TouchableOpacity
                    key={d.label}
                    style={[s.quickChip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                    onPress={() => { setDropoffAddress(d.label); setDropoffCoords({ lat: d.lat, lng: d.lng }); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={d.icon} size={12} color={accentColor} />
                    <Text style={[s.quickChipTxt, { color: theme.foreground }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Contact + package */}
              <Text style={[s.quickLabel, { color: theme.hint }]}>CONTACT & PACKAGE</Text>
              <PackageInput
                label="PICKUP CONTACT" icon="call-outline"
                placeholder="+234 801 234 5678"
                value={pickupContact} onChangeText={setPickupContact}
                keyboardType="phone-pad" theme={theme} accentColor={accentColor}
              />
              <PackageInput
                label="DROP-OFF CONTACT" icon="call-outline"
                placeholder="+234 801 234 5678"
                value={dropoffContact} onChangeText={setDropoffContact}
                keyboardType="phone-pad" theme={theme} accentColor={accentColor}
              />
              <PackageInput
                label="PACKAGE DESCRIPTION" icon="cube-outline"
                placeholder="e.g. Documents, Clothes, Electronics"
                value={packageDescription} onChangeText={setPackageDescription}
                theme={theme} accentColor={accentColor}
              />
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <PackageInput
                    label="WEIGHT (kg)" icon="scale-outline"
                    placeholder="Optional"
                    value={packageWeight} onChangeText={setPackageWeight}
                    keyboardType="numeric" theme={theme} accentColor={accentColor}
                  />
                </View>
              </View>
              <PackageInput
                label="SPECIAL NOTES" icon="document-text-outline"
                placeholder="Handle with care, fragile..."
                value={packageNotes} onChangeText={setPackageNotes}
                multiline theme={theme} accentColor={accentColor}
              />

              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: accentColor }]}
                onPress={proceedToMap}
                activeOpacity={0.88}
              >
                <Ionicons name="map-outline" size={18} color="#FFF" />
                <Text style={s.primaryBtnTxt}>Find Delivery Partners</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            {/* Fee summary strip */}
            <View style={[s.feeBadge, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.feeItem}>
                <Ionicons name="navigate-outline" size={13} color={theme.hint} />
                <Text style={[s.feeVal, { color: theme.foreground }]}>{distanceKm?.toFixed(1)} km</Text>
              </View>
              <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
              <View style={s.feeItem}>
                <Ionicons name="time-outline" size={13} color={theme.hint} />
                <Text style={[s.feeVal, { color: theme.foreground }]}>~{etaMinutes} min</Text>
              </View>
              <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
              <View style={s.feeItem}>
                <Ionicons name="cash-outline" size={13} color={theme.hint} />
                <Text style={[s.feeVal, { color: accentColor }]}>
                  ₦{feeEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>

            <Text style={[s.sheetTitle, { color: theme.foreground, marginTop: 14 }]}>
              {loadingPartners ? 'Finding partners…' : `${partners.length} partner${partners.length !== 1 ? 's' : ''} nearby`}
            </Text>
            <Text style={[s.sheetSub, { color: theme.hint }]}>Choose who handles your package</Text>

            {loadingPartners ? (
              <ActivityIndicator color={accentColor} style={{ marginTop: 24 }} />
            ) : partners.length === 0 ? (
              <View style={s.noPartners}>
                <Ionicons name="bicycle-outline" size={36} color={theme.hint} />
                <Text style={[s.noPartnersTxt, { color: theme.hint }]}>No partners available right now</Text>
                <TouchableOpacity onPress={proceedToMap} style={[s.retryBtn, { borderColor: accentColor + '50' }]}>
                  <Text style={[s.retryTxt, { color: accentColor }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={partners}
                keyExtractor={(p) => p.partnerId}
                renderItem={({ item }) => (
                  <PartnerCard
                    partner={item}
                    selected={selectedPartner?.partnerId === item.partnerId}
                    onSelect={handleSelectPartner}
                    accentColor={accentColor}
                    theme={theme}
                  />
                )}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 220 }}
                nestedScrollEnabled
              />
            )}

            {selectedPartner && (
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 12 }]}
                onPress={() => setStep(3)}
                activeOpacity={0.88}
              >
                <Text style={s.primaryBtnTxt}>Continue with {selectedPartner.firstName}</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && selectedPartner && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[s.sheetTitle, { color: theme.foreground }]}>Confirm Delivery</Text>

            {/* Route */}
            <View style={[s.confirmRoute, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
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

            {/* Package summary */}
            <View style={[s.packageSummary, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.pkgRow}>
                <Ionicons name="cube-outline" size={14} color={theme.hint} />
                <Text style={[s.pkgTxt, { color: theme.foreground }]}>{packageDescription}</Text>
              </View>
              {packageWeight ? (
                <View style={s.pkgRow}>
                  <Ionicons name="scale-outline" size={14} color={theme.hint} />
                  <Text style={[s.pkgTxt, { color: theme.foreground }]}>{packageWeight} kg</Text>
                </View>
              ) : null}
              {packageNotes ? (
                <View style={s.pkgRow}>
                  <Ionicons name="document-text-outline" size={14} color={theme.hint} />
                  <Text style={[s.pkgTxt, { color: theme.hint }]} numberOfLines={2}>{packageNotes}</Text>
                </View>
              ) : null}
            </View>

            {/* Partner + fee */}
            <View style={[s.confirmCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.confirmDriver}>
                <View style={[s.confirmAvatarFallback, { backgroundColor: accentColor + '22' }]}>
                  <Ionicons name={VEHICLE_ICONS[selectedPartner.vehicleType] ?? 'bicycle-outline'} size={20} color={accentColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.confirmName, { color: theme.foreground }]}>
                    {selectedPartner.firstName} {selectedPartner.lastName}
                  </Text>
                  <Text style={[s.confirmVehicle, { color: theme.hint }]}>
                    {selectedPartner.vehicleType} · {selectedPartner.vehiclePlate ?? '—'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="star" size={12} color="#C9A96E" />
                    <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedPartner.rating?.toFixed(1) ?? '–'}</Text>
                    <Text style={[s.confirmMeta, { color: theme.border }]}>·</Text>
                    <Text style={[s.confirmMeta, { color: theme.hint }]}>{selectedPartner.totalDeliveries} deliveries</Text>
                  </View>
                </View>
                <View style={s.confirmFareBox}>
                  <Text style={[s.confirmFareLabel, { color: theme.hint }]}>FEE</Text>
                  <Text style={[s.confirmFare, { color: accentColor }]}>
                    ₦{feeEstimate?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[s.confirmFareLabel, { color: theme.hint }]}>CASH</Text>
                </View>
              </View>
            </View>

            {/* ETA */}
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
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text style={s.primaryBtnTxt}>Confirm Delivery</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryBtn, { borderColor: theme.border }]}
              onPress={() => setStep(2)}
              activeOpacity={0.8}
            >
              <Text style={[s.secondaryBtnTxt, { color: theme.hint }]}>Change Partner</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 42,
    left: 20, width: 42, height: 42, borderRadius: 13,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99,
  },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1,
    paddingHorizontal: 24, paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    maxHeight: height * 0.75,
  },

  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:   { fontSize: 12, fontWeight: '500', marginBottom: 16 },

  routeLine:  { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 4 },
  routeDots:  { alignItems: 'center', paddingTop: 18, gap: 0 },
  dotGold:    { width: 10, height: 10, borderRadius: 5 },
  routeVert:  { width: 1.5, height: 38 },
  dotRed:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E05555' },

  quickLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginBottom: 10 },
  quickChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 },
  quickChipTxt: { fontSize: 12, fontWeight: '600' },

  row2: { flexDirection: 'row', gap: 10 },

  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  secondaryBtn:  { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  secondaryBtnTxt: { fontSize: 14, fontWeight: '600' },

  feeBadge:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  feeItem:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  feeVal:     { fontSize: 13, fontWeight: '700' },
  feeDivider: { width: 1 },

  noPartners:   { alignItems: 'center', paddingVertical: 24 },
  noPartnersTxt:{ fontSize: 13, marginTop: 10, marginBottom: 14 },
  retryBtn:     { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:     { fontSize: 13, fontWeight: '700' },

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