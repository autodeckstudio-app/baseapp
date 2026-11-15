import { defineConfig } from "vitest/config";

// Default unit run: source/logic tests only. Render tests (*.render.test.tsx)
// need the isolated render harness (react-native-web aliases + JSX transform)
// in vitest.render.config.ts - run them with `npm run test:render`.
// The default run cannot even parse the real react-native package
// (Flow "import typeof"), so render tests are excluded here and executed
// explicitly via the render config. Mirrors the customer app convention.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.render.test.tsx", "src/**/*.live.emulator.test.tsx"],
  },
});
