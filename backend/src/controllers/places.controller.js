// backend/src/controllers/places.controller.js

const axios = require('axios');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { normalise } = require('../utils/countryGeo');
const { getMapCenterForCountry } = require('../services/country.service');

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const PHOTON_URL = 'https://photon.komoot.io/api/';

// Search bias radius. Google caps circle radius at 50 km.
// The bias CENTRE is the app-supplied pickup coordinates; if those are missing
// we fall back to the centre of the user's own country (see utils/countryGeo),
// never to a hard-coded city.
const DEFAULT_RADIUS_METERS = 50000;

const GOOGLE_TIMEOUT_MS = 4000; // fail fast so the fallback still feels instant to the user
const PHOTON_TIMEOUT_MS = 5000;

const isGoogleConfigured = () => !!PLACES_API_KEY;

// ─────────────────────────────────────────────────────────────────────────
// Photon fallback — same source your app used before this integration.
// Returns suggestions with embedded coordinates since Photon has no
// separate "details" endpoint / session concept.
// ─────────────────────────────────────────────────────────────────────────
const autocompleteViaPhoton = async (input, lat, lng, countryCode, countryCenter) => {
  const center = lat != null && lng != null ? { lat, lng } : countryCenter;
  const bias = center ? `&lat=${center.lat}&lon=${center.lng}` : '';
  const url = `${PHOTON_URL}?q=${encodeURIComponent(input)}&limit=8&lang=en${bias}`;

  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'DiakiteApp/1.0' },
    timeout: PHOTON_TIMEOUT_MS,
  });

  return (data.features ?? [])
    // Photon can't be restricted to a country in the request, so filter here.
    // Features without a countrycode are kept rather than silently dropped.
    .filter((f) => !countryCode || !f.properties?.countrycode
      || f.properties.countrycode.toUpperCase() === countryCode)
    .map((f) => ({
    provider: 'photon',
    placeId: `photon_${f.geometry.coordinates[0]}_${f.geometry.coordinates[1]}`,
    description: [f.properties.name, f.properties.street, f.properties.city, f.properties.state, f.properties.country]
      .filter(Boolean).join(', '),
    mainText: f.properties.name ?? f.properties.street ?? '',
    secondaryText: [f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(', '),
    // Photon has no Place Details step — coordinates travel with the suggestion.
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
};

// ─────────────────────────────────────────────────────────────────────────
// Google Autocomplete (New) — billed $0 when the session is later closed
// with a Place Details call using the same sessionToken.
// ─────────────────────────────────────────────────────────────────────────
// Pure + exported for tests. The market comes from the authenticated user's
// country (req.user.countryCode) — NOT a constant. It used to be hard-coded to
// ['ng'], which made Google return only Nigerian places (or nothing) for users
// in Mali, Senegal, Côte d'Ivoire, etc.
const buildGoogleAutocompleteBody = ({ input, sessionToken, lat, lng, radiusMeters, countryCode, countryCenter }) => {
  const body = { input, sessionToken };

  const region = normalise(countryCode);
  if (region) body.includedRegionCodes = [region.toLowerCase()];

  const hasCoords = lat != null && lng != null && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng));
  const center = hasCoords
    ? { latitude: parseFloat(lat), longitude: parseFloat(lng) }
    : (countryCenter ? { latitude: countryCenter.lat, longitude: countryCenter.lng } : null);

  // No coordinates and unknown country → send no bias at all rather than
  // biasing to the wrong city.
  if (center) {
    body.locationBias = {
      circle: {
        center,
        radius: radiusMeters != null ? Math.min(parseFloat(radiusMeters), DEFAULT_RADIUS_METERS) : DEFAULT_RADIUS_METERS,
      },
    };
  }
  return body;
};

const autocompleteViaGoogle = async (input, sessionToken, lat, lng, radiusMeters, countryCode, countryCenter) => {
  const body = buildGoogleAutocompleteBody({ input, sessionToken, lat, lng, radiusMeters, countryCode, countryCenter });

  const { data } = await axios.post(AUTOCOMPLETE_URL, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    timeout: GOOGLE_TIMEOUT_MS,
  });

  return (data.suggestions ?? [])
    .filter((s) => s.placePrediction)
    .map((s) => ({
      provider: 'google',
      placeId: s.placePrediction.placeId,
      description: s.placePrediction.text?.text ?? '',
      mainText: s.placePrediction.structuredFormat?.mainText?.text ?? '',
      secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
    }));
};

