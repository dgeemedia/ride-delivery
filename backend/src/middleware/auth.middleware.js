// backend/src/middleware/auth.middleware.js
//
// Single source of truth for JWT authentication + role authorization.
// Primary exports: authenticate / authorize  (used across all routes)
// Aliases:         protect / restrictTo      (kept for any legacy references)

const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION — verify JWT, attach req.user
// ─────────────────────────────────────────────────────────────────────────────

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        role: true, isVerified: true, isActive: true,
      },
    });

    if (!user)          return res.status(401).json({ success: false, message: 'Invalid token. User not found.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token.' });
    if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Token expired.' });
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORIZATION — enforce role(s)
// Accepts either restrictTo('DRIVER', 'ADMIN') or authorize('DRIVER', 'ADMIN')
// ─────────────────────────────────────────────────────────────────────────────

const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user)                    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: `Access denied. Requires role: ${roles.join(' or ')}.` });
  next();
};

// Aliases — identical behaviour
const authenticate = protect;
const authorize    = restrictTo;

module.exports = { protect, restrictTo, authenticate, authorize };