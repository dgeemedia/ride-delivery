// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─────────────────────────────────────────────────────────────────────────────
// react-native-maps 1.20.1 ships un-transpiled JSX which crashes the Node.js
// require() used during web bundling. On web we swap it for our stub shim.
// ─────────────────────────────────────────────────────────────────────────────
const WEB_SHIMS = {
  'react-native-maps': path.resolve(__dirname, 'src/shims/MapView.web.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { filePath: WEB_SHIMS[moduleName], type: 'sourceFile' };
  }
  // Default Metro resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;