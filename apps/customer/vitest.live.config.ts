import { defineConfig } from "vitest/config";
import path from "node:path";
import { createRequire } from "node:module";

// LIVE-emulator screen proof harness: the REAL screen, REAL client SDKs (auth,
// firestore listeners, functions callable), REAL paper-service - only device-only
// seams are stubbed (AsyncStorage, image picker, expo-router, expo-crypto ids).
// Requires the local emulator suite (auth 9099, firestore $LIVE_FIRESTORE_PORT,
// functions 5001, storage 9199) serving the built functions.
const req = createRequire(import.meta.url);
// firebase/auth must be the RN build (lib/firebase uses getReactNativePersistence,
// which the node/browser builds do not export) - exactly what Metro resolves on device.
const fbAuthCjs = req.resolve("firebase/auth"); // .../node_modules/firebase/auth/dist/index.cjs.js
const rnAuth = path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/auth/dist/rn/index.js");

export default defineConfig({
  esbuild: { jsx: "automatic" },
  define: { __DEV__: "true" },
  plugins: [
    {
      // Metro turns asset require()s into module ids; the harness stubs them the same way.
      name: "metro-asset-stub",
      enforce: "pre",
      resolveId(id: string) {
        if (/\.(png|jpe?g|webp|gif|svg|ttf|otf)$/.test(id)) return "\0metro-asset-stub";
        return null;
      },
      load(id: string) {
        if (id === "\0metro-asset-stub") return "export default 1;";
        return null;
      },
    },
  ],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: path.resolve(__dirname, "test/stubs/react-native-harness.ts") },
      { find: /^firebase\/auth$/, replacement: rnAuth },
      // Same single-instance rule for the app component registry: the RN auth build
      // registers against @firebase/app ESM; loading firebase/app CJS would split it.
      { find: /^firebase\/app$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/app/dist/index.cjs.js") },
      { find: /^@firebase\/app$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/app/dist/index.cjs.js") },
      { find: /^@firebase\/app\/node$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/app/dist/index.cjs.js") },
      // One component registry for every service: pin each service to a single
      // node-cjs build whose @firebase/app import is the aliased copy above.
      { find: /^firebase\/firestore$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/firestore/dist/index.node.cjs.js") },
      { find: /^@firebase\/firestore$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/firestore/dist/index.node.cjs.js") },
      { find: /^firebase\/functions$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/functions/dist/index.node.cjs.js") },
      { find: /^@firebase\/functions$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/functions/dist/index.node.cjs.js") },
      { find: /^firebase\/storage$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/storage/dist/index.cjs.js") },
      { find: /^@firebase\/storage$/, replacement: path.resolve(path.dirname(fbAuthCjs), "../../../@firebase/storage/dist/index.cjs.js") },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: path.resolve(__dirname, "test/stubs/async-storage.ts") },
      { find: /^expo\/fetch$/, replacement: path.resolve(__dirname, "test/stubs/expo-fetch.ts") },
      { find: /^expo-image-picker$/, replacement: path.resolve(__dirname, "test/stubs/expo-image-picker.ts") },
      { find: /^expo-router$/, replacement: path.resolve(__dirname, "test/stubs/expo-router.ts") },
      { find: /^expo-crypto$/, replacement: path.resolve(__dirname, "test/stubs/expo-crypto.ts") },
      { find: /^@autodeck\/ui\/native$/, replacement: path.resolve(__dirname, "test/stubs/ui-native.ts") },
      // Metro asset require()s (see test/stubs/imagery.ts).
      ...["./imagery", "../lib/imagery", "../../lib/imagery", "../../../lib/imagery"].map((find) => ({ find, replacement: path.resolve(__dirname, "test/stubs/imagery.ts") })),
      { find: /^\.\/AppBar$/, replacement: path.resolve(__dirname, "test/stubs/app-bar.tsx") },
      { find: /^\.\.\/\.\.\/\.\.\/ui\/AppBar$/, replacement: path.resolve(__dirname, "test/stubs/app-bar.tsx") },
    ],
  },
  test: { include: ["src/**/*.live.emulator.test.tsx"], setupFiles: ["./test/live-env.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
  // The client SDKs must load through vite (the firebase/auth alias resolves the RN
  // build); node-side externalization would bypass the alias and split the component
  // registry ("Component auth has not been registered yet").
  ssr: { noExternal: [/^firebase/, /^@firebase/, "@react-native-async-storage/async-storage"] },
});
