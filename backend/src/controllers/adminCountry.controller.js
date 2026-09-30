// backend/src/controllers/adminCountry.controller.js
//
// Country administration. This is the switchboard an admin uses to run a
// market end-to-end: turn a country on or off, choose which payment
// providers and credit methods it offers, choose how drivers get paid out,
// set its default app language, and see every request (rides, deliveries,
// payouts, top-ups) originating from it.
//
// Nothing here writes provider SECRETS in plaintext to the client: the
// `providerConfig` blob can hold per-market Orange merchant keys, so
// responses redact anything that looks like a secret before sending.

'use strict';

const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/auditLog');
const {
  ALL_CREDIT_METHODS,
  ALL_PAYOUT_METHODS,
  METHOD_PROVIDER,
  normalizeCountry,
  invalidateCountryCache,
} = require('../services/country.service');
const orangeService = require('../services/orange.service');
const countrySettings = require('../services/countrySettings.service');

const KNOWN_PROVIDERS = ['paystack', 'flutterwave', 'orange'];

// Keys inside providerConfig.<provider> that must never leave the server.
const SECRET_KEYS = ['merchantKey', 'clientSecret', 'secretKey', 'apiKey', 'pin', 'b2cPin'];

const redactProviderConfig = (config) => {
  if (!config || typeof config !== 'object') return {};
  const out = {};
  for (const [provider, block] of Object.entries(config)) {
    if (!block || typeof block !== 'object') { out[provider] = block; continue; }
    out[provider] = Object.fromEntries(
      Object.entries(block).map(([k, v]) =>
        SECRET_KEYS.includes(k) && v ? [k, `••••${String(v).slice(-4)}`] : [k, v]
      )
    );
  }
  return out;
};

const present = (row) => {
  const c = normalizeCountry(row);
  return { ...c, providerConfig: redactProviderConfig(c.providerConfig) };
};

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

/**
 * A country's declared providers and its credit methods have to agree, or
 * the mobile app will render a payment button that can't settle. Reject the
 * mismatch at write time rather than letting a customer discover it at
 * checkout.
 */
const validateCountryPayload = (payload) => {
  const { paymentProviders, creditMethods, payoutMethods } = payload;

  if (paymentProviders !== undefined) {
    if (!Array.isArray(paymentProviders) || paymentProviders.length === 0) {
      throw new AppError('paymentProviders must be a non-empty array', 400);
    }
    const unknown = paymentProviders.filter(p => !KNOWN_PROVIDERS.includes(p));
    if (unknown.length) throw new AppError(`Unknown payment provider(s): ${unknown.join(', ')}`, 400);
  }

  if (creditMethods !== undefined) {
    if (!Array.isArray(creditMethods) || creditMethods.length === 0) {
      throw new AppError('creditMethods must be a non-empty array', 400);
    }
    const unknown = creditMethods.filter(m => !ALL_CREDIT_METHODS.includes(m));
    if (unknown.length) throw new AppError(`Unknown credit method(s): ${unknown.join(', ')}`, 400);

    // Every provider-backed method must have its provider enabled.
    const providers = paymentProviders ?? [];
    if (providers.length) {
      const orphan = creditMethods.filter(m => {
        const needed = METHOD_PROVIDER[m];
        return needed && !providers.includes(needed);
      });
      if (orphan.length) {
        throw new AppError(
          `${orphan.join(', ')} require(s) a provider that isn't enabled for this country. Add the provider first.`,
          400
        );
      }
    }
  }

  if (payoutMethods !== undefined) {
    if (!Array.isArray(payoutMethods) || payoutMethods.length === 0) {
      throw new AppError('payoutMethods must be a non-empty array', 400);
    }
    const unknown = payoutMethods.filter(m => !ALL_PAYOUT_METHODS.includes(m));
    if (unknown.length) throw new AppError(`Unknown payout method(s): ${unknown.join(', ')}`, 400);
  }
};

