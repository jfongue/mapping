const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix: désactive la résolution package.json:exports (activée par défaut depuis Expo SDK 53)
// qui provoque "Cannot find module './utils/paths'" dans metro-resolver lors des EAS builds.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
