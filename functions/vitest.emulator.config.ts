import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "emulator",
    include: ["src/**/*.emulator.test.ts"],
    environment: "node",
    globals: true,
    timeout: 30_000,
    setupFiles: ["./src/test/emulator-setup.ts"],
    // All emulator test files share one real Firestore/Auth emulator instance.
    // security-rules.emulator.test.ts calls clearFirestore() between every
    // test — running files in parallel lets that wipe data another file just
    // seeded. Run files sequentially so they don't stomp on each other.
    fileParallelism: false,
  },
});
