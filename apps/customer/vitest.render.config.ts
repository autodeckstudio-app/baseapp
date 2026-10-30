import { defineConfig } from "vitest/config";
import path from "node:path";

// Isolated render harness: renders real kit components (Notice/Button/T) with
// react-native-web standing in for react-native. Proves JSX wiring + copy reach
// the rendered tree. Does NOT prove on-device behavior, navigation, or styling.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: "react-native-web" },
      { find: /^expo-router$/, replacement: path.resolve(__dirname, "test/stubs/expo-router.ts") },
      { find: /^@autodeck\/ui\/native$/, replacement: path.resolve(__dirname, "test/stubs/ui-native.ts") },
      { find: /^\.\/AppBar$/, replacement: path.resolve(__dirname, "test/stubs/app-bar.tsx") },
      { find: /^\.\.\/\.\.\/\.\.\/ui\/AppBar$/, replacement: path.resolve(__dirname, "test/stubs/app-bar.tsx") },
    ],
  },
  test: { include: ["src/**/*.render.test.tsx"] },
});
