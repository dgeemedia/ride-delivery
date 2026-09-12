// mobile/src/utils/formatters.js

// Kept in sync with CurrencyContext.js's map — used here only as a fallback
// for call sites that haven't been updated to use useCurrency() yet.
const LOCALE_BY_CURRENCY = {
  NGN: 'en-NG', GHS: 'en-GH', KES: 'en-KE', ZAR: 'en-ZA', USD: 'en-US', EUR: 'en-IE', GBP: 'en-GB',
};

export const formatCurrency = (amount, currency = 'NGN') => {
  const locale = LOCALE_BY_CURRENCY[currency] || 'en-NG';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDistance = (metres) => {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
};

export const formatDuration = (seconds) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
};

export const getStatusColor = (status) => {
  const map = {
    REQUESTED: '#FF9500',
    ACCEPTED: '#007AFF',
    ARRIVED: '#5AC8FA',
    IN_PROGRESS: '#34C759',
    COMPLETED: '#34C759',
    CANCELLED: '#FF3B30',
    ASSIGNED: '#007AFF',
    PICKED_UP: '#5AC8FA',
    IN_TRANSIT: '#34C759',
  };
  return map[status] || '#6E6E73';
};