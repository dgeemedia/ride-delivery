// src/shims/MapView.js
// Native (iOS / Android) — simply re-exports the real package.
// The web bundler ignores this file and picks MapView.web.js instead.
export { default, Marker, Polyline, Callout, Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';