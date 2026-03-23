// mobile/src/screens/Customer/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator, Image,
  ImageBackground, Platform, Alert,
} from 'react-native';
import { Ionicons }              from '@expo/vector-icons';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useAuth }               from '../../context/AuthContext';
import { useTheme }              from '../../context/ThemeContext';
import { userAPI, rideAPI, deliveryAPI } from '../../services/api';
import ActiveRideBanner          from '../../components/ActiveRideBanner';
import ActiveDeliveryBanner      from '../../components/ActiveDeliveryBanner';

const { width } = Dimensions.get('window');
const H_PAD    = 24;
const CARD_GAP = 12;
const CARD_W   = (width - H_PAD * 2 - CARD_GAP) / 2;

const RIDE_IMAGES = [
  'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=700&q=80',
  'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=700&q=80',
  'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=700&q=80',
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=700&q=80',
  'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=700&q=80',
];

const DELIVERY_IMAGES = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=80',
  'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=700&q=80',
  'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=700&q=80',
  'https://images.unsplash.com/photo-1609859674987-2b4b7e554188?w=700&q=80',
  'https://images.unsplash.com/photo-1591768793355-74d04bb6608f?w=700&q=80',
];

const PROMO_IMAGE = 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=900&q=80';

const CrossfadeImageCycler = ({ images, intervalMs = 4500, transitionMs = 2200 }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx,    setNextIdx]    = useState(1);
  const nextOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(nextOpacity, { toValue: 1, duration: transitionMs, useNativeDriver: true }).start(() => {
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
    <View style={StyleSheet.absoluteFillObject}>
      <Image source={{ uri: images[currentIdx] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <Animated.Image source={{ uri: images[nextIdx] }} style={[StyleSheet.absoluteFillObject, { opacity: nextOpacity }]} resizeMode="cover" />
    </View>
  );
};

const WalletStrip = ({ balance, onTopUp, theme }) => {
  const accentFg = theme.accentFg ?? '#111111';
  return (
    <View style={[wl.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[wl.label, { color: theme.hint }]}>WALLET BALANCE</Text>
        <Text style={[wl.amount, { color: theme.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {'\u20A6'}{Number(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
        </Text>
      </View>
      <TouchableOpacity style={[wl.btn, { backgroundColor: theme.accent }]} onPress={onTopUp} activeOpacity={0.85}>
        <Ionicons name="add" size={15} color={accentFg} />
        <Text style={[wl.btnTxt, { color: accentFg }]}>Top Up</Text>
      </TouchableOpacity>
    </View>
  );
};
const wl = StyleSheet.create({
  wrap:   { borderRadius: 16, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  label:  { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 5 },
  amount: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 0 },
  btnTxt: { fontSize: 13, fontWeight: '700' },
});

const StatPill = ({ icon, value, label, theme }) => (
  <View style={[sp.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <Ionicons name={icon} size={16} color={theme.accent} />
    <Text style={[sp.val, { color: theme.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    <Text style={[sp.lbl, { color: theme.hint }]}>{label}</Text>
  </View>
);
const sp = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  val:  { fontSize: 18, fontWeight: '800' },
  lbl:  { fontSize: 9, fontWeight: '600' },
});

const ActionCard = ({ images, title, subtitle, badge, onPress, theme }) => {
  const accentFg = theme.accentFg ?? '#111111';
  const scaleA   = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleA, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleA, { toValue: 1, tension: 130, friction: 6, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.92} style={{ width: CARD_W }}>
      <Animated.View style={[ac.card, { transform: [{ scale: scaleA }] }]}>
        <CrossfadeImageCycler images={images} />
        <View style={ac.overlay} />
        {badge && (
          <View style={[ac.badge, { backgroundColor: theme.accent }]}>
            <Text style={[ac.badgeTxt, { color: accentFg }]}>{badge}</Text>
          </View>
        )}
        <View style={ac.content}>
          <Text style={ac.title} numberOfLines={1}>{title}</Text>
          <Text style={ac.sub}   numberOfLines={2}>{subtitle}</Text>
          <View style={[ac.arrowBtn, { backgroundColor: theme.accent }]}>
            <Ionicons name="arrow-forward" size={13} color={accentFg} />
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};
const ac = StyleSheet.create({
  card:     { borderRadius: 18, overflow: 'hidden', height: 180, width: '100%' },
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  badge:    { position: 'absolute', top: 12, left: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  content:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  title:    { fontSize: 13, fontWeight: '800', color: '#FFF', marginBottom: 3 },
  sub:      { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginBottom: 10, lineHeight: 14 },
  arrowBtn: { width: 24, height: 24, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
});

const ACTIVITY_STATUS_META = {
  COMPLETED:   { color: '#5DAA72', label: 'Completed'  },
  CANCELLED:   { color: '#E05555', label: 'Cancelled'  },
  IN_PROGRESS: { color: '#C9A96E', label: 'In Progress'},
};
const ActivityRow = ({ icon, title, subtitle, amount, status, theme, last }) => {
  const meta = ACTIVITY_STATUS_META[status] ?? { color: theme.accent, label: status };
  return (
    <View style={[ar.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[ar.iconWrap, { backgroundColor: meta.color + '16' }]}>
        <Ionicons name={icon} size={17} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ar.title, { color: theme.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[ar.sub,   { color: theme.hint }]}       numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
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
  iconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  title:      { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  sub:        { fontSize: 11 },
  amount:     { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  statusPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusTxt:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
});

const PromoBanner = ({ theme, onPress }) => {
  const accentFg = theme.accentFg ?? '#111111';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={promo.wrap}>
      <ImageBackground source={{ uri: PROMO_IMAGE }} style={promo.bg} imageStyle={promo.bgStyle} resizeMode="cover">
        <View style={promo.overlay} />
        <View style={promo.content}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <Text style={promo.eyebrow}>LIMITED OFFER</Text>
            <Text style={promo.title} numberOfLines={1}>First Ride Free</Text>
            <Text style={promo.sub}   numberOfLines={1}>Use code WELCOME at checkout</Text>
          </View>
          <View style={[promo.btn, { backgroundColor: theme.accent }]}>
            <Text style={[promo.btnTxt, { color: accentFg }]}>Claim</Text>
            <Ionicons name="arrow-forward" size={13} color={accentFg} />
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
};
const promo = StyleSheet.create({
  wrap:    { borderRadius: 18, overflow: 'hidden', marginBottom: 28, height: 110 },
  bg:      { width: '100%', height: '100%' },
  bgStyle: { borderRadius: 18 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  eyebrow: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: 4 },
  title:   { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 3 },
  sub:     { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 0 },
  btnTxt:  { fontSize: 13, fontWeight: '700' },
});

export default function HomeScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [activeRide,     setActiveRide]     = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(20)).current;

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchAll);
    return unsub;
  }, [navigation]);

  const fetchAll = async () => {
    try {
      const [statsRes, rideRes, deliveryRes] = await Promise.allSettled([
        userAPI.getStats(),
        rideAPI.getActiveRide(),
        deliveryAPI.getActiveDelivery(),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value?.data ?? statsRes.value);
      }
      if (rideRes.status === 'fulfilled') {
        const ride = rideRes.value?.data?.ride ?? rideRes.value?.ride ?? null;
        setActiveRide(
          ride && ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status) ? ride : null
        );
      }
      if (deliveryRes.status === 'fulfilled') {
        const del = deliveryRes.value?.data?.delivery ?? null;
        setActiveDelivery(
          del && ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(del.status) ? del : null
        );
      }
    } catch {}
    finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(slideA, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleCancelRide = () => {
    if (!activeRide) return;
    Alert.alert('Cancel Ride?', 'Your ride request will be cancelled.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Ride', style: 'destructive',
        onPress: async () => {
          try {
            await rideAPI.cancelRide(activeRide.id, { reason: 'Customer cancelled from home screen' });
            setActiveRide(null);
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel the ride.');
          }
        },
      },
    ]);
  };

  const handleCancelDelivery = async () => {
    try {
      await deliveryAPI.cancelDelivery(activeDelivery.id, { reason: 'Customer cancelled from home screen' });
      setActiveDelivery(null);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel delivery.');
    }
  };

  const handleResumeRide = () => navigation.navigate('RideTracking', { rideId: activeRide?.id });

  const handleChooseDriver = () => {
    navigation.navigate('NearbyDrivers', {
      pickupAddress:  '',
      pickupLat:      6.5244,
      pickupLng:      3.3792,
      dropoffAddress: '',
      dropoffLat:     6.4281,
      dropoffLng:     3.4219,
      vehicleType:    'CAR',
    });
  };

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const paddingTop    = insets.top    + 16;
  const paddingBottom = insets.bottom + 24;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <Text style={[s.greet, { color: theme.hint }]}>{greet}</Text>
              <Text style={[s.name,  { color: theme.foreground }]} numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity
                style={[s.notifBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color={theme.accent} />
                <View style={[s.notifDot, { borderColor: theme.background }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.getParent()?.navigate('ProfileTab')} activeOpacity={0.85}>
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

          {/* Active ride banner */}
          {activeRide && (
            <ActiveRideBanner
              ride={activeRide}
              role="CUSTOMER"
              theme={theme}
              onPress={handleResumeRide}
              onCancel={activeRide.status === 'REQUESTED' ? handleCancelRide : undefined}
            />
          )}

          {/* Active delivery banner */}
          {activeDelivery && (
            <ActiveDeliveryBanner
              delivery={activeDelivery}
              role="CUSTOMER"
              theme={theme}
              onPress={() => navigation.navigate('DeliveryTracking', { deliveryId: activeDelivery.id })}
              onCancel={activeDelivery.status === 'PENDING' ? handleCancelDelivery : undefined}
            />
          )}

          {/* Wallet */}
          <WalletStrip
            balance={stats?.walletBalance}
            onTopUp={() => navigation.getParent()?.navigate('WalletTab')}
            theme={theme}
          />

          {/* Stats */}
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginBottom: 24 }} />
          ) : (
            <View style={s.statsRow}>
              <StatPill icon="car-outline"  value={stats?.totalRides      ?? 0} label="Rides"    theme={theme} />
              <StatPill icon="cube-outline" value={stats?.totalDeliveries ?? 0} label="Packages" theme={theme} />
              <StatPill
                icon="cash-outline"
                value={`₦${((stats?.totalSpent ?? 0) / 1000).toFixed(1)}k`}
                label="Spent"
                theme={theme}
              />
            </View>
          )}

          {/* Quick Actions */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
          <View style={s.actionsRow}>
            <ActionCard
              images={RIDE_IMAGES}
              title="Book a Ride"
              subtitle="Fast rides across Lagos"
              badge="INSTANT"
              theme={theme}
              onPress={() => navigation.navigate('RequestRide')}
            />
            <ActionCard
              images={DELIVERY_IMAGES}
              title="Send Package"
              subtitle="Bikes, vans & couriers"
              theme={theme}
              onPress={() => navigation.navigate('RequestDelivery')}
            />
          </View>

          {/* Choose a Driver */}
          <TouchableOpacity
            style={[s.chooseDriverBtn, { borderColor: theme.accent + '50', backgroundColor: theme.accent + '0D' }]}
            onPress={handleChooseDriver}
            activeOpacity={0.85}
          >
            <View style={[s.chooseDriverIcon, { backgroundColor: theme.accent + '18' }]}>
              <Ionicons name="people-outline" size={18} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.chooseDriverTitle, { color: theme.accent }]}>Choose Your Driver</Text>
              <Text style={[s.chooseDriverSub,   { color: theme.hint }]}>Browse nearby drivers, see ratings & fares</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.accent} />
          </TouchableOpacity>

          {/* SHIELD Safety */}
          <TouchableOpacity
            style={[s.shieldBtn, { borderColor: '#4CAF5050', backgroundColor: '#4CAF5010' }]}
            onPress={() => navigation.navigate('Shield')}
            activeOpacity={0.85}
          >
            <View style={[s.shieldIcon, { backgroundColor: '#4CAF5020' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.shieldTitle, { color: '#4CAF50' }]}>SHIELD</Text>
                <View style={s.shieldBadge}>
                  <Text style={s.shieldBadgeTxt}>SAFETY</Text>
                </View>
              </View>
              <Text style={[s.shieldSub, { color: theme.hint }]}>
                Let a guardian track your ride live — no app needed
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
          </TouchableOpacity>

          {/* Corporate */}
          <TouchableOpacity
            style={[s.featureBtn, { borderColor: '#2563EB50', backgroundColor: '#2563EB10' }]}
            onPress={() => navigation.navigate('Corporate')}
            activeOpacity={0.85}
          >
            <View style={[s.featureIcon, { backgroundColor: '#2563EB20' }]}>
              <Ionicons name="business-outline" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.featureTitle, { color: '#2563EB' }]}>Corporate</Text>
                <View style={[s.featureBadge, { backgroundColor: '#2563EB25' }]}>
                  <Text style={[s.featureBadgeTxt, { color: '#2563EB' }]}>B2B</Text>
                </View>
              </View>
              <Text style={[s.featureSub, { color: theme.hint }]}>
                Company transport with spend controls & invoicing
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#2563EB" />
          </TouchableOpacity>

          {/* DuoPay */}
          <TouchableOpacity
            style={[s.featureBtn, { borderColor: '#4CAF5050', backgroundColor: '#4CAF5010' }]}
            onPress={() => navigation.navigate('DuoPay')}
            activeOpacity={0.85}
          >
            <View style={[s.featureIcon, { backgroundColor: '#4CAF5020' }]}>
              <Ionicons name="flash-outline" size={18} color="#4CAF50" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.featureTitle, { color: '#4CAF50' }]}>DuoPay</Text>
                <View style={[s.featureBadge, { backgroundColor: '#4CAF5025' }]}>
                  <Text style={[s.featureBadgeTxt, { color: '#4CAF50' }]}>BNPL</Text>
                </View>
              </View>
              <Text style={[s.featureSub, { color: theme.hint }]}>
                Ride now, pay later — up to ₦15,000 credit
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
          </TouchableOpacity>

          {/* Promo */}
          <PromoBanner theme={theme} onPress={() => {}} />

          {/* Recent Activity */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>RECENT ACTIVITY</Text>
          <View style={[s.activityCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            {loading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
            ) : (stats?.totalRides > 0 || stats?.totalDeliveries > 0) ? (
              <>
                <ActivityRow icon="car-outline"  title="Ride to Victoria Island"  subtitle="Today • 2:30 PM • 12 min"       amount="₦1,200" status="COMPLETED" theme={theme} />
                <ActivityRow icon="cube-outline" title="Package to Lekki Phase 1" subtitle="Yesterday • 10:15 AM • 3.2 km" amount="₦800"   status="COMPLETED" theme={theme} last />
              </>
            ) : (
              <View style={s.emptyActivity}>
                <View style={[s.emptyIconWrap, { backgroundColor: theme.accent + '12' }]}>
                  <Ionicons name="map-outline" size={28} color={theme.accent} />
                </View>
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No trips yet</Text>
                <Text style={[s.emptySub,   { color: theme.hint }]}>
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
  ambientGlow: { position: 'absolute', width: width * 1.3, height: width * 1.3, borderRadius: width * 0.65, top: -width * 0.75, alignSelf: 'center', opacity: 0.05 },
  scroll:      { paddingHorizontal: H_PAD },

  header:                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  greet:                 { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  name:                  { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerRight:           { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  notifBtn:              { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  notifDot:              { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E05555', borderWidth: 1.5 },
  profileAvatar:         { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5 },
  profileAvatarFallback: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  profileAvatarInitials: { fontSize: 14, fontWeight: '800' },

  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 28 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  actionsRow:   { flexDirection: 'row', gap: CARD_GAP, width: width - H_PAD * 2, marginBottom: 14 },

  chooseDriverBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  chooseDriverIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  chooseDriverTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  chooseDriverSub:   { fontSize: 11, fontWeight: '500' },

  shieldBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  shieldIcon:     { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  shieldTitle:    { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  shieldSub:      { fontSize: 11, fontWeight: '500' },
  shieldBadge:    { backgroundColor: '#4CAF5025', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  shieldBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#4CAF50', letterSpacing: 0.5 },

  featureBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  featureIcon:     { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  featureTitle:    { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  featureSub:      { fontSize: 11, fontWeight: '500' },
  featureBadge:    { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  featureBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  activityCard:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
  emptyActivity: { alignItems: 'center', paddingVertical: 28 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptySub:      { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 18, paddingHorizontal: 16 },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnTxt:   { fontSize: 13, fontWeight: '700' },
});