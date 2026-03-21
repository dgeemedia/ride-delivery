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
    deleteUsers:      isSuperAdmin,
    createAdmins:     isSuperAdmin,

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
    editSettings:     isSuperAdmin,

    // Promo codes
    managePromos:     isAdmin,

    // Notifications
    broadcast:        isAdmin,

    // Bonuses
    disburseBonus:    isSuperAdmin,
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
    canAccess,
    can,
    login,
    logout,
  };
};