// mobile/src/screens/Auth/LocationPermissionScreen.js
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Image, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as Location      from 'expo-location';
import { useTheme }       from '../../context/ThemeContext';

const { width } = Dimensions.get('window');
const LOGO = require('../../../assets/diakite_dark.png');

export default function LocationPermissionScreen({ onRequest, onSkip }) {
  const { theme, mode } = useTheme();
  const dark = mode === 'dark';

  // 'initial'  -> hasn't hit the real OS prompt yet
  // 'denied'   -> OS prompt fired and was denied/blocked
  const [status, setStatus] = useState('initial');

  const handleContinue = async () => {
    const { status: result, canAskAgain } = await Location.requestForegroundPermissionsAsync();

    if (result === 'granted') {
      onRequest(true);
      return;
    }

    // Denied — we've now shown the real system prompt at least once.
    // Only NOW do we reveal a way to proceed without location.
    setStatus('denied');
    onRequest(false);
  };

  const handleOpenSettings = () => {
    Location.enableNetworkProviderAsync?.().catch(() => {});
    import('react-native').then(({ Linking }) => Linking.openSettings());
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={[s.orb1, { backgroundColor: dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)' }]} />
      <View style={[s.orb2, { backgroundColor: dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      <View style={s.content}>
        <View style={[s.logoBadge, { backgroundColor: '#FFFFFF', borderColor: '#E5E5E5' }]}>
          <Image source={LOGO} style={s.logoImg} resizeMode="contain" />
        </View>

        <Text style={[s.title, { color: theme.foreground }]}>Location Access</Text>
        <Text style={[s.subtitle, { color: theme.hint }]}>
          {status === 'denied'
            ? 'Location is currently off. Some features like nearby drivers and live tracking won\'t work until you enable it in Settings.'
            : 'Diakite needs your location to find rides, show nearby drivers, and track deliveries in real time.'}
        </Text>

        <View style={[s.feature, { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)', borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Ionicons name="navigate-circle-outline" size={24} color={dark ? '#FFB800' : '#10B981'} />
          <Text style={[s.featureText, { color: theme.foreground }]}>Find nearby drivers & delivery partners</Text>
        </View>
        <View style={[s.feature, { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)', borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Ionicons name="map-outline" size={24} color={dark ? '#FFB800' : '#10B981'} />
          <Text style={[s.featureText, { color: theme.foreground }]}>Real time tracking during your trip</Text>
        </View>
        <View style={[s.feature, { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)', borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Ionicons name="shield-checkmark-outline" size={24} color={dark ? '#FFB800' : '#10B981'} />
          <Text style={[s.featureText, { color: theme.foreground }]}>Emergency & SHIELD features</Text>
        </View>

        {status === 'initial' && (
          <TouchableOpacity style={[s.primaryBtn, { overflow: 'hidden' }]} onPress={handleContinue} activeOpacity={0.85}>
            <LinearGradient
              colors={dark ? ['#FFB800', '#F59E0B'] : ['#10B981', '#059669']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="location-outline" size={20} color="#000" />
            {/* Renamed from "Enable Location" per Apple 5.1.1(iv) — must not
                imply this button itself grants permission. */}
            <Text style={[s.primaryTxt, { color: '#000' }]}>Continue</Text>
          </TouchableOpacity>
        )}

        {status === 'denied' && (
          <>
            <TouchableOpacity style={[s.primaryBtn, { overflow: 'hidden' }]} onPress={handleOpenSettings} activeOpacity={0.85}>
              <LinearGradient
                colors={dark ? ['#FFB800', '#F59E0B'] : ['#10B981', '#059669']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="settings-outline" size={20} color="#000" />
              <Text style={[s.primaryTxt, { color: '#000' }]}>Open Settings</Text>
            </TouchableOpacity>

            {/* This is now safe: the real OS permission dialog has already
                been shown and denied — this isn't a pre-permission skip. */}
            <TouchableOpacity
              style={[s.skipBtn, { borderColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
              onPress={() => onSkip?.()}
              activeOpacity={0.7}
            >
              <Text style={[s.skipTxt, { color: theme.hint }]}>Continue Without Location</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  orb1:    { position: 'absolute', width: width * 1.3, height: width * 1.3, borderRadius: width * 0.65, top: -width * 0.8, alignSelf: 'center' },
  orb2:    { position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, bottom: -width * 0.2, right: -width * 0.1 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: Platform.OS === 'ios' ? 90 : 70, alignItems: 'center' },
  logoBadge: { width: 74, height: 74, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  logoImg:   { width: 52, height: 36 },
  title:    { fontSize: 30, fontWeight: '900', letterSpacing: -1, marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 36, paddingHorizontal: 10 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, width: '100%' },
  featureText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  primaryBtn: { borderRadius: 16, height: 56, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8 },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
  skipBtn: { borderRadius: 16, height: 48, width: '100%', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, marginTop: 16 },
  skipTxt: { fontSize: 15, fontWeight: '600' },
});