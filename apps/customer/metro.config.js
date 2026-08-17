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

module.exports = config;
