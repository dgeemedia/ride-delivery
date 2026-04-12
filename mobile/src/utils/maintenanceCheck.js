// mobile/src/utils/maintenanceCheck.js
import { API_BASE_URL } from '../config/constants';

/**
 * Returns { isOn, isScheduled, message, endsAt, startsAt }
 * Calls the PUBLIC /api/status/maintenance endpoint — no auth needed.
 * Never throws — fails silently so a network hiccup never breaks the UI.
 */
export async function checkMaintenance() {
  try {
    const res  = await fetch(`${API_BASE_URL}/status/maintenance`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const s    = data?.data ?? {};

    return {
      isOn:        s.isOn        ?? false,
      isScheduled: s.isScheduled ?? false,
      message:     s.message     || 'Platform maintenance in progress. Some features may be unavailable.',
      endsAt:      s.endsAt      ?? null,
      startsAt:    s.startsAt    ?? null,
    };
  } catch {
    return { isOn: false, isScheduled: false, message: '', endsAt: null, startsAt: null };
  }
}