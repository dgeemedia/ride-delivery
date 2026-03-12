// mobile/src/screens/Driver/DriverDashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, StatusBar, Dimensions, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { driverAPI, userAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width } = Dimensions.get('window');
const ACCENT = '#FFB800';

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, value, label, color = ACCENT, flex = 1 }) => (
  <View style={[sc.card, { flex, borderColor: color + '25' }]}>
    <View style={[sc.iconWrap, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[sc.value, { color }]}>{value}</Text>
    <Text style={sc.label}>{label}</Text>
  </View>
);

const sc = StyleSheet.create({
  card:    { backgroundColor: '#0D1A2E', borderRadius: 16, borderWidth: 1,
             padding: 16, alignItems: 'center', gap: 6 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10,
             justifyContent: 'center', alignItems: 'center' },
  value:   { fontSize: 22, fontWeight: '900' },
  label:   { fontSize: 11, color: '#5A7A9A', fontWeight: '600', textAlign: 'center' },
});

// ── Ride request card (incoming) ─────────────────────────────────────────────
const RideRequestCard = ({ request, onAccept, onDecline }) => (
  <View style={rr.card}>
    <View style={rr.header}>
      <View style={rr.pill}>
        <Ionicons name="flash" size={12} color={ACCENT} />
        <Text style={rr.pillTxt}>INCOMING RIDE</Text>
      </View>
      <Text style={rr.fare}>₦{request.estimatedFare?.toLocaleString()}</Text>
    </View>
    <View style={rr.route}>
      <View style={rr.dot} />
      <View style={rr.line} />
      <View style={[rr.dot, { backgroundColor: '#FF6B6B' }]} />
    </View>
    <View style={{ flex: 1, gap: 8, marginLeft: 20 }}>
      <Text style={rr.addr} numberOfLines={1}>{request.pickupAddress}</Text>
      <Text style={rr.addr} numberOfLines={1}>{request.dropoffAddress}</Text>
    </View>
    <View style={rr.meta}>
      <Ionicons name="navigate-outline" size={13} color="#5A7A9A" />
      <Text style={rr.metaTxt}>{request.distance?.toFixed(1) ?? '—'} km</Text>
      <Ionicons name="time-outline" size={13} color="#5A7A9A" style={{ marginLeft: 10 }} />
      <Text style={rr.metaTxt}>{request.duration ?? '—'} min</Text>
    </View>
    <View style={rr.actions}>
      <TouchableOpacity style={rr.decline} onPress={onDecline}>
        <Text style={rr.declineTxt}>Decline</Text>
      </TouchableOpacity>
      <TouchableOpacity style={rr.accept} onPress={onAccept}>
        <Ionicons name="checkmark" size={16} color="#080C18" />
        <Text style={rr.acceptTxt}>Accept</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const rr = StyleSheet.create({
  card:    { backgroundColor: '#1E1600', borderRadius: 20, borderWidth: 1.5,
             borderColor: ACCENT + '50', padding: 18, marginBottom: 16 },
  header:  { flexDirection: 'row', justifyContent: 'space-between',
             alignItems: 'center', marginBottom: 16 },
  pill:    { flexDirection: 'row', alignItems: 'center', gap: 5,
             backgroundColor: ACCENT + '20', borderRadius: 8,
             paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 1 },
  fare:    { fontSize: 22, fontWeight: '900', color: ACCENT },
  route:   { position: 'absolute', left: 18, top: 64, alignItems: 'center', gap: 0 },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  line:    { width: 2, height: 32, backgroundColor: '#3A2800' },
  addr:    { fontSize: 14, color: '#FFF', fontWeight: '600' },
  meta:    { flexDirection: 'row', alignItems: 'center', marginTop: 10,
             marginLeft: 20, marginBottom: 14 },
  metaTxt: { fontSize: 12, color: '#5A7A9A', marginLeft: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  decline: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1,
             borderColor: '#1A2840', justifyContent: 'center', alignItems: 'center' },
  declineTxt: { color: '#5A7A9A', fontWeight: '700' },
  accept:  { flex: 2, height: 46, borderRadius: 12, backgroundColor: ACCENT,
             flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  acceptTxt:  { color: '#080C18', fontWeight: '800', fontSize: 15 },
});

// ── Earnings bar ─────────────────────────────────────────────────────────────
const EarningsBar = ({ todayEarnings, weeklyEarnings }) => (
  <View style={eb.card}>
    <Text style={eb.title}>Earnings</Text>
    <View style={eb.row}>
      <View style={eb.item}>
        <Text style={eb.label}>Today</Text>
        <Text style={eb.value}>₦{Number(todayEarnings ?? 0).toLocaleString()}</Text>
      </View>
      <View style={eb.divider} />
      <View style={eb.item}>
        <Text style={eb.label}>This Week</Text>
        <Text style={eb.value}>₦{Number(weeklyEarnings ?? 0).toLocaleString()}</Text>
      </View>
      <View style={eb.divider} />
      <View style={eb.item}>
        <Text style={eb.label}>Pending</Text>
        <Text style={[eb.value, { color: '#FFB800' }]}>₦0</Text>
      </View>
    </View>
  </View>
);

const eb = StyleSheet.create({
  card:    { backgroundColor: '#1E1600', borderRadius: 20, borderWidth: 1,
             borderColor: ACCENT + '25', padding: 20, marginBottom: 16 },
  title:   { fontSize: 12, fontWeight: '800', color: ACCENT + '99',
             letterSpacing: 2, marginBottom: 14 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  item:    { flex: 1, alignItems: 'center' },
  label:   { fontSize: 11, color: '#5A7A9A', fontWeight: '600', marginBottom: 4 },
  value:   { fontSize: 18, fontWeight: '900', color: '#FFF' },
  divider: { width: 1, height: 36, backgroundColor: '#2A1E00' },
});

// ── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function DriverDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [isOnline,       setIsOnline]       = useState(false);
  const [toggling,       setToggling]       = useState(false);
  const [stats,          setStats]          = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [loadingStats,   setLoadingStats]   = useState(true);
  const [incomingRide,   setIncomingRide]   = useState(null);   // simulated incoming

  const pulseA = useRef(new Animated.Value(1)).current;
  const fadeA  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Pulse animation while online
  useEffect(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseA, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseA, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      pulseA.setValue(1);
    }
    return () => anim?.stop();
  }, [isOnline]);

  // Listen for incoming ride requests via socket
  useEffect(() => {
    socketService.on('ride:request', (data) => setIncomingRide(data));
    socketService.on('ride:cancelled', () => setIncomingRide(null));
    return () => {
      socketService.off('ride:request');
      socketService.off('ride:cancelled');
    };
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, profileRes] = await Promise.allSettled([
        userAPI.getStats(),
        driverAPI.getProfile(),
      ]);
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
        Alert.alert(
          'Account Pending',
          'Your driver account is awaiting approval. You\'ll be notified once approved.',
        );
        return;
      }

      await driverAPI.updateStatus({
        isOnline: next,
        currentLat: 6.5244,   // TODO: replace with real expo-location coords
        currentLng: 3.3792,
      });

      if (next) socketService.goOnline({ latitude: 6.5244, longitude: 3.3792 });
      else      socketService.goOffline();

      setIsOnline(next);
    } catch (e) {
      Alert.alert('Error', 'Failed to update status. Check your connection.');
    } finally {
      setToggling(false);
    }
  };

  const approvalStatus = profile?.driverProfile?.isApproved;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />
      <View style={s.orb} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View>
              <Text style={s.eyebrow}>DRIVER DASHBOARD</Text>
              <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
            </View>
            <TouchableOpacity style={s.profileBtn}
              onPress={() => navigation.navigate('Profile')}>
              <View style={s.avatarMini}>
                <Text style={s.avatarTxt}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Approval banner ── */}
          {!approvalStatus && (
            <View style={s.approvalBanner}>
              <Ionicons name="time-outline" size={18} color="#FFB800" />
              <Text style={s.approvalTxt}>
                Your account is under review. We'll notify you once approved.
              </Text>
            </View>
          )}

          {/* ── Online toggle ── */}
          <View style={[s.toggleCard, isOnline && s.toggleCardOn]}>
            <View>
              <Text style={s.toggleLabel}>
                {isOnline ? '🟢 You are Online' : '⚫ You are Offline'}
              </Text>
              <Text style={s.toggleSub}>
                {isOnline ? 'Accepting ride requests' : 'Toggle to start accepting rides'}
              </Text>
            </View>
            <Animated.View style={{ transform: [{ scale: isOnline ? pulseA : 1 }] }}>
              {toggling ? (
                <ActivityIndicator color={ACCENT} size="small" />
              ) : (
                <Switch
                  value={isOnline}
                  onValueChange={toggleOnline}
                  trackColor={{ false: '#1A2840', true: ACCENT + '80' }}
                  thumbColor={isOnline ? ACCENT : '#3A5070'}
                  ios_backgroundColor="#1A2840"
                />
              )}
            </Animated.View>
          </View>

          {/* ── Incoming ride ── */}
          {incomingRide && isOnline && (
            <RideRequestCard
              request={incomingRide}
              onAccept={() => {
                navigation.navigate('ActiveRide', { rideId: incomingRide.id });
                setIncomingRide(null);
              }}
              onDecline={() => setIncomingRide(null)}
            />
          )}

          {/* ── Earnings ── */}
          <EarningsBar
            todayEarnings={0}
            weeklyEarnings={stats?.totalEarnings ?? 0}
          />

          {/* ── Stats ── */}
          {loadingStats ? (
            <ActivityIndicator color={ACCENT} style={{ marginBottom: 16 }} />
          ) : (
            <View style={s.statsGrid}>
              <StatCard icon="car-sport-outline" value={stats?.completedRides ?? 0}  label="Total Rides"   />
              <StatCard icon="star-outline"       value={(stats?.rating ?? 0).toFixed(1)} label="Rating"  color="#A78BFA" />
              <StatCard icon="trending-up-outline" value={`${stats?.completedRides > 0 ? '94' : '—'}%`} label="Acceptance" color="#34D399" />
            </View>
          )}

          {/* ── Quick links ── */}
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.linkGrid}>
            {[
              { icon: 'document-text-outline', label: 'My Documents',   color: ACCENT,   screen: 'DriverDocuments' },
              { icon: 'wallet-outline',         label: 'Earnings',       color: '#34D399', screen: 'DriverEarnings' },
              { icon: 'map-outline',            label: 'Ride History',   color: '#A78BFA', screen: 'DriverHistory' },
              { icon: 'help-circle-outline',    label: 'Support',        color: '#5A7A9A', screen: 'Support' },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={[s.linkCard, { borderColor: item.color + '25' }]}
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
  root:   { flex: 1, backgroundColor: '#080C18' },
  orb:    { position: 'absolute', width: width * 1.1, height: width * 1.1,
            borderRadius: width * 0.55, backgroundColor: ACCENT,
            top: -width * 0.7, right: -width * 0.3, opacity: 0.04 },
  scroll: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 60 },

  header:    { flexDirection: 'row', justifyContent: 'space-between',
               alignItems: 'flex-start', marginBottom: 20 },
  eyebrow:   { fontSize: 11, letterSpacing: 3, color: ACCENT + '99',
               fontWeight: '700', marginBottom: 4 },
  name:      { fontSize: 24, fontWeight: '900', color: '#FFF' },
  profileBtn:{ padding: 4 },
  avatarMini:{ width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT + '20',
               borderWidth: 2, borderColor: ACCENT + '50',
               justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: ACCENT },

  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: '#1E1600', borderRadius: 14, borderWidth: 1,
                    borderColor: ACCENT + '30', padding: 14, marginBottom: 16 },
  approvalTxt:    { flex: 1, fontSize: 13, color: '#FFB800CC', lineHeight: 18 },

  toggleCard:  { backgroundColor: '#0D1A2E', borderRadius: 20, borderWidth: 1,
                 borderColor: '#1A2840', padding: 20,
                 flexDirection: 'row', justifyContent: 'space-between',
                 alignItems: 'center', marginBottom: 16 },
  toggleCardOn:{ backgroundColor: '#1E1600', borderColor: ACCENT + '40' },
  toggleLabel: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  toggleSub:   { fontSize: 12, color: '#5A7A9A' },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },

  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#3A5070',
                  letterSpacing: 2, marginBottom: 12 },
  linkGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  linkCard:  { width: (width - 58) / 2, backgroundColor: '#0D1A2E',
               borderRadius: 16, borderWidth: 1, padding: 16,
               alignItems: 'center', gap: 8 },
  linkLabel: { fontSize: 13, fontWeight: '700' },
});