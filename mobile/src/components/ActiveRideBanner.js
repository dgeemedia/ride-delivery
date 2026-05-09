// mobile/src/components/ActiveRideBanner.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const DA = '#FFB800';

const STATUS_LABEL = {
  REQUESTED:   { label: 'Waiting for driver...',  icon: 'time-outline',     color: '#4E8DBD' },
  ACCEPTED:    { label: 'Driver is on the way',   icon: 'car-outline',      color: DA        },
  ARRIVED:     { label: 'Driver has arrived!',    icon: 'location-outline', color: '#A78BFA' },
  IN_PROGRESS: { label: 'Ride in progress',       icon: 'navigate-outline', color: '#5DAA72' },
};

export default function ActiveRideBanner({ ride, role = 'CUSTOMER', onPress, onCancel, theme }) {
  if (!ride) return null;

  const cfg    = STATUS_LABEL[ride.status] ?? STATUS_LABEL.ACCEPTED;
  const pulseA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const canCancel = role === 'CUSTOMER' && ride.status === 'REQUESTED';

  return (
    // Outer wrapper: gives the cancel btn a proper hit area without blocking the main press
    <View style={[s.wrapper, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '50' }]}>
      {/* Main tappable area — takes all space except the cancel button */}
      <TouchableOpacity
        style={s.mainTap}
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
          <Text style={[s.sub, { color: theme?.foreground ?? '#fff' }]} numberOfLines={1}>
            {cfg.label}
            {ride.pickupAddress ? ` • ${ride.pickupAddress.split('(')[0].trim()}` : ''}
          </Text>
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={18} color={cfg.color} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Cancel button — sits alongside, not overlapping the main tap */}
      {canCancel && (
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: '#E05555' + '60' }]}
          onPress={onCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingRight: 12,
    marginBottom: 14,
    // NO overflow:hidden — lets touches pass through correctly
  },
  mainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dot:       { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  title:     { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  sub:       { fontSize: 13, fontWeight: '500' },
  cancelBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  cancelTxt: { fontSize: 12, fontWeight: '700', color: '#E05555' },
});