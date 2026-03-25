// mobile/src/config/constants.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// URL strategy:
//   • Web (Expo running in browser on your laptop) → localhost:3000
//     The browser and the backend are on the same machine, so localhost works
//     and avoids Windows Firewall blocking the LAN IP from the browser.
//
//   • Native Android/iOS (phone on same WiFi) → LAN IP e.g. 192.168.x.x:3000
//     The phone can't use "localhost" — that points to the phone itself.
//     It must use the laptop's real IP on the local network.
//
// To update the LAN IP, change EXPO_PUBLIC_API_BASE_URL in your .env file.
// ─────────────────────────────────────────────────────────────────────────────

const LAN_URL       = process.env.EXPO_PUBLIC_API_BASE_URL
                   ?? Constants.expoConfig?.extra?.apiUrl
                   ?? 'http://192.168.164.189:3000/api';

const LOCALHOST_URL = 'http://localhost:3000/api';

export const API_BASE_URL = Platform.OS === 'web' ? LOCALHOST_URL : LAN_URL;

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