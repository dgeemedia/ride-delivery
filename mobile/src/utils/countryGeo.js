// mobile/src/utils/countryGeo.js
//
// Per-country fallback map centres. Real GPS always wins — these are used only
// while GPS is pending, denied, or unavailable, so a driver in Bamako never
// sees a map of Lagos. Keep in sync with backend/src/utils/countryGeo.js.

import { useMemo } from 'react';
import { useCountryConfig } from '../context/CountryConfigContext';

export const COUNTRY_CENTERS = {
  NG: { city: 'Lagos',          lat: 6.5244,   lng: 3.3792 },
  GH: { city: 'Accra',          lat: 5.6037,   lng: -0.1870 },
  GM: { city: 'Banjul',         lat: 13.4549,  lng: -16.5790 },
  CV: { city: 'Praia',          lat: 14.9330,  lng: -23.5133 },
  TG: { city: 'Lom\u00e9',       lat: 6.1725,   lng: 1.2314 },
  BJ: { city: 'Cotonou',        lat: 6.3703,   lng: 2.3912 },
  CI: { city: 'Abidjan',        lat: 5.3600,   lng: -4.0083 },
  SN: { city: 'Dakar',          lat: 14.7167,  lng: -17.4677 },
  ML: { city: 'Bamako',         lat: 12.6392,  lng: -8.0029 },
  BF: { city: 'Ouagadougou',    lat: 12.3714,  lng: -1.5197 },
  NE: { city: 'Niamey',         lat: 13.5116,  lng: 2.1254 },
  GN: { city: 'Conakry',        lat: 9.6412,   lng: -13.5784 },
  GW: { city: 'Bissau',         lat: 11.8636,  lng: -15.5977 },
  SL: { city: 'Freetown',       lat: 8.4657,   lng: -13.2317 },
  CM: { city: 'Yaound\u00e9',    lat: 3.8480,   lng: 11.5021 },
  MG: { city: 'Antananarivo',   lat: -18.8792, lng: 47.5079 },
  BW: { city: 'Gaborone',       lat: -24.6282, lng: 25.9231 },
  CD: { city: 'Kinshasa',       lat: -4.4419,  lng: 15.2663 },
  CF: { city: 'Bangui',         lat: 4.3947,   lng: 18.5582 },
  LR: { city: 'Monrovia',       lat: 6.3156,   lng: -10.8074 },
};

// Last resort only — same fallback the backend uses for an unknown country.
const FALLBACK_CENTER = COUNTRY_CENTERS.NG;

const validCenter = (c) =>
  c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))
    ? { lat: Number(c.lat), lng: Number(c.lng), city: c.city ?? '' }
    : null;

/**
 * Where this country's maps open until GPS answers. Order:
 *  1. the centre the server sent in the country config (admin-editable, so a
 *     country added later works with no app update),
 *  2. the built-in table for the seeded markets,
 *  3. a fixed last resort.
 */
export const getCountryCenter = (code, serverCenter) =>
  validCenter(serverCenter)
  ?? COUNTRY_CENTERS[String(code ?? '').trim().toUpperCase()]
  ?? FALLBACK_CENTER;

export const regionAround = (center, delta = 0.05) => ({
  latitude: center.lat,
  longitude: center.lng,
  latitudeDelta: delta,
  longitudeDelta: delta,
});

// A "sample" drop-off ~11 km from the pickup (same offset the app used to get
// from Lagos Island to Victoria Island), so fare previews work in any country
// instead of pairing a Malian pickup with a hard-coded Lagos drop-off.
export const sampleDropoffFrom = (lat, lng) => ({ lat: lat - 0.0963, lng: lng + 0.0427 });

/** { city, lat, lng } for the signed-in user's country. */
export const useCountryCenter = () => {
  const { config } = useCountryConfig();
  const c = config?.mapCenter;
  return useMemo(
    () => getCountryCenter(config?.countryCode, c),
    [config?.countryCode, c?.lat, c?.lng, c?.city]
  );
};
