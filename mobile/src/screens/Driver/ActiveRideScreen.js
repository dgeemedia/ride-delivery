// mobile/src/screens/Driver/ActiveRideScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  Platform, PanResponder, Linking,
} from 'react-native';
import MapView, { Marker, Polyline } from '../../components/SmartMapView';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI }           from '../../services/api';
import socketService         from '../../services/socket';
import * as Location         from '../../shims/Location';

const { height } = Dimensions.get('window');

const DA             = '#FFB800';
const TAB_BAR_HEIGHT = 60;
const SHEET_MIN      = 180;
const SHEET_DEFAULT  = Math.round(height * 0.52);
const SHEET_MAX      = Math.round(height * 0.84);
const DRAG_HANDLE_H  = 28;
const ACTION_H       = 8 + 54;

const STATUS_CONFIG = {
  ACCEPTED:    { label: 'Head to Pickup',   sublabel: 'Navigate to the pickup point', color: DA,        icon: 'navigate-outline'         },
  ARRIVED:     { label: 'Arrived',          sublabel: 'Let the customer know you\'ve arrived', color: '#A78BFA', icon: 'location-outline'  },
  IN_PROGRESS: { label: 'Ride in Progress', sublabel: 'Drive safely to the destination', color: '#5DAA72', icon: 'car-sport-outline'      },
  COMPLETED:   { label: 'Completed',        sublabel: 'Great job! Ride completed successfully', color: '#5DAA72', icon: 'checkmark-circle-outline' },
  CANCELLED:   { label: 'Cancelled',        sublabel: 'This ride has been cancelled', color: '#E05555', icon: 'close-circle-outline'      },
};

const callPhone = (phone) => {
  if (!phone) return;
  const url = `tel:${String(phone).replace(/\s+/g, '')}`;
  Linking.canOpenURL(url)
    .then(ok => {
      if (ok) return Linking.openURL(url);
      Alert.alert('Cannot Call', 'Phone calls are not supported on this device.');
    })
    .catch(() => Alert.alert('Error', 'Could not initiate the call.'));
};

// ── ArrivalGlow — pulsing halo shown when driver has ARRIVED ─────────────────
const ArrivalGlow = ({ color }) => {
  const glowA = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowA, { toValue: 1,   duration: 800, useNativeDriver: true }),
      Animated.timing(glowA, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[ag.ring, { borderColor: color, opacity: glowA }]} pointerEvents="none" />
  );
};
const ag = StyleSheet.create({
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, top: -24, left: -24, right: -24, bottom: -24 },
});

