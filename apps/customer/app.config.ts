import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "AutoDeck",
  slug: "autodeck-customer",
  version: "1.0.1",
  orientation: "portrait",
  icon: "./assets/brand/icon.png",
  web: { favicon: "./assets/brand/favicon.png" },
  scheme: ["autodeck", "in.autodeck.customer"],
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    buildNumber: "2",
    bundleIdentifier: "in.autodeck.customer",
    // Local Personal Team testing is free; store distribution needs separate approval.
    infoPlist: {
      CFBundleURLTypes: [{ CFBundleURLSchemes: ["autodeck", "in.autodeck.customer", "com.googleusercontent.apps.24903853329-tfe3ualcp55o35qa3hupc4ogsu8tr902"] }],
    },
  },
  android: {
    package: "in.autodeck.customer",
    versionCode: 2,
    // Photo-only uploads need neither microphone capture nor drawing over other apps.
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"],
    adaptiveIcon: {
      backgroundColor: "#ffffff",
      foregroundImage: "./assets/brand/icon-512.png",
    },
    // Google Play Developer account required — REQUIRES APPROVAL ($25 one-time)
  },
  plugins: [
    "expo-router",
    "./plugins/with-android-kotlin-alignment.cjs",
    ["react-native-nitro-google-signin", { iosUrlScheme: "com.googleusercontent.apps.24903853329-tfe3ualcp55o35qa3hupc4ogsu8tr902" }],
    [
      "expo-build-properties",
      {
        android: { minSdkVersion: 26 },
        ios: { deploymentTarget: "16.0" },
      },
    ],
  ],
  extra: { eas: { projectId: "5a7ec752-81a0-43bc-b7e1-401217fa2c7c" } },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
