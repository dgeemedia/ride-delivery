// mobile/src/screens/Customer/NearbyPartnersScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl, ScrollView,
  Modal, PanResponder, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { deliveryAPI } from '../../services/api';
import SmartMapView, { Marker } from '../../components/SmartMapView';

const { width, height } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  brand:    '#00C896',
  brandDim: '#00C89622',
  red:      '#FF4D4D',
  purple:   '#8B7CF8',
  amber:    '#F5A623',
};

const T = {
  xs:   10,
  sm:   12,
  base: 14,
  md:   15,
  lg:   17,
  xl:   20,
};

const VEHICLE_ICON = {
  BIKE:       'bicycle-outline',
  MOTORCYCLE: 'bicycle-outline',
  CAR:        'car-outline',
  VAN:        'bus-outline',
  TRICYCLE:   'bicycle-outline',
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
  <View style={sr.row}>
    <Ionicons name="star" size={size} color={C.amber} />
    <Text style={[sr.txt, { color: theme.foreground, fontSize: size + 1 }]}>
      {rating?.toFixed(1) ?? '—'}
    </Text>
  </View>
);
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txt: { fontWeight: '700' },
});

// ─── Chip ─────────────────────────────────────────────────────────────────────
const Chip = ({ icon, label, color, theme, small }) => {
  const col = color || theme.hint;
  return (
    <View style={[chip.wrap, {
      backgroundColor: col + '14',
      borderColor: col + '28',
      paddingHorizontal: small ? 6 : 8,
      paddingVertical: small ? 3 : 4,
    }]}>
      {icon && <Ionicons name={icon} size={small ? 10 : 11} color={col} />}
      <Text style={[chip.txt, { color: col, fontSize: small ? T.xs : 11 }]}>{label}</Text>
    </View>
  );
};
const chip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, borderWidth: 1 },
  txt:  { fontWeight: '700', letterSpacing: 0.2 },
});

