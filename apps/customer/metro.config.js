// @ts-check
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase's React Native auth build (dist/rn/index.js) exports
// getReactNativePersistence for persistent AsyncStorage-backed auth state.
// Metro needs the "react-native" condition/field to pick that build over
// the browser build, which omits getReactNativePersistence.
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "require", "default"];

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

module.exports = config;
