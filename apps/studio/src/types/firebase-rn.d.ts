// Module augmentation: adds getReactNativePersistence to the firebase/auth type surface.
// The standard @firebase/auth types (auth-public.d.ts) omit this RN-only export.
// At runtime, metro.config.js routes @firebase/auth to dist/rn/index.js which provides it.
import type { ReactNativeAsyncStorage, Persistence } from "firebase/auth";

declare module "firebase/auth" {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
