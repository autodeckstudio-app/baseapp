import { describe, it, expect } from "vitest";
import { membershipForFreePickup, pickupsLeft } from "../../lib/pickup-benefit.js";
import { readFileSync } from "node:fs";

const m = (o: object) => ({ id: "m", status: "active" as const, pickupsTotal: 3, pickupsUsed: 0, endDate: "2026-12-01", ...o });
describe("member free pickups", () => {
  it("counts what is left and never goes below zero", () => {
    expect(pickupsLeft({ pickupsTotal: 3, pickupsUsed: 1 })).toBe(2);
    expect(pickupsLeft({ pickupsTotal: 1, pickupsUsed: 4 })).toBe(0);
    expect(pickupsLeft({})).toBe(0);
  });
  it("memberships sold before the field existed have none", () => {
    expect(membershipForFreePickup([m({ pickupsTotal: undefined })], "2026-10-17T00:00:00Z")).toBeNull();
  });
  it("only an active, in-date membership with pickups left counts", () => {
    const now = "2026-10-17T00:00:00Z";
    expect(membershipForFreePickup([m({ status: "expired" })], now)).toBeNull();
    expect(membershipForFreePickup([m({ pickupsUsed: 3 })], now)).toBeNull();
    expect(membershipForFreePickup([m({ endDate: "2026-10-01" })], now)).toBeNull();
    expect(membershipForFreePickup([m({})], now)?.id).toBe("m");
  });
  it("uses the one ending soonest first", () => {
    const got = membershipForFreePickup([m({ id: "late", endDate: "2026-12-01" }), m({ id: "soon", endDate: "2026-10-20" })], "2026-10-17T00:00:00Z");
    expect(got?.id).toBe("soon");
  });
  it("guard: the pickup update writes memberships only after its reads", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
    const write = src.indexOf("if (chargeMembership) tx.update");
    expect(write).toBeGreaterThan(src.lastIndexOf("await tx.get("));
  });
});
