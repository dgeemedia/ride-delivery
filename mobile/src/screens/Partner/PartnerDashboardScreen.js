// mobile/src/screens/Partner/PartnerDashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, StatusBar, Dimensions, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { partnerAPI, userAPI } from '../../services/api';
import socketService from '../../services/socket';

const { width } = Dimensions.get('window');

// Courier role accent is always Emerald — separate from user theme accent
const COURIER_ACCENT = '#34D399';

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon, value, label, color }) => {
  const { theme } = useTheme();
  const c = color || COURIER_ACCENT;
  return (
    <View style={[sc.card, { backgroundColor: theme.backgroundAlt, borderColor: c + '25' }]}>
      <View style={[sc.iconWrap, { backgroundColor: c + '15' }]}>
        <Ionicons name={icon} size={20} color={c} />
      </View>
      <Text style={[sc.value, { color: c }]}>{value}</Text>
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

// ── Delivery request card ────────────────────────────────────────────────────
const DeliveryRequestCard = ({ request, onAccept, onDecline }) => {
  const { theme } = useTheme();
  return (
    <View style={[dr.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '50' }]}>
      <View style={dr.header}>
        <View style={[dr.pill, { backgroundColor: COURIER_ACCENT + '20' }]}>
          <Ionicons name="flash" size={12} color={COURIER_ACCENT} />
          <Text style={[dr.pillTxt, { color: COURIER_ACCENT }]}>NEW DELIVERY</Text>
        </View>
        <Text style={[dr.fee, { color: COURIER_ACCENT }]}>₦{request.estimatedFee?.toLocaleString()}</Text>
      </View>
      <View style={dr.infoRow}>
        <View style={[dr.badge, { backgroundColor: COURIER_ACCENT + '15' }]}>
          <Ionicons name="cube-outline" size={14} color={COURIER_ACCENT} />
          <Text style={[dr.badgeTxt, { color: COURIER_ACCENT }]}>{request.packageDescription}</Text>
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
          <View style={[dr.dot, { backgroundColor: COURIER_ACCENT }]} />
          <View>
            <Text style={[dr.routeLabel, { color: theme.hint }]}>PICKUP</Text>
            <Text style={[dr.routeAddr, { color: theme.foreground }]} numberOfLines={1}>{request.pickupAddress}</Text>
            <Text style={[dr.routeContact, { color: theme.muted }]}>{request.pickupContact}</Text>
          </View>
        </View>
        <View style={[dr.routeLine, { backgroundColor: theme.border }]} />
        <View style={dr.routeItem}>
          <View style={[dr.dot, { backgroundColor: '#FF6B6B' }]} />
          <View>
            <Text style={[dr.routeLabel, { color: theme.hint }]}>DROP-OFF</Text>
            <Text style={[dr.routeAddr, { color: theme.foreground }]} numberOfLines={1}>{request.dropoffAddress}</Text>
            <Text style={[dr.routeContact, { color: theme.muted }]}>{request.dropoffContact}</Text>
          </View>
        </View>
      </View>
      <View style={dr.meta}>
        <Ionicons name="navigate-outline" size={13} color={theme.muted} />
        <Text style={[dr.metaTxt, { color: theme.muted }]}>{request.distance?.toFixed(1) ?? '—'} km</Text>
      </View>
      <View style={dr.actions}>
        <TouchableOpacity style={[dr.decline, { borderColor: theme.border }]} onPress={onDecline}>
          <Text style={[dr.declineTxt, { color: theme.muted }]}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[dr.accept, { backgroundColor: COURIER_ACCENT }]} onPress={onAccept}>
          <Ionicons name="checkmark" size={16} color="#080C18" />
          <Text style={dr.acceptTxt}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const dr = StyleSheet.create({
  card:        { borderRadius:20, borderWidth:1.5, padding:18, marginBottom:16 },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  pill:        { flexDirection:'row', alignItems:'center', gap:5, borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  pillTxt:     { fontSize:10, fontWeight:'800', letterSpacing:1 },
  fee:         { fontSize:22, fontWeight:'900' },
  infoRow:     { flexDirection:'row', gap:8, marginBottom:16 },
  badge:       { flexDirection:'row', alignItems:'center', gap:5, borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  badgeTxt:    { fontSize:12, fontWeight:'700' },
  routeBox:    { gap:0, marginBottom:12 },
  routeItem:   { flexDirection:'row', alignItems:'flex-start', gap:12 },
  dot:         { width:10, height:10, borderRadius:5, marginTop:4 },
  routeLine:   { width:2, height:20, marginLeft:4 },
  routeLabel:  { fontSize:10, fontWeight:'700', letterSpacing:1 },
  routeAddr:   { fontSize:14, fontWeight:'600', marginTop:2 },
  routeContact:{ fontSize:12, marginTop:1 },
  meta:        { flexDirection:'row', alignItems:'center', marginBottom:14 },
  metaTxt:     { fontSize:12, marginLeft:4 },
  actions:     { flexDirection:'row', gap:10 },
  decline:     { flex:1, height:46, borderRadius:12, borderWidth:1, justifyContent:'center', alignItems:'center' },
  declineTxt:  { fontWeight:'700' },
  accept:      { flex:2, height:46, borderRadius:12, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:6 },
  acceptTxt:   { color:'#080C18', fontWeight:'800', fontSize:15 },
});

// ── Earnings card ────────────────────────────────────────────────────────────
const EarningsCard = ({ total, today }) => {
  const { theme } = useTheme();
  return (
    <View style={[ec.card, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '25' }]}>
      <Text style={[ec.title, { color: COURIER_ACCENT + '99' }]}>EARNINGS</Text>
      <View style={ec.row}>
        {[['Today', today, false], ['All Time', total, false], ['Pending', 0, true]].map(([lbl, val, accent], i) => (
          <React.Fragment key={lbl}>
            {i > 0 && <View style={[ec.divider, { backgroundColor: theme.border }]} />}
            <View style={ec.item}>
              <Text style={[ec.label, { color: theme.muted }]}>{lbl}</Text>
              <Text style={[ec.value, { color: accent ? COURIER_ACCENT : theme.foreground }]}>₦{Number(val ?? 0).toLocaleString()}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};
const ec = StyleSheet.create({
  card:    { borderRadius:20, borderWidth:1, padding:20, marginBottom:16 },
  title:   { fontSize:11, fontWeight:'800', letterSpacing:2, marginBottom:14 },
  row:     { flexDirection:'row', alignItems:'center' },
  item:    { flex:1, alignItems:'center' },
  label:   { fontSize:11, fontWeight:'600', marginBottom:4 },
  value:   { fontSize:18, fontWeight:'900' },
  divider: { width:1, height:36 },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function PartnerDashboardScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();
  const [isOnline,    setIsOnline]    = useState(false);
  const [toggling,    setToggling]    = useState(false);
  const [stats,       setStats]       = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [incomingJob, setIncomingJob] = useState(null);

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
        Animated.timing(pulseA, { toValue:1.15, duration:900, useNativeDriver:true }),
        Animated.timing(pulseA, { toValue:1,    duration:900, useNativeDriver:true }),
      ]));
      anim.start();
    } else { pulseA.setValue(1); }
    return () => anim?.stop();
  }, [isOnline]);

  useEffect(() => {
    socketService.on('delivery:request',  (data) => setIncomingJob(data));
    socketService.on('delivery:cancelled', ()    => setIncomingJob(null));
    return () => { socketService.off('delivery:request'); socketService.off('delivery:cancelled'); };
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, profileRes] = await Promise.allSettled([userAPI.getStats(), partnerAPI.getProfile()]);
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
        Alert.alert('Account Pending Approval', 'Upload your ID document in Profile to speed things up.',
          [{ text:'Later', style:'cancel' }, { text:'Upload ID', onPress: () => navigation.navigate('Profile') }]);
        return;
      }
      await partnerAPI.updateStatus({ isOnline: next, currentLat:6.5244, currentLng:3.3792 });
      if (next) socketService.goOnline({ latitude:6.5244, longitude:3.3792 });
      else      socketService.goOffline();
      setIsOnline(next);
    } catch {
      Alert.alert('Error', 'Failed to update status. Check your connection.');
    } finally { setToggling(false); }
  };

  const isApproved = profile?.deliveryProfile?.isApproved;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.orb, { backgroundColor: COURIER_ACCENT }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={[s.eyebrow, { color: COURIER_ACCENT + '99' }]}>COURIER DASHBOARD</Text>
              <Text style={[s.name, { color: theme.foreground }]}>{user?.firstName} {user?.lastName}</Text>
            </View>
            <TouchableOpacity style={s.profileBtn} onPress={() => navigation.navigate('Profile')}>
              <View style={[s.avatarMini, { backgroundColor: COURIER_ACCENT + '20', borderColor: COURIER_ACCENT + '50' }]}>
                <Text style={[s.avatarTxt, { color: COURIER_ACCENT }]}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Approval banner */}
          {!isApproved && (
            <TouchableOpacity
              style={[s.approvalBanner, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '30' }]}
              onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="alert-circle-outline" size={18} color={COURIER_ACCENT} />
              <Text style={[s.approvalTxt, { color: COURIER_ACCENT + 'CC' }]}>Account pending approval. Tap to upload your ID document.</Text>
              <Ionicons name="chevron-forward" size={16} color={COURIER_ACCENT} />
            </TouchableOpacity>
          )}

          {/* Online toggle */}
          <View style={[s.toggleCard, { backgroundColor: theme.backgroundAlt, borderColor: isOnline ? COURIER_ACCENT + '40' : theme.border }]}>
            <View style={{ flex:1 }}>
              <Text style={[s.toggleStatus, { color: theme.foreground }]}>
                {isOnline ? '🟢 Available for Deliveries' : '⚫ Currently Offline'}
              </Text>
              <Text style={[s.toggleSub, { color: theme.muted }]}>
                {isOnline ? "You'll receive nearby delivery requests" : 'Toggle on to start earning'}
              </Text>
            </View>
            {toggling ? (
              <ActivityIndicator color={COURIER_ACCENT} size="small" />
            ) : (
              <Animated.View style={{ transform:[{ scale: isOnline ? pulseA : 1 }] }}>
                <Switch value={isOnline} onValueChange={toggleOnline}
                  trackColor={{ false: theme.border, true: COURIER_ACCENT + '80' }}
                  thumbColor={isOnline ? COURIER_ACCENT : theme.hint}
                  ios_backgroundColor={theme.border} />
              </Animated.View>
            )}
          </View>

          {/* Incoming delivery */}
          {incomingJob && isOnline && (
            <DeliveryRequestCard
              request={incomingJob}
              onAccept={() => { navigation.navigate('ActiveDelivery', { deliveryId: incomingJob.id }); setIncomingJob(null); }}
              onDecline={() => setIncomingJob(null)}
            />
          )}

          {/* Earnings */}
          <EarningsCard total={stats?.totalEarnings ?? 0} today={0} />

          {/* Stats */}
          {loading ? (
            <ActivityIndicator color={COURIER_ACCENT} style={{ marginBottom:16 }} />
          ) : (
            <View style={s.statsRow}>
              <StatCard icon="cube-outline"  value={stats?.completedDeliveries ?? 0}                      label="Deliveries" />
              <StatCard icon="star-outline"  value={(stats?.rating ?? 0).toFixed(1)}                      label="Rating"     color="#FFB800" />
              <StatCard icon="flash-outline" value={`${stats?.completedDeliveries > 0 ? '96' : '—'}%`}   label="On Time"    color="#A78BFA" />
            </View>
          )}

          {/* Quick links */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
          <View style={s.linkGrid}>
            {[
              { icon:'card-outline',       label:'My Documents',     color: COURIER_ACCENT, screen:'CourierDocuments' },
              { icon:'wallet-outline',     label:'Earnings',         color:'#FFB800',       screen:'PartnerEarnings'  },
              { icon:'list-outline',       label:'Delivery History', color:'#A78BFA',       screen:'PartnerHistory'   },
              { icon:'help-circle-outline',label:'Support',          color: theme.muted,    screen:'Support'          },
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

          {/* Vehicle info */}
          {profile?.deliveryProfile && (
            <>
              <Text style={[s.sectionTitle, { color: theme.hint }]}>YOUR VEHICLE</Text>
              <View style={[s.vehicleCard, { backgroundColor: theme.backgroundAlt, borderColor: COURIER_ACCENT + '25' }]}>
                <Ionicons name="bicycle-outline" size={24} color={COURIER_ACCENT} />
                <View style={{ flex:1 }}>
                  <Text style={[s.vehicleType, { color: theme.foreground }]}>{profile.deliveryProfile.vehicleType}</Text>
                  {profile.deliveryProfile.vehiclePlate && (
                    <Text style={[s.vehiclePlate, { color: theme.muted }]}>{profile.deliveryProfile.vehiclePlate}</Text>
                  )}
                </View>
                <View style={[s.vehicleStatus, { backgroundColor: isApproved ? COURIER_ACCENT + '20' : '#FFB80020' }]}>
                  <Text style={[s.vehicleStatusTxt, { color: isApproved ? COURIER_ACCENT : '#FFB800' }]}>
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
  root:          { flex:1 },
  orb:           { position:'absolute', width:width*1.1, height:width*1.1, borderRadius:width*0.55, top:-width*0.7, left:-width*0.3, opacity:0.04 },
  scroll:        { paddingHorizontal:24, paddingBottom:100, paddingTop:60 },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  eyebrow:       { fontSize:11, letterSpacing:3, fontWeight:'700', marginBottom:4 },
  name:          { fontSize:24, fontWeight:'900' },
  profileBtn:    { padding:4 },
  avatarMini:    { width:44, height:44, borderRadius:22, borderWidth:2, justifyContent:'center', alignItems:'center' },
  avatarTxt:     { fontSize:14, fontWeight:'800' },
  approvalBanner:{ flexDirection:'row', alignItems:'center', gap:10, borderRadius:14, borderWidth:1, padding:14, marginBottom:16 },
  approvalTxt:   { flex:1, fontSize:13, lineHeight:18 },
  toggleCard:    { borderRadius:20, borderWidth:1, padding:20, flexDirection:'row', alignItems:'center', gap:14, marginBottom:16 },
  toggleStatus:  { fontSize:16, fontWeight:'800', marginBottom:4 },
  toggleSub:     { fontSize:12 },
  statsRow:      { flexDirection:'row', gap:10, marginBottom:24 },
  sectionTitle:  { fontSize:11, fontWeight:'800', letterSpacing:2, marginBottom:12 },
  linkGrid:      { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:24 },
  linkCard:      { width:(width-58)/2, borderRadius:16, borderWidth:1, padding:16, alignItems:'center', gap:8 },
  linkLabel:     { fontSize:13, fontWeight:'700' },
  vehicleCard:   { borderRadius:16, borderWidth:1, padding:16, flexDirection:'row', alignItems:'center', gap:14, marginBottom:24 },
  vehicleType:   { fontSize:15, fontWeight:'800', marginBottom:2 },
  vehiclePlate:  { fontSize:12 },
  vehicleStatus: { borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  vehicleStatusTxt:{ fontSize:12, fontWeight:'700' },
});