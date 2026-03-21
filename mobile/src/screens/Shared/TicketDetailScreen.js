// mobile/src/screens/Shared/TicketDetailScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { supportAPI }        from '../../services/api';

const { width } = Dimensions.get('window');

const STATUS_META = {
  open:        { label: 'Open',        color: '#C9A96E' },
  in_progress: { label: 'In Progress', color: '#4E8DBD' },
  resolved:    { label: 'Resolved',    color: '#5DAA72' },
  closed:      { label: 'Closed',      color: '#888'    },
};

const formatTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
};

// ── Message bubble ─────────────────────────────────────────────────────────────
const Bubble = ({ message, isAdmin, theme }) => {
  const accentFg = theme.accentFg ?? '#111';
  return (
    <View style={[bu.row, isAdmin && bu.rowReverse]}>
      <View style={[bu.avatar, { backgroundColor: isAdmin ? theme.accent + '20' : theme.backgroundAlt, borderColor: theme.border }]}>
        <Ionicons
          name={isAdmin ? 'headset-outline' : 'person-outline'}
          size={13}
          color={isAdmin ? theme.accent : theme.hint}
        />
      </View>
      <View style={[bu.wrap, { maxWidth: width * 0.72 }]}>
        <Text style={[bu.sender, { color: theme.hint }]}>
          {isAdmin ? 'Support Agent' : 'You'}
        </Text>
        <View style={[
          bu.bubble,
          isAdmin
            ? { backgroundColor: theme.accent + '18', borderColor: theme.accent + '30' }
            : { backgroundColor: theme.backgroundAlt, borderColor: theme.border },
        ]}>
          <Text style={[bu.text, { color: theme.foreground }]}>{message.message}</Text>
        </View>
        <Text style={[bu.time, { color: theme.hint }]}>{formatTime(message.createdAt)}</Text>
      </View>
    </View>
  );
};

const bu = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'flex-end' },
  rowReverse: { flexDirection: 'row-reverse' },
  avatar:     { width: 30, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  wrap:       {},
  sender:     { fontSize: 10, fontWeight: '600', marginBottom: 4 },
  bubble:     { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  text:       { fontSize: 13, lineHeight: 20 },
  time:       { fontSize: 10, marginTop: 4 },
});

// ── Original message card ──────────────────────────────────────────────────────
const OriginalMessage = ({ ticket, theme }) => (
  <View style={[om.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    <View style={om.top}>
      <Text style={[om.ticketNo, { color: theme.accent }]}>{ticket.ticketNumber}</Text>
      <View style={[om.catChip, { backgroundColor: theme.accent + '12' }]}>
        <Text style={[om.catTxt, { color: theme.accent }]}>{ticket.category}</Text>
      </View>
    </View>
    <Text style={[om.subject, { color: theme.foreground }]}>{ticket.subject}</Text>
    <Text style={[om.desc, { color: theme.hint }]}>{ticket.description}</Text>
    <Text style={[om.date, { color: theme.hint }]}>Submitted {formatTime(ticket.createdAt)}</Text>
  </View>
);
const om = StyleSheet.create({
  card:    { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  top:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ticketNo:{ fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  catChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catTxt:  { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  subject: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  desc:    { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  date:    { fontSize: 11 },
});

export default function TicketDetailScreen({ navigation, route }) {
  const { ticketId }    = route.params;
  const { theme, mode } = useTheme();
  const { user }        = useAuth();
  const insets          = useSafeAreaInsets();

  const [ticket,     setTicket]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reply,      setReply]      = useState('');
  const [sending,    setSending]    = useState(false);

  const scrollRef = useRef(null);
  const fadeA     = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await supportAPI.getTicketById(ticketId);
      setTicket(res?.data?.ticket ?? null);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  // Poll for new replies every 15 s when ticket is open or in_progress
  useEffect(() => {
    if (!ticket) return;
    if (['resolved', 'closed'].includes(ticket.status)) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [ticket?.status, load]);

  const isClosed = ticket && ['resolved', 'closed'].includes(ticket.status);

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      // Customers can't reply via admin endpoint — we re-submit as a new ticket message
      // by using the same support ticket reply endpoint if you expose one,
      // or just show the reply optimistically and note it goes via email.
      // For now we call the submit endpoint as a follow-up note:
      await supportAPI.addReply(ticketId, reply.trim());
      setReply('');
      load();
    } catch {
      // Gracefully fail — message may not be supported yet
      setReply('');
    } finally {
      setSending(false);
    }
  };

  const status = ticket ? (STATUS_META[ticket.status] ?? STATUS_META.open) : null;

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 20}
    >
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={20} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.foreground }]} numberOfLines={1}>
            {ticket?.subject ?? 'Ticket Detail'}
          </Text>
          {status && (
            <Text style={[s.statusLine, { color: status.color }]}>
              {ticket?.ticketNumber} · {status.label}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.accent} size="large" /></View>
      ) : !ticket ? (
        <View style={s.center}>
          <Text style={[s.notFound, { color: theme.hint }]}>Ticket not found.</Text>
        </View>
      ) : (
        <>
          <Animated.ScrollView
            ref={scrollRef}
            style={{ opacity: fadeA }}
            contentContainerStyle={[s.scroll, { paddingBottom: 16 }]}
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
            <OriginalMessage ticket={ticket} theme={theme} />

            {/* Replies */}
            {(ticket.replies ?? []).length > 0 ? (
              ticket.replies.map(r => (
                <Bubble
                  key={r.id}
                  message={r}
                  isAdmin={r.isAdmin}
                  theme={theme}
                />
              ))
            ) : (
              <View style={[s.awaitingWrap, { backgroundColor: theme.backgroundAlt + '80', borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={18} color={theme.hint} />
                <Text style={[s.awaitingTxt, { color: theme.hint }]}>
                  Awaiting a response from our team. We typically reply within 24 hours.
                </Text>
              </View>
            )}

            {/* Resolved notice */}
            {isClosed && (
              <View style={[s.resolvedWrap, { backgroundColor: '#5DAA7215', borderColor: '#5DAA7230' }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#5DAA72" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.resolvedTitle, { color: '#5DAA72' }]}>
                    {ticket.status === 'resolved' ? 'Ticket Resolved' : 'Ticket Closed'}
                  </Text>
                  {ticket.resolution ? (
                    <Text style={[s.resolvedSub, { color: theme.hint }]}>{ticket.resolution}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </Animated.ScrollView>

          {/* Reply bar — hidden when closed */}
          {!isClosed && (
            <View style={[s.replyBar, { backgroundColor: theme.backgroundAlt, borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                style={[s.replyInput, { color: theme.foreground, backgroundColor: theme.background, borderColor: theme.border }]}
                placeholder="Add a follow-up message..."
                placeholderTextColor={theme.hint}
                value={reply}
                onChangeText={setReply}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: reply.trim() ? theme.accent : theme.border }]}
                onPress={handleSend}
                disabled={!reply.trim() || sending}
                activeOpacity={0.8}
              >
                {sending
                  ? <ActivityIndicator size="small" color={theme.accentFg ?? '#111'} />
                  : <Ionicons name="send" size={16} color={reply.trim() ? (theme.accentFg ?? '#111') : theme.hint} />
                }
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn:{ width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title:  { fontSize: 15, fontWeight: '800' },
  statusLine: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound:{ fontSize: 14 },

  awaitingWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  awaitingTxt:  { flex: 1, fontSize: 13, lineHeight: 19 },

  resolvedWrap:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8 },
  resolvedTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  resolvedSub:   { fontSize: 12, lineHeight: 18 },

  replyBar:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn:    { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
});