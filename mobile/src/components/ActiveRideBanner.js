// mobile/src/components/ActiveRideBanner.js
//
// Shows a persistent amber banner when the user has an active ride in progress.
// Used on both the Customer HomeScreen and Driver Dashboard so neither user
// gets stuck after an app restart.
//
// Customer: taps → goes to RideTracking (or cancels if REQUESTED)
// Driver:   taps → goes to ActiveRide

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const DA = '#FFB800';

const STATUS_LABEL = {
  REQUESTED:   { label: 'Waiting for driver...',  icon: 'time-outline',           color: '#4E8DBD' },
  ACCEPTED:    { label: 'Driver is on the way',   icon: 'car-outline',            color: DA        },
  ARRIVED:     { label: 'Driver has arrived!',    icon: 'location-outline',       color: '#A78BFA' },
  IN_PROGRESS: { label: 'Ride in progress',       icon: 'navigate-outline',       color: '#5DAA72' },
};

export default function ActiveRideBanner({ ride, role = 'CUSTOMER', onPress, onCancel, theme }) {
  if (!ride) return null;

  const cfg   = STATUS_LABEL[ride.status] ?? STATUS_LABEL.ACCEPTED;
  const pulseA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,   duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const canCancel = role === 'CUSTOMER' && ride.status === 'REQUESTED';

  return (
    <TouchableOpacity
      style={[s.banner, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '50' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Pulsing dot */}
      <Animated.View style={[s.dot, { backgroundColor: cfg.color, opacity: pulseA }]} />

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: cfg.color }]}>
          {role === 'DRIVER' ? 'Active Ride' : 'Your Ride'}
        </Text>
        <Text style={[s.sub, { color: theme.foreground }]} numberOfLines={1}>
          {cfg.label}
          {ride.pickupAddress ? ` · ${ride.pickupAddress.split('(')[0].trim()}` : ''}
        </Text>
      </View>

      {/* Cancel (customer only, REQUESTED status) */}
      {canCancel && (
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: '#E05555' + '60' }]}
          onPress={(e) => { e.stopPropagation?.(); onCancel?.(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      )}

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={18} color={cfg.color} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 14,
  },
  dot:       { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  title:     { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  sub:       { fontSize: 13, fontWeight: '500' },
  cancelBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  cancelTxt: { fontSize: 12, fontWeight: '700', color: '#E05555' },
});