// mobile/src/screens/Auth/BiometricLockScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useBiometric } from '../../hooks/useBiometric';

const { width } = Dimensions.get('window');

export default function BiometricLockScreen() {
  const { theme, mode }                = useTheme();
  const { biometricUnlock, logout }    = useAuth();               // ✅ fixed
  const { authenticate, biometricType, getSecureToken, disable: disableBiometric } = useBiometric(); // ✅ fixed
  const darkMode = mode === 'dark';

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    triggerBiometric();
    return () => pulse.stop();
  }, []);

  const triggerBiometric = async () => {
    const success = await authenticate();
    if (!success) return;

    const storedToken = await getSecureToken();
    if (storedToken) {
      // ✅ Use biometricUnlock instead of non-existent biometricLogin
      const ok = await biometricUnlock(storedToken);
      if (ok) return;   // session restored, biometricLocked becomes false automatically
      // token invalid → clean up
      await disableBiometric();
    }
    // No valid token → force logout to login screen
    await logout();
  };

  const iconName = biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline';
  const label    = biometricType === 'faceid' ? 'Face ID' : biometricType === 'iris' ? 'Iris scan' : 'Fingerprint';

  return (
    <Animated.View style={[s.root, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={[s.orb, { backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]} />
      <View style={s.center}>
        <Animated.View style={[s.ring, {
          borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          transform: [{ scale: pulseAnim }],
        }]}>
          <LinearGradient
            colors={darkMode ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']}
            style={[StyleSheet.absoluteFill, { borderRadius: 48 }]}
          />
          <Ionicons name={iconName} size={52} color={theme.foreground} />
        </Animated.View>
        <Text style={[s.title, { color: theme.foreground }]}>App locked</Text>
        <Text style={[s.subtitle, { color: theme.hint }]}>Use {label} to continue</Text>
        <TouchableOpacity style={[s.btn, { overflow: 'hidden' }]} activeOpacity={0.85} onPress={triggerBiometric}>
          <LinearGradient
            colors={darkMode ? ['#ffffff', '#dcdcdc'] : ['#000000', '#1e1e1e']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name={iconName} size={18} color={darkMode ? '#000' : '#fff'} />
          <Text style={[s.btnTxt, { color: darkMode ? '#000' : '#fff' }]}>Verify with {label}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.signOut} onPress={logout}>
          <Text style={[s.signOutTxt, { color: theme.hint }]}>Sign in with password instead</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orb:    { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, top: -width * 0.7, alignSelf: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 40 },
  ring: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 32,
  },
  title:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 10 },
  subtitle: { fontSize: 15, fontWeight: '300', marginBottom: 48, textAlign: 'center' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, height: 54, paddingHorizontal: 28,
    marginBottom: 20,
  },
  btnTxt:    { fontSize: 16, fontWeight: '800' },
  signOut:   { paddingVertical: 12 },
  signOutTxt:{ fontSize: 14, fontWeight: '500' },
});