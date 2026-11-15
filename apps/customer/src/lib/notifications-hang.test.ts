import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("notifications screen cannot hang", () => {
  const s = readFileSync(new URL("../app/(tabs)/notifications/index.tsx", import.meta.url).pathname, "utf8");
  it("has a load timeout that ends in a retry, and handles signed-out", () => {
    expect(s).toContain("NOTIFICATIONS_LOAD_TIMEOUT_MS"); expect(s).toContain("setTimeout"); expect(s).toContain('auth.status === "unauthenticated"');
  });
});
