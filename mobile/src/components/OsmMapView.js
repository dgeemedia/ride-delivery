// mobile/src/components/OsmMapView.js
/**
 * OsmMapView.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A fully interactive map component using Leaflet + OpenStreetMap tiles.
 * Drop-in fallback for react-native-maps — no API key required.
 *
 * Supports:
 *   • Pan / pinch-zoom
 *   • Markers (with colour and icon label)
 *   • Polyline between two points
 *   • animateToRegion() / fitToCoordinates() via ref
 *   • onRegionChange / onRegionChangeComplete callbacks
 *   • showsUserLocation (uses device GPS via browser geolocation)
 *   • Dark-map style matching your DARK_MAP_STYLE
 *
 * Usage — exactly like react-native-maps:
 *
 *   import OsmMapView, { Marker, Polyline } from './OsmMapView';
 *
 *   const mapRef = useRef(null);
 *
 *   <OsmMapView
 *     ref={mapRef}
 *     style={StyleSheet.absoluteFillObject}
 *     initialRegion={{ latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
 *     showsUserLocation
 *     onMapReady={() => console.log('ready')}
 *     onRegionChangeComplete={(region) => console.log(region)}
 *   >
 *     <Marker coordinate={{ latitude: 6.5244, longitude: 3.3792 }} pinColor="#C9A96E" />
 *     <Polyline
 *       coordinates={[{ latitude: 6.52, longitude: 3.38 }, { latitude: 6.43, longitude: 3.42 }]}
 *       strokeColor="#C9A96E"
 *       strokeWidth={3}
 *     />
 *   </OsmMapView>
 *
 *   // Imperative control (same API as react-native-maps):
 *   mapRef.current.animateToRegion({ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
 *   mapRef.current.fitToCoordinates([{ latitude, longitude }, ...], { edgePadding: { top, right, bottom, left } });
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useMemo,
  Children,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a react-native-maps region to a Leaflet bounds array. */
const regionToBounds = (r) => [
  [r.latitude - r.latitudeDelta / 2, r.longitude - r.longitudeDelta / 2],
  [r.latitude + r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2],
];

/** Collect Marker and Polyline children into a simple descriptor list. */
function collectDescriptors(children) {
  const markers = [];
  const polylines = [];

  Children.forEach(children, (child) => {
    if (!child) return;
    const type = child.type?.displayName ?? child.type?.name ?? '';

    if (type === 'OsmMarker') {
      const { coordinate, pinColor, title, description } = child.props;
      if (coordinate?.latitude != null) {
        markers.push({
          lat: coordinate.latitude,
          lng: coordinate.longitude,
          color: pinColor ?? '#C9A96E',
          title: title ?? '',
          desc: description ?? '',
        });
      }
    }

    if (type === 'OsmPolyline') {
      const { coordinates, strokeColor, strokeWidth, lineDashPattern } = child.props;
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        polylines.push({
          coords: coordinates.map((c) => [c.latitude, c.longitude]),
          color: strokeColor ?? '#C9A96E',
          weight: strokeWidth ?? 3,
          dashed: Array.isArray(lineDashPattern),
        });
      }
    }
  });

  return { markers, polylines };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML template — Leaflet with dark CartoDB tiles
