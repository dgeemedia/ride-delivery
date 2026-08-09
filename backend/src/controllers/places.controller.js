// backend/src/controllers/places.controller.js
//
// Proxies Google Places API (New) so the mobile app never holds the real
// API key. Autocomplete keystrokes are billed $0 as long as they're linked
// to a Place Details call via the SAME session token — see:
// https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
//
// Falls back to Photon (Komoot's free OSM geocoder — same one the app used
// before this integration) if Google is unreachable, times out, or errors.
// Photon suggestions carry lat/lng directly, so the mobile app skips the
// Place Details call entirely for those — there's nothing to look up.
//
// Flow:
//   1. Mobile generates a sessionToken when the user opens a search field.
//   2. Every keystroke -> POST /places/autocomplete { input, sessionToken }
//      -> tries Google; on failure, falls back to Photon automatically.
//   3. User taps a suggestion:
//      - provider === 'google' -> POST /places/details { placeId, sessionToken }
//        (this is the ONLY call that costs money, and it closes the session)
//      - provider === 'photon' -> lat/lng already included, no extra call
//   4. Mobile generates a NEW sessionToken before the next search.

const axios = require('axios');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const PHOTON_URL = 'https://photon.komoot.io/api/';

// Default bias — Lagos metro area. Overridden per-request when the app
// sends the user's current pickup coordinates.
const DEFAULT_BIAS = { lat: 6.5244, lng: 3.3792, radiusMeters: 50000 };

const GOOGLE_TIMEOUT_MS = 4000; // fail fast so the fallback still feels instant to the user
const PHOTON_TIMEOUT_MS = 5000;

const isGoogleConfigured = () => !!PLACES_API_KEY;

// ─────────────────────────────────────────────────────────────────────────
// Photon fallback — same source your app used before this integration.
// Returns suggestions with embedded coordinates since Photon has no
// separate "details" endpoint / session concept.
// ─────────────────────────────────────────────────────────────────────────
const autocompleteViaPhoton = async (input, lat, lng) => {
  const bias = lat != null && lng != null ? `&lat=${lat}&lon=${lng}` : '';
  const url = `${PHOTON_URL}?q=${encodeURIComponent(input)}&limit=8&lang=en${bias}`;

  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'DiakiteApp/1.0' },
    timeout: PHOTON_TIMEOUT_MS,
  });

  return (data.features ?? []).map((f) => ({
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
const autocompleteViaGoogle = async (input, sessionToken, lat, lng, radiusMeters) => {
  const body = {
    input,
    sessionToken,
    includedRegionCodes: ['ng'],
    locationBias: {
      circle: {
        center: {
          latitude: lat != null ? parseFloat(lat) : DEFAULT_BIAS.lat,
          longitude: lng != null ? parseFloat(lng) : DEFAULT_BIAS.lng,
        },
        radius: radiusMeters != null ? parseFloat(radiusMeters) : DEFAULT_BIAS.radiusMeters,
      },
    },
  };

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

  // ── Try Google first (if configured) ──────────────────────────────────
  if (isGoogleConfigured()) {
    try {
      const suggestions = await autocompleteViaGoogle(trimmed, sessionToken, lat, lng, radiusMeters);
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
    const suggestions = await autocompleteViaPhoton(trimmed, lat, lng);
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

module.exports = exports;