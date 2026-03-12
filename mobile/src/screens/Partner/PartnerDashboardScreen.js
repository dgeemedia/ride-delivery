// mobile/src/screens/Partner/PartnerDashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, StatusBar, Dimensions, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { partnerAPI, userAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width } = Dimensions.get('window');
const ACCENT = '#34D399';

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, value, label, color = ACCENT }) => (
  <View style={[sc.card, { borderColor: color + '25' }]}>
    <View style={[sc.iconWrap, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[sc.value, { color }]}>{value}</Text>
    <Text style={sc.label}>{label}</Text>
  </View>
);

const sc = StyleSheet.create({
  card:    { flex: 1, backgroundColor: '#0D1A2E', borderRadius: 16, borderWidth: 1,
             padding: 16, alignItems: 'center', gap: 6 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10,
             justifyContent: 'center', alignItems: 'center' },
  value:   { fontSize: 22, fontWeight: '900' },
  label:   { fontSize: 11, color: '#5A7A9A', fontWeight: '600', textAlign: 'center' },
});

// ── Delivery request card ────────────────────────────────────────────────────
const DeliveryRequestCard = ({ request, onAccept, onDecline }) => (
  <View style={dr.card}>
    <View style={dr.header}>
      <View style={dr.pill}>
        <Ionicons name="flash" size={12} color={ACCENT} />
        <Text style={dr.pillTxt}>NEW DELIVERY</Text>
      </View>
      <Text style={dr.fee}>₦{request.estimatedFee?.toLocaleString()}</Text>
    </View>

    <View style={dr.infoRow}>
      <View style={[dr.badge, { backgroundColor: ACCENT + '15' }]}>
        <Ionicons name="cube-outline" size={14} color={ACCENT} />
        <Text style={[dr.badgeTxt, { color: ACCENT }]}>{request.packageDescription}</Text>
      </View>
      {request.packageWeight && (
        <View style={[dr.badge, { backgroundColor: '#A78BFA15' }]}>
          <Ionicons name="scale-outline" size={14} color="#A78BFA" />
          <Text style={[dr.badgeTxt, { color: '#A78BFA' }]}>{request.packageWeight} kg</Text>
        </View>
      )}
    </View>

    <View style={dr.routeBox}>
      <View style={dr.routeItem}>
        <View style={[dr.dot, { backgroundColor: ACCENT }]} />
        <View>
          <Text style={dr.routeLabel}>PICKUP</Text>
          <Text style={dr.routeAddr} numberOfLines={1}>{request.pickupAddress}</Text>
          <Text style={dr.routeContact}>{request.pickupContact}</Text>
        </View>
      </View>
      <View style={dr.routeLine} />
      <View style={dr.routeItem}>
        <View style={[dr.dot, { backgroundColor: '#FF6B6B' }]} />
        <View>
          <Text style={dr.routeLabel}>DROP-OFF</Text>
          <Text style={dr.routeAddr} numberOfLines={1}>{request.dropoffAddress}</Text>
          <Text style={dr.routeContact}>{request.dropoffContact}</Text>
        </View>
      </View>
    </View>

    <View style={dr.meta}>
      <Ionicons name="navigate-outline" size={13} color="#5A7A9A" />
      <Text style={dr.metaTxt}>{request.distance?.toFixed(1) ?? '—'} km</Text>
    </View>

    <View style={dr.actions}>
      <TouchableOpacity style={dr.decline} onPress={onDecline}>
        <Text style={dr.declineTxt}>Decline</Text>
      </TouchableOpacity>
      <TouchableOpacity style={dr.accept} onPress={onAccept}>
        <Ionicons name="checkmark" size={16} color="#080C18" />
        <Text style={dr.acceptTxt}>Accept</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const dr = StyleSheet.create({
  card:    { backgroundColor: '#001A10', borderRadius: 20, borderWidth: 1.5,
             borderColor: ACCENT + '50', padding: 18, marginBottom: 16 },
  header:  { flexDirection: 'row', justifyContent: 'space-between',
             alignItems: 'center', marginBottom: 14 },
  pill:    { flexDirection: 'row', alignItems: 'center', gap: 5,
             backgroundColor: ACCENT + '20', borderRadius: 8,
             paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 1 },
  fee:     { fontSize: 22, fontWeight: '900', color: ACCENT },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge:   { flexDirection: 'row', alignItems: 'center', gap: 5,
             borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeTxt:{ fontSize: 12, fontWeight: '700' },
  routeBox:{ gap: 0, marginBottom: 12 },
  routeItem:{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot:     { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine:{ width: 2, height: 20, backgroundColor: '#0D2A1A', marginLeft: 4 },
  routeLabel:{ fontSize: 10, color: '#5A7A9A', fontWeight: '700', letterSpacing: 1 },
  routeAddr:{ fontSize: 14, color: '#FFF', fontWeight: '600', marginTop: 2 },
  routeContact:{ fontSize: 12, color: '#5A7A9A', marginTop: 1 },
  meta:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  metaTxt: { fontSize: 12, color: '#5A7A9A', marginLeft: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  decline: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1,
             borderColor: '#1A2840', justifyContent: 'center', alignItems: 'center' },
  declineTxt: { color: '#5A7A9A', fontWeight: '700' },
  accept:  { flex: 2, height: 46, borderRadius: 12, backgroundColor: ACCENT,
             flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  acceptTxt:  { color: '#080C18', fontWeight: '800', fontSize: 15 },
});

// ── Earnings card ────────────────────────────────────────────────────────────
const EarningsCard = ({ total, today }) => (
  <View style={ec.card}>
    <Text style={ec.title}>EARNINGS</Text>
    <View style={ec.row}>
      <View style={ec.item}>
        <Text style={ec.label}>Today</Text>
        <Text style={ec.value}>₦{Number(today ?? 0).toLocaleString()}</Text>
      </View>
      <View style={ec.divider} />
      <View style={ec.item}>
        <Text style={ec.label}>All Time</Text>
        <Text style={ec.value}>₦{Number(total ?? 0).toLocaleString()}</Text>
      </View>
      <View style={ec.divider} />
      <View style={ec.item}>
        <Text style={ec.label}>Pending</Text>
        <Text style={[ec.value, { color: ACCENT }]}>₦0</Text>
      </View>
    </View>
  </View>
);

const ec = StyleSheet.create({
  card:    { backgroundColor: '#001A10', borderRadius: 20, borderWidth: 1,
             borderColor: ACCENT + '25', padding: 20, marginBottom: 16 },
  title:   { fontSize: 11, fontWeight: '800', color: ACCENT + '99',
             letterSpacing: 2, marginBottom: 14 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  item:    { flex: 1, alignItems: 'center' },
  label:   { fontSize: 11, color: '#5A7A9A', fontWeight: '600', marginBottom: 4 },
  value:   { fontSize: 18, fontWeight: '900', color: '#FFF' },
  divider: { width: 1, height: 36, backgroundColor: '#0D2A1A' },
});

// ── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function PartnerDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [isOnline,     setIsOnline]     = useState(false);
  const [toggling,     setToggling]     = useState(false);
  const [stats,        setStats]        = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [incomingJob,  setIncomingJob]  = useState(null);

  const pulseA = useRef(new Animated.Value(1)).current;
  const fadeA  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseA, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseA, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      pulseA.setValue(1);
    }
    return () => anim?.stop();
  }, [isOnline]);

  useEffect(() => {
    socketService.on('delivery:request', (data) => setIncomingJob(data));
    socketService.on('delivery:cancelled', () => setIncomingJob(null));
    return () => {
      socketService.off('delivery:request');
      socketService.off('delivery:cancelled');
    };
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, profileRes] = await Promise.allSettled([
        userAPI.getStats(),
        partnerAPI.getProfile(),
      ]);
      if (statsRes.status   === 'fulfilled') setStats(statsRes.value?.data);
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value?.data);
        setIsOnline(profileRes.value?.data?.deliveryProfile?.isOnline ?? false);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      const next = !isOnline;

      if (!profile?.deliveryProfile?.isApproved && next) {
        Alert.alert(
          'Account Pending Approval',
          'Your courier account is under review. Upload your ID document in Profile to speed things up.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Upload ID', onPress: () => navigation.navigate('Profile') },
          ],
        );
        return;
      }

      await partnerAPI.updateStatus({
        isOnline: next,
        currentLat: 6.5244,   // TODO: replace with real expo-location coords
        currentLng: 3.3792,
      });

      if (next) socketService.goOnline({ latitude: 6.5244, longitude: 3.3792 });
      else      socketService.goOffline();

      setIsOnline(next);
    } catch {
      Alert.alert('Error', 'Failed to update status. Check your connection.');
    } finally {
      setToggling(false);
    }
  };

  const isApproved = profile?.deliveryProfile?.isApproved;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />
      <View style={s.orb} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View>
              <Text style={s.eyebrow}>COURIER DASHBOARD</Text>
              <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
            </View>
            <TouchableOpacity
              style={s.profileBtn}
              onPress={() => navigation.navigate('Profile')}>
              <View style={s.avatarMini}>
                <Text style={s.avatarTxt}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Approval banner ── */}
          {!isApproved && (
            <TouchableOpacity
              style={s.approvalBanner}
              onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="alert-circle-outline" size={18} color={ACCENT} />
              <Text style={s.approvalTxt}>
                Account pending approval. Tap to upload your ID document.
              </Text>
              <Ionicons name="chevron-forward" size={16} color={ACCENT} />
            </TouchableOpacity>
          )}

          {/* ── Online toggle ── */}
          <View style={[s.toggleCard, isOnline && s.toggleCardOn]}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleStatus}>
                {isOnline ? '🟢 Available for Deliveries' : '⚫ Currently Offline'}
              </Text>
              <Text style={s.toggleSub}>
                {isOnline ? 'You\'ll receive nearby delivery requests' : 'Toggle on to start earning'}
              </Text>
            </View>
            {toggling ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <Animated.View style={{ transform: [{ scale: isOnline ? pulseA : 1 }] }}>
                <Switch
                  value={isOnline}
                  onValueChange={toggleOnline}
                  trackColor={{ false: '#1A2840', true: ACCENT + '80' }}
                  thumbColor={isOnline ? ACCENT : '#3A5070'}
                  ios_backgroundColor="#1A2840"
                />
              </Animated.View>
            )}
          </View>

          {/* ── Incoming delivery job ── */}
          {incomingJob && isOnline && (
            <DeliveryRequestCard
              request={incomingJob}
              onAccept={() => {
                navigation.navigate('ActiveDelivery', { deliveryId: incomingJob.id });
                setIncomingJob(null);
              }}
              onDecline={() => setIncomingJob(null)}
            />
          )}

          {/* ── Earnings ── */}
          <EarningsCard total={stats?.totalEarnings ?? 0} today={0} />

          {/* ── Stats ── */}
          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginBottom: 16 }} />
          ) : (
            <View style={s.statsRow}>
              <StatCard icon="cube-outline"    value={stats?.completedDeliveries ?? 0}  label="Deliveries"       />
              <StatCard icon="star-outline"    value={(stats?.rating ?? 0).toFixed(1)} label="Rating"  color="#FFB800" />
              <StatCard icon="flash-outline"   value={`${stats?.completedDeliveries > 0 ? '96' : '—'}%`} label="On Time" color="#A78BFA" />
            </View>
          )}

          {/* ── Quick links ── */}
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.linkGrid}>
            {[
              { icon: 'card-outline',         label: 'My Documents',    color: ACCENT,    screen: 'CourierDocuments' },
              { icon: 'wallet-outline',        label: 'Earnings',        color: '#FFB800', screen: 'PartnerEarnings' },
              { icon: 'list-outline',          label: 'Delivery History',color: '#A78BFA', screen: 'PartnerHistory' },
              { icon: 'help-circle-outline',   label: 'Support',         color: '#5A7A9A', screen: 'Support' },
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

          {/* ── Vehicle info summary ── */}
          {profile?.deliveryProfile && (
            <>
              <Text style={s.sectionTitle}>Your Vehicle</Text>
              <View style={s.vehicleCard}>
                <Ionicons name="bicycle-outline" size={24} color={ACCENT} />
                <View style={{ flex: 1 }}>
                  <Text style={s.vehicleType}>{profile.deliveryProfile.vehicleType}</Text>
                  {profile.deliveryProfile.vehiclePlate && (
                    <Text style={s.vehiclePlate}>{profile.deliveryProfile.vehiclePlate}</Text>
                  )}
                </View>
                <View style={[s.vehicleStatus, { backgroundColor: isApproved ? '#34D39920' : '#FFB80020' }]}>
                  <Text style={[s.vehicleStatusTxt, { color: isApproved ? ACCENT : '#FFB800' }]}>
                    {isApproved ? 'Approved' : 'Pending'}
                  </Text>
                </View>
              </View>
            </>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#080C18' },
  orb:    { position: 'absolute', width: width * 1.1, height: width * 1.1,
            borderRadius: width * 0.55, backgroundColor: ACCENT,
            top: -width * 0.7, left: -width * 0.3, opacity: 0.04 },
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
                    backgroundColor: '#001A10', borderRadius: 14, borderWidth: 1,
                    borderColor: ACCENT + '30', padding: 14, marginBottom: 16 },
  approvalTxt:    { flex: 1, fontSize: 13, color: ACCENT + 'CC', lineHeight: 18 },

  toggleCard:  { backgroundColor: '#0D1A2E', borderRadius: 20, borderWidth: 1,
                 borderColor: '#1A2840', padding: 20, flexDirection: 'row',
                 alignItems: 'center', gap: 14, marginBottom: 16 },
  toggleCardOn:{ backgroundColor: '#001A10', borderColor: ACCENT + '40' },
  toggleStatus:{ fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  toggleSub:   { fontSize: 12, color: '#5A7A9A' },

  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 24 },

  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#3A5070',
                  letterSpacing: 2, marginBottom: 12 },
  linkGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  linkCard:  { width: (width - 58) / 2, backgroundColor: '#0D1A2E',
               borderRadius: 16, borderWidth: 1, padding: 16,
               alignItems: 'center', gap: 8 },
  linkLabel: { fontSize: 13, fontWeight: '700' },

  vehicleCard:  { backgroundColor: '#0D1A2E', borderRadius: 16, borderWidth: 1,
                  borderColor: ACCENT + '25', padding: 16,
                  flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  vehicleType:  { fontSize: 15, fontWeight: '800', color: '#FFF', marginBottom: 2 },
  vehiclePlate: { fontSize: 12, color: '#5A7A9A' },
  vehicleStatus:{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  vehicleStatusTxt: { fontSize: 12, fontWeight: '700' },
});