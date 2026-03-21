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

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { value: 'account',   label: 'Account',       icon: 'person-circle-outline'   },
  { value: 'payment',   label: 'Payment',        icon: 'card-outline'            },
  { value: 'ride',      label: 'Ride',           icon: 'car-outline'             },
  { value: 'delivery',  label: 'Delivery',       icon: 'cube-outline'            },
  { value: 'technical', label: 'Technical',      icon: 'settings-outline'        },
  { value: 'other',     label: 'Other',          icon: 'help-circle-outline'     },
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

  const [category, setCategory]   = useState('');
  const [priority, setPriority]   = useState('medium');
  const [subject,  setSubject]    = useState('');
  const [message,  setMessage]    = useState('');
  const [loading,  setLoading]    = useState(false);

  useEffect(() => {
    Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const canSubmit = category && subject.trim().length >= 5 && message.trim().length >= 10;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
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
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPriority = PRIORITIES.find(p => p.value === priority);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      {/* Back button */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 14, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeA }}>

          {/* Hero */}
          <View style={s.hero}>
            <View style={[s.heroIcon, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={theme.accent} />
            </View>
            <Text style={[s.heroTitle, { color: theme.foreground }]}>Submit a Ticket</Text>
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
                  <Ionicons name={cat.icon} size={15} color={active ? (theme.accentFg ?? '#111') : theme.hint} />
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
          <View style={[s.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <TextInput
              style={[s.input, { color: theme.foreground }]}
              placeholder="Brief description of your issue"
              placeholderTextColor={theme.hint}
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
              returnKeyType="next"
            />
          </View>
          <Text style={[s.charCount, { color: theme.hint }]}>{subject.length}/200</Text>

          {/* Message */}
          <Text style={[s.sectionLabel, { color: theme.hint }]}>DETAILS</Text>
          <View style={[s.textareaWrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <TextInput
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
          <Text style={[s.charCount, { color: theme.hint }]}>{message.length}/2000</Text>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, {
              backgroundColor: canSubmit ? theme.accent : theme.backgroundAlt,
              borderColor:     canSubmit ? theme.accent : theme.border,
              opacity:         canSubmit ? 1 : 0.55,
            }]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={canSubmit ? (theme.accentFg ?? '#111') : theme.hint} size="small" />
            ) : (
              <>
                <Ionicons name="send-outline" size={17} color={canSubmit ? (theme.accentFg ?? '#111') : theme.hint} />
                <Text style={[s.submitLabel, { color: canSubmit ? (theme.accentFg ?? '#111') : theme.hint }]}>
                  Submit Ticket
                </Text>
              </>
            )}
          </TouchableOpacity>

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
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center', opacity: 0.05 },
  backBtn:     { position: 'absolute', left: 20, zIndex: 99, width: 42, height: 42, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:      { paddingHorizontal: 24 },

  hero:      { alignItems: 'center', paddingBottom: 28 },
  heroIcon:  { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  heroSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  categoryGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  categoryChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  categoryLabel: { fontSize: 13, fontWeight: '600' },

  priorityRow:  { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginBottom: 20 },
  priorityPill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: 'transparent' },
  priorityLabel:{ fontSize: 12, fontWeight: '700' },

  inputWrap:   { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 4 },
  input:       { fontSize: 14, paddingVertical: 12, fontWeight: '500' },
  textareaWrap:{ borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, marginBottom: 4, minHeight: 130 },
  textarea:    { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  charCount:   { fontSize: 10, textAlign: 'right', marginBottom: 16 },

  submitBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, marginBottom: 16 },
  submitLabel: { fontSize: 15, fontWeight: '800' },

  viewExisting:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, marginBottom: 8 },
  viewExistingTxt: { fontSize: 13, fontWeight: '600' },
});