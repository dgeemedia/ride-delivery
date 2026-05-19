// mobile/src/screens/Partner/ActiveDeliveryScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
View, Text, StyleSheet, TouchableOpacity, ScrollView,
Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
Platform, TextInput, Linking, PanResponder, KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, Polyline } from '../../components/SmartMapView';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { deliveryAPI }       from '../../services/api';
import socketService         from '../../services/socket';
import * as Location         from 'expo-location';

const { height } = Dimensions.get('window');

const COURIER_ACCENT = '#34D399';
const SHEET_MIN      = 200;
const SHEET_DEFAULT  = Math.round(height * 0.54);
const SHEET_MAX      = Math.round(height * 0.85);
const DRAG_HANDLE_H  = 28;
const ACTION_H       = 14 + 54 + 16;
const COMPLETE_CARD_H = 180;

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

const STATUS_CONFIG = {
  ASSIGNED:   { label: 'Head to Pickup',    sublabel: 'Navigate to pick up the package', color: COURIER_ACCENT, icon: 'navigate-outline'        },
  PICKED_UP:  { label: 'Package Picked Up', sublabel: 'Start transit to the destination', color: '#FFB800',     icon: 'cube-outline'             },
  IN_TRANSIT: { label: 'In Transit',        sublabel: 'Deliver to the drop-off address',  color: '#A78BFA',     icon: 'car-sport-outline'        },
  DELIVERED:  { label: 'Delivered!',        sublabel: 'Package delivered successfully',    color: COURIER_ACCENT, icon: 'checkmark-circle-outline' },
  CANCELLED:  { label: 'Cancelled',         sublabel: '',                                  color: '#E05555',     icon: 'close-circle-outline'     },
};

// ── EarningsBadge — prominent fare chip (InDrive-style) ──────────────────────
const EarningsBadge = ({ fee, theme }) => (
  <View style={[eb.wrap, { backgroundColor: COURIER_ACCENT + '15', borderColor: COURIER_ACCENT + '40' }]}>
    <View style={[eb.iconWrap, { backgroundColor: COURIER_ACCENT + '25' }]}>
      <Ionicons name="wallet-outline" size={14} color={COURIER_ACCENT} />
    </View>
    <View>
      <Text style={[eb.label, { color: theme.hint }]}>YOUR EARNING</Text>
      <Text style={[eb.amount, { color: COURIER_ACCENT }]}>
        ₦{Number(fee ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
      </Text>
    </View>
  </View>
);
const eb = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  amount:  { fontSize: 18, fontWeight: '900' },
});

