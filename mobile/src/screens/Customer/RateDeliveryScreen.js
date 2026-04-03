// mobile/src/screens/Customer/RateDeliveryScreen.js
//
// Shown after a delivery completes. Customer rates the delivery partner 1–5
// stars with an optional comment. Navigated to from:
//   • DeliveryTrackingScreen → once status becomes DELIVERED
//   • HistoryScreen          → tapping "Rate" on an un-rated completed delivery
//
// Route params:
//   deliveryId (string)  — required
//   partner    (object)  — { firstName, lastName, profileImage, vehicleType, vehiclePlate }
//   onRated    (fn?)     — optional callback so HistoryScreen can refresh

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Animated, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../../context/ThemeContext';
import { deliveryAPI }  from '../../services/api';

const TEAL  = '#34D399';
const GOLD  = '#FFB800';
const GREY  = '#6B7280';

// ── Star selector ─────────────────────────────────────────────────────────────
const StarRating = ({ value, onChange }) => (
  <View style={sr.row}>
    {[1, 2, 3, 4, 5].map(star => (
      <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
        <Ionicons
          name={star <= value ? 'star' : 'star-outline'}
          size={44}
          color={star <= value ? GOLD : GREY + '60'}
          style={{ marginHorizontal: 4 }}
        />
      </TouchableOpacity>
    ))}
  </View>
);
const sr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 16 },
});

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];

const QUICK_POSITIVE = ['Fast delivery', 'Very careful', 'Polite', 'On time', 'Package intact'];
const QUICK_NEGATIVE = ['Late delivery', 'Rude', 'Package damaged', 'Wrong address', 'Unprofessional'];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RateDeliveryScreen({ navigation, route }) {
  const { theme, mode } = useTheme();
  const { deliveryId, partner, onRated } = route.params ?? {};

  const [rating,    setRating]    = useState(0);
  const [comment,   setComment]   = useState('');
  const [submitting,setSubmitting]= useState(false);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideA, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const chips = rating >= 4 ? QUICK_POSITIVE : QUICK_NEGATIVE;

  const toggleChip = (chip) => {
    setComment(prev => {
      const parts  = prev.split(', ').map(s => s.trim()).filter(Boolean);
      const exists = parts.includes(chip);
      return exists
        ? parts.filter(p => p !== chip).join(', ')
        : [...parts, chip].join(', ');
    });
  };

  const selectedChips = comment.split(', ').map(s => s.trim()).filter(Boolean);

  const submit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await deliveryAPI.rateDelivery(deliveryId, { rating, comment: comment.trim() || undefined });
      onRated?.();
      navigation.goBack();
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Failed to submit rating. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => navigation.goBack();

  const partnerName = partner
    ? `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim()
    : 'Your Delivery Partner';

  const vehicleInfo = partner?.vehiclePlate
    ? `${partner.vehicleType ?? ''} · ${partner.vehiclePlate}`.trim()
    : null;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={s.headerRow}>
            <TouchableOpacity
              style={[s.closeBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              onPress={skip}
            >
              <Ionicons name="close" size={18} color={theme.foreground} />
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

            {/* ── Checkmark ── */}
            <View style={[s.checkCircle, { backgroundColor: TEAL + '18' }]}>
              <Ionicons name="cube" size={56} color={TEAL} />
            </View>

            <Text style={[s.title, { color: theme.foreground }]}>Package Delivered!</Text>
            <Text style={[s.sub, { color: theme.hint }]}>How was your experience with</Text>
            <Text style={[s.partnerName, { color: theme.foreground }]}>{partnerName}?</Text>

            {vehicleInfo && (
              <Text style={[s.vehicleInfo, { color: theme.hint }]}>{vehicleInfo}</Text>
            )}

            {/* ── Stars ── */}
            <StarRating value={rating} onChange={setRating} />

            {rating > 0 && (
              <Animated.Text style={[s.ratingLabel, { color: GOLD, opacity: fadeA }]}>
                {LABELS[rating]}
              </Animated.Text>
            )}

            {/* ── Quick chips ── */}
            {rating > 0 && (
              <View style={s.chipsWrap}>
                {chips.map(chip => {
                  const active = selectedChips.includes(chip);
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[
                        s.chip,
                        {
                          backgroundColor: active ? TEAL + '20' : theme.backgroundAlt,
                          borderColor:     active ? TEAL        : theme.border,
                        },
                      ]}
                      onPress={() => toggleChip(chip)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipTxt, { color: active ? TEAL : theme.hint }]}>{chip}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Comment box ── */}
            <TextInput
              style={[s.input, { backgroundColor: theme.backgroundAlt, borderColor: theme.border, color: theme.foreground }]}
              placeholder="Add a comment (optional)..."
              placeholderTextColor={theme.hint}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            {/* ── Actions ── */}
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: TEAL, opacity: rating === 0 ? 0.5 : 1 }]}
              onPress={submit}
              disabled={submitting || rating === 0}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#080C18" size="small" />
                : <Text style={s.submitTxt}>Submit Rating</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.skipBtn} onPress={skip} activeOpacity={0.7}>
              <Text style={[s.skipTxt, { color: theme.hint }]}>Skip for now</Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },

  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12, marginBottom: 8 },
  closeBtn:  { width: 36, height: 36, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  checkCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },

  title:       { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  sub:         { fontSize: 14, textAlign: 'center' },
  partnerName: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  vehicleInfo: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 4 },

  ratingLabel: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: -4, marginBottom: 4 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  chip:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  chipTxt:   { fontSize: 12, fontWeight: '600' },

  input: {
    borderRadius: 14, borderWidth: 1, padding: 14,
    fontSize: 14, lineHeight: 20, minHeight: 80,
    textAlignVertical: 'top', marginBottom: 20,
  },

  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  submitTxt: { fontSize: 16, fontWeight: '900', color: '#080C18' },

  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipTxt: { fontSize: 14, fontWeight: '600' },
});