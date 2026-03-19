// mobile/src/screens/Driver/DriverHistoryScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTheme }        from '../../context/ThemeContext';
import { rideAPI }         from '../../services/api';

const DA    = '#FFB800';
const GREEN = '#5DAA72';
const RED   = '#E05555';
const PURPLE= '#A78BFA';

const STATUS_CFG = {
  COMPLETED: { color: GREEN,  icon: 'checkmark-circle-outline', label: 'Completed' },
  CANCELLED: { color: RED,    icon: 'close-circle-outline',     label: 'Cancelled' },
};

const RideCard = ({ item, theme }) => {
  const cfg  = STATUS_CFG[item.status] ?? STATUS_CFG.COMPLETED;
  const date = new Date(item.requestedAt ?? item.completedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = new Date(item.requestedAt ?? item.completedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const gross    = item.actualFare ?? item.estimatedFare ?? 0;
  const net      = item.payment?.driverEarnings ?? 0;
  const platFee  = item.payment?.platformFee ?? 0;

  return (
    <View style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: cfg.color + '30', borderLeftColor: cfg.color }]}>
      {/* Header */}
      <View style={rc.header}>
        <View style={[rc.iconWrap, { backgroundColor: DA + '18' }]}>
          <Ionicons name="car-sport-outline" size={18} color={DA} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rc.date, { color: theme.hint }]}>{date} · {time}</Text>
          {item.customer && (
            <Text style={[rc.customer, { color: theme.foreground }]}>
              {item.customer.firstName} {item.customer.lastName}
            </Text>
          )}
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

      {/* Earnings breakdown — only for completed */}
      {item.status === 'COMPLETED' && (
        <View style={[rc.earningsBox, { backgroundColor: DA + '08', borderColor: DA + '25' }]}>
          <View style={rc.earningRow}>
            <Text style={[rc.earningLbl, { color: theme.hint }]}>Gross Fare</Text>
            <Text style={[rc.earningVal, { color: theme.foreground }]}>
              ₦{Number(gross).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={rc.earningRow}>
            <Text style={[rc.earningLbl, { color: theme.hint }]}>Platform Fee</Text>
            <Text style={[rc.earningVal, { color: RED }]}>
              -₦{Number(platFee).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={[rc.earningDivider, { backgroundColor: DA + '30' }]} />
          <View style={rc.earningRow}>
            <Text style={[rc.earningLbl, { color: DA, fontWeight: '800' }]}>Your Earnings</Text>
            <Text style={[rc.earningVal, { color: DA, fontWeight: '900', fontSize: 15 }]}>
              ₦{Number(net).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      )}

      {/* Meta */}
      <View style={[rc.meta, { borderTopColor: theme.border }]}>
        <View style={rc.metaItem}>
          <Ionicons name="navigate-outline" size={11} color={theme.hint} />
          <Text style={[rc.metaTxt, { color: theme.hint }]}>{item.distance?.toFixed(1) ?? '—'} km</Text>
        </View>
        <View style={[rc.metaDiv, { backgroundColor: theme.border }]} />
        <View style={rc.metaItem}>
          <Ionicons name="cash-outline" size={11} color={theme.hint} />
          <Text style={[rc.metaTxt, { color: theme.hint }]}>{item.payment?.method ?? 'CASH'}</Text>
        </View>
        {item.rating && (
          <>
            <View style={[rc.metaDiv, { backgroundColor: theme.border }]} />
            <View style={rc.metaItem}>
              <Ionicons name="star" size={11} color="#C9A96E" />
              <Text style={[rc.metaTxt, { color: theme.hint }]}>{item.rating.rating}/5</Text>
              {item.rating.comment && (
                <Text style={[rc.metaTxt, { color: theme.hint }]} numberOfLines={1}>
                  · "{item.rating.comment}"
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
};
const rc = StyleSheet.create({
  card:        { borderRadius: 18, borderWidth: 1, borderLeftWidth: 3, padding: 16, marginBottom: 12 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  iconWrap:    { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  date:        { fontSize: 10, marginBottom: 2 },
  customer:    { fontSize: 13, fontWeight: '700' },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusTxt:   { fontSize: 10, fontWeight: '700' },
  route:       { marginBottom: 12 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeLine:   { width: 1.5, height: 10, marginLeft: 3.5, marginVertical: 3 },
  addr:        { flex: 1, fontSize: 13, fontWeight: '600' },
  earningsBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, gap: 7 },
  earningRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earningLbl:  { fontSize: 12 },
  earningVal:  { fontSize: 13, fontWeight: '700' },
  earningDivider:{ height: 1, marginVertical: 2 },
  meta:        { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, gap: 8, flexWrap: 'wrap' },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaDiv:     { width: 1, height: 12 },
  metaTxt:     { fontSize: 11 },
});

export default function DriverHistoryScreen({ navigation }) {
  const { theme, mode } = useTheme();

  const [rides,      setRides]      = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  const totals = {
    completed: rides.filter(r => r.status === 'COMPLETED').length,
    cancelled: rides.filter(r => r.status === 'CANCELLED').length,
    earned:    rides.filter(r => r.status === 'COMPLETED')
                    .reduce((s, r) => s + (r.payment?.driverEarnings ?? 0), 0),
  };

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset && p > totalPages) return;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const res  = await rideAPI.getRideHistory({ page: p, limit: 15 });
      const list = res?.data?.rides ?? [];
      setRides(prev => reset ? list : [...prev, ...list]);
      setTotalPages(res?.data?.pagination?.pages ?? 1);
      setPage(reset ? 2 : p + 1);
    } catch {}
    finally {
      setLoading(false); setRefreshing(false); setLoadingMore(false);
      Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [page, totalPages]);

  useEffect(() => { load(true); }, []);

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
          <View>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Ride History</Text>
            <Text style={[s.headerSub, { color: theme.hint }]}>{rides.length} rides loaded</Text>
          </View>
        </View>

        {/* Summary strip */}
        {!loading && (
          <View style={[s.summaryStrip, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
            <View style={s.sumItem}>
              <Text style={[s.sumVal, { color: GREEN }]}>{totals.completed}</Text>
              <Text style={[s.sumLbl, { color: theme.hint }]}>Completed</Text>
            </View>
            <View style={[s.sumDiv, { backgroundColor: theme.border }]} />
            <View style={s.sumItem}>
              <Text style={[s.sumVal, { color: RED }]}>{totals.cancelled}</Text>
              <Text style={[s.sumLbl, { color: theme.hint }]}>Cancelled</Text>
            </View>
            <View style={[s.sumDiv, { backgroundColor: theme.border }]} />
            <View style={s.sumItem}>
              <Text style={[s.sumVal, { color: DA }]}>
                ₦{totals.earned.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
              <Text style={[s.sumLbl, { color: theme.hint }]}>Net Earned</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={DA} size="large" /></View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={rides}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <RideCard item={item} theme={theme} />}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={DA} />}
            onEndReached={() => { if (!loadingMore && page <= totalPages) { setLoadingMore(true); load().finally(() => setLoadingMore(false)); } }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={DA} style={{ marginVertical: 16 }} /> : null}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="car-outline" size={48} color={theme.hint} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No rides yet</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>Your completed rides will appear here</Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '900' },
  headerSub:    { fontSize: 11, marginTop: 1 },
  summaryStrip: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1 },
  sumItem:      { flex: 1, alignItems: 'center' },
  sumVal:       { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  sumLbl:       { fontSize: 10, fontWeight: '600' },
  sumDiv:       { width: 1, marginVertical: 4 },
  list:         { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 60 },
  empty:        { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '800' },
  emptySub:     { fontSize: 13, textAlign: 'center' },
});