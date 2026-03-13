// mobile/src/screens/Driver/DriverDashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, StatusBar, Dimensions, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { driverAPI, userAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width } = Dimensions.get('window');

// Driver screens keep their role accent (#FFB800 = Amber) for role identity,
// but all background/surface/border colors pull from the user's chosen theme.
const DRIVER_ACCENT = '#FFB800';

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, value, label, color }) => {
  const { theme } = useTheme();
  return (
    <View style={[sc.card, { backgroundColor: theme.backgroundAlt, borderColor: (color || DRIVER_ACCENT) + '25' }]}>
      <View style={[sc.iconWrap, { backgroundColor: (color || DRIVER_ACCENT) + '15' }]}>
        <Ionicons name={icon} size={20} color={color || DRIVER_ACCENT} />
      </View>
      <Text style={[sc.value, { color: color || DRIVER_ACCENT }]}>{value}</Text>
      <Text style={[sc.label, { color: theme.muted }]}>{label}</Text>
    </View>
  );
};
const sc = StyleSheet.create({
  card:    { flex:1, borderRadius:16, borderWidth:1, padding:16, alignItems:'center', gap:6 },
  iconWrap:{ width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center' },
  value:   { fontSize:22, fontWeight:'900' },
  label:   { fontSize:11, fontWeight:'600', textAlign:'center' },
});

// ── Ride request card ────────────────────────────────────────────────────────
const RideRequestCard = ({ request, onAccept, onDecline }) => {
  const { theme } = useTheme();
  return (
    <View style={[rr.card, { backgroundColor: theme.backgroundAlt, borderColor: DRIVER_ACCENT + '50' }]}>
      <View style={rr.header}>
        <View style={[rr.pill, { backgroundColor: DRIVER_ACCENT + '20' }]}>
          <Ionicons name="flash" size={12} color={DRIVER_ACCENT} />
          <Text style={[rr.pillTxt, { color: DRIVER_ACCENT }]}>INCOMING RIDE</Text>
        </View>
        <Text style={[rr.fare, { color: DRIVER_ACCENT }]}>₦{request.estimatedFare?.toLocaleString()}</Text>
      </View>
      <View style={rr.route}>
        <View style={[rr.dot, { backgroundColor: DRIVER_ACCENT }]} />
        <View style={[rr.line, { backgroundColor: theme.border }]} />
        <View style={[rr.dot, { backgroundColor: '#FF6B6B' }]} />
      </View>
      <View style={{ flex:1, gap:8, marginLeft:20 }}>
        <Text style={[rr.addr, { color: theme.foreground }]} numberOfLines={1}>{request.pickupAddress}</Text>
        <Text style={[rr.addr, { color: theme.foreground }]} numberOfLines={1}>{request.dropoffAddress}</Text>
      </View>
      <View style={rr.meta}>
        <Ionicons name="navigate-outline" size={13} color={theme.muted} />
        <Text style={[rr.metaTxt, { color: theme.muted }]}>{request.distance?.toFixed(1) ?? '—'} km</Text>
        <Ionicons name="time-outline" size={13} color={theme.muted} style={{ marginLeft:10 }} />
        <Text style={[rr.metaTxt, { color: theme.muted }]}>{request.duration ?? '—'} min</Text>
      </View>
      <View style={rr.actions}>
        <TouchableOpacity style={[rr.decline, { borderColor: theme.border }]} onPress={onDecline}>
          <Text style={[rr.declineTxt, { color: theme.muted }]}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[rr.accept, { backgroundColor: DRIVER_ACCENT }]} onPress={onAccept}>
          <Ionicons name="checkmark" size={16} color="#080C18" />
          <Text style={rr.acceptTxt}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const rr = StyleSheet.create({
  card:       { borderRadius:20, borderWidth:1.5, padding:18, marginBottom:16 },
  header:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  pill:       { flexDirection:'row', alignItems:'center', gap:5, borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  pillTxt:    { fontSize:10, fontWeight:'800', letterSpacing:1 },
  fare:       { fontSize:22, fontWeight:'900' },
  route:      { position:'absolute', left:18, top:64, alignItems:'center' },
  dot:        { width:8, height:8, borderRadius:4 },
  line:       { width:2, height:32 },
  addr:       { fontSize:14, fontWeight:'600' },
  meta:       { flexDirection:'row', alignItems:'center', marginTop:10, marginLeft:20, marginBottom:14 },
  metaTxt:    { fontSize:12, marginLeft:4 },
  actions:    { flexDirection:'row', gap:10 },
  decline:    { flex:1, height:46, borderRadius:12, borderWidth:1, justifyContent:'center', alignItems:'center' },
  declineTxt: { fontWeight:'700' },
  accept:     { flex:2, height:46, borderRadius:12, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:6 },
  acceptTxt:  { color:'#080C18', fontWeight:'800', fontSize:15 },
});

// ── Earnings bar ─────────────────────────────────────────────────────────────
const EarningsBar = ({ todayEarnings, weeklyEarnings }) => {
  const { theme } = useTheme();
  return (
    <View style={[eb.card, { backgroundColor: theme.backgroundAlt, borderColor: DRIVER_ACCENT + '25' }]}>
      <Text style={[eb.title, { color: DRIVER_ACCENT + '99' }]}>EARNINGS</Text>
      <View style={eb.row}>
        {[['Today', todayEarnings], ['This Week', weeklyEarnings], ['Pending', 0]].map(([lbl, val], i) => (
          <React.Fragment key={lbl}>
            {i > 0 && <View style={[eb.divider, { backgroundColor: theme.border }]} />}
            <View style={eb.item}>
              <Text style={[eb.label, { color: theme.muted }]}>{lbl}</Text>
              <Text style={[eb.value, { color: i === 2 ? DRIVER_ACCENT : theme.foreground }]}>
                ₦{Number(val ?? 0).toLocaleString()}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};
const eb = StyleSheet.create({
  card:    { borderRadius:20, borderWidth:1, padding:20, marginBottom:16 },
  title:   { fontSize:11, fontWeight:'800', letterSpacing:2, marginBottom:14 },
  row:     { flexDirection:'row', alignItems:'center' },
  item:    { flex:1, alignItems:'center' },
  label:   { fontSize:11, fontWeight:'600', marginBottom:4 },
  value:   { fontSize:18, fontWeight:'900' },
  divider: { width:1, height:36 },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function DriverDashboardScreen({ navigation }) {
  const { user }         = useAuth();
  const { theme, mode }  = useTheme();
  const [isOnline,     setIsOnline]     = useState(false);
  const [toggling,     setToggling]     = useState(false);
  const [stats,        setStats]        = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [incomingRide, setIncomingRide] = useState(null);

  const pulseA = useRef(new Animated.Value(1)).current;
  const fadeA  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue:1, duration:600, useNativeDriver:true }).start();
  }, []);

  useEffect(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(Animated.sequence([
        Animated.timing(pulseA, { toValue:1.15, duration:800, useNativeDriver:true }),
        Animated.timing(pulseA, { toValue:1,    duration:800, useNativeDriver:true }),
      ]));
      anim.start();
    } else { pulseA.setValue(1); }
    return () => anim?.stop();
  }, [isOnline]);

  useEffect(() => {
    socketService.on('ride:request',  (data) => setIncomingRide(data));
    socketService.on('ride:cancelled', ()    => setIncomingRide(null));
    return () => { socketService.off('ride:request'); socketService.off('ride:cancelled'); };
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, profileRes] = await Promise.allSettled([userAPI.getStats(), driverAPI.getProfile()]);
      if (statsRes.status   === 'fulfilled') setStats(statsRes.value?.data);
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value?.data);
        setIsOnline(profileRes.value?.data?.driverProfile?.isOnline ?? false);
      }
    } catch {}
    finally { setLoadingStats(false); }
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const next = !isOnline;
      if (!profile?.driverProfile?.isApproved && next) {
        Alert.alert('Account Pending', 'Your driver account is awaiting approval.');
        return;
      }
      await driverAPI.updateStatus({ isOnline: next, currentLat: 6.5244, currentLng: 3.3792 });
      if (next) socketService.goOnline({ latitude:6.5244, longitude:3.3792 });
      else      socketService.goOffline();
      setIsOnline(next);
    } catch {
      Alert.alert('Error', 'Failed to update status. Check your connection.');
    } finally { setToggling(false); }
  };

  const approvalStatus = profile?.driverProfile?.isApproved;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.orb, { backgroundColor: DRIVER_ACCENT }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={[s.eyebrow, { color: DRIVER_ACCENT + '99' }]}>DRIVER DASHBOARD</Text>
              <Text style={[s.name, { color: theme.foreground }]}>{user?.firstName} {user?.lastName}</Text>
            </View>
            <TouchableOpacity style={s.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <View style={[s.avatarMini, { backgroundColor: DRIVER_ACCENT + '20', borderColor: DRIVER_ACCENT + '50' }]}>
                <Text style={[s.avatarTxt, { color: DRIVER_ACCENT }]}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Approval banner */}
          {!approvalStatus && (
            <View style={[s.approvalBanner, { backgroundColor: theme.backgroundAlt, borderColor: DRIVER_ACCENT + '30' }]}>
              <Ionicons name="time-outline" size={18} color={DRIVER_ACCENT} />
              <Text style={[s.approvalTxt, { color: DRIVER_ACCENT + 'CC' }]}>Your account is under review. We'll notify you once approved.</Text>
            </View>
          )}

          {/* Online toggle */}
          <View style={[s.toggleCard, { backgroundColor: theme.backgroundAlt, borderColor: isOnline ? DRIVER_ACCENT + '40' : theme.border }]}>
            <View>
              <Text style={[s.toggleLabel, { color: theme.foreground }]}>
                {isOnline ? '🟢 You are Online' : '⚫ You are Offline'}
              </Text>
              <Text style={[s.toggleSub, { color: theme.muted }]}>
                {isOnline ? 'Accepting ride requests' : 'Toggle to start accepting rides'}
              </Text>
            </View>
            <Animated.View style={{ transform:[{ scale: isOnline ? pulseA : 1 }] }}>
              {toggling ? (
                <ActivityIndicator color={DRIVER_ACCENT} size="small" />
              ) : (
                <Switch value={isOnline} onValueChange={toggleOnline}
                  trackColor={{ false: theme.border, true: DRIVER_ACCENT + '80' }}
                  thumbColor={isOnline ? DRIVER_ACCENT : theme.hint}
                  ios_backgroundColor={theme.border} />
              )}
            </Animated.View>
          </View>

          {/* Incoming ride */}
          {incomingRide && isOnline && (
            <RideRequestCard
              request={incomingRide}
              onAccept={() => { navigation.navigate('ActiveRide', { rideId: incomingRide.id }); setIncomingRide(null); }}
              onDecline={() => setIncomingRide(null)}
            />
          )}

          {/* Earnings */}
          <EarningsBar todayEarnings={0} weeklyEarnings={stats?.totalEarnings ?? 0} />

          {/* Stats */}
          {loadingStats ? (
            <ActivityIndicator color={DRIVER_ACCENT} style={{ marginBottom:16 }} />
          ) : (
            <View style={s.statsGrid}>
              <StatCard icon="car-sport-outline"   value={stats?.completedRides ?? 0}                    label="Total Rides"  />
              <StatCard icon="star-outline"         value={(stats?.rating ?? 0).toFixed(1)}               label="Rating"       color="#A78BFA" />
              <StatCard icon="trending-up-outline"  value={`${stats?.completedRides > 0 ? '94' : '—'}%`} label="Acceptance"   color="#34D399" />
            </View>
          )}

          {/* Quick links */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
          <View style={s.linkGrid}>
            {[
              { icon:'document-text-outline', label:'My Documents',  color: DRIVER_ACCENT, screen:'DriverDocuments' },
              { icon:'wallet-outline',         label:'Earnings',      color:'#34D399',      screen:'DriverEarnings'  },
              { icon:'map-outline',            label:'Ride History',  color:'#A78BFA',      screen:'DriverHistory'   },
              { icon:'help-circle-outline',    label:'Support',       color: theme.muted,   screen:'Support'         },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={[s.linkCard, { backgroundColor: theme.backgroundAlt, borderColor: item.color + '25' }]}
                onPress={() => navigation.navigate(item.screen)}>
                <Ionicons name={item.icon} size={22} color={item.color} />
                <Text style={[s.linkLabel, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex:1 },
  orb:           { position:'absolute', width:width*1.1, height:width*1.1, borderRadius:width*0.55, top:-width*0.7, right:-width*0.3, opacity:0.04 },
  scroll:        { paddingHorizontal:24, paddingBottom:100, paddingTop:60 },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  eyebrow:       { fontSize:11, letterSpacing:3, fontWeight:'700', marginBottom:4 },
  name:          { fontSize:24, fontWeight:'900' },
  profileBtn:    { padding:4 },
  avatarMini:    { width:44, height:44, borderRadius:22, borderWidth:2, justifyContent:'center', alignItems:'center' },
  avatarTxt:     { fontSize:14, fontWeight:'800' },
  approvalBanner:{ flexDirection:'row', alignItems:'center', gap:10, borderRadius:14, borderWidth:1, padding:14, marginBottom:16 },
  approvalTxt:   { flex:1, fontSize:13, lineHeight:18 },
  toggleCard:    { borderRadius:20, borderWidth:1, padding:20, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  toggleLabel:   { fontSize:16, fontWeight:'800', marginBottom:4 },
  toggleSub:     { fontSize:12 },
  statsGrid:     { flexDirection:'row', gap:10, marginBottom:24 },
  sectionTitle:  { fontSize:11, fontWeight:'800', letterSpacing:2, marginBottom:12 },
  linkGrid:      { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:24 },
  linkCard:      { width:(width-58)/2, borderRadius:16, borderWidth:1, padding:16, alignItems:'center', gap:8 },
  linkLabel:     { fontSize:13, fontWeight:'700' },
});