// Merge, rather than overwrite, providerConfig — so an admin editing the
// Orange language doesn't wipe a merchant key they can't see in the UI.
const mergeProviderConfig = (existing = {}, incoming = {}) => {
  const out = { ...(existing || {}) };
  for (const [provider, block] of Object.entries(incoming || {})) {
    const prev = out[provider] || {};
    const next = { ...prev };
    for (const [k, v] of Object.entries(block || {})) {
      // A redacted value coming back from the UI means "unchanged" — never
      // persist the masked string over the real secret.
      if (typeof v === 'string' && v.startsWith('••••')) continue;
      next[k] = v;
    }
    out[provider] = next;
  }
  return out;
};

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

// GET /api/admin/countries
exports.listCountries = async (req, res) => {
  const rows = await prisma.country.findMany({ orderBy: { name: 'asc' } });

  // Attach live user counts so an admin can see which markets actually have
  // traffic before toggling one off.
  const counts = await prisma.user.groupBy({
    by: ['countryCode'],
    _count: { _all: true },
  });
  const byCode = Object.fromEntries(counts.map(c => [c.countryCode, c._count._all]));

  const reviewedRows = await prisma.countrySetting.findMany({ where: { key: 'pricing_reviewed' }, select: { countryCode: true, value: true } });
  const reviewed = new Set(reviewedRows.filter(r => r.value === true).map(r => r.countryCode));

  res.status(200).json({
    success: true,
    data: {
      countries: rows.map(r => ({
        ...present(r),
        userCount: byCode[r.code] ?? 0,
        // Nigeria (base currency) has always been priced from the global
        // settings; every other market must have been reviewed by an admin.
        pricingReviewed: r.currencyCode === countrySettings.BASE_CURRENCY || reviewed.has(r.code),
      })),
      meta: {
        creditMethods:  ALL_CREDIT_METHODS,
        payoutMethods:  ALL_PAYOUT_METHODS,
        providers:      KNOWN_PROVIDERS,
        methodProvider: METHOD_PROVIDER,
        // The UI greys out Orange options and explains why when this is
        // false, instead of letting an admin enable a rail that 503s.
        orangeConfigured: orangeService.isOrangeConfigured(),
        orangeB2CEnabled: orangeService.isB2CEnabled(),
        orangeMarkets:    orangeService.ORANGE_MARKETS,
      },
    },
  });
};

// GET /api/admin/countries/:code
exports.getCountry = async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const row = await prisma.country.findUnique({ where: { code } });
  if (!row) throw new AppError('Country not found', 404);
  res.status(200).json({ success: true, data: { country: present(row) } });
};

// POST /api/admin/countries
exports.createCountry = async (req, res) => {
  const payload = { ...req.body, code: String(req.body.code || '').toUpperCase() };

  if (!/^[A-Z]{2}$/.test(payload.code)) throw new AppError('code must be a 2-letter ISO country code', 400);
  for (const field of ['name', 'currencyCode', 'currencySymbol', 'phoneDialCode']) {
    if (!payload[field]) throw new AppError(`${field} is required`, 400);
  }

  validateCountryPayload(payload);

  const existing = await prisma.country.findUnique({ where: { code: payload.code } });
  if (existing) throw new AppError(`${payload.code} already exists — edit it instead.`, 409);

  const country = await prisma.country.create({
    data: {
      code:             payload.code,
      name:             payload.name,
      currencyCode:     payload.currencyCode,
      currencySymbol:   payload.currencySymbol,
      defaultLocale:    payload.defaultLocale || `${payload.languageCode || 'en'}-${payload.code}`,
      languageCode:     payload.languageCode || 'en',
      phoneDialCode:    payload.phoneDialCode,
      // New markets start paused: nobody should register into a country whose
      // pricing nobody has looked at yet. Activate from the Countries page.
      isActive:         payload.isActive ?? false,
      paymentProviders: payload.paymentProviders ?? ['flutterwave'],
      creditMethods:    payload.creditMethods ?? ['CASH', 'WALLET'],
      payoutMethods:    payload.payoutMethods ?? ['MANUAL'],
      // Legacy single-value column stays in sync so older code paths that
      // still read `payoutMethod` keep behaving correctly.
      payoutMethod:     (payload.payoutMethods ?? ['MANUAL'])[0],
      providerConfig:   mergeProviderConfig({}, payload.providerConfig),
    },
  });

  invalidateCountryCache();

  logActivity({
    userId: req.user.id,
    action: 'admin_country_created',
    entityType: 'Country',
    entityId: country.id,
    details: { code: country.code, name: country.name, providers: country.paymentProviders },
    req,
  });

  res.status(201).json({ success: true, message: `${country.name} added`, data: { country: present(country) } });
};

