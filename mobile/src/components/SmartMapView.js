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
import { Ionicons } from '@expo/vector-icons';

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
const FORCE_OSM_MAP  = false; // flip to false when Google Maps key is configured

// ─────────────────────────────────────────────────────────────────────────────
// Bearing helper — same formula as the OSM/Leaflet implementation, used to
// rotate the Google-side tracked marker to face direction of travel.
// ─────────────────────────────────────────────────────────────────────────────
function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

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

  // ── Google-native tracked marker state ──────────────────────────────────
  // id -> { lat, lng, rotation, color }
  // GoogleMarker glides between coordinate updates on its own (native SDK
  // animation), so we only need to track rotation ourselves — same bearing
  // math as the OSM/Leaflet path, just driven through React state instead
  // of direct DOM/Leaflet calls.
  const [trackedMarkers, setTrackedMarkers] = useState({});
  const trackedPrevRef = useRef({}); // id -> last known { lat, lng }, for bearing calc

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

    // InDrive/Uber-style tracked marker — glides + rotates automatically.
    // Google path: updates React state -> GoogleMarker's `coordinate` prop
    // changes -> the native SDK animates the glide for us. We only compute
    // rotation (bearing between previous and new point) ourselves.
    // OSM path: unchanged, forwards to Leaflet as before.
    updateTrackedMarker(id, lat, lng, opts = {}) {
      if (useGoogle) {
        const prev = trackedPrevRef.current[id];
        const rotation = prev ? bearingDeg(prev.lat, prev.lng, lat, lng) : (trackedMarkers[id]?.rotation ?? 0);
        trackedPrevRef.current[id] = { lat, lng };
        setTrackedMarkers((cur) => ({
          ...cur,
          [id]: { lat, lng, rotation, color: opts.color || '#4285F4' },
        }));
      } else {
        osmRef.current?.updateTrackedMarker(id, lat, lng, opts);
      }
    },
    removeTrackedMarker(id) {
      if (useGoogle) {
        delete trackedPrevRef.current[id];
        setTrackedMarkers((cur) => {
          if (!(id in cur)) return cur;
          const next = { ...cur };
          delete next[id];
          return next;
        });
      } else {
        osmRef.current?.removeTrackedMarker(id);
      }
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

          {/* Google-native tracked markers (InDrive/Uber-style glide + rotate) */}
          {Object.entries(trackedMarkers).map(([id, m]) => (
            <GoogleMarker
              key={`tracked-${id}`}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              // tracksViewChanges must stay true here: the marker's inner
              // content (rotation) changes every update, so we need a fresh
              // snapshot each time — same tradeoff as DriverPin/PartnerPin,
              // at the same ~4s GPS update cadence.
              tracksViewChanges
              zIndex={999}
            >
              <View style={{ transform: [{ rotate: `${m.rotation}deg` }] }}>
                <Ionicons name="navigate" size={28} color={m.color} />
              </View>
            </GoogleMarker>
          ))}
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