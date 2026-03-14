// src/shims/MapView.js
// Native (iOS / Android) — re-exports the real react-native-maps package.
// The web bundler ignores this and picks MapView.web.js instead.
export { default, Marker, Polyline, Callout, Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';