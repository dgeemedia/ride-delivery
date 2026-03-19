// mobile/src/screens/Partner/ActiveDeliveryScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  Platform, TextInput,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { deliveryAPI }       from '../../services/api';
import socketService         from '../../services/socket';
import * as Location         from 'expo-location';

const { height } = Dimensions.get('window');
const COURIER_ACCENT = '#34D399';

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2b2b2b' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: COURIER_ACCENT }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi',                elementType: 'labels',           stylers: [{ visibility: 'off' }] },
];

const STATUS_CONFIG = {
  ASSIGNED:    { label: 'Head to Pickup',        color: COURIER_ACCENT, icon: 'navigate-outline'         },
  PICKED_UP:   { label: 'Package Picked Up',     color: '#FFB800',      icon: 'cube-outline'              },
  IN_TRANSIT:  { label: 'In Transit',            color: '#A78BFA',      icon: 'car-sport-outline'         },
  DELIVERED:   { label: 'Delivered!',            color: COURIER_ACCENT, icon: 'checkmark-circle-outline'  },
  CANCELLED:   { label: 'Cancelled',             color: '#E05555',      icon: 'close-circle-outline'      },
};

// ── Customer card ──────────────────────────────────────────────────────────────
const CustomerCard = ({ delivery, theme }) => {
  const c = delivery?.customer;
  if (!c) return null;
  return (
    <View style={[cc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={[cc.avatar, { backgroundColor: COURIER_ACCENT + '18' }]}>
        <Text style={[cc.avatarTxt, { color: COURIER_ACCENT }]}>{c.firstName?.[0]}{c.lastName?.[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cc.name, { color: theme.foreground }]}>{c.firstName} {c.lastName}</Text>
        {c.phone && <Text style={[cc.phone, { color: theme.hint }]}>{c.phone}</Text>}
      </View>
      <TouchableOpacity style={[cc.callBtn, { backgroundColor: COURIER_ACCENT + '18', borderColor: COURIER_ACCENT + '40' }]}>
        <Ionicons name="call-outline" size={16} color={COURIER_ACCENT} />
      </TouchableOpacity>
    </View>
  );
};
const cc = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  avatar:    { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '800' },
  name:      { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  phone:     { fontSize: 12 },
  callBtn:   { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── Route card ──────────────────────────────────────────────────────────────────
const RouteCard = ({ delivery, status, theme }) => {
  const showPickup  = ['ASSIGNED'].includes(status);
  const showDropoff = ['PICKED_UP', 'IN_TRANSIT'].includes(status);
  return (
    <View style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={rc.row}>
        <View style={[rc.dot, { backgroundColor: COURIER_ACCENT, opacity: showPickup ? 1 : 0.4 }]} />
        <View style={{ flex: 1 }}>
          <Text style={[rc.lbl, { color: theme.hint }]}>PICKUP</Text>
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{delivery?.pickupAddress}</Text>
          {delivery?.pickupContact && (
            <Text style={[rc.contact, { color: theme.muted }]}>{delivery.pickupContact}</Text>
          )}
        </View>
        {showPickup && <View style={[rc.active, { backgroundColor: COURIER_ACCENT }]}><Text style={rc.activeTxt}>NEXT</Text></View>}
      </View>
      <View style={[rc.line, { backgroundColor: theme.border }]} />
      <View style={rc.row}>
        <View style={[rc.dot, { backgroundColor: '#E05555', opacity: showDropoff ? 1 : 0.4 }]} />
        <View style={{ flex: 1 }}>
          <Text style={[rc.lbl, { color: theme.hint }]}>DROP-OFF</Text>
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{delivery?.dropoffAddress}</Text>
          {delivery?.dropoffContact && (
            <Text style={[rc.contact, { color: theme.muted }]}>{delivery.dropoffContact}</Text>
          )}
        </View>
        {showDropoff && <View style={[rc.active, { backgroundColor: '#E05555' }]}><Text style={rc.activeTxt}>NEXT</Text></View>}
      </View>
    </View>
  );
};
const rc = StyleSheet.create({
  card:      { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  line:      { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 3 },
  lbl:       { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr:      { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  contact:   { fontSize: 11, marginTop: 1 },
  active:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  activeTxt: { fontSize: 9, fontWeight: '900', color: '#fff' },
});

// ── Package card ──────────────────────────────────────────────────────────────
const PackageCard = ({ delivery, theme }) => (
  <View style={[pk.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '25' }]}>
    <View style={pk.row}>
      <Ionicons name="cube-outline" size={14} color={COURIER_ACCENT} />
      <Text style={[pk.txt, { color: theme.foreground }]}>{delivery?.packageDescription}</Text>
    </View>
    {delivery?.packageWeight && (
      <View style={pk.row}>
        <Ionicons name="scale-outline" size={14} color={theme.hint} />
        <Text style={[pk.txt, { color: theme.hint }]}>{delivery.packageWeight} kg</Text>
      </View>
    )}
  </View>
);
const pk = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, gap: 8 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txt:  { fontSize: 13, fontWeight: '500', flex: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ActiveDeliveryScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const deliveryId      = route?.params?.deliveryId;

  const [delivery,     setDelivery]     = useState(null);
  const [myLoc,        setMyLoc]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [acting,       setActing]       = useState(false);
  const [recipientName,setRecipientName]= useState('');
  const [showComplete, setShowComplete] = useState(false);

  const mapRef = useRef(null);
  const sheetA = useRef(new Animated.Value(0)).current;

  const loadDelivery = useCallback(async () => {
    try {
      const res = await deliveryAPI.getActiveDelivery();
      const d   = res?.data?.delivery ?? null;
      setDelivery(d);
    } catch (err) {
      console.error('[ActiveDelivery] load error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    loadDelivery();
    Animated.spring(sheetA, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();

    // GPS — broadcast location so customer can track
    let locationWatcher = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setMyLoc(coords);
          socketService.updateLocation({ latitude: coords.latitude, longitude: coords.longitude });

          locationWatcher = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 15 },
            (position) => {
              const c = { latitude: position.coords.latitude, longitude: position.coords.longitude };
              setMyLoc(c);
              socketService.updateLocation({ latitude: c.latitude, longitude: c.longitude });
            }
          );
        }
      } catch {}
    })();

    // Socket — delivery cancellation
    const handleCancelled = (data) => {
      if (data.deliveryId === deliveryId) {
        Alert.alert('Delivery Cancelled', 'The customer has cancelled this delivery.', [
          { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] }) }
        ]);
      }
    };
    socketService.on('delivery:cancelled', handleCancelled);

    return () => {
      socketService.off('delivery:cancelled', handleCancelled);
      locationWatcher?.remove?.();
    };
  }, [deliveryId]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handlePickup = async () => {
    setActing(true);
    try {
      const res = await deliveryAPI.pickupDelivery(delivery.id);
      setDelivery(prev => ({ ...prev, status: 'PICKED_UP' }));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not update status.');
    } finally { setActing(false); }
  };

  const handleTransit = async () => {
    setActing(true);
    try {
      await deliveryAPI.startTransit(delivery.id);
      setDelivery(prev => ({ ...prev, status: 'IN_TRANSIT' }));

      if (delivery.pickupLat && delivery.dropoffLat) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [
              { latitude: delivery.pickupLat,  longitude: delivery.pickupLng  },
              { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng },
            ],
            { edgePadding: { top: 80, right: 60, bottom: 420, left: 60 }, animated: true }
          );
        }, 400);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not start transit.');
    } finally { setActing(false); }
  };

  const handleComplete = async () => {
    if (!recipientName.trim()) {
      Alert.alert('Recipient Name Required', 'Please enter the recipient\'s name to confirm delivery.');
      return;
    }
    setActing(true);
    try {
      await deliveryAPI.completeDelivery(delivery.id, {
        recipientName: recipientName.trim(),
        paymentMethod: 'CASH',
      });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not complete delivery.');
    } finally { setActing(false); setShowComplete(false); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const status    = delivery?.status ?? 'ASSIGNED';
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ASSIGNED;

  const pickupLat  = delivery?.pickupLat;
  const pickupLng  = delivery?.pickupLng;
  const dropoffLat = delivery?.dropoffLat;
  const dropoffLng = delivery?.dropoffLng;

  const mapRegion = myLoc
    ? { latitude: myLoc.latitude, longitude: myLoc.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const sheetTranslate = sheetA.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  const backBtnTop     = insets.top + 14;
  const sheetPadBottom = insets.bottom + 12;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={COURIER_ACCENT} size="large" />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Loading delivery...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.hint} />
        <Text style={[s.centerTxt, { color: theme.hint }]}>No active delivery found.</Text>
        <TouchableOpacity
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
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
        {/* My location (partner) */}
        {myLoc && (
          <Marker coordinate={myLoc} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.partnerPin}>
              <Ionicons name="bicycle" size={13} color="#080C18" />
            </View>
          </Marker>
        )}
        {/* Pickup */}
        {pickupLat && (
          <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="radio-button-on" size={24} color={COURIER_ACCENT} />
          </Marker>
        )}
        {/* Dropoff */}
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
            strokeColor={COURIER_ACCENT} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backNav, { top: backBtnTop, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* Status pill */}
      <View style={[s.statusPill, { backgroundColor: statusCfg.color + '18', borderColor: statusCfg.color + '50', bottom: height * 0.44 }]}>
        <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </View>

      {/* Bottom sheet */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        paddingBottom:   sheetPadBottom,
        transform:       [{ translateY: sheetTranslate }],
      }]}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Fee strip */}
          <View style={[s.fareStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>FEE</Text>
              <Text style={[s.fareValue, { color: COURIER_ACCENT }]}>
                ₦{Number(delivery.estimatedFee ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>DISTANCE</Text>
              <Text style={[s.fareValue, { color: theme.foreground }]}>{delivery.distance?.toFixed(1) ?? '—'} km</Text>
            </View>
            <View style={[s.fareDivider, { backgroundColor: theme.border }]} />
            <View style={s.fareItem}>
              <Text style={[s.fareLabel, { color: theme.hint }]}>PAYMENT</Text>
              <Text style={[s.fareValue, { color: theme.foreground }]}>CASH</Text>
            </View>
          </View>

          <CustomerCard delivery={delivery} theme={theme} />
          <PackageCard  delivery={delivery} theme={theme} />
          <RouteCard    delivery={delivery} status={status} theme={theme} />

          {/* Complete delivery — recipient name input */}
          {showComplete && status === 'IN_TRANSIT' && (
            <View style={[s.completeCard, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '40' }]}>
              <Text style={[s.completeTitle, { color: theme.foreground }]}>Confirm Delivery</Text>
              <Text style={[s.completeSub, { color: theme.hint }]}>Enter the recipient's name to finalize</Text>
              <View style={[s.inputRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="person-outline" size={15} color={theme.hint} />
                <TextInput
                  style={[s.nameInput, { color: theme.foreground }]}
                  placeholder="Recipient's full name"
                  placeholderTextColor={theme.hint}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  autoFocus
                />
              </View>
              <View style={s.completeActions}>
                <TouchableOpacity
                  style={[s.cancelSmall, { borderColor: theme.border }]}
                  onPress={() => setShowComplete(false)}
                >
                  <Text style={[s.cancelSmallTxt, { color: theme.hint }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmSmall, { backgroundColor: COURIER_ACCENT, opacity: acting ? 0.7 : 1 }]}
                  onPress={handleComplete}
                  disabled={acting}
                >
                  {acting
                    ? <ActivityIndicator color="#080C18" size="small" />
                    : <Text style={s.confirmSmallTxt}>Confirm Delivered</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={s.actionArea}>
            {status === 'ASSIGNED' && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: COURIER_ACCENT }]} onPress={handlePickup} disabled={acting} activeOpacity={0.88}>
                {acting
                  ? <ActivityIndicator color="#080C18" />
                  : (<><Ionicons name="cube-outline" size={17} color="#080C18" /><Text style={s.actionBtnTxt}>Package Picked Up</Text></>)
                }
              </TouchableOpacity>
            )}
            {status === 'PICKED_UP' && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FFB800' }]} onPress={handleTransit} disabled={acting} activeOpacity={0.88}>
                {acting
                  ? <ActivityIndicator color="#080C18" />
                  : (<><Ionicons name="car-sport-outline" size={17} color="#080C18" /><Text style={s.actionBtnTxt}>Start Transit</Text></>)
                }
              </TouchableOpacity>
            )}
            {status === 'IN_TRANSIT' && !showComplete && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: COURIER_ACCENT }]} onPress={() => setShowComplete(true)} activeOpacity={0.88}>
                <Ionicons name="checkmark-circle-outline" size={17} color="#080C18" />
                <Text style={s.actionBtnTxt}>Mark as Delivered</Text>
              </TouchableOpacity>
            )}
            {(status === 'DELIVERED' || status === 'CANCELLED') && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.backgroundAlt, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
                activeOpacity={0.85}
              >
                <Ionicons name="home-outline" size={17} color={theme.foreground} />
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
  root:        { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt:   { fontSize: 14 },
  goBackBtn:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goBackTxt:   { fontSize: 14, fontWeight: '600' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backNav:     { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  partnerPin:  { width: 32, height: 32, borderRadius: 16, backgroundColor: COURIER_ACCENT, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#080C18' },
  statusPill:  { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, zIndex: 10 },
  statusPillTxt:{ fontSize: 12, fontWeight: '700' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 20, maxHeight: height * 0.54 },
  fareStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  fareItem:    { flex: 1, alignItems: 'center', paddingVertical: 11, gap: 3 },
  fareLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:   { fontSize: 14, fontWeight: '900' },
  fareDivider: { width: 1 },
  completeCard:{ borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 12 },
  completeTitle:{ fontSize: 15, fontWeight: '800', marginBottom: 3 },
  completeSub: { fontSize: 12, marginBottom: 12 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  nameInput:   { flex: 1, fontSize: 14, fontWeight: '500' },
  completeActions:{ flexDirection: 'row', gap: 10 },
  cancelSmall: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelSmallTxt:{ fontSize: 13, fontWeight: '700' },
  confirmSmall:{ flex: 2, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmSmallTxt:{ fontSize: 13, fontWeight: '800', color: '#080C18' },
  actionArea:  { marginBottom: 8 },
  actionBtn:   { borderRadius: 16, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnTxt:{ fontSize: 15, fontWeight: '900', color: '#080C18' },
});