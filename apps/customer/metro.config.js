// @ts-check
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase's React Native auth build (dist/rn/index.js) exports
// getReactNativePersistence for persistent AsyncStorage-backed auth state.
// Native bundles pick that build via the per-platform condition below and the
// "react-native" main field; the browser build omits getReactNativePersistence.
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.unstable_enablePackageExports = true;
// Web bundles must resolve @firebase/auth's BROWSER build (popup/redirect
// resolver lives only there); the react-native condition must apply to native
// platforms only, per-platform, exactly like Expo's default config. A global
// conditionNames list poisons web bundles with the RN auth build and breaks
// Google popup sign-in on web entirely.
config.resolver.unstable_conditionsByPlatform = {
  ...(config.resolver.unstable_conditionsByPlatform ?? {}),
  ios: ["react-native"],
  android: ["react-native"],
};

// Workspace packages use NodeNext-style "./x.js" specifiers that point at
// .ts sources. Retry a failed relative ".js" import without the extension.
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (err) {
    if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    throw err;
  }
};


// Monorepo: force a single react / react-dom / react-native copy in the bundle.
// Nested workspace installs otherwise let Metro resolve an older react
// (e.g. react 18's jsx-runtime) alongside the app's react 19, which crashes
// at runtime with React error #525 (element from an older React rendered).
const path = require("path");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.resolve(__dirname, "node_modules", "react"),
  "react-dom": path.resolve(__dirname, "node_modules", "react-dom"),
  "react-native": path.resolve(__dirname, "node_modules", "react-native"),
};

// Production bundles must not contain dev preview screens or their sample data (fake cars, bookings, packages).
// expo export runs with NODE_ENV=production; in that mode these files are unresolvable, so they cannot ship.
// scripts/prod-bundle-guard.mjs checks the real export. Dev (expo start) is unchanged.
if (process.env.NODE_ENV === "production") {
  const devOnly = [
    /[\\/]src[\\/]app[\\/]preview[^\\/]*\.tsx$/,
    /[\\/]src[\\/]lib[\\/](garage-dev-sample|booking-dev-sample|live-packages-sample)\.ts$/,
  ];
  const prior = config.resolver.blockList;
  config.resolver.blockList = [...(Array.isArray(prior) ? prior : prior ? [prior] : []), ...devOnly];
}

module.exports = config;
