import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    include: ["src/test/unit/**/*.test.ts"],
    environment: "node",
    exclude:["src/test/unit/bay-release-emulator.test.ts"],
    globals: true,
  },
});
