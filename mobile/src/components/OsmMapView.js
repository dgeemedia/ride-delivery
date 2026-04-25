// mobile/src/components/OsmMapView.js
/**
 * OsmMapView.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive Leaflet + OpenStreetMap map. No API key required.
 *
 * Platform support:
 *   • iOS / Android  → react-native-webview (WebView)
 *   • Web            → <iframe srcdoc>  (no WebView dependency)
 *
 * Drop-in replacement for react-native-maps:
 *   import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from './OsmMapView';
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  Children,
  useEffect,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// Only import WebView on native — web doesn't have it
let WebView = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    console.warn('[OsmMapView] react-native-webview not installed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collect Marker / Polyline children into plain descriptors
// ─────────────────────────────────────────────────────────────────────────────
function collectDescriptors(children) {
  const markers = [];
  const polylines = [];

  Children.forEach(children, (child) => {
    if (!child) return;
    const type = child.type?.displayName ?? child.type?.name ?? '';

    if (type === 'OsmMarker') {
      const { coordinate, pinColor, title } = child.props;
      if (coordinate?.latitude != null) {
        markers.push({
          lat:   coordinate.latitude,
          lng:   coordinate.longitude,
          color: pinColor ?? '#C9A96E',
          title: title ?? '',
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
  });

  return { markers, polylines };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Leaflet HTML builder
// ─────────────────────────────────────────────────────────────────────────────
function buildHTML({ initialRegion, showsUserLocation, markers, polylines }) {
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
  html,body,#map { width:100%; height:100%; background:#1a1a1a; }
  .leaflet-control-zoom,.leaflet-control-attribution { display:none; }
  .osm-dot {
    width:14px; height:14px; border-radius:50%;
    border:2px solid rgba(255,255,255,0.8);
    box-shadow:0 2px 8px rgba(0,0,0,0.6);
  }
  .user-dot {
    width:12px; height:12px; border-radius:50%;
    background:#4285F4; border:3px solid white;
    animation:pulse 2s infinite;
  }
  @keyframes pulse {
    0%   { box-shadow:0 0 0 0   rgba(66,133,244,0.6); }
    70%  { box-shadow:0 0 0 10px rgba(66,133,244,0);   }
    100% { box-shadow:0 0 0 0   rgba(66,133,244,0);    }
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var map = L.map('map',{
    center:[${lat},${lng}], zoom:${zoom},
    zoomControl:false, attributionControl:false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    maxZoom:19, subdomains:'abcd',
  }).addTo(map);

  function dotIcon(color){
    return L.divIcon({
      html:'<div class="osm-dot" style="background:'+color+'"></div>',
      iconSize:[14,14], iconAnchor:[7,7], className:'',
    });
  }

  var markerData = ${JSON.stringify(markers)};
  markerData.forEach(function(m){
    var mk = L.marker([m.lat,m.lng],{icon:dotIcon(m.color)}).addTo(map);
    if(m.title) mk.bindTooltip(m.title);
  });

  var polylineData = ${JSON.stringify(polylines)};
  polylineData.forEach(function(p){
    L.polyline(p.coords,{
      color:p.color, weight:p.weight,
      dashArray:p.dashed?'8,5':null, opacity:0.9,
    }).addTo(map);
  });

  ${showsUserLocation ? `
  if(navigator.geolocation){
    var userIcon=L.divIcon({html:'<div class="user-dot"></div>',iconSize:[12,12],iconAnchor:[6,6],className:''});
    var uMk=null;
    navigator.geolocation.watchPosition(function(pos){
      var ll=[pos.coords.latitude,pos.coords.longitude];
      if(!uMk){ uMk=L.marker(ll,{icon:userIcon,zIndexOffset:1000}).addTo(map); }
      else { uMk.setLatLng(ll); }
    },null,{enableHighAccuracy:true,timeout:10000});
  }` : ''}

  function postMsg(type){
    var c=map.getCenter(), b=map.getBounds();
    var msg=JSON.stringify({type:type,region:{
      latitude:c.lat, longitude:c.lng,
      latitudeDelta:b.getNorth()-b.getSouth(),
      longitudeDelta:b.getEast()-b.getWest(),
    }});
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    try{ window.parent.postMessage(msg,'*'); }catch(e){}
  }

  var moveTimer=null;
  map.on('move',function(){ clearTimeout(moveTimer); postMsg('regionChange'); });
  map.on('moveend',function(){
    clearTimeout(moveTimer);
    moveTimer=setTimeout(function(){ postMsg('regionChangeComplete'); },80);
  });

  window.osmCmd=function(json){
    var cmd=JSON.parse(json);
    if(cmd.type==='flyTo'){
      map.flyTo([cmd.lat,cmd.lng],cmd.zoom||map.getZoom(),{duration:(cmd.duration||500)/1000});
    }
    if(cmd.type==='fitBounds'){
      map.fitBounds(cmd.bounds,{
        paddingTopLeft:[cmd.padLeft||60,cmd.padTop||80],
        paddingBottomRight:[cmd.padRight||60,cmd.padBottom||80],
        animate:true,
      });
    }
  };

  setTimeout(function(){
    var msg=JSON.stringify({type:'ready'});
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    try{ window.parent.postMessage(msg,'*'); }catch(e){}
  },400);
})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Web renderer — <iframe srcdoc>, no WebView dependency
// ─────────────────────────────────────────────────────────────────────────────
const WebMapView = forwardRef(function WebMapView(
  { style, initialRegion, showsUserLocation, onMapReady,
    onRegionChange, onRegionChangeComplete, children },
  ref
) {
  const iframeRef = useRef(null);
  const { markers, polylines } = useMemo(() => collectDescriptors(children), [children]);

  const html = useMemo(
    () => buildHTML({ initialRegion, showsUserLocation, markers, polylines }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initialRegion?.latitude, initialRegion?.longitude, initialRegion?.latitudeDelta,
      JSON.stringify(markers), JSON.stringify(polylines), showsUserLocation,
    ]
  );

  useEffect(() => {
    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ready')                onMapReady?.();
        if (msg.type === 'regionChange')         onRegionChange?.(msg.region);
        if (msg.type === 'regionChangeComplete') onRegionChangeComplete?.(msg.region);
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMapReady, onRegionChange, onRegionChangeComplete]);

  useImperativeHandle(ref, () => ({
    animateToRegion(region, duration = 500) {
      const zoom = Math.max(10, Math.min(18, Math.round(Math.log2(360 / (region.longitudeDelta ?? 0.012))) + 1));
      const cmd  = JSON.stringify({ type: 'flyTo', lat: region.latitude, lng: region.longitude, zoom, duration });
      try { iframeRef.current?.contentWindow?.osmCmd?.(cmd); } catch {}
    },
    fitToCoordinates(coords, { edgePadding = {} } = {}) {
      if (!coords?.length) return;
      const lats   = coords.map((c) => c.latitude);
      const lngs   = coords.map((c) => c.longitude);
      const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
      const cmd    = JSON.stringify({
        type: 'fitBounds', bounds,
        padTop: edgePadding.top ?? 80,    padRight:  edgePadding.right  ?? 60,
        padBottom: edgePadding.bottom ?? 80, padLeft: edgePadding.left   ?? 60,
      });
      try { iframeRef.current?.contentWindow?.osmCmd?.(cmd); } catch {}
    },
  }));

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

// Web styles as plain objects (no StyleSheet on web for iframe)
const webStyles = {
  container: { overflow: 'hidden', flex: 1 },
  iframe: { width: '100%', height: '100%', border: 'none', display: 'block' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Native renderer — react-native-webview
// ─────────────────────────────────────────────────────────────────────────────
const NativeMapView = forwardRef(function NativeMapView(
  { style, initialRegion, showsUserLocation, onMapReady,
    onRegionChange, onRegionChangeComplete, children },
  ref
) {
  const webViewRef = useRef(null);
  const { markers, polylines } = useMemo(() => collectDescriptors(children), [children]);

  const html = useMemo(
    () => buildHTML({ initialRegion, showsUserLocation, markers, polylines }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initialRegion?.latitude, initialRegion?.longitude, initialRegion?.latitudeDelta,
      JSON.stringify(markers), JSON.stringify(polylines), showsUserLocation,
    ]
  );

  useImperativeHandle(ref, () => ({
    animateToRegion(region, duration = 500) {
      const zoom = Math.max(10, Math.min(18, Math.round(Math.log2(360 / (region.longitudeDelta ?? 0.012))) + 1));
      const cmd  = JSON.stringify({ type: 'flyTo', lat: region.latitude, lng: region.longitude, zoom, duration });
      webViewRef.current?.injectJavaScript(`window.osmCmd(${JSON.stringify(cmd)});true;`);
    },
    fitToCoordinates(coords, { edgePadding = {} } = {}) {
      if (!coords?.length) return;
      const lats   = coords.map((c) => c.latitude);
      const lngs   = coords.map((c) => c.longitude);
      const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
      const cmd    = JSON.stringify({
        type: 'fitBounds', bounds,
        padTop: edgePadding.top ?? 80,    padRight:  edgePadding.right  ?? 60,
        padBottom: edgePadding.bottom ?? 80, padLeft: edgePadding.left   ?? 60,
      });
      webViewRef.current?.injectJavaScript(`window.osmCmd(${JSON.stringify(cmd)});true;`);
    },
  }));

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready')                onMapReady?.();
      if (msg.type === 'regionChange')         onRegionChange?.(msg.region);
      if (msg.type === 'regionChangeComplete') onRegionChangeComplete?.(msg.region);
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
  placeholder: { backgroundColor: '#1a1a1a' },
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
// Marker & Polyline — declarative, read by OsmMapView via displayName
// ─────────────────────────────────────────────────────────────────────────────
function OsmMarker()   { return null; }
OsmMarker.displayName  = 'OsmMarker';

function OsmPolyline()  { return null; }
OsmPolyline.displayName = 'OsmPolyline';

export const PROVIDER_GOOGLE  = 'google';
export const PROVIDER_DEFAULT = 'default';
export { OsmMarker as Marker, OsmPolyline as Polyline };
export default OsmMapView;