// PUT /api/admin/countries/:code
exports.updateCountry = async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const existing = await prisma.country.findUnique({ where: { code } });
  if (!existing) throw new AppError('Country not found', 404);

  const payload = req.body;

  // Validate against the MERGED result, not just the patch — otherwise
  // removing a provider while leaving its credit method behind would slip
  // through because the patch only contains one of the two fields.
  const merged = {
    paymentProviders: payload.paymentProviders ?? existing.paymentProviders,
    creditMethods:    payload.creditMethods    ?? normalizeCountry(existing).creditMethods,
    payoutMethods:    payload.payoutMethods    ?? normalizeCountry(existing).payoutMethods,
  };
  validateCountryPayload(merged);

  const data = {};
  for (const field of ['name', 'currencyCode', 'currencySymbol', 'defaultLocale', 'languageCode', 'phoneDialCode']) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }
  if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);
  if (payload.paymentProviders !== undefined) data.paymentProviders = merged.paymentProviders;
  if (payload.creditMethods !== undefined)    data.creditMethods    = merged.creditMethods;
  if (payload.payoutMethods !== undefined) {
    data.payoutMethods = merged.payoutMethods;
    data.payoutMethod  = merged.payoutMethods[0];
  }
  if (payload.providerConfig !== undefined) {
    data.providerConfig = mergeProviderConfig(existing.providerConfig, payload.providerConfig);
  }

  const country = await prisma.country.update({ where: { code }, data });
  invalidateCountryCache();

  logActivity({
    userId: req.user.id,
    action: 'admin_country_updated',
    entityType: 'Country',
    entityId: country.id,
    details: { code, changed: Object.keys(data) },
    req,
  });

  res.status(200).json({ success: true, message: `${country.name} updated`, data: { country: present(country) } });
};

// PATCH /api/admin/countries/:code/status  { isActive }
exports.setCountryStatus = async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const isActive = Boolean(req.body.isActive);

  const existing = await prisma.country.findUnique({ where: { code } });
  if (!existing) throw new AppError('Country not found', 404);

  // Going live with un-reviewed pricing would charge riders the auto-generated
  // starter values. Make that a deliberate choice, not an accident.
  if (isActive && !existing.isActive) {
    const reviewed = await countrySettings.isPricingReviewed(code);
    if (!reviewed && !req.body.acknowledgeStarterPricing) {
      return res.status(409).json({
        success: false,
        code: 'PRICING_NOT_REVIEWED',
        message: `${existing.name} is still on auto-generated starter prices. Review its pricing under Countries → Pricing & rules first, or confirm you want to go live with the starter values.`,
      });
    }
  }

  // Deactivating hides a country from registration but must never orphan the
  // people already in it — warn the admin with the real number instead of
  // blocking, since suspending a market is sometimes exactly the intent.
  const userCount = await prisma.user.count({ where: { countryCode: code } });

  const country = await prisma.country.update({ where: { code }, data: { isActive } });
  invalidateCountryCache();

  logActivity({
    userId: req.user.id,
    action: isActive ? 'admin_country_activated' : 'admin_country_deactivated',
    entityType: 'Country',
    entityId: country.id,
    details: { code, userCount },
    req,
  });

  res.status(200).json({
    success: true,
    message: isActive
      ? `${country.name} is now accepting registrations`
      : `${country.name} is hidden from new registrations. ${userCount} existing user(s) keep full access.`,
    data: { country: present(country), userCount },
  });
};

// ─────────────────────────────────────────────
// PER-COUNTRY OPERATIONS VIEW
// ─────────────────────────────────────────────

