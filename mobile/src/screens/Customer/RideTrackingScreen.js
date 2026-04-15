// mobile/src/screens/Customer/RideTrackingScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI, shieldAPI } from '../../services/api';
import socketService          from '../../services/socket';

const { height } = Dimensions.get('window');

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#C9A96E' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',                elementType: 'labels',           stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            elementType: 'labels',           stylers: [{ visibility: 'off' }] },
];

const STATUS_CONFIG = {
  REQUESTED:   { label: 'Finding your driver...',  color: '#4E8DBD', icon: 'time-outline'             },
  ACCEPTED:    { label: 'Driver is on the way',    color: '#FFB800', icon: 'car-outline'              },
  ARRIVED:     { label: 'Driver has arrived!',     color: '#A78BFA', icon: 'location-outline'         },
  IN_PROGRESS: { label: 'Ride in progress',        color: '#5DAA72', icon: 'navigate-outline'         },
  COMPLETED:   { label: 'Ride completed!',         color: '#5DAA72', icon: 'checkmark-circle-outline' },
  CANCELLED:   { label: 'Ride cancelled',          color: '#E05555', icon: 'close-circle-outline'     },
};

// ── DriverInfoCard ────────────────────────────────────────────────────────────
const DriverInfoCard = ({ ride, theme }) => {
  const driver = ride?.driver;
  if (!driver) return null;
  const dp     = driver.driverProfile;
  const accent = theme.accent;

  return (
    <View style={[di.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={[di.avatar, { backgroundColor: accent + '18' }]}>
        <Text style={[di.avatarTxt, { color: accent }]}>
          {driver.firstName?.[0]}{driver.lastName?.[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[di.name, { color: theme.foreground }]}>
          {driver.firstName} {driver.lastName}
        </Text>
        {dp && (
          <Text style={[di.vehicle, { color: theme.hint }]} numberOfLines={1}>
            {dp.vehicleColor} {dp.vehicleMake} {dp.vehicleModel} • {dp.vehiclePlate}
          </Text>
        )}
        {dp?.rating > 0 && (
          <View style={di.ratingRow}>
            <Ionicons name="star" size={11} color="#C9A96E" />
            <Text style={[di.rating, { color: theme.hint }]}> {dp.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      {driver.phone && (
        <TouchableOpacity style={[di.callBtn, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
          <Ionicons name="call-outline" size={17} color={accent} />
        </TouchableOpacity>
      )}
    </View>
  );
};
const di = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  avatar:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800' },
  name:      { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehicle:   { fontSize: 11, marginBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  rating:    { fontSize: 11 },
  callBtn:   { width: 38, height: 38, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── RouteCard ─────────────────────────────────────────────────────────────────
const RouteCard = ({ ride, theme }) => (
  <View style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <View style={rc.row}>
      <View style={[rc.dot, { backgroundColor: theme.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[rc.lbl, { color: theme.hint }]}>PICKUP</Text>
        <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{ride.pickupAddress}</Text>
      </View>
    </View>
    <View style={[rc.line, { backgroundColor: theme.border }]} />
    <View style={rc.row}>
      <View style={[rc.dot, { backgroundColor: '#E05555' }]} />
      <View style={{ flex: 1 }}>
        <Text style={[rc.lbl, { color: theme.hint }]}>DROP-OFF</Text>
        <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{ride.dropoffAddress}</Text>
      </View>
    </View>
  </View>
);
const rc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  line: { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 3 },
  lbl:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function RideTrackingScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const rideId          = route?.params?.rideId;
  const accentFg        = theme.accentFg ?? (mode === 'dark' ? '#111111' : '#FFFFFF');

  const [ride,           setRide]           = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [cancelling,     setCancelling]     = useState(false);
  const [shieldActive,   setShieldActive]   = useState(false);

  const mapRef          = useRef(null);
  const sheetA          = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);

  // ── Load ride ───────────────────────────────────────────────────────────────
  const loadRide = useCallback(async () => {
    try {
      const res = await rideAPI.getActiveRide();
      const r   = res?.data?.ride ?? res?.ride ?? null;
      setRide(r);

      if (r?.driver?.driverProfile?.currentLat) {
        setDriverLocation({
          latitude:  r.driver.driverProfile.currentLat,
          longitude: r.driver.driverProfile.currentLng,
        });
      }

      if (r?.id) {
        socketService.joinRide(r.id);
        try {
          const sRes = await shieldAPI.getSession({ rideId: r.id });
          setShieldActive(!!sRes?.data?.session);
        } catch {}
      }
    } catch (err) {
      console.error('[RideTracking] loadRide:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRide();
    Animated.spring(sheetA, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();

    const handleStatus = (data) => {
      if (!data.rideId || data.rideId !== rideId) return;
      setRide(prev => prev ? { ...prev, status: data.status, driver: data.driver ?? prev.driver } : prev);

      if (data.status === 'COMPLETED') {
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;
        setTimeout(() => {
          navigation.navigate('RateRide', { rideId, driver: data.driver ?? ride?.driver });
        }, 500);
      }

      if (data.status === 'CANCELLED') {
        Alert.alert('Ride Cancelled', 'Your ride was cancelled.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      }
    };

    const handleCancelled = (data) => {
      if (data.rideId !== rideId) return;
      Alert.alert('Ride Cancelled', 'Your ride was cancelled.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
    };

    const handleDriverLoc = (data) => {
      const loc = { latitude: data.lat, longitude: data.lng };
      setDriverLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
    };

    const handleShieldActivated   = () => setShieldActive(true);
    const handleShieldDeactivated = () => setShieldActive(false);

    socketService.on('ride:status:update',     handleStatus);
    socketService.on('ride:cancelled',         handleCancelled);
    socketService.on('driver:location:update', handleDriverLoc);
    socketService.on('shield:activated',       handleShieldActivated);
    socketService.on('shield:deactivated',     handleShieldDeactivated);

    return () => {
      socketService.off('ride:status:update',     handleStatus);
      socketService.off('ride:cancelled',         handleCancelled);
      socketService.off('driver:location:update', handleDriverLoc);
      socketService.off('shield:activated',       handleShieldActivated);
      socketService.off('shield:deactivated',     handleShieldDeactivated);
      if (rideId) socketService.leaveRide(rideId);
    };
  }, [rideId]);

  // ── Cancel handler ──────────────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      'Cancel Ride?',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await rideAPI.cancelRide(rideId, { reason: 'Customer cancelled from tracking screen' });
              navigation.navigate('Home');
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel the ride.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const status         = ride?.status ?? 'REQUESTED';
  const statusCfg      = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACCEPTED;
  const pickupLat      = ride?.pickupLat;
  const pickupLng      = ride?.pickupLng;
  const dropoffLat     = ride?.dropoffLat;
  const dropoffLng     = ride?.dropoffLng;
  const canCancel      = ['REQUESTED', 'ACCEPTED'].includes(status);
  const isActiveTrip   = ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(status);
  const backBtnTop     = insets.top + 14;
  const sheetPadBottom = insets.bottom + 12;

  const mapRegion = driverLocation
    ? { ...driverLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const sheetTranslate = sheetA.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Loading your ride...</Text>
      </View>
    );
  }

  // ── Not found state ─────────────────────────────────────────────────────────
  if (!ride) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.hint} />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Ride not found.</Text>
        <TouchableOpacity
          style={[s.goHomeBtn, { borderColor: theme.border }]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={[s.goHomeTxt, { color: theme.foreground }]}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── MAP ── */}
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
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.driverPin, { backgroundColor: statusCfg.color }]}>
              <Ionicons name="car" size={14} color="#080C18" />
            </View>
          </Marker>
        )}
        {pickupLat && (
          <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="radio-button-on" size={24} color={theme.accent} />
          </Marker>
        )}
        {dropoffLat && (
          <Marker coordinate={{ latitude: dropoffLat, longitude: dropoffLng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="location" size={28} color="#E05555" />
          </Marker>
        )}
        {pickupLat && dropoffLat && (
          <Polyline
            coordinates={[
              { latitude: pickupLat,  longitude: pickupLng  },
              { latitude: dropoffLat, longitude: dropoffLng },
            ]}
            strokeColor={theme.accent}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
        {driverLocation && pickupLat && ['ACCEPTED', 'ARRIVED'].includes(status) && (
          <Polyline
            coordinates={[
              driverLocation,
              { latitude: pickupLat, longitude: pickupLng },
            ]}
            strokeColor={statusCfg.color}
            strokeWidth={2}
            lineDashPattern={[4, 6]}
          />
        )}
      </MapView>

      {/* ── Top gradient ── */}
      <View style={s.topGradient} pointerEvents="none" />

      {/* ── Back button ── */}
      <TouchableOpacity
        style={[s.backBtn, {
          top:             backBtnTop,
          backgroundColor: theme.backgroundAlt + 'EE',
          borderColor:     theme.border,
        }]}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* ── Status pill ── */}
      <View style={[s.statusPill, {
        backgroundColor: statusCfg.color + '18',
        borderColor:     statusCfg.color + '50',
        bottom:          height * 0.46,
      }]}>
        <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        transform:       [{ translateY: sheetTranslate }],
      }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: sheetPadBottom }}
        >
          {/* Fare strip */}
          <View style={[s.fareStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>FARE</Text>
              <Text style={[s.fareValue, { color: theme.accent }]}>
                {'\u20A6'}{Number(ride.estimatedFare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>DISTANCE</Text>
              <Text style={[s.fareValue, { color: theme.foreground }]}>
                {ride.distance?.toFixed(1) ?? '—'} km
              </Text>
            </View>
            <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>PAYMENT</Text>
              <Text style={[s.fareValue, { color: theme.foreground }]}>CASH</Text>
            </View>
          </View>

          <DriverInfoCard ride={ride} theme={theme} />
          <RouteCard      ride={ride} theme={theme} />

          {/* Shield button */}
          {isActiveTrip && (
            <TouchableOpacity
              style={[s.shieldBtn, {
                backgroundColor: shieldActive ? '#4CAF5020' : '#4CAF5010',
                borderColor:     shieldActive ? '#4CAF50'   : '#4CAF5050',
              }]}
              onPress={() => navigation.navigate('Shield', { rideId: ride.id })}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
              <Text style={s.shieldBtnTxt}>
                {shieldActive ? '🛡️ SHIELD Active — Tap to manage' : 'Activate SHIELD Safety'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#4CAF50" />
            </TouchableOpacity>
          )}

          {/* Cancel button */}
          {canCancel && (
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: '#E05555' + '50' }]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator color="#E05555" size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color="#E05555" />
                  <Text style={s.cancelTxt}>Cancel Ride</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Post-trip button */}
          {(status === 'COMPLETED' || status === 'CANCELLED') && (
            <TouchableOpacity
              style={[s.homeBtn, { backgroundColor: theme.accent }]}
              onPress={() => {
                if (status === 'COMPLETED') {
                  navigation.navigate('RateRide', { rideId, driver: ride?.driver });
                } else {
                  navigation.navigate('Home');
                }
              }}
              activeOpacity={0.88}
            >
              <Ionicons
                name={status === 'COMPLETED' ? 'star-outline' : 'home-outline'}
                size={18}
                color={accentFg}
              />
              <Text style={[s.homeBtnTxt, { color: accentFg }]}>
                {status === 'COMPLETED' ? 'Rate Your Driver' : 'Back to Home'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },

  // Loading / not found
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt:   { fontSize: 14 },
  goHomeBtn:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goHomeTxt:   { fontSize: 14, fontWeight: '600' },

  // Map overlays
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backBtn:     { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  driverPin:   { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#080C18' },

  statusPill:    { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, zIndex: 10 },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },

  // Bottom sheet — uses maxHeight so map stays visible, ScrollView handles overflow
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    borderTopWidth:       1,
    paddingHorizontal:    20,
    paddingTop:           20,
    maxHeight:            height * 0.55,
    overflow:             'hidden',
  },

  // Fare strip
  fareStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  fareItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  fareLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:   { fontSize: 14, fontWeight: '900' },
  fareDivider: { width: 1 },

  // Shield
  shieldBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  shieldBtnTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#4CAF50' },

  // Cancel
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, marginBottom: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: '#E05555' },

  // Home / rate
  homeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginBottom: 8 },
  homeBtnTxt: { fontSize: 15, fontWeight: '800' },
});