// mobile/src/config/constants.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://diakite.onrender.com/api';

// Priority:
// 1. EXPO_PUBLIC_API_BASE_URL from .env.local (local dev → LAN IP)
// 2. apiUrl from app.config.js extra (EAS build → Render URL)
// 3. Hardcoded Render URL (final fallback)
const NATIVE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL     // set in .env.local for local dev
  ?? Constants.expoConfig?.extra?.apiUrl   // set from app.config.js → .env
  ?? PRODUCTION_URL;

// Web always uses localhost — browser and backend on same machine
const WEB_URL = 'http://localhost:3000/api';

export const API_BASE_URL = Platform.OS === 'web' ? WEB_URL : NATIVE_URL;

if (__DEV__) {
  console.log('[Config] Platform    :', Platform.OS);
  console.log('[Config] API_BASE_URL:', API_BASE_URL);
}

export const ROLES = {
  CUSTOMER:         'CUSTOMER',
  DRIVER:           'DRIVER',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
};

export const RIDE_STATUS = {
  REQUESTED:   'REQUESTED',
  ACCEPTED:    'ACCEPTED',
  ARRIVED:     'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED:   'COMPLETED',
  CANCELLED:   'CANCELLED',
};

export const DELIVERY_STATUS = {
  PENDING:    'PENDING',
  ASSIGNED:   'ASSIGNED',
  PICKED_UP:  'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED:  'DELIVERED',
  CANCELLED:  'CANCELLED',
};