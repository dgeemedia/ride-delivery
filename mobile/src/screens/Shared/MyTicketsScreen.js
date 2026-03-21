// mobile/src/screens/Shared/MyTicketsScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { supportAPI }        from '../../services/api';

const { width } = Dimensions.get('window');

const STATUS_META = {
  open:        { label: 'Open',        color: '#C9A96E', icon: 'time-outline'              },
  in_progress: { label: 'In Progress', color: '#4E8DBD', icon: 'reload-circle-outline'     },
  resolved:    { label: 'Resolved',    color: '#5DAA72', icon: 'checkmark-circle-outline'  },
  closed:      { label: 'Closed',      color: '#888',    icon: 'lock-closed-outline'        },
};

const PRIORITY_COLOR = {
  low: '#5DAA72', medium: '#C9A96E', high: '#E07B55', urgent: '#E05555',
};

const CATEGORY_ICON = {
  account: 'person-circle-outline', payment: 'card-outline',
  ride: 'car-outline', delivery: 'cube-outline',
  technical: 'settings-outline', other: 'help-circle-outline',
};

const TicketCard = ({ ticket, onPress, theme }) => {
  const meta  = STATUS_META[ticket.status] ?? STATUS_META.open;
  const pColor = PRIORITY_COLOR[ticket.priority] ?? '#888';
  const catIcon = CATEGORY_ICON[ticket.category] ?? 'help-circle-outline';
  const date  = new Date(ticket.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <TouchableOpacity
      style={[tc.card, { backgroundColor: theme.backgroundAlt, borderColor: meta.color + '30' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={tc.top}>
        <View style={[tc.iconWrap, { backgroundColor: meta.color + '15' }]}>
          <Ionicons name={catIcon} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[tc.ticketNo, { color: theme.hint }]}>{ticket.ticketNumber}</Text>
          <Text style={[tc.subject, { color: theme.foreground }]} numberOfLines={1}>{ticket.subject}</Text>
        </View>
        <View style={[tc.statusBadge, { backgroundColor: meta.color + '15' }]}>
          <Ionicons name={meta.icon} size={11} color={meta.color} />
          <Text style={[tc.statusLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <Text style={[tc.preview, { color: theme.hint }]} numberOfLines={2}>{ticket.description}</Text>

      <View style={tc.footer}>
        <View style={[tc.priorityDot, { backgroundColor: pColor }]} />
        <Text style={[tc.priorityTxt, { color: pColor }]}>{ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} priority</Text>
        <Text style={[tc.date, { color: theme.hint }]}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
};

const tc = StyleSheet.create({
  card:         { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  top:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  iconWrap:     { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  ticketNo:     { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  subject:      { fontSize: 14, fontWeight: '700' },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusLabel:  { fontSize: 10, fontWeight: '700' },
  preview:      { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  footer:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priorityDot:  { width: 6, height: 6, borderRadius: 3 },
  priorityTxt:  { fontSize: 11, fontWeight: '600', flex: 1 },
  date:         { fontSize: 11 },
});

export default function MyTicketsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const fadeA           = useRef(new Animated.Value(0)).current;

  const [tickets,     setTickets]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await supportAPI.getMyTickets({ page: 1, limit: 50, status: statusFilter || undefined });
      setTickets(res?.data?.tickets ?? []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const FILTERS = [
    { value: '',           label: 'All'         },
    { value: 'open',       label: 'Open'        },
    { value: 'in_progress',label: 'In Progress' },
    { value: 'resolved',   label: 'Resolved'    },
  ];

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={20} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.foreground }]}>My Tickets</Text>
        <TouchableOpacity
          style={[s.newBtn, { backgroundColor: theme.accent }]}
          onPress={() => navigation.navigate('SubmitTicket')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={theme.accentFg ?? '#111'} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.filterRow, { borderBottomColor: theme.border }]}
      >
        {FILTERS.map(f => {
          const active = statusFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[s.filterChip, { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accent + '15' : 'transparent' }]}
              onPress={() => setStatusFilter(f.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterLabel, { color: active ? theme.accent : theme.hint }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.accent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeA }}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          {tickets.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.accent + '12' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={theme.accent} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.foreground }]}>No tickets yet</Text>
              <Text style={[s.emptySub, { color: theme.hint }]}>
                {statusFilter ? `No ${statusFilter.replace('_', ' ')} tickets` : "Submit a ticket and we'll help you out"}
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { borderColor: theme.accent + '40', backgroundColor: theme.accent + '10' }]}
                onPress={() => navigation.navigate('SubmitTicket')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={14} color={theme.accent} />
                <Text style={[s.emptyBtnTxt, { color: theme.accent }]}>New Ticket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            tickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                theme={theme}
                onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
              />
            ))
          )}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center', opacity: 0.05 },

  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn:   { width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title:     { flex: 1, fontSize: 18, fontWeight: '800' },
  newBtn:    { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  filterRow: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1 },
  filterChip:{ borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterLabel:{ fontSize: 12, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyIcon:   { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:  { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub:    { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20, paddingHorizontal: 20 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnTxt: { fontSize: 13, fontWeight: '700' },
});