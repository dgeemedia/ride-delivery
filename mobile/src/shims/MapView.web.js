// src/shims/MapView.web.js
// Web shim for react-native-maps.
// Renders a real OpenStreetMap tile so the screen looks correct on web.
// For production web, swap to @react-google-maps/api for full interactivity.

import React, { forwardRef, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Static OpenStreetMap tile — Lagos Island at zoom 11 (free, no key needed)
// Covers: ~6.4–6.6°N, ~3.3–3.6°E — the full Lagos metro area
// ─────────────────────────────────────────────────────────────────────────────
const OSM_TILE = 'https://tile.openstreetmap.org/12/1229/1961.png';

// No-ops — can't project coords on a static tile
const Marker   = ({ children }) => (
  <View style={wm.markerWrap} pointerEvents="none">{children}</View>
);
const Polyline       = () => null;
const Callout        = () => null;
const Circle         = () => null;
const Polygon        = () => null;
const PROVIDER_GOOGLE = 'google';

// ─────────────────────────────────────────────────────────────────────────────
// MapView
// ─────────────────────────────────────────────────────────────────────────────
const MapView = forwardRef(({ style, children }, ref) => {
  const [tileError, setTileError] = useState(false);

  return (
    <View ref={ref} style={[wm.root, style]}>
      {tileError ? (
        <View style={wm.fallback}>
          <Text style={wm.city}>Lagos, Nigeria</Text>
          <Text style={wm.hint}>Map preview — install react-native-maps for live map</Text>
        </View>
      ) : (
        <Image
          source={{ uri: OSM_TILE }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setTileError(true)}
        />
      )}
      {/* Dark tint to match app's DARK_MAP_STYLE */}
      <View style={wm.overlay} pointerEvents="none" />
      {/* Markers / children */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
});

MapView.displayName = 'MapView';

const wm = StyleSheet.create({
  root:      { backgroundColor: '#1a1a1a', overflow: 'hidden' },
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  fallback:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  city:      { color: '#C9A96E', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  hint:      { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', paddingHorizontal: 32 },
  markerWrap:{ position: 'absolute', top: '42%', left: '46%' },
});

export default MapView;
export { Marker, Polyline, Callout, Circle, Polygon, PROVIDER_GOOGLE };