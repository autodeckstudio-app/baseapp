import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "AutoDeck",
  slug: "autodeck-customer",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "autodeck",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "in.autodeck.customer",
    // Apple Developer account required — REQUIRES APPROVAL ($99/year)
  },
  android: {
    package: "in.autodeck.customer",
    adaptiveIcon: {
      backgroundColor: "#ffffff",
    },
    // Google Play Developer account required — REQUIRES APPROVAL ($25 one-time)
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
