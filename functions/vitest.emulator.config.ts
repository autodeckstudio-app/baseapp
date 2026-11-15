import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "emulator",
    include: ["src/**/*.emulator.test.ts"],
    environment: "node",
    globals: true,
    // Phase 5B fix: "timeout" is not a real Vitest config key (the correct
    // one is testTimeout) — this had silently done nothing since it was
    // written, leaving every emulator test on the 5000ms default. Harmless
    // while suite load was light; started intermittently timing out
    // legitimate concurrent-transaction tests (unrelated to any one change)
    // once the suite grew.
    testTimeout: 30_000,
    setupFiles: ["./src/test/emulator-setup.ts"],
    // All emulator test files share one real Firestore/Auth emulator instance.
    // security-rules.emulator.test.ts calls clearFirestore() between every
    // test — running files in parallel lets that wipe data another file just
    // seeded. Run files sequentially so they don't stomp on each other.
    fileParallelism: false,
  },
});
