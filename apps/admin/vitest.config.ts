import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    include: ["src/**/*.test.ts"],
    exclude: ["**/*.emulator.test.ts", "**/node_modules/**"],
    environment: "node",
    globals: true,
  },
});
