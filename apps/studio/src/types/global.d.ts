// Expo/Metro exposes process.env for EXPO_PUBLIC_* and USE_FIREBASE_EMULATOR variables.
// TypeScript doesn't know about process in React Native — declare it here.
declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_FIREBASE_API_KEY?: string;
    readonly EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
    readonly EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
    readonly EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
    readonly EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
    readonly EXPO_PUBLIC_FIREBASE_APP_ID?: string;
    readonly USE_FIREBASE_EMULATOR?: string;
    readonly FIREBASE_EMULATOR_HOST?: string;
    readonly [key: string]: string | undefined;
  };
};

// React Native __DEV__ global
declare const __DEV__: boolean;
