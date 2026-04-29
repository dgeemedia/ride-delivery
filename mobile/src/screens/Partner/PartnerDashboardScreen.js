// mobile/src/screens/Partner/PartnerDashboardScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, StatusBar, Dimensions, Animated,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { Ionicons }                        from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location                       from '../../shims/Location';
import { useAuth }                         from '../../context/AuthContext';
import { useTheme }                        from '../../context/ThemeContext';
import ActiveDeliveryBanner                from '../../components/ActiveDeliveryBanner';
import MaintenanceBanner                   from '../../components/MaintenanceBanner';
import { partnerAPI, userAPI, walletAPI, deliveryAPI } from '../../services/api';
import socketService                       from '../../services/socket';
import { checkMaintenance }                from '../../utils/maintenanceCheck';

const { width } = Dimensions.get('window');
const CA     = '#34D399';
const PURPLE = '#A78BFA';

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
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const VerifiedBadge = ({ theme }) => (
  <View style={[vb.wrap, { backgroundColor: CA, borderColor: theme.border }]}>
    <Ionicons name="shield-checkmark" size={11} color="#080C18" />
    <Text style={vb.txt}>VERIFIED COURIER</Text>
  </View>
);
const vb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  txt:  { fontSize: 9, fontWeight: '900', color: '#080C18', letterSpacing: 1.5 },
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

