// mobile/src/screens/Driver/DriverHistoryScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, StatusBar,
} from 'react-native';
import AnimatedRN, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { Ionicons }     from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../../context/ThemeContext';
import { useScrollY }   from '../../context/ScrollContext';
import { rideAPI }      from '../../services/api';

const { width } = Dimensions.get('window');
const GREEN  = '#34C759';
const RED    = '#E05555';
const AMBER  = '#FFB800';

const STATUS_CONFIG = {
  COMPLETED:  { color: GREEN,  icon: 'checkmark-circle-outline', label: 'Completed'  },
  CANCELLED:  { color: RED,    icon: 'close-circle-outline',     label: 'Cancelled'  },
  IN_PROGRESS:{ color: AMBER,  icon: 'time-outline',             label: 'In Progress'},
  ACCEPTED:   { color: AMBER,  icon: 'car-outline',              label: 'Accepted'   },
  ARRIVED:    { color: AMBER,  icon: 'location-outline',         label: 'Arrived'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// RideCard
// ─────────────────────────────────────────────────────────────────────────────
const RideCard = ({ item, theme, onPress }) => {
  const cfg  = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.COMPLETED;
  const fare = Number(item.driverEarnings ?? item.fare ?? 0);
  return (
    <TouchableOpacity
      style={[rc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      {/* Status pill */}
      <View style={[rc.statusPill, { backgroundColor: cfg.color + '18' }]}>
        <Ionicons name={cfg.icon} size={12} color={cfg.color} />
        <Text style={[rc.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* Route */}
      <View style={rc.route}>
        <View style={rc.routeRow}>
          <View style={[rc.dot, { backgroundColor: GREEN }]} />
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.pickupAddress ?? 'Pickup'}</Text>
        </View>
        <View style={[rc.routeLine, { backgroundColor: theme.border }]} />
        <View style={rc.routeRow}>
          <View style={[rc.dot, { backgroundColor: RED }]} />
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.dropoffAddress ?? 'Dropoff'}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={rc.footer}>
        <Text style={[rc.date, { color: theme.hint }]}>
          {item.completedAt ?? item.createdAt
            ? new Date(item.completedAt ?? item.createdAt).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : '—'}
        </Text>
        <Text style={[rc.fare, { color: fare > 0 ? GREEN : theme.hint }]}>
          {fare > 0 ? `+₦${fare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}` : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const rc = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10 },
  statusTxt:  { fontSize: 10, fontWeight: '700' },
  route:      { marginBottom: 10 },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeLine:  { width: 1, height: 10, marginLeft: 3.5, marginVertical: 1 },
  addr:       { fontSize: 12, fontWeight: '600', flex: 1 },
  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date:       { fontSize: 11 },
  fare:       { fontSize: 14, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function DriverHistoryScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const scrollY         = useScrollY();

  // All hooks at top level — scrollHandler must not be called inside render
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const [rides,   setRides]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter,  setFilter]  = useState('ALL');

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(16)).current;

  const FILTERS = ['ALL', 'COMPLETED', 'CANCELLED'];

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRides = useCallback(async (pageNum = 1, currentFilter = filter, append = false) => {
    try {
      const params = {
        limit: 20,
        page: pageNum,
        ...(currentFilter !== 'ALL' && { status: currentFilter }),
      };
      const res   = await rideAPI.getRideHistory(params);
      const list  = res?.data?.rides ?? res?.rides ?? [];
      const total = res?.data?.total ?? res?.total ?? list.length;

      setRides(prev => append ? [...prev, ...list] : list);
      setHasMore(pageNum * 20 < total);
    } catch (err) {
      console.warn('[DriverHistory] fetch error:', err?.message);
    } finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fadeA.setValue(0);
    slideA.setValue(16);
    fetchRides(1, filter, false);
  }, [filter]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchRides(next, filter, true);
  };

  const handleRidePress = (item) => {
    if (item.status === 'COMPLETED' && !item.driverRating) {
      navigation.navigate('RateRide', { rideId: item.id });
    }
  };

  // ── Back → Dashboard home tab ─────────────────────────────────────────────
  const goHome = () => navigation.getParent()?.navigate('DashboardTab');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <SafeAreaView edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={goHome}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: theme.hint }]}>DRIVER</Text>
            <Text style={[s.title, { color: theme.foreground }]}>Ride History</Text>
          </View>
        </View>

        {/* Filter pills */}
        <View style={[s.filterRow, { borderBottomColor: theme.border }]}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  s.filterPill,
                  active
                    ? { backgroundColor: GREEN }
                    : { backgroundColor: theme.backgroundAlt, borderColor: theme.border },
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[s.filterTxt, { color: active ? '#fff' : theme.hint }]}>
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {loading && rides.length === 0 ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA, transform: [{ translateY: slideA }] }]}>
          <AnimatedRN.FlatList
            data={rides}
            keyExtractor={(item, i) => item.id ?? String(i)}
            renderItem={({ item }) => (
              <RideCard item={item} theme={theme} onPress={handleRidePress} />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={scrollHandler}
            overScrollMode="never"
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loading && rides.length > 0
                ? <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />
                : hasMore && !loading
                  ? (
                    <TouchableOpacity
                      style={[s.loadMoreBtn, { borderColor: theme.border }]}
                      onPress={loadMore}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.loadMoreTxt, { color: theme.hint }]}>Load more</Text>
                    </TouchableOpacity>
                  )
                  : null
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="car-outline" size={40} color={theme.hint} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No rides yet</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>
                  {filter !== 'ALL'
                    ? `No ${filter.toLowerCase()} rides found.`
                    : 'Your ride history will appear here.'}
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  eyebrow:     { fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 2 },
  title:       { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  filterRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  filterPill:  { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 },
  filterTxt:   { fontSize: 12, fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:        { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle:  { fontSize: 16, fontWeight: '800' },
  emptySub:    { fontSize: 13, textAlign: 'center', maxWidth: 240 },
  loadMoreBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center', marginBottom: 20 },
  loadMoreTxt: { fontSize: 13, fontWeight: '600' },
});