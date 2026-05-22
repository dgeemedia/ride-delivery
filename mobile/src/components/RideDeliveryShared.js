// mobile/src/components/RideDeliveryShared.js
//
// Changes from previous version:
//   • RadarPulse REMOVED as a JSX component — replaced with useRadarPulse hook
//     that calls mapRef.current?.startRadar / stopRadar imperatively.
//     This works on both Google Maps (OsmMapView CSS animation) and is a
//     no-op stub for Google Maps native (which handles radar via React children).
//   • Marker import fixed — now from SmartMapView, not react-native-maps directly
//   • CircleRadarPulse exported for Google Maps native path (React children approach)
//     so RequestRideScreen / RequestDeliveryScreen can choose the right one.

import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Animated, ActivityIndicator, FlatList, Modal, SafeAreaView,
} from 'react-native';
import { Marker } from '../components/SmartMapView'; // ← fixed import
import { Ionicons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// useRadarPulse — imperative hook
//
// Usage in screen:
//   const radarRef = useRadarPulse(mapRef, accentColor);
//   // start:  radarRef.start(lat, lng)
//   // stop:   radarRef.stop()
//
// When OSM is active  → calls mapRef.current.startRadar / stopRadar (Leaflet CSS anim)
// When Google is active → Google Maps renders <CircleRadarPulse> as React children
//   (the screen should conditionally render <CircleRadarPulse> when scanning)
// ─────────────────────────────────────────────────────────────────────────────
export function useRadarPulse(mapRef, color) {
  const api = {
    start(lat, lng) {
      mapRef.current?.startRadar?.(lat, lng, color);
    },
    stop() {
      mapRef.current?.stopRadar?.();
    },
  };
  return api;
}

// ─────────────────────────────────────────────────────────────────────────────
// CircleRadarPulse — React children approach (Google Maps native only)
//
// Use this INSIDE <MapView> when Google Maps is confirmed active.
// For OSM the imperative startRadar/stopRadar is used instead.
//
// Props: coordinate { latitude, longitude }, color
// ─────────────────────────────────────────────────────────────────────────────
export const CircleRadarPulse = ({ coordinate, color }) => {
  const rings = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = rings.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(r, { toValue: 1, duration: 1800, useNativeDriver: false }),
          Animated.timing(r, { toValue: 0, duration: 0,    useNativeDriver: false }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <>
      {rings.map((r, i) => (
        <Marker key={i} coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <Animated.View style={{
            width:           r.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }),
            height:          r.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }),
            borderRadius:    140,
            borderWidth:     1.5,
            borderColor:     color,
            opacity:         r.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
            backgroundColor: color + '08',
          }} />
        </Marker>
      ))}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RadarPulse — unified component
//
// Renders CircleRadarPulse (React children) for Google Maps.
// For OSM, renders nothing — the screen must call useRadarPulse().start() instead.
//
// Props:
//   coordinate  { latitude, longitude }
//   color       string
//   useOsm      bool — pass true when OSM is active (suppresses React children)
// ─────────────────────────────────────────────────────────────────────────────
export const RadarPulse = ({ coordinate, color, useOsm = false }) => {
  if (useOsm) return null; // OSM handles radar imperatively via startRadar
  return <CircleRadarPulse coordinate={coordinate} color={color} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// ScanningBar
// ─────────────────────────────────────────────────────────────────────────────
export const ScanningBar = ({ theme, accentColor, count, done, label = 'driver' }) => {
  const dotA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (done) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotA, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(dotA, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [done]);

  const plural = count !== 1 ? `${label}s` : label;

  return (
    <View style={[sb.wrap, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      <View style={[sb.iconWrap, { backgroundColor: accentColor + '18' }]}>
        {done
          ? <Ionicons name="checkmark-circle" size={20} color="#5DAA72" />
          : <Animated.View style={{ opacity: dotA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }}>
              <Ionicons name="radio-outline" size={20} color={accentColor} />
            </Animated.View>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sb.title, { color: theme.foreground }]}>
          {done ? `Found ${count} ${plural} nearby` : `Scanning for ${plural}…`}
        </Text>
        <Text style={[sb.sub, { color: theme.hint }]}>
          {done
            ? 'Tap a pin on the map or scroll the list below'
            : `Checking your area for available ${plural}`}
        </Text>
      </View>
      {done && count > 0 && (
        <View style={[sb.countBadge, { backgroundColor: accentColor }]}>
          <Text style={[sb.countTxt, { color: '#080C18' }]}>{count}</Text>
        </View>
      )}
    </View>
  );
};

const sb = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1 },
  iconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title:      { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  sub:        { fontSize: 11 },
  countBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  countTxt:   { fontSize: 13, fontWeight: '900' },
});

