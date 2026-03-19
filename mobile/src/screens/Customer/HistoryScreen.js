// mobile/src/screens/Customer/HistoryScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI, deliveryAPI } from '../../services/api';

const { width } = Dimensions.get('window');
const DA     = '#FFB800';
const GREEN  = '#5DAA72';
const RED    = '#E05555';
const PURPLE = '#A78BFA';
const TEAL   = '#34D399';

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────
const RIDE_STATUS = {
  COMPLETED: { color: GREEN,  icon: 'checkmark-circle-outline', label: 'Completed'  },
  CANCELLED: { color: RED,    icon: 'close-circle-outline',     label: 'Cancelled'  },
};
const DEL_STATUS = {
  DELIVERED: { color: TEAL,   icon: 'checkmark-circle-outline', label: 'Delivered'  },
  CANCELLED: { color: RED,    icon: 'close-circle-outline',     label: 'Cancelled'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RideCard
// ─────────────────────────────────────────────────────────────────────────────
const RideCard = ({ item, theme, onPress }) => {
  const cfg  = RIDE_STATUS[item.status] ?? RIDE_STATUS.COMPLETED;
  const date = new Date(item.requestedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = new Date(item.requestedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const fare = item.actualFare ?? item.estimatedFare ?? 0;

  return (
    <TouchableOpacity
      style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: cfg.color + '30' }]}
      onPress={() => onPress(item, 'ride')}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={rc.header}>
        <View style={[rc.iconWrap, { backgroundColor: DA + '18' }]}>
          <Ionicons name="car-outline" size={18} color={DA} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rc.typeLabel, { color: DA }]}>RIDE</Text>
          <Text style={[rc.date, { color: theme.hint }]}>{date} · {time}</Text>
        </View>
        <View style={[rc.statusPill, { backgroundColor: cfg.color + '15' }]}>
          <Ionicons name={cfg.icon} size={11} color={cfg.color} />
          <Text style={[rc.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Route */}
      <View style={rc.route}>
        <View style={rc.routeRow}>
          <View style={[rc.dot, { backgroundColor: DA }]} />
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.pickupAddress}</Text>
        </View>
        <View style={[rc.routeLine, { backgroundColor: theme.border }]} />
        <View style={rc.routeRow}>
          <View style={[rc.dot, { backgroundColor: RED }]} />
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.dropoffAddress}</Text>
        </View>
      </View>

      {/* Footer strip */}
      <View style={[rc.footer, { borderTopColor: theme.border }]}>
        <View style={rc.footerItem}>
          <Ionicons name="navigate-outline" size={12} color={theme.hint} />
          <Text style={[rc.footerTxt, { color: theme.hint }]}>{item.distance?.toFixed(1) ?? '—'} km</Text>
        </View>
        <View style={[rc.footerDivider, { backgroundColor: theme.border }]} />
        <View style={rc.footerItem}>
          <Ionicons name="cash-outline" size={12} color={theme.hint} />
          <Text style={[rc.footerTxt, { color: theme.hint }]}>
            {item.payment?.method ?? 'CASH'}
          </Text>
        </View>
        <View style={[rc.footerDivider, { backgroundColor: theme.border }]} />
        <View style={rc.footerItem}>
          <Text style={[rc.fareAmt, { color: item.status === 'CANCELLED' ? RED : DA }]}>
            {item.status === 'CANCELLED' ? '—' : `₦${Number(fare).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
          </Text>
        </View>
        {item.rating && (
          <>
            <View style={[rc.footerDivider, { backgroundColor: theme.border }]} />
            <View style={rc.footerItem}>
              <Ionicons name="star" size={11} color="#C9A96E" />
              <Text style={[rc.footerTxt, { color: theme.hint }]}>{item.rating.rating}/5</Text>
            </View>
          </>
        )}
        {/* Driver name */}
        {item.driver && (
          <View style={rc.driverChip}>
            <Ionicons name="person-outline" size={11} color={theme.hint} />
            <Text style={[rc.footerTxt, { color: theme.hint }]}>
              {item.driver.firstName} {item.driver.lastName}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
const rc = StyleSheet.create({
  card:        { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  iconWrap:    { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  typeLabel:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  date:        { fontSize: 11 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusTxt:   { fontSize: 10, fontWeight: '700' },
  route:       { marginBottom: 14 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeLine:   { width: 1.5, height: 12, marginLeft: 3.5, marginVertical: 3 },
  addr:        { flex: 1, fontSize: 13, fontWeight: '600' },
  footer:      { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, flexWrap: 'wrap', gap: 8 },
  footerItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerDivider:{ width: 1, height: 14 },
  footerTxt:   { fontSize: 11, fontWeight: '600' },
  fareAmt:     { fontSize: 15, fontWeight: '900' },
  driverChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
});

// ─────────────────────────────────────────────────────────────────────────────
// DeliveryCard
// ─────────────────────────────────────────────────────────────────────────────
const DeliveryCard = ({ item, theme, onPress }) => {
  const cfg  = DEL_STATUS[item.status] ?? DEL_STATUS.DELIVERED;
  const date = new Date(item.requestedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = new Date(item.requestedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const fee  = item.actualFee ?? item.estimatedFee ?? 0;

  return (
    <TouchableOpacity
      style={[dc.card, { backgroundColor: theme.backgroundAlt, borderColor: cfg.color + '30' }]}
      onPress={() => onPress(item, 'delivery')}
      activeOpacity={0.85}
    >
      <View style={dc.header}>
        <View style={[dc.iconWrap, { backgroundColor: TEAL + '18' }]}>
          <Ionicons name="cube-outline" size={18} color={TEAL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[dc.typeLabel, { color: TEAL }]}>DELIVERY</Text>
          <Text style={[dc.date, { color: theme.hint }]}>{date} · {time}</Text>
        </View>
        <View style={[dc.statusPill, { backgroundColor: cfg.color + '15' }]}>
          <Ionicons name={cfg.icon} size={11} color={cfg.color} />
          <Text style={[dc.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Package info */}
      <View style={[dc.pkgRow, { backgroundColor: TEAL + '0D', borderColor: TEAL + '25' }]}>
        <Ionicons name="cube-outline" size={13} color={TEAL} />
        <Text style={[dc.pkgTxt, { color: theme.foreground }]} numberOfLines={1}>
          {item.packageDescription}
        </Text>
        {item.packageWeight && (
          <Text style={[dc.pkgWeight, { color: theme.hint }]}>{item.packageWeight} kg</Text>
        )}
      </View>

      {/* Route */}
      <View style={dc.route}>
        <View style={dc.routeRow}>
          <View style={[dc.dot, { backgroundColor: TEAL }]} />
          <View style={{ flex: 1 }}>
            <Text style={[dc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.pickupAddress}</Text>
            <Text style={[dc.contact, { color: theme.hint }]}>{item.pickupContact}</Text>
          </View>
        </View>
        <View style={[dc.routeLine, { backgroundColor: theme.border }]} />
        <View style={dc.routeRow}>
          <View style={[dc.dot, { backgroundColor: RED }]} />
          <View style={{ flex: 1 }}>
            <Text style={[dc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.dropoffAddress}</Text>
            <Text style={[dc.contact, { color: theme.hint }]}>{item.dropoffContact}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[dc.footer, { borderTopColor: theme.border }]}>
        <View style={dc.footerItem}>
          <Ionicons name="navigate-outline" size={12} color={theme.hint} />
          <Text style={[dc.footerTxt, { color: theme.hint }]}>{item.distance?.toFixed(1) ?? '—'} km</Text>
        </View>
        <View style={[dc.footerDivider, { backgroundColor: theme.border }]} />
        <View style={dc.footerItem}>
          <Text style={[dc.fareAmt, { color: item.status === 'CANCELLED' ? RED : TEAL }]}>
            {item.status === 'CANCELLED' ? '—' : `₦${Number(fee).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
          </Text>
        </View>
        {item.partner && (
          <View style={dc.partnerChip}>
            <Ionicons name="bicycle-outline" size={11} color={theme.hint} />
            <Text style={[dc.footerTxt, { color: theme.hint }]}>
              {item.partner.firstName} {item.partner.lastName}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
const dc = StyleSheet.create({
  card:        { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  iconWrap:    { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  typeLabel:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  date:        { fontSize: 11 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusTxt:   { fontSize: 10, fontWeight: '700' },
  pkgRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  pkgTxt:      { flex: 1, fontSize: 12, fontWeight: '600' },
  pkgWeight:   { fontSize: 10, fontWeight: '600' },
  route:       { marginBottom: 12 },
  routeRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot:         { width: 8, height: 8, borderRadius: 4, marginTop: 3, flexShrink: 0 },
  routeLine:   { width: 1.5, height: 16, marginLeft: 3.5, marginVertical: 3 },
  addr:        { fontSize: 13, fontWeight: '600' },
  contact:     { fontSize: 11, marginTop: 1 },
  footer:      { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, flexWrap: 'wrap', gap: 8 },
  footerItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerDivider:{ width: 1, height: 14 },
  footerTxt:   { fontSize: 11, fontWeight: '600' },
  fareAmt:     { fontSize: 15, fontWeight: '900' },
  partnerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }) {
  const { theme, mode } = useTheme();

  const [tab,          setTab]          = useState('rides');
  const [rides,        setRides]        = useState([]);
  const [deliveries,   setDeliveries]   = useState([]);
  const [ridePage,     setRidePage]     = useState(1);
  const [delPage,      setDelPage]      = useState(1);
  const [rideTotalP,   setRideTotalP]   = useState(1);
  const [delTotalP,    setDelTotalP]    = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  const loadRides = useCallback(async (reset = false) => {
    const p = reset ? 1 : ridePage;
    if (!reset && p > rideTotalP) return;
    try {
      const res = await rideAPI.getRideHistory({ page: p, limit: 15 });
      const list = res?.data?.rides ?? [];
      setRides(prev => reset ? list : [...prev, ...list]);
      setRideTotalP(res?.data?.pagination?.pages ?? 1);
      setRidePage(reset ? 2 : p + 1);
    } catch {}
  }, [ridePage, rideTotalP]);

  const loadDeliveries = useCallback(async (reset = false) => {
    const p = reset ? 1 : delPage;
    if (!reset && p > delTotalP) return;
    try {
      const res = await deliveryAPI.getDeliveryHistory({ page: p, limit: 15 });
      const list = res?.data?.deliveries ?? [];
      setDeliveries(prev => reset ? list : [...prev, ...list]);
      setDelTotalP(res?.data?.pagination?.pages ?? 1);
      setDelPage(reset ? 2 : p + 1);
    } catch {}
  }, [delPage, delTotalP]);

  const loadAll = async (reset = false) => {
    if (reset) setLoading(true);
    await Promise.all([loadRides(reset), loadDeliveries(reset)]);
    setLoading(false);
    setRefreshing(false);
    Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  useEffect(() => { loadAll(true); }, []);

  const onRefresh = () => { setRefreshing(true); loadAll(true); };

  const handleCardPress = (item, type) => {
    if (type === 'ride') {
      navigation.navigate('RideTracking', { rideId: item.id });
    } else {
      navigation.navigate('DeliveryTracking', { deliveryId: item.id });
    }
  };

  const rideStats = {
    total:     rides.length,
    completed: rides.filter(r => r.status === 'COMPLETED').length,
    spent:     rides.filter(r => r.status === 'COMPLETED').reduce((s, r) => s + (r.actualFare ?? r.estimatedFare ?? 0), 0),
  };
  const delStats = {
    total:     deliveries.length,
    delivered: deliveries.filter(d => d.status === 'DELIVERED').length,
    spent:     deliveries.filter(d => d.status === 'DELIVERED').reduce((s, d) => s + (d.actualFee ?? d.estimatedFee ?? 0), 0),
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <SafeAreaView edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <View>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>History</Text>
            <Text style={[s.headerSub, { color: theme.hint }]}>Your rides and deliveries</Text>
          </View>
        </View>

        {/* Stats strip */}
        {!loading && (
          <View style={[s.statsStrip, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
            {tab === 'rides' ? (
              <>
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: DA }]}>{rideStats.completed}</Text>
                  <Text style={[s.statLbl, { color: theme.hint }]}>Completed</Text>
                </View>
                <View style={[s.statDiv, { backgroundColor: theme.border }]} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: DA }]}>{rideStats.total}</Text>
                  <Text style={[s.statLbl, { color: theme.hint }]}>Total</Text>
                </View>
                <View style={[s.statDiv, { backgroundColor: theme.border }]} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: DA }]}>
                    ₦{rideStats.spent.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[s.statLbl, { color: theme.hint }]}>Total Spent</Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: TEAL }]}>{delStats.delivered}</Text>
                  <Text style={[s.statLbl, { color: theme.hint }]}>Delivered</Text>
                </View>
                <View style={[s.statDiv, { backgroundColor: theme.border }]} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: TEAL }]}>{delStats.total}</Text>
                  <Text style={[s.statLbl, { color: theme.hint }]}>Total</Text>
                </View>
                <View style={[s.statDiv, { backgroundColor: theme.border }]} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: TEAL }]}>
                    ₦{delStats.spent.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[s.statLbl, { color: theme.hint }]}>Total Spent</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Tab bar */}
        <View style={[s.tabRow, { borderBottomColor: theme.border }]}>
          {[
            { key: 'rides',      label: 'Rides',      count: rideStats.total, color: DA   },
            { key: 'deliveries', label: 'Deliveries', count: delStats.total,  color: TEAL },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabTxt, { color: tab === t.key ? t.color : theme.hint }]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={[s.tabBadge, { backgroundColor: t.color + '20' }]}>
                  <Text style={[s.tabBadgeTxt, { color: t.color }]}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.accent} size="large" /></View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          {tab === 'rides' ? (
            <FlatList
              data={rides}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <RideCard item={item} theme={theme} onPress={handleCardPress} />}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DA} />}
              onEndReached={() => { if (!loadingMore) { setLoadingMore(true); loadRides().finally(() => setLoadingMore(false)); } }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={DA} style={{ marginVertical: 16 }} /> : null}
              ListEmptyComponent={<EmptyState icon="car-outline" color={DA} label="No rides yet" theme={theme} />}
            />
          ) : (
            <FlatList
              data={deliveries}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <DeliveryCard item={item} theme={theme} onPress={handleCardPress} />}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
              onEndReached={() => { if (!loadingMore) { setLoadingMore(true); loadDeliveries().finally(() => setLoadingMore(false)); } }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={TEAL} style={{ marginVertical: 16 }} /> : null}
              ListEmptyComponent={<EmptyState icon="cube-outline" color={TEAL} label="No deliveries yet" theme={theme} />}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const EmptyState = ({ icon, color, label, theme }) => (
  <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
    <Ionicons name={icon} size={48} color={theme.hint} />
    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.foreground }}>{label}</Text>
    <Text style={{ fontSize: 13, color: theme.hint }}>Your history will appear here</Text>
  </View>
);

const s = StyleSheet.create({
  root:        { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub:   { fontSize: 12, marginTop: 2 },
  statsStrip:  { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  statItem:    { flex: 1, alignItems: 'center' },
  statVal:     { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  statLbl:     { fontSize: 10, fontWeight: '600' },
  statDiv:     { width: 1, marginVertical: 4 },
  tabRow:      { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  tabTxt:      { fontSize: 13, fontWeight: '700' },
  tabBadge:    { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeTxt: { fontSize: 10, fontWeight: '800' },
  list:        { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 },
});