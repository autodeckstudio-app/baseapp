import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { freshGrant } from "../../lib/membership-grant.js";
import { upgradePricePaise, upgradePaysFullPrice, washesLostOnUpgrade, pickupsLostOnUpgrade, UPGRADE_PRICING_CONFIRMED } from "@autodeck/core";

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

describe("upgrade price (owner rule: difference only if nothing used, else full price)", () => {
  const q = (cur: number, next: number, w = 0, p = 0) => upgradePricePaise({ currentPlanPricePaise: cur, newPlanPricePaise: next, washesUsed: w, pickupsUsed: p });
  it("a cheaper or equal plan is not an upgrade", () => { expect(q(360000, 360000)).toBeNull(); expect(q(540000, 360000)).toBeNull(); });
  it("nothing used: pay the difference", () => { expect(q(360000, 540000)).toBe(180000); });
  it("one wash used: pay the full new price (closes the use-all-then-upgrade loophole)", () => {
    expect(q(360000, 540000, 1)).toBe(540000);
    expect(q(360000, 540000, 4)).toBe(540000);
  });
  it("one pickup used: pay the full new price", () => { expect(q(360000, 540000, 0, 1)).toBe(540000); });
  it("never turns unused washes into money credit", () => {
    expect(q(360000, 540000, 1)).toBeGreaterThanOrEqual(540000);
    expect(upgradePaysFullPrice({ washesUsed: 0, pickupsUsed: 0 })).toBe(false);
    expect(upgradePaysFullPrice({ washesUsed: 1 })).toBe(true);
  });
  it("counts washes and pickups lost, never negative", () => {
    expect(washesLostOnUpgrade({ washesTotal: 4, washesUsed: 1 })).toBe(3); expect(washesLostOnUpgrade({ washesTotal: 4, washesUsed: 9 })).toBe(0);
    expect(pickupsLostOnUpgrade({ pickupsTotal: 3, pickupsUsed: 1 })).toBe(2); expect(pickupsLostOnUpgrade({})).toBe(0);
  });
  it("is marked confirmed", () => { expect(UPGRADE_PRICING_CONFIRMED).toBe(true); });
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
    expect(s).not.toMatch(/washesUsed: (?!current\.washesUsed)[^0]/);
  });
});
