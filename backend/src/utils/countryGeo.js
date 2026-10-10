// backend/src/utils/countryGeo.js
//
// Fallback map centres per supported country (ISO 3166-1 alpha-2).
//
// These are ONLY used when the client did not send real coordinates (GPS
// denied / not ready yet). They keep address search biased to the user's own
// market instead of silently defaulting to Lagos. Keep in sync with
// mobile/src/utils/countryGeo.js and prisma/seeds/countries.js.

const COUNTRY_CENTERS = {
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

const normalise = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '');

/** Returns { city, lat, lng } or null when the country is unknown. */
const getCountryCenter = (code) => COUNTRY_CENTERS[normalise(code)] ?? null;

module.exports = { COUNTRY_CENTERS, getCountryCenter, normalise };
