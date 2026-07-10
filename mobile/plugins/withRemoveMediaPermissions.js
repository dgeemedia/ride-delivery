// mobile/plugins/withRemoveMediaPermissions.js
//
// expo-image-picker's native Android module ships its own AndroidManifest.xml
// which the Android Gradle manifest merger pulls in at BUILD time — separate
// from, and after, whatever config plugins write into the source manifest.
// Simply filtering the array in the generated source manifest is not enough,
// because Gradle re-merges the permission back in from the library's own
// manifest during compilation.
//
// The correct fix is Android's manifest-merger override: tools:node="remove"
// forces Gradle to strip the permission even if a dependency tries to add it.

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

module.exports = function withRemoveMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;

    // Ensure the tools namespace is declared on <manifest>, required for
    // tools:node to be recognized by the Gradle manifest merger.
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // Drop any existing entries for these permissions (in case a prior mod
    // already added them to the source file) …
    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (perm) => !PERMISSIONS_TO_REMOVE.includes(perm.$?.['android:name'])
    );

    // … then re-add each one with tools:node="remove" so the Gradle
    // manifest merger strips it even when a library (like expo-image-picker)
    // tries to merge it back in from its own bundled manifest.
    PERMISSIONS_TO_REMOVE.forEach((name) => {
      manifest['uses-permission'].push({
        $: {
          'android:name': name,
          'tools:node': 'remove',
        },
      });
    });

    return config;
  });
};