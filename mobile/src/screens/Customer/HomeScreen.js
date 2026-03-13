// mobile/src/screens/Customer/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator, Image,
  ImageBackground,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { useAuth }   from '../../context/AuthContext';
import { useTheme }  from '../../context/ThemeContext';
import { userAPI }   from '../../services/api';

const { width } = Dimensions.get('window');
const CARD_W    = (width - 48 - 12) / 2;   // two cards in a row, 24px side padding + 12px gap

// ─────────────────────────────────────────────────────────────────────────────
// Nigerian ride cars — 5 images cycling in slow crossfade
// All set in Lagos / Nigerian city contexts
// ─────────────────────────────────────────────────────────────────────────────
const RIDE_IMAGES = [
  'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=700&q=80', // Toyota Camry black night
  'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=700&q=80', // black sedan city
  'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=700&q=80', // black SUV dramatic
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=700&q=80', // Mercedes black road
  'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=700&q=80', // car city night lights
];

// ─────────────────────────────────────────────────────────────────────────────
// Delivery vehicles — 5 images cycling in slow crossfade
// Delivery bike · truck · cargo van · scooter courier · human with delivery bag
// ─────────────────────────────────────────────────────────────────────────────
const DELIVERY_IMAGES = [
  // 1. Delivery motorbike / okada-style bike courier
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=80',
  // 2. Large delivery / logistics truck on road
  'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=700&q=80',
  // 3. White cargo van / sprinter delivery van city
  'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=700&q=80',
  // 4. Scooter / moped courier speeding urban
  'https://images.unsplash.com/photo-1609859674987-2b4b7e554188?w=700&q=80',
  // 5. Human courier / delivery person with bag on foot
  'https://images.unsplash.com/photo-1591768793355-74d04bb6608f?w=700&q=80',
];

// Promo banner image
const PROMO_IMAGE = 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=900&q=80';

