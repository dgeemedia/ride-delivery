// mobile/src/screens/Customer/DeliveryTrackingScreen.js
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
import { deliveryAPI }       from '../../services/api';
import socketService         from '../../services/socket';

const { height } = Dimensions.get('window');

const COURIER_ACCENT = '#34D399';
const TAB_BAR_HEIGHT = 60;
const SHEET_MIN      = 180;
const SHEET_DEFAULT  = Math.round(height * 0.48);
const SHEET_MAX      = Math.round(height * 0.80);
const DRAG_HANDLE_H  = 28;

const goHome = (navigation) => navigation.getParent()?.navigate('HomeTab');

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

// ── Delivery status timeline steps ──────────────────────────────────────────
const TIMELINE = [
  { key: 'PENDING',    label: 'Finding Partner', icon: 'search-outline'           },
  { key: 'ASSIGNED',   label: 'Heading to Pickup', icon: 'navigate-outline'       },
  { key: 'PICKED_UP',  label: 'Package Picked', icon: 'cube-outline'              },
  { key: 'IN_TRANSIT', label: 'In Transit',      icon: 'car-sport-outline'        },
  { key: 'DELIVERED',  label: 'Delivered',        icon: 'checkmark-circle-outline' },
];

const STATUS_CONFIG = {
  PENDING:    { label: 'Finding a delivery partner', sublabel: 'Matching with nearest courier', color: '#4E8DBD', icon: 'time-outline'              },
  ASSIGNED:   { label: 'Partner on the way',         sublabel: 'Heading to pick up your package', color: COURIER_ACCENT, icon: 'bicycle-outline'   },
  PICKED_UP:  { label: 'Package picked up',          sublabel: 'Your package is in safe hands', color: '#FFB800', icon: 'cube-outline'             },
  IN_TRANSIT: { label: 'Package in transit',         sublabel: 'On the way to the destination', color: '#A78BFA', icon: 'navigate-outline'         },
  DELIVERED:  { label: 'Package delivered!',         sublabel: 'Delivery completed successfully', color: COURIER_ACCENT, icon: 'checkmark-circle-outline' },
  CANCELLED:  { label: 'Delivery cancelled',         sublabel: '', color: '#E05555', icon: 'close-circle-outline'                                   },
};

