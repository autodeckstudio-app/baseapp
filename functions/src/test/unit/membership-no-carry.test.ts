import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { freshGrant, upgradeDifferencePaise } from "../../lib/membership-grant.js";

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

describe("upgrade price (ASSUMED difference-only, not yet confirmed by the owner)", () => {
  it("charges the difference for a dearer plan", () => { expect(upgradeDifferencePaise(plan(360000, 4), plan(540000, 6))).toBe(180000); });
  it("is not an upgrade for the same or a cheaper plan", () => {
    expect(upgradeDifferencePaise(plan(360000, 4), plan(360000, 4))).toBeNull();
    expect(upgradeDifferencePaise(plan(540000, 6), plan(360000, 4))).toBeNull();
  });
});
