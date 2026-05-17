// mobile/src/components/SmartMapView.js
//
// Changes from previous version:
//   • Circle exported — mapped to OsmCircle for OSM, or react-native-maps Circle for Google
//   • Imperative ref now forwards: startRadar, stopRadar, setDriverPins, setCircles
//     (these call into OsmMapView's Leaflet command bridge when OSM is active;
//      they are no-ops when Google Maps is active since Google uses React children)
//   • FORCE_OSM_MAP = true kept (set false when Google Maps key is ready)

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { View, StyleSheet } from 'react-native';

// Lazy-load Google Maps
let GoogleMapView, GoogleMarker, GooglePolyline, GoogleCircle;
try {
  const rnMaps   = require('react-native-maps');
  GoogleMapView  = rnMaps.default;
  GoogleMarker   = rnMaps.Marker;
  GooglePolyline = rnMaps.Polyline;
  GoogleCircle   = rnMaps.Circle;
} catch {
  // react-native-maps not installed
}

import OsmMapView, {
  Marker   as OsmMarker,
  Polyline as OsmPolyline,
  Circle   as OsmCircle,
  PROVIDER_GOOGLE,
} from './OsmMapView';

// ─── Config ────────────────────────────────────────────────────────────────────
const GOOGLE_TIMEOUT = 8000;
const FORCE_OSM_MAP  = true; // flip to false when Google Maps key is configured

// ─────────────────────────────────────────────────────────────────────────────
// SmartMapView
// ─────────────────────────────────────────────────────────────────────────────
const SmartMapView = forwardRef(function SmartMapView(
  {
    forceOsm = false,
    children,
    onMapReady,
    style,
    provider,
    customMapStyle,
    ...rest
  },
  ref
) {
  const googleRef = useRef(null);
  const osmRef    = useRef(null);

  const shouldTryGoogle =
    !forceOsm &&
    !FORCE_OSM_MAP &&
    !!GoogleMapView;

  const [useGoogle, setUseGoogle] = useState(shouldTryGoogle);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!useGoogle) return;
    timeoutRef.current = setTimeout(() => {
      console.warn('[SmartMapView] Google Maps timeout — switching to OSM fallback.');
      setUseGoogle(false);
    }, GOOGLE_TIMEOUT);
    return () => clearTimeout(timeoutRef.current);
  }, [useGoogle]);

  const handleGoogleReady = useCallback(() => {
    clearTimeout(timeoutRef.current);
    onMapReady?.();
  }, [onMapReady]);

  const handleGoogleError = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setUseGoogle(false);
  }, []);

  // ── Unified imperative API ─────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    // Standard react-native-maps API
    animateToRegion(region, duration) {
      if (useGoogle) googleRef.current?.animateToRegion(region, duration);
      else           osmRef.current?.animateToRegion(region, duration);
    },
    fitToCoordinates(coords, options) {
      if (useGoogle) googleRef.current?.fitToCoordinates(coords, options);
      else           osmRef.current?.fitToCoordinates(coords, options);
    },

    // OSM-only extensions (no-op on Google Maps — Google uses React children)
    startRadar(lat, lng, color) {
      osmRef.current?.startRadar(lat, lng, color);
    },
    stopRadar() {
      osmRef.current?.stopRadar();
    },
    // Push driver/partner pins directly into Leaflet (bypasses React re-render)
    // pins: Array<{ id, lat, lng, color, label }>
    setDriverPins(pins, selectedId) {
      osmRef.current?.setDriverPins(pins, selectedId);
    },
    // Push circle overlays directly into Leaflet
    // circles: Array<{ lat, lng, radius, strokeColor, fillColor, strokeWidth }>
    setCircles(circles) {
      osmRef.current?.setCircles(circles);
    },
  }));

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
// Unified Marker — displayName 'OsmMarker' so OsmMapView picks it up
// Google Maps also accepts it as a child (it reads props, not displayName)
// ─────────────────────────────────────────────────────────────────────────────
function Marker(props) { return null; }
Marker.displayName = 'OsmMarker';

function Polyline(props) { return null; }
Polyline.displayName = 'OsmPolyline';

function Circle(props) { return null; }
Circle.displayName = 'OsmCircle';

export { Marker, Polyline, Circle, PROVIDER_GOOGLE };
export default SmartMapView;

const s = StyleSheet.create({
  root: { overflow: 'hidden' },
});