// ── Package Timeline — vertical step tracker (unique to delivery) ─────────────
const PackageTimeline = ({ status, theme }) => {
  const currentIdx = TIMELINE.findIndex(t => t.key === status);

  return (
    <View style={[pt.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <Text style={[pt.heading, { color: theme.hint }]}>DELIVERY PROGRESS</Text>
      {TIMELINE.map((step, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        const future  = i > currentIdx;
        const color   = done || current ? COURIER_ACCENT : theme.border;

        return (
          <View key={step.key} style={pt.stepRow}>
            {/* Connector line */}
            <View style={pt.lineCol}>
              {i > 0 && <View style={[pt.lineTop, { backgroundColor: done || current ? COURIER_ACCENT : theme.border }]} />}
              <View style={[pt.dot, {
                backgroundColor: done ? COURIER_ACCENT : current ? '#080C18' : theme.backgroundAlt,
                borderColor:     color,
                transform:       [{ scale: current ? 1.2 : 1 }],
              }]}>
                {done
                  ? <Ionicons name="checkmark" size={9} color="#080C18" />
                  : <Ionicons name={step.icon} size={9} color={current ? COURIER_ACCENT : theme.border} />
                }
              </View>
              {i < TIMELINE.length - 1 && (
                <View style={[pt.lineBottom, { backgroundColor: done ? COURIER_ACCENT : theme.border }]} />
              )}
            </View>
            {/* Label */}
            <Text style={[pt.stepLabel, {
              color:      future ? theme.hint : theme.foreground,
              fontWeight: current ? '800' : '500',
              opacity:    future ? 0.5 : 1,
            }]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
};
const pt = StyleSheet.create({
  wrap:      { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  heading:   { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  lineCol:   { width: 22, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  lineTop:   { width: 2, flex: 1, marginBottom: 2 },
  lineBottom:{ width: 2, flex: 1, marginTop: 2 },
  dot:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  stepLabel: { fontSize: 13, flex: 1 },
});

// ── PartnerHeroCard — courier info + call button ──────────────────────────────
const PartnerHeroCard = ({ delivery, theme }) => {
  const partner = delivery?.partner;
  if (!partner) return null;
  const dp = partner.deliveryProfile;

  return (
    <View style={[ph.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      {/* Avatar */}
      <View style={[ph.avatarWrap, { borderColor: COURIER_ACCENT + '60' }]}>
        <View style={[ph.avatar, { backgroundColor: COURIER_ACCENT + '22' }]}>
          <Text style={[ph.initials, { color: COURIER_ACCENT }]}>
            {partner.firstName?.[0]}{partner.lastName?.[0]}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={[ph.name, { color: theme.foreground }]}>
          {partner.firstName} {partner.lastName}
        </Text>
        {dp && (
          <Text style={[ph.vehicle, { color: theme.hint }]} numberOfLines={1}>
            {dp.vehicleType}{dp.vehiclePlate ? ` • ${dp.vehiclePlate}` : ''}
          </Text>
        )}
        <View style={ph.metaRow}>
          {dp?.rating > 0 && (
            <View style={ph.ratingChip}>
              <Ionicons name="star" size={10} color="#C9A96E" />
              <Text style={[ph.ratingTxt, { color: '#C9A96E' }]}>{dp.rating.toFixed(1)}</Text>
            </View>
          )}
          {dp?.totalDeliveries > 0 && (
            <View style={[ph.deliveriesBadge, { backgroundColor: COURIER_ACCENT + '15', borderColor: COURIER_ACCENT + '30' }]}>
              <Text style={[ph.deliveriesTxt, { color: COURIER_ACCENT }]}>{dp.totalDeliveries} deliveries</Text>
            </View>
          )}
        </View>
      </View>

      {/* Call button */}
      {partner.phone && (
        <TouchableOpacity
          style={[ph.callBtn, { backgroundColor: COURIER_ACCENT, shadowColor: COURIER_ACCENT }]}
          onPress={() => callPhone(partner.phone)}
          activeOpacity={0.75}
        >
          <Ionicons name="call" size={18} color="#080C18" />
        </TouchableOpacity>
      )}
    </View>
  );
};
const ph = StyleSheet.create({
  card:            { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  avatarWrap:      { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden', padding: 2 },
  avatar:          { flex: 1, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  initials:        { fontSize: 16, fontWeight: '900' },
  name:            { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  vehicle:         { fontSize: 11, marginBottom: 6 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ratingChip:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingTxt:       { fontSize: 11, fontWeight: '700' },
  deliveriesBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  deliveriesTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  callBtn:         { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});

// ── Package detail card ───────────────────────────────────────────────────────
const PackageDetailCard = ({ delivery, theme }) => (
  <View style={[pd.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '25' }]}>
    <View style={pd.row}>
      <View style={[pd.iconWrap, { backgroundColor: COURIER_ACCENT + '15' }]}>
        <Ionicons name="cube-outline" size={16} color={COURIER_ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[pd.label, { color: theme.hint }]}>PACKAGE</Text>
        <Text style={[pd.value, { color: theme.foreground }]}>{delivery?.packageDescription}</Text>
      </View>
    </View>
  </View>
);
const pd = StyleSheet.create({
  card:    { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:{ width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label:   { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  value:   { fontSize: 13, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function DeliveryTrackingScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const deliveryId = route?.params?.deliveryId;

  const [delivery,        setDelivery]        = useState(null);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [cancelling,      setCancelling]      = useState(false);

  const mapRef          = useRef(null);
  const hasNavigatedRef = useRef(false);

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

  const loadDelivery = useCallback(async () => {
    try {
      const res = deliveryId ? await deliveryAPI.getDeliveryById(deliveryId) : await deliveryAPI.getActiveDelivery();
      const d   = res?.data?.delivery ?? null;
      setDelivery(d);
      if (d?.partner?.deliveryProfile?.currentLat) {
        setPartnerLocation({
          latitude:  d.partner.deliveryProfile.currentLat,
          longitude: d.partner.deliveryProfile.currentLng,
        });
      }
      if (d?.id) socketService.joinDelivery?.(d.id);
    } catch (err) {
      console.error('[DeliveryTracking] load error:', err?.message);
    } finally { setLoading(false); }
  }, [deliveryId]);

  useEffect(() => {
    loadDelivery();

    const handleStatus = (data) => {
      if (data.deliveryId && data.deliveryId !== deliveryId) return;
      setDelivery(prev => prev ? { ...prev, status: data.status, partner: data.partner ?? prev.partner } : prev);
      if (data.status === 'DELIVERED') {
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;
        setTimeout(() => navigation.navigate('RateDelivery', { deliveryId, partner: data.partner }), 500);
      }
      if (data.status === 'CANCELLED') {
        Alert.alert('Delivery Cancelled', 'Your delivery was cancelled.', [
          { text: 'OK', onPress: () => goHome(navigation) },
        ]);
      }
    };
    const handlePartnerLoc = (data) => {
      const loc = { latitude: data.lat, longitude: data.lng };
      setPartnerLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
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
    Alert.alert('Cancel Delivery?', 'Are you sure?', [
      { text: 'Keep Delivery', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await deliveryAPI.cancelDelivery(delivery.id, { reason: 'Customer cancelled from tracking screen' });
            goHome(navigation);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel.');
          } finally { setCancelling(false); }
        },
      },
    ]);
  };

  const status      = delivery?.status ?? 'PENDING';
  const statusCfg   = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const pickupLat   = delivery?.pickupLat;
  const pickupLng   = delivery?.pickupLng;
  const dropoffLat  = delivery?.dropoffLat;
  const dropoffLng  = delivery?.dropoffLng;
  const canCancel   = ['PENDING', 'ASSIGNED'].includes(status);
  const backBtnTop  = insets.top + 14;

  const mapRegion = partnerLocation
    ? { ...partnerLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <ActivityIndicator color={COURIER_ACCENT} size="large" />
        <Text style={[s.centerTxt, { color: '#666' }]}>Loading your delivery...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <Ionicons name="alert-circle-outline" size={40} color="#555" />
        <Text style={[s.centerTxt, { color: '#666' }]}>Delivery not found.</Text>
        <TouchableOpacity style={[s.goHomeBtn, { borderColor: '#333' }]} onPress={() => goHome(navigation)}>
          <Text style={[s.goHomeTxt, { color: '#ccc' }]}>Go Home</Text>
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
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Partner pin */}
        {partnerLocation && (
          <Marker coordinate={partnerLocation} anchor={{ x: 0.5, y: 1 }} pinColor={statusCfg.color} />
        )}
        {/* Pickup landmark */}
        {pickupLat && (
          <Marker
            coordinate={{ latitude: pickupLat, longitude: pickupLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor={COURIER_ACCENT}
          />
        )}
        {/* Dropoff landmark */}
        {dropoffLat && (
          <Marker
            coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor="#E05555"
          />
        )}
        {/* Route */}
        {pickupLat && dropoffLat && (
          <Polyline
            coordinates={[
              { latitude: pickupLat,  longitude: pickupLng  },
              { latitude: dropoffLat, longitude: dropoffLng },
            ]}
            strokeColor={COURIER_ACCENT} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {/* Partner en-route to pickup */}
        {partnerLocation && pickupLat && status === 'ASSIGNED' && (
          <Polyline
            coordinates={[partnerLocation, { latitude: pickupLat, longitude: pickupLng }]}
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
        <View style={s.dragHandleWrap} {...panResponder.panHandlers}>
          <View style={[s.dragHandle, { backgroundColor: theme.border }]} />
        </View>

        <Animated.View style={{ height: scrollHeightAnim, overflow: 'hidden' }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

            {/* Header */}
            <View style={s.sheetHeader}>
              <Text style={[s.statusTitle, { color: theme.foreground }]}>{statusCfg.label}</Text>
              <Text style={[s.statusSub, { color: theme.hint }]}>{statusCfg.sublabel}</Text>
            </View>

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
                <Text style={[s.feeValue, { color: theme.foreground }]}>
                  {delivery.distance?.toFixed(1) ?? '—'} km
                </Text>
              </View>
              <View style={[s.feeDivider, { backgroundColor: theme.border }]} />
              <View style={s.feeItem}>
                <Text style={[s.feeLabel, { color: theme.hint }]}>PAYMENT</Text>
                <Text style={[s.feeValue, { color: theme.foreground }]}>CASH</Text>
              </View>
            </View>

            {/* Partner hero card with call button */}
            <PartnerHeroCard delivery={delivery} theme={theme} />

            {/* Package detail */}
            <PackageDetailCard delivery={delivery} theme={theme} />

            {/* Package timeline — unique to this screen */}
            <PackageTimeline status={status} theme={theme} />

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
                    <Text style={s.cancelTxt}>Cancel Delivery</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {(status === 'DELIVERED' || status === 'CANCELLED') && (
              <TouchableOpacity
                style={[s.homeBtn, { backgroundColor: COURIER_ACCENT }]}
                onPress={() => {
                  if (status === 'DELIVERED') navigation.navigate('RateDelivery', { deliveryId, partner: delivery?.partner });
                  else goHome(navigation);
                }}
                activeOpacity={0.88}
              >
                <Ionicons name={status === 'DELIVERED' ? 'star-outline' : 'home-outline'} size={18} color="#080C18" />
                <Text style={[s.homeBtnTxt, { color: '#080C18' }]}>
                  {status === 'DELIVERED' ? 'Rate Your Partner' : 'Back to Home'}
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

  sheet: {
    position: 'absolute', left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 24,
  },
  dragHandleWrap: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  dragHandle:     { width: 44, height: 4, borderRadius: 2 },
  scrollContent:  { paddingHorizontal: 20 },

  sheetHeader: { marginBottom: 16 },
  statusTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3 },
  statusSub:   { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  feeStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  feeItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  feeLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  feeValue:   { fontSize: 14, fontWeight: '900' },
  feeDivider: { width: 1 },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, marginBottom: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: '#E05555' },
  homeBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginBottom: 8 },
  homeBtnTxt:{ fontSize: 15, fontWeight: '800' },
});