/**
 * GET /api/admin/countries/:code/overview
 *
 * Everything happening in one market, in one call: users by role, live
 * rides/deliveries, pending driver and partner approvals, pending payouts,
 * and unreconciled top-ups. This is what makes "manage all countries'
 * requests" a single screen rather than eight filtered pages.
 */
exports.getCountryOverview = async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const country = await prisma.country.findUnique({ where: { code } });
  if (!country) throw new AppError('Country not found', 404);

  const userScope = { countryCode: code };

  const [
    usersByRole,
    pendingDrivers,
    pendingPartners,
    liveRides,
    liveDeliveries,
    pendingPayouts,
    pendingTopUps,
    revenue,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where: userScope, _count: { _all: true } }),

    prisma.user.count({ where: { ...userScope, role: 'DRIVER', driverProfile: { isApproved: false } } }),
    prisma.user.count({ where: { ...userScope, role: 'DELIVERY_PARTNER', deliveryProfile: { isApproved: false } } }),

    prisma.ride.count({ where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }, customer: userScope } }),
    prisma.delivery.count({ where: { status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }, customer: userScope } }),

    prisma.payout.count({ where: { status: { in: ['PENDING', 'PROCESSING'] }, user: userScope } }),

    prisma.walletTransaction.count({
      where: { status: 'PENDING', type: 'CREDIT', wallet: { user: userScope } },
    }),

    prisma.payment.aggregate({
      where: { status: 'COMPLETED', user: userScope },
      _sum: { amount: true, platformFee: true },
      _count: { _all: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      country: present(country),
      users: Object.fromEntries(usersByRole.map(r => [r.role, r._count._all])),
      queues: {
        pendingDrivers,
        pendingPartners,
        pendingPayouts,
        // Top-ups that were initialized but never confirmed by a webhook —
        // the number an ops person actually needs to chase.
        unreconciledTopUps: pendingTopUps,
      },
      live: { rides: liveRides, deliveries: liveDeliveries },
      revenue: {
        currency:    country.currencyCode,
        grossVolume: revenue._sum.amount ?? 0,
        platformFees: revenue._sum.platformFee ?? 0,
        paymentCount: revenue._count._all,
      },
    },
  });
};

/**
 * GET /api/admin/countries/overview
 *
 * The same shape as above but for every active country at once, so the
 * dashboard can show one row per market without N round-trips.
 */
exports.getAllCountriesOverview = async (req, res) => {
  const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });

  const [userCounts, payoutCounts, paymentSums] = await Promise.all([
    prisma.user.groupBy({ by: ['countryCode'], _count: { _all: true } }),
    prisma.payout.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      select: { user: { select: { countryCode: true } } },
    }),
    prisma.payment.groupBy({
      by: ['currency'],
      where: { status: 'COMPLETED' },
      _sum: { amount: true, platformFee: true },
    }),
  ]);

  const users = Object.fromEntries(userCounts.map(u => [u.countryCode, u._count._all]));
  const payouts = payoutCounts.reduce((acc, p) => {
    const cc = p.user?.countryCode;
    if (cc) acc[cc] = (acc[cc] ?? 0) + 1;
    return acc;
  }, {});
  // Payments are denominated per currency, so a market's volume is looked up
  // by its currency rather than summed across incompatible units.
  const byCurrency = Object.fromEntries(
    paymentSums.map(p => [p.currency, { gross: p._sum.amount ?? 0, fees: p._sum.platformFee ?? 0 }])
  );

  res.status(200).json({
    success: true,
    data: {
      countries: countries.map(c => ({
        ...present(c),
        userCount:      users[c.code] ?? 0,
        pendingPayouts: payouts[c.code] ?? 0,
        grossVolume:    byCurrency[c.currencyCode]?.gross ?? 0,
        platformFees:   byCurrency[c.currencyCode]?.fees ?? 0,
      })),
    },
  });
};

// ─────────────────────────────────────────────
// PER-COUNTRY PRICING / COMMISSION / WALLET / PAYOUT / BONUS RULES
// ─────────────────────────────────────────────

const requireCountry = async (codeParam) => {
  const code = String(codeParam).toUpperCase();
  const row = await prisma.country.findUnique({ where: { code } });
  if (!row) throw new AppError('Country not found', 404);
  return row;
};

