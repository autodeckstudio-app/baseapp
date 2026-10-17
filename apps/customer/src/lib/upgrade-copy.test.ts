import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { upgradeConfirmCopy } from "./upgrade-copy";

describe("upgrade confirmation", () => {
  it("states the exact number of washes lost", () => {
    expect(upgradeConfirmCopy(3, "silver", "Gold", "Rs 1,800").body).toContain("lose 3 unused washes");
    expect(upgradeConfirmCopy(1, "silver", "Gold", "Rs 1,800").body).toContain("lose 1 unused wash left");
    expect(upgradeConfirmCopy(0, "silver", "Gold", "Rs 1,800").body).toContain("no unused washes");
  });
  it("offers Cancel and Confirm upgrade", () => {
    const c = upgradeConfirmCopy(2, "silver", "Gold", "x");
    expect([c.cancel, c.confirm]).toEqual(["Cancel", "Confirm upgrade"]);
  });
  it("the purchase screen asks before it pays and never skips the pop-up", () => {
    const s = readFileSync(`${__dirname}/../app/(tabs)/membership/purchase.tsx`, "utf8");
    expect(s).toContain("upgradeConfirmCopy(");
    expect(s).toContain("washesLostOnUpgrade(");
    // the upgrade call is only reachable from the confirm button
    expect(s.match(/upgradeMembership\(/g)?.length).toBe(1);
    expect(s).toMatch(/confirmUpgrade[\s\S]*upgradeMembership\(/);
  });
});
