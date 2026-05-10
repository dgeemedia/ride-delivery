// mobile/src/screens/Customer/HomeScreen.js
// ── Bolt-style: Map background + draggable bottom sheet ───────────────────────
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  Image, Alert, Platform, Modal, SafeAreaView, ScrollView,
  TextInput, PanResponder,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../context/AuthContext';
import { useTheme }          from '../../context/ThemeContext';
import { rideAPI, deliveryAPI } from '../../services/api';
import ActiveRideBanner      from '../../components/ActiveRideBanner';
import ActiveDeliveryBanner  from '../../components/ActiveDeliveryBanner';
import MaintenanceBanner     from '../../components/MaintenanceBanner';
import { checkMaintenance }  from '../../utils/maintenanceCheck';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';
import { CommonActions }     from '@react-navigation/native';

// ── Custom SVG service icons ──────────────────────────────────────────────────
import {
  RidesIcon,
  SendIcon,
  DriversIcon,
  SupportIcon,
} from '../../components/ServiceIcons';

const { width, height } = Dimensions.get('window');
const H_PAD = 16;

// Two snap points for the draggable sheet
const SHEET_EXPANDED  = height * 0.92;
const SHEET_COLLAPSED = height * 0.78;
const COLLAPSED_Y     = SHEET_EXPANDED - SHEET_COLLAPSED;

// Tab bar height (matches CustomerNavigator)
const TAB_CONTENT_H = 54;
const TAB_H         = Platform.OS === 'android'
  ? TAB_CONTENT_H + 16
  : TAB_CONTENT_H;

// ── Service card data ─────────────────────────────────────────────────────────
const buildServices = (nav, maint, warn) => [
  {
    id: 'ride',
    IconComponent: RidesIcon,
    label: 'Rides',
    sub: "Let's get moving",
    onPress: () => { if (maint.isOn) { warn(); return; } nav.navigate('RequestRide'); },
  },
  {
    id: 'send',
    IconComponent: SendIcon,
    label: 'Send',
    sub: 'Door to door',
    onPress: () => { if (maint.isOn) { warn(); return; } nav.navigate('RequestDelivery'); },
  },
  {
    id: 'nearby',
    IconComponent: DriversIcon,
    label: 'Drivers',
    sub: 'Browse nearby',
    onPress: () => {
      if (maint.isOn) { warn(); return; }
      nav.navigate('NearbyDrivers', {
        pickupAddress: '', pickupLat: 6.5244, pickupLng: 3.3792,
        dropoffAddress: '', dropoffLat: 6.4281, dropoffLng: 3.4219,
        vehicleType: 'CAR',
      });
    },
  },
  {
    id: 'support',
    IconComponent: SupportIcon,
    label: 'Support',
    sub: "We're here to help",
    onPress: () => { if (maint.isOn) { warn(); return; } nav.navigate('Support'); },
  },
];

