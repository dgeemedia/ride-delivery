// admin-web/src/hooks/useAuth.ts
//
// Central permission hook — use this everywhere instead of checking
// user.role directly. Keeps all permission logic in one place.
//
// Department scoping mirrors the backend requireScope() middleware:
//   SUPER_ADMIN           → everything
//   ADMIN + null dept     → everything under ADMIN
//   ADMIN + 'RIDES'       → drivers + rides only
//   ADMIN + 'DELIVERIES'  → partners + deliveries only
//   SUPPORT               → tickets + read-only

import { useAuthStore } from '@/store/authStore';
import type { AdminDepartment } from '@/types';

export const useAuth = () => {
  const { user, token, isAuthenticated, login, logout } = useAuthStore();

  const role   = user?.role ?? '';
  const dept   = (user?.adminDepartment ?? null) as AdminDepartment;

  // ── Basic role checks ───────────────────────────────────────────────────────
  const isSuperAdmin  = role === 'SUPER_ADMIN';
  const isAdmin       = role === 'ADMIN' || isSuperAdmin;
  const isSupport     = role === 'SUPPORT';
  const isAnyAdmin    = isAdmin || isSupport;

  // Country-limited staff (e.g. a "Mali admin"): empty list = all countries; Super Admin is never limited.
  const markets = isSuperAdmin ? [] : ((user?.supportCountries ?? []) as string[]).map(c => String(c).toUpperCase());
  const isCountryLimited = markets.length > 0;
  // Full authority over a country: Super Admin everywhere, or an ADMIN assigned to specific countries
  // (the server then keeps them inside those countries). An ADMIN with no countries is not elevated.
  const hasCountryAuthority = isSuperAdmin || (role === 'ADMIN' && isCountryLimited);

  // ── Department helpers ──────────────────────────────────────────────────────
  // General admin has no department restriction
  const isGeneralAdmin = isAdmin && dept === null;

  // Can access a specific scope
  const canAccess = (scope: 'RIDES' | 'DELIVERIES' | 'SUPPORT'): boolean => {
    if (isSuperAdmin)    return true;
    if (isGeneralAdmin)  return true;                   // general admin sees all
    if (isAdmin && dept === scope) return true;         // scoped admin on their scope
    if (role === 'SUPPORT' && scope === 'SUPPORT') return true;
    return false;
  };

  // ── Feature-level permissions ────────────────────────────────────────────────
  const can = {
    // Users
    viewUsers:        isAnyAdmin,
    suspendUsers:     isAdmin,
    deleteUsers:      hasCountryAuthority,
    createAdmins:     hasCountryAuthority,

    // Drivers / rides
    manageDrivers:    canAccess('RIDES'),
    manageRides:      canAccess('RIDES'),
    viewRides:        canAccess('RIDES') || isSupport,

    // Partners / deliveries
    managePartners:   canAccess('DELIVERIES'),
    manageDeliveries: canAccess('DELIVERIES'),
    viewDeliveries:   canAccess('DELIVERIES') || isSupport,

    // Tickets
    viewTickets:      isAnyAdmin,
    respondTickets:   isAnyAdmin,

    // Financial
    viewPayments:     isAdmin,
    adjustWallets:    isAdmin,
    viewAnalytics:    isAdmin,

    // Settings
    viewSettings:     isAdmin,
    editSettings:     isSuperAdmin,          // global platform settings
    editCountrySettings: hasCountryAuthority, // a country's own pricing, payments, payouts…

    // Promo codes (global, so closed to country-limited accounts)
    managePromos:     isAdmin && !isCountryLimited,

    // Global sections (corporate accounts, audit log…) — not for country-limited accounts
    viewGlobal:       isAnyAdmin && !isCountryLimited,

    // Notifications
    broadcast:        isAdmin,

    // Bonuses
    disburseBonus:    hasCountryAuthority,
  };

  return {
    user,
    token,
    isAuthenticated,
    role,
    dept,
    isSuperAdmin,
    isAdmin,
    isSupport,
    isAnyAdmin,
    isGeneralAdmin,
    markets,
    isCountryLimited,
    hasCountryAuthority,
    canAccess,
    can,
    login,
    logout,
  };
};