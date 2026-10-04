import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "AutoDeck Studio",
  slug: "autodeck-studio",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/brand/icon.png",
  scheme: "autodeck-studio",
  userInterfaceStyle: "light",
  web: { favicon: "./assets/brand/favicon.png", bundler: "metro", output: "single" },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "in.autodeck.studio",
    // Apple Developer account required — REQUIRES APPROVAL ($99/year)
  },
  android: {
    package: "in.autodeck.studio",
    adaptiveIcon: {
      backgroundColor: "#ffffff",
      foregroundImage: "./assets/brand/icon-512.png",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        android: { minSdkVersion: 26 },
        ios: { deploymentTarget: "16.0" },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
