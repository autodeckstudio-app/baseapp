import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("add-car size copy does not imply size pricing outside PPF (PPF is the only size-priced category)", () => {
  const s = readFileSync("src/app/(tabs)/garage/add.tsx", "utf8");
  expect(s).toContain("Only PPF prices change with car size.");
  expect(s).not.toContain("Prices will use this size automatically");
});
