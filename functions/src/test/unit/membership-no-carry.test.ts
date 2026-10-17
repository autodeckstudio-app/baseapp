import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { freshGrant } from "../../lib/membership-grant.js";
import { upgradePricePaise, washesLostOnUpgrade, UPGRADE_PRICING_CONFIRMED } from "@autodeck/core";

const plan = (price: number, washes: number, pickups = 0) => ({ priceInPaise: price, includedWashes: washes, freePickups: pickups, prioritySlot: false, discountPercent: 0 });

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? (f === "test" ? [] : sources(p)) : p.endsWith(".ts") ? [p] : []; });
}

describe("no washes carry forward (owner rule, 18 Oct)", () => {
  it("a new plan, renewal or upgrade starts from the plan's own numbers", () => {
    expect(freshGrant(plan(540000, 6, 3))).toMatchObject({ washesTotal: 6, washesUsed: 0, pickupsTotal: 3, pickupsUsed: 0 });
  });
  it("freshGrant takes no previous membership, so nothing can be carried", () => {
    expect(freshGrant.length).toBe(1);
  });
  it("every place that sets washesTotal uses the plan's includedWashes", () => {
    const bad: string[] = [];
    for (const f of sources(join(__dirname, "../.."))) {
      for (const m of readFileSync(f, "utf8").matchAll(/washesTotal:\s*([^,\n}]+)/g)) {
        const v = m[1]!.trim();
        if (!/^(plan\.includedWashes|grant\.washesTotal|g\.washesTotal)$/.test(v) && !f.includes("/booking/")) bad.push(`${f}: ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("no code adds washesTotal or unused washes to a new membership", () => {
    for (const f of sources(join(__dirname, "../.."))) {
      expect(readFileSync(f, "utf8")).not.toMatch(/washesTotal:\s*[^,\n}]*(\+|-)\s*[^,\n}]*(washesTotal|washesUsed|unused|carry)/i);
    }
  });
});

describe("upgrade price (ON HOLD: owner is settling the loophole fix)", () => {
  const q = (cur: number, next: number, unused = 0) => upgradePricePaise({ currentPlanPricePaise: cur, newPlanPricePaise: next, unusedWashes: unused });
  it("a cheaper or equal plan is not an upgrade", () => { expect(q(360000, 360000)).toBeNull(); expect(q(540000, 360000)).toBeNull(); });
  it("a dearer plan has a price", () => { expect(q(360000, 540000, 2)).toBeGreaterThan(0); });
  it("counts washes lost, never negative", () => { expect(washesLostOnUpgrade({ washesTotal: 4, washesUsed: 1 })).toBe(3); expect(washesLostOnUpgrade({ washesTotal: 4, washesUsed: 9 })).toBe(0); });
  it("stays flagged unconfirmed until the owner settles the price", () => { expect(UPGRADE_PRICING_CONFIRMED).toBe(false); });
});

describe("upgrade wiring", () => {
  const read = (p: string) => readFileSync(join(__dirname, "../..", p), "utf8");
  it("every place that activates a pending plan also ends the plan it replaces", () => {
    for (const f of ["functions/membership/activateMembership.ts", "functions/membership/confirmMembershipPayment.ts", "lib/razorpay-webhook.ts", "functions/payment/confirmPaymentMock.ts"]) {
      const s = read(f);
      expect(s, f).toContain("readUpgradeSource(");
      expect(s, f).toContain("endUpgradedMembership(");
    }
  });
  it("the upgrade callable starts fresh, charges the difference and needs an active plan", () => {
    const s = read("functions/membership/upgradeMembership.ts");
    expect(s).toContain("...freshGrant(plan)");
    expect(s).toContain("upgradePricePaise(");
    expect(s).toContain("amount: difference");
    expect(s).toMatch(/need an active plan/);
    expect(s).not.toMatch(/washesUsed: [^0]/);
  });
});
