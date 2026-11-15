import { defineConfig } from "vitest/config";

// Mounted-interaction harness: mounts the REAL components (JobControls +
// DeliveryDeclaration) with react-test-renderer and firebase/auth-context
// mocked at the module boundary, and drives actual clicks/submits. Proves
// wiring + interaction + async gating, not styling or a live admin session.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    name: "render",
    include: ["src/**/*.render.test.tsx"],
    environment: "node",
    globals: true,
  },
});
