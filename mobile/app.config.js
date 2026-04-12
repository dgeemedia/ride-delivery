// mobile/app.config.js
require('dotenv').config();

const ANDROID_KEY = process.env.GOOGLE_MAPS_API_KEY_ANDROID ?? '';
const IOS_KEY     = process.env.GOOGLE_MAPS_API_KEY_IOS     ?? '';

module.exports = {
  expo: {
    name:        'Diakite',
    slug:        'diakite',
    version:     '1.0.0',
    orientation: 'portrait',
    icon:        './assets/icon.png',
    userInterfaceStyle: 'dark',

    splash: {
      image:           './assets/splash.png',
      resizeMode:      'cover',
      backgroundColor: '#080C18',
    },

    assetBundlePatterns: ['**/*'],

    plugins: [
      [
        'expo-image-picker',
        { photosPermission: 'Allow Diakite to access your photos.' },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Diakite needs your location to find nearby drivers and show your position on the map.',
          locationAlwaysAndWhenInUsePermission:
            'Diakite uses your location to track your ride in real time.',
        },
      ],
    ],

    ios: {
      supportsTablet:   true,
      bundleIdentifier: 'com.diakite.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Diakite needs your location to find nearby drivers and show your position on the map.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Diakite uses your location to track your ride in real time.',
      },
      config: {
        googleMapsApiKey: IOS_KEY,
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#080C18',
      },
      package:     'com.diakite.app',
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      config: {
        googleMaps: {
          apiKey: ANDROID_KEY,
        },
      },
    },

    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },

extra: {
  apiUrl: process.env.API_URL ?? 'https://diakite.onrender.com/api', // was local IP
  eas: {
    projectId: 'da8a9bc7-41c1-44d2-8d1d-a52b0dc46fb7',
  },
},
};