const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Environment files belong to Node configuration, never the app module graph.
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[/\\]\.env(?:\.[^/\\]*)?$/,
];
module.exports = config;