// ─────────────────────────────────────────────────────────────────────────────
// StepDots
// ─────────────────────────────────────────────────────────────────────────────
export const StepDots = ({ current, accentColor, theme }) => (
  <View style={std.wrap}>
    {[1, 2, 3].map(s => (
      <View key={s} style={[std.dot,
        s === current  ? { backgroundColor: accentColor, width: 22 } :
        s < current    ? { backgroundColor: accentColor + '50' }     :
                         { backgroundColor: theme.border }
      ]} />
    ))}
  </View>
);

const std = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  dot:  { height: 6, width: 6, borderRadius: 3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// LocationSearchModal
// ─────────────────────────────────────────────────────────────────────────────
export const LocationSearchModal = ({
  visible, type, query, results, loading,
  onChangeText, onSelect, onClose, onSwitchToPin,
  accentColor, theme,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const pinColor = type === 'dropoff' ? '#E05555' : accentColor;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[lsm.root, { backgroundColor: theme.background }]}>
        <View style={[lsm.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity onPress={onClose} style={[lsm.backBtn, { backgroundColor: theme.card }]} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={theme.foreground} />
          </TouchableOpacity>
          <View style={[lsm.inputWrap, { backgroundColor: theme.backgroundAlt, borderColor: pinColor + '60' }]}>
            <Ionicons name={type === 'pickup' ? 'radio-button-on' : 'location'} size={16} color={pinColor} />
            <TextInput
              ref={inputRef}
              style={[lsm.input, { color: theme.foreground }]}
              placeholder={type === 'pickup' ? 'Search pickup location…' : 'Search drop-off location…'}
              placeholderTextColor={theme.hint}
              value={query}
              onChangeText={onChangeText}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            {loading && <ActivityIndicator color={pinColor} size="small" />}
            {!loading && query.length > 0 && (
              <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity style={lsm.mapPinRow} onPress={onSwitchToPin} activeOpacity={0.8}>
          <View style={[lsm.mapPinIcon, { backgroundColor: pinColor + '18' }]}>
            <Ionicons name="map-outline" size={16} color={pinColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[lsm.mapPinLabel, { color: pinColor }]}>Place pin on map</Text>
            <Text style={[lsm.mapPinSub, { color: theme.muted }]}>Drag the map to set your exact location</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>

        <View style={[lsm.divider, { backgroundColor: theme.border }]} />

        <FlatList
          data={results}
          keyExtractor={(item) => item.place_id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[lsm.resultRow, { borderBottomColor: theme.border }]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <View style={[lsm.resultIcon, { backgroundColor: theme.card }]}>
                <Ionicons name="location-outline" size={16} color={theme.hint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[lsm.resultMain, { color: theme.foreground }]} numberOfLines={1}>
                  {item.structured_formatting?.main_text ?? item.description}
                </Text>
                {item.structured_formatting?.secondary_text ? (
                  <Text style={[lsm.resultSub, { color: theme.hint }]} numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length === 0 ? (
              <View style={lsm.emptyWrap}>
                <Ionicons name="search-outline" size={40} color={theme.border} />
                <Text style={[lsm.emptyTitle, { color: theme.muted }]}>Search for a location</Text>
                <Text style={[lsm.emptySub, { color: theme.muted }]}>Type an address, landmark, or area</Text>
              </View>
            ) : query.length < 3 ? (
              <Text style={[lsm.hintTxt, { color: theme.muted }]}>Keep typing to see results…</Text>
            ) : !loading ? (
              <View style={lsm.emptyWrap}>
                <Ionicons name="alert-circle-outline" size={36} color={theme.border} />
                <Text style={[lsm.emptyTitle, { color: theme.muted }]}>No results found</Text>
                <Text style={[lsm.emptySub, { color: theme.muted }]}>Try a different search or use the map pin</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const lsm = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  inputWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, height: 44 },
  input:      { flex: 1, fontSize: 14, fontWeight: '500', height: 44 },
  mapPinRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  mapPinIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  mapPinLabel:{ fontSize: 14, fontWeight: '700', marginBottom: 2 },
  mapPinSub:  { fontSize: 11 },
  divider:    { height: 1, marginHorizontal: 16 },
  resultRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  resultIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  resultMain: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  resultSub:  { fontSize: 12 },
  emptyWrap:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  hintTxt:    { fontSize: 13, textAlign: 'center', paddingTop: 40 },
});