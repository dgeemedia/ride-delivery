// backend/src/utils/supportRouting.js
// Who handles a ticket, by country + language. EMPTY coverage = "everything", so existing
// admins keep working until someone is explicitly assigned to a market.
'use strict';
const up = (v) => String(v ?? '').trim().toUpperCase();
const low = (v) => String(v ?? '').trim().toLowerCase();
const asList = (v) => (Array.isArray(v) ? v : []);

const coversTicket = (staff, ticket) => {
  const c = asList(staff?.supportCountries).map(up);
  const l = asList(staff?.supportLanguages).map(low);
  return (c.length === 0 || c.includes(up(ticket?.countryCode))) &&
         (l.length === 0 || l.includes(low(ticket?.language)));
};

// Never orphan a ticket: no match → super admins → everyone.
const pickRecipients = (staff, ticket) => {
  const list = asList(staff);
  const m = list.filter((s) => coversTicket(s, ticket));
  if (m.length) return m;
  const sup = list.filter((s) => s.role === 'SUPER_ADMIN');
  return sup.length ? sup : list;
};

const ticketScopeWhere = (user) => {
  if (!user || user.role === 'SUPER_ADMIN') return {};
  const c = asList(user.supportCountries).map(up);
  const l = asList(user.supportLanguages).map(low);
  const where = {};
  if (c.length) where.countryCode = { in: c };
  if (l.length) where.language = { in: l };
  return where;
};

const canAccessTicket = (user, ticket) => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return coversTicket(user, ticket);
};

module.exports = { coversTicket, pickRecipients, ticketScopeWhere, canAccessTicket };
