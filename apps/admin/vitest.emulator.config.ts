import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "admin-emulator",
    include: ["src/**/*.emulator.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30_000,
    setupFiles: ["./src/test/emulator-setup.ts"],
  },
});