// ── CustomerCallCard ──────────────────────────────────────────────────────────
const CustomerCallCard = ({ delivery, theme }) => {
  const c = delivery?.customer;
  if (!c) return null;
  return (
    <View style={[ccc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={[ccc.avatar, { backgroundColor: COURIER_ACCENT + '18' }]}>
        <Text style={[ccc.initials, { color: COURIER_ACCENT }]}>{c.firstName?.[0]}{c.lastName?.[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ccc.name, { color: theme.foreground }]}>{c.firstName} {c.lastName}</Text>
        <Text style={[ccc.label, { color: theme.hint }]}>Customer</Text>
      </View>
      {c.phone && (
        <TouchableOpacity
          style={[ccc.callBtn, { backgroundColor: COURIER_ACCENT, shadowColor: COURIER_ACCENT }]}
          onPress={() => callPhone(c.phone)}
          activeOpacity={0.75}
        >
          <Ionicons name="call" size={18} color="#080C18" />
        </TouchableOpacity>
      )}
    </View>
  );
};
const ccc = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 12 },
  avatar:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  initials:{ fontSize: 15, fontWeight: '900' },
  name:    { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  label:   { fontSize: 10 },
  callBtn: { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});

// ── RouteCard with NEXT-stop highlight ───────────────────────────────────────
const RouteCard = ({ delivery, status, theme }) => {
  const atPickup  = status === 'ASSIGNED';
  const atDropoff = ['PICKED_UP', 'IN_TRANSIT'].includes(status);

  return (
    <View style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={rc.row}>
        <View style={[rc.dot, { backgroundColor: atPickup ? COURIER_ACCENT : COURIER_ACCENT + '30' }]} />
        <View style={{ flex: 1 }}>
          <Text style={[rc.lbl, { color: theme.hint }]}>PICKUP</Text>
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{delivery?.pickupAddress}</Text>
          {delivery?.pickupContact && (
            <Text style={[rc.contact, { color: theme.hint }]}>{delivery.pickupContact}</Text>
          )}
        </View>
        {atPickup && (
          <View style={[rc.badge, { backgroundColor: COURIER_ACCENT }]}>
            <Text style={rc.badgeTxt}>NEXT</Text>
          </View>
        )}
      </View>
      <View style={[rc.line, { backgroundColor: theme.border }]} />
      <View style={rc.row}>
        <View style={[rc.dot, { backgroundColor: atDropoff ? '#E05555' : '#E05555' + '30' }]} />
        <View style={{ flex: 1 }}>
          <Text style={[rc.lbl, { color: theme.hint }]}>DROP-OFF</Text>
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={2}>{delivery?.dropoffAddress}</Text>
          {delivery?.dropoffContact && (
            <Text style={[rc.contact, { color: theme.hint }]}>{delivery.dropoffContact}</Text>
          )}
        </View>
        {atDropoff && (
          <View style={[rc.badge, { backgroundColor: '#E05555' }]}>
            <Text style={rc.badgeTxt}>NEXT</Text>
          </View>
        )}
      </View>
    </View>
  );
};
const rc = StyleSheet.create({
  card:    { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot:     { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  line:    { width: 1.5, height: 14, marginLeft: 4.5, marginVertical: 3 },
  lbl:     { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  addr:    { fontSize: 13, fontWeight: '600', lineHeight: 18, flex: 1 },
  contact: { fontSize: 11, marginTop: 1 },
  badge:   { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTxt:{ fontSize: 9, fontWeight: '900', color: '#fff' },
});

// ── Package card ─────────────────────────────────────────────────────────────
const PackageCard = ({ delivery, theme }) => (
  <View style={[pk.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '25' }]}>
    <View style={pk.row}>
      <View style={[pk.iconWrap, { backgroundColor: COURIER_ACCENT + '18' }]}>
        <Ionicons name="cube-outline" size={15} color={COURIER_ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[pk.label, { color: theme.hint }]}>PACKAGE</Text>
        <Text style={[pk.value, { color: theme.foreground }]}>{delivery?.packageDescription}</Text>
      </View>
      {delivery?.packageWeight && (
        <View style={[pk.weightBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[pk.weightTxt, { color: theme.hint }]}>{delivery.packageWeight} kg</Text>
        </View>
      )}
    </View>
  </View>
);
const pk = StyleSheet.create({
  card:        { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label:       { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  value:       { fontSize: 13, fontWeight: '600' },
  weightBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
  weightTxt:   { fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ActiveDeliveryScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const deliveryId = route?.params?.deliveryId;

  const [delivery,      setDelivery]      = useState(null);
  const [myLoc,         setMyLoc]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [acting,        setActing]        = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [showComplete,  setShowComplete]  = useState(false);
  const [speed,         setSpeed]         = useState(null);

  const mapRef = useRef(null);
const scrollRef = useRef(null);

  // Draggable sheet — upgraded from fixed height
  const sheetHeightAnim  = useRef(new Animated.Value(SHEET_DEFAULT)).current;
  const currentHeightRef = useRef(SHEET_DEFAULT);
  const startHeightRef   = useRef(SHEET_DEFAULT);

const sheetPadBottom = insets.bottom + 16;

const tabBarHeight =
  54 + insets.bottom + (Platform.OS === 'android' ? 16 : 0);

const statusPillBottom = sheetHeightAnim.interpolate({
  inputRange: [0, SHEET_MIN, SHEET_MAX],
  outputRange: [
    tabBarHeight + 10,
    tabBarHeight + SHEET_MIN + 10,
    tabBarHeight + SHEET_MAX + 10,
  ],
  extrapolate: 'clamp',
});

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 3,
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
      const res = await deliveryAPI.getActiveDelivery();
      const d   = res?.data?.delivery ?? null;
      setDelivery(d);
    } catch (err) {
      console.error('[ActiveDelivery] load error:', err?.message);
    } finally { setLoading(false); }
  }, [deliveryId]);

  useEffect(() => {
    loadDelivery();
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
            { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 15 },
            ({ coords: c }) => {
              const loc2 = { latitude: c.latitude, longitude: c.longitude };
              setMyLoc(loc2);
              socketService.updateLocation(loc2);
              if (c.speed != null && c.speed >= 0) setSpeed(Math.round(c.speed * 3.6));
            }
          );
        }
      } catch {}
    })();

    const handleCancelled = (data) => {
      if (data.deliveryId === deliveryId) {
        Alert.alert('Delivery Cancelled', 'The customer has cancelled this delivery.', [
          { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] }) },
        ]);
      }
    };
    socketService.on('delivery:cancelled', handleCancelled);
    return () => {
      socketService.off('delivery:cancelled', handleCancelled);
      locationWatcher?.remove?.();
    };
  }, [deliveryId]);