// ─── PartnerCard ──────────────────────────────────────────────────────────────
const PartnerCard = ({ partner, onPress, theme }) => {
  const scaleA      = useRef(new Animated.Value(1)).current;
  const vehicleIcon = VEHICLE_ICON[partner.vehicleType] ?? 'bicycle-outline';

  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.975, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,     useNativeDriver: true, tension: 300, friction: 20 }).start();

  const etaColor = (partner.etaMinutes ?? 99) <= 5 ? C.brand
    : (partner.etaMinutes ?? 99) <= 12 ? C.amber : theme.hint;

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        style={[pc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={pc.row}>
          <View style={[pc.avatar, { backgroundColor: C.brand + '18' }]}>
            <Ionicons name={vehicleIcon} size={22} color={C.brand} />
          </View>

          <View style={pc.info}>
            <View style={pc.nameRow}>
              <Text style={[pc.name, { color: theme.foreground }]}>
                {partner.firstName} {partner.lastName}
              </Text>
              <StarRating rating={partner.rating ?? 0} theme={theme} />
            </View>
            <Text style={[pc.vehicleLine, { color: theme.hint }]}>
              {partner.vehicleType?.charAt(0) + partner.vehicleType?.slice(1).toLowerCase()} • {partner.vehiclePlate ?? '—'}
            </Text>
          </View>

          <View style={pc.etaBlock}>
            <Text style={[pc.etaMain, { color: etaColor }]}>~{partner.etaMinutes} min</Text>
            <Text style={[pc.distTxt, { color: theme.hint }]}>{partner.distanceKm} km</Text>
          </View>
        </View>

        <View style={pc.chips}>
          <Chip icon={vehicleIcon}      label={partner.vehicleType}                          color={C.purple}   theme={theme} />
          <Chip icon="navigate-outline" label={`${partner.distanceKm} km`}                   color={theme.hint} theme={theme} />
          <Chip icon="time-outline"     label={`~${partner.etaMinutes} min`}                 color={theme.hint} theme={theme} />
          <Chip icon="star-outline"     label={`${partner.totalDeliveries ?? 0} deliveries`} color={theme.hint} theme={theme} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
const pc = StyleSheet.create({
  card:        { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10, overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:      { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  info:        { flex: 1, gap: 2 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:        { fontSize: T.md, fontWeight: '700' },
  vehicleLine: { fontSize: T.sm, fontWeight: '500' },
  etaBlock:    { alignItems: 'flex-end', gap: 3 },
  etaMain:     { fontSize: T.xl, fontWeight: '900', letterSpacing: -0.4 },
  distTxt:     { fontSize: T.xs, fontWeight: '500' },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ─── LocationSearchSheet ──────────────────────────────────────────────────────
const LocationSearchSheet = ({ visible, type, onClose, onSelect, pickupCoords, theme }) => {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState('search');
  const [mapPin,    setMapPin]    = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const searchTimer = useRef(null);
  const slideA      = useRef(new Animated.Value(height)).current;

  const isPickup = type === 'pickup';
  const accent   = isPickup ? C.brand : C.red;

  const initialRegion = useMemo(() => {
    if (pickupCoords) return { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    return { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [pickupCoords]);

  useEffect(() => {
    if (visible) {
      setQuery(''); setResults([]); setMapPin(null); setTab('search');
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
          (data.features ?? []).map((f, i) => ({
            id:          `${f.geometry.coordinates[0]}_${f.geometry.coordinates[1]}_${i}`,
            description: [f.properties.name, f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join(', '),
            main:        f.properties.name ?? f.properties.street ?? '',
            secondary:   [f.properties.city, f.properties.country].filter(Boolean).join(', '),
            lat:         f.geometry.coordinates[1],
            lng:         f.geometry.coordinates[0],
          }))
        );
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 400);
  };

  const handleMapPress = async (e) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent?.coordinate ?? {};
    if (!lat || !lng) return;
    setGeocoding(true);
    const address = await reverseGeocode(lat, lng);
    setMapPin({ lat, lng, address });
    setGeocoding(false);
  };

  const confirmMapPin = () => {
    if (!mapPin) return;
    onSelect({ lat: mapPin.lat, lng: mapPin.lng, description: mapPin.address });
    onClose();
  };

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

          <View style={[lss.tabs, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {['search', 'map'].map(t => (
              <TouchableOpacity
                key={t}
                style={[lss.tab, tab === t && { backgroundColor: accent, borderRadius: 10 }]}
                onPress={() => setTab(t)}
              >
                <Ionicons name={t === 'search' ? 'search' : 'map-outline'} size={14} color={tab === t ? '#fff' : theme.hint} />
                <Text style={[lss.tabTxt, { color: tab === t ? '#fff' : theme.hint }]}>
                  {t === 'search' ? 'Search' : 'Map'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'search' ? (
            <>
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
                      <Text style={[lss.resultSub,  { color: theme.hint }]}      numberOfLines={1}>{item.secondary}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {results.length === 0 && query.length >= 3 && !loading && (
                  <Text style={[lss.noResults, { color: theme.hint }]}>No results found</Text>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={[lss.mapHint, { color: theme.hint }]}>Tap anywhere on the map to place a pin</Text>
              <View style={{ flex: 1 }}>
                <SmartMapView
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={initialRegion}
                  showsUserLocation
                  onPress={handleMapPress}
                >
                  {mapPin && (
                    <Marker coordinate={{ latitude: mapPin.lat, longitude: mapPin.lng }} pinColor={accent} />
                  )}
                </SmartMapView>
                {geocoding && (
                  <View style={lss.geocodingOverlay}>
                    <ActivityIndicator color={accent} />
                    <Text style={[lss.geocodingTxt, { color: '#fff' }]}>Getting address…</Text>
                  </View>
                )}
              </View>
              {mapPin && (
                <View style={[lss.mapConfirm, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[lss.mapConfirmLabel, { color: theme.hint }]}>SELECTED</Text>
                    <Text style={[lss.mapConfirmAddr, { color: theme.foreground }]} numberOfLines={2}>{mapPin.address}</Text>
                  </View>
                  <TouchableOpacity style={[lss.mapConfirmBtn, { backgroundColor: accent }]} onPress={confirmMapPin}>
                    <Text style={lss.mapConfirmBtnTxt}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};
const lss = StyleSheet.create({
  overlay:          { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:            { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingTop: 12, height: height * 0.82, flexDirection: 'column' },
  handle:           { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  dotWrap:          { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dot:              { width: 10, height: 10, borderRadius: 5 },
  title:            { flex: 1, fontSize: T.lg, fontWeight: '800' },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  inputWrap:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  input:            { flex: 1, fontSize: T.md, fontWeight: '500' },
  resultRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  resultIcon:       { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resultMain:       { fontSize: T.base, fontWeight: '600', marginBottom: 2 },
  resultSub:        { fontSize: T.sm, fontWeight: '400' },
  noResults:        { textAlign: 'center', paddingVertical: 24, fontSize: T.sm },
  tabs:             { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 3, gap: 3 },
  tab:              { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  tabTxt:           { fontSize: 13, fontWeight: '700' },
  mapHint:          { fontSize: 11, textAlign: 'center', paddingVertical: 6, fontWeight: '500' },
  geocodingOverlay: { position: 'absolute', top: '45%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  geocodingTxt:     { fontSize: 13, fontWeight: '600' },
  mapConfirm:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: 1 },
  mapConfirmLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  mapConfirmAddr:   { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  mapConfirmBtn:    { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  mapConfirmBtnTxt: { fontSize: 14, fontWeight: '800', color: '#000' },
});

// ─── ConfirmSheet ─────────────────────────────────────────────────────────────
const ConfirmSheet = ({ partner, routeParams, onClose, onSuccess, theme }) => {
  const [requesting,     setRequesting]     = useState(false);
  const [pickupAddress,  setPickupAddress]  = useState(routeParams.pickupAddress  ?? '');
  const [pickupLat,      setPickupLat]      = useState(routeParams.pickupLat      ?? null);
  const [pickupLng,      setPickupLng]      = useState(routeParams.pickupLng      ?? null);
  const [dropoffAddress, setDropoffAddress] = useState(routeParams.dropoffAddress ?? '');
  const [dropoffLat,     setDropoffLat]     = useState(routeParams.dropoffLat     ?? null);
  const [dropoffLng,     setDropoffLng]     = useState(routeParams.dropoffLng     ?? null);
  const [searchType,     setSearchType]     = useState(null);

  // New editable fields for contacts, package, and notes
  const [pickupContact,  setPickupContact]  = useState(routeParams.pickupContact      ?? '');
  const [dropoffContact, setDropoffContact] = useState(routeParams.dropoffContact     ?? '');
  const [pkgDescription, setPkgDescription] = useState(routeParams.packageDescription ?? '');
  const [pkgWeight,      setPkgWeight]      = useState(routeParams.packageWeight      ? String(routeParams.packageWeight) : '');
  const [notes,          setNotes]          = useState(routeParams.packageNotes       ?? '');

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
    if (!partner) return;
    slideInY.setValue(height); dragY.setValue(0);
    Animated.spring(slideInY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }).start();
  }, [partner?.partnerId]);

  // Keep in sync when routeParams change
  const prevPartnerRef = useRef(null);
  useEffect(() => {
    if (!partner) return;
    if (prevPartnerRef.current === partner.partnerId) return;
    prevPartnerRef.current = partner.partnerId;
    setPickupAddress(routeParams.pickupAddress  ?? '');
    setPickupLat(routeParams.pickupLat      ?? null);
    setPickupLng(routeParams.pickupLng      ?? null);
    setDropoffAddress(routeParams.dropoffAddress ?? '');
    setDropoffLat(routeParams.dropoffLat     ?? null);
    setDropoffLng(routeParams.dropoffLng     ?? null);
    // Also reset the new fields when partner changes
    setPickupContact(routeParams.pickupContact      ?? '');
    setDropoffContact(routeParams.dropoffContact     ?? '');
    setPkgDescription(routeParams.packageDescription ?? '');
    setPkgWeight(routeParams.packageWeight ? String(routeParams.packageWeight) : '');
    setNotes(routeParams.packageNotes ?? '');
  }, [partner?.partnerId]);

  if (!partner) return null;

  const feeEstimate = routeParams.feeEstimate ?? partner.effectiveFee ?? 0;
  const vehicleIcon = VEHICLE_ICON[partner.vehicleType] ?? 'bicycle-outline';

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
    if (!pickupContact.trim()) {
      Alert.alert('Missing Pickup Contact', 'Please enter a contact for pickup.'); return;
    }
    if (!dropoffContact.trim()) {
      Alert.alert('Missing Drop-off Contact', 'Please enter a contact for drop-off.'); return;
    }
    if (!pkgDescription.trim()) {
      Alert.alert('Missing Package Description', 'Please describe the package.'); return;
    }

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);
    const weight = parseFloat(pkgWeight) || 0;

    if (isNaN(pLat) || isNaN(pLng)) {
      Alert.alert('Invalid Pickup', 'Pickup coordinates are invalid.'); return;
    }
    if (isNaN(dLat) || isNaN(dLng)) {
      Alert.alert('Invalid Drop-off', 'Drop-off coordinates are invalid.'); return;
    }

    setRequesting(true);
    try {
      const payload = {
        pickupAddress,
        pickupLat:          pLat,
        pickupLng:          pLng,
        pickupContact:      pickupContact.trim(),
        dropoffAddress,
        dropoffLat:         dLat,
        dropoffLng:         dLng,
        dropoffContact:     dropoffContact.trim(),
        packageDescription: pkgDescription.trim(),
        packageWeight:      weight,
        notes:              notes.trim(),
        estimatedFee:       feeEstimate,
        partnerId:          partner.partnerId,
      };

      console.log('[ConfirmSheet] requesting delivery with payload:', JSON.stringify(payload, null, 2));

      const res = await deliveryAPI.requestDelivery(payload);

      console.log('[ConfirmSheet] delivery response:', JSON.stringify(res, null, 2));

      const delivery = res?.data?.delivery ?? res?.delivery;
      if (!delivery) {
        throw new Error('No delivery object in response — check backend response shape.');
      }
      onSuccess(delivery);
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.data?.message           ??
        err?.message                 ??
        'Please try again.';
      console.error('[ConfirmSheet] requestDelivery error:', JSON.stringify(err, null, 2));
      Alert.alert('Could not request', msg);
      setRequesting(false);
    }
  };

  // Location field row (unchanged)
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

  // Generic input row for the new editable fields
  const InputRow = ({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, maxLength }) => (
    <View style={[inpS.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <Text style={[inpS.label, { color: theme.hint }]}>{label}</Text>
      <TextInput
        style={[inpS.input, { color: theme.foreground }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.hint}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );

  return (
    <>
      <Modal visible={!!partner} animationType="none" transparent statusBarTranslucent onRequestClose={closeSheet}>
        <View style={cs.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeSheet} activeOpacity={1} />
          <Animated.View style={[cs.sheet, {
            backgroundColor: theme.background,
            borderColor: theme.border,
            transform: [{ translateY: Animated.add(slideInY, dragY) }],
          }]}>
            <View {...panResponder.panHandlers} style={[cs.handle, { backgroundColor: theme.hint + '44' }]} />

            <View style={cs.header}>
              <Text style={[cs.title, { color: theme.foreground }]}>Review & Confirm</Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <View style={[cs.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="close" size={16} color={theme.hint} />
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={cs.scroll}>

              {/* Courier card */}
              <View style={[cs.courierCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <View style={[cs.courierAvatar, { backgroundColor: C.brand + '18' }]}>
                  <Ionicons name={vehicleIcon} size={20} color={C.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[cs.courierName, { color: theme.foreground }]}>
                    {partner.firstName} {partner.lastName}
                  </Text>
                  <Text style={[cs.courierVehicle, { color: theme.hint }]}>
                    {partner.vehicleType} • {partner.vehiclePlate ?? '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StarRating rating={partner.rating ?? 0} size={12} theme={theme} />
                  <Text style={[cs.courierEta, { color: theme.hint }]}>~{partner.etaMinutes} min away</Text>
                </View>
              </View>

              {/* --- NEW EDITABLE DETAILS SECTION --- */}
              <Text style={[cs.sectionLabel, { color: theme.hint }]}>DETAILS</Text>

              <InputRow
                label="Pickup Contact *"
                value={pickupContact}
                onChangeText={setPickupContact}
                placeholder="Name or phone number"
                keyboardType="default"
              />
              <InputRow
                label="Drop-off Contact *"
                value={dropoffContact}
                onChangeText={setDropoffContact}
                placeholder="Name or phone number"
                keyboardType="default"
              />
              <InputRow
                label="Package Description *"
                value={pkgDescription}
                onChangeText={setPkgDescription}
                placeholder="e.g., documents, small box"
                keyboardType="default"
              />
              <InputRow
                label="Package Weight (kg)"
                value={pkgWeight}
                onChangeText={setPkgWeight}
                placeholder="0.0"
                keyboardType="decimal-pad"
              />
              <InputRow
                label="Additional Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Fragile, handle with care..."
                keyboardType="default"
                multiline={true}
                maxLength={200}
              />

              {/* Editable route */}
              <Text style={[cs.sectionLabel, { color: theme.hint }]}>ROUTE</Text>
              <LocationField
                label="PICKUP"
                value={pickupAddress}
                accent={C.brand}
                onSearch={() => setSearchType('pickup')}
              />
              <View style={[cs.connector, { borderColor: theme.border }]} />
              <LocationField
                label="DROP-OFF"
                value={dropoffAddress}
                accent={C.red}
                onSearch={() => setSearchType('dropoff')}
              />

              {/* Fee breakdown */}
              {feeEstimate > 0 && (
                <View style={[cs.feeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  {routeParams.distanceKm ? (
                    <View style={cs.feeRow}>
                      <Text style={[cs.feeLabel, { color: theme.hint }]}>Distance</Text>
                      <Text style={[cs.feeVal, { color: theme.foreground }]}>{routeParams.distanceKm} km</Text>
                    </View>
                  ) : null}
                  {routeParams.etaMinutes ? (
                    <View style={cs.feeRow}>
                      <Text style={[cs.feeLabel, { color: theme.hint }]}>Est. time</Text>
                      <Text style={[cs.feeVal, { color: theme.foreground }]}>~{routeParams.etaMinutes} min</Text>
                    </View>
                  ) : null}
                  <View style={[cs.feeSep, { backgroundColor: theme.border }]} />
                  <View style={cs.feeRow}>
                    <Text style={[cs.feeLabel, { color: theme.foreground, fontWeight: '700' }]}>Estimated fee</Text>
                    <Text style={[cs.feeTotal, { color: C.brand }]}>
                      ₦{feeEstimate.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Info note */}
              <View style={[cs.note, { backgroundColor: C.brand + '10', borderColor: C.brand + '28' }]}>
                <Ionicons name="information-circle-outline" size={14} color={C.brand} style={{ marginTop: 1 }} />
                <Text style={[cs.noteTxt, { color: C.brand }]}>
                  Final fee may vary based on actual distance and time. Payment is cash on delivery unless otherwise agreed.
                </Text>
              </View>

              <View style={cs.chipsRow}>
                <Chip icon={vehicleIcon}      label={partner.vehicleType}                          color={C.purple}   theme={theme} />
                <Chip icon="navigate-outline" label={`${partner.distanceKm} km`}                   color={theme.hint} theme={theme} />
                <Chip icon="time-outline"     label={`~${partner.etaMinutes} min`}                 color={theme.hint} theme={theme} />
                <Chip icon="star-outline"     label={`${partner.totalDeliveries ?? 0} deliveries`} color={theme.hint} theme={theme} />
              </View>
            </ScrollView>

            <View style={[cs.cta, { borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity style={[cs.back, { borderColor: theme.border }]} onPress={closeSheet} disabled={requesting}>
                <Text style={[cs.backTxt, { color: theme.hint }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cs.confirm, { backgroundColor: C.brand, opacity: requesting ? 0.72 : 1 }]}
                onPress={handleRequest}
                disabled={requesting}
                activeOpacity={0.86}
              >
                {requesting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={19} color="#000" />
                    <Text style={cs.confirmTxt}>Request Courier</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Location search sheet nested inside confirm sheet */}
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

// New input styles for editable details
const inpS = StyleSheet.create({
  wrap:   { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  label:  { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  input:  { fontSize: 14, fontWeight: '500', minHeight: 40, padding: 0, textAlignVertical: 'top' },
});

const cs = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingTop: 12, height: height * 0.9, flexDirection: 'column', shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 20 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title:        { fontSize: T.xl, fontWeight: '800' },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:       { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  courierCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  courierAvatar:{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  courierName:  { fontSize: T.md, fontWeight: '700', marginBottom: 3 },
  courierVehicle:{ fontSize: T.sm, fontWeight: '500' },
  courierEta:   { fontSize: T.xs, fontWeight: '500' },
  // Removed old pkgCard styles – now using InputRow
  sectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 8, marginTop: 12 },
  connector:    { width: 1.5, height: 8, marginLeft: 16, borderLeftWidth: 1.5, borderStyle: 'dashed', marginVertical: 2 },
  feeCard:      { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  feeRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel:     { fontSize: T.sm, fontWeight: '500' },
  feeVal:       { fontSize: T.sm, fontWeight: '700' },
  feeSep:       { height: 1, marginVertical: 2 },
  feeTotal:     { fontSize: T.lg, fontWeight: '900' },
  note:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  noteTxt:      { flex: 1, fontSize: T.sm, lineHeight: 18, fontWeight: '500' },
  chipsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cta:          { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  back:         { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  backTxt:      { fontSize: T.md, fontWeight: '600' },
  confirm:      { flex: 2.2, height: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmTxt:   { fontSize: T.md, fontWeight: '900', color: '#000' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function NearbyPartnersScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const params          = route.params ?? {};

  const [pickupAddress,  setPickupAddress]  = useState(params.pickupAddress  ?? '');
  const [pickupLat,      setPickupLat]      = useState(params.pickupLat      ?? null);
  const [pickupLng,      setPickupLng]      = useState(params.pickupLng      ?? null);
  const [dropoffAddress, setDropoffAddress] = useState(params.dropoffAddress ?? '');
  const [dropoffLat,     setDropoffLat]     = useState(params.dropoffLat     ?? null);
  const [dropoffLng,     setDropoffLng]     = useState(params.dropoffLng     ?? null);
  const [searchModal,    setSearchModal]    = useState(null);

  const [partners,        setPartners]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

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

  const load = useCallback(async (silent = false) => {
    const pLat = parseFloat(pickupLat  ?? params.pickupLat);
    const pLng = parseFloat(pickupLng  ?? params.pickupLng);
    const dLat = parseFloat(dropoffLat ?? params.dropoffLat);
    const dLng = parseFloat(dropoffLng ?? params.dropoffLng);

    if (!pLat || !pLng) return;

    if (!silent) setLoading(true);
    try {
      const res  = await deliveryAPI.getNearbyPartners({
        pickupLat:  pLat,
        pickupLng:  pLng,
        dropoffLat: dLat || undefined,
        dropoffLng: dLng || undefined,
        radiusKm:   params.radiusKm ?? 15,
      });
      const list = (res?.data?.partners ?? res?.partners ?? [])
        .filter(p => !String(p.partnerId).startsWith('mock-'));
      setPartners(list);
    } catch (err) {
      Alert.alert('Could not load couriers', err?.message ?? 'Please try again.');
      setPartners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, params]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (pickupLat && pickupLng) load(true);
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

  const handlePartnerPress = (partner) => {
    setSelectedPartner(partner);
  };

  const handleDeliveryRequested = (delivery) => {
    setSelectedPartner(null);
    if (navigation.replace) {
      navigation.replace('DeliveryTracking', { deliveryId: delivery?.id, delivery });
    } else {
      navigation.goBack();
    }
  };

  const routeParams = {
    pickupAddress,  pickupLat,  pickupLng,
    dropoffAddress, dropoffLat, dropoffLng,
    pickupContact:      params.pickupContact,
    dropoffContact:     params.dropoffContact,
    packageDescription: params.packageDescription,
    packageWeight:      params.packageWeight,
    packageNotes:       params.packageNotes,
    feeEstimate:        params.feeEstimate,
    distanceKm:         params.distanceKm,
    etaMinutes:         params.etaMinutes,
  };

  const LocationStrip = () => (
    <View style={[lstrip.wrap, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
      <View style={lstrip.inner}>
        <View style={lstrip.dotCol}>
          <View style={[lstrip.dot, { backgroundColor: C.brand }]} />
          <View style={[lstrip.line, { backgroundColor: theme.border }]} />
          <View style={[lstrip.dot, { backgroundColor: C.red }]} />
        </View>
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
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Choose a Courier</Text>
            <Text style={[s.headerSub, { color: theme.hint }]}>Find a delivery partner near you</Text>
          </View>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={18} color={C.brand} />
          </TouchableOpacity>
        </View>

        <LocationStrip />
      </SafeAreaView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
          <Text style={[s.loadTxt, { color: theme.hint }]}>Finding couriers near you…</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={partners}
            keyExtractor={p => p.partnerId}
            renderItem={({ item }) => (
              <PartnerCard
                partner={item}
                onPress={() => handlePartnerPress(item)}
                theme={theme}
              />
            )}
            contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
            ListHeaderComponent={partners.length > 0 ? (
              <View style={s.listHead}>
                <Text style={[s.listCount, { color: theme.hint }]}>
                  {partners.length} courier{partners.length !== 1 ? 's' : ''} nearby
                </Text>
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="bicycle-outline" size={36} color={theme.hint} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No couriers nearby</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>
                  {!dropoffLat ? 'Set a drop-off location to see accurate fees.' : 'Pull down to refresh or try again shortly.'}
                </Text>
                <TouchableOpacity style={[s.retryBtn, { backgroundColor: C.brand }]} onPress={onRefresh}>
                  <Text style={s.retryTxt}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>
      )}

      <LocationSearchSheet
        visible={searchModal !== null}
        type={searchModal}
        onClose={() => setSearchModal(null)}
        onSelect={handleSearchSelect}
        pickupCoords={pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng } : null}
        theme={theme}
      />

      <ConfirmSheet
        partner={selectedPartner}
        routeParams={routeParams}
        onClose={() => setSelectedPartner(null)}
        onSuccess={handleDeliveryRequested}
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