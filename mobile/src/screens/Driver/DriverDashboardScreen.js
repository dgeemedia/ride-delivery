// mobile/src/screens/Driver/DriverDashboardScreen.js
// ── Bolt-style: Map background + bottom sheet — ALL original logic preserved ──
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Dimensions, Animated,
  ActivityIndicator, Alert, Image, ScrollView,
} from 'react-native';
import MapView                                 from '../../components/SmartMapView';
import { Ionicons }                            from '@expo/vector-icons';
import { useSafeAreaInsets }                   from 'react-native-safe-area-context';
import * as Location                           from '../../shims/Location';
import { useAuth }                             from '../../context/AuthContext';
import { useTheme }                            from '../../context/ThemeContext';
import { driverAPI, userAPI, walletAPI, rideAPI } from '../../services/api';
import socketService                           from '../../services/socket';
import ActiveRideBanner                        from '../../components/ActiveRideBanner';
import MaintenanceBanner                       from '../../components/MaintenanceBanner';
import { checkMaintenance }                    from '../../utils/maintenanceCheck';
import AsyncStorage                            from '@react-native-async-storage/async-storage';
import {
  EarningsIcon, RideHistoryIcon, FloorPriceIcon,
  DocumentsIcon, SupportIcon,
} from '../../components/DriverIcons';

const { width, height } = Dimensions.get('window');
const PURPLE     = '#A78BFA';
const GREEN      = '#34C759';
const H_PAD      = 20;
const TAB_H      = 54;
const SHEET_SNAP = height * 0.65;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getRealLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Please enable location access in settings to go online.');
  }
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGES
// ─────────────────────────────────────────────────────────────────────────────
const VerifiedBadge = ({ theme }) => (
  <View style={[vb.wrap, { backgroundColor: theme.accent, borderColor: theme.border }]}>
    <Ionicons name="shield-checkmark" size={11} color={theme.accentFg} />
    <Text style={[vb.txt, { color: theme.accentFg }]}>VERIFIED DRIVER</Text>
  </View>
);
const vb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  txt:  { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
});

const PendingBadge = ({ theme }) => (
  <View style={[pb.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <Ionicons name="time-outline" size={11} color={theme.hint} />
    <Text style={[pb.txt, { color: theme.hint }]}>PENDING APPROVAL</Text>
  </View>
);
const pb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  txt:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
});

