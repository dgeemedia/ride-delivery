// mobile/src/screens/Shared/NotificationsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, StatusBar, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { notificationAPI }   from '../../services/api';

// Notification type → icon + color
const TYPE_META = {
  ride_requested:     { icon: 'car-outline',               color: '#4E8DBD' },
  ride_accepted:      { icon: 'car-sport-outline',         color: '#5DAA72' },
  ride_arrived:       { icon: 'location-outline',          color: '#FFB800' },
  ride_started:       { icon: 'navigate-outline',          color: '#FFB800' },
  ride_completed:     { icon: 'checkmark-circle-outline',  color: '#5DAA72' },
  ride_cancelled:     { icon: 'close-circle-outline',      color: '#E05555' },
  delivery_requested: { icon: 'cube-outline',              color: '#C9A96E' },
  delivery_completed: { icon: 'checkmark-circle-outline',  color: '#5DAA72' },
  delivery_cancelled: { icon: 'close-circle-outline',      color: '#E05555' },
  payment_received:   { icon: 'wallet-outline',            color: '#5DAA72' },
  wallet_credited:    { icon: 'arrow-down-circle-outline', color: '#5DAA72' },
  wallet_debited:     { icon: 'arrow-up-circle-outline',   color: '#E05555' },
  wallet_withdrawal:  { icon: 'arrow-up-circle-outline',   color: '#E05555' },
  account_welcome:    { icon: 'person-circle-outline',     color: '#C9A96E' },
  account_verified:   { icon: 'shield-checkmark-outline',  color: '#5DAA72' },
  password_reset:     { icon: 'lock-closed-outline',       color: '#C9A96E' },
  driver_approved:    { icon: 'shield-checkmark-outline',  color: '#5DAA72' },
  driver_rejected:    { icon: 'shield-outline',            color: '#E05555' },
  profile_submitted:  { icon: 'document-text-outline',     color: '#4E8DBD' },
};
const defaultMeta = { icon: 'notifications-outline', color: '#4E8DBD' };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

// ── Notification row ──────────────────────────────────────────────────────────
const NotifRow = ({ item, theme, onPress }) => {
  const meta = TYPE_META[item.type] ?? defaultMeta;
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      style={[
        nr.row,
        {
          backgroundColor:  item.isRead ? 'transparent' : theme.accent + '09',
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={[nr.iconWrap, { backgroundColor: meta.color + '16' }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={nr.titleRow}>
          <Text style={[nr.title, { color: theme.foreground }]} numberOfLines={1}>{item.title}</Text>
          {!item.isRead && <View style={[nr.unreadDot, { backgroundColor: theme.accent }]} />}
        </View>
        <Text style={[nr.message, { color: theme.hint }]} numberOfLines={2}>{item.message}</Text>
        <Text style={[nr.time, { color: theme.hint }]}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
};
const nr = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  iconWrap:  { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  title:     { fontSize: 14, fontWeight: '600', flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5 },
  message:   { fontSize: 13, lineHeight: 18, marginBottom: 5 },
  time:      { fontSize: 11 },
});

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  const [notifs,   setNotifs]   = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(true);
  const [fetching, setFetching] = useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadNotifications(1);
    Animated.timing(fadeA, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const loadNotifications = async (p = 1) => {
    if (fetching) return;
    setFetching(true);
    try {
      const res      = await notificationAPI.getNotifications({ page: p, limit: 25 });
      const data     = res?.data ?? res;
      const newItems = data?.notifications ?? [];
      setNotifs(prev => p === 1 ? newItems : [...prev, ...newItems]);
      setUnread(data?.unreadCount ?? 0);
      setHasMore(newItems.length === 25);
      setPage(p);
    } catch {}
    finally { setLoading(false); setFetching(false); }
  };

  const handleMarkRead = async (item) => {
    if (item.isRead) return;
    try {
      await notificationAPI.markAsRead(item.id);
      setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
      setUnread(u => Math.max(0, u - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { Alert.alert('Error', 'Could not mark all as read.'); }
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            await notificationAPI.clearAll();
            setNotifs([]);
            setUnread(0);
          } catch { Alert.alert('Error', 'Could not clear notifications.'); }
        }
      },
    ]);
  };

  const renderEmpty = () => (
    <View style={s.empty}>
      <Ionicons name="notifications-off-outline" size={44} color={theme.hint} style={{ marginBottom: 14 }} />
      <Text style={[s.emptyTitle, { color: theme.foreground }]}>All caught up</Text>
      <Text style={[s.emptyHint,  { color: theme.hint }]}>No notifications yet</Text>
    </View>
  );

  const renderFooter = () =>
    hasMore && !loading ? (
      <TouchableOpacity
        style={[s.loadMore, { borderColor: theme.border }]}
        onPress={() => loadNotifications(page + 1)}
      >
        <Text style={[s.loadMoreTxt, { color: theme.accent }]}>
          {fetching ? 'Loading…' : 'Load more'}
        </Text>
      </TouchableOpacity>
    ) : null;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* ── Header — uses safe area inset for top padding ── */}
      <View style={[s.header, {
        paddingTop:    insets.top + 14,
        paddingLeft:   insets.left  + 20,
        paddingRight:  insets.right + 20,
        borderBottomColor: theme.border,
      }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>Notifications</Text>
          {unread > 0 && (
            <Text style={[s.headerSub, { color: theme.accent }]}>{unread} unread</Text>
          )}
        </View>
        <View style={s.headerActions}>
          {unread > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={[s.headerBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            >
              <Ionicons name="checkmark-done-outline" size={16} color={theme.accent} />
            </TouchableOpacity>
          )}
          {notifs.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={[s.headerBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.hint} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.View style={[{ flex: 1 }, { opacity: fadeA }]}>
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={notifs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <NotifRow item={item} theme={theme} onPress={handleMarkRead} />
            )}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              notifs.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + 24 },
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn:       { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '700' },
  headerSub:     { fontSize: 11, fontWeight: '600', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  empty:         { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptyHint:     { fontSize: 13 },
  loadMore:      { alignItems: 'center', paddingVertical: 16, marginHorizontal: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  loadMoreTxt:   { fontSize: 14, fontWeight: '600' },
});