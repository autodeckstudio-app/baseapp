import{resolve}from"node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve:{alias:[{find:"../price-list-sync-plan.js",replacement:resolve(__dirname,"src/lib/price-list-sync-plan.ts")}]},
  test: {
    name: "unit",
    include: ["src/test/unit/**/*.test.ts"],
    environment: "node",
    exclude:["src/test/unit/bay-release-emulator.test.ts"],
    globals: true,
  },
});
