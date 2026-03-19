// mobile/src/screens/Shared/NotificationsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Animated, ActivityIndicator, Alert,
  RefreshControl, Platform,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { notificationAPI }   from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Type → icon / color / navigation config
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  // Rides
  ride_requested:   { icon: 'car-outline',             color: '#4E8DBD', label: 'Ride Requested',   nav: 'RideTracking'      },
  ride_accepted:    { icon: 'car-sport-outline',        color: '#FFB800', label: 'Ride Accepted',    nav: 'RideTracking'      },
  ride_arrived:     { icon: 'location-outline',         color: '#A78BFA', label: 'Driver Arrived',   nav: 'RideTracking'      },
  ride_started:     { icon: 'navigate-outline',         color: '#5DAA72', label: 'Ride Started',     nav: 'RideTracking'      },
  ride_completed:   { icon: 'checkmark-circle-outline', color: '#5DAA72', label: 'Ride Completed',   nav: 'History'           },
  ride_cancelled:   { icon: 'close-circle-outline',     color: '#E05555', label: 'Ride Cancelled',   nav: 'History'           },
  // Deliveries
  delivery_requested:  { icon: 'cube-outline',             color: '#4E8DBD', label: 'Delivery Requested', nav: 'DeliveryTracking'  },
  delivery_assigned:   { icon: 'bicycle-outline',          color: '#34D399', label: 'Partner Assigned',   nav: 'DeliveryTracking'  },
  delivery_picked_up:  { icon: 'bag-outline',              color: '#FFB800', label: 'Package Picked Up',  nav: 'DeliveryTracking'  },
  delivery_in_transit: { icon: 'navigate-outline',         color: '#A78BFA', label: 'In Transit',         nav: 'DeliveryTracking'  },
  delivery_completed:  { icon: 'checkmark-circle-outline', color: '#5DAA72', label: 'Delivered',          nav: 'History'           },
  delivery_cancelled:  { icon: 'close-circle-outline',     color: '#E05555', label: 'Delivery Cancelled', nav: 'History'           },
  // Payments
  payment_received:  { icon: 'cash-outline',             color: '#5DAA72', label: 'Payment Received',  nav: null },
  payment_refunded:  { icon: 'refresh-circle-outline',   color: '#A78BFA', label: 'Payment Refunded',  nav: null },
  // Wallet
  wallet_credited:   { icon: 'arrow-down-circle-outline',color: '#5DAA72', label: 'Wallet Credited',   nav: null },
  wallet_debited:    { icon: 'arrow-up-circle-outline',  color: '#E05555', label: 'Wallet Debited',    nav: null },
  wallet_withdrawal: { icon: 'cash-outline',             color: '#FFB800', label: 'Withdrawal',        nav: null },
  // Account
  account_welcome:   { icon: 'happy-outline',            color: '#34D399', label: 'Welcome!',          nav: null },
  account_verified:  { icon: 'shield-checkmark-outline', color: '#5DAA72', label: 'Email Verified',    nav: null },
  account_suspended: { icon: 'warning-outline',          color: '#E05555', label: 'Account Suspended', nav: null },
  password_reset:    { icon: 'lock-closed-outline',      color: '#FFB800', label: 'Password Reset',    nav: null },
  driver_approved:   { icon: 'shield-checkmark-outline', color: '#5DAA72', label: 'Driver Approved',   nav: null },
  partner_approved:  { icon: 'shield-checkmark-outline', color: '#34D399', label: 'Partner Approved',  nav: null },
  driver_rejected:   { icon: 'close-circle-outline',     color: '#E05555', label: 'Profile Rejected',  nav: null },
  profile_submitted: { icon: 'document-text-outline',    color: '#4E8DBD', label: 'Profile Submitted', nav: null },
  rating_received:   { icon: 'star-outline',             color: '#FFB800', label: 'New Rating',        nav: null },
  // Fallback
  default:           { icon: 'notifications-outline',    color: '#4E8DBD', label: 'Notification',      nav: null },
};

