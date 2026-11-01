import { defineConfig } from "vitest/config";

// Default unit run: source/logic tests only. Render tests (*.render.test.tsx)
// need the isolated render harness (react-native-web aliases + JSX transform)
// in vitest.render.config.ts - run them with `npm run test:render`.
// Live-emulator screen proofs (*.live.emulator.test.tsx) need the live harness
// (react-native-harness alias, emulator env, running emulator suite) in
// vitest.live.config.ts; the default run cannot even parse the real
// react-native package (Flow "import typeof"), so they are excluded here and
// executed explicitly via the live config.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.render.test.tsx", "src/**/*.live.emulator.test.tsx"],
  },
});
