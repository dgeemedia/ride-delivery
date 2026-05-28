// mobile/src/components/OsmMapView.js
//
// Enhanced OSM fallback — visually close to Google Maps:
//   • Dark CartoDB Dark Matter tiles (matches Google night style)
//   • Teardrop SVG marker pins (Google-style)
//   • Driver pins with fare badge labels
//   • Animated radar pulse rings (CSS keyframes, no React Animated needed)
//   • Polyline with animated dash during scan
//   • User location dot with accuracy circle + CSS pulse
//   • Circle overlay support (for RadarPulse / geofence rings)
//   • Smooth eased flyTo / fitBounds
//   • Message-bridge for animateToRegion, fitToCoordinates, sendMarkers, sendCircles

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  Children,
  useEffect,
  useState,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';

let WebView = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    console.warn('[OsmMapView] react-native-webview not installed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Child descriptor collector
// ─────────────────────────────────────────────────────────────────────────────
function collectDescriptors(children) {
  const markers   = [];
  const polylines = [];
  const circles   = [];

  Children.forEach(children, (child) => {
    if (!child) return;
    const type = child.type?.displayName ?? child.type?.name ?? '';

    if (type === 'OsmMarker') {
      const { coordinate, pinColor, title, anchor, children: markerChildren } = child.props;
      if (coordinate?.latitude != null) {
        // Try to detect if this is a driver pin (has fare badge child)
        // We pass a label if the title looks like a fare string
        markers.push({
          lat:    coordinate.latitude,
          lng:    coordinate.longitude,
          color:  pinColor ?? '#C9A96E',
          title:  title ?? '',
          anchor: anchor ?? null,
          // If markerChildren exist it's a custom-rendered marker (handled in React Native)
          // For OSM we just render a styled pin
        });
      }
    }

    if (type === 'OsmPolyline') {
      const { coordinates, strokeColor, strokeWidth, lineDashPattern } = child.props;
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        polylines.push({
          coords: coordinates.map((c) => [c.latitude, c.longitude]),
          color:  strokeColor ?? '#C9A96E',
          weight: strokeWidth ?? 3,
          dashed: Array.isArray(lineDashPattern),
        });
      }
    }

    if (type === 'OsmCircle') {
      const { center, radius, strokeColor, fillColor, strokeWidth } = child.props;
      if (center?.latitude != null) {
        circles.push({
          lat:         center.latitude,
          lng:         center.longitude,
          radius:      radius ?? 300,
          strokeColor: strokeColor ?? '#C9A96E80',
          fillColor:   fillColor   ?? '#C9A96E08',
          strokeWidth: strokeWidth ?? 1.5,
        });
      }
    }
  });

  return { markers, polylines, circles };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML builder — Google-like dark map
// ─────────────────────────────────────────────────────────────────────────────
function buildHTML({ initialRegion, showsUserLocation, markers, polylines, circles }) {
  const lat  = initialRegion?.latitude  ?? 6.5244;
  const lng  = initialRegion?.longitude ?? 3.3792;
  const dLng = initialRegion?.longitudeDelta ?? 0.05;
  const zoom = Math.max(10, Math.min(18, Math.round(Math.log2(360 / dLng)) + 1));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body,#map { width:100%; height:100%; background:#1a1a2e; }

  /* Hide Leaflet chrome */
  .leaflet-control-zoom,
  .leaflet-control-attribution { display:none !important; }

  /* ── User location ── */
  .user-location-wrapper {
    position: relative;
    width: 22px; height: 22px;
  }
  .user-pulse-ring {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(66,133,244,0.2);
    animation: userPulse 2.2s ease-out infinite;
  }
  .user-accuracy-ring {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 22px; height: 22px;
    border-radius: 50%;
    background: rgba(66,133,244,0.15);
    border: 1.5px solid rgba(66,133,244,0.4);
  }
  .user-dot {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 12px; height: 12px;
    border-radius: 50%;
    background: #4285F4;
    border: 2.5px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    z-index: 2;
  }
  @keyframes userPulse {
    0%   { opacity:0.8; transform:translate(-50%,-50%) scale(0.5); }
    70%  { opacity:0;   transform:translate(-50%,-50%) scale(1.5); }
    100% { opacity:0;   transform:translate(-50%,-50%) scale(1.5); }
  }

  /* ── Radar pulse rings ── */
  .radar-ring {
    border-radius: 50%;
    position: absolute;
    top:50%; left:50%;
    transform: translate(-50%,-50%);
    animation: radarExpand 1.8s ease-out infinite;
    pointer-events: none;
  }
  .radar-ring:nth-child(2) { animation-delay: 0.6s; }
  .radar-ring:nth-child(3) { animation-delay: 1.2s; }
  @keyframes radarExpand {
    0%   { width:0;     height:0;     opacity:0.7; }
    60%  { opacity:0.3; }
    100% { width:280px; height:280px; opacity:0;   }
  }

  /* ── Teardrop marker pin ── */
  .map-pin-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
  }
  .map-pin-svg {
    width: 32px; height: 42px;
    flex-shrink: 0;
  }
  .map-pin-label {
    margin-top: 2px;
    background: rgba(8,12,24,0.92);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    padding: 2px 6px;
    border-radius: 6px;
    white-space: nowrap;
    letter-spacing: 0.3px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }

  /* ── Pickup / dropoff landmark pins ── */
  .landmark-pin {
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));
  }

  /* ── Selected pin glow ── */
  .map-pin-wrapper.selected .map-pin-svg {
    filter: brightness(1.3);
  }
  .selected-glow {
    position: absolute;
    top: 8px; left: 50%;
    transform: translateX(-50%);
    width: 44px; height: 44px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
    pointer-events: none;
    animation: pinGlow 1.5s ease-in-out infinite alternate;
  }
  @keyframes pinGlow {
    from { opacity:0.4; transform:translateX(-50%) scale(0.9); }
    to   { opacity:1;   transform:translateX(-50%) scale(1.1); }
  }

  /* ── Animated route dash ── */
  .leaflet-interactive.animated-route {
    stroke-dashoffset: 0;
    animation: dashFlow 1.2s linear infinite;
  }
  @keyframes dashFlow {
    from { stroke-dashoffset: 0; }
    to   { stroke-dashoffset: -26; }
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  // ── Map init ──────────────────────────────────────────────────────────────
  var map = L.map('map', {
    center: [${lat}, ${lng}],
    zoom: ${zoom},
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 80,
  });

  // ── Dark tiles — Google-like night style ──────────────────────────────────
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // ─────────────────────────────────────────────────────────────────────────
  // SVG Marker factory — teardrop shape like Google Maps
  // ─────────────────────────────────────────────────────────────────────────
  function tearDropSVG(color, icon, selected) {
    // Inner icon: 'car', 'person', 'dot'
    var iconContent = '';
    if (icon === 'car') {
      iconContent = '<text x="16" y="19" text-anchor="middle" font-size="11" fill="white" font-family="sans-serif">🚗</text>';
    } else if (icon === 'dot') {
      iconContent = '<circle cx="16" cy="15" r="5" fill="white" opacity="0.95"/>';
    } else {
      iconContent = '<circle cx="16" cy="15" r="4.5" fill="white" opacity="0.95"/>';
    }

    var glow = selected
      ? '<circle cx="16" cy="15" r="14" fill="' + color + '" opacity="0.25"/>'
      : '';

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" class="map-pin-svg">',
      '  <defs>',
      '    <filter id="ps" x="-30%" y="-30%" width="160%" height="160%">',
      '      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.5)"/>',
      '    </filter>',
      '    <radialGradient id="pg_' + color.replace('#','') + '" cx="40%" cy="35%" r="65%">',
      '      <stop offset="0%" stop-color="' + lighten(color, 0.3) + '"/>',
      '      <stop offset="100%" stop-color="' + color + '"/>',
      '    </radialGradient>',
      '  </defs>',
      glow,
      '  <path d="M16 2 C9 2 4 7.5 4 14 C4 22 16 38 16 38 C16 38 28 22 28 14 C28 7.5 23 2 16 2 Z"',
      '    fill="url(#pg_' + color.replace('#','') + ')" filter="url(#ps)" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>',
      iconContent,
      '</svg>',
    ].join('');
  }

  function lighten(hex, amt) {
    try {
      var c = parseInt(hex.slice(1), 16);
      var r = Math.min(255, (c >> 16) + Math.round(amt * 255));
      var g = Math.min(255, ((c >> 8) & 0xff) + Math.round(amt * 160));
      var b = Math.min(255, (c & 0xff) + Math.round(amt * 100));
      return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
    } catch(e) { return hex; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pickup / Dropoff landmark pins (larger, Google-exact shape)
  // ─────────────────────────────────────────────────────────────────────────
  function landmarkIcon(color, type) {
    // type: 'pickup' (circle dot) | 'dropoff' (filled teardrop)
    var svg;
    if (type === 'pickup') {
      svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">',
        '  <circle cx="14" cy="14" r="10" fill="' + color + '" opacity="0.2"/>',
        '  <circle cx="14" cy="14" r="6" fill="' + color + '"/>',
        '  <circle cx="14" cy="14" r="9" fill="none" stroke="' + color + '" stroke-width="2"/>',
        '</svg>',
      ].join('');
      return L.divIcon({
        html: '<div class="landmark-pin">' + svg + '</div>',
        iconSize: [28, 28], iconAnchor: [14, 14], className: '',
      });
    } else {
      svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">',
        '  <defs>',
        '    <filter id="lf"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.55)"/></filter>',
        '    <radialGradient id="lg" cx="40%" cy="30%" r="70%">',
        '      <stop offset="0%" stop-color="' + lighten(color, 0.4) + '"/>',
        '      <stop offset="100%" stop-color="' + color + '"/>',
        '    </radialGradient>',
        '  </defs>',
        '  <path d="M16 2 C9 2 4 7.5 4 14 C4 22 16 38 16 38 C16 38 28 22 28 14 C28 7.5 23 2 16 2 Z"',
        '    fill="url(#lg)" filter="url(#lf)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>',
        '  <circle cx="16" cy="14" r="5" fill="white" opacity="0.95"/>',
        '</svg>',
      ].join('');
      return L.divIcon({
        html: '<div class="landmark-pin">' + svg + '</div>',
        iconSize: [32, 42], iconAnchor: [16, 38], className: '',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Driver / partner pin icon
  // ─────────────────────────────────────────────────────────────────────────
  function driverIcon(color, fareLabel, selected) {
    var wrapClass = 'map-pin-wrapper' + (selected ? ' selected' : '');
    var glowHtml  = selected ? '<div class="selected-glow"></div>' : '';
    var badgeHtml = fareLabel
      ? '<div class="map-pin-label">' + fareLabel + '</div>'
      : '';

    return L.divIcon({
      html: '<div class="' + wrapClass + '">' + glowHtml + tearDropSVG(color, 'car', selected) + badgeHtml + '</div>',
      iconSize:   [32, selected ? 70 : 58],
      iconAnchor: [16, selected ? 46 : 42],
      className: '',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Radar pulse icon (CSS-animated, anchored at center)
  // ─────────────────────────────────────────────────────────────────────────
  function radarIcon(color) {
    var style = 'border:1.5px solid ' + color + '; background:' + color + '08;';
    return L.divIcon({
      html: [
        '<div style="position:relative;width:280px;height:280px;pointer-events:none;">',
        '  <div class="radar-ring" style="' + style + '"></div>',
        '  <div class="radar-ring" style="' + style + '"></div>',
        '  <div class="radar-ring" style="' + style + '"></div>',
        '</div>',
      ].join(''),
      iconSize:   [280, 280],
      iconAnchor: [140, 140],
      className: '',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer groups
  // ─────────────────────────────────────────────────────────────────────────
  var markersGroup  = L.layerGroup().addTo(map);
  var routeGroup    = L.layerGroup().addTo(map);
  var circlesGroup  = L.layerGroup().addTo(map);
  var radarGroup    = L.layerGroup().addTo(map);
  var userGroup     = L.layerGroup().addTo(map);

  // ─────────────────────────────────────────────────────────────────────────
  // Static markers from children (pickup / dropoff landmarks)
  // ─────────────────────────────────────────────────────────────────────────
  var markerData = ${JSON.stringify(markers)};
  markerData.forEach(function(m, idx) {
    var isPickup  = idx === 0;
    var isDropoff = idx === markerData.length - 1 && idx > 0;
    var icon;

    if (isPickup) {
      icon = landmarkIcon(m.color || '#C9A96E', 'pickup');
    } else if (isDropoff) {
      icon = landmarkIcon(m.color || '#E05555', 'dropoff');
    } else {
      // Generic colored dot
      icon = L.divIcon({
        html: '<div style="width:14px;height:14px;border-radius:50%;background:' + (m.color||'#C9A96E') + ';border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
        iconSize: [14,14], iconAnchor: [7,7], className: '',
      });
    }

    var mk = L.marker([m.lat, m.lng], { icon }).addTo(markersGroup);
    if (m.title) mk.bindTooltip(m.title, { permanent: false, direction: 'top', offset: [0,-36] });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Static polylines
  // ─────────────────────────────────────────────────────────────────────────
  var polylineData = ${JSON.stringify(polylines)};
  polylineData.forEach(function(p) {
    // Glow underline
    L.polyline(p.coords, {
      color: p.color,
      weight: (p.weight || 3) + 4,
      opacity: 0.18,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(routeGroup);

    // Main line
    var line = L.polyline(p.coords, {
      color:     p.color,
      weight:    p.weight || 3,
      opacity:   0.92,
      lineCap:   'round',
      lineJoin:  'round',
      dashArray: p.dashed ? '10 7' : null,
    }).addTo(routeGroup);

    // Animated dash when dashed
    if (p.dashed) {
      var el = line.getElement();
      if (el) el.classList.add('animated-route');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Static circles (geofence / radius)
  // ─────────────────────────────────────────────────────────────────────────
  var circleData = ${JSON.stringify(circles)};
  circleData.forEach(function(c) {
    L.circle([c.lat, c.lng], {
      radius:      c.radius,
      color:       c.strokeColor,
      fillColor:   c.fillColor,
      fillOpacity: 1,
      weight:      c.strokeWidth,
      opacity:     0.8,
    }).addTo(circlesGroup);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // User location
  // ─────────────────────────────────────────────────────────────────────────
  ${showsUserLocation ? `
  var userMarker = null;
  var userIcon = L.divIcon({
    html: [
      '<div class="user-location-wrapper">',
      '  <div class="user-pulse-ring"></div>',
      '  <div class="user-accuracy-ring"></div>',
      '  <div class="user-dot"></div>',
      '</div>',
    ].join(''),
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
    className: '',
  });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(function(pos) {
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (!userMarker) {
        userMarker = L.marker(ll, { icon: userIcon, zIndexOffset: 2000 }).addTo(userGroup);
      } else {
        userMarker.setLatLng(ll);
      }
    }, null, { enableHighAccuracy: true, timeout: 10000 });
  }
  ` : ''}

  // ─────────────────────────────────────────────────────────────────────────
  // Dynamic driver / partner pins — sent via postMessage from React Native
  // ─────────────────────────────────────────────────────────────────────────
  var driverMarkers = {};

  function updateDriverPins(pins, selectedId) {
    // Remove stale
    Object.keys(driverMarkers).forEach(function(id) {
      if (!pins.find(function(p){ return String(p.id) === id; })) {
        map.removeLayer(driverMarkers[id]);
        delete driverMarkers[id];
      }
    });

    pins.forEach(function(pin) {
      var id       = String(pin.id);
      var selected = String(pin.id) === String(selectedId);
      var icon     = driverIcon(pin.color || '#C9A96E', pin.label || null, selected);

      if (driverMarkers[id]) {
        driverMarkers[id].setIcon(icon);
        driverMarkers[id].setLatLng([pin.lat, pin.lng]);
      } else {
        var mk = L.marker([pin.lat, pin.lng], { icon, zIndexOffset: selected ? 500 : 100 }).addTo(map);
        mk.on('click', function() {
          postMsg('markerPress', { id: pin.id });
        });
        driverMarkers[id] = mk;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Radar pulse — started/stopped from React Native
  // ─────────────────────────────────────────────────────────────────────────
  var radarMarker = null;

  function startRadar(lat, lng, color) {
    stopRadar();
    radarMarker = L.marker([lat, lng], {
      icon: radarIcon(color || '#C9A96E'),
      zIndexOffset: -100,
      interactive: false,
    }).addTo(radarGroup);
  }

  function stopRadar() {
    if (radarMarker) { map.removeLayer(radarMarker); radarMarker = null; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Message bridge — postMessage ↔ React Native
  // ─────────────────────────────────────────────────────────────────────────
  function postMsg(type, payload) {
    var c = map.getCenter(), b = map.getBounds();
    var base = {
      type: type,
      region: {
        latitude:       c.lat,
        longitude:      c.lng,
        latitudeDelta:  b.getNorth() - b.getSouth(),
        longitudeDelta: b.getEast()  - b.getWest(),
      },
    };
    if (payload) Object.assign(base, payload);
    var msg = JSON.stringify(base);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    try { window.parent.postMessage(msg, '*'); } catch(e) {}
  }

  var moveTimer = null;
  map.on('move',    function() { clearTimeout(moveTimer); postMsg('regionChange'); });
  map.on('moveend', function() {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function() { postMsg('regionChangeComplete'); }, 80);
  });
  map.on('click', function(e) {
    postMsg('mapPress', { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Command handler — called from React Native via injectJavaScript
  // ─────────────────────────────────────────────────────────────────────────
  window.osmCmd = function(json) {
    var cmd;
    try { cmd = typeof json === 'string' ? JSON.parse(json) : json; } catch(e) { return; }

    if (cmd.type === 'flyTo') {
      var zoom = cmd.zoom || map.getZoom();
      map.flyTo([cmd.lat, cmd.lng], zoom, {
        duration: (cmd.duration || 500) / 1000,
        easeLinearity: 0.5,
      });
    }

    if (cmd.type === 'fitBounds') {
      map.fitBounds(cmd.bounds, {
        paddingTopLeft:     [cmd.padLeft  || 60, cmd.padTop    || 80],
        paddingBottomRight: [cmd.padRight || 60, cmd.padBottom || 80],
        animate: true,
        duration: 0.6,
      });
    }

    if (cmd.type === 'setDriverPins') {
      updateDriverPins(cmd.pins || [], cmd.selectedId);
    }

    if (cmd.type === 'startRadar') {
      startRadar(cmd.lat, cmd.lng, cmd.color);
    }

    if (cmd.type === 'stopRadar') {
      stopRadar();
    }

    if (cmd.type === 'setCircles') {
      circlesGroup.clearLayers();
      (cmd.circles || []).forEach(function(c) {
        L.circle([c.lat, c.lng], {
          radius:      c.radius,
          color:       c.strokeColor || 'rgba(255,255,255,0.4)',
          fillColor:   c.fillColor   || 'rgba(255,255,255,0.04)',
          fillOpacity: 1,
          weight:      c.strokeWidth || 1.5,
          opacity:     0.85,
        }).addTo(circlesGroup);
      });
    }
  };

  // ── Ready ──────────────────────────────────────────────────────────────────
  setTimeout(function() {
    postMsg('ready');
  }, 300);

})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared imperative command sender
// ─────────────────────────────────────────────────────────────────────────────
function makeRef({ sendCmd, isWeb, iframeRef, webViewRef }) {
  return {
    animateToRegion(region, duration = 500) {
      const dLng = region.longitudeDelta ?? 0.012;
      const zoom = Math.max(10, Math.min(18, Math.round(Math.log2(360 / dLng)) + 1));
      sendCmd({ type: 'flyTo', lat: region.latitude, lng: region.longitude, zoom, duration });
    },
    fitToCoordinates(coords, { edgePadding = {} } = {}) {
      if (!coords?.length) return;
      const lats   = coords.map((c) => c.latitude);
      const lngs   = coords.map((c) => c.longitude);
      const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
      sendCmd({
        type: 'fitBounds', bounds,
        padTop:    edgePadding.top    ?? 80,
        padRight:  edgePadding.right  ?? 60,
        padBottom: edgePadding.bottom ?? 80,
        padLeft:   edgePadding.left   ?? 60,
      });
    },
    // Extra helpers for screen files
    startRadar(lat, lng, color)         { sendCmd({ type: 'startRadar', lat, lng, color }); },
    stopRadar()                          { sendCmd({ type: 'stopRadar' }); },
    setDriverPins(pins, selectedId)      { sendCmd({ type: 'setDriverPins', pins, selectedId }); },
    setCircles(circles)                  { sendCmd({ type: 'setCircles', circles }); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Web renderer — iframe srcdoc
// ─────────────────────────────────────────────────────────────────────────────
const WebMapView = forwardRef(function WebMapView(
  { style, initialRegion, showsUserLocation, onMapReady,
    onRegionChange, onRegionChangeComplete, onMessage: _onMessage, onPress, children },
  ref
) {
  const iframeRef = useRef(null);
  const { markers, polylines, circles } = useMemo(() => collectDescriptors(children), [children]);

  const html = useMemo(
    () => buildHTML({ initialRegion, showsUserLocation, markers, polylines, circles }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initialRegion?.latitude, initialRegion?.longitude, initialRegion?.latitudeDelta,
      JSON.stringify(markers), JSON.stringify(polylines), JSON.stringify(circles),
      showsUserLocation,
    ]
  );

  const sendCmd = (cmd) => {
    try { iframeRef.current?.contentWindow?.osmCmd?.(cmd); } catch {}
  };

  useEffect(() => {
    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ready')                onMapReady?.();
        if (msg.type === 'regionChange')         onRegionChange?.(msg.region);
        if (msg.type === 'regionChangeComplete') onRegionChangeComplete?.(msg.region);
        if (msg.type === 'markerPress')          _onMessage?.({ nativeEvent: { data: JSON.stringify(msg) } });
        if (msg.type === 'mapPress')             onPress?.({ nativeEvent: { coordinate: msg.coordinate } });
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMapReady, onRegionChange, onRegionChangeComplete, _onMessage]);

  useImperativeHandle(ref, () => makeRef({ sendCmd, isWeb: true, iframeRef }));

  return (
    <View style={[webStyles.container, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={webStyles.iframe}
        sandbox="allow-scripts allow-same-origin"
        title="map"
      />
    </View>
  );
});

const webStyles = {
  container: { overflow: 'hidden', flex: 1 },
  iframe:    { width: '100%', height: '100%', border: 'none', display: 'block' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Native renderer — react-native-webview
// ─────────────────────────────────────────────────────────────────────────────
const NativeMapView = forwardRef(function NativeMapView(
  { style, initialRegion, showsUserLocation, onMapReady,
    onRegionChange, onRegionChangeComplete, onMessage: _onMessage, onPress, children },
  ref
) {
  const webViewRef = useRef(null);
  const { markers, polylines, circles } = useMemo(() => collectDescriptors(children), [children]);

  const html = useMemo(
    () => buildHTML({ initialRegion, showsUserLocation, markers, polylines, circles }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initialRegion?.latitude, initialRegion?.longitude, initialRegion?.latitudeDelta,
      JSON.stringify(markers), JSON.stringify(polylines), JSON.stringify(circles),
      showsUserLocation,
    ]
  );

  const sendCmd = (cmd) => {
    const json = JSON.stringify(cmd);
    webViewRef.current?.injectJavaScript(`window.osmCmd(${JSON.stringify(json)});true;`);
  };

  useImperativeHandle(ref, () => makeRef({ sendCmd, isWeb: false, webViewRef }));

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready')                onMapReady?.();
      if (msg.type === 'regionChange')         onRegionChange?.(msg.region);
      if (msg.type === 'regionChangeComplete') onRegionChangeComplete?.(msg.region);
      if (msg.type === 'mapPress')             onPress?.({ nativeEvent: { coordinate: msg.coordinate } });
      _onMessage?.(event);
    } catch {}
  };

  if (!WebView) {
    return <View style={[nativeStyles.container, nativeStyles.placeholder, style]} />;
  }

  return (
    <View style={[nativeStyles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={StyleSheet.absoluteFillObject}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled={showsUserLocation}
        allowsInlineMediaPlayback
        onMessage={handleMessage}
        originWhitelist={['*']}
        mixedContentMode="always"
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
});

const nativeStyles = StyleSheet.create({
  container:   { overflow: 'hidden' },
  placeholder: { backgroundColor: '#1a1a2e' },
});

// ─────────────────────────────────────────────────────────────────────────────
// OsmMapView — auto-selects platform renderer
// ─────────────────────────────────────────────────────────────────────────────
const OsmMapView = forwardRef(function OsmMapView(props, ref) {
  if (Platform.OS === 'web') return <WebMapView ref={ref} {...props} />;
  return <NativeMapView ref={ref} {...props} />;
});

OsmMapView.displayName = 'OsmMapView';

// ─────────────────────────────────────────────────────────────────────────────
// Declarative child components — read by collectDescriptors via displayName
// ─────────────────────────────────────────────────────────────────────────────
function OsmMarker()   { return null; }
OsmMarker.displayName  = 'OsmMarker';

function OsmPolyline() { return null; }
OsmPolyline.displayName = 'OsmPolyline';

function OsmCircle()   { return null; }
OsmCircle.displayName  = 'OsmCircle';

export const PROVIDER_GOOGLE  = 'google';
export const PROVIDER_DEFAULT = 'default';
export { OsmMarker as Marker, OsmPolyline as Polyline, OsmCircle as Circle };
export default OsmMapView;