useEffect(() => {
  if (showComplete && status === 'IN_TRANSIT') {
    Animated.spring(sheetHeightAnim, {
      toValue: SHEET_MAX,
      tension: 100,
      friction: 12,
      useNativeDriver: false,
    }).start(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
  } else if (!showComplete) {
    Animated.spring(sheetHeightAnim, {
      toValue: SHEET_DEFAULT,
      tension: 100,
      friction: 12,
      useNativeDriver: false,
    }).start(() => {
      currentHeightRef.current = SHEET_DEFAULT;
    });
  }
}, [showComplete]);

  const handlePickup = async () => {
    setActing(true);
    try {
      await deliveryAPI.pickupDelivery(delivery.id);
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
        setTimeout(() => mapRef.current?.fitToCoordinates(
          [
            { latitude: delivery.pickupLat,  longitude: delivery.pickupLng  },
            { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng },
          ],
          { edgePadding: { top: 80, right: 60, bottom: 420, left: 60 }, animated: true }
        ), 400);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not start transit.');
    } finally { setActing(false); }
  };

  const handleComplete = async () => {
    if (!recipientName.trim()) {
      Alert.alert('Recipient Name Required', "Please enter the recipient's name to confirm delivery.");
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

  const status    = delivery?.status ?? 'ASSIGNED';
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ASSIGNED;
  const pickupLat = delivery?.pickupLat;
  const pickupLng = delivery?.pickupLng;
  const dropoffLat= delivery?.dropoffLat;
  const dropoffLng= delivery?.dropoffLng;

  const mapRegion = myLoc
    ? { latitude: myLoc.latitude, longitude: myLoc.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    : pickupLat
    ? { latitude: pickupLat, longitude: pickupLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const backBtnTop = insets.top + 14;

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <ActivityIndicator color={COURIER_ACCENT} size="large" />
        <Text style={[s.centerTxt, { color: '#666' }]}>Loading delivery...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={[s.center, { backgroundColor: '#080C18' }]}>
        <Ionicons name="alert-circle-outline" size={40} color="#555" />
        <Text style={[s.centerTxt, { color: '#666' }]}>No active delivery found.</Text>
        <TouchableOpacity
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
          style={[s.goBackBtn, { borderColor: '#333' }]}
        >
          <Text style={[s.goBackTxt, { color: '#ccc' }]}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

return (
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
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
        {/* Partner's position */}
        {myLoc && (
          <Marker coordinate={myLoc} anchor={{ x: 0.5, y: 0.5 }} pinColor={COURIER_ACCENT} />
        )}
        {/* Pickup */}
        {pickupLat && (
          <Marker
            coordinate={{ latitude: pickupLat, longitude: pickupLng }}
            anchor={{ x: 0.5, y: 1 }}
            pinColor={COURIER_ACCENT}
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
            strokeColor={COURIER_ACCENT} strokeWidth={3} lineDashPattern={[8, 5]}
          />
        )}
        {/* Partner-to-pickup line */}
        {myLoc && pickupLat && status === 'ASSIGNED' && (
          <Polyline
            coordinates={[myLoc, { latitude: pickupLat, longitude: pickupLng }]}
            strokeColor={statusCfg.color} strokeWidth={2.5} lineDashPattern={[5, 7]}
          />
        )}
      </MapView>

      <View style={s.topGradient} pointerEvents="none" />

      <TouchableOpacity
        style={[s.backNav, { top: backBtnTop }]}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Speed chip */}
      {status === 'IN_TRANSIT' && speed !== null && (
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

      {/* ── Bottom sheet — now draggable (replaced fixed SHEET_H) ── */}
      <Animated.View style={[s.sheet, {
        backgroundColor: theme.background,
        borderColor:     theme.border,
        height:          sheetHeightAnim,
        bottom:          tabBarHeight, // lift above tab bar with a small gap
      }]}>
        <View style={s.dragHandleArea} {...panResponder.panHandlers}>
          <View style={[s.dragHandle, { backgroundColor: theme.border }]} />
        </View>

<ScrollView
  ref={scrollRef}
  style={{ flex: 1 }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  contentContainerStyle={[
    s.scrollContent,
    {
      flexGrow: 1,
      paddingBottom: ACTION_H + sheetPadBottom + 24,
    },
  ]}
>

            {/* Status header */}
            <View style={s.sheetHeader}>
              <Text style={[s.statusTitle, { color: theme.foreground }]}>{statusCfg.label}</Text>
              <Text style={[s.statusSub, { color: theme.hint }]}>{statusCfg.sublabel}</Text>
            </View>

            {/* Earnings badge */}
            <EarningsBadge fee={delivery.estimatedFee} theme={theme} />

            {/* Customer call card */}
            <CustomerCallCard delivery={delivery} theme={theme} />

            {/* Package card */}
            <PackageCard delivery={delivery} theme={theme} />

            {/* Route with NEXT stop */}
            <RouteCard delivery={delivery} status={status} theme={theme} />

            {/* Fare strip */}
            <View style={[s.fareStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
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

            {/* Delivery confirmation panel — inside scroll so it's never clipped by the tab bar */}
            {showComplete && status === 'IN_TRANSIT' && (
              <View style={[s.completeCard, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '40' }]}>
                <Text style={[s.completeTitle, { color: theme.foreground }]}>Confirm Delivery</Text>
                <Text style={[s.completeSub, { color: theme.hint }]}>Enter the recipient's name to finalise</Text>
                <View style={[s.inputRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="person-outline" size={15} color={theme.hint} />
                  <TextInput
  style={[s.nameInput, { color: theme.foreground }]}
  placeholder="Recipient's full name"
  placeholderTextColor={theme.hint}
  value={recipientName}
  onChangeText={setRecipientName}
  autoFocus
onFocus={() => {
  setTimeout(() => {
    scrollRef.current?.scrollTo({ y: 80, animated: true });
  }, 200);
}}
/>
                </View>
                <View style={s.completeActions}>
                  <TouchableOpacity style={[s.cancelSmall, { borderColor: theme.border }]} onPress={() => setShowComplete(false)}>
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

<View style={{ height: showComplete ? 40 : 20 }} />           
          </ScrollView>

        {/* ── Action footer ── */}
        <View style={[s.actionFooter, { borderTopColor: theme.border, paddingBottom: sheetPadBottom }]}>
          {status === 'ASSIGNED' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: COURIER_ACCENT }]} onPress={handlePickup} disabled={acting} activeOpacity={0.88}>
              {acting ? <ActivityIndicator color="#080C18" /> : (
                <><Ionicons name="cube-outline" size={17} color="#080C18" /><Text style={s.actionBtnTxt}>Package Picked Up</Text></>
              )}
            </TouchableOpacity>
          )}
          {status === 'PICKED_UP' && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FFB800' }]} onPress={handleTransit} disabled={acting} activeOpacity={0.88}>
              {acting ? <ActivityIndicator color="#080C18" /> : (
                <><Ionicons name="car-sport-outline" size={17} color="#080C18" /><Text style={s.actionBtnTxt}>Start Transit</Text></>
              )}
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
      </Animated.View>
    </View>
  </KeyboardAvoidingView>
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

  sheetHeader: { marginBottom: 14 },
  statusTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3 },
  statusSub:   { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  fareStrip:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  fareItem:    { flex: 1, alignItems: 'center', paddingVertical: 11, gap: 3 },
  fareLabel:   { fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  fareValue:   { fontSize: 14, fontWeight: '900' },
  fareDivider: { width: 1 },

  actionFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: 20 },

  completeCard:    { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  completeTitle:   { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  completeSub:     { fontSize: 12, marginBottom: 12 },
  inputRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  nameInput:       { flex: 1, fontSize: 14, fontWeight: '500' },
  completeActions: { flexDirection: 'row', gap: 10 },
  cancelSmall:     { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelSmallTxt:  { fontSize: 13, fontWeight: '700' },
  confirmSmall:    { flex: 2, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmSmallTxt: { fontSize: 13, fontWeight: '800', color: '#080C18' },

  actionBtn:    { borderRadius: 16, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnTxt: { fontSize: 15, fontWeight: '900', color: '#080C18' },
});