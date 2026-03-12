// mobile/src/screens/Customer/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const ACCENT = '#00D4FF';

// ── Small stat pill ──────────────────────────────────────────────────────────
const StatPill = ({ icon, value, label, color = ACCENT }) => (
  <View style={[pill.wrap, { borderColor: color + '30' }]}>
    <Ionicons name={icon} size={18} color={color} />
    <Text style={[pill.value, { color }]}>{value}</Text>
    <Text style={pill.label}>{label}</Text>
  </View>
);

const pill = StyleSheet.create({
  wrap:  { flex: 1, backgroundColor: '#0D1A2E', borderRadius: 14, borderWidth: 1,
           padding: 14, alignItems: 'center', gap: 4 },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11, color: '#5A7A9A', fontWeight: '600' },
});

// ── Action card ──────────────────────────────────────────────────────────────
const ActionCard = ({ emoji, title, subtitle, accent, onPress, badge }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  const press  = () => {
    Animated.sequence([
      Animated.timing(scaleA, { toValue: 0.96, duration: 80,  useNativeDriver: true }),
      Animated.spring(scaleA,  { toValue: 1,   tension: 120, friction: 6, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={press} style={{ flex: 1 }}>
      <Animated.View style={[ac.card, { transform: [{ scale: scaleA }], borderColor: accent + '30' }]}>
        {badge && (
          <View style={[ac.badge, { backgroundColor: accent }]}>
            <Text style={ac.badgeTxt}>{badge}</Text>
          </View>
        )}
        <Text style={ac.emoji}>{emoji}</Text>
        <Text style={[ac.title, { color: accent }]}>{title}</Text>
        <Text style={ac.sub}>{subtitle}</Text>
        <View style={[ac.arrow, { backgroundColor: accent + '15' }]}>
          <Ionicons name="arrow-forward" size={14} color={accent} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const ac = StyleSheet.create({
  card:  { backgroundColor: '#0D1A2E', borderRadius: 20, borderWidth: 1,
           padding: 18, minHeight: 160 },
  badge: { position: 'absolute', top: 12, right: 12, borderRadius: 8,
           paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#080C18' },
  emoji: { fontSize: 36, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sub:   { fontSize: 12, color: '#5A7A9A', lineHeight: 16, marginBottom: 12 },
  arrow: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});

// ── Wallet card ──────────────────────────────────────────────────────────────
const WalletCard = ({ balance, onTopUp }) => (
  <View style={wc.card}>
    <View style={wc.left}>
      <Text style={wc.label}>Wallet Balance</Text>
      <Text style={wc.amount}>₦{Number(balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</Text>
    </View>
    <TouchableOpacity style={wc.btn} onPress={onTopUp}>
      <Ionicons name="add" size={16} color="#080C18" />
      <Text style={wc.btnTxt}>Top Up</Text>
    </TouchableOpacity>
  </View>
);

const wc = StyleSheet.create({
  card:   { backgroundColor: '#001E2B', borderRadius: 20, borderWidth: 1,
            borderColor: ACCENT + '30', padding: 20, flexDirection: 'row',
            alignItems: 'center', marginBottom: 20 },
  left:   { flex: 1 },
  label:  { fontSize: 12, color: ACCENT + '99', fontWeight: '700',
            letterSpacing: 1.5, marginBottom: 6 },
  amount: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  btn:    { backgroundColor: ACCENT, borderRadius: 12, flexDirection: 'row',
            alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  btnTxt: { fontSize: 13, fontWeight: '800', color: '#080C18' },
});

// ── Recent activity row ──────────────────────────────────────────────────────
const ActivityRow = ({ icon, title, subtitle, amount, status }) => {
  const statusColor = status === 'COMPLETED' ? '#34D399'
    : status === 'CANCELLED' ? '#FF6B6B' : ACCENT;
  return (
    <View style={ar.row}>
      <View style={[ar.iconWrap, { backgroundColor: statusColor + '15' }]}>
        <Ionicons name={icon} size={18} color={statusColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ar.title}>{title}</Text>
        <Text style={ar.sub}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[ar.amount, { color: statusColor }]}>{amount}</Text>
        <Text style={ar.status}>{status}</Text>
      </View>
    </View>
  );
};

const ar = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#0D1A2E' },
  iconWrap: { width: 40, height: 40, borderRadius: 12,
              justifyContent: 'center', alignItems: 'center' },
  title:    { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  sub:      { fontSize: 12, color: '#5A7A9A' },
  amount:   { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  status:   { fontSize: 10, color: '#3A5070', fontWeight: '600' },
});

// ── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeA = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await userAPI.getStats();
      setStats(res.data);
    } catch {}
    finally { setLoading(false); }
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const hour    = new Date().getHours();
  const greet   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const balance = stats?.walletBalance ?? 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />

      {/* Background orbs */}
      <View style={s.orb1} />
      <View style={s.orb2} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>
          <View style={s.header}>
            <View>
              <Text style={s.greet}>{greet} 👋</Text>
              <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
            </View>
            <TouchableOpacity
              style={s.notifBtn}
              onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color={ACCENT} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>

          {/* ── Wallet ── */}
          <WalletCard balance={balance} onTopUp={() => navigation.navigate('Wallet')} />

          {/* ── Stats row ── */}
          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginBottom: 20 }} />
          ) : (
            <View style={s.statsRow}>
              <StatPill icon="car-outline"    value={stats?.totalRides      ?? 0} label="Rides"      color={ACCENT}   />
              <StatPill icon="cube-outline"   value={stats?.totalDeliveries ?? 0} label="Deliveries" color="#A78BFA"  />
              <StatPill icon="cash-outline"   value={`₦${(stats?.totalSpent ?? 0).toLocaleString()}`} label="Spent" color="#34D399" />
            </View>
          )}

          {/* ── Quick Actions ── */}
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionsRow}>
            <ActionCard
              emoji="🚗"
              title="Book a Ride"
              subtitle="Get to your destination fast"
              accent={ACCENT}
              badge="INSTANT"
              onPress={() => navigation.navigate('RequestRide')}
            />
            <ActionCard
              emoji="📦"
              title="Send Package"
              subtitle="Same-day delivery"
              accent="#A78BFA"
              onPress={() => navigation.navigate('RequestDelivery')}
            />
          </View>

          {/* ── Promo banner ── */}
          <TouchableOpacity style={s.promo} activeOpacity={0.85}>
            <View>
              <Text style={s.promoTitle}>🎉 First Ride Free</Text>
              <Text style={s.promoSub}>Use code WELCOME at checkout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={ACCENT} />
          </TouchableOpacity>

          {/* ── Recent activity ── */}
          <Text style={s.sectionTitle}>Recent Activity</Text>
          <View style={s.recentBox}>
            {(stats?.totalRides > 0 || stats?.totalDeliveries > 0) ? (
              // In a real app, fetch actual recent rides/deliveries here
              <ActivityRow
                icon="car-outline"
                title="Ride to Victoria Island"
                subtitle="Today, 2:30 PM"
                amount="₦1,200"
                status="COMPLETED"
              />
            ) : (
              <View style={s.emptyState}>
                <Text style={s.emptyEmoji}>🛣️</Text>
                <Text style={s.emptyTitle}>No trips yet</Text>
                <Text style={s.emptySub}>Book your first ride or delivery above</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#080C18' },
  orb1:    { position: 'absolute', width: width * 1.2, height: width * 1.2,
             borderRadius: width * 0.6, backgroundColor: ACCENT,
             top: -width * 0.8, right: -width * 0.4, opacity: 0.04 },
  orb2:    { position: 'absolute', width: width * 0.7, height: width * 0.7,
             borderRadius: width * 0.35, backgroundColor: '#A78BFA',
             bottom: -width * 0.2, left: -width * 0.2, opacity: 0.04 },
  scroll:  { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 60 },

  header:  { flexDirection: 'row', justifyContent: 'space-between',
             alignItems: 'flex-start', marginBottom: 24 },
  greet:   { fontSize: 13, color: '#5A7A9A', fontWeight: '600', marginBottom: 4 },
  name:    { fontSize: 24, fontWeight: '900', color: '#FFF' },
  notifBtn:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#0D1A2E',
             borderWidth: 1, borderColor: '#1A2840',
             justifyContent: 'center', alignItems: 'center' },
  notifDot:{ position: 'absolute', top: 10, right: 10, width: 8, height: 8,
             borderRadius: 4, backgroundColor: '#FF6B6B',
             borderWidth: 2, borderColor: '#080C18' },

  statsRow:{ flexDirection: 'row', gap: 10, marginBottom: 28 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#3A5070',
                  letterSpacing: 2, marginBottom: 14 },

  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },

  promo:   { backgroundColor: '#001E2B', borderRadius: 16, borderWidth: 1,
             borderColor: ACCENT + '30', padding: 18, flexDirection: 'row',
             alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  promoTitle: { fontSize: 15, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  promoSub:   { fontSize: 12, color: '#5A7A9A' },

  recentBox: { backgroundColor: '#0D1A2E', borderRadius: 20, padding: 16,
               borderWidth: 1, borderColor: '#1A2840', marginBottom: 20 },
  emptyState:{ alignItems: 'center', paddingVertical: 24 },
  emptyEmoji:{ fontSize: 40, marginBottom: 12 },
  emptyTitle:{ fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  emptySub:  { fontSize: 13, color: '#5A7A9A', textAlign: 'center' },
});