const RejectedBadge = () => (
  <View style={[rb.wrap, { backgroundColor: '#E0555518', borderColor: '#E05555' }]}>
    <Ionicons name="close-circle-outline" size={11} color="#E05555" />
    <Text style={[rb.txt, { color: '#E05555' }]}>APPLICATION REJECTED</Text>
  </View>
);
const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  txt:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE TOGGLE
// ─────────────────────────────────────────────────────────────────────────────
const OnlineToggle = ({ isOnline, toggling, onToggle, isApproved, isRejected, theme, darkMode }) => {
  const pulseA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(Animated.sequence([
        Animated.timing(pulseA, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]));
      anim.start();
    } else { pulseA.setValue(1); }
    return () => anim?.stop();
  }, [isOnline]);

  const bg       = isOnline ? GREEN : (darkMode ? '#2C2C2E' : '#E5E5EA');
  const labelTxt = isOnline ? "You're Online" : "You're Offline";
  const subTxt   = isOnline       ? 'GPS active • accepting rides'
                 : isRejected     ? 'Application rejected — contact support'
                 : isApproved     ? 'Tap to start accepting rides'
                 :                  'Awaiting admin approval';

  return (
    <TouchableOpacity
      style={[ot.row, {
        backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F7',
        borderColor: isOnline ? GREEN + '40' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
      }]}
      onPress={onToggle}
      disabled={toggling}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <View style={ot.dotRow}>
          <View style={ot.dotWrap}>
            {isOnline && (
              <Animated.View style={[ot.dotRing, { borderColor: GREEN, transform: [{ scale: pulseA }] }]} />
            )}
            <View style={[ot.dot, { backgroundColor: isOnline ? GREEN : theme.hint }]} />
          </View>
          <Text style={[ot.status, { color: theme.foreground }]}>{labelTxt}</Text>
        </View>
        <Text style={[ot.sub, { color: theme.hint }]}>{subTxt}</Text>
      </View>
      {toggling ? (
        <ActivityIndicator color={GREEN} size="small" />
      ) : (
        <View style={[ot.pill, { backgroundColor: bg }]}>
          <View style={[ot.knob, { left: isOnline ? 24 : 3 }]} />
        </View>
      )}
    </TouchableOpacity>
  );
};
const ot = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  dotRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dotWrap: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  dot:     { width: 10, height: 10, borderRadius: 5, position: 'absolute' },
  dotRing: { position: 'absolute', width: 20, height: 20, borderRadius: 10, borderWidth: 2, opacity: 0.5 },
  status:  { fontSize: 15, fontWeight: '800' },
  sub:     { fontSize: 11, marginLeft: 24 },
  pill:    { width: 48, height: 27, borderRadius: 13.5, position: 'relative' },
  knob:    { position: 'absolute', top: 3, width: 21, height: 21, borderRadius: 10.5, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// EARNINGS STRIP
// ─────────────────────────────────────────────────────────────────────────────
const EarningsStrip = ({ balance, todayEarnings, onTopUp, onWithdraw, theme, darkMode }) => (
  <View style={[es.card, {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F7',
    borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  }]}>
    <View style={es.left}>
      <Text style={[es.lbl, { color: theme.hint }]}>WALLET BALANCE</Text>
      <Text style={[es.amount, { color: '#5DAA72' }]}>
        ₦{Number(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
      </Text>
      <Text style={[es.todayLbl, { color: theme.hint }]}>
        Today:{' '}
        <Text style={{ color: theme.foreground, fontWeight: '700' }}>
          +₦{Number(todayEarnings ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
        </Text>
      </Text>
    </View>
    <View style={es.btns}>
      <TouchableOpacity
        style={[es.btn, { backgroundColor: darkMode ? 'rgba(255,255,255,0.10)' : '#E5E5EA' }]}
        onPress={onTopUp} activeOpacity={0.88}
      >
        <Ionicons name="add-circle-outline" size={13} color={theme.foreground} />
        <Text style={[es.btnTxt, { color: theme.foreground }]}>Top Up</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[es.btn, { backgroundColor: theme.accent }]}
        onPress={onWithdraw} activeOpacity={0.88}
      >
        <Ionicons name="arrow-up-circle-outline" size={13} color={theme.accentFg} />
        <Text style={[es.btnTxt, { color: theme.accentFg }]}>Withdraw</Text>
      </TouchableOpacity>
    </View>
  </View>
);
const es = StyleSheet.create({
  card:     { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  left:     { flex: 1 },
  lbl:      { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  amount:   { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  todayLbl: { fontSize: 11, fontWeight: '500' },
  btns:     { gap: 8 },
  btn:      { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnTxt:   { fontSize: 11, fontWeight: '800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// METRIC CARD — now accepts IconComponent (SVG) instead of Ionicons string
// ─────────────────────────────────────────────────────────────────────────────
const MetricCard = ({ IconComponent, value, label, color, theme, darkMode }) => (
  <View style={[mc.card, {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F7',
    borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  }]}>
    {/* SVG icon rendered at 40px inside a tinted box */}
    <View style={[mc.iconBox, { backgroundColor: (color || theme.accent) + '18' }]}>
      <IconComponent size={40} />
    </View>
    <Text style={[mc.value, { color: color || theme.accent }]}>{value}</Text>
    <Text style={[mc.label, { color: theme.hint }]}>{label}</Text>
  </View>
);
const mc = StyleSheet.create({
  card:    { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 5 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  value:   { fontSize: 19, fontWeight: '900' },
  label:   { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// WAITING BANNER
// ─────────────────────────────────────────────────────────────────────────────
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
    <View style={[wb.wrap, { backgroundColor: theme.accent + '10', borderColor: theme.accent + '30' }]}>
      <Animated.View style={[wb.dot, { backgroundColor: theme.accent, opacity: dotA }]} />
      <Text style={[wb.txt, { color: theme.accent }]}>Waiting for ride requests...</Text>
    </View>
  );
};
const wb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 13, marginBottom: 14 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  txt:  { fontSize: 13, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function DriverDashboardScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  const [isOnline,          setIsOnline]          = useState(false);
  const [toggling,          setToggling]          = useState(false);
  const [profile,           setProfile]           = useState(null);
  const [stats,             setStats]             = useState(null);
  const [walletBalance,     setWalletBalance]     = useState(null);
  const [todayEarnings,     setTodayEarnings]     = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [activeRide,        setActiveRide]        = useState(null);
  const [floorPriceActive,  setFloorPriceActive]  = useState(false);
  const [activeFloorAmount, setActiveFloorAmount] = useState(0);
  const [maintenance,       setMaintenance]       = useState({
    isOn: false, isScheduled: false, message: '', endsAt: null,
  });

  const fadeA  = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(60)).current;

  const hasMaintBanner = maintenance.isOn || maintenance.isScheduled;
  const isApproved     = profile?.isApproved ?? false;
  const isRejected     = profile?.isRejected ?? false;

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, statsRes, walletRes, earningsRes, activeRideRes] = await Promise.allSettled([
        driverAPI.getProfile(),
        userAPI.getStats(),
        walletAPI.getWallet(),
        driverAPI.getEarnings({ period: 'today' }),
        rideAPI.getActiveRide(),
      ]);

      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value?.data?.profile ?? profileRes.value?.profile ?? null;
        setProfile(p);
        setIsOnline(p?.isOnline ?? false);
        const floor = p?.preferredFloorPrice ?? 0;
        setFloorPriceActive(floor > 0);
        setActiveFloorAmount(floor);
      }
      if (statsRes.status    === 'fulfilled') setStats(statsRes.value?.data);
      if (walletRes.status   === 'fulfilled') setWalletBalance(walletRes.value?.data?.wallet?.balance ?? 0);
      if (earningsRes.status === 'fulfilled') setTodayEarnings(parseFloat(earningsRes.value?.data?.netEarnings ?? 0));
      if (activeRideRes.status === 'fulfilled') {
        const ride = activeRideRes.value?.data?.ride ?? activeRideRes.value?.ride ?? null;
        setActiveRide(ride && ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status) ? ride : null);
      }
      const maint = await checkMaintenance();
      setMaintenance(maint);
    } catch {}
    finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  useEffect(() => {
    const showDocPrompt = async () => {
      try {
        const seen = await AsyncStorage.getItem('@driver_docs_prompt_seen');
        if (seen === 'true') return;
        if (!profile || profile.isApproved || profile.isRejected) return;
        setTimeout(() => {
          Alert.alert(
            'Complete Your Profile',
            'Upload your driver license, vehicle registration, and insurance documents to start accepting rides.',
            [
              { text: 'Later',      style: 'cancel', onPress: () => AsyncStorage.setItem('@driver_docs_prompt_seen', 'true') },
              { text: 'Upload Now', onPress: () => { AsyncStorage.setItem('@driver_docs_prompt_seen', 'true'); navigation.navigate('DriverDocuments'); } },
            ],
            { cancelable: false }
          );
        }, 600);
      } catch {}
    };
    if (!loading && profile) showDocPrompt();
  }, [loading, profile]);

  useEffect(() => {
    const handleReq = (data) => {
      // If the queue screen is already open, it handles new requests internally
      // via its own socket listener — no double-navigation needed
      const currentRoute = navigation.getState()?.routes?.slice(-1)[0]?.name;
      if (currentRoute === 'IncomingRideQueue') return;
      navigation.navigate('IncomingRideQueue', { initialRequest: data });
    };

    const handleCanc = (data) => {
      // Only dismiss the queue if it's open and this specific ride
      // was the only one — the queue handles multi-ride cancellations itself
      const currentRoute = navigation.getState()?.routes?.slice(-1)[0]?.name;
      if (currentRoute !== 'IncomingRideQueue') {
        try { navigation.goBack(); } catch {}
      }
    };

    socketService.on('ride:new_request', handleReq);
    socketService.on('ride:cancelled',   handleCanc);
    socketService.connect().catch((err) => console.warn('[Dashboard] socket connect:', err?.message));
    return () => {
      socketService.off('ride:new_request', handleReq);
      socketService.off('ride:cancelled',   handleCanc);
    };
  }, [navigation]);

  const toggleOnline = async () => {
    if (isRejected) {
      Alert.alert('Application Not Approved', profile?.rejectionReason ? `Your application was rejected: ${profile.rejectionReason}` : 'Your application was not approved. Please contact support.');
      return;
    }
    if (maintenance.isOn && !isOnline) {
      const endsMsg = maintenance.endsAt ? `\n\nExpected back: ${new Date(maintenance.endsAt).toLocaleString('en-NG')}` : '';
      Alert.alert('Platform Under Maintenance', 'You cannot go online until maintenance ends.' + endsMsg);
      return;
    }
    if (!profile?.isApproved) {
      Alert.alert('Pending Approval', 'Your account is under review. You will be notified when approved.', [
        { text: 'Later',            style: 'cancel' },
        { text: 'Upload Documents', onPress: () => navigation.navigate('DriverDocuments') },
      ]);
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

  const goToEarnings  = () => navigation.getParent()?.navigate('EarningsTab', { screen: 'EarningsHome' });
  const goToTopUp     = () => navigation.getParent()?.navigate('EarningsTab', { screen: 'WalletTopUp' });
  const goToWithdraw  = () => navigation.getParent()?.navigate('EarningsTab', { screen: 'Withdrawal' });
  const goToProfile   = () => navigation.getParent()?.navigate('ProfileTab');
  const goToDocuments = () => navigation.navigate('DriverDocuments');

  const quickActions = [
    { Icon: EarningsIcon,    label: 'Earnings',     color: theme.accent, onPress: goToEarnings },
    { Icon: RideHistoryIcon, label: 'Ride History', color: '#A78BFA',    onPress: () => navigation.getParent()?.navigate('EarningsTab', { screen: 'DriverHistory' }) },
    { Icon: FloorPriceIcon,  label: 'Floor Price',  color: PURPLE,       onPress: () => navigation.navigate('FloorPrice') },
    { Icon: DocumentsIcon,   label: 'Documents',    color: '#4E8DBD',    onPress: goToDocuments },
    { Icon: SupportIcon,     label: 'Support',      color: theme.accent, onPress: () => navigation.navigate('Support') },
  ];

  const mapRegion = { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.03, longitudeDelta: 0.03 };

  const sheetBg     = darkMode ? '#111111' : '#FFFFFF';
  const inputBg     = darkMode ? 'rgba(255,255,255,0.07)' : '#F2F2F7';
  const inputBorder = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
  const pillBg      = isOnline ? GREEN : (darkMode ? '#2C2C2E' : '#E5E5EA');
  const pillTxt     = isOnline ? '#FFFFFF' : (darkMode ? '#AAAAAA' : '#666666');

  return (
    <View style={s.root}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── MAP ── */}
      <View style={s.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton={false}
          scrollEnabled={false}
          zoomEnabled={false}
        />

        {hasMaintBanner && (
          <View style={{ paddingTop: insets.top }}>
            <MaintenanceBanner message={maintenance.message} endsAt={maintenance.endsAt} scheduled={maintenance.isScheduled} />
          </View>
        )}

        <Animated.View style={[s.mapTopBar, { paddingTop: hasMaintBanner ? 8 : insets.top + 8, opacity: fadeA }]}>
          <View style={[s.statusPill, { backgroundColor: pillBg }]}>
            <View style={[s.pillDot, { backgroundColor: isOnline ? 'rgba(255,255,255,0.6)' : (darkMode ? '#555' : '#aaa') }]} />
            <Text style={[s.pillTxt, { color: pillTxt }]}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <View style={s.mapTopRight}>
            <TouchableOpacity
              style={[s.mapBtn, { backgroundColor: darkMode ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)', borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications-outline" size={19} color={darkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToProfile} activeOpacity={0.85}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={[s.avatar, { borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]} />
              ) : (
                <View style={[s.avatarFallback, { backgroundColor: darkMode ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)', borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]}>
                  <Text style={[s.avatarInitials, { color: theme.accent }]}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* ── BOTTOM SHEET ── */}
      <Animated.View style={[s.sheet, { backgroundColor: sheetBg, transform: [{ translateY: sheetY }] }]}>
        <View style={s.handleWrap}>
          <View style={[s.handle, { backgroundColor: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.13)' }]} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.sheetScroll, { paddingBottom: insets.bottom + TAB_H + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeA }}>

            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <Text style={[s.eyebrow, { color: theme.hint }]}>DRIVER DASHBOARD</Text>
                <Text style={[s.name, { color: theme.foreground }]} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
                <View style={{ marginTop: 6 }}>
                  {isRejected ? <RejectedBadge /> : isApproved ? <VerifiedBadge theme={theme} /> : <PendingBadge theme={theme} />}
                </View>
              </View>
            </View>

            {/* Rejected banner */}
            {isRejected && !loading && (
              <TouchableOpacity style={[s.alertBanner, { backgroundColor: '#E0555510', borderColor: '#E05555' }]} onPress={goToDocuments} activeOpacity={0.85}>
                <Ionicons name="cloud-upload-outline" size={18} color="#E05555" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: '#E05555' }]}>Application Rejected</Text>
                  <Text style={[s.alertSub, { color: theme.hint }]}>{profile?.rejectionReason ? `Reason: ${profile.rejectionReason}` : 'Upload updated documents to re-submit.'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#E05555" />
              </TouchableOpacity>
            )}

            {/* Pending banner */}
            {!isApproved && !isRejected && !loading && (
              <TouchableOpacity style={[s.alertBanner, { backgroundColor: inputBg, borderColor: inputBorder }]} onPress={goToDocuments} activeOpacity={0.85}>
                <Ionicons name="cloud-upload-outline" size={18} color={theme.hint} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: theme.foreground }]}>Upload Documents</Text>
                  <Text style={[s.alertSub, { color: theme.hint }]}>Upload your license, registration & insurance to get started.</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={theme.hint} />
              </TouchableOpacity>
            )}

            {/* Online toggle */}
            <OnlineToggle isOnline={isOnline} toggling={toggling} onToggle={toggleOnline} isApproved={isApproved} isRejected={isRejected} theme={theme} darkMode={darkMode} />

            {/* Active ride banner */}
            {activeRide && (
              <ActiveRideBanner ride={activeRide} role="DRIVER" theme={theme} onPress={() => navigation.navigate('ActiveRide', { rideId: activeRide.id })} />
            )}

            {/* Waiting banner */}
            {isOnline && !activeRide && !maintenance.isOn && <WaitingBanner theme={theme} />}

            {/* Earnings strip */}
            {!loading && (
              <EarningsStrip balance={walletBalance} todayEarnings={todayEarnings} onTopUp={goToTopUp} onWithdraw={goToWithdraw} theme={theme} darkMode={darkMode} />
            )}

            {/* ── Stats row — SVG icons ── */}
            {loading ? (
              <ActivityIndicator color={theme.accent} style={{ marginBottom: 16 }} />
            ) : (
              <View style={s.statsRow}>
                {/* Rides count → RideHistoryIcon */}
                <MetricCard
                  IconComponent={RideHistoryIcon}
                  value={stats?.completedRides ?? profile?.totalRides ?? 0}
                  label="Rides"
                  color={theme.accent}
                  theme={theme}
                  darkMode={darkMode}
                />
                {/* Rating → EarningsIcon (star/value motif) */}
                <MetricCard
                  IconComponent={EarningsIcon}
                  value={(profile?.rating ?? stats?.rating ?? 0).toFixed(1)}
                  label="Rating"
                  color={PURPLE}
                  theme={theme}
                  darkMode={darkMode}
                />
                {/* Acceptance rate → FloorPriceIcon (bar-chart / trending up) */}
                <MetricCard
                  IconComponent={FloorPriceIcon}
                  value={isApproved ? '94%' : '—'}
                  label="Accept"
                  color="#5DAA72"
                  theme={theme}
                  darkMode={darkMode}
                />
              </View>
            )}

            {/* ── Vehicle card — DocumentsIcon ── */}
            {profile?.vehicleMake && (
              <TouchableOpacity
                style={[s.rowCard, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={goToDocuments}
                activeOpacity={0.8}
              >
                {/* replaced Ionicons car-outline with DocumentsIcon */}
                <View style={[s.rowIcon, { backgroundColor: theme.accent + '18' }]}>
                  <DocumentsIcon size={36} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowCardTitle, { color: theme.foreground }]}>
                    {profile.vehicleColor} {profile.vehicleMake} {profile.vehicleModel}
                  </Text>
                  <Text style={[s.rowCardSub, { color: theme.accent }]}>{profile.vehiclePlate}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.hint} />
              </TouchableOpacity>
            )}

            {/* ── Floor price card — FloorPriceIcon ── */}
            {floorPriceActive && !loading && (
              <TouchableOpacity
                style={[s.rowCard, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => navigation.navigate('FloorPrice')}
                activeOpacity={0.8}
              >
                {/* replaced Ionicons trending-up-outline with FloorPriceIcon */}
                <View style={[s.rowIcon, { backgroundColor: PURPLE + '18' }]}>
                  <FloorPriceIcon size={36} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowCardTitle, { color: theme.foreground }]}>Floor Price Active</Text>
                  <Text style={[s.rowCardSub, { color: PURPLE }]}>
                    Min ₦{activeFloorAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })} per ride
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.hint} />
              </TouchableOpacity>
            )}

            {/* Quick actions */}
            <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
            <View style={s.actionGrid}>
              {quickActions.map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.actionCard, { backgroundColor: inputBg, borderColor: inputBorder }]}
                  onPress={item.onPress}
                  activeOpacity={0.75}
                >
                  <View style={[s.actionIcon, { backgroundColor: (item.color ?? theme.accent) + '18' }]}>
                    <item.Icon size={44} />
                  </View>
                  <Text style={[s.actionLabel, { color: theme.foreground }]}>{item.label}</Text>
                  {item.label === 'Floor Price' && floorPriceActive && (
                    <View style={[s.floorBadge, { backgroundColor: PURPLE }]}>
                      <Text style={s.floorBadgeTxt}>₦{activeFloorAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Footer */}
            <View style={[s.footer, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Ionicons name={isApproved ? 'shield-checkmark-outline' : 'shield-outline'} size={13} color={isApproved ? '#5DAA72' : theme.hint} />
              <Text style={[s.footerTxt, { color: isApproved ? '#5DAA72' : theme.hint }]}>
                {isApproved ? 'Verified & Approved Driver' : 'Verification Pending'}
              </Text>
            </View>

          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  mapContainer: { flex: 1 },
  mapTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: H_PAD },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillTxt: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  mapTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatar:         { width: 42, height: 42, borderRadius: 21, borderWidth: 2 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '800' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SHEET_SNAP, borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 22 },
  handleWrap:  { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle:      { width: 38, height: 4, borderRadius: 2 },
  sheetScroll: { paddingHorizontal: H_PAD, paddingTop: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  eyebrow:     { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 3 },
  name:        { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  alertTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  alertSub:    { fontSize: 11, lineHeight: 17 },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 14 },
  // Row cards — icon box slightly larger to fit SVG
  rowCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  rowIcon:      { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowCardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rowCardSub:   { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 12, marginTop: 4 },
  actionGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  actionCard:   { width: (width - H_PAD * 2 - 10) / 2, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  actionIcon:   { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  actionLabel:  { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  floorBadge:   { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, marginTop: -2 },
  floorBadgeTxt:{ fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 12, marginBottom: 4 },
  footerTxt: { fontSize: 12, fontWeight: '700' },
});