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
import { rideAPI }           from '../../services/api';
import socketService         from '../../services/socket';

const { width, height } = Dimensions.get('window');

const TAB_BAR_HEIGHT = 60;
const SHEET_MIN      = 180;
const SHEET_DEFAULT  = Math.round(height * 0.50);
const SHEET_MAX      = Math.round(height * 0.82);
const DRAG_HANDLE_H  = 28;

// ── Renamed `step` key → `stageIndex` to avoid Hermes reserved-word crash ────
const STATUS_CONFIG = {
  REQUESTED:   { label: 'Finding your driver',  sublabel: 'Matching you with the best driver nearby', color: '#4E8DBD', icon: 'time-outline',             stageIndex: 0 },
  ACCEPTED:    { label: 'Driver on the way',    sublabel: 'Your driver is heading to pickup',          color: '#FFB800', icon: 'car-outline',              stageIndex: 1 },
  ARRIVED:     { label: 'Driver has arrived',   sublabel: 'Look for your driver at the pickup point',  color: '#A78BFA', icon: 'location-outline',         stageIndex: 2 },
  IN_PROGRESS: { label: 'Ride in progress',     sublabel: 'Sit back, you\'re on your way',             color: '#5DAA72', icon: 'navigate-outline',         stageIndex: 3 },
  COMPLETED:   { label: 'Ride completed',       sublabel: 'Hope you enjoyed the ride!',                color: '#5DAA72', icon: 'checkmark-circle-outline',  stageIndex: 4 },
  CANCELLED:   { label: 'Ride cancelled',       sublabel: 'This ride has been cancelled',              color: '#E05555', icon: 'close-circle-outline',      stageIndex: -1 },
};

