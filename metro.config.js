const path = require("path");

// Sentry's wrapper around getDefaultConfig enables collapsed-frame source-map
// support and registers the right symbolicator so production stack traces
// resolve to original TS lines after upload. Falls back gracefully to the
// stock Expo config if @sentry/react-native isn't installed yet.
let config;
try {
  const { getSentryExpoConfig } = require("@sentry/react-native/metro");
  config = getSentryExpoConfig(__dirname);
} catch {
  const { getDefaultConfig } = require("expo/metro-config");
  config = getDefaultConfig(__dirname);
}

// Watchman lacks permission to this directory; use Node crawler instead
config.resolver.useWatchman = false;

// pnpm uses symlinks in node_modules — Metro needs to follow them and also
// be aware of the .pnpm store so that it can resolve peer-dependency variants.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