// ── DrawerMenu ────────────────────────────────────────────────────────────────
const DrawerMenu = ({ visible, onClose, navigation, user, theme, mode }) => {
  const { logout } = useAuth();
  const slideA = useRef(new Animated.Value(-320)).current;
  const bgA    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(bgA, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideA, { toValue: -320, useNativeDriver: true, tension: 100, friction: 14 }),
        Animated.timing(bgA, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const go = (dest, params) => {
    onClose();
    setTimeout(() => {
      if (['WalletTab', 'ProfileTab', 'HistoryTab'].includes(dest)) {
        navigation.getParent()?.navigate(dest);
      } else {
        navigation.navigate(dest, params);
      }
    }, 250);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(async () => {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: async () => {
            await logout();
            const rootNav = navigation.getParent()?.getParent();
            const targetNav = rootNav ?? navigation;
            targetNav.dispatch(CommonActions.reset({
              index: 0,
              routes: [{ name: 'Auth', state: { routes: [{ name: 'Login' }] } }],
            }));
          },
        },
      ]);
    }, 300);
  };

  const MENU_ITEMS = [
    { icon: 'home-outline',          label: 'Home',           dest: null },
    { icon: 'car-outline',           label: 'Book a Ride',    dest: 'RequestRide' },
    { icon: 'cube-outline',          label: 'Send a Package', dest: 'RequestDelivery' },
    { icon: 'people-outline',        label: 'Nearby Drivers', dest: 'NearbyDrivers',
      params: { pickupAddress: '', pickupLat: 6.5244, pickupLng: 3.3792, dropoffAddress: '', dropoffLat: 6.4281, dropoffLng: 3.4219, vehicleType: 'CAR' } },
    { icon: 'time-outline',          label: 'My History',     dest: 'HistoryTab' },
    { icon: 'wallet-outline',        label: 'Wallet',         dest: 'WalletTab' },
    { icon: 'notifications-outline', label: 'Notifications',  dest: 'Notifications' },
    { icon: 'headset-outline',       label: 'Support',        dest: 'Support' },
    { icon: 'person-outline',        label: 'Profile',        dest: 'ProfileTab' },
  ];

  if (!visible) return null;
  const darkMode = mode === 'dark';
  const panelBg  = darkMode ? 'rgba(8,8,8,0.96)' : 'rgba(255,255,255,0.98)';
  const border   = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[dm.scrim, { opacity: bgA }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[dm.panel, { backgroundColor: panelBg, borderRightColor: border, transform: [{ translateX: slideA }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[dm.userHeader, { borderBottomColor: border }]}>
            <View style={[dm.avatar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.07)' : '#F0F0F0' }]}>
              {user?.profileImage
                ? <Image source={{ uri: user.profileImage }} style={dm.avatarImg} />
                : <Text style={[dm.avatarTxt, { color: theme.foreground }]}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
              }
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[dm.userName, { color: theme.foreground }]} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
              <Text style={[dm.userEmail, { color: theme.hint }]} numberOfLines={1}>{user?.email}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[dm.closeBtn, { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F5F5F5', borderColor: border }]}>
              <Ionicons name="close" size={18} color={theme.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={{ paddingVertical: 8 }}>
              {MENU_ITEMS.map((item, i) => (
                <TouchableOpacity key={i} style={[dm.menuItem, { borderBottomColor: border }]} onPress={() => item.dest ? go(item.dest, item.params) : onClose()} activeOpacity={0.7}>
                  <View style={[dm.menuIcon, { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F5F5F5' }]}>
                    <Ionicons name={item.icon} size={18} color={theme.foreground} />
                  </View>
                  <Text style={[dm.menuLabel, { color: theme.foreground }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.hint} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity style={[dm.logoutRow, { borderTopColor: border }]} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[dm.menuIcon, { backgroundColor: 'rgba(224,85,85,0.10)' }]}>
              <Ionicons name="log-out-outline" size={18} color="#E05555" />
            </View>
            <Text style={dm.logoutTxt}>Sign Out</Text>
          </TouchableOpacity>
          <View style={[dm.footer, { borderTopColor: border }]}>
            <Text style={[dm.footerTxt, { color: theme.hint }]}>DrivAfrica • v1.0.0</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const dm = StyleSheet.create({
  scrim:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel:      { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, borderRightWidth: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingTop: 24, borderBottomWidth: 1 },
  avatar:     { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg:  { width: 48, height: 48 },
  avatarTxt:  { fontSize: 16, fontWeight: '800' },
  userName:   { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  userEmail:  { fontSize: 12 },
  closeBtn:   { width: 34, height: 34, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  menuItem:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  menuIcon:   { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  menuLabel:  { flex: 1, fontSize: 14, fontWeight: '600' },
  logoutRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  logoutTxt:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#E05555' },
  footer:     { padding: 20, borderTopWidth: 1 },
  footerTxt:  { fontSize: 11, textAlign: 'center' },
});

// ── ServiceIcon ───────────────────────────────────────────────────────────────
const ServiceIcon = ({ item, theme, darkMode }) => (
  <TouchableOpacity style={si.wrap} onPress={item.onPress} activeOpacity={0.8}>
    <View style={[si.iconBox, { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F2' }]}>
      <item.IconComponent size={52} />
    </View>
    <Text style={[si.label, { color: theme.foreground }]}>{item.label}</Text>
    <Text style={[si.sub, { color: theme.hint }]}>{item.sub}</Text>
  </TouchableOpacity>
);

const si = StyleSheet.create({
  wrap:    { alignItems: 'center', flex: 1 },
  iconBox: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 7, overflow: 'hidden',
  },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  sub:   { fontSize: 10, fontWeight: '500' },
});

// ── RecentItem ────────────────────────────────────────────────────────────────
const RecentItem = ({ address, subtext, onPress, theme, darkMode, last }) => (
  <TouchableOpacity
    style={[ri.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[ri.iconWrap, { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F2' }]}>
      <Ionicons name="time-outline" size={16} color={theme.hint} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={[ri.addr, { color: theme.foreground }]} numberOfLines={1}>{address}</Text>
      <Text style={[ri.sub,  { color: theme.hint }]}       numberOfLines={1}>{subtext}</Text>
    </View>
    <Ionicons name="chevron-forward" size={14} color={theme.hint} style={{ opacity: 0.5 }} />
  </TouchableOpacity>
);

const ri = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  addr:     { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  sub:      { fontSize: 11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  useInactivityLogout();

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [rideHistory,     setRideHistory]     = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [activeRide,      setActiveRide]      = useState(null);
  const [activeDelivery,  setActiveDelivery]  = useState(null);
  const [maintenance,     setMaintenance]     = useState({ isOn: false, isScheduled: false, message: '', endsAt: null });
  const [historyLoading,  setHistoryLoading]  = useState(true);
  const [sheetExpanded,   setSheetExpanded]   = useState(false);

  const fadeA       = useRef(new Animated.Value(0)).current;
  const sheetTransY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const lastY       = useRef(COLLAPSED_Y);

  // ── PanResponder for sheet drag ───────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        sheetTransY.stopAnimation(val => {
          sheetTransY.setOffset(val);
          sheetTransY.setValue(0);
          lastY.current = val;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const next    = lastY.current + gestureState.dy;
        const clamped = Math.max(0, Math.min(COLLAPSED_Y, next));
        sheetTransY.setValue(clamped - lastY.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        sheetTransY.flattenOffset();
        const current  = lastY.current + gestureState.dy;
        const velocity = gestureState.vy;
        const midpoint = COLLAPSED_Y / 2;

        const snapToExpanded =
          velocity < -0.5 ||
          (velocity >= -0.5 && velocity <= 0.5 && current < midpoint);

        const snapTarget = snapToExpanded ? 0 : COLLAPSED_Y;
        lastY.current = snapTarget;
        setSheetExpanded(snapToExpanded);

        Animated.spring(sheetTransY, {
          toValue: snapTarget,
          useNativeDriver: true,
          tension: 68,
          friction: 13,
        }).start();
      },
    })
  ).current;

  // ── Snap helpers ──────────────────────────────────────────────────────────
  const snapExpand = useCallback(() => {
    lastY.current = 0;
    setSheetExpanded(true);
    Animated.spring(sheetTransY, { toValue: 0, useNativeDriver: true, tension: 68, friction: 13 }).start();
  }, [sheetTransY]);

  const snapCollapse = useCallback(() => {
    lastY.current = COLLAPSED_Y;
    setSheetExpanded(false);
    Animated.spring(sheetTransY, { toValue: COLLAPSED_Y, useNativeDriver: true, tension: 68, friction: 13 }).start();
  }, [sheetTransY]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchAll);
    return unsub;
  }, [navigation]);

  const fetchAll = async () => {
    try {
      const [rideRes, deliveryRes, rideHistRes, delHistRes] = await Promise.allSettled([
        rideAPI.getActiveRide(),
        deliveryAPI.getActiveDelivery(),
        rideAPI.getRideHistory?.({ limit: 5 }),
        deliveryAPI.getDeliveryHistory?.({ limit: 5 }),
      ]);

      if (rideRes.status === 'fulfilled') {
        const ride = rideRes.value?.data?.ride ?? rideRes.value?.ride ?? null;
        setActiveRide(ride && ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status) ? ride : null);
      }
      if (deliveryRes.status === 'fulfilled') {
        const del = deliveryRes.value?.data?.delivery ?? null;
        setActiveDelivery(del && ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(del.status) ? del : null);
      }
      if (rideHistRes.status === 'fulfilled')
        setRideHistory(rideHistRes.value?.data?.rides ?? rideHistRes.value?.rides ?? []);
      if (delHistRes.status === 'fulfilled')
        setDeliveryHistory(delHistRes.value?.data?.deliveries ?? delHistRes.value?.deliveries ?? []);

      const maint = await checkMaintenance();
      setMaintenance(maint);
    } catch (e) {
      console.warn('Fetch error:', e);
    } finally {
      setHistoryLoading(false);
      Animated.timing(fadeA, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }
  };

  const showMaintenanceAlert = () => {
    const endsMsg = maintenance.endsAt
      ? `\n\nExpected back: ${new Date(maintenance.endsAt).toLocaleString('en-NG')}`
      : '';
    Alert.alert('Platform Under Maintenance', maintenance.message + endsMsg);
  };

  const handleCancelRide = () => {
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

  const recentAddresses = [
    ...rideHistory.map(r => ({
      id: `ride-${r.id}`,
      address: r.dropoffAddress ?? 'Unknown destination',
      subtext: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '',
      onPress: () => navigation.navigate('RequestRide'),
    })),
    ...deliveryHistory.map(d => ({
      id: `del-${d.id}`,
      address: d.dropoffAddress ?? 'Unknown destination',
      subtext: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '',
      onPress: () => navigation.navigate('RequestDelivery'),
    })),
  ]
    .sort((a, b) => new Date(b.subtext) - new Date(a.subtext))
    .slice(0, 6);

  const hasMaintBanner = maintenance.isOn || maintenance.isScheduled;
  const serviceCards   = buildServices(navigation, maintenance, showMaintenanceAlert);

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const sheetBg     = darkMode ? '#111111' : '#FFFFFF';
  const hintColor   = darkMode ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)';
  const inputBg     = darkMode ? 'rgba(255,255,255,0.07)' : '#F2F2F2';
  const inputBorder = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  // Bottom padding = tab bar height + safe area + breathing room
  const scrollPaddingBottom = insets.bottom + TAB_H + 24;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        user={user}
        theme={theme}
        mode={mode}
      />

      {/* ── MAP ── */}
      <View style={s.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: 6.5244,
            longitude: 3.3792,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          customMapStyle={darkMode ? DARK_MAP_STYLE : []}
        />

        {hasMaintBanner && (
          <View style={{ paddingTop: insets.top }}>
            <MaintenanceBanner
              message={maintenance.message}
              endsAt={maintenance.endsAt}
              scheduled={maintenance.isScheduled}
            />
          </View>
        )}

        <Animated.View style={[
          s.mapControls,
          { paddingTop: hasMaintBanner ? 8 : insets.top + 8, opacity: fadeA },
        ]}>
          <TouchableOpacity
            style={[s.mapBtn, {
              backgroundColor: darkMode ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)',
              borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            }]}
            onPress={() => setDrawerOpen(true)}
            activeOpacity={0.85}
          >
            <View style={s.hamburger}>
              <View style={[s.hLine, { backgroundColor: theme.foreground }]} />
              <View style={[s.hLine, s.hLineMid, { backgroundColor: theme.foreground }]} />
              <View style={[s.hLine, { backgroundColor: theme.foreground }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate('ProfileTab')}
            activeOpacity={0.85}
          >
            {user?.profileImage ? (
              <Image
                source={{ uri: user.profileImage }}
                style={[s.avatar, { borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]}
              />
            ) : (
              <View style={[s.avatarFallback, {
                backgroundColor: darkMode ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)',
                borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
              }]}>
                <Text style={[s.avatarInitials, { color: theme.foreground }]}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Collapse button — visible when sheet is expanded */}
        {sheetExpanded && (
          <TouchableOpacity
            style={[s.collapseBtn, {
              backgroundColor: darkMode ? 'rgba(20,20,20,0.88)' : 'rgba(255,255,255,0.92)',
              borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              bottom: SHEET_COLLAPSED + 12,
            }]}
            onPress={snapCollapse}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-down" size={18} color={theme.foreground} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── DRAGGABLE BOTTOM SHEET ── */}
      <Animated.View
        style={[s.sheet, {
          backgroundColor: sheetBg,
          height: SHEET_EXPANDED,
          transform: [{ translateY: sheetTransY }],
        }]}
      >
        {/* ── Drag handle — PanResponder lives here only ── */}
        <View style={s.handleWrap} {...panResponder.panHandlers}>
          <View style={[s.handle, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.16)' }]} />
          {sheetExpanded && (
            <Text style={[s.expandedTitle, { color: theme.foreground }]}>Recent Trips</Text>
          )}
        </View>

        {/* ── Bounded inner container — gives ScrollView a proper flex parent ── */}
        <View style={s.sheetInner}>

          {/* Greeting */}
          <View style={s.greetRow}>
            <Text style={[s.greetTxt, { color: theme.foreground }]}>
              {greet}, {user?.firstName}.
            </Text>
            <TouchableOpacity
              style={[s.notifBtn, { backgroundColor: inputBg, borderColor: inputBorder }]}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color={theme.foreground} />
              <View style={[s.notifDot, { borderColor: sheetBg }]} />
            </TouchableOpacity>
          </View>

          {/* Active banners */}
          {activeRide && (
            <ActiveRideBanner
              ride={activeRide}
              role="CUSTOMER"
              theme={theme}
              onPress={() => navigation.navigate('RideTracking', { rideId: activeRide.id })}
              onCancel={activeRide.status === 'REQUESTED' ? handleCancelRide : undefined}
            />
          )}
          {activeDelivery && (
            <ActiveDeliveryBanner
              delivery={activeDelivery}
              role="CUSTOMER"
              theme={theme}
              onPress={() => navigation.navigate('DeliveryTracking', { deliveryId: activeDelivery.id })}
              onCancel={activeDelivery.status === 'PENDING' ? handleCancelDelivery : undefined}
            />
          )}

          {/* ── Service icon row ── */}
          <View style={s.serviceRow}>
            {serviceCards.map(item => (
              <ServiceIcon key={item.id} item={item} theme={theme} darkMode={darkMode} />
            ))}
          </View>

          {/* Where to? search bar */}
          <TouchableOpacity
            style={[s.searchBar, { backgroundColor: inputBg, borderColor: inputBorder }]}
            onPress={() => {
              if (maintenance.isOn) { showMaintenanceAlert(); return; }
              navigation.navigate('RequestRide');
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={18} color={hintColor} />
            <Text style={[s.searchHint, { color: hintColor }]}>Where to?</Text>
            <View style={[s.laterPill, {
              backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
              borderColor: inputBorder,
            }]}>
              <Ionicons name="calendar-outline" size={13} color={hintColor} />
              <Text style={[s.laterTxt, { color: hintColor }]}>Later</Text>
            </View>
          </TouchableOpacity>

          {/* Section label */}
          {!sheetExpanded && recentAddresses.length > 0 && (
            <TouchableOpacity style={s.sectionRow} onPress={snapExpand} activeOpacity={0.7}>
              <Text style={[s.sectionLabel, { color: theme.hint }]}>Recent trips</Text>
              <Ionicons name="chevron-up" size={13} color={theme.hint} />
            </TouchableOpacity>
          )}

          {/* ── Scrollable recent list — flex:1 fills remaining bounded height ── */}
          <ScrollView
            style={s.scrollArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: scrollPaddingBottom,
              paddingHorizontal: H_PAD,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {historyLoading ? (
              <ActivityIndicator color={theme.foreground} style={{ marginTop: 24 }} />
            ) : recentAddresses.length > 0 ? (
              recentAddresses.map((item, i) => (
                <RecentItem
                  key={item.id}
                  address={item.address}
                  subtext={item.subtext}
                  onPress={item.onPress}
                  theme={theme}
                  darkMode={darkMode}
                  last={i === recentAddresses.length - 1}
                />
              ))
            ) : (
              <View style={s.emptyWrap}>
                <Ionicons name="map-outline" size={28} color={hintColor} />
                <Text style={[s.emptyTxt, { color: hintColor }]}>No recent trips yet</Text>
              </View>
            )}
          </ScrollView>

        </View>{/* end sheetInner */}
      </Animated.View>
    </View>
  );
}

// ── Dark map style ────────────────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#212121' }] },
  { featureType: 'road',                elementType: 'geometry',           stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.arterial',       elementType: 'geometry',           stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway',        elementType: 'geometry',           stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water',               elementType: 'geometry',           stylers: [{ color: '#000000' }] },
  { featureType: 'poi',                 elementType: 'labels',             stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
];

const s = StyleSheet.create({
  root: { flex: 1 },

  // Map
  mapContainer: { flex: 1 },
  mapControls: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: H_PAD,
  },
  mapBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  hamburger: { gap: 4.5, alignItems: 'center', justifyContent: 'center' },
  hLine:     { width: 16, height: 1.8, borderRadius: 1 },
  hLineMid:  { width: 11 },
  avatar:         { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '800' },

  collapseBtn: {
    position: 'absolute', right: H_PAD,
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },

  // Sheet
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14, shadowRadius: 14, elevation: 22,
  },

  // Handle area — PanResponder only, no flex
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    minHeight: 36,
  },
  handle:        { width: 38, height: 4, borderRadius: 2 },
  expandedTitle: { marginTop: 6, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  // ── KEY ADDITION: bounded container below the handle ──────────────────────
  // flex:1 means it fills exactly the remaining sheet height after the handle,
  // giving ScrollView a real parent height to work against — same pattern as
  // DriverDashboardScreen's sheetScroll inside its fixed-height sheet.
  sheetInner: {
    flex: 1,
    overflow: 'hidden',
  },

  // ScrollView itself — flex:1 fills remaining height after static elements
  scrollArea: {
    flex: 1,
  },

  greetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: H_PAD, marginBottom: 16, marginTop: 2,
  },
  greetTxt: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  notifDot: {
    position: 'absolute', top: 9, right: 9,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#E05555', borderWidth: 1.5,
  },

  serviceRow: {
    flexDirection: 'row', paddingHorizontal: H_PAD,
    marginBottom: 18, gap: 4,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: H_PAD, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8,
  },
  searchHint: { flex: 1, fontSize: 15, fontWeight: '600' },
  laterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  laterTxt: { fontSize: 12, fontWeight: '600' },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: H_PAD, marginBottom: 2, marginTop: 2,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  emptyWrap: { alignItems: 'center', paddingTop: 32, gap: 10 },
  emptyTxt:  { fontSize: 13, fontWeight: '500' },
});