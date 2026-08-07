// backend/src/utils/auditLog.js
'use strict';
const prisma = require('../lib/prisma');

/**
 * Central audit-trail writer. Every sensitive action anywhere in the
 * backend — admin actions, auth events, self-service account changes —
 * should call this instead of writing to prisma.activityLog directly.
 * One place defines the shape; one place to extend later (e.g. forwarding
 * to a SIEM or the monitor app's alert evaluator) without hunting through
 * every controller that writes an audit row.
 *
 * Never throws — a logging failure must never break the request it's
 * attached to. Matches the exact signature admin.controller.js's original
 * local logActivity() used, so call sites don't need to change shape.
 *
 * @param {object} params
 * @param {string|null} params.userId     - actor's user id (null for system/unauthenticated events)
 * @param {string}      params.action     - short snake_case event name, e.g. 'admin_login_failed'
 * @param {string}      params.entityType - e.g. 'User', 'Route', 'Wallet', 'DriverProfile'
 * @param {string|null} [params.entityId] - id of the affected record, if any
 * @param {object|null} [params.details]  - free-form JSON context for this event
 * @param {object|null} [params.req]      - Express req, used to pull ip/userAgent
 */
async function logActivity({ userId = null, action, entityType, entityId = null, details = null, req = null }) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details,
        ipAddress: req?.ip ?? null,
        userAgent: req?.headers?.['user-agent'] ?? null,
      },
    });
  } catch (err) {
    console.error(`[auditLog] failed to log "${action}":`, err.message);
  }
}

module.exports = { logActivity };
