// mobile/plugins/withRemoveMediaPermissions.js
//
// Google Play flags apps that declare READ_MEDIA_IMAGES / READ_MEDIA_VIDEO
// but only use one-time/infrequent photo access (via the system photo picker).
// expo-image-picker's plugin adds these permissions unconditionally and has
// no toggle to disable them, so we strip them from the final merged manifest
// after all other plugins have run.
//
// Only use this if your app NEVER needs persistent/broad gallery access via
// expo-media-library or similar. If it does, you'll need to keep the
// permission and instead update your Play Console "Photo and video
// permissions" declaration to justify broad access.

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  // Older devices fall back to this one — Play generally doesn't flag it,
  // but strip it too if you truly need zero broad-storage access.
  // 'android.permission.READ_EXTERNAL_STORAGE',
];

module.exports = function withRemoveMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (perm) => !PERMISSIONS_TO_REMOVE.includes(perm.$['android:name'])
      );
    }

    return config;
  });
};