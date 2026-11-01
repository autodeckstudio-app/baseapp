import { defineConfig } from "vitest/config";
import path from "node:path";

// Isolated render harness (same pattern as apps/customer/vitest.render.config.ts):
// renders real kit components (Button etc.) with react-native-web standing in
// for react-native. Proves JSX wiring + copy + interaction reach the rendered
// tree. Does NOT prove on-device behavior, navigation, or styling.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  // Expo/RN modules reference __DEV__ at module scope.
  define: { __DEV__: "true" },
  // Linked workspace packages (packages/ui etc.) would be SSR-externalized
  // before the react-native alias can apply; noExternal forces vite to
  // process their imports too.
  ssr: { noExternal: true },
  resolve: {
    alias: [
      { // Bare "react-native-web" would resolve relative to the IMPORTER, and
        // pnpm does not link it under packages/ui; use the absolute path.
        find: /^react-native$/,
        replacement: path.resolve(__dirname, "test/stubs/react-native-web.ts"),
      },
      { find: /^@autodeck\/ui\/native$/, replacement: path.resolve(__dirname, "test/stubs/ui-native.ts") },
    ],
  },
  test: { include: ["src/**/*.render.test.tsx"] },
});