const getConfig = (type) => TYPE_CONFIG[type] ?? TYPE_CONFIG.default;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: relative time
// ─────────────────────────────────────────────────────────────────────────────
const relativeTime = (dateStr) => {
  const now  = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationCard
// ─────────────────────────────────────────────────────────────────────────────
const NotificationCard = ({ item, onPress, onDelete, theme }) => {
  const cfg       = getConfig(item.type);
  const slideX    = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  const handlePress = () => {
    setExpanded(e => !e);
    onPress(item);
  };

  return (
    <Animated.View style={{ transform: [{ translateX: slideX }] }}>
      <TouchableOpacity
        style={[
          nc.card,
          {
            backgroundColor: item.isRead ? theme.backgroundAlt : cfg.color + '0D',
            borderColor:      item.isRead ? theme.border        : cfg.color + '40',
            borderLeftColor:  cfg.color,
            borderLeftWidth:  3,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.82}
      >
        {/* Unread dot */}
        {!item.isRead && (
          <View style={[nc.unreadDot, { backgroundColor: cfg.color }]} />
        )}

        <View style={[nc.iconWrap, { backgroundColor: cfg.color + '18' }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={nc.titleRow}>
            <Text style={[nc.title, { color: theme.foreground, fontWeight: item.isRead ? '600' : '800' }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[nc.time, { color: theme.hint }]}>{relativeTime(item.createdAt)}</Text>
          </View>

          <Text
            style={[nc.message, { color: theme.hint }]}
            numberOfLines={expanded ? undefined : 2}
          >
            {item.message}
          </Text>

          {/* Expanded detail — shows data fields if available */}
          {expanded && item.data && Object.keys(item.data).length > 0 && (
            <View style={[nc.dataBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {Object.entries(item.data)
                .filter(([k, v]) => v && typeof v !== 'object' && k !== 'fareBreakdown')
                .map(([k, v]) => (
                  <View key={k} style={nc.dataRow}>
                    <Text style={[nc.dataKey, { color: theme.hint }]}>
                      {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </Text>
                    <Text style={[nc.dataVal, { color: cfg.color }]}>
                      {typeof v === 'number' && k.toLowerCase().includes('amount')
                        ? `₦${Number(v).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
                        : String(v)}
                    </Text>
                  </View>
                ))
              }
            </View>
          )}

          {/* Type label + nav hint */}
          <View style={nc.footer}>
            <View style={[nc.typePill, { backgroundColor: cfg.color + '15' }]}>
              <Text style={[nc.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {cfg.nav && (
              <View style={nc.navHint}>
                <Text style={[nc.navHintTxt, { color: theme.hint }]}>Tap to view</Text>
                <Ionicons name="chevron-forward" size={11} color={theme.hint} />
              </View>
            )}
          </View>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={nc.deleteBtn}
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={14} color={theme.hint} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};
const nc = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  unreadDot:  { position: 'absolute', top: 14, right: 42, width: 7, height: 7, borderRadius: 4 },
  iconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  title:      { fontSize: 13, flex: 1 },
  time:       { fontSize: 10, fontWeight: '600', flexShrink: 0 },
  message:    { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  dataBox:    { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 8, gap: 5 },
  dataRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dataKey:    { fontSize: 11 },
  dataVal:    { fontSize: 11, fontWeight: '700' },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  navHint:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navHintTxt: { fontSize: 10 },
  deleteBtn:  { padding: 4, marginTop: 2, flexShrink: 0 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [filter,        setFilter]        = useState('all'); // 'all' | 'unread'

  const fadeA = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset && p > totalPages) return;

    if (reset) setLoading(true);
    else       setLoadingMore(true);

    try {
      const res = await notificationAPI.getNotifications({
        page:       p,
        limit:      20,
        unreadOnly: filter === 'unread' ? 'true' : undefined,
      });
      const data = res?.data;
      const list = data?.notifications ?? [];

      setNotifications(prev => reset ? list : [...prev, ...list]);
      setUnreadCount(data?.unreadCount ?? 0);
      setTotalPages(data?.pagination?.pages ?? 1);
      if (reset) setPage(2);
      else       setPage(p + 1);
    } catch {}
    finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [page, totalPages, filter]);

  useEffect(() => { load(true); }, [filter]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handlePress = async (item) => {
    // Mark as read
    if (!item.isRead) {
      try {
        await notificationAPI.markAsRead(item.id);
        setNotifications(prev =>
          prev.map(n => n.id === item.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch {}
    }

    // Navigate to relevant screen based on type
    const cfg = getConfig(item.type);
    if (!cfg.nav) return;

    const data = item.data ?? {};

    const role = user?.role;

    switch (cfg.nav) {
      case 'RideTracking':
        if (data.rideId) {
          if (role === 'DRIVER') {
            navigation.navigate('ActiveRide', { rideId: data.rideId });
          } else {
            navigation.navigate('RideTracking', { rideId: data.rideId });
          }
        }
        break;
      case 'DeliveryTracking':
        if (data.deliveryId) {
          if (role === 'DELIVERY_PARTNER') {
            navigation.navigate('ActiveDelivery', { deliveryId: data.deliveryId });
          } else {
            navigation.navigate('DeliveryTracking', { deliveryId: data.deliveryId });
          }
        }
        break;
      case 'History':
        if (role === 'DRIVER') navigation.navigate('DriverHistory');
        else if (role === 'DELIVERY_PARTNER') navigation.navigate('PartnerHistory');
        else navigation.navigate('History');
        break;
      default:
        break;
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationAPI.deleteOne(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'This will permanently delete all your notifications.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationAPI.clearAll();
              setNotifications([]);
              setUnreadCount(0);
            } catch {}
          }
        }
      ]
    );
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <SafeAreaView edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: theme.foreground }]}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={[s.headerSub, { color: theme.hint }]}>{unreadCount} unread</Text>
            )}
          </View>
          <View style={s.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={handleMarkAllRead}
              >
                <Ionicons name="checkmark-done-outline" size={16} color={theme.foreground} />
              </TouchableOpacity>
            )}
            {notifications.length > 0 && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
                onPress={handleClearAll}
              >
                <Ionicons name="trash-outline" size={16} color="#E05555" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter tabs */}
        <View style={[s.filterRow, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
          {[
            { key: 'all',    label: 'All' },
            { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, filter === f.key && { backgroundColor: theme.accent }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterTxt, { color: filter === f.key ? '#080C18' : theme.hint }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <NotificationCard
                item={item}
                onPress={handlePress}
                onDelete={handleDelete}
                theme={theme}
              />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
            }
            onEndReached={() => { if (page <= totalPages && !loadingMore) load(); }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.accent} style={{ marginVertical: 16 }} /> : null
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={theme.hint} />
                <Text style={[s.emptyTitle, { color: theme.foreground }]}>No notifications yet</Text>
                <Text style={[s.emptySub, { color: theme.hint }]}>
                  {filter === 'unread' ? 'You have no unread notifications.' : "You're all caught up!"}
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:       { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: 17, fontWeight: '900' },
  headerSub:     { fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow:     { flexDirection: 'row', borderWidth: 0, borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  filterBtn:     { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  filterTxt:     { fontSize: 12, fontWeight: '700' },
  list:          { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 60 },
  empty:         { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle:    { fontSize: 18, fontWeight: '800' },
  emptySub:      { fontSize: 13, textAlign: 'center', maxWidth: 240 },
});