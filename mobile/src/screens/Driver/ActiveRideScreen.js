// mobile/src/screens/Driver/ActiveRideScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }  from '../../context/ThemeContext';
import { useRide }   from '../../context/RideContext';
import { rideAPI }   from '../../services/api';
import socketService from '../../services/socket';
import * as Location from '../../shims/Location';

const { height } = Dimensions.get('window');
const DA = '#FFB800';

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#FFB800' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',                elementType: 'labels',           stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            elementType: 'labels',           stylers: [{ visibility: 'off' }] },
];

const STATUS_CONFIG = {
  ACCEPTED:    { label: 'Head to Pickup',   color: DA,        icon: 'navigate-outline'        },
  ARRIVED:     { label: 'Arrived',          color: '#A78BFA', icon: 'location-outline'         },
  IN_PROGRESS: { label: 'Ride in Progress', color: '#5DAA72', icon: 'car-sport-outline'        },
  COMPLETED:   { label: 'Completed',        color: '#5DAA72', icon: 'checkmark-circle-outline' },
  CANCELLED:   { label: 'Cancelled',        color: '#E05555', icon: 'close-circle-outline'     },
};

// ── CustomerCard ───────────────────────────────────────────────────────────────
const CustomerCard = ({ ride, theme }) => (
  <View style={[cc.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
    <View style={[cc.avatar, { backgroundColor: DA + '18' }]}>
      <Text style={[cc.avatarTxt, { color: DA }]}>
        {ride.customer?.firstName?.[0]}{ride.customer?.lastName?.[0]}
      </Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[cc.name, { color: theme.foreground }]}>
        {ride.customer?.firstName} {ride.customer?.lastName}
      </Text>
      {ride.customer?.phone && (
        <Text style={[cc.phone, { color: theme.hint }]}>{ride.customer.phone}</Text>
      )}
    </View>
    <TouchableOpacity style={[cc.callBtn, { backgroundColor: DA + '18', borderColor: DA + '40' }]}>
      <Ionicons name="call-outline" size={17} color={DA} />
    </TouchableOpacity>
  </View>
);
const cc = StyleSheet.create({
  card:     { flexDirection:'row', alignItems:'center', gap:12, borderRadius:14, borderWidth:1, padding:12, marginBottom:14 },
  avatar:   { width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center' },
  avatarTxt:{ fontSize:15, fontWeight:'800' },
  name:     { fontSize:14, fontWeight:'700', marginBottom:2 },
  phone:    { fontSize:12 },
  callBtn:  { width:38, height:38, borderRadius:12, borderWidth:1, justifyContent:'center', alignItems:'center' },
});

// ── RouteCard ──────────────────────────────────────────────────────────────────
const RouteCard = ({ ride, theme }) => (
  <View style={[rc.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
    <View style={rc.row}>
      <View style={[rc.dot, { backgroundColor: DA }]} />
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
  card: { borderRadius:14, borderWidth:1, padding:14, marginBottom:14 },
  row:  { flexDirection:'row', alignItems:'flex-start', gap:10 },
  dot:  { width:10, height:10, borderRadius:5, marginTop:4, flexShrink:0 },
  line: { width:1.5, height:14, marginLeft:4.5, marginVertical:3 },
  lbl:  { fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:2 },
  addr: { fontSize:13, fontWeight:'600', lineHeight:18 },
});

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function ActiveRideScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const { activeRide: contextRide, startRide, completeRide } = useRide();

  const rideId = route?.params?.rideId;

  const [ride,    setRide]    = useState(contextRide ?? null);
  const [myLoc,   setMyLoc]   = useState(null);
  const [loading, setLoading] = useState(!contextRide);
  const [acting,  setActing]  = useState(false);

  const mapRef = useRef(null);
  const sheetA = useRef(new Animated.Value(0)).current;

  // ── Load ride ───────────────────────────────────────────────────────────────
  const loadRide = useCallback(async () => {
    try {
      if (contextRide) { setRide(contextRide); return; }
      if (!rideId) return;
      const res = await rideAPI.getActiveRide();
      setRide(res?.data?.ride ?? null);
    } catch {}
    finally { setLoading(false); }
  }, [rideId, contextRide]);

  useEffect(() => {
    loadRide();
    Animated.spring(sheetA, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();

    // Get driver's real GPS for the map dot
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setMyLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {}
    })();

    // Socket — listen for ride status changes and cancellations
    const handleStatus = (data) => {
      if (data.rideId === rideId || data.rideId === ride?.id) {
        setRide(prev => prev ? { ...prev, status: data.status } : prev);
        if (data.status === 'CANCELLED') {
          Alert.alert('Ride Cancelled', 'The customer has cancelled this ride.', [
            { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
          ]);
        }
      }
    };
    socketService.on('ride:status:update', handleStatus);
    socketService.on('ride:cancelled',     handleStatus);
    return () => {
      socketService.off('ride:status:update', handleStatus);
      socketService.off('ride:cancelled',     handleStatus);
    };
  }, [rideId]);

  useEffect(() => { if (contextRide) setRide(contextRide); }, [contextRide]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleArrive = async () => {
    setActing(true);
    try {
      await rideAPI.arrivedAtPickup(ride.id);   // PUT /rides/:id/arrived
      setRide(prev => ({ ...prev, status: 'ARRIVED' }));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not update status.');
    } finally { setActing(false); }
  };

  const handleStart = async () => {
    setActing(true);
    try {
      await startRide(ride.id);
      setRide(prev => ({ ...prev, status: 'IN_PROGRESS' }));
      if (ride.pickupLat && ride.dropoffLat) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [
              { latitude: ride.pickupLat,  longitude: ride.pickupLng  },
              { latitude: ride.dropoffLat, longitude: ride.dropoffLng },
            ],
            { edgePadding: { top: 80, right: 60, bottom: 420, left: 60 }, animated: true }
          );
        }, 400);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not start ride.');
    } finally { setActing(false); }
  };

  const handleComplete = () => {
    const doComplete = async () => {
      setActing(true);
      try {
        await completeRide(ride.id, ride.estimatedFare);
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const status    = ride?.status ?? 'ACCEPTED';
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACCEPTED;

  // Use REAL coordinates from the ride record — no hardcoded fallbacks
  const pickupLat  = ride?.pickupLat;
  const pickupLng  = ride?.pickupLng;
  const dropoffLat = ride?.dropoffLat;
  const dropoffLng = ride?.dropoffLng;

  // Map centers on driver's real location while heading to pickup,
  // then on pickup once arrived/in-progress
  const mapRegion = myLoc
    ? { latitude: myLoc.latitude, longitude: myLoc.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const sheetTranslate  = sheetA.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  const backBtnTop      = insets.top + 14;
  const sheetPadBottom  = insets.bottom + 12;

  // ── Loading / empty states ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={DA} size="large" />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Loading ride...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.hint} />
        <Text style={[s.centerTxt, { color: theme.hint }]}>No active ride found.</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Dashboard')}
          style={[s.goBackBtn, { borderColor: theme.border }]}
        >
          <Text style={[s.goBackTxt, { color: theme.foreground }]}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── MAP — shows real pickup, dropoff, and driver position ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Driver's real-time position */}
        {myLoc && (
          <Marker coordinate={myLoc} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.driverPin}>
              <Ionicons name="car" size={14} color="#080C18" />
            </View>
          </Marker>
        )}

        {/* Pickup pin — from ride record */}
        {pickupLat && (
          <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="radio-button-on" size={24} color={DA} />
          </Marker>
        )}

        {/* Dropoff pin — from ride record */}
        {dropoffLat && (
          <Marker coordinate={{ latitude: dropoffLat, longitude: dropoffLng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="location" size={28} color="#E05555" />
          </Marker>
        )}

        {/* Route line */}
        {pickupLat && dropoffLat && (
          <Polyline
            coordinates={[
              { latitude: pickupLat,  longitude: pickupLng  },
              { latitude: dropoffLat, longitude: dropoffLng },
            ]}
            strokeColor={DA}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      {/* Back button — clears status bar via insets */}
      <TouchableOpacity
        style={[s.backNav, { top: backBtnTop, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => navigation.navigate('Dashboard')}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* Status pill */}
      <View style={[s.statusPill, { backgroundColor: statusCfg.color + '18', borderColor: statusCfg.color + '50' }]}>
        <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </View>

      {/* ── BOTTOM SHEET — clears nav bar via insets ── */}
      <Animated.View
        style={[s.sheet, {
          backgroundColor: theme.background,
          borderColor: theme.border,
          paddingBottom: sheetPadBottom,
          transform: [{ translateY: sheetTranslate }],
        }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Fare strip */}
          <View style={[s.fareStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>FARE</Text>
              <Text style={[s.fareValue, { color: DA }]}>
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

          <CustomerCard ride={ride} theme={theme} />
          <RouteCard    ride={ride} theme={theme} />

          {ride.notes && !ride.notes.startsWith('TARGETED:') && (
            <View style={[s.notesCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Ionicons name="document-text-outline" size={14} color={theme.hint} />
              <Text style={[s.notesTxt, { color: theme.hint }]}>{ride.notes}</Text>
            </View>
          )}

          {/* Action button */}
          <View style={s.actionArea}>
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
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#A78BFA' }]} onPress={handleStart} disabled={acting} activeOpacity={0.88}>
                {acting ? <ActivityIndicator color="#080C18" /> : (
                  <>
                    <Ionicons name="car-sport-outline" size={18} color="#080C18" />
                    <Text style={s.actionBtnTxt}>Start Ride</Text>
                  </>
                )}
              </TouchableOpacity>
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
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.backgroundAlt, borderWidth: 1, borderColor: theme.border }]} onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.85}>
                <Ionicons name="home-outline" size={18} color={theme.foreground} />
                <Text style={[s.actionBtnTxt, { color: theme.foreground }]}>Back to Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt:  { fontSize: 14 },
  goBackBtn:  { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goBackTxt:  { fontSize: 14, fontWeight: '600' },
  topGradient:{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backNav: {
    position: 'absolute', left: 20,
    width: 42, height: 42, borderRadius: 13, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', zIndex: 99,
  },
  driverPin: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: DA,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#080C18',
  },
  statusPill: {
    position: 'absolute', bottom: height * 0.44, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, zIndex: 10,
  },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1,
    paddingHorizontal: 20, paddingTop: 20,
    maxHeight: height * 0.52,
  },
  fareStrip:  { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  fareItem:   { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  fareLabel:  { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:  { fontSize: 14, fontWeight: '900' },
  fareDivider:{ width: 1 },
  notesCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
  notesTxt:   { flex: 1, fontSize: 12, lineHeight: 18 },
  actionArea: { marginBottom: 8 },
  actionBtn:  { borderRadius: 16, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnTxt:{ fontSize: 15, fontWeight: '900', color: '#080C18' },
});