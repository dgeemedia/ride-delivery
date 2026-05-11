// mobile/src/screens/Customer/NearbyPartnersScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Alert, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[pc.eta, { color: GREEN }]}>~{partner.etaMinutes} min</Text>
            <Text style={[pc.dist, { color: theme.hint }]}>{partner.distanceKm} km</Text>
          </View>
        </View>

        <View style={pc.pills}>
          <Pill icon={vehicleIcon}          label={partner.vehicleType}                      color={PURPLE}     theme={theme} />
          <Pill icon="navigate-outline"     label={`${partner.distanceKm} km`}               color={theme.hint} theme={theme} />
          <Pill icon="time-outline"         label={`~${partner.etaMinutes} min`}             color={theme.hint} theme={theme} />
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

// ─── ConfirmSheet — fully scrollable, sticky CTA ─────────────────────────────
const ConfirmSheet = ({ partner, routeParams, onClose, onSuccess, theme }) => {
  const [requesting, setRequesting] = useState(false);
  const slideA    = useRef(new Animated.Value(height)).current;
  const insets    = useSafeAreaInsets();

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
      {/* Dimmed backdrop */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={close} activeOpacity={1} />

      <Animated.View
        style={[
          cs.sheet,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            maxHeight: height * 0.88,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY: slideA }],
          },
        ]}
      >
        {/* Handle */}
        <View style={[cs.handle, { backgroundColor: theme.border }]} />

        {/* Title row with close button */}
        <View style={cs.titleRow}>
          <Text style={[cs.sheetTitle, { color: theme.foreground }]}>Confirm Courier</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={24} color={theme.hint} />
          </TouchableOpacity>
        </View>

        {/* ── Scrollable body ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={cs.scrollContent}
        >
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

          {/* Package summary (if booking mode) */}
          {routeParams.packageDescription ? (
            <View style={[cs.packageCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={cs.packageRow}>
                <Ionicons name="cube-outline" size={14} color={TEAL} />
                <Text style={[cs.packageLabel, { color: theme.hint }]}>Package</Text>
                <Text style={[cs.packageValue, { color: theme.foreground }]} numberOfLines={1}>
                  {routeParams.packageDescription}
                </Text>
              </View>
              {routeParams.packageWeight ? (
                <View style={cs.packageRow}>
                  <Ionicons name="scale-outline" size={14} color={TEAL} />
                  <Text style={[cs.packageLabel, { color: theme.hint }]}>Weight</Text>
                  <Text style={[cs.packageValue, { color: theme.foreground }]}>
                    {routeParams.packageWeight} kg
                  </Text>
                </View>
              ) : null}
              {routeParams.packageNotes ? (
                <View style={cs.packageRow}>
                  <Ionicons name="document-text-outline" size={14} color={TEAL} />
                  <Text style={[cs.packageLabel, { color: theme.hint }]}>Note</Text>
                  <Text style={[cs.packageValue, { color: theme.foreground }]} numberOfLines={2}>
                    {routeParams.packageNotes}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Route card */}
          {routeParams.pickupAddress ? (
            <View style={[cs.routeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={cs.routeRow}>
                <View style={[cs.routeDot, { backgroundColor: TEAL }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[cs.routeLabel, { color: theme.hint }]}>Pickup</Text>
                  <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={2}>
                    {routeParams.pickupAddress}
                  </Text>
                  {routeParams.pickupContact ? (
                    <Text style={[cs.routeContact, { color: theme.hint }]}>{routeParams.pickupContact}</Text>
                  ) : null}
                </View>
              </View>
              <View style={[cs.routeLine, { backgroundColor: theme.border }]} />
              <View style={cs.routeRow}>
                <View style={[cs.routeDot, { backgroundColor: RED }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[cs.routeLabel, { color: theme.hint }]}>Dropoff</Text>
                  <Text style={[cs.routeAddr, { color: theme.foreground }]} numberOfLines={2}>
                    {routeParams.dropoffAddress}
                  </Text>
                  {routeParams.dropoffContact ? (
                    <Text style={[cs.routeContact, { color: theme.hint }]}>{routeParams.dropoffContact}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Fee estimate */}
          {feeEstimate > 0 && (
            <View style={[cs.feeCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={cs.fareRow}>
                <Text style={[cs.fareLabel, { color: theme.hint }]}>Distance</Text>
                <Text style={[cs.fareValue, { color: theme.foreground }]}>
                  {routeParams.distanceKm ? `${routeParams.distanceKm} km` : '—'}
                </Text>
              </View>
              {routeParams.etaMinutes ? (
                <View style={cs.fareRow}>
                  <Text style={[cs.fareLabel, { color: theme.hint }]}>Est. time</Text>
                  <Text style={[cs.fareValue, { color: theme.foreground }]}>~{routeParams.etaMinutes} min</Text>
                </View>
              ) : null}
              <View style={[cs.fareDivider, { backgroundColor: theme.border }]} />
              <View style={cs.fareRow}>
                <Text style={[cs.fareLabel, { color: theme.hint, fontWeight: '700' }]}>Estimated fee</Text>
                <Text style={[cs.fareValue, { color: TEAL, fontWeight: '800' }]}>
                  ₦{feeEstimate.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          )}

          {/* Info note */}
          <View style={[cs.infoNote, { backgroundColor: TEAL + '10', borderColor: TEAL + '30' }]}>
            <Ionicons name="information-circle-outline" size={14} color={TEAL} />
            <Text style={[cs.infoNoteTxt, { color: TEAL }]}>
              Final fee may vary based on actual distance and time. Payment is cash on delivery unless otherwise agreed.
            </Text>
          </View>

          {/* Pills summary */}
          <View style={cs.pillsRow}>
            <Pill icon={vehicleIcon}      label={partner.vehicleType}                       color={PURPLE}     theme={theme} />
            <Pill icon="navigate-outline" label={`${partner.distanceKm} km`}                color={theme.hint} theme={theme} />
            <Pill icon="time-outline"     label={`~${partner.etaMinutes} min`}              color={theme.hint} theme={theme} />
            <Pill icon="star-outline"     label={`${partner.totalDeliveries ?? 0} deliveries`} color={theme.hint} theme={theme} />
          </View>
        </ScrollView>

        {/* ── Sticky action bar ── */}
        <View style={[cs.actions, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[cs.cancelBtn, { borderColor: theme.border }]}
            onPress={close}
            disabled={requesting}
          >
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
  overlay:      { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet:        {
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingTop: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 18,
  },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 14 },
  sheetTitle:   { fontSize: 20, fontWeight: '900' },
  scrollContent:{ paddingHorizontal: 24, paddingBottom: 8 },
  miniCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  miniAvatar:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  miniName:     { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  miniVehicle:  { fontSize: 11, fontWeight: '500' },
  miniEta:      { fontSize: 11, marginTop: 3 },
  packageCard:  { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, gap: 8 },
  packageRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  packageLabel: { fontSize: 12, fontWeight: '600', width: 58 },
  packageValue: { flex: 1, fontSize: 12, fontWeight: '600' },
  routeCard:    { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  routeRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot:     { width: 10, height: 10, borderRadius: 5, flexShrink: 0, marginTop: 16 },
  routeLine:    { width: 2, height: 18, marginLeft: 4, marginVertical: 4 },
  routeLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  routeAddr:    { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  routeContact: { fontSize: 11, marginTop: 2 },
  feeCard:      { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  fareRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  fareLabel:    { fontSize: 13 },
  fareValue:    { fontSize: 13, fontWeight: '600' },
  fareDivider:  { height: 1, marginVertical: 6 },
  infoNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  infoNoteTxt:  { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  pillsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  // Sticky actions
  actions:      { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 14, borderTopWidth: 1 },
  cancelBtn:    { flex: 1, height: 54, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:    { fontSize: 15, fontWeight: '700' },
  confirmBtn:   { flex: 2, height: 54, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmTxt:   { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function NearbyPartnersScreen({ route, navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const params          = route.params ?? {};

  // Detect mode: if dropoffAddress is present, we're in booking flow
  const isBookingMode = !!(params.dropoffAddress && params.pickupContact);

  const [partners,        setPartners]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);

  const fadeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await deliveryAPI.getNearbyPartners({
        pickupLat: params.pickupLat,
        pickupLng: params.pickupLng,
        radiusKm:  params.radiusKm ?? 15,
      });
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
      setSelectedPartner(partner);
    } else {
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
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* ── Fixed header ── */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: theme.background }}>
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

      {/* ── Route strip — only in booking mode ── */}
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

      {/* ── Scrollable list ── */}
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
            contentContainerStyle={[
              s.list,
              { paddingBottom: insets.bottom + 32 },
            ]}
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

      {/* ── ConfirmSheet — booking mode only ── */}
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
  list:        { paddingHorizontal: 16, paddingTop: 14 },
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