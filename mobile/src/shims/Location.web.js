// src/shims/Location.web.js
// Web stub for expo-location — returns sensible Lagos defaults so the
// screen mounts on web without crashing. Real GPS is native-only.

export const Accuracy = {
  Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6,
};

export const requestForegroundPermissionsAsync = async () => ({ status: 'granted' });
export const requestBackgroundPermissionsAsync = async () => ({ status: 'granted' });

export const getCurrentPositionAsync = async () => ({
  coords: { latitude: 6.5244, longitude: 3.3792, altitude: 0, accuracy: 10, heading: 0, speed: 0 },
  timestamp: Date.now(),
});

export const geocodeAsync = async (address) => {
  // Return a Lagos-area coordinate for any address on web (demo only)
  return [{ latitude: 6.5244 + (Math.random() - 0.5) * 0.05, longitude: 3.3792 + (Math.random() - 0.5) * 0.05 }];
};

export const reverseGeocodeAsync = async () => ([
  { name: 'Lagos', street: 'Broad Street', district: 'Lagos Island', city: 'Lagos', country: 'Nigeria' },
]);

export const watchPositionAsync = async (_opts, _cb) => ({ remove: () => {} });

export default {
  Accuracy,
  requestForegroundPermissionsAsync,
  requestBackgroundPermissionsAsync,
  getCurrentPositionAsync,
  geocodeAsync,
  reverseGeocodeAsync,
  watchPositionAsync,
};