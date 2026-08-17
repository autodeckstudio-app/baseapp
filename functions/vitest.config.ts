import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    include: ["src/test/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
});
