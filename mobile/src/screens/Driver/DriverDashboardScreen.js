// mobile/src/screens/Driver/DriverDashboardScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, StatusBar, Dimensions, Animated,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import * as Location         from '../../shims/Location';
import { useAuth }           from '../../context/AuthContext';
import { useTheme }          from '../../context/ThemeContext';
import { driverAPI, userAPI, walletAPI } from '../../services/api';
import socketService         from '../../services/socket';

const { width } = Dimensions.get('window');
const DA = '#FFB800';

// ── getRealLocation ────────────────────────────────────────────────────────────
const getRealLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Location permission denied. Please enable location access in your phone settings to go online.'
    );
  }
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
};

// ── VerifiedBadge ──────────────────────────────────────────────────────────────
const VerifiedBadge = () => (
  <View style={vb.wrap}>
    <Ionicons name="shield-checkmark" size={11} color="#080C18" />
    <Text style={vb.txt}>VERIFIED DRIVER</Text>
  </View>
);
const vb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DA, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  txt: { fontSize: 9, fontWeight: '900', color: '#080C18', letterSpacing: 1.5 },
});

// ── PendingBadge ───────────────────────────────────────────────────────────────
const PendingBadge = ({ theme }) => (
  <View style={[pb.wrap, { backgroundColor: theme.backgroundAlt, borderColor: DA + '40' }]}>
    <Ionicons name="time-outline" size={11} color={DA} />
    <Text style={[pb.txt, { color: DA }]}>PENDING APPROVAL</Text>
  </View>
);
const pb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  txt: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
});

