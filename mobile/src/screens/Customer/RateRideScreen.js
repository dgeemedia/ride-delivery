// mobile/src/screens/Customer/RateRideScreen.js
//
// Shown after a ride completes. Customer rates the driver 1–5 stars with an
// optional comment. Navigated to from:
//   • RideTrackingScreen  → once status becomes COMPLETED
//   • HistoryScreen       → tapping "Rate" on an un-rated completed ride
//
// Route params:
//   rideId  (string)  — required
//   driver  (object)  — { firstName, lastName, profileImage, vehicleType,
//                         vehicleMake, vehicleModel, vehicleColor, vehiclePlate }
//   onRated (fn?)     — optional callback so HistoryScreen can refresh

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Animated, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme }     from '../../context/ThemeContext';
import { rideAPI }      from '../../services/api';

const GOLD   = '#FFB800';
const GREY   = '#6B7280';
const GREEN  = '#34D399';

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

// ── Rating label ──────────────────────────────────────────────────────────────
const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];

// ── Quick-comment chips ───────────────────────────────────────────────────────
const QUICK_POSITIVE = ['Great driver', 'Very polite', 'Safe driving', 'On time', 'Clean car'];
const QUICK_NEGATIVE = ['Rude', 'Speeding', 'Wrong route', 'Late', 'Dirty car'];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RateRideScreen({ navigation, route }) {
  const { theme, mode } = useTheme();
  const { rideId, driver, onRated } = route.params ?? {};

  const [rating,    setRating]    = useState(0);
  const [comment,   setComment]   = useState('');
  const [submitting,setSubmitting]= useState(false);

  const fadeA   = useRef(new Animated.Value(0)).current;
  const slideA  = useRef(new Animated.Value(30)).current;

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
      await rideAPI.rateRide(rideId, { rating, comment: comment.trim() || undefined });
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

  const driverName = driver
    ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim()
    : 'Your Driver';

  const vehicleInfo = driver?.vehiclePlate
    ? `${driver.vehicleColor ?? ''} ${driver.vehicleMake ?? ''} · ${driver.vehiclePlate}`.trim()
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
            <View style={[s.checkCircle, { backgroundColor: GREEN + '18' }]}>
              <Ionicons name="checkmark-circle" size={64} color={GREEN} />
            </View>

            <Text style={[s.title, { color: theme.foreground }]}>Ride Completed!</Text>
            <Text style={[s.sub, { color: theme.hint }]}>How was your experience with</Text>
            <Text style={[s.driverName, { color: theme.foreground }]}>{driverName}?</Text>

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

            {/* ── Quick chips (shown after a star is selected) ── */}
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
                          backgroundColor: active ? GOLD + '20' : theme.backgroundAlt,
                          borderColor:     active ? GOLD         : theme.border,
                        },
                      ]}
                      onPress={() => toggleChip(chip)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.chipTxt, { color: active ? GOLD : theme.hint }]}>{chip}</Text>
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
              style={[s.submitBtn, { backgroundColor: GOLD, opacity: rating === 0 ? 0.5 : 1 }]}
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
  driverName:  { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 4 },
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