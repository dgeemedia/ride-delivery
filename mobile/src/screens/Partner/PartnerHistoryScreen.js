// mobile/src/screens/Partner/PartnerHistoryScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useTheme }        from '../../context/ThemeContext';
import { deliveryAPI }     from '../../services/api';

const TEAL  = '#34D399';
const GREEN = '#5DAA72';
const RED   = '#E05555';
const GOLD  = '#FFB800';

const STATUS_CFG = {
  DELIVERED: { color: TEAL,  icon: 'checkmark-circle-outline', label: 'Delivered' },
  CANCELLED: { color: RED,   icon: 'close-circle-outline',     label: 'Cancelled' },
};

const DeliveryCard = ({ item, theme }) => {
  const cfg  = STATUS_CFG[item.status] ?? STATUS_CFG.DELIVERED;
  const date = new Date(item.requestedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = new Date(item.requestedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const gross = item.actualFee ?? item.estimatedFee ?? 0;
  const net   = item.payment?.driverEarnings ?? 0;
  const platFee = gross - net;

  return (
    <View style={[dc.card, { backgroundColor: theme.backgroundAlt, borderColor: cfg.color + '30', borderLeftColor: cfg.color }]}>
      {/* Header */}
      <View style={dc.header}>
        <View style={[dc.iconWrap, { backgroundColor: TEAL + '18' }]}>
          <Ionicons name="cube-outline" size={18} color={TEAL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[dc.date, { color: theme.hint }]}>{date} · {time}</Text>
          {item.customer && (
            <Text style={[dc.customer, { color: theme.foreground }]}>
              {item.customer.firstName} {item.customer.lastName}
            </Text>
          )}
        </View>
        <View style={[dc.statusPill, { backgroundColor: cfg.color + '15' }]}>
          <Ionicons name={cfg.icon} size={11} color={cfg.color} />
          <Text style={[dc.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Package */}
      <View style={[dc.pkgRow, { backgroundColor: TEAL + '0D', borderColor: TEAL + '25' }]}>
        <Ionicons name="bag-outline" size={13} color={TEAL} />
        <Text style={[dc.pkgTxt, { color: theme.foreground }]} numberOfLines={1}>{item.packageDescription}</Text>
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

      {/* Earnings breakdown */}
      {item.status === 'DELIVERED' && (
        <View style={[dc.earningsBox, { backgroundColor: TEAL + '08', borderColor: TEAL + '25' }]}>
          <View style={dc.earningRow}>
            <Text style={[dc.earningLbl, { color: theme.hint }]}>Gross Fee</Text>
            <Text style={[dc.earningVal, { color: theme.foreground }]}>
              ₦{Number(gross).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={dc.earningRow}>
            <Text style={[dc.earningLbl, { color: theme.hint }]}>Platform Fee (15%)</Text>
            <Text style={[dc.earningVal, { color: RED }]}>
              -₦{Number(platFee).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={[dc.earningDivider, { backgroundColor: TEAL + '30' }]} />
          <View style={dc.earningRow}>
            <Text style={[dc.earningLbl, { color: TEAL, fontWeight: '800' }]}>Your Earnings</Text>
            <Text style={[dc.earningVal, { color: TEAL, fontWeight: '900', fontSize: 15 }]}>
              ₦{Number(net).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      )}

      {/* Meta */}
      <View style={[dc.meta, { borderTopColor: theme.border }]}>
        <View style={dc.metaItem}>
          <Ionicons name="navigate-outline" size={11} color={theme.hint} />
          <Text style={[dc.metaTxt, { color: theme.hint }]}>{item.distance?.toFixed(1) ?? '—'} km</Text>
        </View>
        {item.payment?.method && (
          <>
            <View style={[dc.metaDiv, { backgroundColor: theme.border }]} />
            <View style={dc.metaItem}>
              <Ionicons name="cash-outline" size={11} color={theme.hint} />
              <Text style={[dc.metaTxt, { color: theme.hint }]}>{item.payment.method}</Text>
            </View>
          </>
        )}
        {item.rating && (
          <>
            <View style={[dc.metaDiv, { backgroundColor: theme.border }]} />
            <View style={dc.metaItem}>
              <Ionicons name="star" size={11} color="#C9A96E" />
              <Text style={[dc.metaTxt, { color: theme.hint }]}>{item.rating.rating}/5</Text>
            </View>
          </>
        )}
        {item.recipientName && (
          <>
            <View style={[dc.metaDiv, { backgroundColor: theme.border }]} />
            <View style={dc.metaItem}>
              <Ionicons name="person-outline" size={11} color={theme.hint} />
              <Text style={[dc.metaTxt, { color: theme.hint }]}>{item.recipientName}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};
const dc = StyleSheet.create({
  card:          { borderRadius: 18, borderWidth: 1, borderLeftWidth: 3, padding: 16, marginBottom: 12 },
  header:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  iconWrap:      { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  date:          { fontSize: 10, marginBottom: 2 },
  customer:      { fontSize: 13, fontWeight: '700' },
  statusPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusTxt:     { fontSize: 10, fontWeight: '700' },
  pkgRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  pkgTxt:        { flex: 1, fontSize: 12, fontWeight: '600' },
  pkgWeight:     { fontSize: 10 },
  route:         { marginBottom: 10 },
  routeRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot:           { width: 8, height: 8, borderRadius: 4, marginTop: 3, flexShrink: 0 },
  routeLine:     { width: 1.5, height: 14, marginLeft: 3.5, marginVertical: 3 },
  addr:          { fontSize: 13, fontWeight: '600' },
  contact:       { fontSize: 11, marginTop: 1 },
  earningsBox:   { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10, gap: 7 },
  earningRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  earningLbl:    { fontSize: 12 },
  earningVal:    { fontSize: 13, fontWeight: '700' },
  earningDivider:{ height: 1, marginVertical: 2 },
  meta:          { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, gap: 8, flexWrap: 'wrap' },
  metaItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaDiv:       { width: 1, height: 12 },
  metaTxt:       { fontSize: 11 },
});

export default function PartnerHistoryScreen({ navigation }) {
  const { theme, mode } = useTheme();

  const [deliveries, setDeliveries] = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  const totals = {
    delivered: deliveries.filter(d => d.status === 'DELIVERED').length,
    cancelled: deliveries.filter(d => d.status === 'CANCELLED').length,
    earned:    deliveries.filter(d => d.status === 'DELIVERED')
                         .reduce((s, d) => s + (d.payment?.driverEarnings ?? 0), 0),
  };

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset && p > totalPages) return;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const res  = await deliveryAPI.getDeliveryHistory({ page: p, limit: 15 });
      const list = res?.data?.deliveries ?? [];
      setDeliveries(prev => reset ? list : [...prev, ...list]);
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
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Delivery History</Text>
            <Text style={[s.headerSub, { color: theme.hint }]}>{deliveries.length} deliveries loaded</Text>
          </View>
        </View>

        {!loading && (
          <View style={[s.summaryStrip, { backgroundColor: theme.backgroundAlt, borderBottomColor: theme.border }]}>
            <View style={s.sumItem}>
              <Text style={[s.sumVal, { color: TEAL }]}>{totals.delivered}</Text>
              <Text style={[s.sumLbl, { color: theme.hint }]}>Delivered</Text>
            </View>
            <View style={[s.sumDiv, { backgroundColor: theme.border }]} />
            <View style={s.sumItem}>
              <Text style={[s.sumVal, { color: RED }]}>{totals.cancelled}</Text>
              <Text style={[s.sumLbl, { color: theme.hint }]}>Cancelled</Text>
            </View>
            <View style={[s.sumDiv, { backgroundColor: theme.border }]} />
            <View style={s.sumItem}>
              <Text style={[s.sumVal, { color: TEAL }]}>
                ₦{totals.earned.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
              <Text style={[s.sumLbl, { color: theme.hint }]}>Net Earned</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={TEAL} size="large" /></View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={deliveries}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <DeliveryCard item={item} theme={theme} />}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={TEAL} />}
            onEndReached={() => { if (!loadingMore && page <= totalPages) { setLoadingMore(true); load().finally(() => setLoadingMore(false)); } }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={TEAL} style={{ marginVertical: 16 }} /> : null}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="cube-outline" size={48} color={theme.hint} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No deliveries yet</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>Your completed deliveries will appear here</Text>
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