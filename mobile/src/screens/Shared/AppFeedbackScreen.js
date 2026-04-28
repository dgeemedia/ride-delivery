// mobile/src/screens/Shared/AppFeedbackScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Dimensions, Animated, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { userAPI } from '../../services/api';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'general',      label: 'General',       icon: 'chatbubble-outline'       },
  { id: 'ui_ux',        label: 'Design / UX',   icon: 'color-palette-outline'    },
  { id: 'performance',  label: 'Performance',   icon: 'speedometer-outline'      },
  { id: 'feature',      label: 'Feature Idea',  icon: 'bulb-outline'             },
  { id: 'bug',          label: 'Bug Report',    icon: 'bug-outline'              },
  { id: 'pricing',      label: 'Pricing',       icon: 'pricetag-outline'         },
];

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

export default function AppFeedbackScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets           = useSafeAreaInsets();
  const fadeA            = useRef(new Animated.Value(0)).current;

  const [rating,   setRating]   = useState(0);
  const [hovered,  setHovered]  = useState(0);
  const [category, setCategory] = useState('general');
  const [comment,  setComment]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Per-star scale animations
  const starScales = useRef([...Array(5)].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.timing(fadeA, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const animateStar = (index) => {
    Animated.sequence([
      Animated.spring(starScales[index], { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(starScales[index], { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
  };

  const handleStarPress = (star) => {
    setRating(star);
    animateStar(star - 1);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please tap a star to rate the app.');
      return;
    }

    setLoading(true);
    try {
      await userAPI.submitFeedback({
        rating,
        comment:    comment.trim() || null,
        category:   category.trim(),
        platform:   (Platform.OS ?? 'android').toLowerCase(),   // ← guard
        appVersion: Constants.expoConfig?.version
                ?? Constants.manifest?.version
                ?? '1.0.0',                                    // ← fallback chain
      });
      setSubmitted(true);
    } catch (err) {
    console.log('Full error:', JSON.stringify(err));  // ← add this
    const msg =
        err?.message ??
        err?.errors?.[0]?.msg ??
        'Could not submit feedback. Please try again.';
    Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={[s.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />
        <View style={s.successWrap}>
          <View style={[s.successIcon, { backgroundColor: theme.accent + '18', borderColor: theme.accent + '35' }]}>
            <Ionicons name="checkmark-circle" size={52} color={theme.accent} />
          </View>
          <Text style={[s.successTitle, { color: theme.foreground }]}>Thank you!</Text>
          <Text style={[s.successSub, { color: theme.hint }]}>
            Your feedback helps us make Diakite better for everyone.
          </Text>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: theme.accent }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[s.doneTxt, { color: theme.accentFg ?? '#111' }]}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const activeRating = hovered || rating;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
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
              <Ionicons name="star-outline" size={32} color={theme.accent} />
            </View>
            <Text style={[s.heroTitle, { color: theme.foreground }]}>Rate the App</Text>
            <Text style={[s.heroSub, { color: theme.hint }]}>
              How's your experience with Diakite? Your honest opinion matters.
            </Text>
          </View>

          {/* Stars */}
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.hint }]}>YOUR RATING</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleStarPress(star)}
                  onPressIn={() => setHovered(star)}
                  onPressOut={() => setHovered(0)}
                  activeOpacity={0.8}
                >
                  <Animated.View style={{ transform: [{ scale: starScales[star - 1] }] }}>
                    <Ionicons
                      name={star <= activeRating ? 'star' : 'star-outline'}
                      size={40}
                      color={star <= activeRating ? '#F5A623' : theme.border}
                    />
                  </Animated.View>
                </TouchableOpacity>
              ))}
            </View>
            {activeRating > 0 && (
              <Text style={[s.starLabel, { color: theme.accent }]}>
                {STAR_LABELS[activeRating - 1]}
              </Text>
            )}
          </View>

          {/* Category */}
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.hint }]}>CATEGORY</Text>
            <View style={s.categoryGrid}>
              {CATEGORIES.map(cat => {
                const active = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      s.catChip,
                      {
                        backgroundColor: active ? theme.accent + '18' : theme.background,
                        borderColor:     active ? theme.accent         : theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={15}
                      color={active ? theme.accent : theme.hint}
                    />
                    <Text style={[s.catTxt, { color: active ? theme.accent : theme.hint }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Comment */}
          <View style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.cardLabel, { color: theme.hint }]}>COMMENTS (OPTIONAL)</Text>
            <TextInput
              style={[s.textInput, { color: theme.foreground, borderColor: theme.border }]}
              placeholder="Tell us more about your experience…"
              placeholderTextColor={theme.hint}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[s.charCount, { color: theme.hint }]}>{comment.length}/500</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: theme.accent, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={theme.accentFg ?? '#111'} />
              : (
                <>
                  <Ionicons name="send-outline" size={18} color={theme.accentFg ?? '#111'} />
                  <Text style={[s.submitTxt, { color: theme.accentFg ?? '#111' }]}>Submit Feedback</Text>
                </>
              )
            }
          </TouchableOpacity>

          <Text style={[s.privacy, { color: theme.hint }]}>
            Your feedback is anonymous and used only to improve Diakite.
          </Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: {
    position: 'absolute', width: width * 1.2, height: width * 1.2,
    borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center', opacity: 0.05,
  },
  backBtn: {
    position: 'absolute', left: 20, zIndex: 99,
    width: 42, height: 42, borderRadius: 13, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  scroll:    { paddingHorizontal: 24 },

  // Hero
  hero:      { alignItems: 'center', paddingBottom: 24 },
  heroIcon:  { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  heroSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Card
  card:      { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },

  // Stars
  starsRow:  { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 },
  starLabel: { textAlign: 'center', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // Category
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  catTxt:   { fontSize: 12, fontWeight: '600' },

  // Comment
  textInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100, lineHeight: 20 },
  charCount: { textAlign: 'right', fontSize: 11, marginTop: 6 },

  // Submit
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  submitTxt: { fontSize: 15, fontWeight: '700' },
  privacy:   { textAlign: 'center', fontSize: 11, lineHeight: 16, marginBottom: 12 },

  // Success
  successWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon:  { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: '800', marginBottom: 10 },
  successSub:   { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn:      { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 40 },
  doneTxt:      { fontSize: 15, fontWeight: '700' },
});