exports.autocomplete = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { input, sessionToken, lat, lng, radiusMeters } = req.body;
  if (!input || input.trim().length < 2) {
    return res.status(200).json({ success: true, data: { suggestions: [], provider: null } });
  }
  if (!sessionToken) throw new AppError('sessionToken is required', 400);

  const trimmed = input.trim();
  const countryCode = normalise(req.user?.countryCode) || null;
  // Admin-editable centre from the Country row; only needed when the app sent no GPS.
  const countryCenter = (lat == null || lng == null) ? await getMapCenterForCountry(countryCode) : null;

  // ── Try Google first (if configured) ──────────────────────────────────
  if (isGoogleConfigured()) {
    try {
      const suggestions = await autocompleteViaGoogle(trimmed, sessionToken, lat, lng, radiusMeters, countryCode, countryCenter);
      return res.status(200).json({ success: true, data: { suggestions, provider: 'google' } });
    } catch (err) {
      logger.error('[places.controller] Google autocomplete failed, falling back to Photon:', err.response?.data ?? err.message);
      // fall through to Photon below
    }
  } else {
    logger.error('[places.controller] GOOGLE_PLACES_API_KEY not set — using Photon fallback');
  }

  // ── Fallback: Photon ───────────────────────────────────────────────────
  try {
    const suggestions = await autocompleteViaPhoton(trimmed, lat, lng, countryCode, countryCenter);
    return res.status(200).json({ success: true, data: { suggestions, provider: 'photon' } });
  } catch (err) {
    logger.error('[places.controller] Photon fallback also failed:', err.message);
    // Both providers down — fail soft with an empty list so the UI can
    // still offer "pin on map" instead of a hard error mid-keystroke.
    return res.status(200).json({ success: true, data: { suggestions: [], provider: null } });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PLACE DETAILS — the billable call. Only ever called for provider==='google'
// suggestions; Photon suggestions carry their coordinates already and never
// reach this endpoint. Field mask stays at Essentials-tier fields only.
// ─────────────────────────────────────────────────────────────────────────
exports.placeDetails = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  if (!isGoogleConfigured()) throw new AppError('Address lookup is not configured on the server', 503);

  const { placeId, sessionToken } = req.body;
  if (!placeId) throw new AppError('placeId is required', 400);
  if (!sessionToken) throw new AppError('sessionToken is required', 400);
  if (placeId.startsWith('photon_')) {
    // Defensive guard: this indicates a client-side bug — Photon results
    // should never trigger a details call, their coords already travel
    // with the autocomplete response.
    throw new AppError('This suggestion does not require a details lookup', 400);
  }

  try {
    const { data } = await axios.get(`${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      params: { sessionToken },
      headers: {
        'X-Goog-Api-Key': PLACES_API_KEY,
        // Essentials tier only — DO NOT add fields like rating, photos,
        // openingHours here, it silently upgrades the SKU to Pro/Enterprise.
        'X-Goog-FieldMask': 'formattedAddress,location,displayName',
      },
      timeout: GOOGLE_TIMEOUT_MS,
    });

    if (!data.location) throw new AppError('Place not found', 404);

    res.status(200).json({
      success: true,
      data: {
        lat: data.location.latitude,
        lng: data.location.longitude,
        formattedAddress: data.formattedAddress ?? data.displayName?.text ?? '',
        name: data.displayName?.text ?? null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('[places.controller] placeDetails failed:', err.response?.data ?? err.message);
    throw new AppError('Could not resolve that address. Please try again or pin it on the map.', 502);
  }
};

exports._test = { buildGoogleAutocompleteBody };

module.exports = exports;