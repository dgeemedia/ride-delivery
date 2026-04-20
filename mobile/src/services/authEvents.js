// mobile/src/services/authEvents.js
// ── Lightweight event bus ─────────────────────────────────────────────────────
// Lets api.js fire a force-logout signal WITHOUT importing AuthContext
// (which would create a circular dependency).
// AuthContext subscribes on mount and calls its own logout() when it fires.

const listeners = new Set();

export const onForceLogout = (callback) => {
  listeners.add(callback);
  // Return an unsubscribe function
  return () => listeners.delete(callback);
};

export const emitForceLogout = (reason = 'session_expired') => {
  listeners.forEach((cb) => cb(reason));
};