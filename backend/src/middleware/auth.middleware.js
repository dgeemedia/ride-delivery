// backend/src/middleware/auth.middleware.js
//
// authenticate  — verifies JWT, attaches req.user (includes adminDepartment)
// authorize     — role check (e.g. authorize('ADMIN','SUPER_ADMIN'))
// requireScope  — department check ON TOP of role
//                 requireScope('RIDES') passes if:
//                   • role === 'SUPER_ADMIN'
//                   • role === 'ADMIN' && (adminDepartment === null || adminDepartment === 'RIDES')
//                   • specified role matches scope
//
// DEPARTMENT MAP
//   null          → general admin, access to everything under ADMIN role
//   'RIDES'       → drivers + rides management only
//   'DELIVERIES'  → partners + deliveries management only
//   'SUPPORT'     → support tickets + read-only user lookup

'use strict';
const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// ─── authenticate ─────────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        role: true, isVerified: true, isActive: true,
        adminDepartment: true,   // ← department scope
      },
    });

    if (!user)          return res.status(401).json({ success: false, message: 'Invalid token. User not found.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token.' });
    if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired.' });
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};

// ─── authorize (role-based) ───────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: `Access denied. Requires role: ${roles.join(' or ')}.` });
  next();
};

// ─── requireScope (department-based) ─────────────────────────────────────────
//
// Usage:  router.get('/drivers', authenticate, requireScope('RIDES'), handler)
//
// Passes when:
//   1. SUPER_ADMIN — always
//   2. ADMIN with no department (null) — general admin, always
//   3. ADMIN with matching department — e.g. RIDES admin on a RIDES route
//   4. SUPPORT role on SUPPORT scope
//
const requireScope = (...scopes) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Unauthorized.' });

  const { role, adminDepartment } = req.user;

  // Super admin bypasses all scope checks
  if (role === 'SUPER_ADMIN') return next();

  // General admin (no department) has access to all admin scopes
  if (role === 'ADMIN' && adminDepartment === null) return next();

  // Scoped admin — must match at least one of the required scopes
  if (role === 'ADMIN' && scopes.includes(adminDepartment)) return next();

  // Support role — only allowed on SUPPORT scope
  if (role === 'SUPPORT' && scopes.includes('SUPPORT')) return next();

  return res.status(403).json({
    success: false,
    message: `Access denied. Your account (${role}${adminDepartment ? `/${adminDepartment}` : ''}) is not authorised for this section.`,
  });
};

// ─── helpers for common combos ────────────────────────────────────────────────
const isAdminOrSuper  = authorize('ADMIN', 'SUPER_ADMIN', 'SUPPORT');
const isSuperAdmin    = authorize('SUPER_ADMIN');
const isRidesAdmin    = [authenticate, requireScope('RIDES')];
const isDeliveryAdmin = [authenticate, requireScope('DELIVERIES')];
const isSupportAgent  = [authenticate, requireScope('SUPPORT')];

// Aliases kept for legacy references
const protect    = authenticate;
const restrictTo = authorize;

module.exports = {
  authenticate, authorize, requireScope,
  protect, restrictTo,
  isAdminOrSuper, isSuperAdmin,
  isRidesAdmin, isDeliveryAdmin, isSupportAgent,
};