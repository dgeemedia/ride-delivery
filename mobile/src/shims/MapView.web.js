// src/shims/MapView.web.js
// Web shim for react-native-maps — expo web bundler resolves this instead of
// the native package (which has no web support). All components are no-ops
// that render nothing, so the screen still mounts on web without crashing.

import React from 'react';
import { View } from 'react-native';

const Noop = () => null;

const MapView = React.forwardRef((props, ref) => (
  <View ref={ref} style={[{ backgroundColor: '#1a1a1a' }, props.style]} />
));

MapView.displayName = 'MapView';

export default MapView;
export const Marker        = Noop;
export const Polyline      = Noop;
export const PROVIDER_GOOGLE = 'google';
export const Callout        = Noop;
export const Circle         = Noop;
export const Polygon        = Noop;