// ─────────────────────────────────────────────────────────────────────────────
const buildHTML = ({ initialRegion, showsUserLocation, markers, polylines }) => {
  const lat = initialRegion?.latitude ?? 6.5244;
  const lng = initialRegion?.longitude ?? 3.3792;
  const zoom = Math.round(Math.log2(360 / (initialRegion?.longitudeDelta ?? 0.05))) + 1;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #1a1a1a; }
  .leaflet-control-zoom { display: none; }
  .leaflet-control-attribution { display: none; }
  /* Custom marker dots */
  .osm-dot {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.8);
    box-shadow: 0 2px 8px rgba(0,0,0,0.6);
  }
  /* User location pulse */
  .user-dot {
    width: 14px; height: 14px; border-radius: 50%;
    background: #4285F4;
    border: 3px solid white;
    box-shadow: 0 0 0 0 rgba(66,133,244,0.6);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0   rgba(66,133,244,0.6); }
    70%  { box-shadow: 0 0 0 12px rgba(66,133,244,0); }
    100% { box-shadow: 0 0 0 0   rgba(66,133,244,0); }
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  // ── Map init ──────────────────────────────────────────────────────────────
  const map = L.map('map', {
    center: [${lat}, ${lng}],
    zoom: ${Math.max(10, Math.min(18, zoom))},
    zoomControl: false,
    attributionControl: false,
  });

  // CartoDB Dark Matter — no API key, great dark style
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // ── Helper: coloured dot marker ───────────────────────────────────────────
  function dotIcon(color) {
    return L.divIcon({
      html: '<div class="osm-dot" style="background:' + color + '"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    });
  }

  // ── Render markers ────────────────────────────────────────────────────────
  const markerData = ${JSON.stringify(markers)};
  markerData.forEach(function(m) {
    const marker = L.marker([m.lat, m.lng], { icon: dotIcon(m.color) }).addTo(map);
    if (m.title) marker.bindTooltip(m.title);
  });

  // ── Render polylines ──────────────────────────────────────────────────────
  const polylineData = ${JSON.stringify(polylines)};
  polylineData.forEach(function(p) {
    L.polyline(p.coords, {
      color: p.color,
      weight: p.weight,
      dashArray: p.dashed ? '8,5' : null,
      opacity: 0.9,
    }).addTo(map);
  });

  // ── User location ─────────────────────────────────────────────────────────
  ${showsUserLocation ? `
  if (navigator.geolocation) {
    const userIcon = L.divIcon({
      html: '<div class="user-dot"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], className: '',
    });
    let userMarker = null;
    const watchId = navigator.geolocation.watchPosition(function(pos) {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      if (!userMarker) {
        userMarker = L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarker.setLatLng(latlng);
      }
    }, null, { enableHighAccuracy: true, timeout: 10000 });
  }
  ` : ''}

  // ── Region change events → RN bridge ─────────────────────────────────────
  let regionChangeTimer = null;
  function emitRegion(type) {
    const c = map.getCenter();
    const b = map.getBounds();
    const msg = JSON.stringify({
      type,
      region: {
        latitude:       c.lat,
        longitude:      c.lng,
        latitudeDelta:  b.getNorth() - b.getSouth(),
        longitudeDelta: b.getEast()  - b.getWest(),
      }
    });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }

  map.on('move', function() {
    clearTimeout(regionChangeTimer);
    emitRegion('regionChange');
  });
  map.on('moveend', function() {
    clearTimeout(regionChangeTimer);
    regionChangeTimer = setTimeout(function() { emitRegion('regionChangeComplete'); }, 80);
  });

  // ── Imperative commands from RN ───────────────────────────────────────────
  window.osmCmd = function(json) {
    const cmd = JSON.parse(json);
    if (cmd.type === 'flyTo') {
      map.flyTo([cmd.lat, cmd.lng], cmd.zoom ?? map.getZoom(), { duration: (cmd.duration ?? 500) / 1000 });
    }
    if (cmd.type === 'fitBounds') {
      map.fitBounds(cmd.bounds, { paddingTopLeft: [cmd.padLeft ?? 60, cmd.padTop ?? 80], paddingBottomRight: [cmd.padRight ?? 60, cmd.padBottom ?? 80], animate: true });
    }
    if (cmd.type === 'updateMarkers') {
      // Re-render by injecting updated HTML — handled by full reload via key change
    }
  };

  // Notify RN the map is ready
  setTimeout(function() {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }, 400);
})();
</script>
</body>
</html>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// OsmMapView
// ─────────────────────────────────────────────────────────────────────────────
const OsmMapView = forwardRef(function OsmMapView(
  {
    style,
    initialRegion,
    showsUserLocation = false,
    onMapReady,
    onRegionChange,
    onRegionChangeComplete,
    scrollEnabled = true,
    zoomEnabled = true,
    children,
  },
  ref
) {
  const webViewRef = useRef(null);

  // Collect child descriptors
  const { markers, polylines } = useMemo(
    () => collectDescriptors(children),
    [children]
  );

  // Build the HTML once (children changes → key change re-mounts WebView)
  const html = useMemo(
    () => buildHTML({ initialRegion, showsUserLocation, markers, polylines }),
    // Re-build when map data changes; NOT on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initialRegion?.latitude,
      initialRegion?.longitude,
      initialRegion?.latitudeDelta,
      JSON.stringify(markers),
      JSON.stringify(polylines),
      showsUserLocation,
    ]
  );

  // ── Imperative API (mirrors react-native-maps MapView ref) ───────────────
  useImperativeHandle(ref, () => ({
    animateToRegion(region, duration = 500) {
      const zoom = Math.round(Math.log2(360 / (region.longitudeDelta ?? 0.012))) + 1;
      const cmd = JSON.stringify({
        type: 'flyTo',
        lat: region.latitude,
        lng: region.longitude,
        zoom: Math.max(10, Math.min(18, zoom)),
        duration,
      });
      webViewRef.current?.injectJavaScript(`window.osmCmd(${JSON.stringify(cmd)});true;`);
    },
    fitToCoordinates(coords, { edgePadding = {} } = {}) {
      if (!coords?.length) return;
      const lats = coords.map((c) => c.latitude);
      const lngs = coords.map((c) => c.longitude);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      const cmd = JSON.stringify({
        type: 'fitBounds',
        bounds,
        padTop:    edgePadding.top    ?? 80,
        padRight:  edgePadding.right  ?? 60,
        padBottom: edgePadding.bottom ?? 80,
        padLeft:   edgePadding.left   ?? 60,
      });
      webViewRef.current?.injectJavaScript(`window.osmCmd(${JSON.stringify(cmd)});true;`);
    },
  }));

  // ── Bridge messages from Leaflet → RN callbacks ───────────────────────────
  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        onMapReady?.();
      } else if (msg.type === 'regionChange') {
        onRegionChange?.(msg.region);
      } else if (msg.type === 'regionChangeComplete') {
        onRegionChangeComplete?.(msg.region);
      }
    } catch {}
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={StyleSheet.absoluteFillObject}
        scrollEnabled={false}          // WebView scroll ≠ map scroll
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled={showsUserLocation}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleMessage}
        originWhitelist={['*']}
        mixedContentMode="always"
        // Disable safe-area so the map fills the parent completely
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
});

OsmMapView.displayName = 'OsmMapView';

// ─────────────────────────────────────────────────────────────────────────────
// Marker & Polyline (display-name-tagged so OsmMapView can identify them)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * <Marker coordinate={{ latitude, longitude }} pinColor="#C9A96E" title="Pickup" />
 * Renders as a coloured dot on the map.
 * Children (custom marker views) are ignored in the WebView implementation —
 * use pinColor for colour customisation.
 */
function OsmMarker() {
  // Purely declarative — rendered inside the HTML, not as a RN view
  return null;
}
OsmMarker.displayName = 'OsmMarker';

/**
 * <Polyline
 *   coordinates={[{ latitude, longitude }, ...]}
 *   strokeColor="#C9A96E"
 *   strokeWidth={3}
 *   lineDashPattern={[8, 5]}
 * />
 */
function OsmPolyline() {
  return null;
}
OsmPolyline.displayName = 'OsmPolyline';

// PROVIDER_GOOGLE constant (no-op here, accepted for API compatibility)
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});

export { OsmMarker as Marker, OsmPolyline as Polyline };
export default OsmMapView;