const STEPS = ['Matched', 'En Route', 'Arrived', 'In Progress'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const goHome = (navigation) => navigation.getParent()?.navigate('HomeTab');

const callPhone = (phone) => {
  if (!phone) return;
  const cleaned = String(phone).replace(/\s+/g, '');
  const url     = `tel:${cleaned}`;
  Linking.canOpenURL(url)
    .then(ok => {
      if (ok) return Linking.openURL(url);
      Alert.alert('Cannot Call', 'Phone calls are not supported on this device.');
    })
    .catch(() => Alert.alert('Error', 'Could not initiate the call.'));
};

// ── ETACountdownRing ──────────────────────────────────────────────────────────
const ETACountdownRing = ({ etaMinutes, color }) => {
  const spinA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinA, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={era.wrap}>
      <Animated.View style={[era.ring, { borderColor: color, transform: [{ rotate }] }]} />
      <View style={era.inner}>
        <Text style={[era.minutes, { color }]}>{etaMinutes ?? '—'}</Text>
        <Text style={[era.label, { color }]}>min</Text>
      </View>
    </View>
  );
};
const era = StyleSheet.create({
  wrap:    { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  ring:    { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderStyle: 'dashed', borderTopColor: 'transparent' },
  inner:   { alignItems: 'center' },
  minutes: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  label:   { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
});

// ── StatusRail — prop renamed from `step` → `stageIndex` ─────────────────────
const StatusRail = ({ stageIndex, color, theme }) => (
  <View style={sr.wrap}>
    {STEPS.map((s, i) => {
      const active = i <= stageIndex;
      return (
        <React.Fragment key={s}>
          <View style={sr.item}>
            <View style={[sr.dot, {
              backgroundColor: active ? color : theme.border,
              borderColor:     active ? color : theme.border,
              transform:       [{ scale: i === stageIndex ? 1.3 : 1 }],
            }]}>
              {active && i < stageIndex && <Ionicons name="checkmark" size={8} color="#080C18" />}
            </View>
            <Text style={[sr.lbl, { color: active ? color : theme.hint, fontWeight: i === stageIndex ? '800' : '500' }]}>{s}</Text>
          </View>
          {i < STEPS.length - 1 && (
            <View style={[sr.line, { backgroundColor: i < stageIndex ? color : theme.border }]} />
          )}
        </React.Fragment>
      );
    })}
  </View>
);
const sr = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  item: { alignItems: 'center', gap: 4 },
  dot:  { width: 18, height: 18, borderRadius: 9, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  lbl:  { fontSize: 8, letterSpacing: 0.5 },
  line: { flex: 1, height: 2, marginBottom: 14, marginHorizontal: 2 },
});

// ── DriverHeroCard ────────────────────────────────────────────────────────────
const DriverHeroCard = ({ ride, theme, accentColor, accentFg }) => {
  const driver = ride?.driver;
  if (!driver) return null;
  const dp    = driver.driverProfile;
  const trust = dp?.totalRides ? Math.min(100, Math.round(50 + (dp.totalRides / 5))) : null;

  return (
    <View style={[dh.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={dh.leftCol}>
        <View style={[dh.avatarWrap, { borderColor: accentColor + '60' }]}>
          <View style={[dh.avatar, { backgroundColor: accentColor + '22' }]}>
            <Text style={[dh.initials, { color: accentColor }]}>
              {driver.firstName?.[0]}{driver.lastName?.[0]}
            </Text>
          </View>
        </View>
        {trust !== null && (
          <View style={[dh.trustBadge, { backgroundColor: '#5DAA7222', borderColor: '#5DAA7250' }]}>
            <Text style={dh.trustTxt}>{trust}% trust</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[dh.name, { color: theme.foreground }]}>
          {driver.firstName} {driver.lastName}
        </Text>
        {dp && (
          <Text style={[dh.vehicle, { color: theme.hint }]} numberOfLines={1}>
            {dp.vehicleColor} {dp.vehicleMake} {dp.vehicleModel}
          </Text>
        )}
        <View style={dh.metaRow}>
          {dp?.rating > 0 && (
            <View style={dh.metaChip}>
              <Ionicons name="star" size={10} color="#C9A96E" />
              <Text style={[dh.metaTxt, { color: '#C9A96E' }]}>{dp.rating.toFixed(1)}</Text>
            </View>
          )}
          {dp?.vehiclePlate && (
            <View style={[dh.plateBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[dh.plateTxt, { color: theme.foreground }]}>{dp.vehiclePlate}</Text>
            </View>
          )}
        </View>
      </View>

      {driver.phone && (
        <TouchableOpacity
          style={[dh.callBtn, { backgroundColor: accentColor, shadowColor: accentColor }]}
          onPress={() => callPhone(driver.phone)}
          activeOpacity={0.75}
        >
          <Ionicons name="call" size={18} color={accentFg} />
        </TouchableOpacity>
      )}
    </View>
  );
};
const dh = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  leftCol:     { alignItems: 'center', gap: 6 },
  avatarWrap:  { width: 54, height: 54, borderRadius: 27, borderWidth: 2, overflow: 'hidden', padding: 2 },
  avatar:      { flex: 1, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  initials:    { fontSize: 17, fontWeight: '900' },
  trustBadge:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  trustTxt:    { fontSize: 8, fontWeight: '800', color: '#5DAA72', letterSpacing: 0.3 },
  name:        { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  vehicle:     { fontSize: 11, marginBottom: 6 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt:     { fontSize: 11, fontWeight: '700' },
  plateBadge:  { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  plateTxt:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  callBtn:     { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RideTrackingScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const rideId          = route?.params?.rideId;
  const accentColor     = theme.accent;
  const accentFg        = theme.accentFg ?? (mode === 'dark' ? '#111111' : '#FFFFFF');

  const [ride,           setRide]           = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [cancelling,     setCancelling]     = useState(false);
  const [etaSeconds,     setEtaSeconds]     = useState(null);

  const mapRef          = useRef(null);
  const hasNavigatedRef = useRef(false);
  const etaTimerRef     = useRef(null);

  const sheetHeightAnim  = useRef(new Animated.Value(SHEET_DEFAULT)).current;
  const currentHeightRef = useRef(SHEET_DEFAULT);
  const startHeightRef   = useRef(SHEET_DEFAULT);

  const sheetPadBottom   = insets.bottom + 20;
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

  const statusPillBottom = useRef(
    sheetHeightAnim.interpolate({
      inputRange:  [0, SHEET_MIN, SHEET_MAX],
      outputRange: [TAB_BAR_HEIGHT + 10, TAB_BAR_HEIGHT + SHEET_MIN + 10, TAB_BAR_HEIGHT + SHEET_MAX + 10],
      extrapolate: 'clamp',
    })
  ).current;

  useEffect(() => {
    Animated.spring(sheetHeightAnim, { toValue: SHEET_DEFAULT, tension: 80, friction: 9, useNativeDriver: false })
      .start(() => { currentHeightRef.current = SHEET_DEFAULT; });
  }, []);

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
        const next = Math.max(SHEET_MIN, Math.min(SHEET_MAX, startHeightRef.current - gs.dy));
        sheetHeightAnim.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        const h    = startHeightRef.current - gs.dy;
        const mid1 = (SHEET_MIN + SHEET_DEFAULT) / 2;
        const mid2 = (SHEET_DEFAULT + SHEET_MAX) / 2;
        let target = h < mid1 ? SHEET_MIN : h < mid2 ? SHEET_DEFAULT : SHEET_MAX;
        if (gs.vy < -0.5) target = h > SHEET_DEFAULT ? SHEET_MAX : SHEET_DEFAULT;
        if (gs.vy >  0.5) target = h < SHEET_DEFAULT ? SHEET_MIN : SHEET_DEFAULT;
        Animated.spring(sheetHeightAnim, { toValue: target, tension: 120, friction: 14, useNativeDriver: false })
          .start(() => { currentHeightRef.current = target; });
      },
    })
  ).current;

  const startEtaTimer = useCallback((minutes) => {
    clearInterval(etaTimerRef.current);
    if (!minutes) return;
    setEtaSeconds(minutes * 60);
    etaTimerRef.current = setInterval(() => {
      setEtaSeconds(s => {
        if (s <= 1) { clearInterval(etaTimerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearInterval(etaTimerRef.current), []);

  const loadRide = useCallback(async () => {
    try {
      const res = rideId ? await rideAPI.getRideById(rideId) : await rideAPI.getActiveRide();
      const r   = res?.data?.ride ?? res?.ride ?? null;
      setRide(r);
      if (r?.driver?.driverProfile?.currentLat) {
        setDriverLocation({
          latitude:  r.driver.driverProfile.currentLat,
          longitude: r.driver.driverProfile.currentLng,
        });
      }
      if (r?.etaMinutes) startEtaTimer(r.etaMinutes);
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
      if (data.etaMinutes) startEtaTimer(data.etaMinutes);
      if (data.status === 'COMPLETED') {
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;
        setTimeout(() => navigation.navigate('RateRide', { rideId, driver: data.driver }), 500);
      }
      if (data.status === 'CANCELLED') {
        Alert.alert('Ride Cancelled', 'Your ride was cancelled.', [
          { text: 'OK', onPress: () => goHome(navigation) },
        ]);
      }
    };
    const handleDriverLoc = (data) => {
      const loc = { latitude: data.lat, longitude: data.lng };
      setDriverLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
    };

    socketService.on('ride:status:update',     handleStatus);
    socketService.on('ride:cancelled',         ({ rideId: id }) => {
      if (id !== rideId) return;
      Alert.alert('Ride Cancelled', 'Your ride was cancelled.', [{ text: 'OK', onPress: () => goHome(navigation) }]);
    });
    socketService.on('driver:location:update', handleDriverLoc);
    return () => {
      socketService.off('ride:status:update',     handleStatus);
      socketService.off('ride:cancelled',         () => {});
      socketService.off('driver:location:update', handleDriverLoc);
      if (rideId) socketService.leaveRide(rideId);
    };
  }, [rideId]);

const handleCancel = () => {
  if (!ride?.id) {
    Alert.alert('Error', 'No active ride found.');
    return;
  }
  Alert.alert('Cancel Ride?', 'Are you sure you want to cancel?', [
    { text: 'Keep Ride', style: 'cancel' },
    {
      text: 'Cancel Ride', style: 'destructive',
      onPress: async () => {
        setCancelling(true);
        try {
          await rideAPI.cancelRide(ride.id, { reason: 'Customer cancelled from tracking screen' });
          goHome(navigation);
        } catch (err) {
          const msg = err?.response?.data?.message ?? err?.data?.message ?? err?.message ?? 'Could not cancel.';
          Alert.alert('Error', msg);
        } finally { setCancelling(false); }
      },
    },
  ]);
};

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

  const etaMinutesDisplay = etaSeconds !== null ? Math.ceil(etaSeconds / 60) : ride?.etaMinutes ?? null;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <ActivityIndicator color={accentColor} size="large" />
        <Text style={[s.centerTxt, { color: '#666' }]}>Loading your ride...</Text>
      </View>
    );
  }
  if (!ride) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <Ionicons name="alert-circle-outline" size={40} color="#555" />
        <Text style={[s.centerTxt, { color: '#666' }]}>Ride not found.</Text>
        <TouchableOpacity style={[s.goHomeBtn, { borderColor: '#333' }]} onPress={() => goHome(navigation)}>
          <Text style={[s.goHomeTxt, { color: '#ccc' }]}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 1 }} pinColor={statusCfg.color} />
        )}
        {pickupLat && (
          <Marker
            coordinate={{ latitude: pickupLat, longitude: pickupLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor={accentColor}
          />
        )}
        {dropoffLat && (
          <Marker
            coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor="#E05555"
          />
        )}
        {pickupLat && dropoffLat && (
          <Polyline
            coordinates={[
              { latitude: pickupLat,  longitude: pickupLng  },
              { latitude: dropoffLat, longitude: dropoffLng },
            ]}
            strokeColor={accentColor} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {driverLocation && pickupLat && ['ACCEPTED', 'ARRIVED'].includes(status) && (
          <Polyline
            coordinates={[driverLocation, { latitude: pickupLat, longitude: pickupLng }]}
            strokeColor={statusCfg.color} strokeWidth={2.5} lineDashPattern={[5, 7]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backBtn, { top: backBtnTop }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      <Animated.View style={[s.statusPill, {
        backgroundColor: statusCfg.color + '20',
        borderColor:     statusCfg.color + '60',
        bottom:          statusPillBottom,
      }]}>
        <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        {etaMinutesDisplay !== null && ['ACCEPTED', 'ARRIVED'].includes(status) && (
          <View style={[s.etaChip, { backgroundColor: statusCfg.color }]}>
            <Text style={s.etaChipTxt}>{etaMinutesDisplay} min</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        height:          sheetHeightAnim,
        bottom:          TAB_BAR_HEIGHT,
      }]}>
        <View style={s.dragHandleWrap} {...panResponder.panHandlers}>
          <View style={[s.dragHandle, { backgroundColor: theme.border }]} />
        </View>

        <Animated.View style={{ height: scrollHeightAnim, overflow: 'hidden' }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusTitle, { color: theme.foreground }]}>{statusCfg.label}</Text>
                <Text style={[s.statusSub, { color: theme.hint }]}>{statusCfg.sublabel}</Text>
                <View style={{ marginTop: 12 }}>
                  {/* stageIndex replaces step prop to avoid Hermes crash */}
                  <StatusRail stageIndex={statusCfg.stageIndex} color={statusCfg.color} theme={theme} />
                </View>
              </View>
              {['ACCEPTED', 'ARRIVED'].includes(status) && (
                <ETACountdownRing etaMinutes={etaMinutesDisplay} color={statusCfg.color} />
              )}
            </View>

            <View style={[s.fareStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.fareItem}>
                <Text style={[s.fareLabel, { color: theme.hint }]}>FARE</Text>
                <Text style={[s.fareValue, { color: accentColor }]}>
                  ₦{Number(ride.estimatedFare ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
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
                <Text style={[s.fareValue, { color: theme.foreground }]}>
                  {ride.paymentMethod ?? 'CASH'}
                </Text>
              </View>
            </View>

            <DriverHeroCard ride={ride} theme={theme} accentColor={accentColor} accentFg={accentFg} />
            <RouteCard ride={ride} theme={theme} />

            <View style={[s.safetyChip, { backgroundColor: '#5DAA7212', borderColor: '#5DAA7230' }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#5DAA72" />
              <Text style={[s.safetyTxt, { color: '#5DAA72' }]}>
                Share ride details with a trusted contact for safety
              </Text>
            </View>

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
                style={[s.homeBtn, { backgroundColor: accentColor }]}
                onPress={() => {
                  if (status === 'COMPLETED') navigation.navigate('RateRide', { rideId, driver: ride?.driver });
                  else goHome(navigation);
                }}
                activeOpacity={0.88}
              >
                <Ionicons name={status === 'COMPLETED' ? 'star-outline' : 'home-outline'} size={18} color={accentFg} />
                <Text style={[s.homeBtnTxt, { color: accentFg }]}>
                  {status === 'COMPLETED' ? 'Rate Your Driver' : 'Back to Home'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#080C18' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt: { fontSize: 14 },
  goHomeBtn: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goHomeTxt: { fontSize: 14, fontWeight: '600' },

  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 130, backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn: {
    position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, zIndex: 99,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },

  statusPill:    { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, zIndex: 10 },
  statusDot:     { width: 7, height: 7, borderRadius: 3.5 },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },
  etaChip:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 2 },
  etaChipTxt:    { fontSize: 10, fontWeight: '900', color: '#080C18' },

  sheet: {
    position: 'absolute', left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 24,
  },
  dragHandleWrap: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  dragHandle:     { width: 44, height: 4, borderRadius: 2 },
  scrollContent:  { paddingHorizontal: 20 },

  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  statusTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3 },
  statusSub:   { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  fareStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  fareItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  fareLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:   { fontSize: 14, fontWeight: '900' },
  fareDivider: { width: 1 },

  safetyChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14 },
  safetyTxt:  { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 16 },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, marginBottom: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: '#E05555' },
  homeBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginBottom: 8 },
  homeBtnTxt:{ fontSize: 15, fontWeight: '800' },
});