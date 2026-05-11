// mobile/src/screens/Customer/NearbyPartnersScreen.js
//
// Mirrors NearbyDriversScreen but for delivery partners.
//
// TWO MODES:
//   browse   — navigated from HomeScreen "Couriers" card with no package info.
//              Tapping a partner → navigates to RequestDelivery with the
//              partner pre-selected (partnerId + partnerName in route params).
//   booking  — navigated from RequestDeliveryScreen step 2 with full delivery
//              details already set. Tapping a partner → ConfirmSheet → books.
//
// Route params (browse mode):
//   { pickupLat, pickupLng, pickupAddress }
//
// Route params (booking mode — all of the above PLUS):
//   { dropoffLat, dropoffLng, dropoffAddress,
//     pickupContact, dropoffContact,
//     packageDescription, packageWeight, packageNotes,
//     feeEstimate, distanceKm, etaMinutes }

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTheme }        from '../../context/ThemeContext';
import { deliveryAPI }     from '../../services/api';

const { width, height } = Dimensions.get('window');

const AMBER  = '#FFB800';
const GREEN  = '#5DAA72';
const PURPLE = '#A78BFA';
const RED    = '#E05555';
const TEAL   = '#2EBFA5';

const VEHICLE_ICON = {
  BIKE:       'bicycle-outline',
  MOTORCYCLE: 'bicycle-outline',
  CAR:        'car-outline',
  VAN:        'bus-outline',
  TRICYCLE:   'bicycle-outline',
};

// ─── StarRating ───────────────────────────────────────────────────────────────
const StarRating = ({ rating, theme }) => (
  <View style={sr.row}>
    <Ionicons name="star" size={11} color={AMBER} />
    <Text style={[sr.txt, { color: theme.foreground }]}>{rating.toFixed(1)}</Text>
  </View>
);
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txt: { fontSize: 12, fontWeight: '700' },
});

// ─── Pill ─────────────────────────────────────────────────────────────────────
const Pill = ({ icon, label, color, theme }) => (
  <View style={[pill.wrap, { backgroundColor: (color || theme.hint) + '18', borderColor: (color || theme.hint) + '30' }]}>
    <Ionicons name={icon} size={11} color={color || theme.hint} />
    <Text style={[pill.txt, { color: color || theme.hint }]}>{label}</Text>
  </View>
);
const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  txt:  { fontSize: 11, fontWeight: '700' },
});

