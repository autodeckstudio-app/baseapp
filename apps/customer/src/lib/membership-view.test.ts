import { describe, it, expect } from "vitest";

import { pickupsLine, pickupsLeftLine, compareCols, reconcileRedeemed } from "./membership-view";
describe("pickup perks", () => {
  it("says nothing when a plan has no pickups", () => { expect(pickupsLine(0)).toBeNull(); expect(pickupsLine(undefined)).toBeNull(); });
  it("pluralises", () => { expect(pickupsLine(1)).toBe("1 free pickup"); expect(pickupsLine(3)).toBe("3 free pickups"); });
  it("shows pickups left, and nothing for old memberships", () => {
    expect(pickupsLeftLine({ pickupsTotal: 3, pickupsUsed: 1 })).toBe("2 of 3 free pickups left");
    expect(pickupsLeftLine({})).toBeNull();
  });
  it("compare columns carry pickups and priority slot, default none", () => {
    const cols = compareCols([{ id: "a", name: "A", priceInPaise: 1, includedWashes: 1, discountPercent: 0, active: true, freePickups: 2, prioritySlot: true }, { id: "b", name: "B", priceInPaise: 2, includedWashes: 1, discountPercent: 0, active: true }] as never, null);
    expect(cols.map((c) => [c.pickups, c.priority])).toEqual([[2, true], [0, false]]);
  });
});

describe("reconcileRedeemed", () => {
  const r = { total: 225000, washes: 2, washValue: 225000, discountValue: 0 };
  it("keeps the ledger when it matches the plan card", () => { expect(reconcileRedeemed(r, 2)).toEqual(r); });
  it("drops restored wash credits when the card says none were used", () => { expect(reconcileRedeemed(r, 0).total).toBe(0); expect(reconcileRedeemed(r, 0).washes).toBe(0); });
  it("keeps discount value when only the wash count disagrees", () => { expect(reconcileRedeemed({ ...r, discountValue: 5000, total: 230000 }, 0)).toEqual({ total: 5000, washes: 0, washValue: 0, discountValue: 5000 }); });
});
