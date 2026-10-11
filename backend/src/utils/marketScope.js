// backend/src/utils/marketScope.js
// Country ("market") scoping for the admin panel: drivers, partners, rides, deliveries and
// their approvals. A staff member with NO assigned countries sees everything (so existing
// admins keep working); one with countries assigned only sees/approves those markets.
// SUPER_ADMIN is never restricted. Rides/deliveries belong to the market of their customer.
'use strict';

const up = (v) => String(v ?? '').trim().toUpperCase();

/** A valid ISO alpha-2 code from a query param, else undefined. */
const countryParam = (v) => {
  const c = up(v);
  return /^[A-Z]{2}$/.test(c) ? c : undefined;
};

/** Countries this staff member is limited to ([] = unrestricted). */
const staffMarkets = (user) => {
  if (!user || user.role === 'SUPER_ADMIN') return [];
  const list = Array.isArray(user.supportCountries) ? user.supportCountries : [];
  return [...new Set(list.map(up).filter(Boolean))];
};

/**
 * Prisma `where` fragment for a User relation (user / customer): { countryCode: ... }
 * or undefined when nothing needs filtering. A requested country outside the staff
 * member's markets yields an empty result rather than leaking data.
 */
const marketWhere = (user, requested) => {
  const want = countryParam(requested);
  const mine = staffMarkets(user);
  if (mine.length === 0) return want ? { countryCode: want } : undefined;
  if (want) return mine.includes(want) ? { countryCode: want } : { countryCode: { in: [] } };
  return { countryCode: { in: mine } };
};

/** Only the staff member's own scope (ignores any requested country) — for per-country counts. */
const scopeOnlyWhere = (user) => {
  const mine = staffMarkets(user);
  return mine.length ? { countryCode: { in: mine } } : undefined;
};

const canActInMarket = (user, countryCode) => {
  const mine = staffMarkets(user);
  return mine.length === 0 || mine.includes(up(countryCode));
};

/** Tally rows like [{ user: { countryCode } }] into { NG: 3, ML: 2 }. */
const tallyByCountry = (rows, pick = (r) => r.user?.countryCode) => {
  const out = {};
  for (const r of rows) { const c = up(pick(r)) || 'NG'; out[c] = (out[c] || 0) + 1; }
  return out;
};

/**
 * Full authority over a country: a Super Admin anywhere, or an ADMIN who has been assigned
 * countries (they are then confined to those countries by marketGuard). An ADMIN with no
 * assigned countries is NOT elevated by this.
 */
const hasCountryAuthority = (user) =>
  !!user && (user.role === 'SUPER_ADMIN' || (user.role === 'ADMIN' && staffMarkets(user).length > 0));

/**
 * May `actor` manage this staff account? Super Admin always. A country admin only staff whose
 * assigned countries are all among the actor's own (never a Super Admin, never an all-country
 * account).
 */
const staffInsideMarkets = (actor, target) => {
  if (!actor) return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  const mine = staffMarkets(actor);
  if (!mine.length || !target || target.role === 'SUPER_ADMIN') return false;
  const theirs = (Array.isArray(target.supportCountries) ? target.supportCountries : []).map(up).filter(Boolean);
  return theirs.length > 0 && theirs.every((c) => mine.includes(c));
};

module.exports = { countryParam, staffMarkets, marketWhere, scopeOnlyWhere, canActInMarket, tallyByCountry, hasCountryAuthority, staffInsideMarkets };
