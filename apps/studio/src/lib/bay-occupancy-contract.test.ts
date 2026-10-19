import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The walk-in screen and the bay board must use the one shared rule, so a no-show frees its bay the same way on both.
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("bay occupancy uses the shared rule", () => {
  for (const f of ["app/(tabs)/walkin.tsx", "app/(tabs)/bays.tsx"]) {
    it(f, () => { const s = read(f); expect(s).toContain("jobHoldsBay"); expect(s).not.toContain("ACTIVE_STATUSES"); });
  }
});
