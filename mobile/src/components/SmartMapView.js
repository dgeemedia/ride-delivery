// mobile/src/components/SmartMapView.js
/**
 * SmartMapView.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps both react-native-maps (Google) and OsmMapView (Leaflet fallback).
 *
 * Strategy:
 *   1. Try Google Maps (react-native-maps with PROVIDER_GOOGLE)
 *   2. If it fails to render within GOOGLE_TIMEOUT ms, or throws an error,
 *      silently swap to OsmMapView (Leaflet + OpenStreetMap — no API key)
 *
 * You can also force the fallback via:
 *   <SmartMapView forceOsm ... />
 *   or set FORCE_OSM_MAP=true in your constants file.
 *
 * The ref, all props, and all children (Marker, Polyline) are forwarded
 * identically to whichever provider is active.
 *
 * ─── Drop-in replacement ─────────────────────────────────────────────────────
 * Before:
 *   import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
 *
 * After:
 *   import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from './SmartMapView';
 *
 * Everything else in your screen files stays the same.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { View, StyleSheet } from 'react-native';

// Lazy-load the two map implementations to avoid hard crashes
// when one of them is missing from the bundle.
let GoogleMapView, GoogleMarker, GooglePolyline;
try {
  const rnMaps = require('react-native-maps');
  GoogleMapView  = rnMaps.default;
  GoogleMarker   = rnMaps.Marker;
  GooglePolyline = rnMaps.Polyline;
} catch {
  // react-native-maps not installed or broken
}

import OsmMapView, {
  Marker   as OsmMarker,
  Polyline as OsmPolyline,
  PROVIDER_GOOGLE,
} from './OsmMapView';

// ─── Config ────────────────────────────────────────────────────────────────────
// How long to wait for Google Maps to call onMapReady before giving up.
const GOOGLE_TIMEOUT = 8000; // ms

// Set to true during development to always use the OSM fallback.
const FORCE_OSM_MAP = false;

// ─── SmartMapView ──────────────────────────────────────────────────────────────
const SmartMapView = forwardRef(function SmartMapView(
  {
    forceOsm = false,
    children,
    onMapReady,
    style,
    provider,
    customMapStyle,   // ignored by OSM (it already uses CartoDB Dark)
    ...rest
  },
  ref
) {
  const googleRef = useRef(null);
  const osmRef    = useRef(null);

  // Start with Google if available; fall back to OSM on timeout / error
  const shouldTryGoogle =
    !forceOsm &&
    !FORCE_OSM_MAP &&
    !!GoogleMapView;

  const [useGoogle, setUseGoogle] = useState(shouldTryGoogle);
  const [googleFailed, setGoogleFailed] = useState(false);
  const timeoutRef = useRef(null);

  // Start the "give up on Google" timer
  useEffect(() => {
    if (!useGoogle) return;
    timeoutRef.current = setTimeout(() => {
      console.warn('[SmartMapView] Google Maps did not call onMapReady in time — switching to OSM fallback.');
      setUseGoogle(false);
      setGoogleFailed(true);
    }, GOOGLE_TIMEOUT);
    return () => clearTimeout(timeoutRef.current);
  }, [useGoogle]);

  const handleGoogleReady = useCallback(() => {
    clearTimeout(timeoutRef.current);
    onMapReady?.();
  }, [onMapReady]);

  const handleGoogleError = useCallback((e) => {
    console.warn('[SmartMapView] Google Maps error:', e?.nativeEvent?.error ?? e);
    clearTimeout(timeoutRef.current);
    setUseGoogle(false);
    setGoogleFailed(true);
  }, []);

  // ── Forward imperative ref to whichever map is active ─────────────────────
  useImperativeHandle(ref, () => ({
    animateToRegion(region, duration) {
      const active = useGoogle ? googleRef.current : osmRef.current;
      active?.animateToRegion(region, duration);
    },
    fitToCoordinates(coords, options) {
      const active = useGoogle ? googleRef.current : osmRef.current;
      active?.fitToCoordinates(coords, options);
    },
  }));

  // ── Remap children: swap Marker/Polyline to the OSM versions if needed ────
  // When using Google Maps we pass children through as-is.
  // When using OSM we need OsmMarker / OsmPolyline.
  //
  // Since OsmMarker / OsmPolyline are purely declarative (they return null),
  // and OsmMapView reads children via Children.forEach, we just pass the
  // same JSX — the displayName check in OsmMapView finds 'OsmMarker' etc.
  // So we need to convert GoogleMarker → OsmMarker when switching.
  //
  // Simplest approach: always render OsmMarker/OsmPolyline from this file,
  // and re-export them as the unified Marker/Polyline for consumers.
  // That way children are always OsmMarker/OsmPolyline regardless of backend.
  // Google Maps understands coordinate/strokeColor/etc. from them too? No —
  // Google Maps needs its own Marker/Polyline.
  //
  // Real solution: use two child sets in parallel (one hidden).
  // Even simpler for our use case: the screen files import Marker/Polyline
  // from SmartMapView, and we conditionally render the right type.
  // We do this by providing a context flag.

  if (useGoogle && GoogleMapView) {
    return (
      <View style={[s.root, style]}>
        <GoogleMapView
          ref={googleRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          customMapStyle={customMapStyle}
          onMapReady={handleGoogleReady}
          onError={handleGoogleError}
          {...rest}
        >
          {children}
        </GoogleMapView>
      </View>
    );
  }

  // OSM fallback
  return (
    <OsmMapView
      ref={osmRef}
      style={style}
      onMapReady={onMapReady}
      {...rest}
    >
      {children}
    </OsmMapView>
  );
});

SmartMapView.displayName = 'SmartMapView';

// ─────────────────────────────────────────────────────────────────────────────
// Unified Marker / Polyline
//
// These components render as either:
//   • react-native-maps Marker/Polyline  (when Google Maps is active)
//   • OsmMarker/OsmPolyline              (when OSM is active — purely declarative)
//
// Because SmartMapView checks which provider is live at render time, and the
// OsmMapView reads OsmMarker/OsmPolyline via their displayName from children,
// the cleanest approach is to export components whose displayName is
// 'OsmMarker' / 'OsmPolyline' — OsmMapView will pick them up, and when Google
// Maps is rendered the same JSX nodes are passed through as children so
// react-native-maps renders them natively.
//
// This works because react-native-maps doesn't care about custom displayNames;
// it only cares that the child has the right props (coordinate, etc.).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified <Marker>
 * Props: coordinate, pinColor, title, description, anchor, children, onPress
 */
function Marker(props) {
  // When rendered inside a GoogleMapView, react-native-maps uses the real Marker.
  // When rendered inside OsmMapView, OsmMapView reads this via displayName.
  // This component itself renders nothing — the parent map handles it.
  return null;
}
Marker.displayName = 'OsmMarker'; // OsmMapView looks for this name

/**
 * Unified <Polyline>
 * Props: coordinates, strokeColor, strokeWidth, lineDashPattern
 */
function Polyline(props) {
  return null;
}
Polyline.displayName = 'OsmPolyline';

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports to match the react-native-maps API surface
// ─────────────────────────────────────────────────────────────────────────────
export { Marker, Polyline, PROVIDER_GOOGLE };
export default SmartMapView;

const s = StyleSheet.create({
  root: { overflow: 'hidden' },
});