// ─────────────────────────────────────────────────────────────────────────────
// CrossfadeImageCycler — slow motion crossfade between an array of images
// Props: images (string[]), intervalMs (default 4000), transitionMs (default 2000)
// ─────────────────────────────────────────────────────────────────────────────
const CrossfadeImageCycler = ({ images, intervalMs = 4000, transitionMs = 2000, style, imageStyle }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx,    setNextIdx]    = useState(1);
  const nextOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      // Fade in next image
      Animated.timing(nextOpacity, {
        toValue: 1,
        duration: transitionMs,
        useNativeDriver: true,
      }).start(() => {
        // Once fully visible, snap current to next and reset next opacity
        setCurrentIdx(prev => {
          const newCurrent = (prev + 1) % images.length;
          setNextIdx((newCurrent + 1) % images.length);
          return newCurrent;
        });
        nextOpacity.setValue(0);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [images.length, intervalMs, transitionMs]);

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {/* Bottom layer — current image */}
      <Image
        source={{ uri: images[currentIdx] }}
        style={[StyleSheet.absoluteFillObject, imageStyle]}
        resizeMode="cover"
      />
      {/* Top layer — next image fading in */}
      <Animated.Image
        source={{ uri: images[nextIdx] }}
        style={[StyleSheet.absoluteFillObject, imageStyle, { opacity: nextOpacity }]}
        resizeMode="cover"
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Wallet strip
// ─────────────────────────────────────────────────────────────────────────────
const WalletStrip = ({ balance, onTopUp, theme }) => (
  <View style={[wl.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <View>
      <Text style={[wl.label, { color: theme.hint }]}>WALLET BALANCE</Text>
      <Text style={[wl.amount, { color: theme.foreground }]}>
        ₦{Number(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
      </Text>
    </View>
    <TouchableOpacity style={[wl.btn, { backgroundColor: theme.accent }]} onPress={onTopUp} activeOpacity={0.85}>
      <Ionicons name="add" size={15} color="#FFFFFF" />
      <Text style={wl.btnTxt}>Top Up</Text>
    </TouchableOpacity>
  </View>
);
const wl = StyleSheet.create({
  wrap:   { borderRadius: 16, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  label:  { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 5 },
  amount: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  btnTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Stat pill
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = ({ icon, value, label, theme }) => (
  <View style={[sp.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <Ionicons name={icon} size={17} color={theme.accent} />
    <Text style={[sp.val, { color: theme.foreground }]}>{value}</Text>
    <Text style={[sp.lbl, { color: theme.hint }]}>{label}</Text>
  </View>
);
const sp = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  val:  { fontSize: 19, fontWeight: '800' },
  lbl:  { fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Image action card — now uses CrossfadeImageCycler for slow motion slideshow
// ─────────────────────────────────────────────────────────────────────────────
const ActionCard = ({ images, title, subtitle, badge, onPress, theme }) => {
  const scaleA = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleA, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleA,  { toValue: 1, tension: 130, friction: 6, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.92} style={{ width: CARD_W }}>
      <Animated.View style={[ac.card, { transform: [{ scale: scaleA }] }]}>
        {/* Crossfade image background */}
        <CrossfadeImageCycler
          images={images}
          intervalMs={4500}
          transitionMs={2200}
          style={ac.cyclerContainer}
          imageStyle={ac.imgStyle}
        />

        {/* Dark overlay on top of images */}
        <View style={ac.overlay} />

        {/* Badge */}
        {badge && (
          <View style={[ac.badge, { backgroundColor: theme.accent }]}>
            <Text style={ac.badgeTxt}>{badge}</Text>
          </View>
        )}

        {/* Text content */}
        <View style={ac.content}>
          <Text style={ac.title}>{title}</Text>
          <Text style={ac.sub}>{subtitle}</Text>
          <View style={[ac.arrowBtn, { backgroundColor: theme.accent }]}>
            <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};
const ac = StyleSheet.create({
  card:           { borderRadius: 18, overflow: 'hidden', height: 188, position: 'relative' },
  cyclerContainer:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18 },
  imgStyle:       { borderRadius: 18 },
  overlay:        {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  badge:    { position: 'absolute', top: 12, left: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  content:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  title:    { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 3, letterSpacing: 0.1 },
  sub:      { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 12, lineHeight: 15 },
  arrowBtn: { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity row
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_STATUS_META = {
  COMPLETED:   { color: '#5DAA72', label: 'Completed' },
  CANCELLED:   { color: '#E05555', label: 'Cancelled' },
  IN_PROGRESS: { color: '#C9A96E', label: 'In Progress' },
};

const ActivityRow = ({ icon, title, subtitle, amount, status, theme, last }) => {
  const meta = ACTIVITY_STATUS_META[status] ?? { color: theme.accent, label: status };
  return (
    <View style={[ar.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[ar.iconWrap, { backgroundColor: meta.color + '16' }]}>
        <Ionicons name={icon} size={17} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ar.title, { color: theme.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[ar.sub, { color: theme.hint }]}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[ar.amount, { color: meta.color }]}>{amount}</Text>
        <View style={[ar.statusPill, { backgroundColor: meta.color + '16' }]}>
          <Text style={[ar.statusTxt, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
};
const ar = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  iconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title:      { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  sub:        { fontSize: 11 },
  amount:     { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  statusPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusTxt:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Promo banner
// ─────────────────────────────────────────────────────────────────────────────
const PromoBanner = ({ theme, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={pb.wrap}>
    <ImageBackground source={{ uri: PROMO_IMAGE }} style={pb.bg} imageStyle={pb.bgStyle} resizeMode="cover">
      <View style={pb.overlay} />
      <View style={pb.content}>
        <View>
          <Text style={pb.eyebrow}>LIMITED OFFER</Text>
          <Text style={pb.title}>First Ride Free</Text>
          <Text style={pb.sub}>Use code WELCOME at checkout</Text>
        </View>
        <View style={[pb.btn, { backgroundColor: theme.accent }]}>
          <Text style={pb.btnTxt}>Claim</Text>
          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
        </View>
      </View>
    </ImageBackground>
  </TouchableOpacity>
);
const pb = StyleSheet.create({
  wrap:    { borderRadius: 18, overflow: 'hidden', marginBottom: 28, height: 110 },
  bg:      { width: '100%', height: '100%' },
  bgStyle: { borderRadius: 18 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 18 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  eyebrow: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: 4 },
  title:   { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 3 },
  sub:     { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnTxt:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user }             = useAuth();
  const { theme, mode }      = useTheme();
  const [stats,   setStats]  = useState(null);
  const [loading, setLoading]= useState(true);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(20)).current;

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await userAPI.getStats();
      setStats(res.data ?? res);
    } catch {}
    finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]).start();
    }
  };

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.greet, { color: theme.hint }]}>{greet}</Text>
              <Text style={[s.name,  { color: theme.foreground }]}>
                {user?.firstName} {user?.lastName}
              </Text>
            </View>

            {/* Profile avatar / notification */}
            <View style={s.headerRight}>
              <TouchableOpacity
                style={[s.notifBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color={theme.accent} />
                <View style={[s.notifDot, { borderColor: theme.background }]} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.getParent()?.navigate('ProfileTab')}
                activeOpacity={0.85}
              >
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={[s.profileAvatar, { borderColor: theme.accent + '40' }]} />
                ) : (
                  <View style={[s.profileAvatarFallback, { backgroundColor: theme.accent + '18', borderColor: theme.accent + '35' }]}>
                    <Text style={[s.profileAvatarInitials, { color: theme.accent }]}>
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Wallet ── */}
          <WalletStrip
            balance={stats?.walletBalance}
            onTopUp={() => navigation.navigate('Wallet')}
            theme={theme}
          />

          {/* ── Stats ── */}
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginBottom: 24 }} />
          ) : (
            <View style={s.statsRow}>
              <StatPill icon="car-outline"  value={stats?.totalRides ?? 0}      label="Rides"    theme={theme} />
              <StatPill icon="cube-outline" value={stats?.totalDeliveries ?? 0} label="Packages" theme={theme} />
              <StatPill icon="cash-outline" value={`₦${((stats?.totalSpent ?? 0) / 1000).toFixed(1)}k`} label="Spent" theme={theme} />
            </View>
          )}

          {/* ── Section: Quick Actions ── */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
          <View style={s.actionsRow}>
            {/* Ride card — cycles through 5 Nigerian-context car images */}
            <ActionCard
              images={RIDE_IMAGES}
              title="Book a Ride"
              subtitle="Fast rides across Lagos"
              badge="INSTANT"
              theme={theme}
              onPress={() => navigation.navigate('RequestRide')}
            />
            {/* Delivery card — cycles through: bike, truck, van, scooter, human courier */}
            <ActionCard
              images={DELIVERY_IMAGES}
              title="Send Package"
              subtitle="Bikes, vans & couriers on standby"
              theme={theme}
              onPress={() => navigation.navigate('RequestDelivery')}
            />
          </View>

          {/* ── Promo banner ── */}
          <PromoBanner theme={theme} onPress={() => {}} />

          {/* ── Section: Recent Activity ── */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>RECENT ACTIVITY</Text>
          <View style={[s.activityCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {loading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
            ) : (stats?.totalRides > 0 || stats?.totalDeliveries > 0) ? (
              <>
                <ActivityRow
                  icon="car-outline"
                  title="Ride to Victoria Island"
                  subtitle="Today · 2:30 PM · 12 min"
                  amount="₦1,200"
                  status="COMPLETED"
                  theme={theme}
                />
                <ActivityRow
                  icon="cube-outline"
                  title="Package to Lekki Phase 1"
                  subtitle="Yesterday · 10:15 AM · 3.2 km"
                  amount="₦800"
                  status="COMPLETED"
                  theme={theme}
                  last
                />
              </>
            ) : (
              <View style={s.emptyActivity}>
                <View style={[s.emptyIconWrap, { backgroundColor: theme.accent + '12' }]}>
                  <Ionicons name="map-outline" size={28} color={theme.accent} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No trips yet</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>
                  Book your first ride or send a package to get started
                </Text>
                <TouchableOpacity
                  style={[s.emptyBtn, { borderColor: theme.accent + '40', backgroundColor: theme.accent + '10' }]}
                  onPress={() => navigation.navigate('RequestRide')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="car-outline" size={14} color={theme.accent} />
                  <Text style={[s.emptyBtnTxt, { color: theme.accent }]}>Book a Ride</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: {
    position: 'absolute', width: width * 1.3, height: width * 1.3,
    borderRadius: width * 0.65, top: -width * 0.75, alignSelf: 'center', opacity: 0.05,
  },
  scroll:      { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 60 },

  // Header
  header:                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  greet:                 { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  name:                  { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerRight:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  notifBtn:              { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  notifDot:              { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E05555', borderWidth: 1.5 },
  profileAvatar:         { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5 },
  profileAvatarFallback: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  profileAvatarInitials: { fontSize: 14, fontWeight: '800' },

  // Stats
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 28 },

  // Sections
  sectionTitle:{ fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  actionsRow:  { flexDirection: 'row', gap: 12, marginBottom: 20 },

  // Activity card
  activityCard:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
  emptyActivity: { alignItems: 'center', paddingVertical: 28 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptySub:      { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 18, paddingHorizontal: 16 },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnTxt:   { fontSize: 13, fontWeight: '700' },
});