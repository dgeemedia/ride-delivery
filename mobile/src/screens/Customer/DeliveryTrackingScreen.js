// mobile/src/screens/Customer/DeliveryTrackingScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { deliveryAPI }       from '../../services/api';
import socketService         from '../../services/socket';

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
  PENDING:    { label: 'Finding a delivery partner...',  color: '#4E8DBD', icon: 'time-outline'            },
  ASSIGNED:   { label: 'Partner is on the way',         color: COURIER_ACCENT, icon: 'bicycle-outline'   },
  PICKED_UP:  { label: 'Package has been picked up!',   color: '#FFB800', icon: 'cube-outline'            },
  IN_TRANSIT: { label: 'Package is in transit',         color: '#A78BFA', icon: 'navigate-outline'        },
  DELIVERED:  { label: 'Package delivered! ✅',          color: COURIER_ACCENT, icon: 'checkmark-circle-outline' },
  CANCELLED:  { label: 'Delivery cancelled',            color: '#E05555', icon: 'close-circle-outline'    },
};

// ── Partner info card ──────────────────────────────────────────────────────────
const PartnerInfoCard = ({ delivery, theme }) => {
  const partner = delivery?.partner;
  if (!partner) return null;
  const dp = partner.deliveryProfile;
  return (
    <View style={[pi.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={[pi.avatar, { backgroundColor: COURIER_ACCENT + '18' }]}>
        <Text style={[pi.avatarTxt, { color: COURIER_ACCENT }]}>{partner.firstName?.[0]}{partner.lastName?.[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[pi.name, { color: theme.foreground }]}>{partner.firstName} {partner.lastName}</Text>
        {dp && (
          <Text style={[pi.vehicle, { color: theme.hint }]} numberOfLines={1}>
            {dp.vehicleType} {dp.vehiclePlate ? `• ${dp.vehiclePlate}` : ''}
          </Text>
        )}
        {dp?.rating > 0 && (
          <View style={pi.ratingRow}>
            <Ionicons name="star" size={11} color="#C9A96E" />
            <Text style={[pi.rating, { color: theme.hint }]}> {dp.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      {partner.phone && (
        <TouchableOpacity style={[pi.callBtn, { backgroundColor: COURIER_ACCENT + '18', borderColor: COURIER_ACCENT + '40' }]}>
          <Ionicons name="call-outline" size={16} color={COURIER_ACCENT} />
        </TouchableOpacity>
      )}
    </View>
  );
};
const pi = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  avatar:    { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '800' },
  name:      { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehicle:   { fontSize: 11, marginBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  rating:    { fontSize: 11 },
  callBtn:   { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── Package & route card ───────────────────────────────────────────────────────
const DeliveryDetailCard = ({ delivery, theme }) => (
  <View style={[dd.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    {/* Package */}
    <View style={dd.pkgRow}>
      <Ionicons name="cube-outline" size={14} color={COURIER_ACCENT} />
      <Text style={[dd.pkgTxt, { color: theme.foreground }]}>{delivery?.packageDescription}</Text>
    </View>
    <View style={[dd.divider, { backgroundColor: theme.border }]} />
    {/* Route */}
    <View style={dd.routeRow}>
      <View style={[dd.dot, { backgroundColor: COURIER_ACCENT }]} />
      <View style={{ flex: 1 }}>
        <Text style={[dd.lbl, { color: theme.hint }]}>PICKUP</Text>
        <Text style={[dd.addr, { color: theme.foreground }]} numberOfLines={1}>{delivery?.pickupAddress}</Text>
      </View>
    </View>
    <View style={[dd.routeLine, { backgroundColor: theme.border }]} />
    <View style={dd.routeRow}>
      <View style={[dd.dot, { backgroundColor: '#E05555' }]} />
      <View style={{ flex: 1 }}>
        <Text style={[dd.lbl, { color: theme.hint }]}>DROP-OFF</Text>
        <Text style={[dd.addr, { color: theme.foreground }]} numberOfLines={1}>{delivery?.dropoffAddress}</Text>
      </View>
    </View>
  </View>
);
const dd = StyleSheet.create({
  card:     { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  pkgRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pkgTxt:   { flex: 1, fontSize: 13, fontWeight: '600' },
  divider:  { height: 1, marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot:      { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  routeLine:{ width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 3 },
  lbl:      { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr:     { fontSize: 13, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function DeliveryTrackingScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const deliveryId      = route?.params?.deliveryId;

  const [delivery,         setDelivery]         = useState(null);
  const [partnerLocation,  setPartnerLocation]  = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [cancelling,       setCancelling]       = useState(false);

  const mapRef = useRef(null);
  const sheetA = useRef(new Animated.Value(0)).current;

  const loadDelivery = useCallback(async () => {
    try {
      const res = await deliveryAPI.getActiveDelivery();
      const d   = res?.data?.delivery ?? null;
      setDelivery(d);

      // Seed partner location from profile
      if (d?.partner?.deliveryProfile?.currentLat) {
        setPartnerLocation({
          latitude:  d.partner.deliveryProfile.currentLat,
          longitude: d.partner.deliveryProfile.currentLng,
        });
      }
      if (d?.id) socketService.joinDelivery?.(d.id);
    } catch (err) {
      console.error('[DeliveryTracking] load error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    loadDelivery();
    Animated.spring(sheetA, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();

    // Socket listeners
    const handleStatus = (data) => {
      if (data.deliveryId && data.deliveryId !== deliveryId) return;
      setDelivery(prev => prev ? { ...prev, status: data.status, partner: data.partner ?? prev.partner } : prev);

      if (data.status === 'DELIVERED') {
        setTimeout(() => {
          Alert.alert('Package Delivered! 🎉', 'Your package has been delivered successfully!', [
            { text: 'Rate Partner', onPress: () => navigation.navigate('Home') },
            { text: 'Done', onPress: () => navigation.navigate('Home') },
          ]);
        }, 500);
      }
      if (data.status === 'CANCELLED') {
        Alert.alert('Delivery Cancelled', 'Your delivery was cancelled.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      }
    };

    // Partner location update — emitted by server when partner moves
    const handlePartnerLoc = (data) => {
      const loc = { latitude: data.lat, longitude: data.lng };
      setPartnerLocation(loc);
      mapRef.current?.animateToRegion({
        ...loc, latitudeDelta: 0.03, longitudeDelta: 0.03,
      }, 800);
    };

    socketService.on('delivery:status:update',  handleStatus);
    socketService.on('partner:location:update', handlePartnerLoc);

    return () => {
      socketService.off('delivery:status:update',  handleStatus);
      socketService.off('partner:location:update', handlePartnerLoc);
      if (deliveryId) socketService.leaveDelivery?.(deliveryId);
    };
  }, [deliveryId]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Delivery?',
      'Are you sure you want to cancel this delivery?',
      [
        { text: 'Keep Delivery', style: 'cancel' },
        {
          text: 'Cancel Delivery',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await deliveryAPI.cancelDelivery(delivery.id, { reason: 'Customer cancelled from tracking screen' });
              navigation.navigate('Home');
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel the delivery.');
            } finally { setCancelling(false); }
          }
        }
      ]
    );
  };

  const status    = delivery?.status ?? 'PENDING';
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

  const pickupLat  = delivery?.pickupLat;
  const pickupLng  = delivery?.pickupLng;
  const dropoffLat = delivery?.dropoffLat;
  const dropoffLng = delivery?.dropoffLng;

  const mapRegion = partnerLocation
    ? { ...partnerLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const sheetTranslate = sheetA.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  const canCancel      = ['PENDING', 'ASSIGNED'].includes(status);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={COURIER_ACCENT} size="large" />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Loading your delivery...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.hint} />
        <Text style={[s.centerTxt, { color: theme.hint }]}>Delivery not found.</Text>
        <TouchableOpacity
          style={[s.goHomeBtn, { borderColor: theme.border }]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={[s.goHomeTxt, { color: theme.foreground }]}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Map */}
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
        {/* Partner pin */}
        {partnerLocation && (
          <Marker coordinate={partnerLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.partnerPin, { backgroundColor: statusCfg.color }]}>
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
        {/* Partner → pickup line (while ASSIGNED) */}
        {partnerLocation && pickupLat && status === 'ASSIGNED' && (
          <Polyline
            coordinates={[partnerLocation, { latitude: pickupLat, longitude: pickupLng }]}
            strokeColor={statusCfg.color} strokeWidth={2} lineDashPattern={[4, 6]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 14, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* Status pill */}
      <View style={[s.statusPill, {
        backgroundColor: statusCfg.color + '18',
        borderColor:     statusCfg.color + '50',
        bottom:          height * 0.44,
      }]}>
        <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
        <Text style={[s.statusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </View>

      {/* Bottom sheet */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        paddingBottom:   insets.bottom + 12,
        transform:       [{ translateY: sheetTranslate }],
      }]}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Fee strip */}
          <View style={[s.feeStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={s.feeItem}>
              <Text style={[s.feeLabel, { color: theme.hint }]}>FEE</Text>
              <Text style={[s.feeValue, { color: COURIER_ACCENT }]}>
                ₦{Number(delivery.estimatedFee ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
            <View style={s.feeItem}>
              <Text style={[s.feeLabel, { color: theme.hint }]}>DISTANCE</Text>
              <Text style={[s.feeValue, { color: theme.foreground }]}>{delivery.distance?.toFixed(1) ?? '—'} km</Text>
            </View>
            <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
            <View style={s.feeItem}>
              <Text style={[s.feeLabel, { color: theme.hint }]}>PAYMENT</Text>
              <Text style={[s.feeValue, { color: theme.foreground }]}>CASH</Text>
            </View>
          </View>

          <PartnerInfoCard   delivery={delivery} theme={theme} />
          <DeliveryDetailCard delivery={delivery} theme={theme} />

          {/* Cancel */}
          {canCancel && (
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: '#E05555' + '50' }]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling
                ? <ActivityIndicator color="#E05555" size="small" />
                : (
                  <>
                    <Ionicons name="close-circle-outline" size={16} color="#E05555" />
                    <Text style={s.cancelTxt}>Cancel Delivery</Text>
                  </>
                )
              }
            </TouchableOpacity>
          )}

          {(status === 'DELIVERED' || status === 'CANCELLED') && (
            <TouchableOpacity
              style={[s.homeBtn, { backgroundColor: COURIER_ACCENT }]}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.88}
            >
              <Ionicons name="home-outline" size={18} color="#FFF" />
              <Text style={s.homeBtnTxt}>Back to Home</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  centerTxt:   { fontSize: 14 },
  goHomeBtn:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  goHomeTxt:   { fontSize: 14, fontWeight: '600' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.35)' },
  backBtn:     { position: 'absolute', left: 20, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  partnerPin:  { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#080C18' },
  statusPill:  { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, zIndex: 10 },
  statusPillTxt:{ fontSize: 12, fontWeight: '700' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 20, maxHeight: height * 0.52 },
  feeStrip:    { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  feeItem:     { flex: 1, alignItems: 'center', paddingVertical: 11, gap: 3 },
  feeLabel:    { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  feeValue:    { fontSize: 14, fontWeight: '900' },
  feeDivider:  { width: 1 },
  cancelBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, marginBottom: 8 },
  cancelTxt:   { fontSize: 14, fontWeight: '700', color: '#E05555' },
  homeBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginBottom: 8 },
  homeBtnTxt:  { fontSize: 15, fontWeight: '800', color: '#FFF' },
});