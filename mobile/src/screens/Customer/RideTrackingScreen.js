// mobile/src/screens/Customer/RideTrackingScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  PanResponder, Linking,
} from 'react-native';
import MapView, { Marker, Polyline } from '../../components/SmartMapView';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI/*, shieldAPI*/ } from '../../services/api';
import socketService          from '../../services/socket';

const { height } = Dimensions.get('window');

// ── Tab bar offset ────────────────────────────────────────────────────────────
const TAB_BAR_HEIGHT = 60;

// ── Sheet snap heights ────────────────────────────────────────────────────────
const SHEET_MIN     = 160;
const SHEET_DEFAULT = Math.round(height * 0.50);
const SHEET_MAX     = Math.round(height * 0.82);

// ── Fixed internal layout heights ────────────────────────────────────────────
// DRAG_HANDLE_H = paddingVertical (12 * 2) + handle bar (4) = 28
// These are subtracted from the animated sheet height to give the ScrollView
// a concrete pixel boundary — same bounded-container pattern as ActiveRideScreen.
const DRAG_HANDLE_H = 28;

const STATUS_CONFIG = {
  REQUESTED:   { label: 'Finding your driver...',  color: '#4E8DBD', icon: 'time-outline'             },
  ACCEPTED:    { label: 'Driver is on the way',    color: '#FFB800', icon: 'car-outline'              },
  ARRIVED:     { label: 'Driver has arrived!',     color: '#A78BFA', icon: 'location-outline'         },
  IN_PROGRESS: { label: 'Ride in progress',        color: '#5DAA72', icon: 'navigate-outline'         },
  COMPLETED:   { label: 'Ride completed!',         color: '#5DAA72', icon: 'checkmark-circle-outline' },
  CANCELLED:   { label: 'Ride cancelled',          color: '#E05555', icon: 'close-circle-outline'     },
};

// ── Phone helper ──────────────────────────────────────────────────────────────
const callPhone = (phone) => {
  if (!phone) return;
  const url = `tel:${String(phone).replace(/\s+/g, '')}`;
  Linking.canOpenURL(url)
    .then(ok => {
      if (ok) Linking.openURL(url);
      else Alert.alert('Cannot Call', 'Phone calls are not supported on this device.');
    })
    .catch(() => Alert.alert('Error', 'Could not initiate the call.'));
};

