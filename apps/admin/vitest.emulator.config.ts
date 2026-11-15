import { defineConfig } from "vitest/config";

export default defineConfig({
  // Labeled harness repair: the accepted cross-principal test (ee52804d) mounts the real
  // provider with JSX - same automatic runtime as vitest.render.config.ts.
  esbuild: { jsx: "automatic" },
  test: {
    name: "admin-emulator",
    include: ["src/**/*.emulator.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30_000,
    setupFiles: ["./src/test/emulator-setup.ts"],
  },
});
