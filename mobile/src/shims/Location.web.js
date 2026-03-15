// mobile/src/shims/Location.web.js
//
// Web shim for expo-location.
// Uses the real browser Geolocation API instead of hardcoded Lagos coords.
// Falls back gracefully if the user denies permission.

export const Accuracy = {
  Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6,
};

// ─── Permission ───────────────────────────────────────────────────────────────
export const requestForegroundPermissionsAsync = async () => {
  if (!navigator?.geolocation) return { status: 'denied' };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ status: 'granted' }),
      () => resolve({ status: 'denied' }),
      { timeout: 5000 }
    );
  });
};

export const requestBackgroundPermissionsAsync = async () =>
  requestForegroundPermissionsAsync();

// ─── Current position ─────────────────────────────────────────────────────────
export const getCurrentPositionAsync = async (_opts) => {
  if (!navigator?.geolocation) {
    throw new Error('Geolocation is not supported by this browser.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        coords: {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude:  pos.coords.altitude   ?? 0,
          accuracy:  pos.coords.accuracy   ?? 10,
          heading:   pos.coords.heading    ?? 0,
          speed:     pos.coords.speed      ?? 0,
        },
        timestamp: pos.timestamp,
      }),
      (err) => reject(new Error(`Location error: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
};

// ─── Watch position ───────────────────────────────────────────────────────────
export const watchPositionAsync = async (_opts, callback) => {
  if (!navigator?.geolocation) return { remove: () => {} };
  const id = navigator.geolocation.watchPosition(
    (pos) => callback({
      coords: {
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude:  pos.coords.altitude  ?? 0,
        accuracy:  pos.coords.accuracy  ?? 10,
        heading:   pos.coords.heading   ?? 0,
        speed:     pos.coords.speed     ?? 0,
      },
      timestamp: pos.timestamp,
    }),
    (err) => console.warn('[Location.web] watchPosition error:', err.message),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
  return { remove: () => navigator.geolocation.clearWatch(id) };
};

// ─── Geocoding ────────────────────────────────────────────────────────────────
// Uses OpenStreetMap Nominatim (free, no API key needed for dev)
export const geocodeAsync = async (address) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data?.[0]) {
      return [{ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }];
    }
  } catch (e) {
    console.warn('[Location.web] geocodeAsync error:', e.message);
  }
  return [];
};

export const reverseGeocodeAsync = async ({ latitude, longitude }) => {
  try {
    const url  = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data?.address) {
      const a = data.address;
      return [{
        name:     a.amenity ?? a.building ?? a.road ?? '',
        street:   a.road ?? '',
        district: a.suburb ?? a.neighbourhood ?? a.city_district ?? '',
        city:     a.city ?? a.town ?? a.village ?? '',
        region:   a.state ?? '',
        country:  a.country ?? '',
      }];
    }
  } catch (e) {
    console.warn('[Location.web] reverseGeocodeAsync error:', e.message);
  }
  return [];
};

export default {
  Accuracy,
  requestForegroundPermissionsAsync,
  requestBackgroundPermissionsAsync,
  getCurrentPositionAsync,
  watchPositionAsync,
  geocodeAsync,
  reverseGeocodeAsync,
};