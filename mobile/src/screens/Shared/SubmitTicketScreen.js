// mobile/src/screens/Shared/SubmitTicketScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Animated, TextInput, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { supportAPI }        from '../../services/api';

const { width, height } = Dimensions.get('window');

const CATEGORIES = [
  { value: 'account',   label: 'Account',   icon: 'person-circle-outline' },
  { value: 'payment',   label: 'Payment',   icon: 'card-outline'          },
  { value: 'ride',      label: 'Ride',       icon: 'car-outline'           },
  { value: 'delivery',  label: 'Delivery',  icon: 'cube-outline'          },
  { value: 'technical', label: 'Technical', icon: 'settings-outline'      },
  { value: 'other',     label: 'Other',      icon: 'help-circle-outline'   },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#5DAA72' },
  { value: 'medium', label: 'Medium', color: '#C9A96E' },
  { value: 'high',   label: 'High',   color: '#E07B55' },
  { value: 'urgent', label: 'Urgent', color: '#E05555' },
];

export default function SubmitTicketScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const fadeA           = useRef(new Animated.Value(0)).current;
  const messageRef      = useRef(null);

  const [category,       setCategory]       = useState('');
  const [priority,       setPriority]       = useState('medium');
  const [subject,        setSubject]        = useState('');
  const [message,        setMessage]        = useState('');
  const [loading,        setLoading]        = useState(false);
  // FIX 1: track whether the user has explicitly tapped Submit so we can
  // show the validation hint even when they haven't typed anything yet.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [headerH,        setHeaderH]        = useState(56);

  useEffect(() => {
    Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const canSubmit = category && subject.trim().length >= 5 && message.trim().length >= 10;

  const handleSubmit = async () => {
    // FIX 1: always mark that the user attempted a submit so the validation
    // hint becomes visible even if no field has been touched yet.
    if (!canSubmit) {
      setSubmitAttempted(true);
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      // FIX 4: use the plural endpoint to match getMyTickets / getTicketById.
      await supportAPI.submitTicket({
        category,
        priority,
        subject:     subject.trim(),
        description: message.trim(),
      });
      Alert.alert(
        'Ticket Submitted ✅',
        "Your request has been received. We'll get back to you within 24 hours.",
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      // FIX 2: the axios response interceptor in api.js already unwraps
      // error.response.data, so `err` IS the data object.
      // The old path  err?.response?.data?.message  was always undefined.
      Alert.alert(
        'Error',
        err?.message ?? err?.error ?? 'Failed to submit ticket. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const SCROLL_H     = height - headerH - insets.bottom - EXTRA_BOTTOM;
  const kvoOffset    = headerH;

  // FIX 1: show the hint whenever canSubmit is false AND either the user
  // has already interacted with a field OR they tapped the button.
  const showValidationHint =
    !canSubmit && (submitAttempted || subject.length > 0 || message.length > 0 || category);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* FIX 3: pointerEvents="none" so the ambient glow never absorbs taps. */}
      <View
        style={[s.ambientGlow, { backgroundColor: theme.accent }]}
        pointerEvents="none"
      />

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <View
        style={[s.header, {
          paddingTop:        insets.top + 10,
          borderBottomColor: theme.border,
          backgroundColor:   theme.background,
        }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>Submit a Ticket</Text>
        <View style={s.headerSpacer} />
      </View>

      {/* ── KAV wraps only the scroll container ───────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={kvoOffset}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Animated.View style={{ opacity: fadeA }}>

              {/* Hero */}
              <View style={s.hero}>
                <View style={[s.heroIcon, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={theme.accent} />
                </View>
                <Text style={[s.heroTitle, { color: theme.foreground }]}>How can we help?</Text>
                <Text style={[s.heroSub, { color: theme.hint }]}>
                  Describe your issue and our team will respond within 24 hours.
                </Text>
              </View>

              {/* Category */}
              <Text style={[s.sectionLabel, { color: theme.hint }]}>CATEGORY</Text>
              <View style={s.categoryGrid}>
                {CATEGORIES.map(cat => {
                  const active = category === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      style={[s.categoryChip, {
                        backgroundColor: active ? theme.accent : theme.backgroundAlt,
                        borderColor:     active ? theme.accent : theme.border,
                      }]}
                      onPress={() => setCategory(cat.value)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={15}
                        color={active ? (theme.accentFg ?? '#111') : theme.hint}
                      />
                      <Text style={[s.categoryLabel, { color: active ? (theme.accentFg ?? '#111') : theme.foreground }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Priority */}
              <Text style={[s.sectionLabel, { color: theme.hint }]}>PRIORITY</Text>
              <View style={[s.priorityRow, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                {PRIORITIES.map(p => {
                  const active = priority === p.value;
                  return (
                    <TouchableOpacity
                      key={p.value}
                      style={[s.priorityPill, active && { backgroundColor: p.color + '20', borderColor: p.color }]}
                      onPress={() => setPriority(p.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.priorityLabel, { color: active ? p.color : theme.hint }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Subject */}
              <Text style={[s.sectionLabel, { color: theme.hint }]}>SUBJECT</Text>
              <View style={[s.inputWrap, {
                backgroundColor: theme.backgroundAlt,
                borderColor: subject.trim().length >= 5 ? theme.accent + '60' : theme.border,
              }]}>
                <TextInput
                  style={[s.input, { color: theme.foreground }]}
                  placeholder="Brief description of your issue"
                  placeholderTextColor={theme.hint}
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={200}
                  returnKeyType="next"
                  onSubmitEditing={() => messageRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
              <Text style={[s.charCount, { color: subject.trim().length >= 5 ? theme.accent : theme.hint }]}>
                {subject.length}/200{subject.trim().length < 5 && subject.length > 0 ? ' • min 5 chars' : ''}
              </Text>

              {/* Message */}
              <Text style={[s.sectionLabel, { color: theme.hint }]}>DETAILS</Text>
              <View style={[s.textareaWrap, {
                backgroundColor: theme.backgroundAlt,
                borderColor: message.trim().length >= 10 ? theme.accent + '60' : theme.border,
              }]}>
                <TextInput
                  ref={messageRef}
                  style={[s.textarea, { color: theme.foreground }]}
                  placeholder="Describe your issue in detail. Include any relevant information like order IDs, amounts, or error messages."
                  placeholderTextColor={theme.hint}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={2000}
                />
              </View>
              <Text style={[s.charCount, { color: message.trim().length >= 10 ? theme.accent : theme.hint }]}>
                {message.length}/2000{message.trim().length < 10 && message.length > 0 ? ' • min 10 chars' : ''}
              </Text>

              {/* Submit button — never disabled so it always stays in the touch tree */}
              <TouchableOpacity
                style={[s.submitBtn, {
                  backgroundColor: canSubmit ? theme.accent : theme.backgroundAlt,
                  borderColor:     canSubmit ? theme.accent : theme.border,
                  opacity:         canSubmit ? 1 : 0.55,
                }]}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator
                    color={canSubmit ? (theme.accentFg ?? '#111') : theme.hint}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="send-outline"
                      size={17}
                      color={canSubmit ? (theme.accentFg ?? '#111') : theme.hint}
                    />
                    <Text style={[s.submitLabel, { color: canSubmit ? (theme.accentFg ?? '#111') : theme.hint }]}>
                      Submit Ticket
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* FIX 1: validation hint — visible as soon as the user taps Submit
                   OR after they've started filling in any field. */}
              {showValidationHint && (
                <View style={[s.validationHint, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Ionicons name="information-circle-outline" size={14} color={theme.hint} />
                  <Text style={[s.validationTxt, { color: theme.hint }]}>
                    {!category
                      ? 'Select a category to continue'
                      : subject.trim().length < 5
                      ? 'Subject needs at least 5 characters'
                      : 'Details need at least 10 characters'}
                  </Text>
                </View>
              )}

              {/* View existing */}
              <TouchableOpacity
                style={s.viewExisting}
                onPress={() => navigation.navigate('MyTickets')}
                activeOpacity={0.7}
              >
                <Text style={[s.viewExistingTxt, { color: theme.accent }]}>View my existing tickets</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.accent} />
              </TouchableOpacity>

            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: {
    position: 'absolute', width: width * 1.2, height: width * 1.2,
    borderRadius: width * 0.6, top: -width * 0.75,
    alignSelf: 'center', opacity: 0.05,
  },

  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn:      { width: 38, height: 38, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  headerSpacer: { width: 38 },

  scroll: { paddingHorizontal: 24, paddingTop: 24 },

  hero:      { alignItems: 'center', paddingBottom: 24 },
  heroIcon:  { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  heroSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  categoryLabel:{ fontSize: 13, fontWeight: '600' },

  priorityRow:  { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginBottom: 20 },
  priorityPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: 'transparent' },
  priorityLabel:{ fontSize: 12, fontWeight: '700' },

  inputWrap:   { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 4 },
  input:       { fontSize: 14, paddingVertical: 12, fontWeight: '500' },
  textareaWrap:{ borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, marginBottom: 4, minHeight: 130 },
  textarea:    { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  charCount:   { fontSize: 10, textAlign: 'right', marginBottom: 16 },

  submitBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, marginBottom: 12 },
  submitLabel: { fontSize: 15, fontWeight: '800' },

  validationHint: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  validationTxt:  { flex: 1, fontSize: 12 },

  viewExisting:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, marginBottom: 8 },
  viewExistingTxt: { fontSize: 13, fontWeight: '600' },
});