// ─── PartnerCard ─────────────────────────────────────────────────────────────
const PartnerCard = ({ partner, onPress, theme }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scaleA, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleA, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const vehicleIcon = VEHICLE_ICON[partner.vehicleType] ?? 'bicycle-outline';

  return (
    <Animated.View style={{ transform: [{ scale: scaleA }] }}>
      <TouchableOpacity
        style={[pc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={pc.top}>
          {/* Avatar */}
          <View style={[pc.avatar, { backgroundColor: TEAL + '22' }]}>
            <Ionicons name={vehicleIcon} size={22} color={TEAL} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={pc.nameRow}>
              <Text style={[pc.name, { color: theme.foreground }]}>
                {partner.firstName} {partner.lastName}
              </Text>
              <StarRating rating={partner.rating ?? 0} theme={theme} />
            </View>
            <Text style={[pc.vehicleTxt, { color: theme.hint }]}>
              {partner.vehicleType?.charAt(0) + partner.vehicleType?.slice(1).toLowerCase()} • {partner.vehiclePlate ?? '—'}
            </Text>
          </View>

          {/* ETA */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[pc.eta, { color: GREEN }]}>~{partner.etaMinutes} min</Text>
            <Text style={[pc.dist, { color: theme.hint }]}>{partner.distanceKm} km</Text>
          </View>
        </View>

        {/* Pills */}
        <View style={pc.pills}>
          <Pill icon={vehicleIcon}          label={partner.vehicleType}           color={PURPLE} theme={theme} />
          <Pill icon="navigate-outline"     label={`${partner.distanceKm} km`}    color={theme.hint} theme={theme} />
          <Pill icon="time-outline"         label={`~${partner.etaMinutes} min`}  color={theme.hint} theme={theme} />
          <Pill icon="star-outline"         label={`${partner.totalDeliveries ?? 0} deliveries`} color={theme.hint} theme={theme} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
const pc = StyleSheet.create({
  card:       { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12, overflow: 'hidden' },
  top:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar:     { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  name:       { fontSize: 15, fontWeight: '800' },
  vehicleTxt: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  eta:        { fontSize: 18, fontWeight: '900' },
  dist:       { fontSize: 11, fontWeight: '500', marginTop: 1 },
  pills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

// ─── ConfirmSheet (booking mode only) ────────────────────────────────────────
const ConfirmSheet = ({ partner, routeParams, onClose, onSuccess, theme }) => {
  const [requesting, setRequesting] = useState(false);
  const slideA = useRef(new Animated.Value(height)).current;
  const accentFg = theme.accentFg ?? '#111111';

  const feeEstimate = routeParams.feeEstimate ?? 0;
  const vehicleIcon = VEHICLE_ICON[partner.vehicleType] ?? 'bicycle-outline';

  useEffect(() => {
    Animated.spring(slideA, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, []);

  const close = () =>
    Animated.timing(slideA, { toValue: height, duration: 250, useNativeDriver: true }).start(onClose);

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const res = await deliveryAPI.requestDelivery({
        pickupAddress:      routeParams.pickupAddress,
        pickupLat:          routeParams.pickupLat,
        pickupLng:          routeParams.pickupLng,
        pickupContact:      routeParams.pickupContact,
        dropoffAddress:     routeParams.dropoffAddress,
        dropoffLat:         routeParams.dropoffLat,
        dropoffLng:         routeParams.dropoffLng,
        dropoffContact:     routeParams.dropoffContact,
        packageDescription: routeParams.packageDescription,
        packageWeight:      parseFloat(routeParams.packageWeight) || 0,
        notes:              routeParams.packageNotes,
        estimatedFee:       feeEstimate,
        partnerId:          partner.partnerId,
      });
      onSuccess(res?.data?.delivery ?? res?.delivery);
    } catch (err) {
      Alert.alert('Could not request', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
      setRequesting(false);
    }
  };

  return (
    <View style={cs.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={close} activeOpacity={1} />
      <Animated.View style={[cs.sheet, { backgroundColor: theme.background, borderColor: theme.border, transform: [{ translateY: slideA }] }]}>
        <View style={[cs.handle, { backgroundColor: theme.border }]} />
        <Text style={[cs.sheetTitle, { color: theme.foreground }]}>Confirm Courier</Text>

        {/* Partner mini card */}
        <View style={[cs.miniCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          <View style={[cs.miniAvatar, { backgroundColor: TEAL + '22' }]}>
            <Ionicons name={vehicleIcon} size={20} color={TEAL} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.miniName, { color: theme.foreground }]}>
              {partner.firstName} {partner.lastName}
            </Text>
            <Text style={[cs.miniVehicle, { color: theme.hint }]}>
              {partner.vehicleType} • {partner.vehiclePlate ?? '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <StarRating rating={partner.rating ?? 0} theme={theme} />
            <Text style={[cs.miniEta, { color: theme.hint }]}>~{partner.etaMinutes} min away</Text>
          </View>
        </View>

        {/* Route summary */}
        {routeParams.pickupAddress ? (
          <View style={[cs.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <View style={cs.routeRow}>
              <View style={[cs.routeDot, { backgroundColor: TEAL }]} />
              <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={1}>
                {routeParams.pickupAddress}
              </Text>
            </View>
            <View style={[cs.routeLine, { backgroundColor: theme.border }]} />
            <View style={cs.routeRow}>
              <View style={[cs.routeDot, { backgroundColor: RED }]} />
              <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={1}>
                {routeParams.dropoffAddress}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Fee */}
        {feeEstimate > 0 && (
          <View style={[cs.feeRow, { backgroundColor: TEAL + '10', borderColor: TEAL + '30' }]}>
            <Ionicons name="cash-outline" size={14} color={TEAL} />
            <Text style={[cs.feeTxt, { color: TEAL }]}>
              Estimated fee: ₦{feeEstimate.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        )}

        <View style={cs.actions}>
          <TouchableOpacity style={[cs.cancelBtn, { borderColor: theme.border }]} onPress={close} disabled={requesting}>
            <Text style={[cs.cancelTxt, { color: theme.hint }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cs.confirmBtn, { backgroundColor: TEAL, opacity: requesting ? 0.75 : 1 }]}
            onPress={handleRequest}
            disabled={requesting}
            activeOpacity={0.88}
          >
            {requesting
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={cs.confirmTxt}>Request Courier</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const cs = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, padding: 24, paddingTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 18 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:  { fontSize: 20, fontWeight: '900', marginBottom: 16 },
  miniCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  miniAvatar:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  miniName:    { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  miniVehicle: { fontSize: 11, fontWeight: '500' },
  miniEta:     { fontSize: 11, marginTop: 3 },
  routeCard:   { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeLine:   { width: 2, height: 18, marginLeft: 4, marginVertical: 4 },
  routeAddr:   { flex: 1, fontSize: 13, fontWeight: '600' },
  feeRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  feeTxt:      { fontSize: 13, fontWeight: '700', flex: 1 },
  actions:     { flexDirection: 'row', gap: 12 },
  cancelBtn:   { flex: 1, height: 54, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:   { fontSize: 15, fontWeight: '700' },
  confirmBtn:  { flex: 2, height: 54, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmTxt:  { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function NearbyPartnersScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const params = route.params ?? {};

  // Detect mode: if dropoffAddress is present, we're in booking flow
  const isBookingMode = !!(params.dropoffAddress && params.pickupContact);

  const [partners,         setPartners]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [selectedPartner,  setSelectedPartner]  = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await deliveryAPI.getNearbyPartners({
        pickupLat: params.pickupLat,
        pickupLng: params.pickupLng,
        radiusKm:  params.radiusKm ?? 15,
      });
      // Filter out any mock/stub partners just like RequestRideScreen does for drivers
      const list = (res?.data?.partners ?? res?.partners ?? [])
        .filter(p => !String(p.partnerId).startsWith('mock-'));
      setPartners(list);
    } catch (err) {
      Alert.alert('Could not load couriers', err?.message ?? 'Please try again.');
      setPartners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [params]);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handlePartnerPress = (partner) => {
    if (isBookingMode) {
      // Full booking — show confirm sheet
      setSelectedPartner(partner);
    } else {
      // Browse mode — jump to RequestDelivery with partner pre-selected
      navigation.navigate('RequestDelivery', {
        preSelectedPartnerId:   partner.partnerId,
        preSelectedPartnerName: `${partner.firstName} ${partner.lastName}`,
      });
    }
  };

  const handleDeliveryRequested = (delivery) => {
    setSelectedPartner(null);
    if (navigation.replace) {
      navigation.replace('DeliveryTracking', { deliveryId: delivery?.id, delivery });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>
              {isBookingMode ? 'Choose a Courier' : 'Nearby Couriers'}
            </Text>
            <Text style={[s.headerSub, { color: theme.hint }]} numberOfLines={1}>
              {params.pickupAddress?.split('(')[0]?.trim() ?? 'Your area'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.refreshBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh-outline" size={18} color={TEAL} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Route strip — only shown in booking mode */}
      {isBookingMode && params.dropoffAddress ? (
        <View style={[s.routeStrip, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
          <View style={s.routeItem}>
            <View style={[s.routeDot, { backgroundColor: TEAL }]} />
            <Text style={[s.routeText, { color: theme.foreground }]} numberOfLines={1}>
              {params.pickupAddress?.split(',')[0] ?? '—'}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={13} color={theme.hint} style={{ marginHorizontal: 4 }} />
          <View style={s.routeItem}>
            <View style={[s.routeDot, { backgroundColor: RED }]} />
            <Text style={[s.routeText, { color: theme.foreground }]} numberOfLines={1}>
              {params.dropoffAddress?.split(',')[0] ?? '—'}
            </Text>
          </View>
          {params.feeEstimate ? (
            <Text style={[s.fareChip, { color: GREEN }]}>
              ₦{Number(params.feeEstimate).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={TEAL} size="large" />
          <Text style={[s.loadingTxt, { color: theme.hint }]}>Finding couriers near you...</Text>
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
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
            }
            ListHeaderComponent={
              partners.length > 0 && (
                <View style={s.listHeader}>
                  <Text style={[s.listCount, { color: theme.hint }]}>
                    {partners.length} courier{partners.length !== 1 ? 's' : ''} nearby
                  </Text>
                  {!isBookingMode && (
                    <View style={[s.modeBadge, { backgroundColor: TEAL + '15', borderColor: TEAL + '30' }]}>
                      <Ionicons name="information-circle-outline" size={11} color={TEAL} />
                      <Text style={[s.modeBadgeTxt, { color: TEAL }]}>TAP TO PRE-SELECT</Text>
                    </View>
                  )}
                </View>
              )
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="bicycle-outline" size={48} color={theme.hint} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No couriers nearby</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>
                  Pull down to refresh or try again shortly.
                </Text>
                <TouchableOpacity
                  style={[s.retryBtn, { backgroundColor: TEAL }]}
                  onPress={onRefresh}
                >
                  <Text style={s.retryTxt}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Animated.View>
      )}

      {/* Confirm sheet — booking mode only */}
      {selectedPartner && isBookingMode && (
        <ConfirmSheet
          partner={selectedPartner}
          routeParams={params}
          onClose={() => setSelectedPartner(null)}
          onSuccess={handleDeliveryRequested}
          theme={theme}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  refreshBtn:  { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSub:   { fontSize: 12, marginTop: 1 },
  routeStrip:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  routeItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText:   { fontSize: 12, fontWeight: '600', flex: 1 },
  fareChip:    { fontSize: 13, fontWeight: '900', marginLeft: 8 },
  list:        { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120 },
  listHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  listCount:   { fontSize: 12, fontWeight: '700' },
  modeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  modeBadgeTxt:{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt:  { fontSize: 13, fontWeight: '500', marginTop: 8 },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '800' },
  emptySub:    { fontSize: 13, textAlign: 'center', maxWidth: 240 },
  retryBtn:    { marginTop: 8, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 },
  retryTxt:    { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});