// GET /api/admin/countries/:code/settings
exports.getCountrySettings = async (req, res) => {
  const row = await requireCountry(req.params.code);
  const data = await countrySettings.describeCountrySettings(row.code);
  res.status(200).json({ success: true, data: { ...data, countryName: row.name } });
};

// PUT /api/admin/countries/:code/settings   { changes: { key: value | null } }
// null removes the override so the country inherits again.
exports.updateCountrySettings = async (req, res) => {
  const row = await requireCountry(req.params.code);
  const { changes } = req.body;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new AppError('"changes" must be an object of { key: value }', 400);
  }

  const { applied } = await countrySettings.saveCountrySettings(row.code, changes, req.user.id);

  logActivity({
    userId: req.user.id,
    action: 'admin_country_settings_updated',
    entityType: 'Country',
    entityId: row.id,
    // Old → new for every key: pricing changes are exactly what someone asks
    // about a month later ("who changed the Mali commission?").
    details: { code: row.code, currency: row.currencyCode, changes: applied.map(a => ({ key: a.key, from: a.from, to: a.to })) },
    req,
  });

  const data = await countrySettings.describeCountrySettings(row.code);
  res.status(200).json({
    success: true,
    message: `${row.name}: ${applied.length} setting${applied.length === 1 ? '' : 's'} saved`,
    data: { ...data, countryName: row.name, applied },
  });
};

// POST /api/admin/countries/:code/settings/copy  { fromCode, factor?, groups? }
exports.copyCountrySettings = async (req, res) => {
  const row = await requireCountry(req.params.code);
  const { fromCode, factor, groups } = req.body;
  if (!fromCode) throw new AppError('fromCode is required', 400);
  const { applied } = await countrySettings.copySettings(row.code, fromCode, { factor, groups, adminId: req.user.id });

  logActivity({
    userId: req.user.id,
    action: 'admin_country_settings_copied',
    entityType: 'Country',
    entityId: row.id,
    details: { code: row.code, fromCode: String(fromCode).toUpperCase(), factor: factor ?? null, groups: groups ?? 'all', keys: applied.length },
    req,
  });

  const data = await countrySettings.describeCountrySettings(row.code);
  res.status(200).json({ success: true, message: `Copied ${applied.length} settings from ${String(fromCode).toUpperCase()} into ${row.name}`, data: { ...data, countryName: row.name } });
};

// POST /api/admin/countries/:code/settings/review — "I've checked these numbers"
exports.markPricingReviewed = async (req, res) => {
  const row = await requireCountry(req.params.code);
  await countrySettings.markPricingReviewed(row.code, req.user.id);
  logActivity({ userId: req.user.id, action: 'admin_country_pricing_reviewed', entityType: 'Country', entityId: row.id, details: { code: row.code }, req });
  res.status(200).json({ success: true, message: `${row.name} pricing marked as reviewed` });
};

// GET /api/admin/countries/settings/compare?keys=platform_commission_rides,wallet_topup_min
// One row per country, one column per key — the "how do my markets differ" view.
exports.compareCountrySettings = async (req, res) => {
  const keys = String(req.query.keys || '').split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) throw new AppError('keys is required (comma-separated)', 400);
  const unknown = keys.filter(k => !countrySettings.DEF_BY_KEY[k]);
  if (unknown.length) throw new AppError(`Unknown setting(s): ${unknown.join(', ')}`, 400);

  const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
  const rows = await Promise.all(countries.map(async c => {
    const eff = await countrySettings.getEffectiveSettings(c.code);
    return {
      code: c.code, name: c.name, currency: c.currencyCode, isActive: c.isActive,
      values:  Object.fromEntries(keys.map(k => [k, eff.values[k]])),
      sources: Object.fromEntries(keys.map(k => [k, eff.sources[k]])),
    };
  }));
  res.status(200).json({
    success: true,
    data: { keys: keys.map(k => ({ key: k, label: countrySettings.DEF_BY_KEY[k].label, type: countrySettings.DEF_BY_KEY[k].type })), countries: rows },
  });
};

module.exports = exports;
