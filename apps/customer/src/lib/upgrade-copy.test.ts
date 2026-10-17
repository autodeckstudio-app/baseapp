import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { upgradeConfirmCopy } from "./upgrade-copy";

const c = (o: Partial<Parameters<typeof upgradeConfirmCopy>[0]> = {}) => upgradeConfirmCopy({ lostWashes: 3, lostPickups: 0, tier: "silver", newName: "Gold", priceLabel: "Rs 1,800", fullPrice: false, ...o });
describe("upgrade confirmation", () => {
  it("states the exact number of washes and pickups lost", () => {
    expect(c().body).toContain("lose 3 unused washes");
    expect(c({ lostWashes: 1 }).body).toContain("lose 1 unused wash left");
    expect(c({ lostWashes: 2, lostPickups: 1 }).body).toContain("2 unused washes and 1 free pickup");
    expect(c({ lostWashes: 0 }).body).toContain("no unused washes or pickups");
  });
  it("says difference-only when nothing was used, full price otherwise", () => {
    expect(c().body).toContain("only the difference, Rs 1,800");
    expect(c({ fullPrice: true, priceLabel: "Rs 5,400" }).body).toContain("full Gold price, Rs 5,400");
  });
  it("says the old plan ends and the new one runs 30 days", () => { expect(c().body).toMatch(/plan ends when you pay[\s\S]*30 days/); });
  it("offers Cancel and Confirm upgrade", () => { expect([c().cancel, c().confirm]).toEqual(["Cancel", "Confirm upgrade"]); });
  it("the purchase screen asks before it pays and never skips the pop-up", () => {
    const s = readFileSync(`${__dirname}/../app/(tabs)/membership/purchase.tsx`, "utf8");
    expect(s).toContain("upgradeConfirmCopy(");
    expect(s).toContain("washesLostOnUpgrade(");
    // a new upgrade is only reachable from the confirm button; the one other call re-pays an already confirmed pending upgrade
    expect(s.match(/upgradeMembership\(/g)?.length).toBe(2);
    expect(s).toContain("pendingIsUpgrade ? await upgradeMembership(");
    expect(s).toMatch(/confirmUpgrade[\s\S]*upgradeMembership\(/);
  });
});
