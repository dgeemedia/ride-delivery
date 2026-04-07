// admin-web/src/utils/helpers.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style:                 'currency',
    currency:              'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-NG', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
};

export const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-NG', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (date: string | Date): string => {
  return new Date(date).toLocaleTimeString('en-NG', {
    hour:   '2-digit',
    minute: '2-digit',
  });
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins  = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    COMPLETED:   'bg-green-100 text-green-800',
    DELIVERED:   'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    IN_TRANSIT:  'bg-blue-100 text-blue-800',
    PENDING:     'bg-yellow-100 text-yellow-800',
    REQUESTED:   'bg-yellow-100 text-yellow-800',
    CANCELLED:   'bg-red-100 text-red-800',
    FAILED:      'bg-red-100 text-red-800',
    REFUNDED:    'bg-orange-100 text-orange-800',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800';
};

export const truncate = (str: string, length: number = 50): string =>
  str.length > length ? str.substring(0, length) + '...' : str;

export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();