// ── CustomerHeroCard ──────────────────────────────────────────────────────────
const CustomerHeroCard = ({ ride, theme, statusColor }) => {
  const c = ride?.customer;
  if (!c) return null;

  const totalRides = c.totalRides ?? 0;
  const trustLevel = totalRides > 20 ? 'Frequent' : totalRides > 5 ? 'Regular' : 'New';
  const trustColor = totalRides > 20 ? '#5DAA72' : totalRides > 5 ? DA : '#A78BFA';

  return (
    <View style={[ch.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      {/* Avatar */}
      <View style={{ position: 'relative' }}>
        <View style={[ch.avatarWrap, { borderColor: statusColor + '60' }]}>
          <View style={[ch.avatar, { backgroundColor: DA + '22' }]}>
            <Text style={[ch.initials, { color: DA }]}>
              {c.firstName?.[0]}{c.lastName?.[0]}
            </Text>
          </View>
        </View>
        {/* Trust badge on avatar */}
        <View style={[ch.trustDot, { backgroundColor: trustColor }]} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={[ch.name, { color: theme.foreground }]}>{c.firstName} {c.lastName}</Text>
        {c.phone && (
          <Text style={[ch.phone, { color: theme.hint }]}>{c.phone}</Text>
        )}
        <View style={ch.metaRow}>
          <View style={[ch.trustBadge, { backgroundColor: trustColor + '18', borderColor: trustColor + '40' }]}>
            <Text style={[ch.trustTxt, { color: trustColor }]}>{trustLevel} Rider</Text>
          </View>
          {totalRides > 0 && (
            <Text style={[ch.rides, { color: theme.hint }]}>{totalRides} rides</Text>
          )}
        </View>
      </View>

      {/* Call button */}
      {c.phone && (
        <TouchableOpacity
          style={[ch.callBtn, { backgroundColor: DA, shadowColor: DA }]}
          onPress={() => callPhone(c.phone)}
          activeOpacity={0.75}
        >
          <Ionicons name="call" size={18} color="#080C18" />
        </TouchableOpacity>
      )}
    </View>
  );
};
const ch = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  avatarWrap:{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden', padding: 2, position: 'relative' },
  avatar:    { flex: 1, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  initials:  { fontSize: 17, fontWeight: '900' },
  trustDot:  { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#080C18' },
  name:      { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  phone:     { fontSize: 11, marginBottom: 5 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustBadge:{ borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  trustTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  rides:     { fontSize: 10 },
  callBtn:   { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});

// ── RouteCard ─────────────────────────────────────────────────────────────────
const RouteCard = ({ ride, status, theme }) => {
  const atPickup = ['ACCEPTED', 'ARRIVED'].includes(status);
  return (
    <View style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={rc.row}>
        <View style={[rc.dot, { backgroundColor: atPickup ? DA : DA + '40' }]} />
        <View style={{ flex: 1 }}>
          <Text style={[rc.lbl, { color: theme.hint }]}>PICKUP</Text>
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{ride.pickupAddress}</Text>
        </View>
        {atPickup && <View style={[rc.activeChip, { backgroundColor: DA }]}><Text style={rc.activeChipTxt}>NEXT</Text></View>}
      </View>
      <View style={[rc.line, { backgroundColor: theme.border }]} />
      <View style={rc.row}>
        <View style={[rc.dot, { backgroundColor: !atPickup ? '#E05555' : '#E05555' + '40' }]} />
        <View style={{ flex: 1 }}>
          <Text style={[rc.lbl, { color: theme.hint }]}>DROP-OFF</Text>
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{ride.dropoffAddress}</Text>
        </View>
        {!atPickup && status === 'IN_PROGRESS' && (
          <View style={[rc.activeChip, { backgroundColor: '#E05555' }]}><Text style={rc.activeChipTxt}>NEXT</Text></View>
        )}
      </View>
    </View>
  );
};
const rc = StyleSheet.create({
  card:         { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  row:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot:          { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  line:         { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 3 },
  lbl:          { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr:         { fontSize: 13, fontWeight: '600', lineHeight: 18, flex: 1 },
  activeChip:   { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  activeChipTxt:{ fontSize: 9, fontWeight: '900', color: '#080C18' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ActiveRideScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const rideId    = route?.params?.rideId;

  const [ride,    setRide]    = useState(null);
  const [myLoc,   setMyLoc]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);
  const [speed,   setSpeed]   = useState(null); // km/h

  const mapRef = useRef(null);

  const sheetHeightAnim  = useRef(new Animated.Value(SHEET_DEFAULT)).current;
  const currentHeightRef = useRef(SHEET_DEFAULT);
  const startHeightRef   = useRef(SHEET_DEFAULT);

  const sheetPadBottom = insets.bottom + 16;
  const scrollHeightAnim = useRef(
    sheetHeightAnim.interpolate({
      inputRange:  [SHEET_MIN, SHEET_DEFAULT, SHEET_MAX],
      outputRange: [
        SHEET_MIN     - DRAG_HANDLE_H - ACTION_H - sheetPadBottom,
        SHEET_DEFAULT - DRAG_HANDLE_H - ACTION_H - sheetPadBottom,
        SHEET_MAX     - DRAG_HANDLE_H - ACTION_H - sheetPadBottom,
      ],
      extrapolate: 'clamp',
    })
  ).current;

  const statusPillBottom = useRef(
    sheetHeightAnim.interpolate({
      inputRange:  [0, SHEET_MIN, SHEET_MAX],
      outputRange: [TAB_BAR_HEIGHT + 12, TAB_BAR_HEIGHT + SHEET_MIN + 12, TAB_BAR_HEIGHT + SHEET_MAX + 12],
      extrapolate: 'clamp',
    })
  ).current;

  const goToDashboard = useCallback(() => navigation.popToTop(), [navigation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onMoveShouldSetPanResponder:         (_, gs) => Math.abs(gs.dy) > 3,
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

  const loadRide = useCallback(async () => {
    try {
      const res        = await rideAPI.getActiveRide();
      const loadedRide = res?.data?.ride ?? res?.ride ?? null;
      setRide(loadedRide);
    } catch (err) {
      console.error('[ActiveRide] loadRide error:', err?.message);
    } finally { setLoading(false); }
  }, [rideId]);

  useEffect(() => {
    loadRide();
    Animated.spring(sheetHeightAnim, { toValue: SHEET_DEFAULT, tension: 80, friction: 9, useNativeDriver: false })
      .start(() => { currentHeightRef.current = SHEET_DEFAULT; });

    let locationWatcher = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc    = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setMyLoc(coords);
          socketService.updateLocation(coords);

          locationWatcher = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
            ({ coords: c }) => {
              const loc2 = { latitude: c.latitude, longitude: c.longitude };
              setMyLoc(loc2);
              socketService.updateLocation(loc2);
              // Speed in km/h from m/s
              if (c.speed != null && c.speed >= 0) {
                setSpeed(Math.round(c.speed * 3.6));
              }
            }
          );
        }
      } catch {}
    })();

    const handleCancelled = (data) => {
      if (data.rideId !== rideId) return;
      Alert.alert('Ride Cancelled', 'The customer has cancelled this ride.', [
        { text: 'OK', onPress: goToDashboard },
      ]);
    };
    const handleStatus = (data) => {
      if (data.rideId !== rideId) return;
      setRide(prev => prev ? { ...prev, status: data.status } : prev);
      if (data.status === 'CANCELLED') handleCancelled(data);
    };

    socketService.on('ride:status:update', handleStatus);
    socketService.on('ride:cancelled',     handleCancelled);
    return () => {
      socketService.off('ride:status:update', handleStatus);
      socketService.off('ride:cancelled',     handleCancelled);
      locationWatcher?.remove?.();
    };
  }, [rideId]);

  const handleArrive = async () => {
    setActing(true);
    try {
      await rideAPI.arrivedAtPickup(ride.id);
      setRide(prev => ({ ...prev, status: 'ARRIVED' }));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not update status.');
    } finally { setActing(false); }
  };

  const handleStart = async () => {
    setActing(true);
    try {
      const res     = await rideAPI.startRide(ride.id);
      const updated = res?.data?.ride ?? res?.ride;
      setRide(prev => ({ ...prev, status: 'IN_PROGRESS', ...(updated || {}) }));
      if (ride.pickupLat && ride.dropoffLat) {
        setTimeout(() => mapRef.current?.fitToCoordinates(
          [
            { latitude: ride.pickupLat,  longitude: ride.pickupLng  },
            { latitude: ride.dropoffLat, longitude: ride.dropoffLng },
          ],
          { edgePadding: { top: 80, right: 60, bottom: 420, left: 60 }, animated: true }
        ), 400);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not start ride.');
    } finally { setActing(false); }
  };

  const handleComplete = () => {
    const doComplete = async () => {
      setActing(true);
      try {
        await rideAPI.completeRide(ride.id, { paymentMethod: 'CASH' });
        goToDashboard();
      } catch (err) {
        Alert.alert('Error', err?.response?.data?.message ?? 'Could not complete ride.');
      } finally { setActing(false); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Mark this ride as completed?')) doComplete();
    } else {
      Alert.alert('Complete Ride', 'Mark this ride as completed?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: doComplete },
      ]);
    }
  };

  const status    = ride?.status ?? 'ACCEPTED';
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACCEPTED;
  const pickupLat = ride?.pickupLat;
  const pickupLng = ride?.pickupLng;
  const dropoffLat= ride?.dropoffLat;
  const dropoffLng= ride?.dropoffLng;

  const mapRegion = myLoc
    ? { latitude: myLoc.latitude, longitude: myLoc.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const backBtnTop = insets.top + 14;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <ActivityIndicator color={DA} size="large" />
        <Text style={[s.centerTxt, { color: '#666' }]}>Loading ride...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <Ionicons name="alert-circle-outline" size={40} color="#555" />
        <Text style={[s.centerTxt, { color: '#666' }]}>No active ride found.</Text>
        <TouchableOpacity onPress={goToDashboard} style={[s.goBackBtn, { borderColor: '#333' }]}>
          <Text style={[s.goBackTxt, { color: '#ccc' }]}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── MAP — same SmartMapView import as RequestRideScreen ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Driver's own position */}
        {myLoc && (
          <Marker coordinate={myLoc} anchor={{ x: 0.5, y: 0.5 }} pinColor={DA} />
        )}
        {/* Pickup */}
        {pickupLat && (
          <Marker
            coordinate={{ latitude: pickupLat, longitude: pickupLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor={DA}
          />
        )}
        {/* Dropoff */}
        {dropoffLat && (
          <Marker
            coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor="#E05555"
          />
        )}
        {/* Full route */}
        {pickupLat && dropoffLat && (
          <Polyline
            coordinates={[
              { latitude: pickupLat,  longitude: pickupLng  },
              { latitude: dropoffLat, longitude: dropoffLng },
            ]}
            strokeColor={DA} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {/* Driver-to-pickup line */}
        {myLoc && pickupLat && ['ACCEPTED', 'ARRIVED'].includes(status) && (
          <Polyline
            coordinates={[myLoc, { latitude: pickupLat, longitude: pickupLng }]}
            strokeColor={statusCfg.color} strokeWidth={2.5} lineDashPattern={[5, 7]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backNav, { top: backBtnTop }]}
        onPress={goToDashboard}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Speed chip — shown during IN_PROGRESS (Uber-style) */}
      {status === 'IN_PROGRESS' && speed !== null && (
        <View style={[s.speedChip, { top: backBtnTop, right: 20, borderColor: statusCfg.color + '40' }]}>
          <Text style={[s.speedVal, { color: statusCfg.color }]}>{speed}</Text>
          <Text style={[s.speedUnit, { color: statusCfg.color }]}>km/h</Text>
        </View>
      )}

      {/* Status pill */}
      <Animated.View style={[s.statusPill, {
        backgroundColor: statusCfg.color + '20',
        borderColor:     statusCfg.color + '60',
        bottom:          statusPillBottom,
      }]}>
        <View style={[s.statusDot, { backgroundColor: statusCfg.color }]} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </Animated.View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        height:          sheetHeightAnim,
        bottom:          TAB_BAR_HEIGHT,
      }]}>
        <View style={s.dragHandleArea} {...panResponder.panHandlers}>
          <View style={[s.dragHandle, { backgroundColor: theme.border }]} />
        </View>

        <Animated.View style={{ height: scrollHeightAnim, overflow: 'hidden' }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

            {/* Status header */}
            <View style={s.sheetHeader}>
              <Text style={[s.statusTitle, { color: theme.foreground }]}>{statusCfg.label}</Text>
              <Text style={[s.statusSub, { color: theme.hint }]}>{statusCfg.sublabel}</Text>
            </View>

            {/* Fare strip */}
            <View style={[s.fareStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.fareItem}>
                <Text style={[s.fareLabel, { color: theme.hint }]}>FARE</Text>
                <Text style={[s.fareValue, { color: DA }]}>
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

            {/* Customer hero card with call button */}
            <CustomerHeroCard ride={ride} theme={theme} statusColor={statusCfg.color} />

            {/* Route card with active step highlight */}
            <RouteCard ride={ride} status={status} theme={theme} />

            {ride.notes && !ride.notes.startsWith('TARGETED:') && (
              <View style={[s.notesCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="document-text-outline" size={14} color={theme.hint} />
                <Text style={[s.notesTxt, { color: theme.hint }]}>{ride.notes}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* ── Action footer ── */}
        <View style={[s.actionFooter, { borderTopColor: theme.border, paddingBottom: sheetPadBottom }]}>
          {status === 'ACCEPTED' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: DA }]} onPress={handleArrive} disabled={acting} activeOpacity={0.88}>
              {acting ? <ActivityIndicator color="#080C18" /> : (
                <>
                  <Ionicons name="location-outline" size={18} color="#080C18" />
                  <Text style={s.actionBtnTxt}>I've Arrived at Pickup</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {status === 'ARRIVED' && (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#A78BFA' }]} onPress={handleStart} disabled={acting} activeOpacity={0.88}>
                {acting ? <ActivityIndicator color="#080C18" /> : (
                  <>
                    <Ionicons name="car-sport-outline" size={18} color="#080C18" />
                    <Text style={s.actionBtnTxt}>Start Ride</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {status === 'IN_PROGRESS' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#5DAA72' }]} onPress={handleComplete} disabled={acting} activeOpacity={0.88}>
              {acting ? <ActivityIndicator color="#080C18" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#080C18" />
                  <Text style={s.actionBtnTxt}>Complete Ride</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {(status === 'COMPLETED' || status === 'CANCELLED') && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: theme.backgroundAlt, borderWidth: 1, borderColor: theme.border }]}
              onPress={goToDashboard}
              activeOpacity={0.85}
            >
              <Ionicons name="home-outline" size={18} color={theme.foreground} />
              <Text style={[s.actionBtnTxt, { color: theme.foreground }]}>Back to Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#080C18' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt:   { fontSize: 14 },
  goBackBtn:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goBackTxt:   { fontSize: 14, fontWeight: '600' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 130, backgroundColor: 'rgba(0,0,0,0.5)' },

  backNav: {
    position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, zIndex: 99,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },

  speedChip: {
    position: 'absolute', zIndex: 99,
    backgroundColor: 'rgba(8,12,24,0.85)', borderWidth: 1,
    borderRadius: 13, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
  },
  speedVal:  { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  speedUnit: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },

  statusPill:    { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, zIndex: 10 },
  statusDot:     { width: 7, height: 7, borderRadius: 3.5 },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },

  sheet:          { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 24 },
  dragHandleArea: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  dragHandle:     { width: 44, height: 4, borderRadius: 2 },
  scrollContent:  { paddingHorizontal: 20 },

  sheetHeader: { marginBottom: 16 },
  statusTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3 },
  statusSub:   { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  fareStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  fareItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  fareLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:   { fontSize: 14, fontWeight: '900' },
  fareDivider: { width: 1 },

  notesCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  notesTxt:  { flex: 1, fontSize: 12, lineHeight: 18 },

  actionFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: 20 },
  actionBtn:    { borderRadius: 16, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnTxt: { fontSize: 15, fontWeight: '900', color: '#080C18' },
});