// ── MetricCard ─────────────────────────────────────────────────────────────────
const MetricCard = ({ icon, value, label, color, theme }) => (
  <View style={[mc.card, { backgroundColor: theme.backgroundAlt, borderColor: (color || DA) + '20' }]}>
    <View style={[mc.iconBox, { backgroundColor: (color || DA) + '15' }]}>
      <Ionicons name={icon} size={18} color={color || DA} />
    </View>
    <Text style={[mc.value, { color: color || DA }]}>{value}</Text>
    <Text style={[mc.label, { color: theme.hint }]}>{label}</Text>
  </View>
);
const mc = StyleSheet.create({
  card:    { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 5 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  value:   { fontSize: 20, fontWeight: '900' },
  label:   { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

// ── OnlineToggle ───────────────────────────────────────────────────────────────
const OnlineToggle = ({ isOnline, toggling, onToggle, isApproved, theme }) => {
  const pulseA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(Animated.sequence([
        Animated.timing(pulseA, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]));
      anim.start();
    } else {
      pulseA.setValue(1);
    }
    return () => anim?.stop();
  }, [isOnline]);

  return (
    <View style={[ot.card, { backgroundColor: theme.backgroundAlt, borderColor: isOnline ? DA + '50' : theme.border }]}>
      <View style={ot.left}>
        <View style={ot.dotRow}>
          <View style={ot.dotWrap}>
            {isOnline && (
              <Animated.View style={[ot.dotRing, { borderColor: DA, transform: [{ scale: pulseA }] }]} />
            )}
            <View style={[ot.dot, { backgroundColor: isOnline ? DA : theme.hint }]} />
          </View>
          <Text style={[ot.status, { color: theme.foreground }]}>
            {isOnline ? "You're Online" : "You're Offline"}
          </Text>
        </View>
        <Text style={[ot.sub, { color: theme.hint }]}>
          {isOnline
            ? 'GPS active • accepting rides'
            : isApproved ? 'Tap to start accepting rides' : 'Approval required'}
        </Text>
      </View>
      {toggling ? (
        <ActivityIndicator color={DA} size="small" />
      ) : (
        <Switch
          value={isOnline}
          onValueChange={onToggle}
          disabled={!isApproved}
          trackColor={{ false: theme.border, true: DA + '70' }}
          thumbColor={isOnline ? DA : theme.hint}
          ios_backgroundColor={theme.border}
        />
      )}
    </View>
  );
};
const ot = StyleSheet.create({
  card:    { borderRadius: 20, borderWidth: 1, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  left:    { flex: 1, marginRight: 12 },
  dotRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  dotWrap: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  dot:     { width: 10, height: 10, borderRadius: 5, position: 'absolute' },
  dotRing: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 2, opacity: 0.5 },
  status:  { fontSize: 16, fontWeight: '800' },
  sub:     { fontSize: 12 },
});

// ── WalletStrip ────────────────────────────────────────────────────────────────
const WalletStrip = ({ balance, todayEarnings, onWithdraw, theme }) => (
  <View style={[ws.card, { backgroundColor: theme.backgroundAlt, borderColor: DA + '25' }]}>
    <View style={ws.left}>
      <Text style={[ws.lbl, { color: DA + '80' }]}>WALLET BALANCE</Text>
      <Text style={[ws.amount, { color: '#5DAA72' }]}>
        {'\u20A6'}{Number(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
      </Text>
      <Text style={[ws.todayLbl, { color: theme.hint }]}>
        Today:{' '}
        <Text style={{ color: DA }}>
          +{'\u20A6'}{Number(todayEarnings ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
        </Text>
      </Text>
    </View>
    <TouchableOpacity style={[ws.btn, { backgroundColor: DA }]} onPress={onWithdraw} activeOpacity={0.88}>
      <Ionicons name="arrow-up-circle-outline" size={14} color="#080C18" />
      <Text style={ws.btnTxt}>Withdraw</Text>
    </TouchableOpacity>
  </View>
);
const ws = StyleSheet.create({
  card:     { borderRadius: 20, borderWidth: 1, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  left:     { flex: 1 },
  lbl:      { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  amount:   { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  todayLbl: { fontSize: 11, fontWeight: '500' },
  btn:      { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  btnTxt:   { fontSize: 12, fontWeight: '800', color: '#080C18' },
});

// ── WaitingBanner ──────────────────────────────────────────────────────────────
const WaitingBanner = ({ theme }) => {
  const dotA = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotA, { toValue: 1,   duration: 700, useNativeDriver: true }),
      Animated.timing(dotA, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={[wb.wrap, { backgroundColor: DA + '10', borderColor: DA + '30' }]}>
      <Animated.View style={[wb.dot, { backgroundColor: DA, opacity: dotA }]} />
      <Text style={[wb.txt, { color: DA }]}>Waiting for ride requests...</Text>
    </View>
  );
};
const wb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  txt:  { fontSize: 13, fontWeight: '600' },
});

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function DriverDashboardScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();

  const [isOnline,      setIsOnline]      = useState(false);
  const [toggling,      setToggling]      = useState(false);
  const [profile,       setProfile]       = useState(null);
  const [stats,         setStats]         = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [loading,       setLoading]       = useState(true);

  const fadeA   = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [profileRes, statsRes, walletRes, earningsRes] = await Promise.allSettled([
        driverAPI.getProfile(),
        userAPI.getStats(),
        walletAPI.getWallet(),
        driverAPI.getEarnings(),
      ]);
      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value?.data?.profile ?? profileRes.value?.data;
        setProfile(p);
        setIsOnline(p?.isOnline ?? false);
      }
      if (statsRes.status    === 'fulfilled') setStats(statsRes.value?.data);
      if (walletRes.status   === 'fulfilled') setWalletBalance(walletRes.value?.data?.wallet?.balance ?? 0);
      if (earningsRes.status === 'fulfilled') setTodayEarnings(parseFloat(earningsRes.value?.data?.netEarnings ?? 0));
    } catch {}
    finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,   { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(headerY, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  // ── Refresh stats when returning to this screen ────────────────────────────
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  // KEY CHANGE: on ride:new_request we navigate to a dedicated
  // IncomingRideScreen instead of rendering an inline card.
  // This is impossible to miss and survives all React state timing issues.
  useEffect(() => {
    const handleReq = (data) => {
      console.log('[Dashboard] ride:new_request → IncomingRide:', data?.rideId);
      navigation.navigate('IncomingRide', { request: data });
    };
    const handleCanc = (data) => {
      console.log('[Dashboard] ride:cancelled:', data?.rideId);
      // If IncomingRideScreen is currently shown, pop it
      // (navigation.goBack() is safe even if we're already on Dashboard)
      try { navigation.goBack(); } catch {}
    };

    socketService.on('ride:new_request', handleReq);
    socketService.on('ride:cancelled',   handleCanc);

    socketService.connect().catch((err) =>
      console.warn('[Dashboard] socket connect:', err?.message)
    );

    return () => {
      socketService.off('ride:new_request', handleReq);
      socketService.off('ride:cancelled',   handleCanc);
    };
  }, [navigation]);

  // ── Toggle online ──────────────────────────────────────────────────────────
  const toggleOnline = async () => {
    if (!profile?.isApproved) {
      Alert.alert('Pending Approval', 'Your account is under review. You will be notified when approved.');
      return;
    }
    setToggling(true);
    try {
      const next = !isOnline;
      if (next) {
        let coords;
        try { coords = await getRealLocation(); }
        catch (e) { Alert.alert('Location Required', e.message); return; }
        await driverAPI.updateStatus({ isOnline: true, currentLat: coords.lat, currentLng: coords.lng });
        socketService.goOnline({ latitude: coords.lat, longitude: coords.lng });
        console.log(`[Driver] Online at ${coords.lat}, ${coords.lng}`);
      } else {
        await driverAPI.updateStatus({ isOnline: false });
        socketService.goOffline();
      }
      setIsOnline(next);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to update status.');
    } finally {
      setToggling(false);
    }
  };

  const goToProfile = () => navigation.getParent()?.navigate('ProfileTab');
  const isApproved  = profile?.isApproved ?? false;

  return (
    // edges={['top', 'left', 'right']} — SafeAreaView handles the status bar
    // and side notches. Bottom padding is owned by the tab bar navigator.
    <SafeAreaView
      style={[s.root, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      <View style={[s.orb, { backgroundColor: DA }]} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <Animated.View style={{ opacity: fadeA, transform: [{ translateY: headerY }] }}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <Text style={[s.eyebrow, { color: DA + '70' }]}>DRIVER DASHBOARD</Text>
              <Text style={[s.name, { color: theme.foreground }]} numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
              <View style={{ marginTop: 8 }}>
                {isApproved ? <VerifiedBadge /> : <PendingBadge theme={theme} />}
              </View>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity
                style={[s.notifBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={19} color={DA} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.avatarBtn, { backgroundColor: DA + '18', borderColor: DA + '40' }]}
                onPress={goToProfile}
              >
                <Text style={[s.avatarTxt, { color: DA }]}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Approval banner ── */}
          {!isApproved && !loading && (
            <View style={[s.approvalBanner, { backgroundColor: theme.backgroundAlt, borderColor: DA + '30' }]}>
              <Ionicons name="time-outline" size={18} color={DA} />
              <View style={{ flex: 1 }}>
                <Text style={[s.approvalTitle, { color: DA }]}>Account Under Review</Text>
                <Text style={[s.approvalSub, { color: theme.hint }]}>
                  Your documents are being reviewed. Approval takes 24–48 hours.
                </Text>
              </View>
            </View>
          )}

          {/* ── Online toggle ── */}
          <OnlineToggle
            isOnline={isOnline}
            toggling={toggling}
            onToggle={toggleOnline}
            isApproved={isApproved}
            theme={theme}
          />

          {/* ── Waiting banner ── */}
          {isOnline && <WaitingBanner theme={theme} />}

          {/* ── Wallet ── */}
          {!loading && (
            <WalletStrip
              balance={walletBalance}
              todayEarnings={todayEarnings}
              onWithdraw={() => navigation.navigate('Earnings')}
              theme={theme}
            />
          )}

          {/* ── Stats ── */}
          {loading ? (
            <ActivityIndicator color={DA} style={{ marginBottom: 16 }} />
          ) : (
            <View style={s.statsRow}>
              <MetricCard icon="car-sport-outline" value={stats?.completedRides ?? profile?.totalRides ?? 0} label="Rides" theme={theme} />
              <MetricCard icon="star-outline" value={(profile?.rating ?? stats?.rating ?? 0).toFixed(1)} label="Rating" color="#A78BFA" theme={theme} />
              <MetricCard icon="trending-up-outline" value={isApproved ? '94%' : '—'} label="Accept" color="#5DAA72" theme={theme} />
            </View>
          )}

          {/* ── Vehicle card ── */}
          {profile?.vehicleMake && (
            <TouchableOpacity
              style={[s.vehicleCard, { backgroundColor: theme.backgroundAlt, borderColor: DA + '25' }]}
              onPress={() => navigation.navigate('DriverDocuments')}
              activeOpacity={0.8}
            >
              <View style={[s.vehicleIconWrap, { backgroundColor: DA + '18' }]}>
                <Ionicons name="car-outline" size={18} color={DA} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.vehicleName, { color: theme.foreground }]}>
                  {profile.vehicleColor} {profile.vehicleMake} {profile.vehicleModel}
                </Text>
                <Text style={[s.vehiclePlate, { color: DA }]}>{profile.vehiclePlate}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.hint} />
            </TouchableOpacity>
          )}

          {/* ── Quick actions ── */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
          <View style={s.actionGrid}>
            {[
              { icon: 'wallet-outline',       label: 'Earnings',     color: DA,         screen: 'Earnings'        },
              { icon: 'time-outline',          label: 'Ride History', color: '#5DAA72',  screen: 'DriverHistory'   },
              { icon: 'document-text-outline', label: 'Documents',   color: '#A78BFA',  screen: 'DriverDocuments' },
              { icon: 'help-circle-outline',   label: 'Support',     color: theme.hint, screen: 'Support'         },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={[s.actionCard, { backgroundColor: theme.backgroundAlt, borderColor: item.color + '25' }]}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.75}
              >
                <View style={[s.actionIcon, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={[s.actionLabel, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Footer ── */}
          <View style={[s.footer, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons
              name={isApproved ? 'shield-checkmark-outline' : 'shield-outline'}
              size={13}
              color={isApproved ? '#5DAA72' : theme.hint}
            />
            <Text style={[s.footerTxt, { color: isApproved ? '#5DAA72' : theme.hint }]}>
              {isApproved ? 'Verified & Approved Driver' : 'Verification Pending'}
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  orb:   {
    position: 'absolute', width: width * 1.2, height: width * 1.2,
    borderRadius: width * 0.6, top: -width * 0.78, right: -width * 0.3, opacity: 0.05,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  eyebrow:     { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 4 },
  name:        { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  notifBtn:    { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarBtn:   { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { fontSize: 14, fontWeight: '800' },

  approvalBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  approvalTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  approvalSub:    { fontSize: 11, lineHeight: 17 },

  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  vehicleCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 20 },
  vehicleIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  vehicleName:     { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehiclePlate:    { fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  actionGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  actionCard:   { width: (width - 60) / 2, borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 8 },
  actionIcon:   { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  actionLabel:  { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  footerTxt: { fontSize: 12, fontWeight: '700' },
});