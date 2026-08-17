import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "emulator",
    include: ["src/**/*.emulator.test.ts"],
    environment: "node",
    globals: true,
    timeout: 30_000,
    setupFiles: ["./src/test/emulator-setup.ts"],
  },
});