const MetricCard = ({ icon, value, label, color, theme }) => (
  <View style={[mc.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <View style={[mc.iconBox, { backgroundColor: (color || CA) + '15' }]}>
      <Ionicons name={icon} size={18} color={color || CA} />
    </View>
    <Text style={[mc.value, { color: color || CA }]}>{value}</Text>
    <Text style={[mc.label, { color: theme.hint }]}>{label}</Text>
  </View>
);
const mc = StyleSheet.create({
  card:    { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 5 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  value:   { fontSize: 20, fontWeight: '900' },
  label:   { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

const OnlineToggle = ({ isOnline, toggling, onToggle, isApproved, maintenanceOn, theme }) => {
  const pulseA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim;
    if (isOnline) {
      anim = Animated.loop(Animated.sequence([
        Animated.timing(pulseA, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]));
      anim.start();
    } else { pulseA.setValue(1); }
    return () => anim?.stop();
  }, [isOnline]);

  const disabled = !isApproved || maintenanceOn;

  return (
    <View style={[ot.card, { backgroundColor: theme.backgroundAlt, borderColor: isOnline ? CA + '50' : theme.border }]}>
      <View style={ot.left}>
        <View style={ot.dotRow}>
          <View style={ot.dotWrap}>
            {isOnline && <Animated.View style={[ot.dotRing, { borderColor: CA, transform: [{ scale: pulseA }] }]} />}
            <View style={[ot.dot, { backgroundColor: isOnline ? CA : theme.hint }]} />
          </View>
          <Text style={[ot.status, { color: theme.foreground }]}>
            {isOnline ? "You're Online" : "You're Offline"}
          </Text>
        </View>
        <Text style={[ot.sub, { color: theme.hint }]}>
          {maintenanceOn
            ? 'Unavailable during maintenance'
            : isOnline
              ? 'GPS active • accepting deliveries'
              : isApproved
                ? 'Tap to start accepting deliveries'
                : 'Approval required'}
        </Text>
      </View>
      {toggling
        ? <ActivityIndicator color={CA} size="small" />
        : <Switch
            value={isOnline}
            onValueChange={onToggle}
            disabled={disabled}
            trackColor={{ false: theme.border, true: CA + '70' }}
            thumbColor={isOnline ? CA : theme.hint}
            ios_backgroundColor={theme.border}
          />
      }
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

const WalletStrip = ({ balance, todayEarnings, onTopUp, onWithdraw, theme }) => (
  <View style={[ws.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <View style={ws.left}>
      <Text style={[ws.lbl, { color: theme.hint }]}>WALLET BALANCE</Text>
      <Text style={[ws.amount, { color: '#5DAA72' }]}>
        {`₦${Number(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
      </Text>
      <Text style={[ws.todayLbl, { color: theme.hint }]}>
        {'Today: '}
        <Text style={{ color: CA }}>
          {`+₦${Number(todayEarnings ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
        </Text>
      </Text>
    </View>
    <View style={ws.btns}>
      <TouchableOpacity style={[ws.btn, { backgroundColor: theme.border }]} onPress={onTopUp} activeOpacity={0.88}>
        <Ionicons name="add-circle-outline" size={13} color={theme.foreground} />
        <Text style={[ws.btnTxt, { color: theme.foreground }]}>Top Up</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[ws.btn, { backgroundColor: CA }]} onPress={onWithdraw} activeOpacity={0.88}>
        <Ionicons name="arrow-up-circle-outline" size={13} color="#080C18" />
        <Text style={[ws.btnTxt, { color: '#080C18' }]}>Withdraw</Text>
      </TouchableOpacity>
    </View>
  </View>
);
const ws = StyleSheet.create({
  card:     { borderRadius: 20, borderWidth: 1, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  left:     { flex: 1 },
  lbl:      { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  amount:   { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  todayLbl: { fontSize: 11, fontWeight: '500' },
  btns:     { gap: 8 },
  btn:      { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnTxt:   { fontSize: 11, fontWeight: '800' },
});

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
    <View style={[wb.wrap, { backgroundColor: CA + '10', borderColor: CA + '30' }]}>
      <Animated.View style={[wb.dot, { backgroundColor: CA, opacity: dotA }]} />
      <Text style={[wb.txt, { color: CA }]}>Waiting for delivery requests...</Text>
    </View>
  );
};
const wb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  txt:  { fontSize: 13, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function PartnerDashboardScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  const [isOnline,          setIsOnline]          = useState(false);
  const [toggling,          setToggling]          = useState(false);
  const [profile,           setProfile]           = useState(null);
  const [stats,             setStats]             = useState(null);
  const [walletBalance,     setWalletBalance]     = useState(null);
  const [todayEarnings,     setTodayEarnings]     = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [activeDelivery,    setActiveDelivery]    = useState(null);
  const [floorPriceActive,  setFloorPriceActive]  = useState(false);
  const [activeFloorAmount, setActiveFloorAmount] = useState(0);
  const [maintenance,       setMaintenance]       = useState({
    isOn: false, isScheduled: false, message: '', endsAt: null, startsAt: null,
  });

  const fadeA   = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;

  const hasMaintBanner = maintenance.isOn || maintenance.isScheduled;
  const paddingTop     = hasMaintBanner ? 16 : insets.top + 16;

  const TAB_CONTENT_H = 54;
  const paddingBottom = insets.bottom + TAB_CONTENT_H + 36;

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, statsRes, walletRes, earningsRes, activeDelRes, maintResult] = await Promise.allSettled([
        partnerAPI.getProfile(),
        userAPI.getStats(),
        walletAPI.getWallet(),
        partnerAPI.getEarnings({ period: 'today' }),
        deliveryAPI.getActiveDelivery(),
        checkMaintenance(),
      ]);

      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value?.data?.profile ?? profileRes.value?.data;
        setProfile(p);
        setIsOnline(p?.isOnline ?? false);
        const floor = p?.preferredFloorPrice ?? 0;
        setFloorPriceActive(floor > 0);
        setActiveFloorAmount(floor);
      }
      if (statsRes.status    === 'fulfilled') setStats(statsRes.value?.data);
      if (walletRes.status   === 'fulfilled') setWalletBalance(walletRes.value?.data?.wallet?.balance ?? 0);
      if (earningsRes.status === 'fulfilled') setTodayEarnings(parseFloat(earningsRes.value?.data?.netEarnings ?? 0));
      if (activeDelRes.status === 'fulfilled') {
        const del = activeDelRes.value?.data?.delivery ?? null;
        setActiveDelivery(
          del && ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(del.status) ? del : null
        );
      }
      if (maintResult.status === 'fulfilled') setMaintenance(maintResult.value);
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

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  useEffect(() => {
    const handleIncomingDelivery = (data) => navigation.navigate('IncomingDelivery', { request: data });
    const handleCancelled        = () => { try { navigation.goBack(); } catch {} };

    socketService.on('delivery:incoming_request', handleIncomingDelivery);
    socketService.on('delivery:cancelled',        handleCancelled);

    socketService.connect()
      .then(async () => {
        if (isOnline) {
          try {
            const coords = await getRealLocation();
            socketService.goOnline({ latitude: coords.lat, longitude: coords.lng });
          } catch {
            socketService.goOnline({});
          }
        }
      })
      .catch((err) => console.warn('[PartnerDashboard] socket connect:', err?.message));

    return () => {
      socketService.off('delivery:incoming_request', handleIncomingDelivery);
      socketService.off('delivery:cancelled',        handleCancelled);
    };
  }, [navigation, isOnline]);

  const toggleOnline = async () => {
    if (maintenance.isOn && !isOnline) {
      const endsStr = maintenance.endsAt
        ? `\nMaintenance ends: ${new Date(maintenance.endsAt).toLocaleString('en-NG')}`
        : '';
      Alert.alert('Platform Under Maintenance', 'You cannot go online until maintenance ends.' + endsStr);
      return;
    }

    if (!profile?.isApproved) {
      Alert.alert(
        'Pending Approval',
        'Your account is under review. You will be notified when approved.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => navigation.getParent()?.navigate('ProfileTab') },
        ]
      );
      return;
    }

    setToggling(true);
    try {
      const next = !isOnline;
      if (next) {
        let coords;
        try { coords = await getRealLocation(); }
        catch (e) { Alert.alert('Location Required', e.message); return; }
        await partnerAPI.updateStatus({ isOnline: true, currentLat: coords.lat, currentLng: coords.lng });
        socketService.goOnline({ latitude: coords.lat, longitude: coords.lng });
      } else {
        await partnerAPI.updateStatus({ isOnline: false });
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

  const goToEarnings = () => navigation.getParent()?.navigate('EarningsTab');
  const goToTopUp    = () => navigation.getParent()?.navigate('EarningsTab', { screen: 'WalletTopUp',    initial: false });
  const goToWithdraw = () => navigation.getParent()?.navigate('EarningsTab', { screen: 'Withdrawal',     initial: false });
  const goToProfile  = () => navigation.getParent()?.navigate('ProfileTab');
  const goToHistory  = () => navigation.getParent()?.navigate('EarningsTab', { screen: 'PartnerHistory', initial: false });
  const goToDocuments = () => navigation.getParent()?.navigate('PartnerDocuments'); // kept for potential inline use

  const isApproved = profile?.isApproved ?? false;

  // Quick actions – Documents and Support wired correctly
  const quickActions = [
    { icon: 'wallet-outline',        label: 'Earnings',         color: CA,          onPress: goToEarnings },
    { icon: 'list-outline',          label: 'Delivery History', color: '#5DAA72',   onPress: goToHistory  },
    { icon: 'trending-up-outline',   label: 'Floor Price',      color: PURPLE,      onPress: () => navigation.navigate('FloorPrice') },
    { icon: 'document-text-outline', label: 'Documents',        color: '#4E8DBD',   onPress: () => navigation.navigate('PartnerDocuments') },
    { icon: 'help-circle-outline',   label: 'Support',          color: theme.hint,  onPress: () => navigation.navigate('Support') },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.orb, { backgroundColor: CA }]} />

      {hasMaintBanner && (
        <View style={{ paddingTop: insets.top }}>
          <MaintenanceBanner
            message={maintenance.message}
            endsAt={maintenance.endsAt}
            scheduled={maintenance.isScheduled}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <Animated.View style={{ opacity: fadeA, transform: [{ translateY: headerY }] }}>

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <Text style={[s.eyebrow, { color: theme.hint }]}>COURIER DASHBOARD</Text>
              <Text style={[s.name, { color: theme.foreground }]} numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
              <View style={{ marginTop: 8 }}>
                {isApproved ? <VerifiedBadge theme={theme} /> : <PendingBadge theme={theme} />}
              </View>
            </View>

            <View style={s.headerRight}>
              <TouchableOpacity
                style={[s.notifBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={19} color={theme.foreground} />
              </TouchableOpacity>

              {/* ── Avatar: photo if available, initials fallback ── */}
              <TouchableOpacity
                style={[
                  s.avatarBtn,
                  { borderColor: theme.border },
                  !user?.profileImage && { backgroundColor: CA + '18' },
                ]}
                onPress={goToProfile}
                activeOpacity={0.85}
              >
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={s.avatarImg} />
                ) : (
                  <Text style={[s.avatarTxt, { color: CA }]}>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Pending approval banner */}
          {!isApproved && !loading && (
            <TouchableOpacity
              style={[s.approvalBanner, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              onPress={() => navigation.getParent()?.navigate('ProfileTab')}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={18} color={theme.hint} />
              <View style={{ flex: 1 }}>
                <Text style={[s.approvalTitle, { color: theme.foreground }]}>Account Under Review</Text>
                <Text style={[s.approvalSub, { color: theme.hint }]}>
                  Your documents are being reviewed. Approval takes 24–48 hours.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={theme.hint} />
            </TouchableOpacity>
          )}

          {/* Online toggle */}
          <OnlineToggle
            isOnline={isOnline}
            toggling={toggling}
            onToggle={toggleOnline}
            isApproved={isApproved}
            maintenanceOn={maintenance.isOn}
            theme={theme}
          />

          {/* Active delivery banner */}
          {activeDelivery && (
            <ActiveDeliveryBanner
              delivery={activeDelivery}
              role="DELIVERY_PARTNER"
              theme={theme}
              onPress={() => navigation.navigate('ActiveDelivery', { deliveryId: activeDelivery.id })}
            />
          )}

          {isOnline && !activeDelivery && !maintenance.isOn && <WaitingBanner theme={theme} />}

          {!loading && (
            <WalletStrip
              balance={walletBalance}
              todayEarnings={todayEarnings}
              onTopUp={goToTopUp}
              onWithdraw={goToWithdraw}
              theme={theme}
            />
          )}

          {loading ? (
            <ActivityIndicator color={CA} style={{ marginBottom: 16 }} />
          ) : (
            <View style={s.statsRow}>
              <MetricCard icon="cube-outline"  value={stats?.completedDeliveries ?? profile?.totalDeliveries ?? 0} label="Deliveries" theme={theme} />
              <MetricCard icon="star-outline"  value={(profile?.rating ?? stats?.rating ?? 0).toFixed(1)}          label="Rating"     color={PURPLE} theme={theme} />
              <MetricCard icon="flash-outline" value={isApproved ? '96%' : '—'}                                    label="On Time"    color="#5DAA72" theme={theme} />
            </View>
          )}

          {/* Vehicle card */}
          {profile?.vehicleType && (
            <TouchableOpacity
              style={[s.vehicleCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              onPress={() => navigation.getParent()?.navigate('ProfileTab')}
              activeOpacity={0.8}
            >
              <View style={[s.vehicleIconWrap, { backgroundColor: CA + '18' }]}>
                <Ionicons
                  name={profile.vehicleType === 'BIKE' || profile.vehicleType === 'MOTORCYCLE' ? 'bicycle-outline' : 'car-outline'}
                  size={18}
                  color={CA}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.vehicleName, { color: theme.foreground }]}>{profile.vehicleType}</Text>
                {profile.vehiclePlate && (
                  <Text style={[s.vehiclePlate, { color: CA }]}>{profile.vehiclePlate}</Text>
                )}
              </View>
              <View style={[s.vehicleStatusBadge, { backgroundColor: isApproved ? CA + '20' : '#FFB80020' }]}>
                <Text style={[s.vehicleStatusTxt, { color: isApproved ? CA : '#FFB800' }]}>
                  {isApproved ? 'Approved' : 'Pending'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.hint} />
            </TouchableOpacity>
          )}

          {/* Floor price card */}
          {floorPriceActive && !loading && (
            <TouchableOpacity
              style={[s.vehicleCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border, marginBottom: 14 }]}
              onPress={() => navigation.navigate('FloorPrice')}
              activeOpacity={0.8}
            >
              <View style={[s.vehicleIconWrap, { backgroundColor: PURPLE + '18' }]}>
                <Ionicons name="trending-up-outline" size={18} color={PURPLE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.vehicleName, { color: theme.foreground }]}>Floor Price Active</Text>
                <Text style={[s.vehiclePlate, { color: PURPLE }]}>
                  {`Min ₦${activeFloorAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })} per delivery`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.hint} />
            </TouchableOpacity>
          )}

          {/* Quick actions */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>QUICK ACTIONS</Text>
          <View style={s.actionGrid}>
            {quickActions.map(item => {
              const color = item.color ?? CA;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={[s.actionCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                  onPress={item.onPress}
                  activeOpacity={0.75}
                >
                  <View style={[s.actionIcon, { backgroundColor: color + '18' }]}>
                    <Ionicons name={item.icon} size={20} color={color} />
                  </View>
                  <Text style={[s.actionLabel, { color: theme.foreground }]}>{item.label}</Text>
                  {item.label === 'Floor Price' && floorPriceActive && (
                    <View style={[s.floorBadge, { backgroundColor: PURPLE }]}>
                      <Text style={s.floorBadgeTxt}>
                        {`₦${activeFloorAmount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={[s.footer, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons
              name={isApproved ? 'shield-checkmark-outline' : 'shield-outline'}
              size={13}
              color={isApproved ? '#5DAA72' : theme.hint}
            />
            <Text style={[s.footerTxt, { color: isApproved ? '#5DAA72' : theme.hint }]}>
              {isApproved ? 'Verified & Approved Courier' : 'Verification Pending'}
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  orb:    { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, top: -width * 0.78, right: -width * 0.3, opacity: 0.04 },
  scroll: { paddingHorizontal: 24 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  eyebrow:     { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 4 },
  name:        { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  notifBtn:    { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  // Avatar button — photo fills it, initials centered inside it
  avatarBtn:   { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:   { width: 44, height: 44, borderRadius: 22 },
  avatarTxt:   { fontSize: 14, fontWeight: '800' },

  approvalBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  approvalTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  approvalSub:    { fontSize: 11, lineHeight: 17 },

  statsRow:          { flexDirection: 'row', gap: 10, marginBottom: 14 },
  vehicleCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 20 },
  vehicleIconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  vehicleName:       { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  vehiclePlate:      { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  vehicleStatusBadge:{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 4 },
  vehicleStatusTxt:  { fontSize: 12, fontWeight: '700' },

  sectionTitle:  { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  actionGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  actionCard:    { width: (width - 60) / 2, borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 8 },
  actionIcon:    { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  actionLabel:   { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  floorBadge:    { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, marginTop: -2 },
  floorBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  footerTxt: { fontSize: 12, fontWeight: '700' },
});