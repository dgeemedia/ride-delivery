// mobile/src/screens/Customer/HistoryScreen.js
// ── Premium Glass Edition ─────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Animated, ActivityIndicator, RefreshControl,
  Dimensions, Platform,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI, deliveryAPI } from '../../services/api';

const { width } = Dimensions.get('window');
const GREEN = '#5DAA72';
const RED   = '#E05555';
const TEAL  = '#34D399';

// ── Glass helpers ─────────────────────────────────────────────────────────────
const G = {
  card:    (mode) => mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.80)',
  cardMid: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
  border:  (mode) => mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
  borderHi:(mode) => mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
  icon:    (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
};

const RIDE_STATUS = {
  COMPLETED: { color: GREEN, icon: 'checkmark-circle-outline', label: 'Completed' },
  CANCELLED: { color: RED,   icon: 'close-circle-outline',     label: 'Cancelled' },
};
const DEL_STATUS = {
  DELIVERED: { color: TEAL, icon: 'checkmark-circle-outline', label: 'Delivered' },
  CANCELLED: { color: RED,  icon: 'close-circle-outline',     label: 'Cancelled'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RIDE CARD
// ─────────────────────────────────────────────────────────────────────────────
const RideCard = ({ item, theme, mode, onPress }) => {
  const cfg  = RIDE_STATUS[item.status] ?? RIDE_STATUS.COMPLETED;
  const date = new Date(item.requestedAt).toLocaleDateString('en-NG',{ day:'numeric', month:'short', year:'numeric' });
  const time = new Date(item.requestedAt).toLocaleTimeString('en-NG',{ hour:'2-digit', minute:'2-digit' });
  const fare = item.actualFare ?? item.estimatedFare ?? 0;

  return (
    <TouchableOpacity
      style={[rc.card, { borderColor: G.border(mode), overflow:'hidden' }]}
      onPress={() => onPress(item,'ride')}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.92)','rgba(255,255,255,0.75)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Color accent top edge */}
      <View style={[rc.topEdge, { backgroundColor: cfg.color + '60' }]} />

      <View style={rc.header}>
        <View style={[rc.iconWrap, { backgroundColor: cfg.color + '18' }]}>
          <Ionicons name="car-outline" size={18} color={cfg.color} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={[rc.typeLabel, { color: cfg.color }]}>RIDE</Text>
          <Text style={[rc.date, { color: theme.hint }]}>{date} · {time}</Text>
        </View>
        <View style={[rc.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '30', borderWidth:1 }]}>
          <Ionicons name={cfg.icon} size={10} color={cfg.color} />
          <Text style={[rc.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={rc.route}>
        <View style={rc.routeRow}>
          <View style={[rc.dot, { backgroundColor: GREEN }]} />
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.pickupAddress}</Text>
        </View>
        <View style={[rc.routeLine, { backgroundColor: G.border(mode) }]} />
        <View style={rc.routeRow}>
          <View style={[rc.dot, { backgroundColor: RED }]} />
          <Text style={[rc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.dropoffAddress}</Text>
        </View>
      </View>

      <View style={[rc.footer, { borderTopColor: G.border(mode) }]}>
        <View style={rc.footerItem}>
          <Ionicons name="navigate-outline" size={11} color={theme.hint} />
          <Text style={[rc.footerTxt, { color: theme.hint }]}>{item.distance?.toFixed(1) ?? '—'} km</Text>
        </View>
        <View style={[rc.footerDivider, { backgroundColor: G.border(mode) }]} />
        <View style={rc.footerItem}>
          <Ionicons name="cash-outline" size={11} color={theme.hint} />
          <Text style={[rc.footerTxt, { color: theme.hint }]}>{item.payment?.method ?? 'CASH'}</Text>
        </View>
        <View style={[rc.footerDivider, { backgroundColor: G.border(mode) }]} />
        <Text style={[rc.fareAmt, { color: item.status === 'CANCELLED' ? RED : theme.foreground }]}>
          {item.status === 'CANCELLED' ? '—' : `₦${Number(fare).toLocaleString('en-NG',{ maximumFractionDigits:0 })}`}
        </Text>
        {item.rating && (
          <>
            <View style={[rc.footerDivider, { backgroundColor: G.border(mode) }]} />
            <View style={rc.footerItem}>
              <Ionicons name="star" size={11} color="#C9A96E" />
              <Text style={[rc.footerTxt, { color: theme.hint }]}>{item.rating.rating}/5</Text>
            </View>
          </>
        )}
        {item.driver && (
          <View style={rc.driverChip}>
            <Ionicons name="person-outline" size={11} color={theme.hint} />
            <Text style={[rc.footerTxt, { color: theme.hint }]}>{item.driver.firstName} {item.driver.lastName}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const rc = StyleSheet.create({
  card:         { borderRadius:20, borderWidth:1, padding:16, marginBottom:12, overflow:'hidden' },
  topEdge:      { position:'absolute', top:0, left:0, right:0, height:1 },
  header:       { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:14 },
  iconWrap:     { width:38, height:38, borderRadius:12, justifyContent:'center', alignItems:'center', flexShrink:0 },
  typeLabel:    { fontSize:9, fontWeight:'800', letterSpacing:1.8, marginBottom:2 },
  date:         { fontSize:11 },
  statusPill:   { flexDirection:'row', alignItems:'center', gap:4, borderRadius:8, paddingHorizontal:9, paddingVertical:5 },
  statusTxt:    { fontSize:9, fontWeight:'800' },
  route:        { marginBottom:14 },
  routeRow:     { flexDirection:'row', alignItems:'center', gap:8 },
  dot:          { width:8, height:8, borderRadius:4, flexShrink:0 },
  routeLine:    { width:1.5, height:12, marginLeft:3.5, marginVertical:3 },
  addr:         { flex:1, fontSize:13, fontWeight:'600' },
  footer:       { flexDirection:'row', alignItems:'center', paddingTop:12, borderTopWidth:1, flexWrap:'wrap', gap:8 },
  footerItem:   { flexDirection:'row', alignItems:'center', gap:4 },
  footerDivider:{ width:1, height:14 },
  footerTxt:    { fontSize:11, fontWeight:'600' },
  fareAmt:      { fontSize:16, fontWeight:'900' },
  driverChip:   { flexDirection:'row', alignItems:'center', gap:4, marginLeft:'auto' },
});

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY CARD
// ─────────────────────────────────────────────────────────────────────────────
const DeliveryCard = ({ item, theme, mode, onPress }) => {
  const cfg  = DEL_STATUS[item.status] ?? DEL_STATUS.DELIVERED;
  const date = new Date(item.requestedAt).toLocaleDateString('en-NG',{ day:'numeric', month:'short', year:'numeric' });
  const time = new Date(item.requestedAt).toLocaleTimeString('en-NG',{ hour:'2-digit', minute:'2-digit' });
  const fee  = item.actualFee ?? item.estimatedFee ?? 0;

  return (
    <TouchableOpacity
      style={[dc.card, { borderColor: G.border(mode), overflow:'hidden' }]}
      onPress={() => onPress(item,'delivery')}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.92)','rgba(255,255,255,0.75)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[dc.topEdge, { backgroundColor: cfg.color + '60' }]} />

      <View style={dc.header}>
        <View style={[dc.iconWrap, { backgroundColor: TEAL + '18' }]}>
          <Ionicons name="cube-outline" size={18} color={TEAL} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={[dc.typeLabel, { color: TEAL }]}>DELIVERY</Text>
          <Text style={[dc.date, { color: theme.hint }]}>{date} · {time}</Text>
        </View>
        <View style={[dc.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '30', borderWidth:1 }]}>
          <Ionicons name={cfg.icon} size={10} color={cfg.color} />
          <Text style={[dc.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={[dc.pkgRow, { backgroundColor: TEAL + '0D', borderColor: TEAL + '25' }]}>
        <Ionicons name="cube-outline" size={12} color={TEAL} />
        <Text style={[dc.pkgTxt, { color: theme.foreground }]} numberOfLines={1}>{item.packageDescription}</Text>
        {item.packageWeight && <Text style={[dc.pkgWeight, { color: theme.hint }]}>{item.packageWeight} kg</Text>}
      </View>

      <View style={dc.route}>
        <View style={dc.routeRow}>
          <View style={[dc.dot, { backgroundColor: TEAL }]} />
          <View style={{ flex:1 }}>
            <Text style={[dc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.pickupAddress}</Text>
            <Text style={[dc.contact, { color: theme.hint }]}>{item.pickupContact}</Text>
          </View>
        </View>
        <View style={[dc.routeLine, { backgroundColor: G.border(mode) }]} />
        <View style={dc.routeRow}>
          <View style={[dc.dot, { backgroundColor: RED }]} />
          <View style={{ flex:1 }}>
            <Text style={[dc.addr, { color: theme.foreground }]} numberOfLines={1}>{item.dropoffAddress}</Text>
            <Text style={[dc.contact, { color: theme.hint }]}>{item.dropoffContact}</Text>
          </View>
        </View>
      </View>

      <View style={[dc.footer, { borderTopColor: G.border(mode) }]}>
        <View style={dc.footerItem}>
          <Ionicons name="navigate-outline" size={11} color={theme.hint} />
          <Text style={[dc.footerTxt, { color: theme.hint }]}>{item.distance?.toFixed(1) ?? '—'} km</Text>
        </View>
        <View style={[dc.footerDivider, { backgroundColor: G.border(mode) }]} />
        <Text style={[dc.fareAmt, { color: item.status === 'CANCELLED' ? RED : theme.foreground }]}>
          {item.status === 'CANCELLED' ? '—' : `₦${Number(fee).toLocaleString('en-NG',{ maximumFractionDigits:0 })}`}
        </Text>
        {item.partner && (
          <View style={dc.partnerChip}>
            <Ionicons name="bicycle-outline" size={11} color={theme.hint} />
            <Text style={[dc.footerTxt, { color: theme.hint }]}>{item.partner.firstName} {item.partner.lastName}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const dc = StyleSheet.create({
  card:         { borderRadius:20, borderWidth:1, padding:16, marginBottom:12, overflow:'hidden' },
  topEdge:      { position:'absolute', top:0, left:0, right:0, height:1 },
  header:       { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:10 },
  iconWrap:     { width:38, height:38, borderRadius:12, justifyContent:'center', alignItems:'center', flexShrink:0 },
  typeLabel:    { fontSize:9, fontWeight:'800', letterSpacing:1.8, marginBottom:2 },
  date:         { fontSize:11 },
  statusPill:   { flexDirection:'row', alignItems:'center', gap:4, borderRadius:8, paddingHorizontal:9, paddingVertical:5 },
  statusTxt:    { fontSize:9, fontWeight:'800' },
  pkgRow:       { flexDirection:'row', alignItems:'center', gap:6, borderRadius:9, borderWidth:1, paddingHorizontal:10, paddingVertical:7, marginBottom:12 },
  pkgTxt:       { flex:1, fontSize:12, fontWeight:'600' },
  pkgWeight:    { fontSize:10, fontWeight:'600' },
  route:        { marginBottom:12 },
  routeRow:     { flexDirection:'row', alignItems:'flex-start', gap:8 },
  dot:          { width:8, height:8, borderRadius:4, marginTop:3, flexShrink:0 },
  routeLine:    { width:1.5, height:16, marginLeft:3.5, marginVertical:3 },
  addr:         { fontSize:13, fontWeight:'600' },
  contact:      { fontSize:11, marginTop:1 },
  footer:       { flexDirection:'row', alignItems:'center', paddingTop:12, borderTopWidth:1, flexWrap:'wrap', gap:8 },
  footerItem:   { flexDirection:'row', alignItems:'center', gap:4 },
  footerDivider:{ width:1, height:14 },
  footerTxt:    { fontSize:11, fontWeight:'600' },
  fareAmt:      { fontSize:16, fontWeight:'900' },
  partnerChip:  { flexDirection:'row', alignItems:'center', gap:4, marginLeft:'auto' },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ icon, label, theme, mode }) => (
  <View style={{ alignItems:'center', paddingTop:80, gap:14 }}>
    <View style={[em.circle, { backgroundColor: G.icon(mode), borderColor: G.border(mode) }]}>
      <Ionicons name={icon} size={32} color={theme.hint} />
    </View>
    <Text style={[em.title, { color: theme.foreground }]}>{label}</Text>
    <Text style={[em.sub, { color: theme.hint }]}>Your history will appear here</Text>
  </View>
);
const em = StyleSheet.create({
  circle: { width:70, height:70, borderRadius:22, borderWidth:1, justifyContent:'center', alignItems:'center' },
  title:  { fontSize:18, fontWeight:'800' },
  sub:    { fontSize:13 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const darkMode = mode === 'dark';

  const [tab,         setTab]         = useState('rides');
  const [rides,       setRides]       = useState([]);
  const [deliveries,  setDeliveries]  = useState([]);
  const [ridePage,    setRidePage]    = useState(1);
  const [delPage,     setDelPage]     = useState(1);
  const [rideTotalP,  setRideTotalP]  = useState(1);
  const [delTotalP,   setDelTotalP]   = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(0)).current;

  const loadRides = useCallback(async (reset = false) => {
    const p = reset ? 1 : ridePage;
    if (!reset && p > rideTotalP) return;
    try {
      const res  = await rideAPI.getRideHistory({ page:p, limit:15 });
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
      const res  = await deliveryAPI.getDeliveryHistory({ page:p, limit:15 });
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
    Animated.parallel([
      Animated.timing(fadeA,  { toValue:1, duration:450, useNativeDriver:true }),
      Animated.spring(slideA, { toValue:0, useNativeDriver:true, tension:80, friction:12 }),
    ]).start();
  };

  useEffect(() => { slideA.setValue(20); loadAll(true); }, []);

  const onRefresh = () => { setRefreshing(true); loadAll(true); };

  const handleCardPress = (item, type) => {
    if (type === 'ride') navigation.navigate('RideTracking',{ rideId: item.id });
    else navigation.navigate('DeliveryTracking',{ deliveryId: item.id });
  };

  const rideStats = {
    total:     rides.length,
    completed: rides.filter(r => r.status === 'COMPLETED').length,
    spent:     rides.filter(r => r.status === 'COMPLETED').reduce((s,r) => s + (r.actualFare ?? r.estimatedFare ?? 0), 0),
  };
  const delStats = {
    total:     deliveries.length,
    delivered: deliveries.filter(d => d.status === 'DELIVERED').length,
    spent:     deliveries.filter(d => d.status === 'DELIVERED').reduce((s,d) => s + (d.actualFee ?? d.estimatedFee ?? 0), 0),
  };

  const accentColor = tab === 'rides' ? GREEN : TEAL;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient orb */}
      <View style={[s.orb, { backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]} />

      <SafeAreaView edges={['top','left','right']} style={{ backgroundColor:'transparent' }}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: G.border(mode) }]}>
          <View>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>History</Text>
            <Text style={[s.headerSub, { color: theme.hint }]}>Your rides and deliveries</Text>
          </View>
        </View>

        {/* Stats strip */}
        {!loading && (
          <View style={[s.statsStrip, { borderBottomColor: G.border(mode), overflow:'hidden' }]}>
            <LinearGradient
              colors={darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.75)']}
              start={{ x:0, y:0 }} end={{ x:1, y:0 }}
              style={StyleSheet.absoluteFill}
            />
            {tab === 'rides' ? (
              <>
                <StatPill value={rideStats.completed} label="Completed" color={GREEN} />
                <View style={[s.statDiv, { backgroundColor: G.border(mode) }]} />
                <StatPill value={rideStats.total}     label="Total"     color={GREEN} />
                <View style={[s.statDiv, { backgroundColor: G.border(mode) }]} />
                <StatPill value={`₦${rideStats.spent.toLocaleString('en-NG',{ maximumFractionDigits:0 })}`} label="Spent" color={GREEN} />
              </>
            ) : (
              <>
                <StatPill value={delStats.delivered} label="Delivered" color={TEAL} />
                <View style={[s.statDiv, { backgroundColor: G.border(mode) }]} />
                <StatPill value={delStats.total}     label="Total"     color={TEAL} />
                <View style={[s.statDiv, { backgroundColor: G.border(mode) }]} />
                <StatPill value={`₦${delStats.spent.toLocaleString('en-NG',{ maximumFractionDigits:0 })}`} label="Spent" color={TEAL} />
              </>
            )}
          </View>
        )}

        {/* Tab row */}
        <View style={[s.tabRow, { borderBottomColor: G.border(mode) }]}>
          {[
            { key:'rides',      label:'Rides',      count: rideStats.total, color: GREEN },
            { key:'deliveries', label:'Deliveries', count: delStats.total,  color: TEAL  },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && { borderBottomColor: t.color, borderBottomWidth:2 }]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabTxt, { color: tab === t.key ? t.color : theme.hint }]}>{t.label}</Text>
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
        <View style={s.center}><ActivityIndicator color={accentColor} size="large" /></View>
      ) : (
        <Animated.View style={[{ flex:1 }, { opacity: fadeA, transform:[{ translateY: slideA }] }]}>
          {tab === 'rides' ? (
            <FlatList
              data={rides}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <RideCard item={item} theme={theme} mode={mode} onPress={handleCardPress} />}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
              onEndReached={() => { if(!loadingMore){ setLoadingMore(true); loadRides().finally(() => setLoadingMore(false)); } }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={GREEN} style={{ marginVertical:16 }} /> : null}
              ListEmptyComponent={<EmptyState icon="car-outline" label="No rides yet" theme={theme} mode={mode} />}
            />
          ) : (
            <FlatList
              data={deliveries}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <DeliveryCard item={item} theme={theme} mode={mode} onPress={handleCardPress} />}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
              onEndReached={() => { if(!loadingMore){ setLoadingMore(true); loadDeliveries().finally(() => setLoadingMore(false)); } }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={TEAL} style={{ marginVertical:16 }} /> : null}
              ListEmptyComponent={<EmptyState icon="cube-outline" label="No deliveries yet" theme={theme} mode={mode} />}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const StatPill = ({ value, label, color }) => (
  <View style={{ flex:1, alignItems:'center' }}>
    <Text style={[sp.val, { color }]}>{value}</Text>
    <Text style={sp.lbl}>{label}</Text>
  </View>
);
const sp = StyleSheet.create({
  val: { fontSize:16, fontWeight:'900', marginBottom:2 },
  lbl: { fontSize:10, fontWeight:'600', color:'#888' },
});

const s = StyleSheet.create({
  root:        { flex:1 },
  orb:         { position:'absolute', width:width*1.2, height:width*1.2, borderRadius:width*0.6, top:-width*0.5, right:-width*0.4 },
  center:      { flex:1, justifyContent:'center', alignItems:'center' },
  header:      { paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1 },
  headerTitle: { fontSize:24, fontWeight:'900', letterSpacing:-0.5 },
  headerSub:   { fontSize:12, marginTop:2 },
  statsStrip:  { flexDirection:'row', paddingVertical:14, paddingHorizontal:20, borderBottomWidth:1, overflow:'hidden' },
  statDiv:     { width:1, marginVertical:4 },
  tabRow:      { flexDirection:'row', borderBottomWidth:1 },
  tabBtn:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13 },
  tabTxt:      { fontSize:13, fontWeight:'700' },
  tabBadge:    { borderRadius:10, paddingHorizontal:7, paddingVertical:2 },
  tabBadgeTxt: { fontSize:10, fontWeight:'800' },
  list:        { paddingHorizontal:16, paddingTop:14, paddingBottom: Platform.OS === 'ios' ? 110 : 90 },
});