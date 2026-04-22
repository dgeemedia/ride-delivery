// mobile/src/services/authEvents.js
const listeners = new Set();
let _suppressForceLogout = false;

export const suppressForceLogout = (v) => { _suppressForceLogout = v; };

export const onForceLogout = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const emitForceLogout = (reason = 'session_expired') => {
  if (_suppressForceLogout) return;   // ← skip if biometric auth is in flight
  listeners.forEach((cb) => cb(reason));
};