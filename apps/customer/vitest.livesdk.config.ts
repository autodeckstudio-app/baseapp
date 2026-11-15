import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

// Live-SDK identity journey harness: REAL Firebase JS SDK clients against the
// local emulator suite (demo-autodeck project only). Everything is the app's
// real code (firebase.ts, auth-service, useAuth, claim screen, Bookings
// route); only device seams are stubbed (AsyncStorage in-memory, expo-router,
// expo-crypto, native UI kit, imagery assets, push, Razorpay checkout,
// catalogue callable). NOT a production path: the fixture refuses any
// non-demo project id and firebase.ts itself fails closed on emulator proof.
//
// The whole firebase graph is pinned to CJS builds and left EXTERNALIZED, so
// every consumer - firebase.ts and the auth RN build's own internal
// requires - shares Node's single require cache. Mixed vite-runner/native
// loading duplicates @firebase/app and component registration then fails
// with "Component auth has not been registered yet".
const req = createRequire(import.meta.url);
const atReq = createRequire(req.resolve("firebase/auth"));
const pkgDir = (name: string): string => {
  let dir = path.dirname(atReq.resolve(name));
  while (!fs.existsSync(path.join(dir, "package.json"))) dir = path.dirname(dir);
  return dir;
};
const authDir = pkgDir("@firebase/auth");
const appDir = pkgDir("@firebase/app");
const firestoreDir = pkgDir("@firebase/firestore");
const functionsDir = pkgDir("@firebase/functions");
const storageDir = pkgDir("@firebase/storage");
const builds = {
  authRn: path.join(authDir, "dist", "rn", "index.js"), // node build lacks getReactNativePersistence
  appCjs: path.join(appDir, "dist", "index.cjs.js"),
  firestoreCjs: path.join(firestoreDir, "dist", "index.node.cjs.js"),
  functionsCjs: path.join(functionsDir, "dist", "index.node.cjs.js"),
  storageCjs: path.join(storageDir, "dist", "index.node.cjs.js"),
};
for (const [k, f] of Object.entries(builds)) {
  if (!fs.existsSync(f)) throw new Error(`firebase build missing: ${k} at ${f}`);
}

export default defineConfig({
  esbuild: { jsx: "automatic" },
  define: { __DEV__: "true" },
  resolve: {
    alias: [
      { find: /^firebase\/app$/, replacement: builds.appCjs },
      { find: /^firebase\/auth$/, replacement: builds.authRn },
      { find: /^firebase\/firestore$/, replacement: builds.firestoreCjs },
      { find: /^firebase\/functions$/, replacement: builds.functionsCjs },
      { find: /^firebase\/storage$/, replacement: builds.storageCjs },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: path.resolve(__dirname, "demo/livesdk/async-storage.cjs") },
      { find: /^react-native$/, replacement: "react-native-web" },
      { find: /^expo-crypto$/, replacement: path.resolve(__dirname, "test/stubs/expo-crypto.ts") },
      { find: /^@autodeck\/ui\/native$/, replacement: path.resolve(__dirname, "test/stubs/ui-native.ts") },
      { find: /^\.\/AppBar$/, replacement: path.resolve(__dirname, "test/stubs/app-bar.tsx") },
      { find: /^\.\.\/\.\.\/\.\.\/ui\/AppBar$/, replacement: path.resolve(__dirname, "test/stubs/app-bar.tsx") },
    ],
  },
  test: {
    include: ["demo/livesdk/**/*.livesdk.test.tsx"],
    testTimeout: 60000,
    hookTimeout: 60000,
    env: {
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-autodeck",
      EXPO_PUBLIC_FIREBASE_API_KEY: "demo-key",
      USE_FIREBASE_EMULATOR: "true",
      EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: "127.0.0.1",
      EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT: "8099",
      EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT: "5001",
      EXPO_PUBLIC_AUTH_EMULATOR_PORT: "9099",
    },
  },
});
