// mobile/src/components/ActiveDeliveryBanner.js
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TEAL = '#34D399';

const STATUS_LABEL = {
  PENDING:    { label: 'Finding a delivery partner...', icon: 'time-outline',              color: '#4E8DBD' },
  ASSIGNED:   { label: 'Partner is on the way',         icon: 'bicycle-outline',           color: TEAL      },
  PICKED_UP:  { label: 'Package picked up!',            icon: 'cube-outline',              color: '#FFB800' },
  IN_TRANSIT: { label: 'Package in transit',            icon: 'navigate-outline',          color: '#A78BFA' },
};

export default function ActiveDeliveryBanner({ delivery, role = 'CUSTOMER', onPress, onCancel, theme }) {
  if (!delivery) return null;

  const cfg    = STATUS_LABEL[delivery.status] ?? STATUS_LABEL.ASSIGNED;
  const pulseA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const canCancel = role === 'CUSTOMER' && delivery.status === 'PENDING';

  return (
    <TouchableOpacity
      style={[s.banner, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '50' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Animated.View style={[s.dot, { backgroundColor: cfg.color, opacity: pulseA }]} />

      <View style={[s.iconWrap, { backgroundColor: cfg.color + '20' }]}>
        <Ionicons name="cube-outline" size={14} color={cfg.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: cfg.color }]}>
          {role === 'DELIVERY_PARTNER' ? 'Active Delivery' : 'Your Package'}
        </Text>
        <Text style={[s.sub, { color: theme?.foreground ?? '#fff' }]} numberOfLines={1}>
          {cfg.label}
          {delivery.packageDescription ? ` · ${delivery.packageDescription}` : ''}
        </Text>
      </View>

      {canCancel && (
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: '#E05555' + '60' }]}
          onPress={(e) => { e.stopPropagation?.(); onCancel?.(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      )}

      <Ionicons name="chevron-forward" size={18} color={cfg.color} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  dot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  iconWrap:  { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  title:     { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  sub:       { fontSize: 13, fontWeight: '500' },
  cancelBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  cancelTxt: { fontSize: 12, fontWeight: '700', color: '#E05555' },
});