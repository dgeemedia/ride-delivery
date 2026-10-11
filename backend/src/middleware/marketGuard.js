// backend/src/middleware/marketGuard.js
// Keeps a country-limited admin inside their own market(s). Staff with NO assigned
// countries (and every SUPER_ADMIN) pass straight through, so nothing changes for them.
//
//   marketGuard      – /api/admin/*: blocks opening or changing a record that belongs to
//                      another country (users, drivers, partners, rides, deliveries,
//                      payments, SHIELD sessions, DuoPay accounts, /countries/XX).
//   walletMarketGuard – /api/wallet/admin/*: payouts, transfers and top-ups.
//   denyScoped       – sections that are global by nature (promo codes, audit log,
//                      corporate accounts…): closed to country-limited staff.
//
// List endpoints are filtered inside their controllers with utils/marketScope.
'use strict';
const prisma = require('../lib/prisma');
const { staffMarkets, canActInMarket } = require('../utils/marketScope');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER = { select: { customer: { select: { countryCode: true } } } };
const USER = { select: { user: { select: { countryCode: true } } } };

const ADMIN_RESOLVERS = [
  { re: /^\/users\/([^/]+)/,               find: (id) => prisma.user.findUnique({ where: { id }, select: { countryCode: true } }), pick: (r) => r.countryCode },
  { re: /^\/drivers\/([^/]+)/,             find: (id) => prisma.driverProfile.findUnique({ where: { id }, ...USER }),            pick: (r) => r.user?.countryCode },
  { re: /^\/partners\/([^/]+)/,            find: (id) => prisma.deliveryPartnerProfile.findUnique({ where: { id }, ...USER }), pick: (r) => r.user?.countryCode },
  { re: /^\/rides\/([^/]+)/,               find: (id) => prisma.ride.findUnique({ where: { id }, ...CUSTOMER }),                 pick: (r) => r.customer?.countryCode },
  { re: /^\/deliveries\/([^/]+)/,          find: (id) => prisma.delivery.findUnique({ where: { id }, ...CUSTOMER }),             pick: (r) => r.customer?.countryCode },
  { re: /^\/payments\/([^/]+)/,            find: (id) => prisma.payment.findUnique({ where: { id }, ...USER }),                  pick: (r) => r.user?.countryCode },
  { re: /^\/shield\/sessions\/([^/]+)/,    find: (id) => prisma.shieldSession.findUnique({ where: { id }, ...USER }),             pick: (r) => r.user?.countryCode },
  { re: /^\/wallets\/([^/]+)\/adjust/,     find: (id) => prisma.user.findUnique({ where: { id }, select: { countryCode: true } }), pick: (r) => r.countryCode },
  { re: /^\/duopay\/accounts\/([^/]+)/,    find: (id) => prisma.duoPayAccount.findUnique({ where: { id }, ...USER }),             pick: (r) => r.user?.countryCode },
];

const WALLET_RESOLVERS = [
  { re: /^\/payouts\/([^/]+)/,   find: (id) => prisma.payout.findUnique({ where: { id }, ...USER }), pick: (r) => r.user?.countryCode },
  { re: /^\/transfers\/([^/]+)/, find: (reference) => prisma.transfer.findUnique({ where: { reference }, select: { sender: { select: { countryCode: true } } } }), pick: (r) => r.sender?.countryCode },
  { re: /^\/topups\/([^/]+)/,    find: (id) => prisma.walletTransaction.findUnique({ where: { id }, select: { wallet: { select: { user: { select: { countryCode: true } } } } } }), pick: (r) => r.wallet?.user?.countryCode },
];

const deny = (res, what) => res.status(403).json({
  success: false,
  message: `This ${what} belongs to a country outside your assigned countries.`,
});

const build = (resolvers, { uuidOnly }) => async (req, res, next) => {
  try {
    if (staffMarkets(req.user).length === 0) return next();

    // /countries/ML/... — a market's own configuration.
    const c = req.path.match(/^\/countries\/([A-Za-z]{2})(?:\/|$)/);
    if (c && !canActInMarket(req.user, c[1])) return deny(res, 'country');

    for (const r of resolvers) {
      const m = req.path.match(r.re);
      if (!m) continue;
      if (uuidOnly && !UUID.test(m[1])) break;       // /drivers/pending, /rides/live, …
      if (m[1] === req.user.id) break;               // your own account/profile is always reachable
      const row = await r.find(m[1]);
      if (row && !canActInMarket(req.user, r.pick(row))) return deny(res, 'record');
      break;
    }
    return next();
  } catch (err) { return next(err); }
};

const marketGuard       = build(ADMIN_RESOLVERS,  { uuidOnly: true });
const walletMarketGuard = build(WALLET_RESOLVERS, { uuidOnly: false });

const denyScoped = (req, res, next) => {
  if (staffMarkets(req.user).length === 0) return next();
  return res.status(403).json({
    success: false,
    message: 'This section is global and is not available to country-limited accounts. Ask a Super Admin.',
  });
};

// Full authority over a country: Super Admin everywhere, or an ADMIN who has been assigned
// countries (marketGuard above keeps them inside those countries). An ADMIN with NO assigned
// countries is NOT elevated by this — they keep the access they had before.
const superOrCountryAdmin = (req, res, next) => {
  if (req.user?.role === 'SUPER_ADMIN') return next();
  if (req.user?.role === 'ADMIN' && staffMarkets(req.user).length > 0) return next();
  return res.status(403).json({
    success: false,
    message: 'Access denied. Requires a Super Admin or an admin assigned to this country.',
  });
};

module.exports = { marketGuard, walletMarketGuard, denyScoped, superOrCountryAdmin };