// ── DriverInfoCard ─────────────────────────────────────────────────────────────
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
        <TouchableOpacity
          style={[di.callBtn, { backgroundColor: accent + '18', borderColor: accent + '40' }]}
          onPress={() => callPhone(driver.phone)}
          activeOpacity={0.75}
        >
          <Ionicons name="call" size={17} color={accent} />
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

  const mapRef          = useRef(null);
  const hasNavigatedRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // ONE Animated.Value, useNativeDriver: false throughout.
  // sheetHeightAnim starts at 0 and springs to SHEET_DEFAULT on mount.
  // ─────────────────────────────────────────────────────────────────────────────
  const sheetHeightAnim  = useRef(new Animated.Value(0)).current;
  const currentHeightRef = useRef(0);
  const startHeightRef   = useRef(0);

  // ── Memoized interpolations — created ONCE, never recreated on re-render ──
  // statusPillBottom tracks the top of the sheet so the pill always floats
  // just above it, regardless of which snap the user has dragged to.
  const statusPillBottom = useRef(
    sheetHeightAnim.interpolate({
      inputRange:  [0, SHEET_MIN, SHEET_MAX],
      outputRange: [
        TAB_BAR_HEIGHT + 10,
        TAB_BAR_HEIGHT + SHEET_MIN + 10,
        TAB_BAR_HEIGHT + SHEET_MAX + 10,
      ],
      extrapolate: 'clamp',
    })
  ).current;

  // ── scrollHeightAnim: concrete pixel height for the ScrollView wrapper ────
  // Subtracts the drag handle and bottom safe area so the ScrollView always
  // has an exact boundary — mirrors ActiveRideScreen's scrollHeightAnim.
  const sheetPadBottom  = insets.bottom + 20;
  const scrollHeightAnim = useRef(
    sheetHeightAnim.interpolate({
      inputRange:  [SHEET_MIN, SHEET_DEFAULT, SHEET_MAX],
      outputRange: [
        SHEET_MIN     - DRAG_HANDLE_H - sheetPadBottom,
        SHEET_DEFAULT - DRAG_HANDLE_H - sheetPadBottom,
        SHEET_MAX     - DRAG_HANDLE_H - sheetPadBottom,
      ],
      extrapolate: 'clamp',
    })
  ).current;

  // ── Entrance animation ────────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(sheetHeightAnim, {
      toValue:         SHEET_DEFAULT,
      tension:         80,
      friction:        9,
      useNativeDriver: false,   // height is a layout prop — JS driver required
    }).start(() => { currentHeightRef.current = SHEET_DEFAULT; });
  }, []);

  // ── PanResponder (attached to drag handle only) ───────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        sheetHeightAnim.stopAnimation((val) => {
          currentHeightRef.current = val;
          startHeightRef.current   = val;
        });
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(SHEET_MIN, Math.min(SHEET_MAX,
          startHeightRef.current - gs.dy));
        sheetHeightAnim.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        const h    = startHeightRef.current - gs.dy;
        const mid1 = (SHEET_MIN + SHEET_DEFAULT) / 2;
        const mid2 = (SHEET_DEFAULT + SHEET_MAX) / 2;
        let target;
        if      (gs.vy < -0.5) target = h > SHEET_DEFAULT ? SHEET_MAX : SHEET_DEFAULT;
        else if (gs.vy >  0.5) target = h < SHEET_DEFAULT ? SHEET_MIN : SHEET_DEFAULT;
        else                   target = h < mid1 ? SHEET_MIN : h < mid2 ? SHEET_DEFAULT : SHEET_MAX;
        Animated.spring(sheetHeightAnim, {
          toValue: target, tension: 120, friction: 14, useNativeDriver: false,
        }).start(() => { currentHeightRef.current = target; });
      },
    })
  ).current;

  // ── Load ride ─────────────────────────────────────────────────────────────
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
      if (r?.id) socketService.joinRide(r.id);
    } catch (err) {
      console.error('[RideTracking] loadRide:', err?.message);
    } finally { setLoading(false); }
  }, [rideId]);

  useEffect(() => {
    loadRide();

    const handleStatus = (data) => {
      if (!data.rideId || data.rideId !== rideId) return;
      setRide(prev => prev ? { ...prev, status: data.status, driver: data.driver ?? prev.driver } : prev);
      if (data.status === 'COMPLETED') {
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;
        setTimeout(() => navigation.navigate('RateRide', { rideId, driver: data.driver }), 500);
      }
      if (data.status === 'CANCELLED') {
        Alert.alert('Ride Cancelled', 'Your ride was cancelled.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ]);
      }
    };
    const handleCancelled = (data) => {
      if (data.rideId !== rideId) return;
      Alert.alert('Ride Cancelled', 'Your ride was cancelled.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    };
    const handleDriverLoc = (data) => {
      const loc = { latitude: data.lat, longitude: data.lng };
      setDriverLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
    };

    socketService.on('ride:status:update',     handleStatus);
    socketService.on('ride:cancelled',         handleCancelled);
    socketService.on('driver:location:update', handleDriverLoc);
    return () => {
      socketService.off('ride:status:update',     handleStatus);
      socketService.off('ride:cancelled',         handleCancelled);
      socketService.off('driver:location:update', handleDriverLoc);
      if (rideId) socketService.leaveRide(rideId);
    };
  }, [rideId]);

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert('Cancel Ride?', 'Are you sure you want to cancel this ride?', [
      { text: 'Keep Ride', style: 'cancel' },
      {
        text: 'Cancel Ride', style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await rideAPI.cancelRide(rideId, { reason: 'Customer cancelled from tracking screen' });
            navigation.navigate('Home');
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel the ride.');
          } finally { setCancelling(false); }
        },
      },
    ]);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const status     = ride?.status ?? 'REQUESTED';
  const statusCfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACCEPTED;
  const pickupLat  = ride?.pickupLat;
  const pickupLng  = ride?.pickupLng;
  const dropoffLat = ride?.dropoffLat;
  const dropoffLng = ride?.dropoffLng;
  const canCancel  = ['REQUESTED', 'ACCEPTED'].includes(status);
  const backBtnTop = insets.top + 14;

  const mapRegion = driverLocation
    ? { ...driverLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Loading your ride...</Text>
      </View>
    );
  }
  if (!ride) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.hint} />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Ride not found.</Text>
        <TouchableOpacity style={[s.goHomeBtn, { borderColor: theme.border }]} onPress={() => navigation.navigate('Home')}>
          <Text style={[s.goHomeTxt, { color: theme.foreground }]}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
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
            strokeColor={theme.accent} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {driverLocation && pickupLat && ['ACCEPTED', 'ARRIVED'].includes(status) && (
          <Polyline
            coordinates={[driverLocation, { latitude: pickupLat, longitude: pickupLng }]}
            strokeColor={statusCfg.color} strokeWidth={2} lineDashPattern={[4, 6]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      {/* ── Back button ── */}
      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* ── Status pill — bottom driven by memoized JS interpolation ── */}
      <Animated.View style={[s.statusPill, {
        backgroundColor: statusCfg.color + '18',
        borderColor:     statusCfg.color + '50',
        bottom:          statusPillBottom,
      }]}>
        <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </Animated.View>

      {/* ── Bottom sheet — height animated with JS driver only ── */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        height:          sheetHeightAnim,
        bottom:          TAB_BAR_HEIGHT,
      }]}>
        {/* Drag handle — PanResponder lives here only */}
        <View style={s.dragHandleWrap} {...panResponder.panHandlers}>
          <View style={[s.dragHandle, { backgroundColor: theme.border }]} />
        </View>

        {/* ── Bounded scroll area: Animated.View with interpolated height gives
             the ScrollView a concrete pixel boundary at every snap position.
             Mirrors ActiveRideScreen's scrollHeightAnim pattern exactly. ── */}
        <Animated.View style={{ height: scrollHeightAnim, overflow: 'hidden' }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
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

            {/* ── Uncomment when Shield is ready to launch ──────────────────────
            {isActiveTrip && (
              <TouchableOpacity style={[s.shieldBtn, { ... }]}
                onPress={() => navigation.navigate('Shield', { rideId: ride.id })}>
                ...
              </TouchableOpacity>
            )}
            ─────────────────────────────────────────────────────────────────── */}

            {canCancel && (
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: '#E05555' + '50' }]}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.8}
              >
                {cancelling ? <ActivityIndicator color="#E05555" size="small" /> : (
                  <>
                    <Ionicons name="close-circle-outline" size={16} color="#E05555" />
                    <Text style={s.cancelTxt}>Cancel Ride</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {(status === 'COMPLETED' || status === 'CANCELLED') && (
              <TouchableOpacity
                style={[s.homeBtn, { backgroundColor: theme.accent }]}
                onPress={() => {
                  if (status === 'COMPLETED') navigation.navigate('RateRide', { rideId, driver: ride?.driver });
                  else                        navigation.navigate('Home');
                }}
                activeOpacity={0.88}
              >
                <Ionicons
                  name={status === 'COMPLETED' ? 'star-outline' : 'home-outline'}
                  size={18} color={accentFg}
                />
                <Text style={[s.homeBtnTxt, { color: accentFg }]}>
                  {status === 'COMPLETED' ? 'Rate Your Driver' : 'Back to Home'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Bottom spacer so last card clears the sheet's rounded corners */}
            <View style={{ height: 16 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt: { fontSize: 14 },
  goHomeBtn: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goHomeTxt: { fontSize: 14, fontWeight: '600' },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backBtn:     { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  driverPin:   { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#080C18' },

  statusPill:    { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, zIndex: 10 },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },

  // Sheet: animated height (JS driver), positioned above tab bar
  sheet: {
    position:             'absolute',
    left:                 0,
    right:                0,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    borderTopWidth:       1,
    overflow:             'hidden',
  },

  dragHandleWrap: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  dragHandle:     { width: 44, height: 4, borderRadius: 2 },

  // scrollContent has no paddingBottom — the scrollHeightAnim wrapper
  // already accounts for safe area, so content fills cleanly to the edge.
  scrollContent: { paddingHorizontal: 20 },

  fareStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  fareItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  fareLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:   { fontSize: 14, fontWeight: '900' },
  fareDivider: { width: 1 },

  shieldBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  shieldBtnTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#4CAF50' },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, marginBottom: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: '#E05555' },

  homeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginBottom: 8 },
  homeBtnTxt: { fontSize: 15, fontWeight: '800' },
});