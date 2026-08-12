// mobile/src/components/SmartMapView.js
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
// Translates the dummy OsmMarker/OsmPolyline/OsmCircle children (used by the
// Leaflet path — they're no-op placeholders whose props get read by
// OsmMapView's collectDescriptors) into real react-native-maps components
// for the Google Maps path. Without this, Google Maps renders with zero
// pins — the dummy components literally return null regardless of props.
// ─────────────────────────────────────────────────────────────────────────────
function translateChildrenForGoogle(children) {
  return React.Children.map(children, (child) => {
    if (!child) return child;
    const displayName = child.type?.displayName ?? child.type?.name ?? '';

    if (displayName === 'OsmMarker') {
      const { coordinate, pinColor, title, anchor, onPress, tracksViewChanges, children: markerChildren } = child.props;
      return (
        <GoogleMarker
          coordinate={coordinate}
          pinColor={pinColor}
          title={title}
          anchor={anchor}
          onPress={onPress}
          tracksViewChanges={tracksViewChanges}
        >
          {markerChildren}
        </GoogleMarker>
      );
    }

    if (displayName === 'OsmPolyline') {
      const { coordinates, strokeColor, strokeWidth, lineDashPattern } = child.props;
      return (
        <GooglePolyline
          coordinates={coordinates}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          lineDashPattern={lineDashPattern}
        />
      );
    }

    if (displayName === 'OsmCircle') {
      const { center, radius, strokeColor, fillColor, strokeWidth } = child.props;
      return (
        <GoogleCircle
          center={center}
          radius={radius}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
        />
      );
    }

    return child;
  });
}

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
    // InDrive/Uber-style tracked marker — glides + rotates automatically
    // (OSM-only for now; a no-op on Google Maps, which already animates
    // Marker coordinate changes natively — worth a parallel Google-side
    // implementation using a declarative <Marker rotation={...}> if/when
    // FORCE_OSM_MAP flips to false)
    updateTrackedMarker(id, lat, lng, opts) {
      osmRef.current?.updateTrackedMarker(id, lat, lng, opts);
    },
    removeTrackedMarker(id) {
      osmRef.current?.removeTrackedMarker(id);
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
          {translateChildrenForGoogle(children)}
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