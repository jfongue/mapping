// metro.config.js — requis par Expo SDK 54 + Metro 0.83
// Sans ce fichier, Metro ne trouve pas son "build cache provider"
// et plante au démarrage avec "Cannot find module 'build cache provider'".
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
